# Certification — API contract

| | |
| --- | --- |
| Contract version | 1.0.0 |
| Base path | `/api/v1/certification` |
| Shared types | [`shared/types/standards.ts`](../types/standards.ts) |
| Backend files | `routes/certification.routes.ts`, `controllers/certification.controller.ts`, `services/certification.service.ts` |
| Frontend files | `services/certificationApi.ts`, `components/certification/*`, `pages/organization/Certification.tsx` |

Certification pathways answer the question a manufacturer actually asks first:
*what do I have to do, in what order, and how long will it take?* MANAK models each
BIS scheme as an ordered set of stages with the documents each stage needs, so the
UI can render a timeline rather than a wall of regulation.

Both endpoints are public. A manufacturer evaluating whether certification is
feasible should not have to create an account to find out.

## Endpoint summary

| Method | Path | Auth | Request | Success |
| --- | --- | --- | --- | --- |
| `GET` | `/certification/pathways` | public | *(query params)* | `ApiSuccess<CertificationPathway[]>` (200) |
| `GET` | `/certification/pathways/:scheme` | public | — | `ApiSuccess<CertificationPathway>` (200) |

## The five schemes

`CertificationScheme` is a closed union in
[`shared/types/standards.ts`](../types/standards.ts). The `:scheme` path parameter
is the literal union member — the URL segment is `isi_mark`, not `ISI Mark` and
not a numeric id.

| `scheme` | Covers |
| --- | --- |
| `isi_mark` | The ISI mark product certification scheme. |
| `hallmarking` | Precious-metal hallmarking, including HUID. |
| `crs_registration` | Compulsory Registration Scheme for notified electronics. |
| `eco_mark` | Environment-friendly product certification. |
| `foreign_manufacturer` | The Foreign Manufacturers Certification Scheme. |

An unknown `:scheme` is `NOT_FOUND`, not `VALIDATION_ERROR`: the segment addresses
a resource, and a client that types `/pathways/bis_mark` has asked for something
that does not exist rather than sent a malformed field.

## What `status` means on a public pathway

`CertificationStage.status` is a `CertificationStageStatus`
(`pending | in_progress | complete | blocked`) and is **caller-relative**:

- **Anonymous or individual caller** — every stage is `pending`. The pathway is a
  reference document; nobody is on it.
- **Organization caller with a valid token** — stages reflect that organization's
  actual progress, so the timeline becomes a live checklist.

`blocked` means a prerequisite is unmet — typically a required test report absent
or an earlier stage incomplete. It is distinct from `pending`: `pending` is "not
started", `blocked` is "cannot start yet", and the UI colours them differently
because the user's next action differs.

This is the one place a public endpoint's payload changes materially with a token,
so it is stated loudly here rather than discovered in the UI.

---

## `GET /certification/pathways`

| | |
| --- | --- |
| Auth | public (token-aware) |
| Roles | — |
| Request | query params below |
| Success | `ApiSuccess<CertificationPathway[]>` (200) |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `INTERNAL_ERROR` |

Lists pathways, ordered as in the table above. Backs `CertificationCard.tsx`.

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `sector` | `string` | — | An `IndustrySector` key. Returns only pathways whose `applicableStandards` include at least one standard in that sector. |
| `standardId` | `string` | — | Returns only pathways whose `applicableStandards` include this standard. Answers "how do I certify against *this*?" from the standard detail page. |

**Not paginated.** There are five schemes and there will not be fifty; a
pagination block here would be ceremony. There is no `meta.pagination` on this
response, and clients must not expect one.

`applicableStandards` is `StandardSummary[]`, capped at 20 per pathway with the
most relevant first. The full list is available from
`GET /standards?sector=...`. `isSaved` on those summaries follows the
token-aware rule from [`standards.md`](./standards.md).

**Request**

```
GET /api/v1/certification/pathways?sector=jewellery
```

**Success — 200**

```json
{
  "success": true,
  "data": [
    {
      "scheme": "hallmarking",
      "title": "Hallmarking of Gold and Silver Jewellery",
      "summary": "Mandatory hallmarking of gold jewellery and artefacts through a BIS-recognised Assaying and Hallmarking Centre, including allotment of a six-digit HUID for each piece.",
      "applicableStandards": [
        {
          "id": "std_01J8ZQZZ1417GOLD000000000",
          "standardNumber": "IS 1417:2016",
          "title": "Grades of Gold and Gold Alloys, Jewellery and Artefacts",
          "status": "active",
          "body": "bis",
          "sector": "jewellery",
          "committee": "MTD 10",
          "publishedDate": "2016-05-20"
        },
        {
          "id": "std_01J8ZQZZ1387HALLMARK00000",
          "standardNumber": "IS 15820:2009",
          "title": "Method for Determination of Fineness of Gold in Gold Bullion and Jewellery",
          "status": "active",
          "body": "bis",
          "sector": "jewellery",
          "committee": "MTD 10",
          "publishedDate": "2009-03-11"
        }
      ],
      "stages": [
        {
          "id": "cst_01J8ZU1A1B2C3D4E5F6G7H8J9K",
          "order": 1,
          "title": "Register as a jeweller",
          "description": "Apply for BIS registration as a jeweller through the online portal, declaring every retail outlet you operate.",
          "status": "pending",
          "typicalDuration": "3–5 working days",
          "requiredDocuments": [
            "GSTIN certificate",
            "Proof of business address for each outlet",
            "Identity proof of the proprietor or authorised signatory"
          ]
        },
        {
          "id": "cst_01J8ZU1B2C3D4E5F6G7H8J9K0M",
          "order": 2,
          "title": "Send articles to an Assaying and Hallmarking Centre",
          "description": "Submit each lot to a BIS-recognised AHC for purity testing against IS 1417.",
          "status": "pending",
          "typicalDuration": "1–3 working days per lot",
          "requiredDocuments": ["Lot declaration form", "Registration certificate number"]
        },
        {
          "id": "cst_01J8ZU1C3D4E5F6G7H8J9K0M1N",
          "order": 3,
          "title": "HUID allotment and marking",
          "description": "On passing, each article is laser-marked with the BIS logo, the purity grade and its unique six-digit HUID.",
          "status": "pending",
          "typicalDuration": "Same day as testing",
          "requiredDocuments": []
        }
      ],
      "feeNote": "Charges are levied per article by the Assaying and Hallmarking Centre and are revised periodically. Confirm current rates with the centre before submitting a lot."
    }
  ]
}
```

**Failure — 400**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "fields": [{ "field": "sector", "message": "Choose one of the listed industry sectors." }],
    "requestId": "req_01J8ZU2A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## `GET /certification/pathways/:scheme`

| | |
| --- | --- |
| Auth | public (token-aware) |
| Roles | — |
| Path params | `scheme: CertificationScheme` |
| Success | `ApiSuccess<CertificationPathway>` (200) |
| Errors | `UNAUTHENTICATED`, `NOT_FOUND`, `INTERNAL_ERROR` |

One pathway in full. Same shape as an element of the list response — the list is
not a truncated projection, so `CertificationTimeline.tsx` can render from either
without a second fetch. The single-scheme route exists for deep links and for the
uncapped `applicableStandards` list.

| Field | Type | Notes |
| --- | --- | --- |
| `scheme` | `CertificationScheme` | Echoes `:scheme`. |
| `title` | `string` | Human-readable scheme name. |
| `summary` | `string` | Two or three sentences. Plain language, no clause citations. |
| `applicableStandards` | `StandardSummary[]` | Uncapped on this route. `[]` for a scheme with no indexed standards. |
| `stages` | `CertificationStage[]` | Ordered by `order`, ascending, contiguous from 1. |
| `feeNote` | `string \| null` | Indicative text only — **never a binding quote**. |

`CertificationStage.typicalDuration` is deliberately a `string | null`, not a
number of days. Real durations are ranges with caveats ("10–15 working days after
document verification"), and forcing them into an integer would misrepresent them.
Clients render it verbatim and must not parse it.

`requiredDocuments` is `[]`, never `null`, for a stage that needs no paperwork.

`feeNote` is `null` when MANAK has no reliable figure. Rendering "Fee: null" or
falling back to "Free" would both be wrong; the UI omits the fee row entirely.
The wording of a non-null `feeNote` always makes clear it is indicative — MANAK is
not a quoting service and a manufacturer must confirm charges with BIS.

**Request**

```
GET /api/v1/certification/pathways/isi_mark
Authorization: Bearer <accessToken>
```

**Success — 200** (organization caller, so `status` is live)

```json
{
  "success": true,
  "data": {
    "scheme": "isi_mark",
    "title": "ISI Mark Product Certification",
    "summary": "Licence to apply the ISI mark to a product manufactured in India, granted after BIS verifies that the factory's process control and the product's test results conform to the relevant Indian Standard. The licence is product-specific and factory-specific.",
    "applicableStandards": [
      {
        "id": "std_01J8ZQZZ15702COTTON000000",
        "standardNumber": "IS 15702:2006",
        "title": "Cotton Knitted Fabrics for Garments — Specification",
        "status": "active",
        "body": "bis",
        "sector": "textiles",
        "committee": "TXD 31",
        "publishedDate": "2006-11-24",
        "isSaved": true
      }
    ],
    "stages": [
      {
        "id": "cst_01J8ZU3A1B2C3D4E5F6G7H8J9K",
        "order": 1,
        "title": "Identify the applicable Indian Standard",
        "description": "Confirm which standard covers your product and grade. The licence is granted against a specific standard, so an error here invalidates everything downstream.",
        "status": "complete",
        "typicalDuration": null,
        "requiredDocuments": []
      },
      {
        "id": "cst_01J8ZU3B2C3D4E5F6G7H8J9K0M",
        "order": 2,
        "title": "Submit the online application",
        "description": "File the application on the BIS Manakonline portal with factory details, the manufacturing process flow, and the list of test equipment available in-house.",
        "status": "complete",
        "typicalDuration": "1–2 working days",
        "requiredDocuments": [
          "Factory layout plan",
          "List of manufacturing machinery",
          "List of in-house test equipment with calibration certificates",
          "Proof of legal possession of the premises"
        ]
      },
      {
        "id": "cst_01J8ZU3C3D4E5F6G7H8J9K0M1N",
        "order": 3,
        "title": "Factory inspection",
        "description": "A BIS officer audits process control and draws samples for independent testing.",
        "status": "in_progress",
        "typicalDuration": "10–15 working days",
        "requiredDocuments": ["Internal quality-control records for the last three months"]
      },
      {
        "id": "cst_01J8ZU3D4E5F6G7H8J9K0M1N2P",
        "order": 4,
        "title": "Independent sample testing",
        "description": "Drawn samples are tested at a BIS-recognised laboratory against every mandatory requirement of the standard.",
        "status": "blocked",
        "typicalDuration": "15–30 working days",
        "requiredDocuments": ["Sample dispatch acknowledgement"]
      },
      {
        "id": "cst_01J8ZU3E5F6G7H8J9K0M1N2P3Q",
        "order": 5,
        "title": "Licence grant and marking",
        "description": "On satisfactory inspection and test results, BIS grants the licence and you may apply the ISI mark with your licence number.",
        "status": "pending",
        "typicalDuration": "7–10 working days",
        "requiredDocuments": ["Signed licence agreement", "Marking fee payment receipt"]
      }
    ],
    "feeNote": "Application, inspection, and annual licence and marking fees apply, and marking fees are calculated on production volume. Rates are revised periodically — confirm the current schedule with BIS before budgeting."
  }
}
```

Stage 4 is `blocked` rather than `pending` because stage 3 is still
`in_progress` — samples cannot be tested before they are drawn. Stage 1 has
`typicalDuration: null` because it is desk research with no BIS-side turnaround,
and `requiredDocuments: []` for the same reason.

**Failure — 404**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Unknown certification scheme.",
    "requestId": "req_01J8ZU4A2B3C4D5E6F7G8H9J0K"
  }
}
```

---

## Related contracts

- [`standards.md`](./standards.md) — `StandardSummary`, embedded here as
  `applicableStandards`, and `StandardRequirement`, which drives what stage 4
  actually tests.
- [`testing.md`](./testing.md) — `GET /testing/laboratories` for finding the
  BIS-recognised laboratory a stage requires.
- [`reports.md`](./reports.md) — the `certification_readiness` report type, which
  assesses an organization against a pathway.

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-08-25 | Initial contract. Documented `stages[].status` as caller-relative and the list route as unpaginated. |
