# MANAK API Contracts

This directory is the **integration source of truth** for the MANAK platform. It
describes, endpoint by endpoint, exactly what the backend serves and exactly what
the frontend may assume. The TypeScript types in [`../types`](../types) are the
machine-checked half of the same agreement; these Markdown files are the
human-readable half — HTTP method, auth requirement, role gate, params, error
codes, and worked examples.

Four teams build against this directory simultaneously (`frontend/`, `backend/`,
`rag/`, `database/`). The contracts exist so that none of them has to guess, and
so that no one discovers a shape mismatch at integration time.

| Module | Contract | Primary shared types |
| --- | --- | --- |
| Authentication | [`auth.md`](./auth.md) | `shared/types/auth.ts` |
| AI / RAG query | [`ai.md`](./ai.md) | `shared/types/ai.ts` |
| Voice | [`voice.md`](./voice.md) | `shared/types/voice.ts` |
| Standards | [`standards.md`](./standards.md) | `shared/types/standards.ts` |
| Certification | [`certification.md`](./certification.md) | `shared/types/standards.ts` |
| Testing & facilities | [`testing.md`](./testing.md) | `shared/types/standards.ts` |
| Handbook & PDF | [`handbook.md`](./handbook.md) | `shared/types/handbook.ts` |
| Reports | [`reports.md`](./reports.md) | `shared/types/reports.ts` |
| Organization | [`organization.md`](./organization.md) | `shared/types/users.ts` |
| Consumer services | [`consumer.md`](./consumer.md) | *(inline — see gap register)* |
| Admin | [`admin.md`](./admin.md) | `shared/types/users.ts`, `ai.ts` |
| Trends | [`trends.md`](./trends.md) | `shared/types/reports.ts` |

The consolidated route table lives in [`../../docs/API.md`](../../docs/API.md).

---

## The one rule that matters

> **No layer may fork a shape.**

If the frontend needs a field the backend does not send, the fix is to change
`shared/types` and this contract in a single change, then update both layers. The
fix is *never* to declare a local interface in `frontend/src/types/*` or
`backend/src/types/*` that disagrees with `shared/types`.

The per-layer `types/` directories that exist in the skeleton are for
**layer-private** concerns only:

- `backend/src/types/*` — Express request augmentation (`req.user`), database row
  shapes, internal service DTOs.
- `frontend/src/types/*` — component prop types, form state, view models derived
  from a shared type.

Both layers resolve `@shared/types` through a tsconfig path alias (and, on the
frontend, a matching Vite alias). Importing from the barrel is the norm:

```ts
import type { ApiResponse, AIAnswer, StandardSummary } from '@shared/types';
```

## Transport and topology

| Service | Base URL (dev) | Mounted at |
| --- | --- | --- |
| Frontend (Vite) | `http://localhost:5173` | — |
| Backend (Express) | `http://localhost:4000` | every route under `/api/v1` |
| RAG (FastAPI) | `http://localhost:8000` | routes at root: `/health`, `/ingest`, `/search`, `/documents` |

The frontend reaches the backend through `VITE_API_BASE_URL`, default
`http://localhost:4000/api/v1`. The backend reaches the RAG service through
`RAG_SERVICE_URL`, default `http://localhost:8000`.

**The frontend never calls the RAG service directly, and never holds a
service-role key or an OpenAI key.** Every retrieval and every model call is
proxied by the backend, which is the only tier trusted with privileged
credentials. A contract in this directory that appears to expose a RAG route to
the browser is a bug in the contract.

## Response envelope

Every JSON response from the backend — success or failure, 200 or 500 — is one of
exactly two shapes, defined in [`../types/api.ts`](../types/api.ts).

```ts
interface ApiSuccess<T> { success: true;  data: T; meta?: ResponseMeta }
interface ApiFailure    { success: false; error: ApiErrorBody }
type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
```

Success:

```json
{
  "success": true,
  "data": { "id": "std_1155", "standardNumber": "IS 1155:1968" },
  "meta": { "durationMs": 42 }
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "fields": [{ "field": "email", "message": "Enter a valid email address." }],
    "requestId": "req_01J8ZQ4K7X9V2N3P4R5S6T7U8V"
  }
}
```

Rules that hold everywhere:

1. `success` is the discriminant. Clients narrow with `isApiSuccess()` from
   `shared/types/api.ts` rather than sniffing for the presence of `data`.
2. `data` is present on **every** success, even when the payload is conceptually
   empty — acknowledgement endpoints return `AcknowledgementResponse`, not `null`.
3. `error.message` is safe to render in the UI. It never contains a stack trace,
   a SQL fragment, an upstream provider's raw error, or a credential.
4. `error.fields` is populated only for `VALIDATION_ERROR`, and `field` uses dot
   paths so nested forms can map errors to inputs (`address.pincode`).
5. `error.requestId` is echoed from the `X-Request-Id` request header when the
   client sends one, otherwise generated server-side. It appears in server logs,
   which is how a user-reported failure gets traced.
6. `meta.pagination` appears on every list endpoint. `meta.durationMs` appears on
   AI, voice, and admin-analytics endpoints, where latency is part of the product.
7. A 4xx/5xx status is always accompanied by an `ApiFailure` body. There is no
   endpoint that returns a bare string or an HTML error page.

## Authentication header

Protected endpoints require a Supabase-issued access token as a bearer token:

```http
Authorization: Bearer <accessToken>
```

`accessToken` is the field of the same name on `AuthSession`. The token is minted
by Supabase, never by the frontend. `auth.middleware` verifies it, loads the
`AuthUser`, and attaches it to the request; `role.middleware` then applies the
role gate documented on each endpoint. Full flow in
[`../../docs/AUTHENTICATION.md`](../../docs/AUTHENTICATION.md).

The auth column in each contract reads:

| Value | Meaning |
| --- | --- |
| `public` | No token required. A valid token, if sent, may still personalise the response (for example populating `isSaved`). |
| `auth` | Valid token required; any role; account `status` must be `active`. |
| `auth organization\|admin` | Valid token required and `role` must be one of the listed values. |
| `auth admin` | Valid token required and `role` must be `admin`. |

An expired or malformed token is `UNAUTHENTICATED` (401). A valid token whose
role is wrong, or whose account `status` is `pending_verification` or
`suspended`, is `FORBIDDEN` (403). The distinction matters to the frontend:
401 triggers a refresh-then-retry, 403 never does.

## Pagination convention

Every list endpoint accepts `PaginationQuery` and answers with
`meta.pagination`:

```
GET /api/v1/standards?page=2&pageSize=12
```

| Field | Type | Notes |
| --- | --- | --- |
| `page` | `number` | 1-based. Default `1`. |
| `pageSize` | `number` | Default `DEFAULT_PAGE_SIZE` = `12`. Hard ceiling `MAX_PAGE_SIZE` = `100`. |

```json
{
  "success": true,
  "data": [],
  "meta": {
    "pagination": {
      "page": 2,
      "pageSize": 12,
      "total": 148,
      "totalPages": 13,
      "hasNext": true,
      "hasPrev": true
    }
  }
}
```

- `page < 1`, a non-integer `page`, or `pageSize > MAX_PAGE_SIZE` is a
  `VALIDATION_ERROR`. `pageSize` is **not** silently clamped — a client that asks
  for 500 rows must be told it cannot have them rather than quietly receiving 100.
- A `page` beyond `totalPages` is **not** a 404. It returns `200` with
  `data: []` and a truthful `pagination` block. The frontend maps an empty array
  to `AsyncState.status === 'empty'`, which is a designed state, not an error.
- `total` counts rows matching the filters, not rows in the table.
- Endpoints that also accept `SortQuery` whitelist `sortBy` per endpoint; an
  unrecognised value is a `VALIDATION_ERROR` rather than a silent fallback.
  `sortDir` defaults to `desc`.
- Filters combine with AND. Repeating a scalar filter is a `VALIDATION_ERROR`.

## Error-code table

`ApiErrorCode` is a closed union in `shared/types/api.ts`. It may be extended
deliberately; a member is never renamed, because clients switch on these strings.

| `code` | HTTP | Raised when | Client should |
| --- | --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Body, query, or path params failed validation. `fields[]` is populated. | Render field-level messages inline; do not retry unchanged. |
| `UNAUTHENTICATED` | 401 | Token missing, malformed, expired, or revoked. | Attempt one silent refresh, then redirect to `/login`. |
| `FORBIDDEN` | 403 | Token valid but role insufficient, or account not `active`. | Show a role-appropriate message. Never retry. |
| `NOT_FOUND` | 404 | The addressed resource does not exist, or is not visible to this caller. | Render the empty/not-found state. |
| `CONFLICT` | 409 | State or uniqueness conflict — email already registered, resource already saved, job already running. | Surface the conflict; refresh local state. |
| `RATE_LIMITED` | 429 | Per-IP or per-user quota exceeded. `Retry-After` header is set. | Back off for `Retry-After`; disable the trigger meanwhile. |
| `PAYLOAD_TOO_LARGE` | 413 | Upload exceeds the endpoint's limit (audio over `MAX_RECORDING_SECONDS`, document over the admin upload ceiling). | Explain the limit before retrying. |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Wrong `Content-Type`, unsupported audio container, or a document extension the parser cannot read. | List accepted formats. |
| `UPSTREAM_UNAVAILABLE` | 502 | A non-RAG dependency failed — Supabase auth, object storage, the STT/TTS provider. | Show a transient-failure state; retry is reasonable. |
| `RAG_UNAVAILABLE` | 503 | The RAG service is unreachable, timed out, or returned 5xx. | Distinguish visibly from "no answer found"; retry is reasonable. |
| `INSUFFICIENT_KNOWLEDGE` | 422 | The corpus cannot support the request **and** the endpoint has no honest degraded form. | Show the guidance in `message`; do not retry the same input. |
| `INTERNAL_ERROR` | 500 | Unhandled server fault. | Generic failure state; surface `requestId` for support. |

### `INSUFFICIENT_KNOWLEDGE` versus `answerable: false`

This is the single most commonly mis-integrated point in MANAK, so it is settled
here once.

**Conversational endpoints never use the error code.** `POST /ai/query` and
`POST /voice/query` return **HTTP 200** with `success: true` and a complete
`AIAnswer` whose `answerable` is `false`, whose `insufficientKnowledge` is
populated, and whose `sources` and `citations` are empty arrays. An honest "I
don't have grounding for this" is a *successful* product outcome — it is the
behaviour that makes MANAK trustworthy — and modelling it as an HTTP error would
push clients into a catch block and lose the guidance in
`InsufficientKnowledge.suggestions`.

**The `INSUFFICIENT_KNOWLEDGE` error code is reserved for non-conversational
endpoints that cannot degrade**: `POST /reports` when no requested section has
any retrievable grounding, and `POST /handbook/pdf` when none of the requested
handbooks has extractable content. There is no useful partial artifact to
return, so these fail loudly.

## Contract versioning

The API is **URL-versioned**: every backend route lives under `/api/v1`. The
version changes only when a change would break an existing client.

**Additive, ships inside `v1`:** a new endpoint; a new optional request field; a
new optional response field; a new member of a union that only ever appears in
responses the client already treats as open-ended (for example a new
`IndustrySector`); a new `ApiErrorCode`, since clients must already handle
unknown codes with a generic fallback.

**Breaking, requires `/api/v2`:** removing or renaming any field; making an
optional request field required; making an optional response field absent;
narrowing a type; changing an existing enum member's spelling; changing the
envelope; changing an endpoint's auth or role requirement to be stricter.

Each contract file opens with a header table carrying its contract version and
the shared-type modules it depends on. When a shape changes:

1. Edit `shared/types/*.ts` and the matching `shared/api-contracts/*.md` in the
   same change. A change to one without the other is incomplete by definition.
2. Bump the contract version in that file's header and note the change in its
   Changelog section.
3. Run `npm run typecheck` at the repo root. Because both `frontend` and
   `backend` compile against `shared/types`, a breaking change surfaces as a
   compile error in the layer that has not caught up — which is the point.
4. Announce it on the team channel described in
   [`../../docs/TEAM_WORKFLOW.md`](../../docs/TEAM_WORKFLOW.md). Silent shape
   changes are the failure mode this whole directory exists to prevent.

## Note on `/me/*` — an agreed addition

The `/me/*` family is **not** a unilateral invention by one layer. It was agreed
by the whole team as the home for per-user resources that are not scoped to a
single module:

```
GET    /api/v1/me/saved
POST   /api/v1/me/saved
DELETE /api/v1/me/saved/:id
GET    /api/v1/me/search-history
DELETE /api/v1/me/search-history
```

It exists because saved resources are polymorphic — `SavedResourceKind` covers
`standard`, `handbook`, `report`, and `ai_answer` — so a single cross-module
collection is correct, whereas five per-module "my saved X" endpoints would be
five ways to say the same thing. Search history is cross-surface for the same
reason: `SearchHistoryEntry.surface` spans `standards`, `handbook`, `ai`, and
`facility`.

Implementation ownership, so nobody duplicates the work:

| Layer | Files added |
| --- | --- |
| Backend | `backend/src/routes/me.routes.ts`, `backend/src/controllers/me.controller.ts`, `backend/src/services/me.service.ts` |
| Frontend | `frontend/src/services/meApi.ts` |

These four files are additions to the agreed skeleton; every other route in the
table maps onto files that already exist. The contract for `/me/*` is documented
in [`standards.md`](./standards.md) (the save/unsave shortcuts) and in
[`reports.md`](./reports.md) (`SavedResource` and `SearchHistoryEntry` payloads).

`POST /standards/:id/save` and `DELETE /standards/:id/save` are deliberate
convenience aliases over `/me/saved` for the standards detail page. They operate
on the same rows and return the same shapes; they are not a second system.

## Gap register — endpoints with no shared TypeScript type yet

A handful of endpoints in the agreed route table have no corresponding interface
in `shared/types`. Their shapes are **frozen in the contract files** so both
layers implement the same thing. When a layer needs one of these in TypeScript,
add it to `shared/types` in a dedicated change that references the contract —
do not declare a private copy.

| Endpoint(s) | Missing type | Frozen in | Suggested home |
| --- | --- | --- | --- |
| `POST /auth/google` | `GoogleAuthRequest` | [`auth.md`](./auth.md) | `shared/types/auth.ts` |
| `POST /voice/query` | `VoiceQueryRequest` | [`voice.md`](./voice.md) | `shared/types/voice.ts` |
| `GET /consumer/services` | `ConsumerService` | [`consumer.md`](./consumer.md) | `shared/types/consumer.ts` |
| `GET /consumer/hallmarking` | `HallmarkingInfo` | [`consumer.md`](./consumer.md) | `shared/types/consumer.ts` |
| `GET /consumer/guidance` | `ConsumerGuidanceItem` | [`consumer.md`](./consumer.md) | `shared/types/consumer.ts` |
| `GET /admin/stats` | `AdminStats` | [`admin.md`](./admin.md) | `shared/types/admin.ts` |
| `GET /admin/documents*` | `KnowledgeDocument` | [`admin.md`](./admin.md) | `shared/types/ai.ts` |
| `GET /admin/rag/status` | `RagStatus` | [`admin.md`](./admin.md) | `shared/types/admin.ts` |
| `GET /admin/ai/analytics` | `AIAnalytics` | [`admin.md`](./admin.md) | `shared/types/admin.ts` |
| `GET /admin/knowledge-base` | `KnowledgeBaseOverview` | [`admin.md`](./admin.md) | `shared/types/admin.ts` |
| `GET /reports/:id/download` | `ReportDownloadTicket` | [`reports.md`](./reports.md) | `shared/types/reports.ts` |
| `GET /health`, `GET /health/ready` | `HealthStatus`, `ReadinessStatus` | [`../../docs/API.md`](../../docs/API.md) | `shared/types/api.ts` |

`UserListQuery` in `shared/types/users.ts` carries only `role`, `status`, and
`search` — unlike every other list query it does not extend `PaginationQuery`.
`GET /admin/users` is paginated regardless; [`admin.md`](./admin.md) documents it
as `UserListQuery & PaginationQuery & SortQuery`.

## Conventions worth stating explicitly

- **Timestamps** are ISO 8601 UTC strings with a `Z` suffix
  (`2026-08-25T09:14:02.481Z`). Date-only fields such as
  `StandardSummary.publishedDate` are `YYYY-MM-DD`. Every timestamp field in
  `shared/types` is typed `string`; none is a `Date`.
- **Nullable versus optional.** `field: T | null` means the server always sends
  the key, sometimes with `null` — the frontend can destructure it safely.
  `field?: T` means the key may be absent entirely, and is used for request
  fields and for response fields that depend on the caller (for example
  `StandardSummary.isSaved`, which is present only for an authenticated caller).
  These are not interchangeable.
- **Identifiers** are opaque strings. Never parse them, never assume UUID
  formatting, never sort by them.
- **Scores** (`relevanceScore`, `AIConfidence.score`, `TranscribeResponse.confidence`)
  are floats in `0..1` inclusive. `HandbookPdfJob.progress` is `0..100`.
- **Enums travel as their literal string**, lower snake case
  (`under_revision`, `bis_recognised`, `compliance_gap`). Clients must tolerate an
  unknown member with a neutral fallback rather than crashing.
- **Language** is a `LanguageCode` from `SUPPORTED_LANGUAGES`
  (`en`, `hi`, `bn`, `ta`, `te`, `mr`, `kn`, `pa`). An unsupported value is a
  `VALIDATION_ERROR`; an absent value falls back to the caller's
  `AuthUser.preferredLanguage`, then to `en`. See
  [`../../docs/MULTILINGUAL.md`](../../docs/MULTILINGUAL.md).
- **Empty lists are `[]`, never `null`.** Object-valued fields that may be absent
  are `null`, never `{}`.

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-08-25 | Initial contracts for all twelve modules against `shared/types` v1. |
