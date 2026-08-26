# Reports, saved resources & search history — API contract

| | |
| --- | --- |
| Contract version | 1.0.0 |
| Base paths | `/api/v1/reports`, `/api/v1/me` |
| Shared types | [`shared/types/reports.ts`](../types/reports.ts), [`shared/types/standards.ts`](../types/standards.ts) |
| Backend files | `routes/reports.routes.ts`, `controllers/reports.controller.ts`, `validators/report.validator.ts`, `models/report.model.ts`, plus the added `routes/me.routes.ts`, `controllers/me.controller.ts`, `services/me.service.ts` |
| Frontend files | `services/reportsApi.ts`, `hooks/useReports.ts`, `components/reports/*`, plus the added `services/meApi.ts` |

Two families in one contract because they share `shared/types/reports.ts`:

- **`/reports/*`** — generated compliance artifacts. Organization and admin only.
- **`/me/*`** — the caller's saved resources and search history. Any role.

The `/me/*` family is an agreed team addition, not a unilateral invention; see
[`README.md`](./README.md#note-on-me--an-agreed-addition) for the rationale and
the file-ownership split.

## Endpoint summary

| Method | Path | Auth | Request | Success |
| --- | --- | --- | --- | --- |
| `GET` | `/reports` | auth organization\|admin | `ReportListQuery` | `ApiSuccess<ReportSummary[]>` (200) + `meta.pagination` |
| `POST` | `/reports` | auth organization\|admin | `CreateReportRequest` | `ApiSuccess<ReportDetail>` — **202 Accepted** |
| `GET` | `/reports/:id` | auth organization\|admin | — | `ApiSuccess<ReportDetail>` (200) |
| `GET` | `/reports/:id/download` | auth organization\|admin | — | `ApiSuccess<ReportDownloadTicket>` *(inline)* (200) |
| `GET` | `/me/saved` | auth | *(query params)* | `ApiSuccess<SavedResource[]>` (200) + `meta.pagination` |
| `POST` | `/me/saved` | auth | `SaveResourceRequest` | `ApiSuccess<SavedResource>` (201) |
| `DELETE` | `/me/saved/:id` | auth | — | `ApiSuccess<AcknowledgementResponse>` (200) |
| `GET` | `/me/search-history` | auth | *(query params)* | `ApiSuccess<SearchHistoryEntry[]>` (200) + `meta.pagination` |
| `DELETE` | `/me/search-history` | auth | — | `ApiSuccess<AcknowledgementResponse>` (200) |

## Report scoping

`role.middleware` restricts every `/reports/*` route to `organization` and `admin`.
An `individual` caller with a valid token gets `FORBIDDEN` (403), not `NOT_FOUND` —
the resource class exists, their role does not reach it, and the frontend should
say so rather than pretend the feature is missing. `RoleRoute` keeps the page out
of the individual navigation in the first place; the 403 is the backstop.

Within the organization role, a report is visible to members of its owning
organization. Another organization's report is `NOT_FOUND`, because confirming it
exists would leak that a competitor generated one. An `admin` sees every report.

`ReportSummary.organizationId` is `string | null`. `null` marks an
individual-scoped report — the schema supports it and admins can produce one, but
no endpoint in this contract creates one, since `/reports` is closed to
individuals. Clients must still handle the `null`.

---

## `GET /reports`

| | |
| --- | --- |
| Auth | auth organization\|admin |
| Roles | `organization`, `admin` |
| Request | `ReportListQuery` as query params |
| Success | `ApiSuccess<ReportSummary[]>` (200) with `meta.pagination` |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `INTERNAL_ERROR` |

### Query params — `ReportListQuery extends PaginationQuery, SortQuery`

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `type` | `ReportType` | — | `compliance_gap \| standards_digest \| certification_readiness \| testing_plan \| industry_briefing`. |
| `status` | `ReportStatus` | — | `generating \| ready \| failed`. |
| `page` | `number` | `1` | |
| `pageSize` | `number` | `12` | Max `100`. |
| `sortBy` | `string` | `createdAt` | Whitelist: `createdAt`, `title`, `type`, `status`. |
| `sortDir` | `'asc' \| 'desc'` | `desc` | |

Newest first by default — a reports list is a work queue. `ReportSummary` has
`createdAt` but no `updatedAt`; only `ReportDetail` carries `updatedAt`, so do not
sort the list by it.

**Success — 200**

```json
{
  "success": true,
  "data": [
    {
      "id": "rpt_01J8ZX1A1B2C3D4E5F6G7H8J9K",
      "title": "Compliance gap review — knitted cotton garments",
      "type": "compliance_gap",
      "status": "ready",
      "organizationId": "org_01J8ZQ6N4C6D8E0F2G4H6J8K0M",
      "createdAt": "2026-08-24T13:02:19.441Z"
    },
    {
      "id": "rpt_01J8ZX1B2C3D4E5F6G7H8J9K0M",
      "title": "Testing plan for IS 15702:2006",
      "type": "testing_plan",
      "status": "generating",
      "organizationId": "org_01J8ZQ6N4C6D8E0F2G4H6J8K0M",
      "createdAt": "2026-08-25T10:51:07.882Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 12,
      "total": 2,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

**Failure — 403**

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Reports are available to organization accounts.",
    "requestId": "req_01J8ZX2A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## `POST /reports`

| | |
| --- | --- |
| Auth | auth organization\|admin |
| Roles | `organization`, `admin` |
| Request | `CreateReportRequest` |
| Success | `ApiSuccess<ReportDetail>` — **202 Accepted** |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `INSUFFICIENT_KNOWLEDGE`, `RAG_UNAVAILABLE`, `INTERNAL_ERROR` |

Starts generation. Asynchronous: **202** with a `ReportDetail` whose `status` is
`generating`, `sections` is `[]`, and `downloadUrl` is `null`. Clients poll
`GET /reports/:id`.

Reports are RAG-grounded like AI answers — `ReportSection.standards` are the
standards a section actually cites — so generation takes tens of seconds.

### Request body — `CreateReportRequest`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | `ReportType` | yes | |
| `title` | `string` | no | Server generates one from `type` and scope when omitted. 3–200 characters. |
| `standardIds` | `string[]` | no | Scope to these standards. Up to 50. An unknown id is `NOT_FOUND`. Omit to use the organization's `applicableStandardIds`. |
| `sector` | `string` | no | An `IndustrySector` key. Defaults to the organization's `sector`. |
| `language` | `LanguageCode` | no | Report language. Defaults to the caller's `preferredLanguage`. |

`INSUFFICIENT_KNOWLEDGE` (422) is returned when the corpus cannot ground **any**
section of the requested report — for example a `compliance_gap` report scoped to
standards MANAK has metadata for but no indexed text. This is one of only two
endpoints that use that error code, because a report with no grounded sections is
not a partial report, it is a fabrication risk. See
[`README.md`](./README.md#insufficient_knowledge-versus-answerable-false).

Partial grounding is different and is *not* an error: a report where some sections
ground and others do not is created, reaches `status: 'ready'`, and says plainly
in the affected sections that MANAK has no indexed source. The threshold for 422 is
*nothing* grounded, not *something* missing.

Rate limited per organization.

**Request**

```json
{
  "type": "compliance_gap",
  "title": "Compliance gap review — knitted cotton garments",
  "standardIds": ["std_01J8ZQZZ15702COTTON000000"],
  "sector": "textiles",
  "language": "en"
}
```

**Success — 202**

```json
{
  "success": true,
  "data": {
    "id": "rpt_01J8ZX3A1B2C3D4E5F6G7H8J9K",
    "title": "Compliance gap review — knitted cotton garments",
    "type": "compliance_gap",
    "status": "generating",
    "organizationId": "org_01J8ZQ6N4C6D8E0F2G4H6J8K0M",
    "createdAt": "2026-08-25T10:55:31.207Z",
    "summary": "",
    "sections": [],
    "downloadUrl": null,
    "language": "en",
    "error": null,
    "updatedAt": "2026-08-25T10:55:31.207Z"
  }
}
```

`summary` is `""` rather than `null` while generating — the type declares it
`string`, so an empty string is the only correct placeholder.

**Failure — 422**

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_KNOWLEDGE",
    "message": "MANAK has no indexed text for the selected standards, so a grounded report cannot be produced. Try a broader sector scope or ask an administrator to index these standards.",
    "requestId": "req_01J8ZX3B2C3D4E5F6G7H8J9K0M"
  }
}
```

---

## `GET /reports/:id`

| | |
| --- | --- |
| Auth | auth organization\|admin |
| Roles | `organization`, `admin` |
| Path params | `id: string` |
| Success | `ApiSuccess<ReportDetail>` (200) |
| Errors | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR` |

The polling and viewing endpoint. `ReportDetail extends ReportSummary` and adds
`summary`, `sections`, `downloadUrl`, `language`, `error`, `updatedAt`.

### State table

`ReportStatus` is `generating | ready | failed`, with two terminal states.

| `status` | `summary` | `sections` | `downloadUrl` | `error` |
| --- | --- | --- | --- | --- |
| `generating` | `""` | `[]` | `null` | `null` |
| `ready` | populated | populated | signed URL | `null` |
| `failed` | `""` or partial | `[]` or partial | `null` | human-readable reason |

A `failed` report is **HTTP 200 with `success: true`** — reading the report
succeeded, the generation did not. Same principle as `HandbookPdfJob` in
[`handbook.md`](./handbook.md) and `answerable: false` in [`ai.md`](./ai.md).
`error` is written for a user to read.

There is no `progress` field on a report, unlike `HandbookPdfJob`. The UI shows an
indeterminate indicator. Poll every 3 seconds for the first minute, then every 10.

`downloadUrl` on `ReportDetail` is a signed URL valid for 15 minutes from the
moment the response was generated. Treat it as stale on any page that has been
open a while and use `/reports/:id/download` to mint a fresh one.

`ReportSection.standards` is `StandardSummary[]` and may be `[]` for a narrative
section with no citations — an executive summary legitimately cites nothing.
`isSaved` is omitted on these summaries; report sections are not a save surface.

**Success — 200, ready**

```json
{
  "success": true,
  "data": {
    "id": "rpt_01J8ZX1A1B2C3D4E5F6G7H8J9K",
    "title": "Compliance gap review — knitted cotton garments",
    "type": "compliance_gap",
    "status": "ready",
    "organizationId": "org_01J8ZQ6N4C6D8E0F2G4H6J8K0M",
    "createdAt": "2026-08-24T13:02:19.441Z",
    "summary": "Sundaram Mills conforms to the fabric construction and dimensional requirements of IS 15702:2006 but has no current colour-fastness test records, which is the one gap that would stop an ISI mark application.",
    "sections": [
      {
        "heading": "Scope of this review",
        "body": "This review compares the organisation's declared product range against the mandatory requirements of the standards listed in its profile. It covers only the standards MANAK has indexed in full text.",
        "standards": []
      },
      {
        "heading": "Colour fastness — gap identified",
        "body": "IS 15702:2006 requires colour fastness to washing, perspiration and rubbing to be assessed against the grades in clause 5.3. No test report covering these parameters is on file. A BIS-recognised textile laboratory can perform all three in a single submission.",
        "standards": [
          {
            "id": "std_01J8ZQZZ15702COTTON000000",
            "standardNumber": "IS 15702:2006",
            "title": "Cotton Knitted Fabrics for Garments — Specification",
            "status": "active",
            "body": "bis",
            "sector": "textiles",
            "committee": "TXD 31",
            "publishedDate": "2006-11-24"
          }
        ]
      },
      {
        "heading": "Dimensional stability — conforming",
        "body": "Shrinkage records for the last three production lots are within the permitted limits, so no further action is needed for this parameter.",
        "standards": [
          {
            "id": "std_01J8ZQZZ15702COTTON000000",
            "standardNumber": "IS 15702:2006",
            "title": "Cotton Knitted Fabrics for Garments — Specification",
            "status": "active",
            "body": "bis",
            "sector": "textiles",
            "committee": "TXD 31",
            "publishedDate": "2006-11-24"
          }
        ]
      }
    ],
    "downloadUrl": "https://storage.example.in/reports/rpt_01J8ZX1A.pdf?token=PLACEHOLDER&expires=1787654400",
    "language": "en",
    "error": null,
    "updatedAt": "2026-08-24T13:04:02.913Z"
  }
}
```

**Success — 200, failed**

```json
{
  "success": true,
  "data": {
    "id": "rpt_01J8ZX4A1B2C3D4E5F6G7H8J9K",
    "title": "Standards digest — August 2026",
    "type": "standards_digest",
    "status": "failed",
    "organizationId": "org_01J8ZQ6N4C6D8E0F2G4H6J8K0M",
    "createdAt": "2026-08-25T09:12:00.004Z",
    "summary": "",
    "sections": [],
    "downloadUrl": null,
    "language": "en",
    "error": "Generation stopped after the knowledge service became unavailable. Nothing was charged; please try again.",
    "updatedAt": "2026-08-25T09:13:48.220Z"
  }
}
```

**Failure — 404**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Report not found.",
    "requestId": "req_01J8ZX4B2C3D4E5F6G7H8J9K0M"
  }
}
```

---

## `GET /reports/:id/download`

| | |
| --- | --- |
| Auth | auth organization\|admin |
| Roles | `organization`, `admin` |
| Path params | `id: string` |
| Success | `ApiSuccess<ReportDownloadTicket>` (200) — **no shared type yet; frozen below** |
| Errors | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR` |

Mints a fresh signed URL. This route exists so a long-open page can get a working
link without re-fetching the whole report, and so the download click is the moment
the URL is issued rather than page load.

```ts
// Frozen in this contract. Canonical home when needed in TS: shared/types/reports.ts
interface ReportDownloadTicket {
  /** Expiring signed URL. */
  downloadUrl: string;
  /** ISO timestamp after which downloadUrl stops working. */
  expiresAt: string;
  /** Suggested filename for the browser's save dialog. */
  filename: string;
}
```

It returns **JSON, not the PDF bytes**. The frontend then navigates to or opens the
signed URL. Streaming the file through the API would double bandwidth and lose
object storage's range requests and resumable downloads.

`downloadUrl` is never `null` here — unlike `ReportDetail.downloadUrl`. A report
not yet `ready` cannot produce a ticket, so that case is `CONFLICT` (409) rather
than a success with a null URL. That is what makes the field non-nullable and lets
`ReportDownload.tsx` skip a null check.

`filename` is safe for a `Content-Disposition` header and for a filesystem:
alphanumerics, hyphens, underscores, and a single `.pdf`.

**Success — 200**

```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://storage.example.in/reports/rpt_01J8ZX1A.pdf?token=PLACEHOLDER&expires=1787655300",
    "expiresAt": "2026-08-25T11:10:00.000Z",
    "filename": "manak-compliance-gap-review-knitted-cotton-garments.pdf"
  }
}
```

**Failure — 409**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "This report is still generating. Try again once it is ready.",
    "requestId": "req_01J8ZX5A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## `GET /me/saved`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | query params below |
| Success | `ApiSuccess<SavedResource[]>` (200) with `meta.pagination` |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `INTERNAL_ERROR` |

The caller's saved resources across all kinds. Backs `SavedResources.tsx` and
`SavedStandards.tsx` — the latter simply passes `kind=standard`, which is why one
polymorphic collection is the right design rather than five per-module lists.

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `kind` | `SavedResourceKind` | *(all)* | `standard \| handbook \| report \| ai_answer`. |
| `search` | `string` | — | Case-insensitive across `title` and `subtitle`. |
| `page` | `number` | `1` | |
| `pageSize` | `number` | `12` | Max `100`. |

Newest save first, by `savedAt` descending. Not configurable — a saved list is
chronological.

`title` and `subtitle` are **denormalised snapshots** taken at save time, so the
list renders in one query. If a standard is retitled, an existing `SavedResource`
keeps the old title until it is re-saved. That is a deliberate trade for list
performance; a client needing live data follows `resourceId` to the underlying
resource. `subtitle` is `null` for a kind with no natural caption.

A `SavedResource` whose underlying resource was deleted is still returned — the row
is the user's, not the resource's. Following `resourceId` then yields `NOT_FOUND`,
which the UI renders as an unavailable card with a remove action.

**Success — 200**

```json
{
  "success": true,
  "data": [
    {
      "id": "sav_01J8ZY1A1B2C3D4E5F6G7H8J9K",
      "kind": "standard",
      "resourceId": "std_01J8ZQZZ1155ATTA000000000",
      "title": "Specification for Wheat Atta",
      "subtitle": "IS 1155:1968",
      "savedAt": "2026-08-25T10:22:47.005Z"
    },
    {
      "id": "sav_01J8ZY1B2C3D4E5F6G7H8J9K0M",
      "kind": "handbook",
      "resourceId": "hbk_01J8ZW1A1B2C3D4E5F6G7H8J9K",
      "title": "Handbook on Concrete Mixes",
      "subtitle": "SP 23",
      "savedAt": "2026-08-23T18:40:11.662Z"
    },
    {
      "id": "sav_01J8ZY1C3D4E5F6G7H8J9K0M1N",
      "kind": "ai_answer",
      "resourceId": "msg_01J8ZR1A9K8J7H6G5F4E3D2C1B",
      "title": "Moisture limit for packaged wheat atta",
      "subtitle": null,
      "savedAt": "2026-08-22T07:15:03.100Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 12,
      "total": 3,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
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
    "fields": [{ "field": "kind", "message": "kind must be one of: standard, handbook, report, ai_answer." }],
    "requestId": "req_01J8ZY2A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## `POST /me/saved`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | `SaveResourceRequest` |
| Success | `ApiSuccess<SavedResource>` — **201 Created** |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR` |

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `kind` | `SavedResourceKind` | yes | |
| `resourceId` | `string` | yes | Must exist and be visible to the caller. |

`kind` and `resourceId` must agree: `{ kind: 'standard', resourceId: 'hbk_...' }`
is `VALIDATION_ERROR` on `resourceId`, not `NOT_FOUND`, because the mismatch is
detectable without a lookup.

Saving something already saved is `CONFLICT` (409), matching
`POST /standards/:id/save`. `ai_answer` takes an `AIMessage.id` of an assistant
message; a user message id is `VALIDATION_ERROR`. Saving a `report` requires the
report to be visible to the caller, so an individual cannot save one.

**Request**

```json
{ "kind": "handbook", "resourceId": "hbk_01J8ZW1B2C3D4E5F6G7H8J9K0M" }
```

**Success — 201**

```json
{
  "success": true,
  "data": {
    "id": "sav_01J8ZY3A1B2C3D4E5F6G7H8J9K",
    "kind": "handbook",
    "resourceId": "hbk_01J8ZW1B2C3D4E5F6G7H8J9K0M",
    "title": "Handbook on Concrete Reinforcement and Detailing",
    "subtitle": "SP 34",
    "savedAt": "2026-08-25T11:02:18.774Z"
  }
}
```

**Failure — 404**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "That resource does not exist.",
    "requestId": "req_01J8ZY3B2C3D4E5F6G7H8J9K0M"
  }
}
```

---

## `DELETE /me/saved/:id`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Path params | `id: string` — the **`SavedResource.id`**, not the `resourceId` |
| Success | `ApiSuccess<AcknowledgementResponse>` (200) |
| Errors | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR` |

Note the parameter carefully. `:id` here is the saved-row id — the `id` field of
`SavedResource`. `DELETE /standards/:id/save` takes the **standard** id instead.
Both exist for good reasons (the saved list has row ids to hand, the standard page
has the standard id), and passing the wrong one yields `NOT_FOUND` rather than
deleting something unexpected.

Another user's saved row is `NOT_FOUND`.

**Success — 200**

```json
{
  "success": true,
  "data": { "acknowledged": true, "message": "Removed from your saved list." }
}
```

**Failure — 404**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "That saved item no longer exists.",
    "requestId": "req_01J8ZY4A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## `GET /me/search-history`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | query params below |
| Success | `ApiSuccess<SearchHistoryEntry[]>` (200) with `meta.pagination` |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `INTERNAL_ERROR` |

The caller's searches across every surface. Backs `SearchHistory.tsx` for both
roles and `RecentSearches.tsx` on the organization dashboard.

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `surface` | `'standards' \| 'handbook' \| 'ai' \| 'facility'` | *(all)* | Matches `SearchHistoryEntry.surface`. |
| `search` | `string` | — | Case-insensitive match on the recorded `query`. |
| `page` | `number` | `1` | |
| `pageSize` | `number` | `12` | Max `100`. |

Newest first by `searchedAt`. Not configurable.

`resultCount` is the count at the time of searching, not now. A `0` is meaningful —
it is how the team finds out what users look for and MANAK does not have, so those
rows are kept rather than discarded.

There is no `POST /me/search-history`. History is written server-side as a
side-effect of the search endpoints themselves; a client cannot inject entries. A
"repeat this search" action re-issues the original search, which naturally records
a new entry.

The `surface` union is declared inline on `SearchHistoryEntry` in
`shared/types/reports.ts` rather than as a named exported type. Both layers must
reference it as `SearchHistoryEntry['surface']` rather than re-declaring the four
literals.

**Success — 200**

```json
{
  "success": true,
  "data": [
    {
      "id": "sh_01J8ZZ1A1B2C3D4E5F6G7H8J9K",
      "query": "colour fastness knitted cotton",
      "surface": "standards",
      "resultCount": 7,
      "searchedAt": "2026-08-25T10:59:44.118Z"
    },
    {
      "id": "sh_01J8ZZ1B2C3D4E5F6G7H8J9K0M",
      "query": "testing laboratory 641604",
      "surface": "facility",
      "resultCount": 2,
      "searchedAt": "2026-08-25T10:47:12.905Z"
    },
    {
      "id": "sh_01J8ZZ1C3D4E5F6G7H8J9K0M1N",
      "query": "shelf life cold pressed groundnut oil",
      "surface": "ai",
      "resultCount": 0,
      "searchedAt": "2026-08-25T09:55:41.882Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 12,
      "total": 3,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
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
    "fields": [{ "field": "surface", "message": "surface must be one of: standards, handbook, ai, facility." }],
    "requestId": "req_01J8ZZ2A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## `DELETE /me/search-history`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | optional query param `surface` |
| Success | `ApiSuccess<AcknowledgementResponse>` (200) |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `INTERNAL_ERROR` |

Clears the caller's history. No path parameter — this deletes the collection, not
one entry.

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `surface` | `'standards' \| 'handbook' \| 'ai' \| 'facility'` | *(all)* | Clear one surface only. |

Idempotent: clearing empty history is 200, not 404. A user asking to delete
something already gone has had their wish granted, and there is no privacy reason
to distinguish the cases. `message` states what was cleared so the UI can confirm
specifically.

There is no per-entry delete. Clearing history is an all-or-nothing privacy action;
selectively editing it is not a feature MANAK offers.

**Request**

```
DELETE /api/v1/me/search-history?surface=ai
Authorization: Bearer <accessToken>
```

**Success — 200**

```json
{
  "success": true,
  "data": { "acknowledged": true, "message": "Cleared 12 AI searches from your history." }
}
```

**Failure — 400**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "fields": [{ "field": "surface", "message": "surface must be one of: standards, handbook, ai, facility." }],
    "requestId": "req_01J8ZZ3A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## Related contracts

- [`standards.md`](./standards.md) — `POST`/`DELETE /standards/:id/save`, the
  aliases over `/me/saved`.
- [`handbook.md`](./handbook.md) — the parallel async-artifact flow.
- [`organization.md`](./organization.md) — `OrganizationStats.generatedReports`,
  counted from these rows.

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-08-25 | Initial contract. `ReportDownloadTicket` frozen inline; documented the `/me/saved/:id` versus `/standards/:id/save` id asymmetry. |
