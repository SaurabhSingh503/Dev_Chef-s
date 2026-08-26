# Handbook & PDF generation — API contract

| | |
| --- | --- |
| Contract version | 1.0.0 |
| Base path | `/api/v1/handbook` |
| Shared types | [`shared/types/handbook.ts`](../types/handbook.ts), [`shared/types/standards.ts`](../types/standards.ts) |
| Backend files | `routes/handbook.routes.ts`, `controllers/handbook.controller.ts`, `services/handbook.service.ts`, `services/pdf.service.ts`, `validators/handbook.validator.ts`, `models/handbook.model.ts` |
| Frontend files | `services/handbookApi.ts`, `hooks/useHandbook.ts`, `components/handbook/*`, `pages/organization/Handbook.tsx` |

The Handbook module backs one of MANAK's reference screens: a BIS/Org. segmented
toggle, a centred pill search box, a 4×2 card grid, a "make PDF" action, and
pagination running 1..99. `HandbookListQuery` and `HandbookPdfRequest` exist to
pin that screen's behaviour, so the query and body shapes are not open to
reinterpretation.

Browsing is public; compiling a PDF requires a session, because generation costs
server time and the artifact is delivered by a signed URL tied to a caller.

## Endpoint summary

| Method | Path | Auth | Request | Success |
| --- | --- | --- | --- | --- |
| `GET` | `/handbook` | public | `HandbookListQuery` | `ApiSuccess<HandbookSummary[]>` (200) + `meta.pagination` |
| `GET` | `/handbook/:id` | public | — | `ApiSuccess<HandbookDetail>` (200) |
| `GET` | `/handbook/:id/preview` | public | — | `ApiSuccess<HandbookPreview>` (200) |
| `POST` | `/handbook/pdf` | auth | `HandbookPdfRequest` | `ApiSuccess<HandbookPdfJob>` — **202 Accepted** |
| `GET` | `/handbook/pdf/:jobId` | auth | — | `ApiSuccess<HandbookPdfJob>` (200) |

The three `GET` browse routes are token-aware in the same way as the standards
routes: a valid token populates `HandbookSummary.isSaved`, its absence omits the
key, and an invalid token is `UNAUTHENTICATED` rather than a silent downgrade. See
[`standards.md`](./standards.md#optional-authentication-on-public-routes).

---

## `GET /handbook`

| | |
| --- | --- |
| Auth | public (token-aware) |
| Roles | — |
| Request | `HandbookListQuery` as query params |
| Success | `ApiSuccess<HandbookSummary[]>` (200) with `meta.pagination` |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `INTERNAL_ERROR` |

### Query params — `HandbookListQuery extends PaginationQuery, SortQuery`

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `source` | `HandbookSource` | *(both)* | `bis \| org`. **This is the segmented toggle.** Omitting it returns both, which is not a state the reference screen can reach — the toggle always has a side selected — but the API allows it. |
| `search` | `string` | — | Case-insensitive across `title` and `code`. The centred pill box. |
| `sector` | `string` | — | An `IndustrySector` key. |
| `language` | `LanguageCode` | *(all)* | Filters on the handbook's own `language`, not the caller's UI language. See the note below. |
| `savedOnly` | `boolean` | `false` | Requires a token; anonymous use is `UNAUTHENTICATED`. |
| `page` | `number` | `1` | 1-based. The screen's pager runs 1..99. |
| `pageSize` | `number` | `12` | `DEFAULT_PAGE_SIZE`. The reference grid is 4×2 = **8**, so that screen passes `pageSize=8` explicitly. Max `100`. |
| `sortBy` | `string` | `publishedYear` | Whitelist: `publishedYear`, `title`, `code`. |
| `sortDir` | `'asc' \| 'desc'` | `desc` | |

**`language` filters content, not interface.** A user reading MANAK in Tamil still
sees English handbooks, because most BIS handbooks exist only in English and
hiding them would leave the grid empty. The frontend must not auto-inject the
active locale into this param. Pass it only when the user explicitly filters.

`source=bis` is BIS-published handbooks; `source=org` is handbooks contributed by
organizations. `HandbookSummary.body` is separate and finer-grained
(`StandardsBody`: `bis | iso | iec | codex | other`) — a handbook can have
`source: 'org'` and `body: 'iso'`. Do not conflate the two fields.

### Response — `HandbookSummary`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | |
| `title` | `string` | |
| `code` | `string \| null` | Short code on the card, e.g. `SP 7`. `null` for a handbook without one. |
| `source` | `HandbookSource` | |
| `body` | `StandardsBody` | |
| `sector` | `string` | |
| `coverImageUrl` | `string \| null` | `null` means the UI generates a cover from `title` and `code` — a documented fallback, not a broken image. |
| `pageCount` | `number \| null` | |
| `publishedYear` | `number \| null` | A year integer, e.g. `2016`. Not a date string. |
| `language` | `LanguageCode` | The handbook's language. |
| `isSaved` | `boolean?` | Present only for an authenticated caller. |

`publishedYear` is a plain integer while `StandardSummary.publishedDate` is a
`YYYY-MM-DD` string. Handbooks are commonly dated only to the year, so the type
reflects the precision that actually exists.

**Request**

```
GET /api/v1/handbook?source=bis&search=concrete&sector=construction_materials&page=1&pageSize=8
Authorization: Bearer <accessToken>
```

**Success — 200**

```json
{
  "success": true,
  "data": [
    {
      "id": "hbk_01J8ZW1A1B2C3D4E5F6G7H8J9K",
      "title": "Handbook on Concrete Mixes",
      "code": "SP 23",
      "source": "bis",
      "body": "bis",
      "sector": "construction_materials",
      "coverImageUrl": "https://storage.example.in/handbooks/sp-23-cover.png",
      "pageCount": 324,
      "publishedYear": 1982,
      "language": "en",
      "isSaved": false
    },
    {
      "id": "hbk_01J8ZW1B2C3D4E5F6G7H8J9K0M",
      "title": "Handbook on Concrete Reinforcement and Detailing",
      "code": "SP 34",
      "source": "bis",
      "body": "bis",
      "sector": "construction_materials",
      "coverImageUrl": null,
      "pageCount": 280,
      "publishedYear": 1987,
      "language": "en",
      "isSaved": true
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 8,
      "total": 11,
      "totalPages": 2,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Failure — 401** (anonymous `savedOnly`)

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Sign in to see your saved handbooks.",
    "requestId": "req_01J8ZW2A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## `GET /handbook/:id`

| | |
| --- | --- |
| Auth | public (token-aware) |
| Roles | — |
| Path params | `id: string` |
| Success | `ApiSuccess<HandbookDetail>` (200) |
| Errors | `UNAUTHENTICATED`, `NOT_FOUND`, `INTERNAL_ERROR` |

`HandbookDetail extends HandbookSummary` and adds:

| Field | Type | Notes |
| --- | --- | --- |
| `description` | `string` | Editorial summary. |
| `chapters` | `HandbookChapter[]` | Ordered by `order`. |
| `relatedStandards` | `StandardSummary[]` | Standards the handbook explains. `[]` when none are indexed. |
| `documentUrl` | `string \| null` | Direct download of the original. `null` when MANAK has no distributable copy — the PDF job is then the only way to get a document. |
| `updatedAt` | `string` | ISO timestamp of the MANAK record. |

`HandbookChapter` nests exactly **one** level: `sections` is
`{ title: string; startPage: number | null }[]`, with no further nesting and no
ids on sections. Deeper structure is deliberately flattened — a table of contents
three levels deep is unreadable in a sidebar, and the chunker in `rag/` treats
chapter as the retrieval unit anyway.

`startPage` is `null` for a chapter or section in a handbook MANAK has metadata for
but has not paginated.

`chapters[].id` is what `HandbookPdfRequest.chapterIds` takes; section titles are
not individually selectable.

**Success — 200**

```json
{
  "success": true,
  "data": {
    "id": "hbk_01J8ZW1A1B2C3D4E5F6G7H8J9K",
    "title": "Handbook on Concrete Mixes",
    "code": "SP 23",
    "source": "bis",
    "body": "bis",
    "sector": "construction_materials",
    "coverImageUrl": "https://storage.example.in/handbooks/sp-23-cover.png",
    "pageCount": 324,
    "publishedYear": 1982,
    "language": "en",
    "isSaved": false,
    "description": "Guidance on the design of concrete mixes, covering material selection, proportioning, trial mixes and quality control for structural concrete.",
    "chapters": [
      {
        "id": "hch_01J8ZW3A1B2C3D4E5F6G7H8J9K",
        "order": 1,
        "title": "Constituent Materials",
        "startPage": 11,
        "sections": [
          { "title": "Cement", "startPage": 11 },
          { "title": "Aggregates", "startPage": 24 },
          { "title": "Water and admixtures", "startPage": 41 }
        ]
      },
      {
        "id": "hch_01J8ZW3B2C3D4E5F6G7H8J9K0M",
        "order": 2,
        "title": "Mix Proportioning",
        "startPage": 58,
        "sections": [
          { "title": "Design stipulations", "startPage": 58 },
          { "title": "Trial mixes", "startPage": 77 }
        ]
      },
      {
        "id": "hch_01J8ZW3C3D4E5F6G7H8J9K0M1N",
        "order": 3,
        "title": "Quality Control",
        "startPage": 96,
        "sections": []
      }
    ],
    "relatedStandards": [
      {
        "id": "std_01J8ZQZZ456CONCRETE000000",
        "standardNumber": "IS 456:2000",
        "title": "Plain and Reinforced Concrete — Code of Practice",
        "status": "active",
        "body": "bis",
        "sector": "construction_materials",
        "committee": "CED 2",
        "publishedDate": "2000-07-21"
      },
      {
        "id": "std_01J8ZQZZ10262MIXDESIGN00",
        "standardNumber": "IS 10262:2019",
        "title": "Concrete Mix Proportioning — Guidelines",
        "status": "active",
        "body": "bis",
        "sector": "construction_materials",
        "committee": "CED 2",
        "publishedDate": "2019-01-30"
      }
    ],
    "documentUrl": "https://storage.example.in/handbooks/SP-23-1982.pdf",
    "updatedAt": "2026-06-18T08:31:44.912Z"
  }
}
```

**Failure — 404**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Handbook not found.",
    "requestId": "req_01J8ZW4A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## `GET /handbook/:id/preview`

| | |
| --- | --- |
| Auth | public (token-aware) |
| Roles | — |
| Path params | `id: string` |
| Success | `ApiSuccess<HandbookPreview>` (200) |
| Errors | `UNAUTHENTICATED`, `NOT_FOUND`, `INTERNAL_ERROR` |

A deliberately small payload for `HandbookPreview.tsx` — the modal that opens from
a card so a user can decide whether the handbook is worth downloading, without
paying for the full detail response.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | |
| `title` | `string` | |
| `excerpt` | `string` | Opening extract, cleaned plain text, capped around 1200 characters. |
| `chapters` | `Pick<HandbookChapter, 'id' \| 'order' \| 'title'>[]` | Titles only — **no `startPage`, no `sections`**. |
| `totalPages` | `number \| null` | |

The `Pick<>` is the whole point of this endpoint: the preview shows a chapter list
without page numbers or nested sections. A client that needs `startPage` must call
`GET /handbook/:id`. Note also the field name — `totalPages` here, `pageCount` on
`HandbookSummary`. They mean the same thing and the difference is a wart in the
shared types; it is called out in the gap register in
[`README.md`](./README.md) so nobody "fixes" one side unilaterally.

`excerpt` is already cleaned by the same pipeline that feeds the RAG chunker, so it
is safe to render as text. It is not Markdown and not HTML; render it in a
`<p>`/`<pre>` and do not run a Markdown parser over it.

**Success — 200**

```json
{
  "success": true,
  "data": {
    "id": "hbk_01J8ZW1A1B2C3D4E5F6G7H8J9K",
    "title": "Handbook on Concrete Mixes",
    "excerpt": "The design of a concrete mix consists of selecting suitable ingredients and determining their relative proportions with the object of producing concrete of certain minimum strength and durability as economically as possible. This handbook sets out the data and the procedures needed for that exercise, and illustrates them with worked examples.",
    "chapters": [
      { "id": "hch_01J8ZW3A1B2C3D4E5F6G7H8J9K", "order": 1, "title": "Constituent Materials" },
      { "id": "hch_01J8ZW3B2C3D4E5F6G7H8J9K0M", "order": 2, "title": "Mix Proportioning" },
      { "id": "hch_01J8ZW3C3D4E5F6G7H8J9K0M1N", "order": 3, "title": "Quality Control" }
    ],
    "totalPages": 324
  }
}
```

**Failure — 404**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Handbook not found.",
    "requestId": "req_01J8ZW5A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## `POST /handbook/pdf`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | `HandbookPdfRequest` |
| Success | `ApiSuccess<HandbookPdfJob>` — **202 Accepted** |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `INSUFFICIENT_KNOWLEDGE`, `RATE_LIMITED`, `INTERNAL_ERROR` |

Starts a PDF compilation job. Backs the "make PDF" action.

**This is asynchronous.** The response is **202** with a job in status `queued`,
never a PDF byte stream and never a finished `downloadUrl`. Compiling several
hundred pages takes seconds to minutes, and holding an HTTP request open for that
is how you get gateway timeouts. Clients poll `GET /handbook/pdf/:jobId`.

### Request body — `HandbookPdfRequest`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `handbookIds` | `string[]` | yes | 1–5 handbooks compiled into **one** PDF. Empty array is a `VALIDATION_ERROR`; more than 5 is `PAYLOAD_TOO_LARGE`. |
| `chapterIds` | `string[]` | no | Restrict to these chapters. Omit for whole handbooks. Ids must belong to the requested handbooks — a foreign id is a `VALIDATION_ERROR`, not a silent skip. |
| `includeRelatedStandards` | `boolean` | no | Default `false`. Appends a `relatedStandards` reference section. |
| `language` | `LanguageCode` | no | Language of generated front matter and section headings. Defaults to the caller's `preferredLanguage`. Does **not** translate handbook body text. |

`language` deserves emphasis: MANAK generates the cover, contents, and headings in
the requested language, but the handbook's own pages are reproduced as published.
A Tamil-language request over an English handbook yields Tamil chrome around
English content. Claiming otherwise would be a translation promise MANAK does not
keep.

An unknown handbook id is `NOT_FOUND`. An identical in-flight job for the same
caller and inputs is `CONFLICT`, carrying a message that points at the existing
job rather than starting a duplicate. `INSUFFICIENT_KNOWLEDGE` (422) is returned
when none of the requested handbooks has extractable content — one of only two
places that error code is used, because there is no honest partial PDF to hand
back. See [`README.md`](./README.md#insufficient_knowledge-versus-answerable-false).

Rate limited per user; generation is expensive.

**Request**

```json
{
  "handbookIds": ["hbk_01J8ZW1A1B2C3D4E5F6G7H8J9K"],
  "chapterIds": ["hch_01J8ZW3A1B2C3D4E5F6G7H8J9K", "hch_01J8ZW3B2C3D4E5F6G7H8J9K0M"],
  "includeRelatedStandards": true,
  "language": "en"
}
```

**Success — 202**

```json
{
  "success": true,
  "data": {
    "jobId": "pdf_01J8ZW6A1B2C3D4E5F6G7H8J9K",
    "status": "queued",
    "downloadUrl": null,
    "progress": 0,
    "error": null,
    "createdAt": "2026-08-25T10:41:03.771Z"
  }
}
```

**Failure — 400**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "fields": [
      { "field": "handbookIds", "message": "Select at least one handbook." },
      { "field": "chapterIds", "message": "Chapter hch_01J8ZZZZNOTMINE0000000000 does not belong to the selected handbooks." }
    ],
    "requestId": "req_01J8ZW6B2C3D4E5F6G7H8J9K0M"
  }
}
```

---

## `GET /handbook/pdf/:jobId`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Path params | `jobId: string` |
| Success | `ApiSuccess<HandbookPdfJob>` (200) |
| Errors | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR` |

Polls a job. Jobs are caller-scoped; another user's job is `NOT_FOUND`.

### Lifecycle

`PdfJobStatus` is `queued | generating | ready | failed`. There are exactly two
terminal states.

```
queued ──► generating ──► ready
                     └──► failed
```

| `status` | `progress` | `downloadUrl` | `error` |
| --- | --- | --- | --- |
| `queued` | `0` | `null` | `null` |
| `generating` | `1`–`99` | `null` | `null` |
| `ready` | `100` | signed URL | `null` |
| `failed` | last value reached | `null` | human-readable reason |

These combinations are guaranteed. A client can assert `downloadUrl !== null` when
`status === 'ready'` and never has to defend against a `ready` job with a null
URL. `progress` never decreases.

`downloadUrl` is a **short-lived signed URL**, valid for 15 minutes. It is not a
permanent link: do not persist it, do not email it, and re-poll the job if the
user comes back later. A 403 from object storage on an expired URL is expected
behaviour, not a bug.

Full lifecycle discussion, polling cadence, and retention are in
[`docs/PDF_GENERATION.md`](../../docs/PDF_GENERATION.md). Recommended polling:
every 2 seconds for the first 30 seconds, then every 5, giving up after 5 minutes
and offering a manual retry.

**Success — 200, in progress**

```json
{
  "success": true,
  "data": {
    "jobId": "pdf_01J8ZW6A1B2C3D4E5F6G7H8J9K",
    "status": "generating",
    "downloadUrl": null,
    "progress": 62,
    "error": null,
    "createdAt": "2026-08-25T10:41:03.771Z"
  }
}
```

**Success — 200, ready**

```json
{
  "success": true,
  "data": {
    "jobId": "pdf_01J8ZW6A1B2C3D4E5F6G7H8J9K",
    "status": "ready",
    "downloadUrl": "https://storage.example.in/generated/pdf_01J8ZW6A.pdf?token=PLACEHOLDER&expires=1787654400",
    "progress": 100,
    "error": null,
    "createdAt": "2026-08-25T10:41:03.771Z"
  }
}
```

**Success — 200, failed**

```json
{
  "success": true,
  "data": {
    "jobId": "pdf_01J8ZW7A1B2C3D4E5F6G7H8J9K",
    "status": "failed",
    "downloadUrl": null,
    "progress": 38,
    "error": "The source document for SP 23 could not be read past page 118. Try selecting fewer chapters.",
    "createdAt": "2026-08-25T10:44:52.118Z"
  }
}
```

A **failed job is still an HTTP 200 with `success: true`**. The request to read the
job succeeded; the job itself failed, and that is reported inside `data`. This
mirrors the `answerable: false` decision in [`ai.md`](./ai.md): job state is data,
not transport failure. `error` is written for a user to read and should be
rendered directly.

**Failure — 404**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "PDF job not found.",
    "requestId": "req_01J8ZW8A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## Related contracts

- [`standards.md`](./standards.md) — `StandardSummary`, embedded as
  `relatedStandards`.
- [`reports.md`](./reports.md) — a comparable async artifact flow, with
  `ReportStatus` instead of `PdfJobStatus`.
- [`docs/PDF_GENERATION.md`](../../docs/PDF_GENERATION.md) — the job worker.

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-08-25 | Initial contract. Pinned the status/progress/downloadUrl invariants and the 202-plus-poll flow. |
