# 0001 — TypeScript with Strict Mode

**Date:** 2026-10-13  
**Status:** Accepted

## Context

The codebase is currently plain JavaScript (CommonJS). We are embarking on an AI-assisted refactoring kata (Étape 1–4) to demonstrate modernization while keeping it simple. The question: adopt TypeScript, and if so, how strict?

## Decision

Adopt **TypeScript with `strict: true`** from day one.

- Target: ES2022, NodeNext modules
- Output: `dist/` (compiled), source in `src/`
- Dev: `tsx watch` (no `ts-node`)
- Build: `tsc` (emits `dist/` + `.d.ts`)

## Consequences

### Positive
- Compile-time safety catches regressions tests miss (null checks, exhaustive switches, implicit any)
- AI-assisted refactoring works better with explicit types — the model "sees" the interface
- `type-coverage` metric (Étape 4) becomes meaningful
- JSDoc alternative rejected: drift between code and comments is invisible to compiler

### Negative
- Build step required (`npm run build` before `npm start`)
- Migration friction: existing `.js` files need renaming + type annotations
- `strictNullChecks` forces explicit handling of `undefined` (e.g., `req.userId`)

### Mitigations
- Incremental migration: `tsconfig.json` with `"allowJs": true`, `"checkJs": false` — convert file by file
- `// @ts-expect-error` allowed temporarily during migration, tracked in PRs
- Dev script (`tsx watch`) skips type-checking for fast feedback; `npm run build` is the gate

## Alternatives Considered

| Option | Why Rejected |
|--------|--------------|
| Plain JS + JSDoc | Type drift undetectable; no `type-coverage` metric; AI tooling weaker |
| TypeScript `strict: false` | Defeats the purpose; implicit `any` hides the bugs we want caught |
| No TypeScript | Kata loses "modernize with types" demonstration value |

## Related

- ADR-0002 (single ArticleModule) — TypeScript enables the deep module interface to be expressed and checked
- ADR-0003 (DTOs at seam) — DTOs are TypeScript interfaces