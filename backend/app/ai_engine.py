"""AI Engine — Groq-powered LLM gateway with structured output and quota recovery."""
import json
import os
import asyncio
from typing import Optional, Tuple

import instructor
import openai

from app.config import settings
from app.models.schemas import AIAuditOutput, ScrapedPageData
from app.prompt_registry import PromptRegistry


class QuotaExceededError(RuntimeError):
    """Raised when the Groq API returns a 429 rate-limit / quota error."""
    pass


class AIEngine:
    """LLM gateway using Groq with structured output (Instructor) and conversational chat."""

    def __init__(self, groq_api_key: str | None = None):
        self.prompt_registry = PromptRegistry()
        self.client = None
        self.provider = "groq"
        self.model_name = None
        self._init_llm_client(groq_api_key)

    def _init_llm_client(self, groq_api_key: str | None = None):
        key = groq_api_key or settings.groq_api_key
        if not key:
            raise RuntimeError(
                "Missing required GROQ_API_KEY environment variable."
            )
        openai_client = openai.OpenAI(
            api_key=key,
            base_url="https://api.groq.com/openai/v1",
        )
        self.client = instructor.from_openai(openai_client)
        self.model_name = settings.groq_model_name

    def reinitialize(self, groq_api_key: str):
        """Hot-reload a new Groq API key without restarting the server."""
        os.environ["GROQ_API_KEY"] = groq_api_key
        self._init_llm_client(groq_api_key)

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

    @staticmethod
    def _is_quota_error(exc: Exception) -> bool:
        """Detect a 429 / quota-exceeded error from the Groq API."""
        msg = str(exc).lower()
        return "429" in msg or "rate limit" in msg or "quota" in msg or "too many requests" in msg

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
                if self._is_quota_error(e):
                    raise QuotaExceededError("GROQ_QUOTA_EXCEEDED") from e
                if attempt >= settings.llm_max_retries:
                    break
                await asyncio.sleep(2 ** attempt)
        raise RuntimeError(f"Error calling Groq: {last_error}")

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
            if self._is_quota_error(e):
                raise QuotaExceededError("GROQ_QUOTA_EXCEEDED") from e
            return f"Error communicating with assistant: {str(e)}"

    def health_info(self) -> dict:
        return {
            "provider": self.provider,
            "model": self.model_name,
            "max_retries": settings.llm_max_retries,
            "prompts_dir": str(settings.prompts_dir),
        }
