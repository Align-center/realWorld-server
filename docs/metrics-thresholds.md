# Metrics Thresholds

This document defines the soft gate thresholds for code quality metrics reported in CI.

## Cyclomatic Complexity

- **Threshold**: < 10 per function
- **Tool**: ESLint with `complexity` rule
- **Output**: `metrics/complexity.json`
- **Action**: Report only (soft gate)

Functions with complexity ≥ 10 are flagged in the PR comment but do not block merges.

## Code Coverage

- **Threshold**: > 90% (lines, branches, functions, statements)
- **Tool**: c8 with Vitest
- **Output**: `metrics/coverage.json` and `coverage/lcov.info`
- **Action**: Report only (soft gate)

Coverage is measured on the full test suite. New modules should aim for > 90% coverage.

## Type Coverage

- **Threshold**: > 95%
- **Tool**: type-coverage
- **Output**: `metrics/type-coverage.json`
- **Action**: Report only (soft gate)

Type coverage measures the percentage of typed symbols in the codebase. Target is > 95% for `src/modules/**` (and related source directories).

## CI Pipeline

The CI pipeline runs on every PR and push to main:

1. **Build** - TypeScript compilation (`npm run build`)
2. **Test** - Unit and integration tests (`npm test`)
3. **Metrics** - Complexity, coverage, and type coverage collection

Metrics are uploaded as artifacts (30-day retention) and a summary comment is posted to PRs.

## Viewing Metrics

- **PR Comments**: Automatic comment with metrics summary on each PR
- **Artifacts**: Downloadable from GitHub Actions workflow run
- **Historical Tracking**: Artifacts retained for 30 days for trend analysis

## Improving Metrics

### Reducing Complexity
- Extract complex functions into smaller, focused functions
- Use early returns to reduce nesting
- Consider guard clauses instead of nested conditionals

### Improving Coverage
- Add tests for uncovered branches and functions
- Focus on business logic in controllers and models
- Test error paths and edge cases

### Improving Type Coverage
- Add explicit type annotations for function parameters and returns
- Avoid `any` type - use `unknown` or specific types
- Enable strict TypeScript options in `tsconfig.json`