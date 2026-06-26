import logging
import os
import re
import json
from typing import Optional, Dict, Tuple
from dotenv import load_dotenv
import google.generativeai as genai
import openai
import instructor
from app.models.schemas import ScrapedPageData, AIAuditOutput

logger = logging.getLogger("audit_tool")

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
            raise RuntimeError("Strict Mode: Missing required GEMINI_API_KEY or OPENAI_API_KEY environment variable for production.")

    def _load_prompts(self) -> Tuple[str, str]:
        # Read system prompt
        if os.path.exists(self.system_prompt_path):
            with open(self.system_prompt_path, "r", encoding="utf-8") as f:
                system_prompt = f.read()
        else:
            logger.warning(f"System prompt file not found at {self.system_prompt_path}, using built-in default")
            system_prompt = "You are an Expert SEO Strategist. Perform a website audit."

        # Read user prompt template
        if os.path.exists(self.user_prompt_path):
            with open(self.user_prompt_path, "r", encoding="utf-8") as f:
                user_prompt_template = f.read()
        else:
            logger.warning(f"User prompt template not found at {self.user_prompt_path}, using built-in default")
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

    async def run_completion(self, system_prompt: str, user_prompt: str, response_model: type) -> AIAuditOutput:
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_model=response_model,
            )
            return response
        except Exception as e:
            raise RuntimeError(f"Error calling LLM provider {self.provider}: {str(e)}")

    async def run_chat(self, scraped_data: dict, audit_output: dict, message: str, history: list) -> str:
        # Load system persona prompt
        system_prompt, _ = self._load_prompts()
        system_chat_prompt = (
            f"{system_prompt}\n\n"
            f"You are now in interactive Q&A mode. The user will ask questions to explain findings and recommendations further.\n"
            f"Ground your explanations in the following scraped metrics and audit results:\n"
            f"Scraped Data: {json.dumps(scraped_data)}\n"
            f"Audit Findings: {json.dumps(audit_output)}\n\n"
            f"FORMATTING RULES — follow these strictly:\n"
            f"- NEVER write long paragraphs or walls of text. Break everything into clear, scannable sections.\n"
            f"- Always start with a short 1-2 sentence direct answer to the question.\n"
            f"- Use bullet points (- item) for lists of issues, steps, or recommendations.\n"
            f"- Use **bold** only for key terms or metric names.\n"
            f"- Use ### headers only when the answer has multiple distinct sections.\n"
            f"- Keep your total response under 200 words unless the question truly requires depth.\n"
            f"- Use plain, professional English. Avoid jargon or overly technical language.\n"
            f"- End with a short actionable takeaway if relevant.\n"
        )

        # Construct messages array
        formatted_messages = [{"role": "system", "content": system_chat_prompt}]
        for msg in history:
            formatted_messages.append({"role": msg.role, "content": msg.content})
        formatted_messages.append({"role": "user", "content": message})

        # Use standard non-instructor client completions for free-form text chat
        # Retrieve the underlying un-wrapped client or call completions directly
        raw_client = self.client.client if hasattr(self.client, 'client') else self.client
        try:
            chat_completion = raw_client.chat.completions.create(
                model=self.model_name,
                messages=formatted_messages
            )
        except Exception as e:
            raise RuntimeError(f"Chat completion failed ({self.provider}): {e}")

        reply = chat_completion.choices[0].message.content
        if reply is None:
            raise RuntimeError("LLM returned an empty response for chat")
        return reply

