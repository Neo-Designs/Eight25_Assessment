"""Unit tests for app/scraper.py - PlaywrightScraper logic with mocked browser."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

from app.scraper import PlaywrightScraper
from app.models.schemas import ScrapedPageData, HeadingMetrics, LinkMetrics, ImageMetrics


@pytest.fixture
def scraper():
    """Create a PlaywrightScraper instance."""
    return PlaywrightScraper()


class TestPlaywrightScraperInit:
    """Tests for scraper initialization."""

    def test_cta_keywords_pattern_matches(self, scraper):
        assert scraper.cta_keywords.search("Get Started")
        assert scraper.cta_keywords.search("Sign up now")
        assert scraper.cta_keywords.search("Contact us")
        assert scraper.cta_keywords.search("Subscribe")
        assert scraper.cta_keywords.search("Buy Now")
        assert scraper.cta_keywords.search("Try for free")
        assert scraper.cta_keywords.search("Learn more")

    def test_cta_keywords_does_not_match_generic_text(self, scraper):
        assert scraper.cta_keywords.search("About our company") is None
        assert scraper.cta_keywords.search("Read the article") is None
        assert scraper.cta_keywords.search("Privacy Policy") is None

    def test_cta_classes_pattern_matches(self, scraper):
        assert scraper.cta_classes.search("cta-button")
        assert scraper.cta_classes.search("btn-primary")
        assert scraper.cta_classes.search("button-large")

    def test_cta_classes_does_not_match_generic_classes(self, scraper):
        assert scraper.cta_classes.search("nav-link") is None
        assert scraper.cta_classes.search("container") is None


class TestScraperScrape:
    """Tests for the scrape method with mocked Playwright."""

    @pytest.fixture
    def mock_page(self):
        """Create a mock page object with default behaviors."""
        page = AsyncMock()
        page.title.return_value = "Test Page Title"

        # Meta description element
        meta_elem = AsyncMock()
        meta_elem.get_attribute.return_value = "A test page description"
        page.query_selector.return_value = meta_elem

        # Body text
        page.inner_text.return_value = "Hello world this is a test page with some content words"

        # Headings
        h1_elem = AsyncMock()
        h1_elem.inner_text.return_value = "Main Heading"
        h2_elem = AsyncMock()
        h2_elem.inner_text.return_value = "Sub Heading"
        h3_elem = AsyncMock()
        h3_elem.inner_text.return_value = "Detail Heading"

        page.query_selector_all.side_effect = self._make_query_selector_all(
            h1_elems=[h1_elem],
            h2_elems=[h2_elem],
            h3_elems=[h3_elem],
            link_elems=[],
            image_elems=[],
            button_elems=[],
            cta_link_elems=[],
        )
        return page

    def _make_query_selector_all(
        self, h1_elems, h2_elems, h3_elems, link_elems, image_elems, button_elems, cta_link_elems
    ):
        """Create the side_effect function for query_selector_all based on selectors."""
        call_count = [0]

        async def selector_handler(selector):
            if selector == "h1":
                return h1_elems
            elif selector == "h2":
                return h2_elems
            elif selector == "h3":
                return h3_elems
            elif selector == "a" and call_count[0] == 0:
                call_count[0] += 1
                return link_elems
            elif selector == "img":
                return image_elems
            elif selector == "button, [role='button']":
                return button_elems
            elif selector == "a":
                return cta_link_elems
            return []

        return selector_handler

    @pytest.fixture
    def mock_browser_context(self, mock_page):
        """Create mocked browser/context/playwright stack."""
        browser = AsyncMock()
        context = AsyncMock()
        context.new_page.return_value = mock_page
        browser.new_context.return_value = context

        playwright_instance = AsyncMock()
        playwright_instance.chromium.launch.return_value = browser

        return playwright_instance, browser, context, mock_page

    @pytest.mark.asyncio
    async def test_scrape_basic_page(self, scraper, mock_browser_context):
        playwright_inst, browser, context, page = mock_browser_context

        with patch("app.scraper.async_playwright") as mock_pw:
            mock_pw.return_value.__aenter__.return_value = playwright_inst
            mock_pw.return_value.__aexit__.return_value = None

            result = await scraper.scrape("https://example.com")

        assert isinstance(result, ScrapedPageData)
        assert result.url == "https://example.com"
        assert result.meta_title == "Test Page Title"
        assert result.meta_description == "A test page description"
        assert result.word_count == 11  # "Hello world this is a test page with some content words"

    @pytest.mark.asyncio
    async def test_scrape_meta_description_missing(self, scraper, mock_browser_context):
        playwright_inst, browser, context, page = mock_browser_context
        # No meta description element
        page.query_selector.return_value = None

        with patch("app.scraper.async_playwright") as mock_pw:
            mock_pw.return_value.__aenter__.return_value = playwright_inst
            mock_pw.return_value.__aexit__.return_value = None

            result = await scraper.scrape("https://example.com")

        assert result.meta_description is None

    @pytest.mark.asyncio
    async def test_scrape_headings_counted(self, scraper, mock_browser_context):
        playwright_inst, browser, context, page = mock_browser_context

        with patch("app.scraper.async_playwright") as mock_pw:
            mock_pw.return_value.__aenter__.return_value = playwright_inst
            mock_pw.return_value.__aexit__.return_value = None

            result = await scraper.scrape("https://example.com")

        assert result.headings.h1_count == 1
        assert result.headings.h2_count == 1
        assert result.headings.h3_count == 1
        assert len(result.headings.headings_list) == 3

    @pytest.mark.asyncio
    async def test_scrape_empty_heading_text_excluded(self, scraper):
        """Headings with empty text should be excluded from headings_list."""
        page = AsyncMock()
        page.title.return_value = "Test"
        page.query_selector.return_value = None
        page.inner_text.return_value = "Some text"

        h1_elem = AsyncMock()
        h1_elem.inner_text.return_value = ""  # empty text
        h1_elem2 = AsyncMock()
        h1_elem2.inner_text.return_value = "Valid H1"

        call_count = [0]

        async def selector_handler(selector):
            if selector == "h1":
                return [h1_elem, h1_elem2]
            elif selector == "h2":
                return []
            elif selector == "h3":
                return []
            elif selector == "a" and call_count[0] == 0:
                call_count[0] += 1
                return []
            elif selector == "img":
                return []
            elif selector == "button, [role='button']":
                return []
            elif selector == "a":
                return []
            return []

        page.query_selector_all.side_effect = selector_handler

        browser = AsyncMock()
        context = AsyncMock()
        context.new_page.return_value = page
        browser.new_context.return_value = context

        playwright_inst = AsyncMock()
        playwright_inst.chromium.launch.return_value = browser

        with patch("app.scraper.async_playwright") as mock_pw:
            mock_pw.return_value.__aenter__.return_value = playwright_inst
            mock_pw.return_value.__aexit__.return_value = None

            result = await scraper.scrape("https://example.com")

        # h1_count includes both elements (element count), but headings_list only has non-empty
        assert result.headings.h1_count == 2
        assert len(result.headings.headings_list) == 1
        assert result.headings.headings_list[0]["text"] == "Valid H1"

    @pytest.mark.asyncio
    async def test_scrape_links_internal_vs_external(self, scraper):
        """Verify internal vs external link classification."""
        page = AsyncMock()
        page.title.return_value = "Test"
        page.query_selector.return_value = None
        page.inner_text.return_value = "text"

        # Create link elements
        internal_link = AsyncMock()
        internal_link.get_attribute.return_value = "/about"

        external_link = AsyncMock()
        external_link.get_attribute.return_value = "https://other-site.com/page"

        relative_link = AsyncMock()
        relative_link.get_attribute.return_value = "https://example.com/contact"

        # Links with no href or special schemes should be skipped
        hash_link = AsyncMock()
        hash_link.get_attribute.return_value = "#section"

        mailto_link = AsyncMock()
        mailto_link.get_attribute.return_value = "mailto:test@test.com"

        null_href_link = AsyncMock()
        null_href_link.get_attribute.return_value = None

        link_elems = [internal_link, external_link, relative_link, hash_link, mailto_link, null_href_link]
        call_count = [0]

        async def selector_handler(selector):
            if selector == "h1":
                return []
            elif selector == "h2":
                return []
            elif selector == "h3":
                return []
            elif selector == "a" and call_count[0] == 0:
                call_count[0] += 1
                return link_elems
            elif selector == "img":
                return []
            elif selector == "button, [role='button']":
                return []
            elif selector == "a":
                return []
            return []

        page.query_selector_all.side_effect = selector_handler

        browser = AsyncMock()
        context = AsyncMock()
        context.new_page.return_value = page
        browser.new_context.return_value = context
        playwright_inst = AsyncMock()
        playwright_inst.chromium.launch.return_value = browser

        with patch("app.scraper.async_playwright") as mock_pw:
            mock_pw.return_value.__aenter__.return_value = playwright_inst
            mock_pw.return_value.__aexit__.return_value = None

            result = await scraper.scrape("https://example.com")

        # /about -> internal (no netloc), other-site.com -> external, example.com -> internal
        assert result.links.internal_links == 2
        assert result.links.external_links == 1
        assert result.links.total_links == 3
        assert result.links.ratio_internal_external == 2.0

    @pytest.mark.asyncio
    async def test_scrape_links_ratio_when_no_external(self, scraper):
        """When there are no external links, ratio should equal internal count."""
        page = AsyncMock()
        page.title.return_value = "Test"
        page.query_selector.return_value = None
        page.inner_text.return_value = "text"

        internal_link = AsyncMock()
        internal_link.get_attribute.return_value = "/page1"

        call_count = [0]

        async def selector_handler(selector):
            if selector == "h1":
                return []
            elif selector == "h2":
                return []
            elif selector == "h3":
                return []
            elif selector == "a" and call_count[0] == 0:
                call_count[0] += 1
                return [internal_link]
            elif selector == "img":
                return []
            elif selector == "button, [role='button']":
                return []
            elif selector == "a":
                return []
            return []

        page.query_selector_all.side_effect = selector_handler

        browser = AsyncMock()
        context = AsyncMock()
        context.new_page.return_value = page
        browser.new_context.return_value = context
        playwright_inst = AsyncMock()
        playwright_inst.chromium.launch.return_value = browser

        with patch("app.scraper.async_playwright") as mock_pw:
            mock_pw.return_value.__aenter__.return_value = playwright_inst
            mock_pw.return_value.__aexit__.return_value = None

            result = await scraper.scrape("https://example.com")

        # ratio = internal_count (1) / 0 external → float(1) = 1.0
        assert result.links.ratio_internal_external == 1.0

    @pytest.mark.asyncio
    async def test_scrape_images_alt_text_coverage(self, scraper):
        """Verify image alt text detection."""
        page = AsyncMock()
        page.title.return_value = "Test"
        page.query_selector.return_value = None
        page.inner_text.return_value = "text"

        img_with_alt = AsyncMock()
        img_with_alt.get_attribute.return_value = "A nice image"

        img_without_alt = AsyncMock()
        img_without_alt.get_attribute.return_value = ""

        img_null_alt = AsyncMock()
        img_null_alt.get_attribute.return_value = None

        img_good_alt = AsyncMock()
        img_good_alt.get_attribute.return_value = "Another image"

        call_count = [0]

        async def selector_handler(selector):
            if selector == "h1":
                return []
            elif selector == "h2":
                return []
            elif selector == "h3":
                return []
            elif selector == "a" and call_count[0] == 0:
                call_count[0] += 1
                return []
            elif selector == "img":
                return [img_with_alt, img_without_alt, img_null_alt, img_good_alt]
            elif selector == "button, [role='button']":
                return []
            elif selector == "a":
                return []
            return []

        page.query_selector_all.side_effect = selector_handler

        browser = AsyncMock()
        context = AsyncMock()
        context.new_page.return_value = page
        browser.new_context.return_value = context
        playwright_inst = AsyncMock()
        playwright_inst.chromium.launch.return_value = browser

        with patch("app.scraper.async_playwright") as mock_pw:
            mock_pw.return_value.__aenter__.return_value = playwright_inst
            mock_pw.return_value.__aexit__.return_value = None

            result = await scraper.scrape("https://example.com")

        assert result.images.total_images == 4
        assert result.images.images_with_alt == 2
        assert result.images.images_without_alt == 2
        assert result.images.alt_text_coverage_pct == 50.0

    @pytest.mark.asyncio
    async def test_scrape_images_no_images_gives_100_pct_coverage(self, scraper):
        """When there are no images, alt coverage should be 100%."""
        page = AsyncMock()
        page.title.return_value = "Test"
        page.query_selector.return_value = None
        page.inner_text.return_value = "text"

        call_count = [0]

        async def selector_handler(selector):
            if selector == "h1":
                return []
            elif selector == "h2":
                return []
            elif selector == "h3":
                return []
            elif selector == "a" and call_count[0] == 0:
                call_count[0] += 1
                return []
            elif selector == "img":
                return []
            elif selector == "button, [role='button']":
                return []
            elif selector == "a":
                return []
            return []

        page.query_selector_all.side_effect = selector_handler

        browser = AsyncMock()
        context = AsyncMock()
        context.new_page.return_value = page
        browser.new_context.return_value = context
        playwright_inst = AsyncMock()
        playwright_inst.chromium.launch.return_value = browser

        with patch("app.scraper.async_playwright") as mock_pw:
            mock_pw.return_value.__aenter__.return_value = playwright_inst
            mock_pw.return_value.__aexit__.return_value = None

            result = await scraper.scrape("https://example.com")

        assert result.images.total_images == 0
        assert result.images.alt_text_coverage_pct == 100.0

    @pytest.mark.asyncio
    async def test_scrape_cta_buttons_counted(self, scraper):
        """CTA buttons with matching text/classes are counted."""
        page = AsyncMock()
        page.title.return_value = "Test"
        page.query_selector.return_value = None
        page.inner_text.return_value = "text"

        # Button with CTA text
        btn_cta = AsyncMock()
        btn_cta.inner_text.return_value = "Get Started"
        btn_cta.get_attribute.return_value = "regular-class"

        # Button with CTA class
        btn_class = AsyncMock()
        btn_class.inner_text.return_value = "Click"
        btn_class.get_attribute.return_value = "btn-primary"

        # Button with neither
        btn_generic = AsyncMock()
        btn_generic.inner_text.return_value = "Close"
        btn_generic.get_attribute.return_value = "modal-close"

        call_count = [0]

        async def selector_handler(selector):
            if selector == "h1":
                return []
            elif selector == "h2":
                return []
            elif selector == "h3":
                return []
            elif selector == "a" and call_count[0] == 0:
                call_count[0] += 1
                return []
            elif selector == "img":
                return []
            elif selector == "button, [role='button']":
                return [btn_cta, btn_class, btn_generic]
            elif selector == "a":
                return []
            return []

        page.query_selector_all.side_effect = selector_handler

        browser = AsyncMock()
        context = AsyncMock()
        context.new_page.return_value = page
        browser.new_context.return_value = context
        playwright_inst = AsyncMock()
        playwright_inst.chromium.launch.return_value = browser

        with patch("app.scraper.async_playwright") as mock_pw:
            mock_pw.return_value.__aenter__.return_value = playwright_inst
            mock_pw.return_value.__aexit__.return_value = None

            result = await scraper.scrape("https://example.com")

        assert result.cta_count == 2  # Get Started + btn-primary

    @pytest.mark.asyncio
    async def test_scrape_cta_links_counted(self, scraper):
        """CTA-style links (with matching text/class) are counted, avoiding role=button duplication."""
        page = AsyncMock()
        page.title.return_value = "Test"
        page.query_selector.return_value = None
        page.inner_text.return_value = "text"

        # Link with CTA text
        link_cta = AsyncMock()
        link_cta.inner_text.return_value = "Subscribe now"
        link_cta.get_attribute.side_effect = lambda attr: "nav-link" if attr == "class" else None

        # Link with CTA class
        link_btn_class = AsyncMock()
        link_btn_class.inner_text.return_value = "More"
        link_btn_class.get_attribute.side_effect = lambda attr: "cta-link" if attr == "class" else None

        # Link already counted as button (role=button)
        link_role_button = AsyncMock()
        link_role_button.inner_text.return_value = "Sign up"
        link_role_button.get_attribute.side_effect = lambda attr: "cta-link" if attr == "class" else "button" if attr == "role" else None

        call_count = [0]

        async def selector_handler(selector):
            if selector == "h1":
                return []
            elif selector == "h2":
                return []
            elif selector == "h3":
                return []
            elif selector == "a" and call_count[0] == 0:
                call_count[0] += 1
                return []
            elif selector == "img":
                return []
            elif selector == "button, [role='button']":
                return []
            elif selector == "a":
                return [link_cta, link_btn_class, link_role_button]
            return []

        page.query_selector_all.side_effect = selector_handler

        browser = AsyncMock()
        context = AsyncMock()
        context.new_page.return_value = page
        browser.new_context.return_value = context
        playwright_inst = AsyncMock()
        playwright_inst.chromium.launch.return_value = browser

        with patch("app.scraper.async_playwright") as mock_pw:
            mock_pw.return_value.__aenter__.return_value = playwright_inst
            mock_pw.return_value.__aexit__.return_value = None

            result = await scraper.scrape("https://example.com")

        # link_cta (text match) + link_btn_class (class match), link_role_button skipped (role=button)
        assert result.cta_count == 2

    @pytest.mark.asyncio
    async def test_scrape_subdomain_considered_internal(self, scraper):
        """Links to subdomains of the main domain should be internal."""
        page = AsyncMock()
        page.title.return_value = "Test"
        page.query_selector.return_value = None
        page.inner_text.return_value = "text"

        subdomain_link = AsyncMock()
        subdomain_link.get_attribute.return_value = "https://blog.example.com/post"

        call_count = [0]

        async def selector_handler(selector):
            if selector == "h1":
                return []
            elif selector == "h2":
                return []
            elif selector == "h3":
                return []
            elif selector == "a" and call_count[0] == 0:
                call_count[0] += 1
                return [subdomain_link]
            elif selector == "img":
                return []
            elif selector == "button, [role='button']":
                return []
            elif selector == "a":
                return []
            return []

        page.query_selector_all.side_effect = selector_handler

        browser = AsyncMock()
        context = AsyncMock()
        context.new_page.return_value = page
        browser.new_context.return_value = context
        playwright_inst = AsyncMock()
        playwright_inst.chromium.launch.return_value = browser

        with patch("app.scraper.async_playwright") as mock_pw:
            mock_pw.return_value.__aenter__.return_value = playwright_inst
            mock_pw.return_value.__aexit__.return_value = None

            result = await scraper.scrape("https://example.com")

        assert result.links.internal_links == 1
        assert result.links.external_links == 0

    @pytest.mark.asyncio
    async def test_scrape_browser_closed_after_scraping(self, scraper, mock_browser_context):
        """Verify browser.close() is called after scraping."""
        playwright_inst, browser, context, page = mock_browser_context

        with patch("app.scraper.async_playwright") as mock_pw:
            mock_pw.return_value.__aenter__.return_value = playwright_inst
            mock_pw.return_value.__aexit__.return_value = None

            await scraper.scrape("https://example.com")

        browser.close.assert_awaited_once()
