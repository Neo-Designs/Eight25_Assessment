import re
from urllib.parse import urlparse
from playwright.async_api import async_playwright
from app.models.schemas import ScrapedPageData, HeadingMetrics, LinkMetrics, ImageMetrics

class PlaywrightScraper:
    def __init__(self):
        # Common CTA keywords
        self.cta_keywords = re.compile(
            r'(get started|sign up|contact|subscribe|buy|purchase|try for free|demo|join|download|order|register|submit|learn more)',
            re.IGNORECASE
        )
        self.cta_classes = re.compile(r'(cta|btn|button)', re.IGNORECASE)

    async def scrape(self, url: str) -> ScrapedPageData:
        parsed_url = urlparse(url)
        domain = parsed_url.netloc

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ],
            )
            # Create a context with user-agent to avoid simple scraping blocks
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            # Navigate to the URL
            # Set longer timeout (30s) and wait until network is idle or load event
            await page.goto(url, wait_until="load", timeout=60000)
            
            # Extract meta title and description
            meta_title = await page.title()
            meta_desc_element = await page.query_selector('meta[name="description"]')
            meta_description = None
            if meta_desc_element:
                meta_description = await meta_desc_element.get_attribute("content")
            
            # Word Count
            # Extract text from body
            body_text = await page.inner_text("body")
            words = body_text.split()
            word_count = len(words)
            
            # Headings H1, H2, H3
            headings_list = []
            h1_elements = await page.query_selector_all("h1")
            h2_elements = await page.query_selector_all("h2")
            h3_elements = await page.query_selector_all("h3")
            
            for elem in h1_elements:
                text = (await elem.inner_text() or "").strip()
                if text:
                    headings_list.append({"tag": "h1", "text": text})
            
            for elem in h2_elements:
                text = (await elem.inner_text() or "").strip()
                if text:
                    headings_list.append({"tag": "h2", "text": text})
                    
            for elem in h3_elements:
                text = (await elem.inner_text() or "").strip()
                if text:
                    headings_list.append({"tag": "h3", "text": text})
            
            # Truncate to maximum 40 headings to save LLM tokens and avoid Rate Limits
            headings_list = headings_list[:40]
            
            heading_metrics = HeadingMetrics(
                h1_count=len(h1_elements),
                h2_count=len(h2_elements),
                h3_count=len(h3_elements),
                headings_list=headings_list
            )
            
            # Links (Internal vs External)
            link_elements = await page.query_selector_all("a")
            internal_count = 0
            external_count = 0
            
            for link in link_elements:
                href = await link.get_attribute("href")
                if not href:
                    continue
                href = href.strip()
                if href.startswith("#") or href.startswith("javascript:") or href.startswith("tel:") or href.startswith("mailto:"):
                    continue
                
                # Check if internal
                parsed_href = urlparse(href)
                # If path/relative or domain matches
                if not parsed_href.netloc or parsed_href.netloc == domain or parsed_href.netloc.endswith("." + domain):
                    internal_count += 1
                else:
                    external_count += 1
            
            total_links = internal_count + external_count
            ratio = (internal_count / external_count) if external_count > 0 else float(internal_count)
            
            link_metrics = LinkMetrics(
                total_links=total_links,
                internal_links=internal_count,
                external_links=external_count,
                ratio_internal_external=round(ratio, 2)
            )
            
            # Images with Alt Text
            image_elements = await page.query_selector_all("img")
            total_images = len(image_elements)
            images_with_alt = 0
            images_without_alt = 0
            
            for img in image_elements:
                alt = await img.get_attribute("alt")
                if alt is not None and alt.strip() != "":
                    images_with_alt += 1
                else:
                    images_without_alt += 1
            
            alt_coverage = (images_with_alt / total_images * 100) if total_images > 0 else 100.0
            
            image_metrics = ImageMetrics(
                total_images=total_images,
                images_with_alt=images_with_alt,
                images_without_alt=images_without_alt,
                alt_text_coverage_pct=round(alt_coverage, 2)
            )
            
            # Call-To-Action (CTA) elements
            # Look for button tags, elements with role=button, or link elements matching CTA patterns
            cta_count = 0
            
            # Check all elements that could be CTAs
            buttons = await page.query_selector_all("button, [role='button']")
            for btn in buttons:
                text = (await btn.inner_text() or "").strip()
                class_attr = (await btn.get_attribute("class") or "").strip()
                if self.cta_keywords.search(text) or self.cta_classes.search(class_attr):
                    cta_count += 1
            
            # For links, count them as CTA only if they have CTA class/ID or matches CTA text
            links_for_cta = await page.query_selector_all("a")
            for link in links_for_cta:
                text = (await link.inner_text() or "").strip()
                class_attr = (await link.get_attribute("class") or "").strip()
                # Check if it has a button-like class name OR high-intent text
                if (self.cta_classes.search(class_attr) and len(class_attr) < 100) or self.cta_keywords.search(text):
                    # Avoid double counting if it's already structured as role='button'
                    role = await link.get_attribute("role")
                    if role != "button":
                        cta_count += 1
            
            await browser.close()
            
            return ScrapedPageData(
                url=url,
                meta_title=meta_title,
                meta_description=meta_description,
                word_count=word_count,
                cta_count=cta_count,
                headings=heading_metrics,
                links=link_metrics,
                images=image_metrics
            )
