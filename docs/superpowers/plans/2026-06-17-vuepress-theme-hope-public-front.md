# VuePress Theme Hope 公网前台迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `apps/web` with a `vuepress-theme-hope` public reading site and export published backend content into Markdown files.

**Architecture:** Keep `apps/admin` as the only editor and `apps/api` as the source of truth. Add a filesystem export service in the backend that rebuilds managed Markdown content under the VuePress site after admin-side content changes.

**Tech Stack:** Spring Boot 3, Java 21, MyBatis Plus, JUnit 5, VuePress 2, `vuepress-theme-hope`, npm.

---

## File Structure

```text
apps/
  api/
    src/main/java/cn/zhaoge/interview/export/
    src/test/java/cn/zhaoge/interview/export/
    src/main/resources/application.yml
  web/
    legacy-next/
    package.json
    src/
      README.md
      topics/
      questions/
      journey/
      .vuepress/
docs/
  superpowers/
    specs/2026-06-17-vuepress-theme-hope-public-front-design.md
    plans/2026-06-17-vuepress-theme-hope-public-front.md
```

## Task 1: Add backend export service with tests

**Files:**
- Create: `apps/api/src/main/java/cn/zhaoge/interview/export/ContentExportProperties.java`
- Create: `apps/api/src/main/java/cn/zhaoge/interview/export/PublishedSiteExporter.java`
- Create: `apps/api/src/test/java/cn/zhaoge/interview/export/PublishedSiteExporterTests.java`
- Modify: `apps/api/src/main/resources/application.yml`

- [ ] Write failing tests for topic, question, note export.
- [ ] Implement output path resolution and managed directory cleanup.
- [ ] Implement published topic/question/note Markdown generation.
- [ ] Re-run exporter tests until all pass.

## Task 2: Trigger export from admin-side content mutations

**Files:**
- Modify: `apps/api/src/main/java/cn/zhaoge/interview/topic/TopicService.java`
- Modify: `apps/api/src/main/java/cn/zhaoge/interview/question/QuestionService.java`
- Modify: `apps/api/src/main/java/cn/zhaoge/interview/note/PersonalNoteService.java`

- [ ] Write failing integration-style tests or extend exporter tests to cover status transitions.
- [ ] Trigger full export after create, update, and status changes.
- [ ] Make export failure abort the mutation.
- [ ] Re-run backend test suite.

## Task 3: Replace `apps/web` runtime with VuePress Theme Hope

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/README.md`
- Create: `apps/web/src/topics/README.md`
- Create: `apps/web/src/questions/README.md`
- Create: `apps/web/src/journey/README.md`
- Create: `apps/web/src/.vuepress/config.ts`
- Create: `apps/web/src/.vuepress/navbar.ts`
- Create: `apps/web/src/.vuepress/sidebar.ts`
- Create: `apps/web/src/.vuepress/theme.ts`
- Create: `apps/web/src/.vuepress/styles/palette.scss`
- Create: `apps/web/src/.vuepress/styles/config.scss`
- Create: `apps/web/src/.vuepress/styles/index.scss`

- [ ] Archive old Next.js source to `apps/web/legacy-next`.
- [ ] Add VuePress scripts and dependencies.
- [ ] Create home page, list pages, and theme configuration.
- [ ] Build the site and fix any config/runtime issues.

## Task 4: Validate end-to-end local workflow

**Files:**
- Modify if needed: `docs/architecture.md`
- Modify if needed: `README.md`

- [ ] Run backend tests.
- [ ] Run `npm install` and `npm run build` in `apps/web`.
- [ ] Verify exported Markdown files exist for seeded published content.
- [ ] Document the new local workflow and caveats.
