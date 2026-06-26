from typing import List, Dict, Optional
from pydantic import BaseModel, Field, HttpUrl

class LinkMetrics(BaseModel):
    total_links: int = Field(..., description="Total number of links found on the page")
    internal_links: int = Field(..., description="Number of links pointing to the same domain")
    external_links: int = Field(..., description="Number of links pointing to different domains")
    ratio_internal_external: float = Field(..., description="The ratio of internal links to external links")

class ImageMetrics(BaseModel):
    total_images: int = Field(..., description="Total number of images found on the page")
    images_with_alt: int = Field(..., description="Number of images with non-empty 'alt' attributes")
    images_without_alt: int = Field(..., description="Number of images missing 'alt' attributes")
    alt_text_coverage_pct: float = Field(..., description="Percentage of images that have alt text")

class HeadingMetrics(BaseModel):
    h1_count: int = Field(..., description="Number of H1 headings")
    h2_count: int = Field(..., description="Number of H2 headings")
    h3_count: int = Field(..., description="Number of H3 headings")
    headings_list: List[Dict[str, str]] = Field(
        ..., 
        description="List of headings with tag and text, e.g. [{'tag': 'h1', 'text': '...'}]"
    )

class ScrapedPageData(BaseModel):
    url: str = Field(..., description="The URL of the scraped webpage")
    meta_title: Optional[str] = Field(None, description="The content of the <title> tag")
    meta_description: Optional[str] = Field(None, description="The content of the meta description tag")
    word_count: int = Field(..., description="Total word count of the main body text")
    cta_count: int = Field(..., description="Number of Call-To-Action elements (buttons/links with high-intent text or class names)")
    headings: HeadingMetrics = Field(..., description="Heading hierarchy and counts")
    links: LinkMetrics = Field(..., description="Link counts and ratio analysis")
    images: ImageMetrics = Field(..., description="Image alt text coverage and counts")

class GroundingSource(BaseModel):
    metric_name: str = Field(..., description="The specific scraper metric referenced (e.g., 'alt_text_coverage_pct', 'h1_count')")
    metric_value: str = Field(..., description="The value of the scraper metric observed in the page data")

class AuditFinding(BaseModel):
    category: str = Field(..., description="SEO, Performance, Content Quality, Link Architecture, or Accessibility")
    observation: str = Field(..., description="Factual description of what was observed on the page")
    impact: str = Field(..., description="SEO or conversion rate optimization (CRO) impact of this finding")
    grounding: List[GroundingSource] = Field(
        ..., 
        description="List of specific scraped metrics that prove or support this finding"
    )

class ActionableRecommendation(BaseModel):
    priority: int = Field(..., ge=1, le=5, description="Priority level from 1 (critical) to 5 (low priority)")
    title: str = Field(..., description="Short, action-oriented title for the recommendation")
    details: str = Field(..., description="Detailed markdown explanation of the steps required to implement the fix")
    expected_outcome: str = Field(..., description="What success looks like after implementing this recommendation")
    confidence_score: float = Field(
        ..., 
        ge=0.0, 
        le=1.0, 
        description="Confidence score (0.0 to 1.0) based on factual scraper data quality"
    )
    grounding: List[GroundingSource] = Field(
        ...,
        description="Explicit references to scraped data metrics that justify this recommendation"
    )

class AIAuditOutput(BaseModel):
    overall_seo_health_score: int = Field(..., ge=0, le=100, description="Overall SEO health score out of 100 based on metrics")
    summary: str = Field(..., description="High-level markdown summary of the audit's findings and strategic direction")
    findings: List[AuditFinding] = Field(..., description="Detailed pass-1 audit findings grouped by category")
    recommendations: List[ActionableRecommendation] = Field(..., description="Pass-2 prioritized and actionable recommendations")
