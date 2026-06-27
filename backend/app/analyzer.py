import json
from typing import Dict, Optional, Tuple

from app.ai_engine import AIEngine
from app.models.schemas import AIAuditOutput, ScrapedPageData
from app.prompt_registry import PromptRegistry


class AnalyzerService:
    """Orchestrates structured AI analysis using file-backed prompts and schema validation."""

    def __init__(self):
        self.ai_engine = AIEngine()
        self.prompt_registry = PromptRegistry()

    async def analyze(
        self, data: ScrapedPageData, weights: Optional[Dict[str, float]] = None
    ) -> Tuple[AIAuditOutput, str, str]:
        system_prompt, user_prompt = self.prompt_registry.build_audit_prompts(data, weights)
        response = await self.ai_engine.run_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_model=AIAuditOutput,
        )
        return response, system_prompt, user_prompt
