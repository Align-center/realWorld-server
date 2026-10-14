import json

issues = [
    {"id": 27, "title": "25: Tags — Migrate GET /api/tags Handler", "blocked_by": ["01-foundation-typescript-setup", "02-foundation-test-infra"]},
    {"id": 26, "title": "24: ADRs — Index + 6 Architecture Decision Records", "blocked_by": ["01-foundation-typescript-setup"]},
    {"id": 25, "title": "23: CI — Metrics Dashboard (Complexity, Coverage, Type Coverage)", "blocked_by": ["01-foundation-typescript-setup", "02-foundation-test-infra"]},
    {"id": 24, "title": "22: Cross-cutting — Typed AppError Subclasses", "blocked_by": ["01-foundation-typescript-setup"]},
    {"id": 23, "title": "21: Cross-cutting — Manual DI Wiring in api/index.ts", "blocked_by": ["01-foundation-typescript-setup", "03-auth-token-port", "04-auth-auth-module", "07-article-migrate-getBySlug", "16-profile-migrate", "19-comment-migrate"]},
    {"id": 22, "title": "20: AuthMiddleware — Unify verifyJWT / verifyJWTOptional", "blocked_by": ["03-auth-token-port", "01-foundation-typescript-setup"]},
    {"id": 21, "title": "19: CommentModule — Migrate All Comment Handlers", "blocked_by": ["18-comment-unit-tests", "07-article-migrate-getBySlug"]},
    {"id": 20, "title": "18: CommentModule — Unit Tests (Public Methods)", "blocked_by": ["17-comment-characterization-tests"]},
    {"id": 19, "title": "17: CommentModule — HTTP Characterization Tests (All Comment Endpoints)", "blocked_by": ["02-foundation-test-infra", "05-article-characterization-tests"]},
    {"id": 18, "title": "16: ProfileModule — Migrate All Profile Handlers", "blocked_by": ["15-profile-unit-tests", "04-auth-auth-module"]},
    {"id": 17, "title": "15: ProfileModule — Unit Tests (Public Methods)", "blocked_by": ["14-profile-characterization-tests"]},
    {"id": 16, "title": "14: ProfileModule — HTTP Characterization Tests (All Profile Endpoints)", "blocked_by": ["02-foundation-test-infra", "04-auth-auth-module"]},
    {"id": 15, "title": "13: ArticleModule — Migrate Favorite/Unfavorite Handlers", "blocked_by": ["12-article-migrate-delete"]},
    {"id": 14, "title": "12: ArticleModule — Migrate DELETE /articles/:slug Handler", "blocked_by": ["11-article-migrate-update"]},
    {"id": 13, "title": "11: ArticleModule — Migrate PUT /articles/:slug Handler", "blocked_by": ["10-article-migrate-create"]},
    {"id": 12, "title": "10: ArticleModule — Migrate POST /articles Handler", "blocked_by": ["09-article-migrate-getFeed"]},
    {"id": 11, "title": "09: ArticleModule — Migrate GET /articles/feed Handler", "blocked_by": ["08-article-migrate-getList"]},
    {"id": 10, "title": "08: ArticleModule — Migrate GET /articles Handler (List with Filters)", "blocked_by": ["07-article-migrate-getBySlug"]},
    {"id": 9, "title": "07: ArticleModule — Migrate GET /articles/:slug Handler", "blocked_by": ["06-article-unit-tests"]},
    {"id": 8, "title": "06: ArticleModule — Unit Tests (Public Methods)", "blocked_by": ["05-article-characterization-tests"]},
    {"id": 7, "title": "05: ArticleModule — HTTP Characterization Tests (All Article Endpoints)", "blocked_by": ["02-foundation-test-infra"]},
    {"id": 6, "title": "04: AuthModule — Core Auth Logic (register, login, getCurrentUser, updateUser)", "blocked_by": ["03-auth-token-port"]},
    {"id": 5, "title": "03: AuthModule — TokenPort Interface & Adapters", "blocked_by": ["01-foundation-typescript-setup", "02-foundation-test-infra"]},
    {"id": 4, "title": "02: Foundation — Test Infrastructure (Vitest + mongodb-memory-server + Supertest)", "blocked_by": ["01-foundation-typescript-setup"]},
    {"id": 3, "title": "01: Foundation — TypeScript Strict Mode Setup", "blocked_by": []},
    {"id": 2, "title": "Spec: Full Codebase Modernization (TypeScript + Deep Modules + Characterization Tests)", "blocked_by": []},
    {"id": 1, "title": "Spec: ArticleModule Deepening (TypeScript + DTOs + Characterization Tests)", "blocked_by": []},
]

# Map spec references to issue IDs
ref_to_id = {
    "01-foundation-typescript-setup": 3,
    "02-foundation-test-infra": 4,
    "03-auth-token-port": 5,
    "04-auth-auth-module": 6,
    "05-article-characterization-tests": 7,
    "06-article-unit-tests": 8,
    "07-article-migrate-getBySlug": 9,
    "08-article-migrate-getList": 10,
    "09-article-migrate-getFeed": 11,
    "10-article-migrate-create": 12,
    "11-article-migrate-update": 13,
    "12-article-migrate-delete": 14,
    "13-article-migrate-favorite": 15,
    "14-profile-characterization-tests": 16,
    "15-profile-unit-tests": 17,
    "16-profile-migrate": 18,
    "17-comment-characterization-tests": 19,
    "18-comment-unit-tests": 20,
    "19-comment-migrate": 21,
}

# Build dependency graph
issue_map = {i["id"]: i for i in issues}

for issue in issues:
    blocked_by_ids = []
    for ref in issue["blocked_by"]:
        if ref in ref_to_id:
            blocked_by_ids.append(ref_to_id[ref])
    issue["blocked_by_ids"] = blocked_by_ids

# Find unblocked issues (no blocked_by_ids)
unblocked = [i for i in issues if len(i["blocked_by_ids"]) == 0]

print("All issues with dependencies:")
for issue in issues:
    print(f"  #{issue['id']}: {issue['title']} -> blocked by {issue['blocked_by_ids']}")

print("\nUnblocked issues:")
for issue in unblocked:
    print(f"  #{issue['id']}: {issue['title']} -> branch: sandcastle/issue-{issue['id']}")

# Output JSON
result = {"issues": [{"id": str(i["id"]), "title": i["title"], "branch": f"sandcastle/issue-{i['id']}"} for i in unblocked]}
print("\nJSON output:")
print(json.dumps(result, indent=2))
