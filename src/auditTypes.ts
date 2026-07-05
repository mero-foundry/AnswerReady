export type AuditStatus = 'good' | 'fair' | 'risk'

export type AuditCategoryKey = 'positioning' | 'evidence' | 'trust' | 'competitors'

export type AuditCategory = {
  key: AuditCategoryKey
  title: string
  description: string
  score: number
  status: AuditStatus
  evidence: string[]
  recommendations: string[]
}

export type AuditAction = {
  category: string
  text: string
  impact: 'High' | 'Medium' | 'Low'
}

export type AuditReport = {
  url: string
  title: string
  description: string
  generatedAt: string
  scanDurationMs: number
  pagesCrawled: number
  sourcesFound: number
  score: number
  status: AuditStatus
  categories: AuditCategory[]
  aiSummary: string
  aiActions: AuditAction[] | string[]
  aiPowered?: boolean
  benchmark: {
    industry: number
    topQuartile: number
  }
}
