# 0004 — TokenPort for Auth (JwtAdapter / InMemoryTokenAdapter)

**Date:** 2026-10-14  
**Status:** Accepted

## Context

The `User` model currently embeds JWT token generation via `generateAccessToken()` (Mongoose instance method) and `toUserResponse()` which calls it. This couples authentication logic to the persistence layer:

- Controllers call `user.toUserResponse()` which internally uses `jsonwebtoken` with `process.env.ACCESS_TOKEN_SECRET`
- Tests would need real crypto and environment setup to verify auth flows
- The `verifyJWT` middleware directly imports `jsonwebtoken` — no seam for substitution
- Password hashing (bcrypt) also lives in controllers, not encapsulated

The spec (Étape 1–4) requires an `AuthModule` with a `TokenPort` seam so that token generation/verification is testable without crypto.

## Decision

Introduce a **TokenPort** interface with two adapters:

```typescript
// Port (src/modules/auth/ports/token.port.ts)
interface TokenPort {
  sign(payload: TokenPayload): string;
  verify(token: string): TokenPayload | null;
}

// Production adapter (src/modules/auth/adapters/jwt.adapter.ts)
class JwtAdapter implements TokenPort {
  sign(payload: TokenPayload): string {
    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET!, { expiresIn: '1d' });
  }
  verify(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as TokenPayload;
    } catch { return null; }
  }
}

// Test adapter (src/modules/auth/adapters/in-memory-token.adapter.ts)
class InMemoryTokenAdapter implements TokenPort {
  private store = new Map<string, TokenPayload>();
  sign(payload: TokenPayload): string {
    const token = `test-token-${Date.now()}-${Math.random()}`;
    this.store.set(token, payload);
    return token;
  }
  verify(token: string): TokenPayload | null {
    return this.store.get(token) ?? null;
  }
}
```

`AuthModule` receives `TokenPort` via constructor (manual DI). Controllers depend on `AuthModule` interface, not `User` model methods. Password hashing moves into `AuthModule` (bcrypt encapsulated).

## Consequences

### Positive

- **Testability**: `InMemoryTokenAdapter` — deterministic, no crypto, no env vars, fast
- **Seam integrity**: `AuthModule` interface consumes/returns `UserDTO` (includes `token: string`), never leaks `jsonwebtoken` types
- **Swapability**: Could replace JWT with PASETO/Opaque tokens without changing callers
- **Single responsibility**: Auth logic (register, login, getCurrentUser, updateUser) localised in `AuthModule`

### Negative

- **Adapter boilerplate**: Two adapter classes + port interface
- **Indirection**: Controllers → AuthModule → TokenPort vs direct `user.generateAccessToken()`

### Mitigations

- Port + adapters live in `src/modules/auth/` — co-located, single directory
- `InMemoryTokenAdapter` is ~20 lines — minimal overhead
- Manual DI in `api/index.ts` makes wiring explicit: `new AuthModule(UserModel, new JwtAdapter())`

## Alternatives Considered

| Option | Why Rejected |
|--------|--------------|
| Keep `generateAccessToken()` on User model | Couples persistence to crypto; tests need Mongoose + real JWT; no seam |
| `verifyJWT` middleware imports `jsonwebtoken` directly | No substitution for tests; duplication with `verifyJWTOptional` |
| DI container (Inversify, TSyringe) | Overhead not justified; manual wiring is 5 lines in `api/index.ts` |

## Related

- ADR-0001 (TypeScript) — `TokenPort` is a TypeScript interface
- ADR-0003 (DTOs at seam) — `AuthModule` returns `UserDTO` with `token: string`
- ADR-0005 (Manual DI) — `AuthModule` wired with `TokenPort` in `api/index.ts`
- CONTEXT.md — `TokenPort`, `JwtAdapter`, `InMemoryTokenAdapter`, `UserDTO` canonized
- Spec: AuthModule user stories (register, login, getCurrentUser, updateUser)