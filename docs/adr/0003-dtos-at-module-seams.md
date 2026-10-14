# 0003 — DTOs at Module Seam (Not Mongoose Documents)

**Date:** 2026-10-13  
**Status:** Accepted

## Context

`ArticleModule` (ADR-0002) defines the external seam for Article operations. The question: what crosses this seam?

Current code returns Mongoose documents with virtuals/populates from `Article.toArticleResponse()`. This leaks:
- Mongoose-specific types (`Document`, `Query`, virtual getters)
- Hydration strategy (populate vs manual fetch) into callers
- ORM coupling into tests (tests would need Mongoose to assert)

## Decision

**Module interface consumes/returns plain DTOs (TypeScript interfaces), never Mongoose documents.**

- **Inputs**: `CreateArticleInput`, `UpdateArticleInput`, `ArticleFilter` — plain objects
- **Outputs**: `ArticleDTO`, `ProfileDTO` — plain objects, serializable, no methods
- **Internal**: Mongoose used freely; mapping happens at the seam boundary

```typescript
// At the seam — callers see this:
interface ArticleDTO {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: Date;
  updatedAt: Date;
  favorited: boolean;
  favoritesCount: number;
  author: ProfileDTO;
}

// Internally — module does this:
const doc = await ArticleModel.findOne({ slug }).populate('author').exec();
return mapToDTO(doc, viewerId);  // mapping logic hidden inside module
```

## Consequences

### Positive
- **Seam integrity**: Callers (controllers, tests, other modules) depend on stable DTO shapes, not Mongoose internals
- **Testability**: Unit tests assert on `ArticleDTO` — no Mongoose needed, fast, deterministic
- **Swapability**: Could replace Mongoose with Prisma/SQL/REST without changing callers
- **Type coverage**: `type-coverage` metric (Étape 4) measures DTO coverage, not ORM leakage

### Negative
- **Mapping boilerplate**: Every query result → DTO transformation
- **Performance**: Extra object creation (negligible at this scale)
- **Drift risk**: DTO must stay in sync with Mongoose schema

### Mitigations
- Single `mapToDTO(doc, viewerId)` function per module — localized, testable
- DTOs defined in `src/modules/article/types.ts` — single source of truth
- TypeScript catches drift at compile time

## Alternatives Considered

| Option | Why Rejected |
|--------|--------------|
| Return Mongoose docs (with `lean()`) | Still leaks `_id` vs `id`, virtual getters, Mongoose types. Tests need Mongoose. |
| Return Mongoose docs + virtuals | `toArticleResponse()` *is* a virtual — but it calls `User.findById` (N+1). Virtuals can't be async. |
| GraphQL-style resolver map | Over-engineering; REST endpoints map 1:1 to DTOs |

## Related

- ADR-0001 (TypeScript) — DTOs are TypeScript interfaces
- ADR-0002 (single ArticleModule) — the seam that DTOs protect
- CONTEXT.md — DTO shapes canonized in glossary