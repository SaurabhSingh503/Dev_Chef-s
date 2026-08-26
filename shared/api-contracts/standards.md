# Standards — API contract

| | |
| --- | --- |
| Contract version | 1.0.0 |
| Base path | `/api/v1/standards` |
| Shared types | [`shared/types/standards.ts`](../types/standards.ts), [`shared/types/reports.ts`](../types/reports.ts), [`shared/types/ai.ts`](../types/ai.ts) |
| Backend files | `routes/standards.routes.ts`, `controllers/standards.controller.ts`, `services/standards.service.ts`, `validators/standard.validator.ts`, `models/standard.model.ts` |
| Frontend files | `services/standardsApi.ts`, `hooks/useStandards.ts`, `components/standards/*` |

The standards catalogue is the only part of MANAK that is fully public — anyone can
browse and read Indian Standards metadata without an account, because a
manufacturer who cannot find out whether a standard applies to them is the problem
MANAK exists to solve. Personalisation (saving, `isSaved`) requires a session.

## Endpoint summary

| Method | Path | Auth | Request | Success |
| --- | --- | --- | --- | --- |
| `GET` | `/standards` | public | `StandardListQuery` | `ApiSuccess<StandardSummary[]>` (200) + `meta.pagination` |
| `GET` | `/standards/:id` | public | — | `ApiSuccess<StandardDetail>` (200) |
| `GET` | `/standards/:id/related` | public | — | `ApiSuccess<RelatedStandard[]>` (200) |
| `POST` | `/standards/:id/save` | auth | *(empty body)* | `ApiSuccess<SavedResource>` (201) |
| `DELETE` | `/standards/:id/save` | auth | — | `ApiSuccess<AcknowledgementResponse>` (200) |

## Optional authentication on public routes

The three `GET` routes are public but **token-aware**. If a valid
`Authorization: Bearer` header is present, the response populates
`StandardSummary.isSaved`; if it is absent, the key is omitted entirely. This is
why `isSaved` is `isSaved?: boolean` rather than `isSaved: boolean` in
`shared/types/standards.ts` — absent means "nobody asked as a user", `false` means
"this user has not saved it". The frontend renders the save control only when the
key is present.

An **invalid or expired** token on a public route is still `UNAUTHENTICATED`
(401), not a silent downgrade to anonymous. A client sending a stale token should
learn it is stale rather than quietly seeing depersonalised data.

---

## `GET /standards`

| | |
| --- | --- |
| Auth | public (token-aware) |
| Roles | — |
| Request | `StandardListQuery` as query params |
| Success | `ApiSuccess<StandardSummary[]>` (200) with `meta.pagination` |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `INTERNAL_ERROR` |

The catalogue browse and search endpoint. Backs `StandardsExplorer.tsx`, both
role-scoped `Standards.tsx` pages, and `StandardGrid.tsx` / `StandardFilters.tsx`.

### Query params — `StandardListQuery extends PaginationQuery, SortQuery`

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | `number` | `1` | 1-based. |
| `pageSize` | `number` | `12` | `DEFAULT_PAGE_SIZE`, matching the 4×3 grid. Max `100`. |
| `sortBy` | `string` | `publishedDate` | Whitelist: `publishedDate`, `standardNumber`, `title`, `status`. |
| `sortDir` | `'asc' \| 'desc'` | `desc` | |
| `search` | `string` | — | Case-insensitive across `standardNumber`, `title`, and `abstract`. |
| `status` | `StandardStatus` | — | `active \| under_revision \| superseded \| withdrawn`. |
| `body` | `StandardsBody` | — | `bis \| iso \| iec \| codex \| other`. |
| `sector` | `string` | — | An `IndustrySector` key. |
| `committee` | `string` | — | Exact match on the committee code, e.g. `FAD 16`. |
| `savedOnly` | `boolean` | `false` | **Requires a token.** Sending `savedOnly=true` anonymously is `UNAUTHENTICATED`, since there is no "saved" without a user. |

Filters combine with AND. `search` tolerates the ways people actually type
standard numbers — `IS 1155`, `is1155`, and `1155` all match `IS 1155:1968` —
because requiring the canonical form would make search useless to a first-time
user.

An unrecognised `sortBy`, or a `status`/`body` outside its union, is a
`VALIDATION_ERROR` rather than a silent fallback: a client filtering on a typo
should be told, not shown an unfiltered catalogue it will present as filtered.

No results is 200 with `data: []`, which `useStandards` maps to
`AsyncState.status === 'empty'`.

**Request**

```
GET /api/v1/standards?search=atta&status=active&sector=food_processing&page=1&pageSize=12
Authorization: Bearer <accessToken>
```

**Success — 200**

```json
{
  "success": true,
  "data": [
    {
      "id": "std_01J8ZQZZ1155ATTA000000000",
      "standardNumber": "IS 1155:1968",
      "title": "Specification for Wheat Atta",
      "status": "active",
      "body": "bis",
      "sector": "food_processing",
      "committee": "FAD 16",
      "publishedDate": "1968-09-30",
      "isSaved": true
    },
    {
      "id": "std_01J8ZQZZ1010ATTAFORT00000",
      "standardNumber": "IS 17482:2020",
      "title": "Fortified Wheat Flour (Atta) — Specification",
      "status": "active",
      "body": "bis",
      "sector": "food_processing",
      "committee": "FAD 16",
      "publishedDate": "2020-07-17",
      "isSaved": false
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

The same request without a token returns the identical array with the `isSaved`
key omitted from each object.

**Failure — 400**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "fields": [
      { "field": "status", "message": "status must be one of: active, under_revision, superseded, withdrawn." },
      { "field": "sortBy", "message": "sortBy must be one of: publishedDate, standardNumber, title, status." }
    ],
    "requestId": "req_01J8ZT1A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## `GET /standards/:id`

| | |
| --- | --- |
| Auth | public (token-aware) |
| Roles | — |
| Path params | `id: string` — opaque standard id, **not** the standard number |
| Success | `ApiSuccess<StandardDetail>` (200) |
| Errors | `UNAUTHENTICATED`, `NOT_FOUND`, `INTERNAL_ERROR` |

The full record. `StandardDetail extends StandardSummary`, so every summary field
is present plus:

| Field | Type | Notes |
| --- | --- | --- |
| `abstract` | `string` | Short editorial summary. |
| `scope` | `string` | The standard's own scope clause. |
| `sections` | `StandardScopeSection[]` | `{ heading, content, clause }`. `clause` is `null` for prose-structured documents. |
| `references` | `string[]` | Standard **numbers** this one cites, not ids. Resolve them via `GET /standards?search=` or use `/related`, which returns ids. |
| `supersededBy` | `string \| null` | Populated when `status === 'superseded'`. |
| `amendments` | `StandardAmendment[]` | `{ number, issuedDate, summary }`, oldest first. |
| `requirements` | `StandardRequirement[]` | Feeds the certification and testing views. |
| `documentUrl` | `string \| null` | `null` when MANAK has no distributable copy. |
| `pageCount` | `number \| null` | |
| `updatedAt` | `string` | ISO timestamp of the MANAK record, not of the standard. |

`StandardRequirement.limit` and `.testMethod` are `null` for qualitative
requirements — "shall be free from extraneous matter" has no number. UI must
handle `null` rather than rendering "null". `mandatory: false` marks a
recommendation, and the distinction is legally meaningful, so it is never
collapsed into a single visual treatment.

When `status` is `superseded`, clients should surface `supersededBy` prominently.
Acting on a withdrawn standard is a real compliance failure, and MANAK's job is to
prevent it.

`references` holds numbers while `/related` returns ids: the reference list is
transcribed from the document itself and may cite standards MANAK has not
indexed, so there is no id to give.

**Success — 200**

```json
{
  "success": true,
  "data": {
    "id": "std_01J8ZQZZ1155ATTA000000000",
    "standardNumber": "IS 1155:1968",
    "title": "Specification for Wheat Atta",
    "status": "active",
    "body": "bis",
    "sector": "food_processing",
    "committee": "FAD 16",
    "publishedDate": "1968-09-30",
    "isSaved": true,
    "abstract": "Prescribes requirements and methods of sampling and test for wheat atta intended for human consumption.",
    "scope": "This standard prescribes the requirements and the methods of sampling and test for wheat atta.",
    "sections": [
      {
        "heading": "Scope",
        "content": "This standard prescribes the requirements and the methods of sampling and test for wheat atta.",
        "clause": "1"
      },
      {
        "heading": "Requirements",
        "content": "Wheat atta shall be the product obtained by milling or grinding clean wheat.",
        "clause": "4"
      },
      {
        "heading": "Packing and Marking",
        "content": "Atta shall be packed in sound, clean and dry containers.",
        "clause": "6"
      }
    ],
    "references": ["IS 4333 (Part 2):2002", "IS 1155 (Amendment 3)", "IS 2860:1964"],
    "supersededBy": null,
    "amendments": [
      {
        "number": "Amendment 3",
        "issuedDate": "1988-11-04",
        "summary": "Revised the permissible ash content on a moisture-free basis."
      }
    ],
    "requirements": [
      {
        "id": "req_01J8ZT2A1B2C3D4E5F6G7H8J9K",
        "label": "Moisture",
        "description": "Maximum moisture content of the atta as packed.",
        "limit": "14.0 percent by mass (max)",
        "testMethod": "IS 4333 (Part 2)",
        "mandatory": true
      },
      {
        "id": "req_01J8ZT2B2C3D4E5F6G7H8J9K0M",
        "label": "Freedom from extraneous matter",
        "description": "Atta shall be free from dirt, insects, rodent hair and other extraneous matter.",
        "limit": null,
        "testMethod": null,
        "mandatory": true
      },
      {
        "id": "req_01J8ZT2C3D4E5F6G7H8J9K0M1N",
        "label": "Granularity",
        "description": "Recommended particle-size distribution for chakki atta.",
        "limit": "98 percent through 500 micron IS Sieve",
        "testMethod": "IS 460 (Part 1)",
        "mandatory": false
      }
    ],
    "documentUrl": "https://storage.example.in/standards/IS-1155-1968.pdf",
    "pageCount": 12,
    "updatedAt": "2026-07-02T11:48:09.660Z"
  }
}
```

**Failure — 404**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Standard not found.",
    "requestId": "req_01J8ZT3D4E5F6G7H8J9K0M1N2P"
  }
}
```

---

## `GET /standards/:id/related`

| | |
| --- | --- |
| Auth | public (token-aware) |
| Roles | — |
| Path params | `id: string` |
| Success | `ApiSuccess<RelatedStandard[]>` (200) |
| Errors | `UNAUTHENTICATED`, `NOT_FOUND`, `INTERNAL_ERROR` |

Returns `RelatedStandard[]` from [`shared/types/ai.ts`](../types/ai.ts) — the same
shape `AIAnswer.relatedStandards` uses, so `components/standards/RelatedStandards.tsx`
and `components/ai/RelatedStandards.tsx` render from one type rather than two
near-identical ones.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | Resolvable standard id. |
| `standardNumber` | `string` | |
| `title` | `string` | |
| `relation` | `'referenced' \| 'superseded_by' \| 'amends' \| 'similar_scope'` | Rendered as caption text. |

Ordering is deliberate and stable: `superseded_by` first (it changes what the
reader should be doing), then `amends`, then `referenced`, then `similar_scope`.
Within a group, `standardNumber` ascending.

`referenced` entries are the subset of `StandardDetail.references` that MANAK has
actually indexed, resolved to ids. `similar_scope` comes from embedding
similarity over standard abstracts, which is why this endpoint can be slower than
the detail route and is fetched separately rather than inlined into
`StandardDetail`.

Not paginated — the list is naturally small and capped at 20 server-side. A
standard with no known relations returns `[]`, not 404. `NOT_FOUND` means the
standard in `:id` does not exist.

**Success — 200**

```json
{
  "success": true,
  "data": [
    {
      "id": "std_01J8ZQZZ4333PART2000000000",
      "standardNumber": "IS 4333 (Part 2):2002",
      "title": "Methods of Analysis for Foodgrains: Determination of Moisture",
      "relation": "referenced"
    },
    {
      "id": "std_01J8ZQZZ1010ATTAFORT00000",
      "standardNumber": "IS 17482:2020",
      "title": "Fortified Wheat Flour (Atta) — Specification",
      "relation": "similar_scope"
    }
  ],
  "meta": { "durationMs": 134 }
}
```

**Failure — 404**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Standard not found.",
    "requestId": "req_01J8ZT4E5F6G7H8J9K0M1N2P3Q"
  }
}
```

---

## `POST /standards/:id/save`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Path params | `id: string` |
| Request | *(empty body)* |
| Success | `ApiSuccess<SavedResource>` — **201 Created** |
| Errors | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR` |

Saves a standard for the caller. A convenience alias over `POST /me/saved` with
`{ kind: 'standard', resourceId: id }` — same rows, same returned
`SavedResource`, no second system. It exists because the standard detail page has
the id in the URL and should not have to construct a body.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | Id of the **saved-resource row**, not of the standard. This is what `DELETE /me/saved/:id` takes. |
| `kind` | `'standard'` | Always `standard` from this route. |
| `resourceId` | `string` | The standard's id — matches `:id`. |
| `title` | `string` | Denormalised standard title, so the saved list renders without N joins. |
| `subtitle` | `string \| null` | The standard number. |
| `savedAt` | `string` | ISO timestamp. |

Saving an already-saved standard is `CONFLICT` (409), not a silent 201. The
frontend treats 409 as "already saved" and reconciles its optimistic state rather
than showing an error toast — the user's intent was satisfied either way.

**Success — 201**

```json
{
  "success": true,
  "data": {
    "id": "sav_01J8ZT5A2B3C4D5E6F7G8H9J0K",
    "kind": "standard",
    "resourceId": "std_01J8ZQZZ1155ATTA000000000",
    "title": "Specification for Wheat Atta",
    "subtitle": "IS 1155:1968",
    "savedAt": "2026-08-25T10:22:47.005Z"
  }
}
```

**Failure — 409**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "This standard is already in your saved list.",
    "requestId": "req_01J8ZT5B3C4D5E6F7G8H9J0K1M"
  }
}
```

---

## `DELETE /standards/:id/save`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Path params | `id: string` — the **standard** id, not the saved-resource id |
| Success | `ApiSuccess<AcknowledgementResponse>` (200) |
| Errors | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR` |

Removes the caller's save for this standard. Note the asymmetry with
`DELETE /me/saved/:id`, which takes the saved-resource id: here `:id` is the
standard id, because the detail page knows the standard and should not have to
look up a row id first. Both are documented so nobody confuses them.

`NOT_FOUND` means "you had not saved this standard", which lets the UI resync.
The response is an acknowledgement rather than the deleted row — there is nothing
left to render.

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
    "message": "This standard is not in your saved list.",
    "requestId": "req_01J8ZT6C4D5E6F7G8H9J0K1M2N"
  }
}
```

---

## Related contracts

- [`certification.md`](./certification.md) — `CertificationPathway`, which embeds
  `StandardSummary[]` as `applicableStandards`.
- [`testing.md`](./testing.md) — `TestingRequirement` and `Laboratory`.
- [`reports.md`](./reports.md) — the general `/me/saved` and `/me/search-history`
  endpoints these two routes shortcut.

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-08-25 | Initial contract. `/related` settled as `RelatedStandard[]` shared with the AI module. |
