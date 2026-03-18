   # ADR-006: Drupal CMS for Content

   **Status:** Accepted
   **Date:** 2026-01-15
   **Author:** Eric Haywood
   **Heady Systems Inc. — Sacred Geometry v4.0**

   ## Problem

   How to manage structured content across 9 websites

   ## Decision

   Drupal 10 with 13 custom content types and VectorIndexer webhook

   ## Consequences

- 13 content types: article, documentation, case_study, patent, event, grant_program,
  agent_listing, investor_update, testimonial, faq, product_catalog, news_release, media_asset
- Headless API: JSON:API for frontend consumption
- VectorIndexer webhook fires on create/update/delete to maintain vector memory sync
- Drupal handles editorial workflow, access control, and content versioning
- Trade-off: Heavier than headless CMS, but Eric Haywood has deep Drupal expertise

   ---
   *© 2026 HeadySystems Inc. — 51 Provisional Patents*
