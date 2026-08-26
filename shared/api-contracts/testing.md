# Testing & facilities — API contract

| | |
| --- | --- |
| Contract version | 1.0.0 |
| Base path | `/api/v1/testing` |
| Shared types | [`shared/types/standards.ts`](../types/standards.ts) |
| Backend files | `routes/testing.routes.ts`, `controllers/testing.controller.ts`, `services/testing.service.ts` |
| Frontend files | `services/testingApi.ts`, `components/testing/*`, `pages/organization/Testing.tsx` |

Two related questions: *what has to be tested*, and *where can I get it tested*.
The second backs the facility-search screen — Pincode, Type of Facility, Address —
which is one of MANAK's reference screens, so its query shape is fixed by
`LaboratorySearchQuery` rather than improvised.

Both endpoints are public. Finding a testing laboratory is exactly the kind of
information that should not sit behind a signup wall.

## Endpoint summary

| Method | Path | Auth | Request | Success |
| --- | --- | --- | --- | --- |
| `GET` | `/testing/requirements` | public | *(query params)* | `ApiSuccess<TestingRequirement[]>` (200) + `meta.pagination` |
| `GET` | `/testing/laboratories` | public | `LaboratorySearchQuery` | `ApiSuccess<Laboratory[]>` (200) + `meta.pagination` |

---

## `GET /testing/requirements`

| | |
| --- | --- |
| Auth | public |
| Roles | — |
| Request | query params below |
| Success | `ApiSuccess<TestingRequirement[]>` (200) with `meta.pagination` |
| Errors | `VALIDATION_ERROR`, `INTERNAL_ERROR` |

The test parameters, methods, and acceptance limits attached to standards. Backs
`TestingRequirements.tsx`.

### Query params

`shared/types/standards.ts` defines `TestingRequirement` but **no
`TestingRequirementListQuery`**. The accepted params are frozen here; both layers
implement exactly this set:

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `standardId` | `string` | — | Requirements for one indexed standard. The common case, from a standard detail page. |
| `standardNumber` | `string` | — | Alternative to `standardId` when the caller has the number but not the id, e.g. `IS 1155:1968`. Sending both is a `VALIDATION_ERROR`. |
| `search` | `string` | — | Case-insensitive across `parameter` and `method`. |
| `mandatory` | `boolean` | — | `true` for mandatory-only, `false` for recommendations-only. Omit for both. |
| `page` | `number` | `1` | `PaginationQuery`. |
| `pageSize` | `number` | `12` | Max `100`. |

At least one of `standardId`, `standardNumber`, or `search` is required. An
unfiltered request is a `VALIDATION_ERROR` rather than a full-corpus dump —
every test parameter of every Indian Standard is not a useful page, and the
default result set for a filterless query would be arbitrary.

### Response — `TestingRequirement`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | |
| `standardNumber` | `string` | The number, not an id. A requirement is quoted against its standard as printed. |
| `parameter` | `string` | What is measured, e.g. `Moisture`. |
| `method` | `string` | The test method, usually a standard number, e.g. `IS 4333 (Part 2)`. |
| `limit` | `string \| null` | Acceptance criterion as prose. `null` for a qualitative requirement. |
| `sampleSize` | `string \| null` | Sampling requirement. `null` when the standard does not state one. |
| `mandatory` | `boolean` | `false` marks a recommendation. |

`limit` and `sampleSize` are strings, not numbers, because real acceptance criteria
read `14.0 percent by mass (max)` and `5 packages per lot of 100`. Parsing them
into numeric comparisons is out of scope and would lose the units and the
qualifier. Clients render them verbatim.

`mandatory: false` must be visually distinct. Presenting a recommendation as a
requirement makes a manufacturer spend money they did not have to, and presenting
a requirement as a recommendation fails an audit.

Ordered mandatory-first, then by `parameter` ascending, so the things that can
fail a certification appear at the top of the table.

**Request**

```
GET /api/v1/testing/requirements?standardId=std_01J8ZQZZ1155ATTA000000000&page=1&pageSize=12
```

**Success — 200**

```json
{
  "success": true,
  "data": [
    {
      "id": "tst_01J8ZV1A1B2C3D4E5F6G7H8J9K",
      "standardNumber": "IS 1155:1968",
      "parameter": "Moisture",
      "method": "IS 4333 (Part 2)",
      "limit": "14.0 percent by mass (max)",
      "sampleSize": "5 packages per lot of up to 100 packages",
      "mandatory": true
    },
    {
      "id": "tst_01J8ZV1B2C3D4E5F6G7H8J9K0M",
      "standardNumber": "IS 1155:1968",
      "parameter": "Total ash (on dry basis)",
      "method": "IS 1155 Annex B",
      "limit": "1.0 percent by mass (max)",
      "sampleSize": "5 packages per lot of up to 100 packages",
      "mandatory": true
    },
    {
      "id": "tst_01J8ZV1C3D4E5F6G7H8J9K0M1N",
      "standardNumber": "IS 1155:1968",
      "parameter": "Extraneous matter",
      "method": "Visual examination",
      "limit": null,
      "sampleSize": null,
      "mandatory": true
    },
    {
      "id": "tst_01J8ZV1D4E5F6G7H8J9K0M1N2P",
      "standardNumber": "IS 1155:1968",
      "parameter": "Granularity",
      "method": "IS 460 (Part 1)",
      "limit": "98 percent through 500 micron IS Sieve",
      "sampleSize": "1 composite sample per lot",
      "mandatory": false
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 12,
      "total": 4,
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
    "fields": [
      { "field": "standardId", "message": "Provide one of standardId, standardNumber, or search." }
    ],
    "requestId": "req_01J8ZV2A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## `GET /testing/laboratories`

| | |
| --- | --- |
| Auth | public |
| Roles | — |
| Request | `LaboratorySearchQuery` as query params |
| Success | `ApiSuccess<Laboratory[]>` (200) with `meta.pagination` |
| Errors | `VALIDATION_ERROR`, `INTERNAL_ERROR` |

The facility search. `LaboratorySearchQuery` exists in `shared/types/standards.ts`
specifically to back the reference screen's three controls, so the query shape is
not open to reinterpretation.

### Query params — `LaboratorySearchQuery extends PaginationQuery`

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `pincode` | `string` | — | Six digits. Enables distance ranking and populates `distanceKm`. |
| `facilityType` | `string` | — | A `FacilityType` key. Matches against `Laboratory.facilityTypes`. |
| `address` | `string` | — | Free-text match across `address`, `city`, and `state`. The screen's "Address" box. |
| `recognition` | `LaboratoryRecognition` | — | `bis_recognised \| nabl_accredited \| both \| none`. |
| `page` | `number` | `1` | |
| `pageSize` | `number` | `12` | Max `100`. |

Every param is optional and an entirely unfiltered request is valid — unlike
`/testing/requirements`, a plain list of facilities is a reasonable default view,
and the screen loads before the user has typed anything.

Two subtleties that matter for filter semantics:

`recognition=both` means the facility record's own value is the literal `both`. It
does **not** mean "either BIS-recognised or NABL-accredited". A client wanting
"any recognition" omits the param; there is no `any` value. This reading is forced
by the type — `recognition` on `Laboratory` is a single enum, not a set — and it is
the single most likely thing to be implemented differently on each side, so it is
stated here.

`recognition=none` returns facilities with neither recognition. They are indexed
because a hallmarking centre or a BIS branch office is a useful destination
without being an accredited test lab, but the UI must not present them as
accredited.

`facilityType` matches if the value appears anywhere in the facility's
`facilityTypes` array — a laboratory that both tests and calibrates matches either
query.

### Ordering

- With `pincode`: ascending `distanceKm`, then `name`. Nearest first is what the
  screen is for.
- Without `pincode`: `state`, then `city`, then `name`. Alphabetical and stable.

`distanceKm` is `null` when it cannot be computed — no `pincode` supplied, or the
facility's pincode is not in the geocoding table. It is straight-line distance, not
road distance, and clients should label it accordingly rather than implying a
drive time.

### Response — `Laboratory`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | |
| `name` | `string` | |
| `address` | `string` | Single-line postal address. |
| `pincode` | `string` | |
| `city` | `string` | |
| `state` | `string` | |
| `recognition` | `LaboratoryRecognition` | |
| `facilityTypes` | `string[]` | `FacilityType` keys. Never empty. |
| `contactPhone` | `string \| null` | |
| `contactEmail` | `string \| null` | |
| `distanceKm` | `number \| null` | Straight-line km from the searched pincode. |

`FACILITY_TYPES` in `shared/types/standards.ts` is the closed list the dropdown
renders: `testing_laboratory`, `calibration_laboratory`, `certification_body`,
`hallmarking_centre`, `bis_branch_office`, `inspection_body`. A `facilityType`
outside the list is a `VALIDATION_ERROR`; but `Laboratory.facilityTypes` is typed
`string[]` rather than `FacilityType[]`, so a client must tolerate an unrecognised
value in a response with a neutral chip instead of crashing.

**Request**

```
GET /api/v1/testing/laboratories?pincode=641604&facilityType=testing_laboratory&recognition=both&page=1&pageSize=12
```

**Success — 200**

```json
{
  "success": true,
  "data": [
    {
      "id": "lab_01J8ZV3A1B2C3D4E5F6G7H8J9K",
      "name": "South India Textile Research Association Laboratory",
      "address": "13/37 Avinashi Road, Coimbatore Aerodrome Post",
      "pincode": "641014",
      "city": "Coimbatore",
      "state": "Tamil Nadu",
      "recognition": "both",
      "facilityTypes": ["testing_laboratory", "calibration_laboratory"],
      "contactPhone": "+914222574367",
      "contactEmail": "lab@sitra.example.in",
      "distanceKm": 48.2
    },
    {
      "id": "lab_01J8ZV3B2C3D4E5F6G7H8J9K0M",
      "name": "Tirupur Regional Testing Centre",
      "address": "Plot 22, SIDCO Industrial Estate, Kuruchi",
      "pincode": "641021",
      "city": "Tirupur",
      "state": "Tamil Nadu",
      "recognition": "both",
      "facilityTypes": ["testing_laboratory"],
      "contactPhone": null,
      "contactEmail": "info@trtc.example.in",
      "distanceKm": 61.7
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

**Success — 200, no matches**

```json
{
  "success": true,
  "data": [],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 12,
      "total": 0,
      "totalPages": 0,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

`totalPages` is `0` when `total` is `0`, not `1`. `LaboratorySearch.tsx` renders
the empty state from `data.length === 0` and should suggest widening the search
rather than reporting a failure.

**Failure — 400**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "fields": [
      { "field": "pincode", "message": "Enter a six-digit pincode." },
      { "field": "facilityType", "message": "facilityType must be one of the listed facility types." }
    ],
    "requestId": "req_01J8ZV4A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## Related contracts

- [`standards.md`](./standards.md) — `StandardRequirement` on `StandardDetail`
  overlaps with `TestingRequirement` by design: the former is the requirement as
  the standard states it, the latter is the test that verifies it, and they are
  linked by `StandardRequirement.testMethod`.
- [`certification.md`](./certification.md) — certification stages that require a
  test report from a facility found here.

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-08-25 | Initial contract. Froze the `/testing/requirements` query params (no shared type) and settled `recognition=both` semantics. |
