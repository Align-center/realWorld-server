# 0006 — Characterization Tests First (Hybrid Migration Strategy)

**Date:** 2026-10-14  
**Status:** Accepted

## Context

The codebase has **zero test coverage**. Any refactoring risks silent regressions. The modernization kata (Étape 1–4) requires a migration strategy that guarantees **0 regression** while incrementally replacing the shallow architecture (controllers + fat models) with deep modules.

Two migration extremes:
1. **Big Bang** — write all modules + tests, swap in one PR — high risk, hard to review
2. **Strangler Fig** — route-by-route, characterization test → unit test → swap — lower risk, measurable progress

The spec mandates: "Hybrid: characterization tests → unit tests → incremental handler swap (per module)."

## Decision

**Hybrid migration per module** — three phases, gated by characterization tests:

### Phase 1: Characterization Tests (HTTP — Supertest)
- **Scope**: All existing endpoints for the target module (e.g., `/api/articles/*`, `/api/users/*`, `/api/profiles/*`, `/api/articles/:slug/comments`)
- **Fixture**: `mongodb-memory-server` — fresh seeded DB per test file
- **Criterion**: 100% endpoint coverage (status codes, response shapes, error cases)
- **Lock**: These tests **must pass before any refactoring** in that module begins
- **Output**: `tests/characterization/article.http.test.ts`, `tests/characterization/auth.http.test.ts`, etc.

```typescript
// Example: characterization test for GET /api/articles
describe('Article endpoints (characterization)', () => {
  beforeAll(async () => { await seedTestDb(); });
  afterAll(async () => { await stopMongo(); });

  it('GET /api/articles returns paginated list with articleCount', async () => {
    const res = await request(app).get('/api/articles').expect(200);
    expect(res.body).toHaveProperty('articles');
    expect(Array.isArray(res.body.articles)).toBe(true);
    expect(res.body).toHaveProperty('articlesCount');
    expect(typeof res.body.articlesCount).toBe('number');
  });
});
```

### Phase 2: Unit Tests (Module — Vitest)
- **Scope**: Each deep module's public methods (`ArticleModule.create`, `getBySlug`, `getList`, `getFeed`, `update`, `delete`, `favorite`, `unfavorite`, `addComment`)
- **Adapter**: `mongodb-memory-server` (real Mongo, no mocks) — local-substitutable
- **Assertions**: DTO shapes, filter logic, authorization, cross-entity invariants (favorite count, comment linking)
- **Speed**: < 500ms per test file

### Phase 3: Incremental Handler Swap
- **One handler at a time**: Replace controller logic with `module.method()` call
- **Characterization tests stay green** — they are the safety net
- **Delete controller code** once all handlers migrated — "deletion test passes" (ADR-0002)
- **Repeat per module**: Auth → Article → Profile → Comment → Middleware

## Consequences

### Positive

- **Regression guarantee**: Characterization tests lock current behavior before any change
- **Incremental PRs**: Each handler swap is a small, reviewable PR with green tests
- **Measurable progress**: Characterization coverage % → unit coverage % → handlers migrated %
- **Local-substitutable DB**: `mongodb-memory-server` = real Mongo, no mocks, hermetic, fast
- **Module deletion test**: When all handlers swapped, remove controller → verify characterization tests still pass (proves module fully replaces controller)

### Negative

- **Upfront investment**: Characterization tests for all endpoints before first refactor
- **Test maintenance**: Characterization tests may need updates if API contract intentionally changes
- **Dual test suites**: Characterization (HTTP) + Unit (module) — but they serve different purposes

### Mitigations

- **Seed once, reuse**: Shared `seedTestDb()` with realistic corpus (50 articles, 10 users, tags, favorites, comments)
- **Auto-generate characterization tests**: Script to hit endpoints and snapshot responses (future enhancement)
- **CI gate**: `npm run test:characterization` must pass before merge — enforced in pipeline

## Alternatives Considered

| Option | Why Rejected |
|--------|--------------|
| Big Bang rewrite | High risk; no safety net; hard to bisect regressions; all-or-nothing review |
| Unit tests only (no characterization) | Unit tests test new code; characterization tests lock old behavior — both needed |
| Mock-based unit tests (no DB) | Mongoose logic (populate, virtuals, middleware) not exercised; false confidence |
| E2E only (Cypress/Playwright) | Slow, flaky, no local-substitutable DB; doesn't isolate module logic |

## Related

- ADR-0001 (TypeScript) — Tests written in TypeScript, type-checked
- ADR-0002 (Single Deep ArticleModule) — Characterization tests target module seam after swap
- ADR-0003 (DTOs at seam) — Characterization tests assert on DTO shapes (stable contract)
- ADR-0004 (TokenPort) — `InMemoryTokenAdapter` makes auth characterization tests deterministic
- ADR-0005 (Manual DI) — Test wiring mirrors production wiring with test adapters
- CONTEXT.md — `ArticleModule`, `AuthModule`, `ProfileModule`, `CommentModule` interfaces canonized
- Spec: Testing Decisions — Characterization Tests (HTTP), Unit Tests (Module), Metrics (CI)