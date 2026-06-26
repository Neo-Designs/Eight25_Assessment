"""Unit tests for app/models/schemas.py - Pydantic model validation."""
import pytest
from pydantic import ValidationError

from app.models.schemas import (
    LinkMetrics,
    ImageMetrics,
    HeadingMetrics,
    ScrapedPageData,
    GroundingSource,
    AuditFinding,
    ActionableRecommendation,
    AIAuditOutput,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    DriftRequest,
    DriftResponse,
)


class TestLinkMetrics:
    def test_valid_link_metrics(self):
        lm = LinkMetrics(total_links=10, internal_links=7, external_links=3, ratio_internal_external=2.33)
        assert lm.total_links == 10
        assert lm.internal_links == 7

    def test_zero_links(self):
        lm = LinkMetrics(total_links=0, internal_links=0, external_links=0, ratio_internal_external=0.0)
        assert lm.total_links == 0


class TestImageMetrics:
    def test_valid_image_metrics(self):
        im = ImageMetrics(total_images=5, images_with_alt=3, images_without_alt=2, alt_text_coverage_pct=60.0)
        assert im.alt_text_coverage_pct == 60.0

    def test_full_coverage(self):
        im = ImageMetrics(total_images=10, images_with_alt=10, images_without_alt=0, alt_text_coverage_pct=100.0)
        assert im.alt_text_coverage_pct == 100.0

    def test_no_images(self):
        im = ImageMetrics(total_images=0, images_with_alt=0, images_without_alt=0, alt_text_coverage_pct=100.0)
        assert im.total_images == 0


class TestHeadingMetrics:
    def test_valid_heading_metrics(self):
        hm = HeadingMetrics(
            h1_count=1, h2_count=3, h3_count=5,
            headings_list=[{"tag": "h1", "text": "Main Title"}]
        )
        assert hm.h1_count == 1
        assert len(hm.headings_list) == 1

    def test_empty_headings_list(self):
        hm = HeadingMetrics(h1_count=0, h2_count=0, h3_count=0, headings_list=[])
        assert hm.headings_list == []


class TestScrapedPageData:
    @pytest.fixture
    def valid_scraped_data(self):
        return {
            "url": "https://example.com",
            "meta_title": "Example",
            "meta_description": "Example site",
            "word_count": 500,
            "cta_count": 3,
            "headings": {"h1_count": 1, "h2_count": 2, "h3_count": 3, "headings_list": []},
            "links": {"total_links": 10, "internal_links": 7, "external_links": 3, "ratio_internal_external": 2.33},
            "images": {"total_images": 5, "images_with_alt": 4, "images_without_alt": 1, "alt_text_coverage_pct": 80.0},
        }

    def test_valid_scraped_page_data(self, valid_scraped_data):
        spd = ScrapedPageData(**valid_scraped_data)
        assert spd.url == "https://example.com"
        assert spd.word_count == 500

    def test_meta_title_optional(self, valid_scraped_data):
        valid_scraped_data["meta_title"] = None
        spd = ScrapedPageData(**valid_scraped_data)
        assert spd.meta_title is None

    def test_meta_description_optional(self, valid_scraped_data):
        valid_scraped_data["meta_description"] = None
        spd = ScrapedPageData(**valid_scraped_data)
        assert spd.meta_description is None

    def test_missing_required_field_raises_error(self):
        with pytest.raises(ValidationError):
            ScrapedPageData(url="https://example.com")


class TestGroundingSource:
    def test_valid_grounding_source(self):
        gs = GroundingSource(metric_name="word_count", metric_value="500")
        assert gs.metric_name == "word_count"
        assert gs.metric_value == "500"


class TestAuditFinding:
    def test_valid_finding(self):
        af = AuditFinding(
            category="SEO structure",
            observation="Missing H1 tag",
            impact="Reduces crawlability",
            grounding=[GroundingSource(metric_name="h1_count", metric_value="0")]
        )
        assert af.category == "SEO structure"

    def test_invalid_category_raises_error(self):
        with pytest.raises(ValidationError):
            AuditFinding(
                category="Invalid Category",
                observation="test",
                impact="test",
                grounding=[]
            )

    def test_all_valid_categories(self):
        valid_categories = [
            "SEO structure", "Messaging clarity", "CTA usage",
            "Content depth", "UX/structural concerns"
        ]
        for cat in valid_categories:
            af = AuditFinding(
                category=cat,
                observation="obs",
                impact="imp",
                grounding=[GroundingSource(metric_name="m", metric_value="v")]
            )
            assert af.category == cat


class TestActionableRecommendation:
    def test_valid_recommendation(self):
        ar = ActionableRecommendation(
            priority=1,
            title="Fix H1",
            details="Add a single H1 tag",
            expected_outcome="Better SEO",
            confidence_score=0.9,
            grounding=[GroundingSource(metric_name="h1_count", metric_value="0")]
        )
        assert ar.priority == 1
        assert ar.confidence_score == 0.9

    def test_priority_min_bound(self):
        with pytest.raises(ValidationError):
            ActionableRecommendation(
                priority=0, title="t", details="d",
                expected_outcome="e", confidence_score=0.5,
                grounding=[GroundingSource(metric_name="m", metric_value="v")]
            )

    def test_priority_max_bound(self):
        with pytest.raises(ValidationError):
            ActionableRecommendation(
                priority=6, title="t", details="d",
                expected_outcome="e", confidence_score=0.5,
                grounding=[GroundingSource(metric_name="m", metric_value="v")]
            )

    def test_confidence_score_min_bound(self):
        with pytest.raises(ValidationError):
            ActionableRecommendation(
                priority=1, title="t", details="d",
                expected_outcome="e", confidence_score=-0.1,
                grounding=[GroundingSource(metric_name="m", metric_value="v")]
            )

    def test_confidence_score_max_bound(self):
        with pytest.raises(ValidationError):
            ActionableRecommendation(
                priority=1, title="t", details="d",
                expected_outcome="e", confidence_score=1.1,
                grounding=[GroundingSource(metric_name="m", metric_value="v")]
            )

    def test_confidence_score_boundaries_valid(self):
        # 0.0 and 1.0 should be valid
        ar_min = ActionableRecommendation(
            priority=1, title="t", details="d",
            expected_outcome="e", confidence_score=0.0,
            grounding=[GroundingSource(metric_name="m", metric_value="v")]
        )
        ar_max = ActionableRecommendation(
            priority=5, title="t", details="d",
            expected_outcome="e", confidence_score=1.0,
            grounding=[GroundingSource(metric_name="m", metric_value="v")]
        )
        assert ar_min.confidence_score == 0.0
        assert ar_max.confidence_score == 1.0


class TestAIAuditOutput:
    @pytest.fixture
    def valid_recommendations(self):
        return [
            ActionableRecommendation(
                priority=i, title=f"Rec {i}", details="details",
                expected_outcome="outcome", confidence_score=0.8,
                grounding=[GroundingSource(metric_name="m", metric_value="v")]
            )
            for i in range(1, 4)
        ]

    @pytest.fixture
    def valid_findings(self):
        return [
            AuditFinding(
                category="SEO structure",
                observation="obs",
                impact="imp",
                grounding=[GroundingSource(metric_name="m", metric_value="v")]
            )
        ]

    def test_valid_audit_output(self, valid_findings, valid_recommendations):
        ao = AIAuditOutput(
            overall_seo_health_score=75,
            summary="Good overall",
            findings=valid_findings,
            recommendations=valid_recommendations,
        )
        assert ao.overall_seo_health_score == 75

    def test_seo_score_min_bound(self, valid_findings, valid_recommendations):
        with pytest.raises(ValidationError):
            AIAuditOutput(
                overall_seo_health_score=-1,
                summary="s",
                findings=valid_findings,
                recommendations=valid_recommendations,
            )

    def test_seo_score_max_bound(self, valid_findings, valid_recommendations):
        with pytest.raises(ValidationError):
            AIAuditOutput(
                overall_seo_health_score=101,
                summary="s",
                findings=valid_findings,
                recommendations=valid_recommendations,
            )

    def test_too_few_recommendations(self, valid_findings):
        recs = [
            ActionableRecommendation(
                priority=i, title=f"Rec {i}", details="d",
                expected_outcome="e", confidence_score=0.5,
                grounding=[GroundingSource(metric_name="m", metric_value="v")]
            )
            for i in range(1, 3)  # Only 2
        ]
        with pytest.raises(ValidationError):
            AIAuditOutput(
                overall_seo_health_score=50,
                summary="s",
                findings=valid_findings,
                recommendations=recs,
            )

    def test_too_many_recommendations(self, valid_findings):
        recs = [
            ActionableRecommendation(
                priority=min(i, 5), title=f"Rec {i}", details="d",
                expected_outcome="e", confidence_score=0.5,
                grounding=[GroundingSource(metric_name="m", metric_value="v")]
            )
            for i in range(1, 7)  # 6 recommendations
        ]
        with pytest.raises(ValidationError):
            AIAuditOutput(
                overall_seo_health_score=50,
                summary="s",
                findings=valid_findings,
                recommendations=recs,
            )


class TestChatModels:
    def test_chat_message(self):
        msg = ChatMessage(role="user", content="Hello")
        assert msg.role == "user"

    def test_chat_request(self):
        req = ChatRequest(log_id=1, message="Why is my score low?")
        assert req.log_id == 1
        assert req.history == []

    def test_chat_request_with_history(self):
        req = ChatRequest(
            log_id=1,
            message="Follow up",
            history=[ChatMessage(role="user", content="Hi")]
        )
        assert len(req.history) == 1

    def test_chat_response(self):
        resp = ChatResponse(response="Your score is low because...")
        assert "low" in resp.response


class TestDriftModels:
    def test_drift_request(self):
        req = DriftRequest(url="https://mysite.com", competitor_url="https://competitor.com")
        assert req.url == "https://mysite.com"

    def test_drift_response(self):
        data = {
            "url": "https://example.com",
            "word_count": 100,
            "cta_count": 1,
            "headings": {"h1_count": 1, "h2_count": 0, "h3_count": 0, "headings_list": []},
            "links": {"total_links": 5, "internal_links": 3, "external_links": 2, "ratio_internal_external": 1.5},
            "images": {"total_images": 2, "images_with_alt": 2, "images_without_alt": 0, "alt_text_coverage_pct": 100.0},
        }
        resp = DriftResponse(
            primary_data=ScrapedPageData(**data),
            competitor_data=ScrapedPageData(**{**data, "url": "https://comp.com"})
        )
        assert resp.primary_data.url == "https://example.com"
        assert resp.competitor_data.url == "https://comp.com"
