"""AI Engine — Groq-powered LLM gateway with structured JSON output and quota recovery."""
import asyncio
import json
import os
from typing import Optional, Tuple

import openai

from app.config import settings
from app.models.schemas import AIAuditOutput, ScrapedPageData
from app.prompt_registry import PromptRegistry


class QuotaExceededError(RuntimeError):
    """Raised when the Groq API returns a 429 rate-limit / quota error."""
    pass


class AIEngine:
    """LLM gateway using Groq with Pydantic-validated JSON output and conversational chat."""

    def __init__(self, groq_api_key: str | None = None):
        self.prompt_registry = PromptRegistry()
        self.client: openai.OpenAI | None = None
        self.provider = "groq"
        self.model_name: str | None = None
        self._init_llm_client(groq_api_key)

    def _init_llm_client(self, groq_api_key: str | None = None):
        key = groq_api_key or settings.groq_api_key
        if not key:
            raise RuntimeError(
                "Missing required GROQ_API_KEY environment variable."
            )
        self.client = openai.OpenAI(
            api_key=key,
            base_url="https://api.groq.com/openai/v1",
        )
        self.model_name = settings.groq_model_name

    def reinitialize(self, groq_api_key: str):
        """Hot-reload a new Groq API key without restarting the server."""
        os.environ["GROQ_API_KEY"] = groq_api_key
        self._init_llm_client(groq_api_key)

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
        msg = str(exc).lower()
        return (
            "429" in msg
            or "rate limit" in msg
            or "quota" in msg
            or "too many requests" in msg
        )

    @staticmethod
    def _parse_json_content(content: str) -> dict:
        text = (content or "").strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = lines[1:] if lines else lines
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        return json.loads(text)

    @staticmethod
    def _schema_instruction(response_model: type) -> str:
        schema = response_model.model_json_schema()
        return (
            "\n\n[JSON OUTPUT]\n"
            "Respond with a single valid JSON object (no markdown fences) matching this schema:\n"
            f"{json.dumps(schema, indent=2)}"
        )

    async def run_completion(
        self, system_prompt: str, user_prompt: str, response_model: type
    ) -> AIAuditOutput:
        if self.client is None:
            raise RuntimeError("AI client is not initialized")

        schema_hint = self._schema_instruction(response_model)
        last_error: Optional[Exception] = None

        for attempt in range(settings.llm_max_retries + 1):
            try:
                def _call():
                    return self.client.chat.completions.create(
                        model=self.model_name,
                        messages=[
                            {"role": "system", "content": system_prompt + schema_hint},
                            {"role": "user", "content": user_prompt},
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.2,
                    )

                completion = await asyncio.to_thread(_call)
                content = completion.choices[0].message.content or "{}"
                data = self._parse_json_content(content)
                return response_model.model_validate(data)
            except Exception as e:
                last_error = e
                if self._is_quota_error(e):
                    raise QuotaExceededError("GROQ_QUOTA_EXCEEDED") from e
                if attempt >= settings.llm_max_retries:
                    break
                await asyncio.sleep(2 ** attempt)

        raise RuntimeError(f"Error calling Groq: {last_error}")

    async def run_chat(
        self, scraped_data: dict, audit_output: dict, message: str, history: list
    ) -> str:
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

        if self.client is None:
            raise RuntimeError("AI client is not initialized")

        try:
            formatted_messages = [{"role": "system", "content": system_chat_prompt}]
            for msg in history:
                formatted_messages.append({"role": msg.role, "content": msg.content})
            formatted_messages.append({"role": "user", "content": message})

            def _call():
                return self.client.chat.completions.create(
                    model=self.model_name,
                    messages=formatted_messages,
                    temperature=0.3,
                )

            chat_completion = await asyncio.to_thread(_call)
            return chat_completion.choices[0].message.content or ""
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
