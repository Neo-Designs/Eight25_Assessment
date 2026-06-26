#!/usr/bin/env python3
import asyncio
import sys
import os
import json

# Adjust python path to find app module
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"))

from app.scraper import PlaywrightScraper
from app.ai_engine import AIEngine

async def main():
    if len(sys.argv) < 2:
        print("Usage: python test_audit.py <URL>")
        sys.exit(1)
        
    url = sys.argv[1]
    print(f"[*] Starting local scraper for: {url}")
    
    scraper = PlaywrightScraper()
    try:
        scraped_data = await scraper.scrape(url)
        print("[+] Scrape successful!")
        print(f"Title: {scraped_data.meta_title}")
        print(f"Words: {scraped_data.word_count}")
        print(f"H1-H3 counts: H1={scraped_data.headings.h1_count}, H2={scraped_data.headings.h2_count}, H3={scraped_data.headings.h3_count}")
        print(f"Links: Total={scraped_data.links.total_links}, Internal/External Ratio={scraped_data.links.ratio_internal_external}")
        print(f"Alt-text coverage: {scraped_data.images.alt_text_coverage_pct}%")
        print(f"CTA Elements: {scraped_data.cta_count}")
        
        print("\n[*] Starting AI Engine (Instructor + Pydantic)...")
        # Ensure API keys are checked
        if not os.environ.get("GEMINI_API_KEY") and not os.environ.get("OPENAI_API_KEY"):
            print("[!] Warning: Neither GEMINI_API_KEY nor OPENAI_API_KEY found in environment.")
            print("[!] AI Engine will run in mock output mode.")
            
        ai_engine = AIEngine()
        audit_output, system_prompt, user_prompt = await ai_engine.run_audit(scraped_data)
        
        print("[+] AI Analysis Completed!")
        print("====================================")
        print(f"SEO Health Score: {audit_output.overall_seo_health_score}/100")
        print("Summary:")
        print(audit_output.summary)
        print("\nRecommendations:")
        for rec in audit_output.recommendations:
            print(f"- [P{rec.priority}] {rec.title} (Confidence: {rec.confidence_score})")
            print(f"  Outcome: {rec.expected_outcome}")
            
    except Exception as e:
        print(f"[-] Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
