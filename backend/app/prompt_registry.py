"""Prompt registry — versioned, file-backed prompts for AI-native auditability."""
from pathlib import Path
from typing import Tuple

from app.config import settings
from app.models.schemas import ScrapedPageData


class PromptRegistry:
    """Loads and renders audit prompts from the prompts/ directory."""

    def __init__(self, prompts_dir: Path | None = None):
        self.prompts_dir = prompts_dir or settings.prompts_dir
        self.system_prompt_path = self.prompts_dir / "system_prompt.txt"
        self.user_prompt_path = self.prompts_dir / "user_prompt_template.txt"

    def load(self) -> Tuple[str, str]:
        system_prompt = self._read(self.system_prompt_path, self._fallback_system())
        user_template = self._read(self.user_prompt_path, self._fallback_user())
        return system_prompt, user_template

    def render_user_prompt(self, template: str, data: ScrapedPageData) -> str:
        rendered = template
        rendered = rendered.replace("{{ url }}", str(data.url))
        rendered = rendered.replace("{{ meta_title }}", str(data.meta_title or "N/A"))
        rendered = rendered.replace("{{ meta_description }}", str(data.meta_description or "N/A"))
        rendered = rendered.replace("{{ word_count }}", str(data.word_count))
        rendered = rendered.replace("{{ cta_count }}", str(data.cta_count))

        rendered = rendered.replace("{{ headings.h1_count }}", str(data.headings.h1_count))
        rendered = rendered.replace("{{ headings.h2_count }}", str(data.headings.h2_count))
        rendered = rendered.replace("{{ headings.h3_count }}", str(data.headings.h3_count))

        headings_str = ""
        for h in data.headings.headings_list:
            headings_str += f"- [{h['tag'].upper()}] {h['text']}\n"
        for pattern in (
            "{% for h in headings.headings_list %}\n- [{{ h.tag }}] {{ h.text }}\n{% endfor %}",
            "{% for h in headings.headings_list %}- [{{ h.tag }}] {{ h.text }}\n{% endfor %}",
        ):
            rendered = rendered.replace(pattern, headings_str)

        rendered = rendered.replace("{{ links.total_links }}", str(data.links.total_links))
        rendered = rendered.replace("{{ links.internal_links }}", str(data.links.internal_links))
        rendered = rendered.replace("{{ links.external_links }}", str(data.links.external_links))
        rendered = rendered.replace("{{ links.ratio_internal_external }}", str(data.links.ratio_internal_external))

        rendered = rendered.replace("{{ images.total_images }}", str(data.images.total_images))
        rendered = rendered.replace("{{ images.images_with_alt }}", str(data.images.images_with_alt))
        rendered = rendered.replace("{{ images.images_without_alt }}", str(data.images.images_without_alt))
        rendered = rendered.replace("{{ images.alt_text_coverage_pct }}", str(data.images.alt_text_coverage_pct))

        return rendered

    def build_audit_prompts(
        self, data: ScrapedPageData, weights: dict | None = None
    ) -> Tuple[str, str]:
        system_prompt, user_template = self.load()
        schema_guard = (
            "\n\n[OUTPUT CONTRACT]\n"
            "You MUST output exactly according to the AIAuditOutput JSON schema.\n"
            "Findings MUST use one of: 'SEO structure', 'Messaging clarity', 'CTA usage', "
            "'Content depth', 'UX/structural concerns'.\n"
            "Provide between 3 and 5 actionable recommendations.\n"
            "Every finding and recommendation MUST include grounding tied to scraped metrics."
        )
        system_prompt = system_prompt + schema_guard

        user_prompt = self.render_user_prompt(user_template, data)
        if weights:
            import json
            user_prompt += (
                f"\n\n[USER CUSTOM WEIGHTING]\n"
                f"Prioritize categories according to these proportions: {json.dumps(weights)}"
            )
        return system_prompt, user_prompt

    @staticmethod
    def _read(path: Path, fallback: str) -> str:
        if path.exists():
            return path.read_text(encoding="utf-8")
        return fallback

    @staticmethod
    def _fallback_system() -> str:
        return "You are an Expert SEO Strategist. Perform a structured website audit."

    @staticmethod
    def _fallback_user() -> str:
        return "Audit this URL: {{ url }}"
