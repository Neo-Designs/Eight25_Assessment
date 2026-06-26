"""Unit tests for app/analyzer.py - AnalyzerService logic."""
import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock

from app.analyzer import AnalyzerService
from app.models.schemas import (
    ScrapedPageData, HeadingMetrics, LinkMetrics, ImageMetrics,
    AIAuditOutput, AuditFinding, ActionableRecommendation, GroundingSource
)


@pytest.fixture
def sample_scraped_data():
    """Create sample ScrapedPageData for testing."""
    return ScrapedPageData(
        url="https://example.com",
        meta_title="Example Site",
        meta_description="An example site for testing",
        word_count=1200,
        cta_count=4,
        headings=HeadingMetrics(
            h1_count=1,
            h2_count=3,
            h3_count=2,
            headings_list=[
                {"tag": "h1", "text": "Welcome"},
                {"tag": "h2", "text": "Services"},
                {"tag": "h2", "text": "About"},
                {"tag": "h2", "text": "Contact"},
                {"tag": "h3", "text": "Web Dev"},
                {"tag": "h3", "text": "Design"},
            ]
        ),
        links=LinkMetrics(
            total_links=20,
            internal_links=15,
            external_links=5,
            ratio_internal_external=3.0
        ),
        images=ImageMetrics(
            total_images=8,
            images_with_alt=6,
            images_without_alt=2,
            alt_text_coverage_pct=75.0
        )
    )


@pytest.fixture
def mock_audit_output():
    """Create a mock AIAuditOutput."""
    return AIAuditOutput(
        overall_seo_health_score=72,
        summary="The page has solid structure but needs improvement in image accessibility.",
        findings=[
            AuditFinding(
                category="SEO structure",
                observation="Good H1/H2 hierarchy",
                impact="Positive SEO signal",
                grounding=[GroundingSource(metric_name="headings.h1_count", metric_value="1")]
            ),
            AuditFinding(
                category="UX/structural concerns",
                observation="25% of images lack alt text",
                impact="Reduced accessibility",
                grounding=[GroundingSource(metric_name="images.alt_text_coverage_pct", metric_value="75.0")]
            ),
        ],
        recommendations=[
            ActionableRecommendation(
                priority=1,
                title="Add alt text to all images",
                details="Review all images and add descriptive alt text",
                expected_outcome="Improved accessibility and SEO ranking",
                confidence_score=0.9,
                grounding=[GroundingSource(metric_name="images.images_without_alt", metric_value="2")]
            ),
            ActionableRecommendation(
                priority=2,
                title="Increase content depth",
                details="Add more comprehensive content beyond 1500 words",
                expected_outcome="Better content depth signals",
                confidence_score=0.8,
                grounding=[GroundingSource(metric_name="word_count", metric_value="1200")]
            ),
            ActionableRecommendation(
                priority=3,
                title="Add more CTAs",
                details="Add calls to action in key sections",
                expected_outcome="Better conversion rates",
                confidence_score=0.7,
                grounding=[GroundingSource(metric_name="cta_count", metric_value="4")]
            ),
        ]
    )


class TestAnalyzerServiceInit:
    """Tests for AnalyzerService initialization."""

    @patch("app.analyzer.AIEngine")
    def test_init_creates_ai_engine(self, mock_engine_cls):
        service = AnalyzerService()
        mock_engine_cls.assert_called_once()
        assert service.ai_engine is mock_engine_cls.return_value


class TestAnalyzerServiceAnalyze:
    """Tests for the analyze method."""

    @patch("app.analyzer.AIEngine")
    @pytest.mark.asyncio
    async def test_analyze_returns_output_and_prompts(
        self, mock_engine_cls, sample_scraped_data, mock_audit_output
    ):
        mock_engine = MagicMock()
        mock_engine.run_completion = AsyncMock(return_value=mock_audit_output)
        mock_engine_cls.return_value = mock_engine

        service = AnalyzerService()
        result = await service.analyze(sample_scraped_data)

        assert len(result) == 3
        output, system_prompt, user_prompt = result
        assert output == mock_audit_output
        assert "Expert WebCrawler Analyst" in system_prompt
        assert "ScrapedPageData" in user_prompt

    @patch("app.analyzer.AIEngine")
    @pytest.mark.asyncio
    async def test_analyze_system_prompt_contains_required_instructions(
        self, mock_engine_cls, sample_scraped_data, mock_audit_output
    ):
        mock_engine = MagicMock()
        mock_engine.run_completion = AsyncMock(return_value=mock_audit_output)
        mock_engine_cls.return_value = mock_engine

        service = AnalyzerService()
        _, system_prompt, _ = await service.analyze(sample_scraped_data)

        assert "strict" in system_prompt.lower() or "structured" in system_prompt.lower()
        assert "JSON schema" in system_prompt
        assert "3 and 5" in system_prompt
        assert "grounding" in system_prompt.lower()

    @patch("app.analyzer.AIEngine")
    @pytest.mark.asyncio
    async def test_analyze_user_prompt_contains_scraped_data(
        self, mock_engine_cls, sample_scraped_data, mock_audit_output
    ):
        mock_engine = MagicMock()
        mock_engine.run_completion = AsyncMock(return_value=mock_audit_output)
        mock_engine_cls.return_value = mock_engine

        service = AnalyzerService()
        _, _, user_prompt = await service.analyze(sample_scraped_data)

        assert "https://example.com" in user_prompt
        assert "1200" in user_prompt  # word_count
        assert "Example Site" in user_prompt

    @patch("app.analyzer.AIEngine")
    @pytest.mark.asyncio
    async def test_analyze_with_weights_appends_to_prompt(
        self, mock_engine_cls, sample_scraped_data, mock_audit_output
    ):
        mock_engine = MagicMock()
        mock_engine.run_completion = AsyncMock(return_value=mock_audit_output)
        mock_engine_cls.return_value = mock_engine

        weights = {"SEO structure": 0.4, "Content depth": 0.3, "CTA usage": 0.3}
        service = AnalyzerService()
        _, _, user_prompt = await service.analyze(sample_scraped_data, weights=weights)

        assert "CUSTOM WEIGHTING" in user_prompt
        assert "SEO structure" in user_prompt
        assert "0.4" in user_prompt

    @patch("app.analyzer.AIEngine")
    @pytest.mark.asyncio
    async def test_analyze_without_weights_no_weighting_section(
        self, mock_engine_cls, sample_scraped_data, mock_audit_output
    ):
        mock_engine = MagicMock()
        mock_engine.run_completion = AsyncMock(return_value=mock_audit_output)
        mock_engine_cls.return_value = mock_engine

        service = AnalyzerService()
        _, _, user_prompt = await service.analyze(sample_scraped_data, weights=None)

        assert "CUSTOM WEIGHTING" not in user_prompt

    @patch("app.analyzer.AIEngine")
    @pytest.mark.asyncio
    async def test_analyze_passes_correct_response_model(
        self, mock_engine_cls, sample_scraped_data, mock_audit_output
    ):
        mock_engine = MagicMock()
        mock_engine.run_completion = AsyncMock(return_value=mock_audit_output)
        mock_engine_cls.return_value = mock_engine

        service = AnalyzerService()
        await service.analyze(sample_scraped_data)

        call_kwargs = mock_engine.run_completion.call_args[1]
        assert call_kwargs["response_model"] == AIAuditOutput

    @patch("app.analyzer.AIEngine")
    @pytest.mark.asyncio
    async def test_analyze_propagates_engine_exception(
        self, mock_engine_cls, sample_scraped_data
    ):
        mock_engine = MagicMock()
        mock_engine.run_completion = AsyncMock(
            side_effect=RuntimeError("LLM provider error")
        )
        mock_engine_cls.return_value = mock_engine

        service = AnalyzerService()
        with pytest.raises(RuntimeError, match="LLM provider error"):
            await service.analyze(sample_scraped_data)

    @patch("app.analyzer.AIEngine")
    @pytest.mark.asyncio
    async def test_analyze_categories_mentioned_in_system_prompt(
        self, mock_engine_cls, sample_scraped_data, mock_audit_output
    ):
        mock_engine = MagicMock()
        mock_engine.run_completion = AsyncMock(return_value=mock_audit_output)
        mock_engine_cls.return_value = mock_engine

        service = AnalyzerService()
        _, system_prompt, _ = await service.analyze(sample_scraped_data)

        assert "SEO structure" in system_prompt
        assert "Messaging clarity" in system_prompt
        assert "CTA usage" in system_prompt
        assert "Content depth" in system_prompt
        assert "UX/structural concerns" in system_prompt
