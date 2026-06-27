"""Unit tests for app/ai_engine.py — Groq-only engine."""
import os
import pytest
from unittest.mock import patch, MagicMock

from app.models.schemas import ScrapedPageData, HeadingMetrics, LinkMetrics, ImageMetrics
from app.ai_engine import AIEngine, QuotaExceededError


@pytest.fixture
def sample_scraped_data():
    """Create sample ScrapedPageData for testing prompt rendering."""
    return ScrapedPageData(
        url="https://example.com",
        meta_title="Example Site - Home",
        meta_description="This is an example website description.",
        word_count=1500,
        cta_count=5,
        headings=HeadingMetrics(
            h1_count=1,
            h2_count=3,
            h3_count=5,
            headings_list=[
                {"tag": "h1", "text": "Welcome to Example"},
                {"tag": "h2", "text": "Our Services"},
                {"tag": "h2", "text": "About Us"},
                {"tag": "h2", "text": "Contact"},
                {"tag": "h3", "text": "Web Design"},
            ]
        ),
        links=LinkMetrics(
            total_links=25,
            internal_links=18,
            external_links=7,
            ratio_internal_external=2.57
        ),
        images=ImageMetrics(
            total_images=10,
            images_with_alt=8,
            images_without_alt=2,
            alt_text_coverage_pct=80.0
        )
    )


class TestAIEngineInit:
    """Tests for AIEngine initialization."""

    @patch("app.ai_engine.openai.OpenAI")
    def test_groq_provider_selected(self, mock_openai):
        with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_test-key"}, clear=False):
            engine = AIEngine()
            assert engine.provider == "groq"
            assert engine.client is not None
            mock_openai.assert_called_once()

    def test_no_api_key_raises_runtime_error(self):
        with patch.dict(os.environ, {"GROQ_API_KEY": ""}, clear=True):
            with pytest.raises(RuntimeError, match="Missing required"):
                AIEngine()

    @patch("app.ai_engine.openai.OpenAI")
    def test_model_name_set_for_groq(self, mock_openai):
        with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_test-key", "GROQ_MODEL_NAME": "llama-3.3-70b-versatile"}, clear=False):
            engine = AIEngine()
            assert engine.model_name == "llama-3.3-70b-versatile"

    @patch("app.ai_engine.openai.OpenAI")
    def test_reinitialize_updates_key(self, mock_openai):
        with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_test-key"}, clear=False):
            engine = AIEngine()
            engine.reinitialize("gsk_new-key")
            assert os.environ.get("GROQ_API_KEY") == "gsk_new-key"

    def test_quota_error_detection(self):
        assert AIEngine._is_quota_error(Exception("429 Too Many Requests"))
        assert AIEngine._is_quota_error(Exception("rate limit exceeded"))
        assert AIEngine._is_quota_error(Exception("quota exceeded"))
        assert not AIEngine._is_quota_error(Exception("500 Internal Server Error"))


class TestRenderUserPrompt:
    """Tests for the _render_user_prompt method."""

    @pytest.fixture
    def engine(self):
        with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_test-key"}, clear=False):
            with patch("app.ai_engine.openai.OpenAI"):
                return AIEngine()

    def test_replaces_url_placeholder(self, engine, sample_scraped_data):
        template = "Audit this: {{ url }}"
        result = engine._render_user_prompt(template, sample_scraped_data)
        assert "https://example.com" in result
        assert "{{ url }}" not in result

    def test_replaces_meta_title(self, engine, sample_scraped_data):
        template = "Title: {{ meta_title }}"
        result = engine._render_user_prompt(template, sample_scraped_data)
        assert "Example Site - Home" in result

    def test_replaces_meta_description(self, engine, sample_scraped_data):
        template = "Desc: {{ meta_description }}"
        result = engine._render_user_prompt(template, sample_scraped_data)
        assert "This is an example website description." in result

    def test_replaces_word_count(self, engine, sample_scraped_data):
        template = "Words: {{ word_count }}"
        result = engine._render_user_prompt(template, sample_scraped_data)
        assert "1500" in result

    def test_replaces_cta_count(self, engine, sample_scraped_data):
        template = "CTAs: {{ cta_count }}"
        result = engine._render_user_prompt(template, sample_scraped_data)
        assert "5" in result

    def test_replaces_heading_counts(self, engine, sample_scraped_data):
        template = "H1: {{ headings.h1_count }} H2: {{ headings.h2_count }} H3: {{ headings.h3_count }}"
        result = engine._render_user_prompt(template, sample_scraped_data)
        assert "H1: 1" in result
        assert "H2: 3" in result
        assert "H3: 5" in result

    def test_replaces_link_metrics(self, engine, sample_scraped_data):
        template = "Total: {{ links.total_links }} Int: {{ links.internal_links }} Ext: {{ links.external_links }} Ratio: {{ links.ratio_internal_external }}"
        result = engine._render_user_prompt(template, sample_scraped_data)
        assert "Total: 25" in result
        assert "Int: 18" in result
        assert "Ext: 7" in result
        assert "Ratio: 2.57" in result

    def test_replaces_image_metrics(self, engine, sample_scraped_data):
        template = "Total: {{ images.total_images }} With: {{ images.images_with_alt }} Without: {{ images.images_without_alt }} Pct: {{ images.alt_text_coverage_pct }}"
        result = engine._render_user_prompt(template, sample_scraped_data)
        assert "Total: 10" in result
        assert "With: 8" in result
        assert "Without: 2" in result
        assert "Pct: 80.0" in result

    def test_handles_none_meta_title(self, engine, sample_scraped_data):
        sample_scraped_data.meta_title = None
        template = "Title: {{ meta_title }}"
        result = engine._render_user_prompt(template, sample_scraped_data)
        assert "N/A" in result

    def test_handles_none_meta_description(self, engine, sample_scraped_data):
        sample_scraped_data.meta_description = None
        template = "Desc: {{ meta_description }}"
        result = engine._render_user_prompt(template, sample_scraped_data)
        assert "N/A" in result

    def test_template_without_placeholders_unchanged(self, engine, sample_scraped_data):
        template = "No placeholders here"
        result = engine._render_user_prompt(template, sample_scraped_data)
        assert result == "No placeholders here"


class TestLoadPrompts:
    """Tests for the _load_prompts method."""

    @pytest.fixture
    def engine(self):
        with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_test-key"}, clear=False):
            with patch("app.ai_engine.openai.OpenAI"):
                return AIEngine()

    def test_load_prompts_returns_tuple(self, engine):
        system_prompt, user_prompt_template = engine._load_prompts()
        assert isinstance(system_prompt, str)
        assert isinstance(user_prompt_template, str)

    def test_fallback_system_prompt_when_file_missing(self, engine):
        engine.system_prompt_path = "/nonexistent/path/system_prompt.txt"
        system_prompt, _ = engine._load_prompts()
        assert "SEO" in system_prompt

    def test_fallback_user_prompt_when_file_missing(self, engine):
        engine.user_prompt_path = "/nonexistent/path/user_prompt.txt"
        _, user_prompt = engine._load_prompts()
        assert "{{ url }}" in user_prompt
