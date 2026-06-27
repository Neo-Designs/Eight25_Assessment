"""CLI smoke test: scrape + AI analyze a single URL."""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app.scraper import PlaywrightScraper
from app.analyzer import AnalyzerService


async def main():
    if not os.getenv("GROQ_API_KEY"):
        print("ERROR: Set GROQ_API_KEY in .env before running this script.")
        sys.exit(1)

    url = sys.argv[1] if len(sys.argv) > 1 else "https://example.com"
    print(f"Scraping {url}...")
    scraper = PlaywrightScraper()
    data = await scraper.scrape(url)
    print(f"  Word count: {data.word_count}, CTAs: {data.cta_count}, H1: {data.headings.h1_count}")

    print("Running AI analysis...")
    analyzer = AnalyzerService()
    output, _, _ = await analyzer.analyze(data)
    print(f"  SEO score: {output.overall_seo_health_score}")
    print(f"  Findings: {len(output.findings)}, Recommendations: {len(output.recommendations)}")
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
