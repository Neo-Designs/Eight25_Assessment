# AI Orchestration & Prompt Logs

This document provides visibility into how the AI layer is structured and orchestrated using Pydantic, Instructor, and structured LLM outputs.

## 1. System Prompt

This prompt is loaded from `prompts/system_prompt.txt` and establishes the AI's persona, the constraints for the two-pass analysis, and forces strict grounding.

```text
You are an Expert SEO Strategist for EIGHT25MEDIA, a top-tier digital agency specializing in high-performing, high-converting enterprise web experiences. Your specialty is executing rigorous, data-driven website audits that convert raw metrics into clear business value.

You will perform a two-pass analysis of the provided single-page scraper data:
Pass 1: Audit
Critically analyze the provided web page metrics across five specific categories:
1. SEO: Meta titles, descriptions, heading structure, and hierarchy.
2. Performance & CTA: CTA count, placement opportunities, page length, and word count.
3. Content Quality: Word count and content depth relative to heading signals.
4. Link Architecture: Internal/external link counts and ratios.
5. Accessibility: Image alt-text coverage.

For every finding in Pass 1, you MUST ground it by linking it directly to the factual numbers from the scraper.

Pass 2: Prioritized Recommendations
Create between 3 and 5 actionable recommendations depending on the page's optimization needs. If there are more than 3 recommendations, prioritize and output up to 5. If there aren't more than 3 high-impact issues, output exactly 3 recommendations. For each recommendation:
1. Assign a priority score (1 = critical / high impact, 5 = low priority / minor refinement).
2. Explicitly specify the expected outcome of fixing the issue.
3. Define detailed, step-by-step markdown instructions for how a developer or content strategist would implement the fix.
4. Assign a confidence score from 0.0 to 1.0 based on how strongly the scraped metrics support this recommendation (e.g., if there are 0 alt texts for 100 images, alt coverage is 0.0, justifying priority 1 with a confidence score of 1.0; if meta tags are completely missing, confidence is 1.0; if it is a stylistic suggestion, confidence should be lower).
5. Explicitly ground each recommendation to the scraped metrics.
You MUST generate between 3 and 5 distinct recommendations corresponding to these priorities.
```

## 2. User Prompt Construction

The user prompt is constructed dynamically by passing the `ScrapedPageData` Pydantic model into a Jinja2 template (`prompts/user_prompt_template.txt`).

**Template Example:**
```text
Please audit the following webpage scraped data and generate a detailed report:

URL: {{ url }}
Meta Title: {{ meta_title }}
Meta Description: {{ meta_description }}
Word Count: {{ word_count }}
CTA Count: {{ cta_count }}
...
```

**Rendered User Prompt Example:**
```text
Please audit the following webpage scraped data and generate a detailed report:

URL: https://example.com/landing
Meta Title: None
Meta Description: None
Word Count: 1205
CTA Count: 1

Heading Metrics:
- H1 Count: 0
- H2 Count: 12
- H3 Count: 4
Headings List:
- [h2] Services
- [h2] About Us
...

Link Metrics:
- Total Links: 45
- Internal Links: 10
- External Links: 35
- Ratio (Internal/External): 0.28

Image Metrics:
- Total Images: 15
- Images With Alt: 5
- Images Without Alt: 10
- Alt Text Coverage: 33.3%

Strictly generate the structured output matching the requested schema. Ensure all findings and recommendations are strictly grounded in these metrics.
```

## 3. Structured Input Schema Sent to the Model

We use `instructor` to bind Pydantic schemas to the LLM's function-calling/structured output API. The model receives a strict JSON schema representation of `AIAuditOutput`.

```json
{
  "type": "object",
  "properties": {
    "overall_seo_health_score": { "type": "integer", "description": "Overall SEO health score out of 100 based on metrics" },
    "summary": { "type": "string", "description": "High-level markdown summary" },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "category": { "enum": ["SEO structure", "Messaging clarity", "CTA usage", "Content depth", "UX/structural concerns"] },
          "observation": { "type": "string" },
          "impact": { "type": "string" },
          "grounding": { "type": "array", "items": { "$ref": "#/definitions/GroundingSource" } }
        },
        "required": ["category", "observation", "impact", "grounding"]
      }
    },
    "recommendations": {
      "type": "array",
      "minItems": 3,
      "maxItems": 5,
      "items": {
        "type": "object",
        "properties": {
          "priority": { "type": "integer" },
          "title": { "type": "string" },
          "details": { "type": "string" },
          "expected_outcome": { "type": "string" },
          "confidence_score": { "type": "number" },
          "grounding": { "type": "array", "items": { "$ref": "#/definitions/GroundingSource" } }
        },
        "required": ["priority", "title", "details", "expected_outcome", "confidence_score", "grounding"]
      }
    }
  },
  "required": ["overall_seo_health_score", "summary", "findings", "recommendations"]
}
```

## 4. Raw Model Output

Because we use `instructor`, the raw model output comes back as a strictly formatted JSON object matching the requested schema.

```json
{
  "overall_seo_health_score": 42,
  "summary": "The page suffers from severe structural SEO issues (missing H1 and meta tags) and poor accessibility (low alt-text coverage). However, the word count suggests sufficient content depth if restructured correctly.",
  "findings": [
    {
      "category": "SEO structure",
      "observation": "The page is completely missing an H1 tag and essential meta tags (title and description).",
      "impact": "Search engines will struggle to understand the primary topic of the page, drastically reducing organic ranking potential.",
      "grounding": [
        { "metric_name": "h1_count", "metric_value": "0" },
        { "metric_name": "meta_title", "metric_value": "None" }
      ]
    },
    {
      "category": "UX/structural concerns",
      "observation": "Significant accessibility issues with images.",
      "impact": "Users relying on screen readers cannot understand image context, and image SEO is hindered.",
      "grounding": [
        { "metric_name": "alt_text_coverage_pct", "metric_value": "33.3%" }
      ]
    },
    {
      "category": "CTA usage",
      "observation": "Very low number of actionable CTAs for a page of this length.",
      "impact": "Reduces conversion rate as users have to scroll extensively to find an interaction point.",
      "grounding": [
        { "metric_name": "cta_count", "metric_value": "1" },
        { "metric_name": "word_count", "metric_value": "1205" }
      ]
    }
  ],
  "recommendations": [
    {
      "priority": 1,
      "title": "Add Missing Meta Tags and H1 Heading",
      "details": "1. Write a compelling `meta_title` under 60 characters.\n2. Write a `meta_description` under 160 characters summarizing the page.\n3. Wrap the main title of the page in an `<h1>` tag instead of the current `<h2>`.",
      "expected_outcome": "Immediate improvement in search engine indexability and higher click-through rates from search results.",
      "confidence_score": 1.0,
      "grounding": [
        { "metric_name": "meta_title", "metric_value": "None" },
        { "metric_name": "h1_count", "metric_value": "0" }
      ]
    },
    {
      "priority": 2,
      "title": "Fix Missing Image Alt Text",
      "details": "Review the 10 images currently missing alt text. Add descriptive, keyword-rich (but natural) `alt` attributes to each `<img>` tag.",
      "expected_outcome": "Improved web accessibility compliance and potential for ranking in Google Images.",
      "confidence_score": 0.95,
      "grounding": [
        { "metric_name": "images_without_alt", "metric_value": "10" }
      ]
    },
    {
      "priority": 2,
      "title": "Increase Call-To-Action Frequency",
      "details": "Given the 1200+ word count, a single CTA is insufficient. Distribute at least 2-3 additional CTAs throughout the content, ideally after key value propositions.",
      "expected_outcome": "Higher conversion rates by providing users with action steps exactly when they are convinced.",
      "confidence_score": 0.85,
      "grounding": [
        { "metric_name": "cta_count", "metric_value": "1" },
        { "metric_name": "word_count", "metric_value": "1205" }
      ]
    }
  ]
}
```
