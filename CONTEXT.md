# Domain Glossary — realWorld-server

> Canonical vocabulary for this codebase. Used by all skills to avoid drift. Updated inline as decisions crystallise.

---

## Core Entities

### Article
A published piece of content with a unique slug, title, description, body, and optional tag list.
- **slug**: URL-friendly unique identifier, derived from title at creation.
- **tagList**: Array of strings (tags). Used for filtering.
- **favouritesCount**: Denormalised counter of users who favourited this article.
- **author**: The User who created the article. Immutable after creation.
- **comments**: Collection of Comments on this article.

### User
An authenticated account with profile and social features.
- **username**: Unique, lowercase, public handle.
- **email**: Unique, used for login.
- **password**: Bcrypt-hashed. Never exposed.
- **bio**: Optional free-text.
- **image**: Profile image URL (defaults to placeholder).
- **followingUsers**: Array of User IDs this user follows.
- **favouriteArticles**: Array of Article IDs this user has favourited.

### Comment
A user's remark on an Article.
- **body**: Text content.
- **author**: The User who wrote it.
- **article**: The Article it belongs to.

### Profile
Public view of a User, scoped to a *viewer* (may be unauthenticated).
- **username**, **bio**, **image**: Copied from User.
- **following**: Boolean — does the *viewer* follow this user?

---

## Actions / Behaviours

### ArticleModule (deep module)
The single interface for all Article operations. Hides Mongoose, query logic, and N+1 hydration.

| Method | Intent |
|--------|--------|
| `create(authorId, input)` | Persist new Article, return ArticleDTO |
| `getBySlug(slug, viewerId?)` | Fetch one Article + author hydration (single query) |
| `getList(filter, viewerId?)` | Paginated, filterable list (tag, author, favorited) |
| `getFeed(viewerId, {limit, offset})` | Articles from followed users |
| `update(slug, authorId, patch)` | Author-only partial update |
| `delete(slug, authorId)` | Author-only deletion |
| `favorite(slug, viewerId)` | Add to viewer's favourites, increment count |
| `unfavorite(slug, viewerId)` | Remove from viewer's favourites, decrement count |
| `addComment(slug, authorId, body)` | Create Comment, link to Article |

### AuthModule
Authentication and current-user operations.
- `register({email, username, password})` → UserDTO + token
- `login({email, password})` → UserDTO + token
- `getCurrentUser(userId)` → UserDTO
- `updateUser(userId, patch)` → UserDTO

### ProfileModule
Profile view and social actions.
- `getProfile(username, viewerId?)` → ProfileDTO
- `follow(viewerId, targetUsername)` → ProfileDTO
- `unfollow(viewerId, targetUsername)` → ProfileDTO

---

## Data Transfer Objects (DTOs)

### ArticleDTO
```typescript
{
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: Date;
  updatedAt: Date;
  favorited: boolean;      // relative to viewer
  favoritesCount: number;
  author: ProfileDTO;
}
```

### ProfileDTO
```typescript
{
  username: string;
  bio: string;
  image: string;
  following: boolean;      // relative to viewer
}
```

### UserDTO (auth response)
```typescript
{
  username: string;
  email: string;
  bio: string;
  image: string;
  token: string;           // JWT
}
```

### CreateArticleInput / UpdateArticleInput
```typescript
{ title: string; description: string; body: string; tagList?: string[] }
```

### ArticleFilter
```typescript
{ tag?: string; author?: string; favorited?: string; limit?: number; offset?: number }
```

---

## Technical Seams (Ports)

### TokenPort
Interface for token generation/verification. Two adapters:
- **JwtAdapter** (production): `jsonwebtoken` sign/verify
- **InMemoryTokenAdapter** (tests): deterministic, no crypto

### ArticleRepositoryPort (internal, future)
If extracted, the persistence seam behind ArticleModule. Adapters:
- **MongooseArticleRepository** (production)
- **InMemoryArticleRepository** (tests)

---

## Decisions (ADR Candidates)

None yet. When a decision meets all three criteria (hard to reverse, surprising without context, genuine trade-off), create `docs/adr/NNNN-title.md`.

---

## Forbidden Synonyms (Don't Use)

| Instead of... | Use |
|---------------|-----|
| "post", "blog post", "story" | **Article** |
| "account", "person", "member" | **User** |
| "reply", "response" | **Comment** |
| "feed" (as noun) | **ArticleFeed** or **getFeed** |
| "favorite" (verb) | **favorite** (US spelling, consistent with codebase) |
| "service", "component", "API", "boundary" | **module**, **interface**, **seam**, **adapter** |