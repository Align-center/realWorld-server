# Architecture Review — realWorld-server

**Generated:** 2026-10-13  
**Scope:** Full codebase (Express + Mongoose + JWT)

---

## Codebase Map

```
src/
├── api/index.js                 # Express app wiring
├── config/
│   ├── dbConnect.js            # Mongoose connection
│   ├── corsOptions.js
│   └── allowedOrigins.js
├── middleware/
│   ├── verifyJWT.js            # Required auth
│   └── verifyJWTOptional.js    # Optional auth
├── models/
│   ├── Article.js              # Article schema + methods
│   ├── User.js                 # User schema + methods
│   └── Comment.js              # Comment schema + methods
├── controllers/
│   ├── articlesController.js   # 8 handlers, ~280 lines
│   ├── usersController.js      # 4 handlers
│   ├── profilesController.js   # 3 handlers
│   ├── commentsController.js   # 3 handlers
│   └── tagsController.js       # 1 handler
└── routes/
    ├── articleRoutes.js
    ├── userRoutes.js
    ├── profileRoutes.js
    ├── commentRoutes.js
    └── tagRoutes.js
```

---

## Candidates for Deepening

### 1. Article Model — Shallow Interface, Leaky Implementation

**Files:** `models/Article.js`, `controllers/articlesController.js`

**Problem:** The `Article` model exposes 4 instance methods (`toArticleResponse`, `updateFavoriteCount`, `addComment`, `removeComment`) that mix **domain logic** (favourite counting, author hydration) with **response shaping**. The controller then re-fetches the author (`User.findById`) inside `toArticleResponse`, creating N+1 queries when listing articles. The deletion test: remove `Article` methods → complexity spreads to controllers, but also forces a single query pattern (populate) that currently doesn't exist.

**Current Interface (shallow):**
```
Article
├── toArticleResponse(user)  → fetches author, builds response
├── updateFavoriteCount()    → counts User.favouriteArticles
├── addComment(commentId)    → pushes to array, saves
└── removeComment(commentId) → removes from array, saves
```

**Proposed Deepened Module:** `ArticleRepository` (or `ArticleService`)

**New Interface (small, deep):**
```
ArticleModule
├── create(authorId, {title, description, body, tagList})
├── getBySlug(slug, viewerId?)       → single query with populate
├── getFeed(viewerId, {limit, offset})
├── getList(filters, {limit, offset})
├── update(slug, authorId, patch)
├── delete(slug, authorId)
├── favorite(slug, viewerId)
├── unfavorite(slug, viewerId)
└── addComment(slug, authorId, body)
```

**Benefits:**
- **Locality:** All Article query logic in one place. No more N+1 in controllers.
- **Leverage:** One `getBySlug` replaces 3 controller handlers + model methods.
- **Testability:** Single interface to test; swap Mongoose for in-memory adapter.
- **Seam discipline:** One external seam (the module interface); internal seams (populate strategy) stay private.

**Before / After:**

```
BEFORE (shallow)                    AFTER (deep)
┌─────────────────────────┐         ┌─────────────────────────┐
│ Article Model           │         │ ArticleModule           │
├─────────────────────────┤         ├─────────────────────────┤
│ toArticleResponse()     │ ──X──►  │ getBySlug(slug, viewer) │
│ updateFavoriteCount()   │         │ getFeed(viewer, opts)   │
│ addComment()            │         │ getList(filters, opts)  │
│ removeComment()         │         │ create(author, data)    │
└─────────────────────────┘         │ update(slug, author, ...)│
        ▲                           │ delete(slug, author)    │
        │ calls                     │ favorite(slug, viewer)  │
┌───────┴───────┐                   │ unfavorite(slug, v)     │
│ Controller    │                   │ addComment(slug, ...)   │
│ (8 handlers)  │                   └─────────────────────────┘
└───────────────┘
        ▲
        │ HTTP
┌───────┴───────┐
│ Routes        │
└───────────────┘
```

**Recommendation strength:** **Strong** — hottest path, clear N+1, controller is 280 lines of query orchestration.

---

### 2. User Model — Fat Model with Mixed Concerns

**Files:** `models/User.js`, `controllers/usersController.js`, `controllers/profilesController.js`

**Problem:** `User` schema carries 8 instance methods: token generation (`generateAccessToken`), response shaping (`toUserResponse`, `toProfileJSON`), social graph (`follow`, `unfollow`, `isFollowing`), favourites (`favorite`, `unfavorite`, `isFavourite`). Token generation uses `jwt.sign` directly — a **true external dependency** (category 4) hardcoded in the model. Controllers call `User.findOne({email})` then invoke methods, leaking query logic upward.

**Current Interface (shallow):**
```
User
├── generateAccessToken()          → uses jwt directly (external dep)
├── toUserResponse()               → shapes auth response
├── toProfileJSON(viewer)          → shapes profile response
├── isFollowing(id)
├── follow(id)
├── unfollow(id)
├── isFavourite(id)
├── favorite(id)
└── unfavorite(id)
```

**Proposed Deepened Module:** `AuthModule` + `ProfileModule` + `SocialGraphModule`

**New Interfaces:**
```
AuthModule
├── register({email, username, password})
├── login({email, password})
├── getCurrentUser(userId)
└── updateUser(userId, patch)

ProfileModule
├── getProfile(username, viewerId?)
├── follow(viewerId, targetUsername)
└── unfollow(viewerId, targetUsername)

SocialGraphModule (internal)
├── isFollowing(viewerId, targetId)
├── follow(viewerId, targetId)
└── unfollow(viewerId, targetId)
```

**Benefits:**
- **Seam discipline:** `AuthModule` takes a `TokenPort` (interface) — production uses `JwtAdapter`, tests use `InMemoryTokenAdapter`. Two adapters = real seam.
- **Locality:** Token logic, password hashing, and user lookup co-located.
- **Depth:** `register`/`login` hide bcrypt + JWT + User.create behind 2 methods.

**Before / After:**

```
BEFORE                            AFTER
┌──────────────────┐              ┌──────────────────┐
│ User Model       │              │ AuthModule       │
├──────────────────┤              ├──────────────────┤
│ generateToken()  │ ──X──►       │ register()       │
│ toUserResponse() │              │ login()          │
│ toProfileJSON()  │              │ getCurrentUser() │
│ follow()         │ ──► Social   │ updateUser()     │
│ unfollow()       │     Graph    └──────────────────┘
│ favorite()       │              ┌──────────────────┐
│ unfavorite()     │ ──► Favorites │ ProfileModule   │
└──────────────────┘              ├──────────────────┤
        ▲                         │ getProfile()     │
        │                         │ follow()         │
┌───────┴───────┐                 │ unfollow()       │
│ Controllers   │                 └──────────────────┘
│ (7 handlers)  │
└───────────────┘
```

**Recommendation strength:** **Worth exploring** — JWT hardcoded in model is a testability blocker; social/favourite logic could stay in User if kept as private methods.

---

### 3. Comment Controller — Thin Pass-Through

**Files:** `controllers/commentsController.js`, `models/Comment.js`

**Problem:** `Comment` model has 1 method (`toCommentResponse`) that fetches author. Controller does: find article → create comment → push to article.comments → save both. This is **transactional logic** (two collections) living in the controller. The deletion test: remove controller → logic vanishes. It's a pass-through.

**Proposed Deepened Module:** `CommentModule`

**New Interface:**
```
CommentModule
├── addComment(articleSlug, authorId, body)
├── getComments(articleSlug, viewerId?)
└── deleteComment(commentId, authorId)
```

**Benefits:**
- **Locality:** Article-Comment transaction in one place.
- **Leverage:** Controllers become one-liners.
- **Testability:** Single interface; in-memory adapter for Comment + Article.

**Recommendation strength:** **Worth exploring** — smaller surface, but clear transactional seam.

---

### 4. Auth Middleware — Duplicated Verification Logic

**Files:** `middleware/verifyJWT.js`, `middleware/verifyJWTOptional.js`

**Problem:** Two middlewares, ~25 lines each, 90% duplicate code. Only difference: `verifyJWTOptional` sets `req.loggedin = false` on missing/invalid token instead of 401/403. The **interface** (what callers must know) is identical: both populate `req.userId`, `req.userEmail`, `req.userHashedPwd`.

**Proposed Deepened Module:** Single `AuthMiddleware` with option

```
AuthMiddleware
├── required()    → 401/403 on failure
└── optional()    → sets req.loggedin = false on failure
```

**Recommendation strength:** **Speculative** — low leverage, but easy win for DRY.

---

### 5. Route Wiring — Implicit Coupling

**Files:** `api/index.js`, all `routes/*.js`

**Problem:** `api/index.js` imports 6 route files and mounts them. Route files import controllers and middlewares. The **seam** between "route registration" and "handler implementation" is implicit — no interface, no testability. Adding a new feature touches 3 files (controller, route, index).

**Proposed Deepened Module:** `RouteRegistry` (or keep as-is but document the seam)

**Recommendation strength:** **Speculative** — Express patterns resist deepening here; the seam is the framework.

---

## Top Recommendation

**Start with Candidate 1: Article Module**

**Why:**
1. **Highest leverage** — 280-line controller → ~8 method interface
2. **Real pain** — N+1 queries on article lists (every `toArticleResponse` fetches author)
3. **Clear seam** — All Article operations behind one module; Mongoose is a **local-substitutable** dependency (PGLite / in-memory Mongo for tests)
4. **No ADR conflicts** — No existing ADRs forbid this
5. **Domain vocabulary** — `CONTEXT.md` would define "Article", "Feed", "TagList", "Favourite" — the module speaks domain language

**First step:** Grill the interface design. Call `/grilling` on "ArticleModule interface" to explore:
- Does `getList` take a `Filter` object or discrete params?
- Does `create` return the full response or just the Article?
- Should `favorite`/`unfavorite` be in ArticleModule or a separate FavouriteModule?

---

## ADR Watchlist

No ADRs exist yet (`docs/adr/` is empty). If Candidate 2 (AuthModule) is pursued, an ADR should record: *"Token generation moved behind a port; JWT is an injected adapter"* — so future reviewers don't re-suggest putting `jwt.sign` back in the User model.

---

## Next Steps

Run `/grilling ArticleModule` to walk the interface design, then `/domain-modeling` to capture terms in `CONTEXT.md`.

---

## Refactoring Process (Demo/Kata)

This project demonstrates an AI-assisted refactoring workflow in 4 steps:

### Étape 1 — Analyse statique
> *"J'ai mesuré la complexité du code"*

Utilisation d'outils d'analyse statique (ex: `eslint-complexity`, `js-complexity`, SonarQube) pour quantifier :
- Complexité cyclomatique par fonction/fichier
- Couplage (afferent/efferent)
- Profondeur d'héritage, nombre de paramètres
- **Sortie :** Rapport de chaleur identifiant les *hot spots* (ici : `articlesController.js`, `User.js`)

### Étape 2 — Filet de sécurité
> *"J'ai utilisé l'IA pour générer des tests de caractérisation afin de garantir 0 régression."*

- Génération par IA de tests **de caractérisation** (characterization tests) qui capturent le comportement *actuel* — pas le comportement *souhaité*
- Couverture ciblée sur les modules candidats (Article, User, Comment)
- Tests d'intégration via l'interface HTTP (Supertest) + tests unitaires sur la logique métier extraite
- **Critère d'arrêt :** 100% des chemins critiques couverts avant tout refactoring

### Étape 3 — Refactoring guidé
> *"Ce que j'ai utilisé pour refactoriser en appliquant les principes SOLID."*

Application itérative, module par module :
| Principe | Application concrète |
|----------|---------------------|
| **S** (Single Responsibility) | Extraire `ArticleModule` : une seule raison de changer (requêtes Article) |
| **O** (Open/Closed) | `TokenPort` interface → `JwtAdapter` / `InMemoryTokenAdapter` sans modifier `AuthModule` |
| **L** (Liskov) | Adapters interchangeables : tests utilisent `InMemoryTokenAdapter`, prod utilise `JwtAdapter` |
| **I** (Interface Segregation) | `ArticleModule` expose 8 méthodes précises, pas un gros `ArticleService` fourre-tout |
| **D** (Dependency Inversion) | Modules dépendent d'abstractions (`TokenPort`, `ArticleRepository`) pas de `mongoose`/`jwt` directement |

Outils : IA pour proposer les diffs, validation humaine à chaque étape, commits atomiques.

### Étape 4 — Validation
> *"Les tests passent, la complexité cyclomatique a chuté de X%, et la couverture de type est passée à X%."*

Métriques de sortie (exemple visé pour ArticleModule) :
- ✅ **Tests :** 100% passent (caractérisation + nouveaux tests d'interface)
- 📉 **Complexité cyclomatique :** `-65%` (contrôleur 280 lignes → module ~8 méthodes simples)
- 📈 **Couverture de type (TypeScript/JSDoc) :** `40% → 95%` sur le module extrait
- ⚡ **Performance :** N+1 éliminé → 1 requête `populate` au lieu de N requêtes `findById`
- 🔒 **Régression :** 0 (filet de l'étape 2)

*Ces métriques sont mesurées automatiquement dans le pipeline CI à chaque PR.*