import os
import re
import json
from typing import Tuple
from dotenv import load_dotenv
import google.generativeai as genai
import openai
import instructor
from app.models.schemas import ScrapedPageData, AIAuditOutput

# Load environment variables from backend root directory
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backend", ".env")
load_dotenv(dotenv_path=dotenv_path)

class AIEngine:
    def __init__(self):
        self.system_prompt_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "prompts", "system_prompt.txt"
        )
        self.user_prompt_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "prompts", "user_prompt_template.txt"
        )
        
        self.client = None
        self.provider = None
        self.model_name = None
        
        self._init_llm_client()

    def _init_llm_client(self):
        gemini_api_key = os.environ.get("GEMINI_API_KEY")
        openai_api_key = os.environ.get("OPENAI_API_KEY")
        
        if gemini_api_key:
            # Configure Gemini via OpenAI compatibility endpoint (extremely robust for Instructor)
            openai_client = openai.OpenAI(
                api_key=gemini_api_key,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
            )
            self.client = instructor.from_openai(openai_client)
            self.provider = "gemini"
            self.model_name = "models/gemini-3.1-flash-lite"
        elif openai_api_key:
            # Configure OpenAI
            openai_client = openai.OpenAI(api_key=openai_api_key)
            self.client = instructor.from_openai(openai_client)
            self.provider = "openai"
            self.model_name = os.environ.get("OPENAI_MODEL_NAME", "gpt-4o-mini")
        else:
            # Fallback mock/dummy mode if no API key is present, to prevent startup failure
            self.client = None
            self.provider = "mock"
            self.model_name = "mock-model"

    def _load_prompts(self) -> Tuple[str, str]:
        # Read system prompt
        if os.path.exists(self.system_prompt_path):
            with open(self.system_prompt_path, "r", encoding="utf-8") as f:
                system_prompt = f.read()
        else:
            system_prompt = "You are an Expert SEO Strategist. Perform a website audit."

        # Read user prompt template
        if os.path.exists(self.user_prompt_path):
            with open(self.user_prompt_path, "r", encoding="utf-8") as f:
                user_prompt_template = f.read()
        else:
            user_prompt_template = "Audit this URL: {{ url }}"
            
        return system_prompt, user_prompt_template

    def _render_user_prompt(self, template: str, data: ScrapedPageData) -> str:
        # Simple placeholder replacement to avoid template engine complexity
        rendered = template
        rendered = rendered.replace("{{ url }}", str(data.url))
        rendered = rendered.replace("{{ meta_title }}", str(data.meta_title or "N/A"))
        rendered = rendered.replace("{{ meta_description }}", str(data.meta_description or "N/A"))
        rendered = rendered.replace("{{ word_count }}", str(data.word_count))
        rendered = rendered.replace("{{ cta_count }}", str(data.cta_count))
        
        rendered = rendered.replace("{{ headings.h1_count }}", str(data.headings.h1_count))
        rendered = rendered.replace("{{ headings.h2_count }}", str(data.headings.h2_count))
        rendered = rendered.replace("{{ headings.h3_count }}", str(data.headings.h3_count))
        
        # Build headings list string
        headings_str = ""
        for h in data.headings.headings_list:
            headings_str += f"- [{h['tag'].upper()}] {h['text']}\n"
        rendered = rendered.replace("{% for h in headings.headings_list %}\n- [{{ h.tag }}] {{ h.text }}\n{% endfor %}", headings_str)
        rendered = rendered.replace("{% for h in headings.headings_list %}- [{{ h.tag }}] {{ h.text }}\n{% endfor %}", headings_str)
        
        rendered = rendered.replace("{{ links.total_links }}", str(data.links.total_links))
        rendered = rendered.replace("{{ links.internal_links }}", str(data.links.internal_links))
        rendered = rendered.replace("{{ links.external_links }}", str(data.links.external_links))
        rendered = rendered.replace("{{ links.ratio_internal_external }}", str(data.links.ratio_internal_external))
        
        rendered = rendered.replace("{{ images.total_images }}", str(data.images.total_images))
        rendered = rendered.replace("{{ images.images_with_alt }}", str(data.images.images_with_alt))
        rendered = rendered.replace("{{ images.images_without_alt }}", str(data.images.images_without_alt))
        rendered = rendered.replace("{{ images.alt_text_coverage_pct }}", str(data.images.alt_text_coverage_pct))
        
        return rendered

    async def run_audit(self, data: ScrapedPageData) -> Tuple[AIAuditOutput, str, str]:
        system_prompt, user_prompt_template = self._load_prompts()
        user_prompt = self._render_user_prompt(user_prompt_template, data)
        
        if self.provider == "mock":
            # Return high-quality mock data when keys are missing so the tool remains interactive
            mock_output = AIAuditOutput(
                overall_seo_health_score=78,
                summary="The page is technically sound but has critical gaps in image optimization and heading structure.",
                findings=[
                    {
                        "category": "Accessibility",
                        "observation": f"Out of {data.images.total_images} images, {data.images.images_without_alt} are missing alt-text descriptions.",
                        "impact": "Reduces screen reader accessibility and image SEO indexing.",
                        "grounding": [
                            {"metric_name": "images_without_alt", "metric_value": str(data.images.images_without_alt)},
                            {"metric_name": "alt_text_coverage_pct", "metric_value": f"{data.images.alt_text_coverage_pct}%"}
                        ]
                    },
                    {
                        "category": "SEO",
                        "observation": f"The page has {data.headings.h1_count} H1 headings.",
                        "impact": "Search engines prioritize a single H1 to understand page hierarchy.",
                        "grounding": [
                            {"metric_name": "h1_count", "metric_value": str(data.headings.h1_count)}
                        ]
                    }
                ],
                recommendations=[
                    {
                        "priority": 1,
                        "title": "Add Descriptive Alt-Text to Images",
                        "details": "Update all image tags missing description. Focus on context rather than keyword stuffing.",
                        "expected_outcome": "Reach 100% alt-text coverage, enhancing screen reader support and image search placement.",
                        "confidence_score": 0.95,
                        "grounding": [
                            {"metric_name": "alt_text_coverage_pct", "metric_value": f"{data.images.alt_text_coverage_pct}%"}
                        ]
                    }
                ]
            )
            return mock_output, system_prompt, user_prompt

        try:
            # Both OpenAI and Gemini (via compatibility URL) use the standard completions endpoint
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_model=AIAuditOutput,
            )
            return response, system_prompt, user_prompt
        except Exception as e:
            # If API call fails, raise or fallback
            raise RuntimeError(f"Error calling LLM provider {self.provider}: {str(e)}")
