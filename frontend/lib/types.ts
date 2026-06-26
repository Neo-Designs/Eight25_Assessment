export interface ScrapedPageData {
  url: string;
  meta_title: string | null;
  meta_description: string | null;
  word_count: number;
  cta_count: number;
  headings: {
    h1_count: number;
    h2_count: number;
    h3_count: number;
    headings_list: Array<{ tag: string; text: string }>;
  };
  links: {
    total_links: number;
    internal_links: number;
    external_links: number;
    ratio_internal_external: number;
  };
  images: {
    total_images: number;
    images_with_alt: number;
    images_without_alt: number;
    alt_text_coverage_pct: number;
  };
}

export interface GroundingSource {
  metric_name: string;
  metric_value: string;
}

export interface AuditFinding {
  category: string;
  observation: string;
  impact: string;
  grounding: GroundingSource[];
}

export interface ActionableRecommendation {
  priority: number;
  title: string;
  details: string;
  expected_outcome: string;
  confidence_score: number;
  grounding: GroundingSource[];
}

export interface AIAuditOutput {
  overall_seo_health_score: number;
  summary: string;
  findings: AuditFinding[];
  recommendations: ActionableRecommendation[];
}

export interface HistoryItem {
  id: number;
  timestamp: string | null;
  url: string;
  seo_score: number | null;
}

export interface AuditResponse {
  scraped_data: ScrapedPageData;
  audit_output: AIAuditOutput;
  log_id: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type FetchState = 'idle' | 'loading' | 'error' | 'success';
