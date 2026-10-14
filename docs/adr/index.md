# Architecture Decision Records (ADRs) Index

> **Navigation**: Each ADR documents a hard-to-reverse architectural decision. Read in order for the full narrative.

---

## Table of Contents

| # | Title | Status | Date | Summary |
|---|-------|--------|------|---------|
| [0001](./0001-typescript-strict-mode.md) | TypeScript with Strict Mode | Accepted | 2026-10-13 | Adopt TypeScript `strict: true` from day one; ES2022, NodeNext, `tsx watch` dev, `tsc` build |
| [0002](./0002-single-deep-articlemodule.md) | Single Deep ArticleModule (Not Repository + Service) | Accepted | 2026-10-13 | One deep `ArticleModule` with 9 methods hides all query logic; no internal Repository/Service split |
| [0003](./0003-dtos-at-module-seams.md) | DTOs at Module Seams (Not Mongoose Documents) | Accepted | 2026-10-13 | Module interfaces consume/return plain DTOs (`ArticleDTO`, `ProfileDTO`); Mongoose stays internal |
| [0004](./0004-tokenport-for-auth.md) | TokenPort for Auth (JwtAdapter / InMemoryTokenAdapter) | Accepted | 2026-10-14 | `TokenPort` interface with `JwtAdapter` (prod) and `InMemoryTokenAdapter` (tests); auth logic in `AuthModule` |
| [0005](./0005-manual-di.md) | Manual DI Wiring (No Container) | Accepted | 2026-10-14 | Pure constructor injection in `api/index.ts`; no decorators, no container, explicit object graph |
| [0006](./0006-characterization-tests-first.md) | Characterization Tests First (Hybrid Migration) | Accepted | 2026-10-14 | Hybrid: HTTP characterization tests → unit tests → incremental handler swap per module |

---

## Reading Guide

### For New Contributors
Start with **ADR-0001** (language foundation), then **ADR-0002** (module pattern), **ADR-0003** (seam discipline). These three establish the "deep module" architecture used by all domain modules.

### For Auth Work
Read **ADR-0004** (TokenPort) → **ADR-0005** (Manual DI wiring) → **ADR-0006** (migration strategy for AuthModule).

### For Article/Profile/Comment Work
Read **ADR-0002** → **ADR-0003** → **ADR-0006** (migration strategy per module).

### For Testing
Read **ADR-0006** first — it explains the three-phase test strategy that gates all refactoring.

---

## ADR Format

Each ADR follows the standard structure:

```
# NNNN — Title

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded | Deprecated

## Context
What is the architectural question? What constraints exist?

## Decision
What was chosen? Show code/interfaces where helpful.

## Consequences
### Positive
### Negative
### Mitigations

## Alternatives Considered
| Option | Why Rejected |

## Related
Links to other ADRs, CONTEXT.md entries, spec stories.
```

---

## Domain Vocabulary

All ADRs use canonical terms from [CONTEXT.md](../CONTEXT.md):

| Term | Meaning |
|------|---------|
| **Module** | Deep module (e.g., `ArticleModule`) — single external seam, large implementation |
| **Interface** | TypeScript `interface` defining the module's public contract |
| **Seam** | Boundary where dependencies cross (e.g., `TokenPort`) |
| **Adapter** | Implementation of a port (e.g., `JwtAdapter`, `InMemoryTokenAdapter`) |
| **DTO** | Data Transfer Object — plain serializable interface at seams |
| **Depth** | Large implementation behind small interface (leverage) |
| **Locality** | Related logic co-located in one module |

**Forbidden synonyms**: "service", "component", "API", "boundary", "repository" (unless extracted as port), "post", "account", "feed".

---

## Status Legend

- **Accepted** — Decision made, implemented or in progress
- **Proposed** — Under review, not yet implemented
- **Superseded** — Replaced by a later ADR (link in Related)
- **Deprecated** — No longer relevant, kept for history

---

## Contributing

When a new decision meets **all three criteria**:

1. **Hard to reverse** (changing it later requires significant refactoring)
2. **Surprising without context** (future maintainer would ask "why?")
3. **Genuine trade-off** (reasonable alternatives existed)

→ Create `docs/adr/NNNN-kebab-case-title.md` with the next sequential number.

Update this `index.md` with the new entry in the table above.

---

## Quick Links

- [CONTEXT.md](../CONTEXT.md) — Domain glossary, entities, DTOs, ports, forbidden synonyms
- [spec-full-modernization.md](../spec-full-modernization.md) — Full modernization spec with user stories, decisions, phasing
- [architecture-review.md](../architecture-review.md) — Initial architectural friction analysis