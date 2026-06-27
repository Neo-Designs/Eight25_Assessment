"""AI-native audit pipeline — composable stages with full traceability."""
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

from sqlalchemy.orm import Session

from app.analyzer import AnalyzerService
from app.database import log_scan_history
from app.models.db_models import ScanHistory
from app.models.schemas import AIAuditOutput, ScrapedPageData
from app.scraper import PlaywrightScraper


@dataclass
class AuditPipelineResult:
    log_entry: ScanHistory
    scraped_data: ScrapedPageData
    audit_output: AIAuditOutput
    system_prompt: str
    user_prompt: str


class AuditPipeline:
    """
    Three-stage AI pipeline:
      1. Scrape  — deterministic Playwright extraction
      2. Analyze — structured LLM output via Instructor + Pydantic
      3. Persist — full prompt/response logging for auditability
    """

    def __init__(
        self,
        scraper: PlaywrightScraper | None = None,
        analyzer: AnalyzerService | None = None,
    ):
        self.scraper = scraper or PlaywrightScraper()
        self.analyzer = analyzer or AnalyzerService()

    async def run(
        self,
        db: Session,
        url: str,
        weights: Optional[Dict[str, float]] = None,
        user_id: Optional[int] = None,
    ) -> AuditPipelineResult:
        scraped_data = await self.scraper.scrape(url)
        audit_output, system_prompt, user_prompt = await self.analyzer.analyze(
            scraped_data, weights=weights
        )
        log_entry = log_scan_history(
            db,
            url=url,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            scraped_data_snapshot=scraped_data.model_dump_json(),
            audit_findings=audit_output.model_dump_json(),
            seo_score=audit_output.overall_seo_health_score,
            user_id=user_id,
        )
        return AuditPipelineResult(
            log_entry=log_entry,
            scraped_data=scraped_data,
            audit_output=audit_output,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
