# Heady™ Common Crawl Policy
# Version: 1.0.0 | Updated: 2026-03-15

## Status: RESEARCH ONLY

Common Crawl is an open corpus maintained by a nonprofit — but **open availability ≠ clear commercial training rights**.

## Rules

### ✅ Allowed
- Internal research and tooling experiments
- Benchmarking retrieval pipelines
- Testing embedding quality against large corpora
- Academic-style analysis and reporting

### ❌ Not Cleared
- Commercial model fine-tuning without rights filtering
- Public-facing content generation from crawled data
- Using crawled content that includes personal data without consent
- Redistributing filtered subsets as Heady products

## Risk Factors
1. **Copyright**: Crawled pages retain original copyright — CC0/PD filter required
2. **Privacy**: Contains personal data — GDPR/CCPA implications
3. **ToS violations**: Some crawled content was behind ToS restrictions
4. **Quality**: No content quality guarantee — noise filtering essential

## If We Need Common Crawl for Training
1. Apply CC0/PD license filter first
2. Remove personally identifiable information (PII)
3. Document provenance chain for every document
4. Legal review before any commercial deployment
