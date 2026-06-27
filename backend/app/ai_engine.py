import json
from typing import Optional, Tuple

import instructor
import openai

from app.config import settings
from app.models.schemas import AIAuditOutput, ScrapedPageData
from app.prompt_registry import PromptRegistry


class AIEngine:
    """LLM gateway with structured output (Instructor) and conversational chat."""

    def __init__(self):
        self.prompt_registry = PromptRegistry()
        self.client = None
        self.provider = None
        self.model_name = None
        self._init_llm_client()

    def _init_llm_client(self):
        if settings.openai_api_key:
            openai_client = openai.OpenAI(api_key=settings.openai_api_key)
            self.client = instructor.from_openai(openai_client)
            self.provider = "openai"
            self.model_name = settings.openai_model_name
        elif settings.gemini_api_key:
            openai_client = openai.OpenAI(
                api_key=settings.gemini_api_key,
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            )
            self.client = instructor.from_openai(openai_client)
            self.provider = "gemini"
            self.model_name = settings.gemini_model_name
        else:
            raise RuntimeError(
                "Missing required GEMINI_API_KEY or OPENAI_API_KEY environment variable."
            )

    # Backward-compatible helpers used by tests
    @property
    def system_prompt_path(self):
        return str(self.prompt_registry.system_prompt_path)

    @system_prompt_path.setter
    def system_prompt_path(self, value):
        from pathlib import Path
        self.prompt_registry.system_prompt_path = Path(value)

    @property
    def user_prompt_path(self):
        return str(self.prompt_registry.user_prompt_path)

    @user_prompt_path.setter
    def user_prompt_path(self, value):
        from pathlib import Path
        self.prompt_registry.user_prompt_path = Path(value)

    def _load_prompts(self) -> Tuple[str, str]:
        return self.prompt_registry.load()

    def _render_user_prompt(self, template: str, data: ScrapedPageData) -> str:
        return self.prompt_registry.render_user_prompt(template, data)

    async def run_completion(self, system_prompt: str, user_prompt: str, response_model: type) -> AIAuditOutput:
        last_error: Optional[Exception] = None
        for attempt in range(settings.llm_max_retries + 1):
            try:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_model=response_model,
                )
                return response
            except Exception as e:
                last_error = e
                if attempt >= settings.llm_max_retries:
                    break
        raise RuntimeError(f"Error calling LLM provider {self.provider}: {last_error}")

    async def run_chat(self, scraped_data: dict, audit_output: dict, message: str, history: list) -> str:
        system_prompt, _ = self._load_prompts()
        system_chat_prompt = (
            f"{system_prompt}\n\n"
            "You are now in interactive Q&A mode. Ground every answer in the scraped metrics and audit results.\n"
            f"Scraped Data: {json.dumps(scraped_data)}\n"
            f"Audit Findings: {json.dumps(audit_output)}\n\n"
            "FORMATTING RULES:\n"
            "- Start with a 1-2 sentence direct answer.\n"
            "- Use bullet points for lists.\n"
            "- Keep responses under 200 words unless depth is required.\n"
            "- End with a short actionable takeaway when relevant.\n"
        )

        try:
            formatted_messages = [{"role": "system", "content": system_chat_prompt}]
            for msg in history:
                formatted_messages.append({"role": msg.role, "content": msg.content})
            formatted_messages.append({"role": "user", "content": message})

            raw_client = self.client.client if hasattr(self.client, "client") else self.client
            chat_completion = raw_client.chat.completions.create(
                model=self.model_name,
                messages=formatted_messages,
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            return f"Error communicating with assistant: {str(e)}"

    def health_info(self) -> dict:
        return {
            "provider": self.provider,
            "model": self.model_name,
            "max_retries": settings.llm_max_retries,
            "prompts_dir": str(settings.prompts_dir),
        }
