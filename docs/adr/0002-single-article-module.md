# 0002 — Single Deep ArticleModule (Not Repository + Service Split)

**Date:** 2026-10-13  
**Status:** Accepted

## Context

The architecture review identifies `Article` as the top candidate for deepening. The current shallow design spreads query logic across `Article` model methods (`toArticleResponse`, `updateFavoriteCount`, `addComment`, `removeComment`) and `articlesController` (8 handlers, ~280 lines). The N+1 problem (author fetch per article) lives here.

Two design paths:
1. **Single `ArticleModule`** — one interface, ~8 methods, hides all query logic
2. **`ArticleRepository` + `ArticleService`** — Repository = data access, Service = domain logic (transactions, coordination)

## Decision

**Single `ArticleModule`** — one deep module, one external seam.

- Interface: `create`, `getBySlug`, `getList`, `getFeed`, `update`, `delete`, `favorite`, `unfavorite`, `addComment`
- Implementation: uses Mongoose models directly (local-substitutable via `mongodb-memory-server`)
- No internal `Repository`/`Service` split — not yet justified

## Consequences

### Positive
- **Depth**: Large implementation behind small interface (leverage for callers, locality for maintainers)
- **Deletion test passes**: Remove `ArticleModule` → all Article query logic vanishes (concentrated, not spread)
- **Seam discipline**: One external seam = one adapter needed for tests (`mongodb-memory-server` = real Mongo, zero adapter code)
- **No hypothetical seams**: "One adapter = hypothetical, two = real" — we have one production adapter (Mongoose) and one test adapter (in-memory Mongo). That's two real adapters at the *external* seam. No internal seam needed.

### Negative
- Module grows larger (~200-300 lines) — but depth is about interface size, not implementation size
- Transaction logic (`favorite` updates User + Article) lives in module — acceptable for now
- If `CommentModule` needs Article queries later, potential duplication — extract `ArticleRepositoryPort` then

### Mitigation
- Keep module focused: only Article-centric operations. User-centric ops (profile, auth) stay in their modules.
- When a second adapter is needed (e.g., Postgres), extract `ArticleRepositoryPort` — not before.

## Alternatives Considered

| Option | Why Rejected |
|--------|--------------|
| Repository + Service | Adds internal seam with only one adapter (hypothetical). YAGNI. The "transaction" argument for Service is weak — `favorite` is the only cross-entity op, and it's article-triggered. |
| Keep model methods + thin controller | Current state — fails deletion test, N+1 persists, shallow interface |

## Related

- ADR-0001 (TypeScript) — enables the module interface to be typed and checked
- ADR-0003 (DTOs at seam) — `ArticleModule` returns DTOs, not Mongoose docs
- Future: if `ArticleRepositoryPort` extracted, new ADR