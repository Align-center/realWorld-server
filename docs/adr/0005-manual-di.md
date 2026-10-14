# 0005 — Manual DI Wiring (No Container)

**Date:** 2026-10-14  
**Status:** Accepted

## Context

The codebase has implicit dependencies: controllers `require()` models directly, middleware imports `jsonwebtoken`, and `User` model has `generateAccessToken()` calling `jwt.sign()`. As we introduce deep modules (`AuthModule`, `ArticleModule`, `ProfileModule`, `CommentModule`) with explicit ports (`TokenPort`), we need a composition root to wire dependencies.

Options:
1. **DI Container** (Inversify, TSyringe, NestJS-style) — decorators, metadata, runtime resolution
2. **Manual DI** — pure TypeScript, `new Module(DepA, DepB)` in a single file
3. **Service Locator** — global registry, `container.get('AuthModule')`

The spec mandates: "Manual DI wiring in `api/index.ts` (no container), so that dependencies are explicit and testable."

## Decision

**Manual constructor injection in `api/index.ts`** — the composition root.

```typescript
// api/index.ts (simplified)
import { ArticleModule } from '../modules/article/article.module';
import { AuthModule } from '../modules/auth/auth.module';
import { ProfileModule } from '../modules/profile/profile.module';
import { CommentModule } from '../modules/comment/comment.module';
import { JwtAdapter } from '../modules/auth/adapters/jwt.adapter';
import ArticleModel from '../models/Article';
import UserModel from '../models/User';
import CommentModel from '../models/Comment';

const tokenPort = new JwtAdapter();
const authModule = new AuthModule(UserModel, tokenPort);
const articleModule = new ArticleModule(ArticleModel, UserModel, CommentModel);
const profileModule = new ProfileModule(UserModel);
const commentModule = new CommentModule(CommentModel, ArticleModel, UserModel);

// Controllers receive modules via factory or direct import
// Routes receive controllers
```

Each module's constructor declares its dependencies explicitly. No decorators, no metadata, no reflection.

## Consequences

### Positive

- **Explicit dependencies**: Reading `api/index.ts` shows the full object graph — no hidden wiring
- **Testability**: Tests construct modules with real or test adapters directly: `new ArticleModule(ArticleModel, UserModel, CommentModel)` or `new AuthModule(UserModel, new InMemoryTokenAdapter())`
- **Zero runtime overhead**: No container bootstrap, no reflection, no decoration — plain `new`
- **Type-safe**: TypeScript checks constructor signatures at compile time
- **Locality**: Wiring lives in one file (~30 lines), not scattered across decorators

### Negative

- **Manual updates**: Adding a dependency means editing `api/index.ts` and the module's constructor
- **No auto-wiring**: Cannot `@Inject()` — but this is a feature, not a bug (explicit > implicit)
- **Circular dependency risk**: Manual wiring makes cycles visible at compose time (fail fast)

### Mitigations

- Module constructors stay stable — ports (`TokenPort`) rarely change; models are stable
- Test files wire their own graphs — no shared test container needed
- If wiring grows complex, extract `createModules()` factory — still manual, just factored

## Alternatives Considered

| Option | Why Rejected |
|--------|--------------|
| Inversify / TSyringe | Decorators + metadata + container bootstrap = ~500 lines vs 30 lines manual; reflection defeats tree-shaking |
| NestJS-style module system | Framework lock-in; overkill for Express + 4 modules |
| Service Locator (`container.get()`) | Hides dependencies; runtime resolution errors vs compile-time; global state |

## Related

- ADR-0002 (Single Deep ArticleModule) — `ArticleModule` receives models via constructor
- ADR-0003 (DTOs at Module Seams) — Modules return DTOs; wiring doesn't leak internals
- ADR-0004 (TokenPort) — `AuthModule` wired with `JwtAdapter` / `InMemoryTokenAdapter`
- CONTEXT.md — `module`, `interface`, `seam`, `adapter` vocabulary; manual DI is the composition pattern
- Spec: Cross-cutting decision #17 — "Manual DI wiring in `api/index.ts` (no container)"