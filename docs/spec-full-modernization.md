## Problem Statement

The realWorld-server codebase is a classic Express + Mongoose + JWT implementation of the RealWorld spec. Over time it has accumulated **architectural friction**:

- **Shallow modules**: Controllers (280+ lines) orchestrate queries; models expose instance methods that leak ORM and create N+1 queries
- **No type safety**: Plain JavaScript — refactoring is risky, AI-assisted tools can't leverage types
- **Fat models**: `User.js` mixes token generation (external dependency), response shaping, social graph, and favourites — hard to test
- **Duplicated middleware**: `verifyJWT` + `verifyJWTOptional` share 90% code
- **No test coverage**: Zero tests — any change risks regression
- **Implicit seams**: Routes/controllers/models coupled by `require()`, no interfaces

The goal: **modernize the entire codebase** with TypeScript, deep modules, characterization tests, and measurable quality gates — demonstrating an AI-assisted refactoring kata (Étape 1–4).

---

## Solution

Apply **deepening** across the codebase in phases, each behind a safety net of characterization tests:

1. **Foundation**: TypeScript strict mode, CI pipeline, test infrastructure
2. **AuthModule**: Extract auth logic from User model, introduce `TokenPort` seam
3. **ArticleModule**: Deep module with DTOs, eliminate N+1, incremental migration
4. **ProfileModule**: Profile view + social actions (follow/unfollow)
5. **CommentModule**: Transactional comment + article coordination
6. **AuthMiddleware**: Unify verifyJWT/verifyJWTOptional
7. **Validation**: Metrics dashboard in CI (complexity, coverage, type coverage)

Each phase: characterization tests → unit tests → incremental swap → metrics.

---

## User Stories

### Foundation
1. As a **developer**, I want TypeScript with `strict: true`, so that the codebase has **compile-time safety** and AI tools can reason about types.
2. As a **developer**, I want a CI pipeline (`npm run build → npm test → metrics`), so that **Étape 4 metrics** are reported on every PR.
3. As a **developer**, I want `mongodb-memory-server` + Vitest + Supertest, so that tests are **fast, hermetic, and local-substitutable**.
4. As a **developer**, I want `eslint-complexity` + `c8` + `type-coverage` in CI, so that **cyclomatic complexity, coverage, and type coverage** are tracked.

### AuthModule
5. As a **developer**, I want an `AuthModule` with `register`, `login`, `getCurrentUser`, `updateUser`, so that **auth logic has locality** (one module).
6. As a **developer**, I want a `TokenPort` interface with `JwtAdapter` (prod) and `InMemoryTokenAdapter` (tests), so that **token generation is testable without crypto**.
7. As a **developer**, I want password hashing (bcrypt) encapsulated in `AuthModule`, so that controllers don't touch crypto.

### ArticleModule
8. As a **developer**, I want a single deep `ArticleModule` with 9 methods (`create`, `getBySlug`, `getList`, `getFeed`, `update`, `delete`, `favorite`, `unfavorite`, `addComment`), so that **all article query logic has locality**.
9. As a **developer**, I want `ArticleModule.getList()` to return hydrated `ArticleDTO[]` in **one query via `populate()`**, so that **N+1 is eliminated**.
10. As a **developer**, I want `ArticleModule` to return **plain DTOs** (`ArticleDTO`, `ProfileDTO`), so that **callers are decoupled from Mongoose**.
11. As a **developer**, I want to **migrate incrementally** (handler by handler) behind characterization tests, so that **0 regression** is guaranteed.

### ProfileModule
12. As a **developer**, I want a `ProfileModule` with `getProfile`, `follow`, `unfollow`, so that **profile + social logic has locality**.
13. As a **developer**, I want `ProfileDTO` with `following` (relative to viewer), so that **profile responses are consistent** with ArticleDTO author.

### CommentModule
14. As a **developer**, I want a `CommentModule` with `addComment`, `getComments`, `deleteComment`, so that **Article+Comment transaction logic has locality**.
15. As a **developer**, I want comments returned as `CommentDTO` with `author: ProfileDTO`, so that **comment responses match article author shape**.

### AuthMiddleware
16. As a **developer**, I want a single `AuthMiddleware` with `required()` and `optional()` modes, so that **duplication is eliminated** and the seam is explicit.

### Cross-cutting
17. As a **developer**, I want **manual DI wiring** in `api/index.ts` (no container), so that **dependencies are explicit and testable**.
18. As a **developer**, I want **typed `AppError` subclasses** (`NotFoundError`, `ForbiddenError`, `ValidationError`), so that **error handling is consistent** across modules.
19. As a **developer**, I want **ADRs** documenting each hard-to-reverse decision, so that **future reviewers understand trade-offs**.

---

## Implementation Decisions

| Area | Decision |
|------|----------|
| **Language** | TypeScript, `strict: true`, ES2022, NodeNext, `src/` → `dist/` |
| **Dev/Build** | `tsx watch` (dev), `tsc` (build), `npm start` runs `dist/api/index.js` |
| **Test framework** | Vitest (unit), Supertest (HTTP characterization) |
| **Test DB** | `mongodb-memory-server` (fresh seed per run) |
| **Module pattern** | Single deep module per domain (Article, Auth, Profile, Comment) — no Repository/Service split unless 2nd adapter needed |
| **Seams** | `TokenPort` (auth), `ArticleModule`/`ProfileModule`/`CommentModule` interfaces — DTOs at every seam |
| **DTOs** | `ArticleDTO`, `ProfileDTO`, `UserDTO`, `CommentDTO`, `CreateArticleInput`, `UpdateArticleInput`, `ArticleFilter` |
| **Errors** | `AppError` base + `NotFoundError`/`ForbiddenError`/`ValidationError` subclasses |
| **DI** | Manual: `new ArticleModule(ArticleModel, UserModel, CommentModel)` in `api/index.ts` |
| **Migration strategy** | Hybrid: characterization tests → unit tests → incremental handler swap (per module) |
| **Complexity gate** | Cyclomatic < 10 per function (soft gate, reported in PR) |
| **Coverage gate** | Line/branch > 90% on new modules (soft gate) |
| **Type coverage gate** | > 95% on `src/modules/**` (soft gate) |

---

## Testing Decisions

### Characterization Tests (HTTP — Supertest)
- **Scope**: All existing endpoints (auth, articles, profiles, comments, tags)
- **Fixtures**: Minimal seed per module + 1 realistic corpus (50 articles, 10 users, tags, favorites, comments)
- **Run**: Before any refactoring in a module — locks current behavior
- **Criterion**: 100% endpoint coverage (status codes, response shapes, error cases)

### Unit Tests (Module — Vitest)
- **Scope**: Each deep module's public methods
- **Adapter**: `mongodb-memory-server` (real Mongo, no mocks)
- **Assertions**: DTO shapes, filter logic, authorization, cross-entity invariants (favorite count, comment linking)
- **Speed**: < 500ms per test file

### Metrics (CI)
- **Cyclomatic complexity**: `eslint @stylistic/complexity` — per function, JSON output
- **Coverage**: `c8` — line, branch, function — JSON + lcov
- **Type coverage**: `type-coverage` — % of typed symbols — JSON
- **Reporting**: PR comment with before/after deltas

---

## Out of Scope

- Frontend / client changes
- Database schema migrations (Mongoose schemas stay compatible)
- GraphQL / API versioning / OpenAPI spec generation
- Deployment infrastructure (Vercel config stays)
- Hard CI gates (blocking merges) — soft reporting first
- Repository/Service splits (YAGNI — extract ports only when 2nd adapter justified)
- Container/DI framework (manual wiring sufficient)
- WebSocket / real-time features

---

## Further Notes

### ADRs to Create
1. **0001** — TypeScript with Strict Mode
2. **0002** — Single Deep ArticleModule (Not Repository + Service)
3. **0003** — DTOs at Module Seams
4. **0004** — TokenPort for Auth (JwtAdapter / InMemoryTokenAdapter)
5. **0005** — Manual DI (No Container)
6. **0006** — Characterization Tests First (Hybrid Migration)

### Domain Vocabulary (CONTEXT.md)
Canonical terms established: `Article`, `User`, `Comment`, `Profile`, `ArticleModule`, `AuthModule`, `ProfileModule`, `CommentModule`, `TokenPort`, `JwtAdapter`, `InMemoryTokenAdapter`, `ArticleDTO`, `ProfileDTO`, `UserDTO`, `CommentDTO`, `module`, `interface`, `seam`, `adapter`, `depth`, `leverage`, `locality`.

Forbidden: "post", "account", "service", "component", "API", "boundary", "boundary".

### Phasing (Suggested Order)
| Phase | Focus | Blocks |
|-------|-------|--------|
| 0 | Foundation (TS, CI, test infra) | All |
| 1 | AuthModule + TokenPort | ProfileModule (uses AuthModule for current user) |
| 2 | ArticleModule | CommentModule (uses ArticleModule for article lookup) |
| 3 | ProfileModule | — |
| 4 | CommentModule | — |
| 5 | AuthMiddleware unification | — |
| 6 | Metrics dashboard + ADR index | — |

### Ticket Structure (for `/to-tickets`)
Each module → tracer bullets with blocking edges:
- `foundation:typescript-setup` → blocks all
- `foundation:test-infra` → blocks all module tests
- `auth:token-port` → blocks `auth:auth-module`
- `auth:auth-module` → blocks `profile:profile-module`
- `article:characterization-tests` → blocks `article:unit-tests`
- `article:unit-tests` → blocks `article:migrate-getBySlug` → `article:migrate-getList` → …
- `profile:characterization-tests` → blocks `profile:unit-tests` → `profile:migrate`
- `comment:characterization-tests` → blocks `comment:unit-tests` → `comment:migrate`
- `middleware:unify-auth` → independent
- `ci:metrics-dashboard` → after foundation