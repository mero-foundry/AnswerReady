import { readFile } from 'node:fs/promises'
import dns from 'node:dns/promises'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import express from 'express'

const app = express()
const port = Number(process.env.PORT || 8787)
const isProduction = process.env.NODE_ENV === 'production'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.resolve(__dirname, '../dist')

app.use(express.json({ limit: '64kb' }))

app.use((request, response, next) => {
  if (!isProduction) {
    response.setHeader('access-control-allow-origin', process.env.DEV_ORIGIN || 'http://localhost:5173')
    response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
    response.setHeader('access-control-allow-headers', 'content-type')
  }

  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return
  }

  next()
})

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.get('/api/checkout-link', (_request, response) => {
  response.json({ url: process.env.STRIPE_PAYMENT_LINK || null })
})

app.post('/api/audit', async (request, response) => {
  const startedAt = performance.now()

  try {
    const normalizedUrl = await normalizeAndGuardUrl(request.body?.url)
    const page = await fetchPublicPage(normalizedUrl)
    const snapshot = extractSnapshot(page.html, page.finalUrl)
    const report = buildHeuristicReport(snapshot, page.finalUrl, startedAt)
    const ai = await enrichWithOpenAI(report, snapshot)

    response.json({
      ...report,
      aiSummary: ai?.summary ?? report.aiSummary,
      aiActions: ai?.actions?.length ? ai.actions : report.aiActions,
      aiPowered: Boolean(ai),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audit failed.'
    response.status(400).json({ error: message })
  }
})

app.use(express.static(distPath))
app.get(/.*/, async (_request, response) => {
  try {
    response.type('html').send(await readFile(path.join(distPath, 'index.html'), 'utf8'))
  } catch {
    response.status(404).send('Run npm run build before opening the app.')
  }
})

app.listen(port, () => {
  console.log(`AnswerReady API listening on http://localhost:${port}`)
})

async function normalizeAndGuardUrl(value) {
  if (typeof value !== 'string' || value.trim().length < 3) {
    throw new Error('Enter a public website URL.')
  }

  const withProtocol = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`
  let url

  try {
    url = new URL(withProtocol)
  } catch {
    throw new Error('Enter a valid public website URL.')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only public http and https URLs can be scanned.')
  }

  await assertPublicHostname(url.hostname)
  return url.toString()
}

async function fetchPublicPage(initialUrl) {
  let currentUrl = initialUrl

  for (let redirectCount = 0; redirectCount < 4; redirectCount += 1) {
    const response = await fetchWithTimeout(currentUrl)

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')

      if (!location) {
        throw new Error('The site redirected without a destination.')
      }

      const nextUrl = new URL(location, currentUrl)
      await normalizeAndGuardUrl(nextUrl.toString())
      currentUrl = nextUrl.toString()
      continue
    }

    if (!response.ok) {
      throw new Error(`The site returned HTTP ${response.status}.`)
    }

    const contentType = response.headers.get('content-type') ?? ''

    if (!contentType.includes('text/html')) {
      throw new Error('The URL did not return an HTML page.')
    }

    return {
      finalUrl: currentUrl,
      html: await response.text(),
    }
  }

  throw new Error('The site redirected too many times.')
}

function fetchWithTimeout(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 9_000)

  return fetch(url, {
    redirect: 'manual',
    signal: controller.signal,
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'AnswerReadyBot/0.1 (+https://answerready.local)',
    },
  }).finally(() => clearTimeout(timeout))
}

async function assertPublicHostname(hostname) {
  const lowerHost = hostname.toLowerCase()

  if (
    lowerHost === 'localhost' ||
    lowerHost.endsWith('.localhost') ||
    lowerHost.endsWith('.local') ||
    lowerHost.endsWith('.internal')
  ) {
    throw new Error('Local and private network URLs cannot be scanned.')
  }

  const addresses = await dns.lookup(lowerHost, { all: true, verbatim: true })

  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('Local and private network URLs cannot be scanned.')
  }
}

function isPrivateAddress(address) {
  const ipVersion = net.isIP(address)

  if (ipVersion === 4) {
    const [a, b] = address.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
  }

  if (ipVersion === 6) {
    const normalized = address.toLowerCase()
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    )
  }

  return true
}

function extractSnapshot(html, url) {
  const $ = cheerio.load(html)
  $('script, style, noscript, svg').remove()

  const title = clean($('title').first().text()) || new URL(url).hostname
  const description = clean(
    $('meta[name="description"]').attr('content') ??
      $('meta[property="og:description"]').attr('content') ??
      '',
  )
  const headings = $('h1, h2')
    .map((_, element) => clean($(element).text()))
    .get()
    .filter(Boolean)
    .slice(0, 18)
  const links = $('a[href]')
    .map((_, element) => ({
      href: String($(element).attr('href') ?? ''),
      text: clean($(element).text()),
    }))
    .get()
    .filter((link) => link.text || link.href)
    .slice(0, 180)
  const bodyText = clean($('body').text()).slice(0, 12_000)
  const jsonLdTypes = $('script[type="application/ld+json"]')
    .map((_, element) => {
      try {
        const parsed = JSON.parse($(element).contents().text())
        const items = Array.isArray(parsed) ? parsed : [parsed]
        return items.flatMap((item) => item['@type'] ?? [])
      } catch {
        return []
      }
    })
    .get()
    .filter(Boolean)

  return {
    url,
    title,
    description,
    headings,
    links,
    bodyText,
    jsonLdTypes,
  }
}

function buildHeuristicReport(snapshot, finalUrl, startedAt) {
  const text = `${snapshot.title} ${snapshot.description} ${snapshot.headings.join(' ')} ${snapshot.bodyText}`.toLowerCase()
  const linkText = snapshot.links.map((link) => `${link.text} ${link.href}`).join(' ').toLowerCase()

  const checks = {
    hasClearTitle: snapshot.title.length >= 18 && snapshot.title.length <= 75,
    hasMetaDescription: snapshot.description.length >= 70 && snapshot.description.length <= 180,
    hasAudienceLanguage: hasAny(text, ['for teams', 'for founders', 'for agencies', 'for developers', 'for sales', 'for operators', 'built for']),
    hasFeatureLanguage: hasAny(text, ['platform', 'automate', 'workflow', 'dashboard', 'integrations', 'api', 'analytics', 'reporting']),
    hasDocsEvidence: hasAny(linkText, ['docs', 'documentation', 'api', 'developers', 'help center', 'guide']),
    hasCaseStudies: hasAny(text + linkText, ['case study', 'customer story', 'customers', 'testimonial', 'reviews']),
    hasStructuredData: snapshot.jsonLdTypes.length > 0,
    hasPricing: hasAny(text + linkText, ['pricing', 'plans', '$', 'per month', '/mo', 'quote']),
    hasTrust: hasAny(text + linkText, ['security', 'soc 2', 'gdpr', 'privacy', 'terms', 'trust', 'status']),
    hasComparison: hasAny(text + linkText, ['alternative', 'compare', 'vs ', 'versus', 'competitor', 'migration']),
    hasIntegrations: hasAny(text + linkText, ['integration', 'integrations', 'slack', 'salesforce', 'hubspot', 'zapier', 'github', 'jira']),
  }

  const categories = [
    category('positioning', 'Positioning', 'How clearly AI can infer who you are, what you do, and who it is for.', [
      checks.hasClearTitle,
      checks.hasMetaDescription,
      checks.hasAudienceLanguage,
      checks.hasFeatureLanguage,
    ], [
      checks.hasClearTitle ? `Title is specific enough: "${snapshot.title}".` : 'Title is too short, too long, or too generic.',
      checks.hasMetaDescription ? 'Meta description gives AI systems a useful summary.' : 'Meta description is missing or not descriptive enough.',
      checks.hasAudienceLanguage ? 'Audience language is visible on the page.' : 'Add a direct "built for..." audience statement.',
      checks.hasFeatureLanguage ? 'Product capability language is present.' : 'Add concrete product capability language near the top.',
    ], [
      'Rewrite the first-screen copy as: product category + audience + outcome.',
      'Add a concise one-sentence product definition that can be quoted by AI answers.',
    ]),
    category('evidence', 'AI-readable Evidence', 'Content, structure, and source material that help AI extract and cite you.', [
      snapshot.headings.length >= 3,
      checks.hasDocsEvidence,
      checks.hasStructuredData,
      checks.hasCaseStudies,
    ], [
      snapshot.headings.length >= 3 ? `${snapshot.headings.length} useful headings were found.` : 'Heading structure is thin.',
      checks.hasDocsEvidence ? 'Docs/help/developer evidence is discoverable.' : 'Docs or help content is not obvious from this page.',
      checks.hasStructuredData ? `Structured data found: ${unique(snapshot.jsonLdTypes).slice(0, 3).join(', ')}.` : 'No structured data was detected.',
      checks.hasCaseStudies ? 'Customer evidence is visible.' : 'Customer stories or testimonials are not visible.',
    ], [
      'Add FAQ or Product schema to the main product page.',
      'Publish one proof page with customer, use case, result, and product screenshots.',
    ]),
    category('trust', 'Pricing & Trust Signals', 'Pricing clarity, security, policies, and proof AI systems can use safely.', [
      checks.hasPricing,
      checks.hasTrust,
      checks.hasCaseStudies,
      checks.hasIntegrations,
    ], [
      checks.hasPricing ? 'Pricing or plan language is discoverable.' : 'Pricing is not clear from the scanned page.',
      checks.hasTrust ? 'Security, privacy, or trust links are present.' : 'Trust and policy pages are not prominent.',
      checks.hasCaseStudies ? 'Social proof is available.' : 'Social proof is light.',
      checks.hasIntegrations ? 'Integration language helps define fit.' : 'Integration signals are limited.',
    ], [
      'Expose pricing or a clear "starts at" anchor on the public site.',
      'Link security, privacy, terms, and status from the footer and sales pages.',
    ]),
    category('competitors', 'Competitor Mentions', 'Whether AI can place you in a buying shortlist against alternatives.', [
      checks.hasComparison,
      checks.hasFeatureLanguage,
      checks.hasAudienceLanguage,
      checks.hasIntegrations,
    ], [
      checks.hasComparison ? 'Comparison language is present.' : 'No comparison or alternative pages were found.',
      checks.hasFeatureLanguage ? 'Capabilities are specific enough for comparison.' : 'Capabilities need clearer nouns.',
      checks.hasAudienceLanguage ? 'Audience fit can support shortlist placement.' : 'Audience fit is not explicit.',
      checks.hasIntegrations ? 'Integrations help define adjacent categories.' : 'Integrations are not visible.',
    ], [
      'Create one honest comparison page for the most common alternative.',
      'Add "best for" and "not best for" language so AI can recommend accurately.',
    ]),
  ]

  const actionItems = categories.flatMap((item) =>
    item.recommendations.map((recommendation) => ({
      category: item.title,
      text: recommendation,
      impact: item.score < 55 ? 'High' : item.score < 72 ? 'Medium' : 'Low',
    })),
  )

  const totalScore = Math.round(categories.reduce((sum, item) => sum + item.score, 0) / categories.length)
  const scanDurationMs = Math.max(600, Math.round(performance.now() - startedAt))

  return {
    url: finalUrl,
    title: snapshot.title,
    description: snapshot.description || 'No meta description found.',
    generatedAt: new Date().toISOString(),
    scanDurationMs,
    pagesCrawled: 1,
    sourcesFound: snapshot.links.length,
    score: totalScore,
    status: statusFor(totalScore),
    categories,
    aiSummary: summaryFor(totalScore),
    aiActions: actionItems
      .sort((a, b) => impactRank(a.impact) - impactRank(b.impact))
      .slice(0, 6),
    benchmark: {
      industry: 60,
      topQuartile: 80,
    },
  }
}

function category(key, title, description, checkResults, evidence, recommendations) {
  const passed = checkResults.filter(Boolean).length
  const score = Math.round(36 + (passed / checkResults.length) * 56)

  return {
    key,
    title,
    description,
    score,
    status: statusFor(score),
    evidence,
    recommendations,
  }
}

async function enrichWithOpenAI(report, snapshot) {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini'

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content:
              'You are a concise B2B SaaS positioning auditor. Return valid JSON only with keys summary and actions. actions is an array of up to 4 short strings.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              score: report.score,
              categories: report.categories.map((item) => ({
                title: item.title,
                score: item.score,
                evidence: item.evidence,
              })),
              page: {
                title: snapshot.title,
                description: snapshot.description,
                headings: snapshot.headings.slice(0, 10),
                bodyExcerpt: snapshot.bodyText.slice(0, 3000),
              },
            }),
          },
        ],
      }),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const text = collectResponseText(data)
    const json = parseJsonObject(text)

    if (!json || typeof json.summary !== 'string' || !Array.isArray(json.actions)) {
      return null
    }

    return {
      summary: json.summary.slice(0, 360),
      actions: json.actions.filter((item) => typeof item === 'string').slice(0, 4),
    }
  } catch {
    return null
  }
}

function collectResponseText(data) {
  if (typeof data.output_text === 'string') {
    return data.output_text
  }

  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? '')
    .join('\n')
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : null
  }
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function hasAny(value, terms) {
  return terms.some((term) => value.includes(term))
}

function unique(values) {
  return [...new Set(values)]
}

function statusFor(score) {
  if (score >= 72) {
    return 'good'
  }

  if (score >= 55) {
    return 'fair'
  }

  return 'risk'
}

function summaryFor(score) {
  if (score >= 72) {
    return 'AI systems can understand the company, but sharper differentiation and more source evidence should increase recommendation confidence.'
  }

  if (score >= 55) {
    return 'The site has enough public context to be recognized, but key buyer signals are inconsistent or hard for AI systems to cite.'
  }

  return 'The site is likely to be summarized vaguely by AI systems because positioning, proof, pricing, or trust signals are missing.'
}

function impactRank(impact) {
  return { High: 0, Medium: 1, Low: 2 }[impact] ?? 3
}
