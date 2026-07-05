import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bookmark,
  Check,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FileText,
  Globe2,
  LayoutDashboard,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { AuditCategory, AuditCategoryKey, AuditReport, AuditStatus } from './auditTypes'
import './App.css'

const seedReport: AuditReport = {
  url: 'https://acme.com',
  title: 'Acme SaaS Audits',
  description: 'AI search readiness monitoring for modern B2B teams.',
  generatedAt: new Date().toISOString(),
  scanDurationMs: 1880,
  pagesCrawled: 1,
  sourcesFound: 147,
  score: 74,
  status: 'good',
  aiSummary:
    'AI systems can understand your company, but strengthening differentiation, pricing clarity, and third-party proof should increase recommendation confidence.',
  aiActions: [
    { category: 'Positioning', text: 'Add a quotable one-sentence product definition above the fold.', impact: 'High' },
    { category: 'Pricing & Trust Signals', text: 'Expose starting price and trust links from the public navigation.', impact: 'High' },
    { category: 'Competitor Mentions', text: 'Publish one honest comparison page for your top alternative.', impact: 'Medium' },
    { category: 'AI-readable Evidence', text: 'Add Product or FAQ schema to the main product page.', impact: 'Medium' },
  ],
  benchmark: {
    industry: 60,
    topQuartile: 80,
  },
  categories: [
    {
      key: 'positioning',
      title: 'Positioning',
      description: "How clearly AI understands who you are, what you do, and who it's for.",
      score: 78,
      status: 'good',
      evidence: ['Clear category language is present.', 'Audience is visible near the product copy.', 'Outcome language could be sharper.'],
      recommendations: ['Rewrite first-screen copy as product category + audience + outcome.'],
    },
    {
      key: 'evidence',
      title: 'AI-readable Evidence',
      description: 'Content, structure, and source material that help AI extract and cite you.',
      score: 72,
      status: 'good',
      evidence: ['Docs and help content are discoverable.', 'Heading structure is readable.', 'Structured data is limited.'],
      recommendations: ['Add FAQ or Product schema to the main product page.'],
    },
    {
      key: 'trust',
      title: 'Pricing & Trust Signals',
      description: 'Pricing clarity, social proof, and trust elements AI looks for.',
      score: 63,
      status: 'fair',
      evidence: ['Trust links are present.', 'Pricing anchor is not clear.', 'Customer proof is light.'],
      recommendations: ['Expose pricing or a clear starts-at anchor on the public site.'],
    },
    {
      key: 'competitors',
      title: 'Competitor Mentions',
      description: 'How well you appear compared to alternatives.',
      score: 51,
      status: 'risk',
      evidence: ['No comparison pages were found.', 'Integrations help define the category.', 'Shortlist language is weak.'],
      recommendations: ['Create one honest comparison page for the most common alternative.'],
    },
  ],
}

const categoryIcons: Record<AuditCategoryKey, typeof Target> = {
  positioning: Target,
  evidence: FileText,
  trust: ShieldCheck,
  competitors: Users,
}

const categoryAccent: Record<AuditCategoryKey, string> = {
  positioning: 'green',
  evidence: 'blue',
  trust: 'amber',
  competitors: 'orange',
}

function App() {
  const [url, setUrl] = useState(seedReport.url)
  const [report, setReport] = useState<AuditReport>(seedReport)
  const [selectedCategory, setSelectedCategory] = useState<AuditCategoryKey>('positioning')
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const activeCategory =
    report.categories.find((category) => category.key === selectedCategory) ?? report.categories[0]
  const reportTime = useMemo(() => formatReportTime(report.generatedAt), [report.generatedAt])

  async function runAudit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setError('')
    setNotice('')
    setIsScanning(true)

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'Scan failed.')
      }

      setReport(data)
      setUrl(data.url)
      setSelectedCategory(data.categories[0]?.key ?? 'positioning')
      setNotice(data.aiPowered ? 'AI-enhanced report generated.' : 'Heuristic report generated. Add an OpenAI key for deeper language analysis.')
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Scan failed.')
    } finally {
      setIsScanning(false)
    }
  }

  async function handleUnlock() {
    const response = await fetch('/api/checkout-link')
    const { url: paymentLink } = (await response.json()) as { url: string | null }

    if (paymentLink) {
      window.location.assign(paymentLink)
      return
    }

    setNotice('Checkout is ready for a Stripe Payment Link. Add STRIPE_PAYMENT_LINK when you want live payments.')
  }

  function handleSaveReport() {
    setNotice('Limited report saved locally for this session.')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <a className="brand" href="#top" aria-label="AnswerReady home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span>AnswerReady</span>
        </a>

        <nav className="side-nav" aria-label="Primary">
          <SideNavItem icon={Search} label="New Audit" active />
          <SideNavItem icon={LayoutDashboard} label="Dashboard" />
          <SideNavItem icon={FileText} label="Audits" />
          <SideNavItem icon={Globe2} label="Monitored Sites" count="3" />
          <SideNavItem icon={Bell} label="Alerts" count="2" />
          <SideNavItem icon={Users} label="Team" />
        </nav>

        <section className="recent-audits" aria-labelledby="recent-audits-title">
          <h2 id="recent-audits-title">Recent Audits</h2>
          {['acme.com', 'getsynth.com', 'flowly.io', 'northbeam.io', 'Example Co.'].map((item, index) => (
            <button className={index === 0 ? 'recent-audit active' : 'recent-audit'} key={item} type="button">
              <span>{item}</span>
              <small>{index === 0 ? 'Just now' : `May ${13 - index * 2}`}</small>
            </button>
          ))}
        </section>

        <section className="plan-meter" aria-label="Current plan">
          <div>
            <span>Plan</span>
            <strong>Pro</strong>
          </div>
          <button type="button">Manage</button>
          <p>Credits reset in 18 days</p>
          <div className="meter" aria-label="8 of 25 credits used">
            <span style={{ width: '32%' }} />
          </div>
          <small>8 / 25</small>
        </section>
      </aside>

      <main className="workspace" id="top">
        <header className="topbar">
          <div>
            <span>Workspace</span>
            <strong>Acme SaaS Audits</strong>
          </div>
          <nav aria-label="Account">
            <button type="button">
              <BarChart3 size={17} />
              Usage
            </button>
            <button type="button">
              <FileText size={17} />
              Reports
            </button>
            <button type="button">
              <CreditCard size={17} />
              Billing
            </button>
            <button className="icon-button" type="button" aria-label="Help">
              <CircleHelp size={19} />
            </button>
            <button className="avatar" type="button" aria-label="Account menu">
              JS
            </button>
          </nav>
        </header>

        <div className="content-grid">
          <section className="primary-column" aria-label="Audit workspace">
            <section className="scan-panel" aria-labelledby="scan-title">
              <form onSubmit={runAudit}>
                <label htmlFor="audit-url" id="scan-title">
                  Audit a website
                </label>
                <div className="url-row">
                  <div className="url-field">
                    <Globe2 size={22} aria-hidden="true" />
                    <input
                      id="audit-url"
                      inputMode="url"
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      placeholder="https://acme.com"
                    />
                  </div>
                  <button className="primary-button" type="submit" disabled={isScanning}>
                    {isScanning ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
                    {isScanning ? 'Scanning' : 'Scan website'}
                  </button>
                </div>
              </form>

              <div className="scan-meta">
                <span className="success-dot">
                  <Check size={16} />
                </span>
                <strong>{isScanning ? 'Scan running' : 'Scan complete'}</strong>
                <span>{reportTime}</span>
                <span>{report.pagesCrawled} page crawled</span>
                <span>{Math.max(1, Math.round(report.scanDurationMs / 1000))}s</span>
                <div className="scan-actions">
                  <button type="button" onClick={() => void runAudit()}>
                    <RefreshCw size={17} />
                    Re-scan
                  </button>
                  <button type="button" onClick={handleSaveReport}>
                    <Send size={17} />
                    Share
                  </button>
                </div>
              </div>

              {error ? (
                <p className="message error">
                  <AlertTriangle size={17} />
                  {error}
                </p>
              ) : null}
              {notice ? <p className="message">{notice}</p> : null}
            </section>

            <div className="tabs" role="tablist" aria-label="Report sections">
              {report.categories.map((category) => (
                <button
                  aria-selected={selectedCategory === category.key}
                  className={selectedCategory === category.key ? 'active' : ''}
                  key={category.key}
                  onClick={() => setSelectedCategory(category.key)}
                  role="tab"
                  type="button"
                >
                  {shortCategoryTitle(category.title)}
                </button>
              ))}
              <button type="button">Sources ({report.sourcesFound})</button>
            </div>

            <section className="score-panel" aria-label="AI Search Readiness Score">
              <div className="score-card">
                <ScoreRing score={report.score} status={report.status} />
                <div>
                  <h1>AI Search Readiness Score</h1>
                  <p>{report.aiSummary}</p>
                </div>
              </div>

              <div className="metric-strip">
                {report.categories.map((category) => (
                  <MetricBlock category={category} key={category.key} />
                ))}
              </div>
            </section>

            <section className="category-list" aria-label="Report categories">
              {report.categories.map((category) => (
                <CategoryRow
                  category={category}
                  key={category.key}
                  onSelect={() => setSelectedCategory(category.key)}
                  selected={selectedCategory === category.key}
                />
              ))}
            </section>

            <section className="detail-panel" aria-labelledby="detail-heading">
              <div className="detail-heading">
                <div>
                  <span className={`category-icon ${categoryAccent[activeCategory.key]}`}>
                    {renderCategoryIcon(activeCategory)}
                  </span>
                  <div>
                    <h2 id="detail-heading">{activeCategory.title}</h2>
                    <p>{activeCategory.description}</p>
                  </div>
                </div>
                <StatusBadge status={activeCategory.status} />
              </div>

              <div className="detail-grid">
                <ReportList title="Evidence" items={activeCategory.evidence} />
                <ReportList title="Recommended Fixes" items={activeCategory.recommendations} />
              </div>
            </section>
          </section>

          <aside className="insight-column" aria-label="Score and billing">
            <section className="insight-panel">
              <div className="panel-heading">
                <h2>Score Summary</h2>
                <CircleHelp size={16} />
              </div>
              <div className={`big-score ${report.status}`}>
                {report.score}
                <span>/100</span>
              </div>
              <StatusText status={report.status} />
              <dl className="benchmarks">
                <div>
                  <dt>Industry benchmark</dt>
                  <dd>{report.benchmark.industry}</dd>
                </div>
                <div>
                  <dt>Top quartile</dt>
                  <dd>{report.benchmark.topQuartile}+</dd>
                </div>
              </dl>
              <div className="summary-copy">
                <strong>What this means</strong>
                <p>{report.aiSummary}</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setSelectedCategory('positioning')}>
                <BarChart3 size={17} />
                View scoring details
              </button>
            </section>

            <section className="unlock-panel">
              <div className="unlock-heading">
                <Lock size={18} />
                <h2>Unlock full report</h2>
              </div>
              <p>Get the complete breakdown, evidence examples, and prioritized actions.</p>

              <div className="plan-option selected">
                <span className="radio-dot" />
                <div>
                  <strong>One-time audit</strong>
                  <small>Full report + PDF export</small>
                </div>
                <b>$49</b>
              </div>
              <div className="plan-option">
                <span className="radio-dot" />
                <div>
                  <strong>
                    Monitoring <em>Recommended</em>
                  </strong>
                  <small>Weekly rescans + alerts</small>
                </div>
                <b>$29/mo</b>
              </div>

              <button className="primary-button full-width" type="button" onClick={() => void handleUnlock()}>
                <Lock size={17} />
                Unlock full report
              </button>
              <small className="secure-copy">Secure checkout. Cancel anytime.</small>
              <button className="save-button" type="button" onClick={handleSaveReport}>
                <Bookmark size={17} />
                Save report
              </button>
            </section>

            <section className="action-panel">
              <div className="panel-heading">
                <h2>Action Plan</h2>
                <Sparkles size={16} />
              </div>
              <ol>
                {report.aiActions.slice(0, 4).map((item, index) => {
                  const actionText = typeof item === 'string' ? item : item.text
                  const actionImpact = typeof item === 'string' ? 'Medium' : item.impact

                  return (
                    <li key={`${actionText}-${index}`}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{actionImpact} impact</strong>
                        <p>{actionText}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}

function SideNavItem({
  active = false,
  count,
  icon: Icon,
  label,
}: {
  active?: boolean
  count?: string
  icon: typeof Search
  label: string
}) {
  return (
    <a className={active ? 'side-nav-item active' : 'side-nav-item'} href="#top">
      <Icon size={18} />
      <span>{label}</span>
      {count ? <small>{count}</small> : null}
    </a>
  )
}

function ScoreRing({ score, status }: { score: number; status: AuditStatus }) {
  const angle = Math.min(100, Math.max(0, score)) * 3.6

  return (
    <div
      className={`score-ring ${status}`}
      style={{
        background: `conic-gradient(var(--status-color) ${angle}deg, #e8eef2 ${angle}deg)`,
      }}
    >
      <div>
        <strong>{score}</strong>
        <span>/100</span>
      </div>
    </div>
  )
}

function MetricBlock({ category }: { category: AuditCategory }) {
  return (
    <button className="metric-block" type="button">
      <span>{category.title}</span>
      <strong>
        {category.score}
        <small>/100</small>
      </strong>
      <StatusText status={category.status} />
      <div className="metric-bar" aria-hidden="true">
        <span style={{ width: `${category.score}%` }} />
      </div>
    </button>
  )
}

function CategoryRow({
  category,
  onSelect,
  selected,
}: {
  category: AuditCategory
  onSelect: () => void
  selected: boolean
}) {
  return (
    <button className={selected ? 'category-row selected' : 'category-row'} onClick={onSelect} type="button">
      <span className={`category-icon ${categoryAccent[category.key]}`}>{renderCategoryIcon(category)}</span>
      <span className="category-copy">
        <strong>{category.title}</strong>
        <small>{category.description}</small>
      </span>
      <StatusBadge status={category.status} />
      <ChevronRight size={20} />
    </button>
  )
}

function ReportList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="report-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <Check size={16} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatusBadge({ status }: { status: AuditStatus }) {
  return <span className={`status-badge ${status}`}>{statusLabel(status)}</span>
}

function StatusText({ status }: { status: AuditStatus }) {
  return <span className={`status-text ${status}`}>{statusLabel(status)}</span>
}

function renderCategoryIcon(category: AuditCategory) {
  const Icon = categoryIcons[category.key]
  return <Icon size={20} />
}

function statusLabel(status: AuditStatus) {
  return {
    good: 'Good',
    fair: 'Fair',
    risk: 'At Risk',
  }[status]
}

function shortCategoryTitle(title: string) {
  return title.replace('AI-readable ', '').replace(' Signals', '')
}

function formatReportTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default App
