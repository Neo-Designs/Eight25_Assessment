from typing import Optional, Dict
from app.models.schemas import ScrapedPageData, AIAuditOutput
from app.ai_engine import AIEngine
import json

class AnalyzerService:
    def __init__(self):
        self.ai_engine = AIEngine()

    async def analyze(self, data: ScrapedPageData, weights: Optional[Dict[str, float]] = None) -> AIAuditOutput:
        """
        Orchestrates the AI analysis based on scraped data.
        Enforces strict schema and grounding constraints via the system prompt.
        """
        
        system_prompt = (
            "You are an Expert WebCrawler Analyst. Perform a strict, structured website audit.\n"
            "You MUST output exactly according to the provided JSON schema.\n"
            "You MUST categorize all findings exactly as one of: 'SEO structure', 'Messaging clarity', 'CTA usage', 'Content depth', 'UX/structural concerns'.\n"
            "You MUST provide between 3 and 5 actionable recommendations.\n"
            "For EVERY finding and recommendation, you MUST provide 'grounding' by explicitly referencing the provided metric names and values from the scraped data."
        )

        # We construct a JSON representation of the scraped data as the user prompt
        user_prompt_content = f"Please audit the following ScrapedPageData:\n{data.model_dump_json(indent=2)}"

        if weights:
            user_prompt_content += f"\n\n[USER CUSTOM WEIGHTING OPTIONS]\nWhen auditing, weigh findings according to these proportions: {json.dumps(weights)}. Ensure your overall health score calculation and recommendation prioritizations heavily emphasize categories with higher weights."

        # Pass it down to the engine which just handles the LLM API call
        # We need to adapt ai_engine.py to accept raw prompts instead of rendering templates.
        response = await self.ai_engine.run_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt_content,
            response_model=AIAuditOutput
        )

        return response, system_prompt, user_prompt_content
