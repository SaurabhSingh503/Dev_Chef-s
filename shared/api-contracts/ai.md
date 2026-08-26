# AI / RAG query — API contract

| | |
| --- | --- |
| Contract version | 1.0.0 |
| Base path | `/api/v1/ai` |
| Shared types | [`shared/types/ai.ts`](../types/ai.ts), [`shared/types/api.ts`](../types/api.ts) |
| Backend files | `routes/ai.routes.ts`, `controllers/ai.controller.ts`, `services/ai.service.ts`, `services/rag.service.ts`, `validators/ai.validator.ts` |
| Frontend files | `services/aiApi.ts`, `context/AIContext.tsx`, `hooks/useAI.ts`, `components/ai/*` |

These endpoints are MANAK's centre of gravity. Everything about them is shaped by
one rule, stated in [`shared/types/ai.ts`](../types/ai.ts) and repeated here
because it must not be softened:

> MANAK is **grounded** AI. When retrieval does not support an answer, the
> pipeline returns `answerable: false` with `insufficientKnowledge` set. It never
> fabricates a standards citation.

A confidently wrong clause number is worse than no answer at all — a manufacturer
could act on it. Every field in `AIAnswer` exists to make the provenance of an
answer inspectable: `sources` are the retrieved chunks, `citations` map spans of
the prose to those chunks, and `confidence` says how much the retrieval actually
supported the claim.

Pipeline internals — chunking, embedding, scoring — are documented in
[`docs/AI_RAG.md`](../../docs/AI_RAG.md). This file documents only the HTTP surface
the frontend consumes.

## Endpoint summary

| Method | Path | Auth | Request | Success |
| --- | --- | --- | --- | --- |
| `POST` | `/ai/query` | auth | `AIQueryRequest` | `ApiSuccess<AIAnswer>` (200) |
| `GET` | `/ai/conversations` | auth | *(query params)* | `ApiSuccess<AIConversationSummary[]>` (200) |
| `GET` | `/ai/conversations/:id` | auth | — | `ApiSuccess<AIConversation>` (200) |
| `DELETE` | `/ai/conversations/:id` | auth | — | `ApiSuccess<AcknowledgementResponse>` (200) |
| `GET` | `/ai/suggestions` | auth | *(query params)* | `ApiSuccess<SuggestedQuestion[]>` (200) |

All five require a valid token of any role. Conversations are strictly
caller-scoped: a conversation belonging to another user is `NOT_FOUND`, never
`FORBIDDEN`, because confirming existence would leak that someone else asked
something.

## `answerable: false` is a success, not an error

Read this before implementing either layer.

| Situation | HTTP | `success` | `answerable` | `error.code` |
| --- | --- | --- | --- | --- |
| Grounded answer found | 200 | `true` | `true` | — |
| Corpus has nothing relevant | 200 | `true` | `false` | — |
| Retrieval scored below `MIN_RELEVANCE_SCORE` | 200 | `true` | `false` | — |
| Question outside MANAK's scope | 200 | `true` | `false` | — |
| RAG service down / timed out | 503 | `false` | — | `RAG_UNAVAILABLE` |
| Model provider down | 502 | `false` | — | `UPSTREAM_UNAVAILABLE` |

The first three failure-to-answer cases are **200 responses**. The frontend must
branch on `data.answerable`, not on the HTTP status, and must render
`insufficientKnowledge.message` plus `insufficientKnowledge.suggestions` — those
suggestions are the product's answer to "what should I do instead". Treating an
unanswerable question as a thrown error discards them.

`RAG_UNAVAILABLE` is the genuinely different case: MANAK does not know whether it
could have answered. The UI must distinguish "we looked and found nothing" from
"we could not look", and retry is only reasonable for the latter.

The `INSUFFICIENT_KNOWLEDGE` error code is **never** returned by any endpoint in
this file. It is reserved for `POST /reports` and `POST /handbook/pdf`, which
produce artifacts and have no honest degraded form.

## Thresholds

From [`shared/types/ai.ts`](../types/ai.ts), shared by the RAG scorer and the UI
badge so the number behind a badge is the number behind the decision:

```ts
MIN_RELEVANCE_SCORE = 0.35;                          // retrieval floor
CONFIDENCE_THRESHOLDS = { high: 0.75, medium: 0.5 }; // badge boundaries
DEFAULT_TOP_K = 6;
confidenceLevelFor(score); // >= 0.75 high, >= 0.5 medium, else low
```

A chunk scoring below `MIN_RELEVANCE_SCORE` is discarded before generation, not
shown with a low badge. If nothing survives the floor, the answer is
`answerable: false` with `reason: 'no_relevant_documents'`. Both layers must call
`confidenceLevelFor()` rather than re-deriving the boundaries — the constant and
the helper live in the shared module precisely so `0.75` appears exactly once in
the codebase.

---

## `POST /ai/query`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | `AIQueryRequest` |
| Success | `ApiSuccess<AIAnswer>` (200) — `meta.durationMs` always present |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `RATE_LIMITED`, `RAG_UNAVAILABLE`, `UPSTREAM_UNAVAILABLE`, `INTERNAL_ERROR` |

Ask a question against the MANAK knowledge base and receive a grounded answer.

### Request body — `AIQueryRequest`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `question` | `string` | yes | 3–1000 characters after trimming. Empty or whitespace-only is a `VALIDATION_ERROR`. |
| `conversationId` | `string` | no | Omit to start a new conversation. An id belonging to another user is `NOT_FOUND`. |
| `language` | `LanguageCode` | no | Answer language. Falls back to `AuthUser.preferredLanguage`, then `en`. |
| `documentTypes` | `KnowledgeDocumentType[]` | no | Narrows retrieval, e.g. `["handbook"]`. Empty array is a `VALIDATION_ERROR` — omit the key instead of sending `[]`, which would mean "retrieve from nothing". |
| `sector` | `string` | no | Biases retrieval toward a sector's corpus. An `IndustrySector` key. |
| `standardId` | `string` | no | Restricts retrieval to one standard's chunks. Used by the "ask about this standard" affordance on the standard detail page. |

`question` is normalised server-side (whitespace collapsed, control characters
stripped) and the normalised form is echoed in `AIAnswer.question`. Clients render
the echo rather than their own input, so the transcript matches what was actually
retrieved against.

Combining `standardId` with `documentTypes` intersects the two filters. A
combination that can match nothing — say `standardId` of a handbook-only document
with `documentTypes: ["standard"]` — yields `answerable: false` with
`reason: 'no_relevant_documents'`, not an error.

### Rate limiting

Per-user, because each call costs an embedding and a completion. Exceeding it is
`RATE_LIMITED` with `Retry-After`. The frontend disables the send control for the
stated interval rather than letting the user hammer it.

### Response notes

- `conversationId` is always populated, including for a brand-new conversation —
  the client stores it and sends it with the next turn.
- `sources` is ordered by descending `relevanceScore`. It is `[]` when
  `answerable` is `false`.
- `citations[].marker` is 1-based and matches the `[1]`, `[2]` markers in
  `answer`. `startOffset`/`endOffset` are **UTF-16 code-unit offsets** into
  `answer` — the indices a JavaScript `slice()` uses — measured against the exact
  string the client renders. Do not transform `answer` (trim, collapse newlines,
  sanitise) before applying offsets, or the highlights will drift. For Indic
  scripts a perceived character may span several code units, so never re-derive
  offsets from a grapheme-segmented view. Multiple citations may share a
  `sourceId`; several markers may point at one document.
- `citations[].sourceId` always matches an `id` in `sources`. A dangling
  `sourceId` is a server bug; clients should skip such a citation rather than
  crash.
- `relatedStandards` may be non-empty even when `answerable` is `false` — "I can't
  answer that, but these standards are adjacent" is useful.
- `suggestedQuestions` is the same shape `GET /ai/suggestions` returns, so
  `SuggestedQuestions.tsx` renders both without a branch.
- `durationMs` inside `data` is the end-to-end pipeline time (retrieval +
  generation) as measured by the RAG layer. `meta.durationMs` is the backend's
  total request time and is therefore always the larger of the two.

### Example — grounded answer (200)

```json
{
  "success": true,
  "data": {
    "conversationId": "cnv_01J8ZR1A2B3C4D5E6F7G8H9J0K",
    "messageId": "msg_01J8ZR1A9K8J7H6G5F4E3D2C1B",
    "question": "What is the moisture limit for packaged wheat atta?",
    "answerable": true,
    "answer": "Packaged wheat atta is covered by IS 1155:1968, which limits moisture to 14.0 percent by mass. The moisture content is determined by the air-oven method given in IS 4333 (Part 2):2002.",
    "sources": [
      {
        "id": "chk_01J8ZR1B0C1D2E3F4G5H6J7K8M",
        "documentId": "doc_01J8ZQZZ1155ATTA000000000",
        "documentTitle": "IS 1155:1968 — Specification for Wheat Atta",
        "documentType": "standard",
        "standardNumber": "IS 1155:1968",
        "section": "4.2 Moisture",
        "pageNumber": 6,
        "excerpt": "The moisture content of wheat atta shall not exceed 14.0 percent by mass when determined by the method prescribed in IS 4333 (Part 2).",
        "relevanceScore": 0.91,
        "url": "/standards/std_01J8ZQZZ1155ATTA000000000",
        "publishedDate": "1968-09-30"
      },
      {
        "id": "chk_01J8ZR1C1D2E3F4G5H6J7K8M9N",
        "documentId": "doc_01J8ZQZZ4333PART2000000000",
        "documentTitle": "IS 4333 (Part 2):2002 — Methods of Analysis for Foodgrains: Moisture",
        "documentType": "testing_requirement",
        "standardNumber": "IS 4333 (Part 2):2002",
        "section": "3.1 Air-oven method",
        "pageNumber": 2,
        "excerpt": "Weigh about 5 g of the prepared sample into a dried dish and heat at 130 +/- 1 degrees C for 2 h.",
        "relevanceScore": 0.74,
        "url": "/standards/std_01J8ZQZZ4333PART2000000000",
        "publishedDate": "2002-04-15"
      }
    ],
    "citations": [
      {
        "marker": 1,
        "sourceId": "chk_01J8ZR1B0C1D2E3F4G5H6J7K8M",
        "startOffset": 0,
        "endOffset": 94,
        "claim": "Packaged wheat atta is covered by IS 1155:1968, which limits moisture to 14.0 percent by mass."
      },
      {
        "marker": 2,
        "sourceId": "chk_01J8ZR1C1D2E3F4G5H6J7K8M9N",
        "startOffset": 95,
        "endOffset": 184,
        "claim": "The moisture content is determined by the air-oven method given in IS 4333 (Part 2):2002."
      }
    ],
    "confidence": {
      "level": "high",
      "score": 0.88,
      "rationale": "Two independent standards agree on the limit and the test method, both retrieved with high similarity."
    },
    "relatedStandards": [
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
    "suggestedQuestions": [
      { "id": "sq_01J8ZR1D2E3F4G5H6J7K8M9N0P", "question": "What ash content is permitted for wheat atta?" },
      { "id": "sq_01J8ZR1E3F4G5H6J7K8M9N0P1Q", "question": "Which packaging and labelling rules apply to atta retail packs?" }
    ],
    "insufficientKnowledge": null,
    "language": "en",
    "durationMs": 2384,
    "createdAt": "2026-08-25T09:52:18.204Z"
  },
  "meta": { "durationMs": 2461 }
}
```

The offsets above are exact: `answer` is 184 characters, the first sentence
occupies `[0, 94)` and the second `[95, 184)`.

### Example — unanswerable, still HTTP 200

```json
{
  "success": true,
  "data": {
    "conversationId": "cnv_01J8ZR2A2B3C4D5E6F7G8H9J0K",
    "messageId": "msg_01J8ZR2A9K8J7H6G5F4E3D2C1B",
    "question": "What is the shelf life limit for cold-pressed groundnut oil in retail packs?",
    "answerable": false,
    "answer": "I could not find a MANAK-indexed standard that sets a shelf-life limit for cold-pressed groundnut oil in retail packs. The closest indexed documents cover labelling and packaging, not shelf life.",
    "sources": [],
    "citations": [],
    "confidence": {
      "level": "low",
      "score": 0.21,
      "rationale": "No retrieved passage cleared the relevance floor of 0.35."
    },
    "relatedStandards": [
      {
        "id": "std_01J8ZQZZ0544GROUNDNUT0000",
        "standardNumber": "IS 544:1968",
        "title": "Groundnut Oil — Specification",
        "relation": "similar_scope"
      }
    ],
    "suggestedQuestions": [],
    "insufficientKnowledge": {
      "reason": "low_relevance",
      "message": "MANAK's indexed standards do not specify a shelf-life limit for this product.",
      "suggestions": [
        "Ask about the quality parameters in IS 544:1968 for groundnut oil.",
        "Check the packaging and labelling requirements instead.",
        "Contact a BIS-recognised testing laboratory for product-specific shelf-life studies."
      ]
    },
    "language": "en",
    "durationMs": 1140,
    "createdAt": "2026-08-25T09:55:41.882Z"
  },
  "meta": { "durationMs": 1197 }
}
```

Note that `answer` is an honest refusal in prose — not an empty string — so the
UI has something to display, and `confidence.level` is `low` with a `score` below
`CONFIDENCE_THRESHOLDS.medium`.

### Example — RAG service unavailable (503)

```json
{
  "success": false,
  "error": {
    "code": "RAG_UNAVAILABLE",
    "message": "The knowledge service is temporarily unavailable. Please try again shortly.",
    "requestId": "req_01J8ZR3B3C4D5E6F7G8H9J0K1M"
  }
}
```

### Example — validation failure (400)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "fields": [
      { "field": "question", "message": "Enter at least 3 characters." },
      { "field": "documentTypes", "message": "Omit this field instead of sending an empty list." }
    ],
    "requestId": "req_01J8ZR3C4D5E6F7G8H9J0K1M2N"
  }
}
```

---

## `GET /ai/conversations`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | query params below |
| Success | `ApiSuccess<AIConversationSummary[]>` (200) with `meta.pagination` |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `INTERNAL_ERROR` |

Lists the caller's conversations, newest activity first. Summaries only — the
sidebar does not need message bodies.

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | `number` | `1` | `PaginationQuery`. |
| `pageSize` | `number` | `12` | `DEFAULT_PAGE_SIZE`; max `100`. |
| `search` | `string` | — | Case-insensitive match on `title`. |
| `sortBy` | `'updatedAt'` | `updatedAt` | Only value accepted. |
| `sortDir` | `'asc' \| 'desc'` | `desc` | |

`AIConversationSummary` carries `id`, `title`, `messageCount`,
`lastMessagePreview`, `updatedAt`. `title` is derived server-side from the first
question and truncated; `lastMessagePreview` is a plain-text truncation of the
most recent message with citation markers stripped, safe to render in one line.

There is no `createdAt` on `AIConversationSummary`. Sort and group by
`updatedAt`; the full `AIConversation` has both.

An empty result is 200 with `data: []` and a truthful `pagination` block.

**Success — 200**

```json
{
  "success": true,
  "data": [
    {
      "id": "cnv_01J8ZR1A2B3C4D5E6F7G8H9J0K",
      "title": "Moisture limit for packaged wheat atta",
      "messageCount": 4,
      "lastMessagePreview": "The moisture content is determined by the air-oven method given in IS 4333 (Part 2):2002.",
      "updatedAt": "2026-08-25T09:52:18.204Z"
    },
    {
      "id": "cnv_01J8ZQY9Z8Y7X6W5V4U3T2S1R0",
      "title": "ISI mark application steps",
      "messageCount": 2,
      "lastMessagePreview": "Stage 3 is the factory inspection, which typically takes 10 to 15 working days.",
      "updatedAt": "2026-08-24T16:03:55.010Z"
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

**Failure — 400**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "fields": [{ "field": "pageSize", "message": "pageSize cannot exceed 100." }],
    "requestId": "req_01J8ZR4D5E6F7G8H9J0K1M2N3P"
  }
}
```

---

## `GET /ai/conversations/:id`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Path params | `id: string` — conversation id |
| Success | `ApiSuccess<AIConversation>` (200) |
| Errors | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR` |

Returns one conversation with its full message list, ordered oldest first so the
transcript renders top to bottom without client-side sorting.

`AIMessage.answer` is the complete `AIAnswer` for assistant messages and `null`
for user messages — the discriminant is `role`, and the client should branch on
`role === 'assistant'` rather than on `answer !== null`. Replaying a stored
`AIAnswer` renders identically to the live response, including sources,
citations, and confidence, which is why the full object is persisted rather than
just the prose.

A conversation owned by another user is `NOT_FOUND`.

**Success — 200**

```json
{
  "success": true,
  "data": {
    "id": "cnv_01J8ZR1A2B3C4D5E6F7G8H9J0K",
    "title": "Moisture limit for packaged wheat atta",
    "language": "en",
    "createdAt": "2026-08-25T09:51:02.117Z",
    "updatedAt": "2026-08-25T09:52:18.204Z",
    "messages": [
      {
        "id": "msg_01J8ZR1A0A0A0A0A0A0A0A0A0A",
        "role": "user",
        "content": "What is the moisture limit for packaged wheat atta?",
        "answer": null,
        "createdAt": "2026-08-25T09:51:02.117Z"
      },
      {
        "id": "msg_01J8ZR1A9K8J7H6G5F4E3D2C1B",
        "role": "assistant",
        "content": "Packaged wheat atta is covered by IS 1155:1968, which limits moisture to 14.0 percent by mass. The moisture content is determined by the air-oven method given in IS 4333 (Part 2):2002.",
        "answer": {
          "conversationId": "cnv_01J8ZR1A2B3C4D5E6F7G8H9J0K",
          "messageId": "msg_01J8ZR1A9K8J7H6G5F4E3D2C1B",
          "question": "What is the moisture limit for packaged wheat atta?",
          "answerable": true,
          "answer": "Packaged wheat atta is covered by IS 1155:1968, which limits moisture to 14.0 percent by mass. The moisture content is determined by the air-oven method given in IS 4333 (Part 2):2002.",
          "sources": [
            {
              "id": "chk_01J8ZR1B0C1D2E3F4G5H6J7K8M",
              "documentId": "doc_01J8ZQZZ1155ATTA000000000",
              "documentTitle": "IS 1155:1968 — Specification for Wheat Atta",
              "documentType": "standard",
              "standardNumber": "IS 1155:1968",
              "section": "4.2 Moisture",
              "pageNumber": 6,
              "excerpt": "The moisture content of wheat atta shall not exceed 14.0 percent by mass when determined by the method prescribed in IS 4333 (Part 2).",
              "relevanceScore": 0.91,
              "url": "/standards/std_01J8ZQZZ1155ATTA000000000",
              "publishedDate": "1968-09-30"
            }
          ],
          "citations": [
            {
              "marker": 1,
              "sourceId": "chk_01J8ZR1B0C1D2E3F4G5H6J7K8M",
              "startOffset": 0,
              "endOffset": 94,
              "claim": "Packaged wheat atta is covered by IS 1155:1968, which limits moisture to 14.0 percent by mass."
            }
          ],
          "confidence": {
            "level": "high",
            "score": 0.88,
            "rationale": "Two independent standards agree on the limit and the test method."
          },
          "relatedStandards": [],
          "suggestedQuestions": [],
          "insufficientKnowledge": null,
          "language": "en",
          "durationMs": 2384,
          "createdAt": "2026-08-25T09:52:18.204Z"
        },
        "createdAt": "2026-08-25T09:52:18.204Z"
      }
    ]
  }
}
```

`AIMessage.content` duplicates `answer.answer` for assistant messages by design:
`content` is the renderable text for any message regardless of role, so a plain
transcript view needs no branch, while `answer` carries the provenance for the
rich view.

**Failure — 404**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Conversation not found.",
    "requestId": "req_01J8ZR5E6F7G8H9J0K1M2N3P4Q"
  }
}
```

---

## `DELETE /ai/conversations/:id`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Path params | `id: string` |
| Success | `ApiSuccess<AcknowledgementResponse>` (200) |
| Errors | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR` |

Deletes the conversation and its messages. Not idempotent in the HTTP-purist
sense — a second delete of the same id returns `NOT_FOUND`, which lets the UI
distinguish "removed just now" from "was never yours".

Deleting a conversation does not delete a `SavedResource` of kind `ai_answer`
that points at one of its messages. Saved answers are independently retained
copies; that is the point of saving one.

**Success — 200**

```json
{
  "success": true,
  "data": { "acknowledged": true, "message": "Conversation deleted." }
}
```

**Failure — 404**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Conversation not found.",
    "requestId": "req_01J8ZR6F7G8H9J0K1M2N3P4Q5R"
  }
}
```

---

## `GET /ai/suggestions`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | query params below |
| Success | `ApiSuccess<SuggestedQuestion[]>` (200) |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `RAG_UNAVAILABLE`, `INTERNAL_ERROR` |

Seeds the empty state of the AI panel with questions the corpus can actually
answer. Every returned question is drawn from indexed content, so a user who taps
one gets a grounded answer rather than an immediate `answerable: false` — an
empty state that leads to a refusal is worse than no empty state.

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `sector` | `string` | caller's org sector | Biases suggestions. An `IndustrySector` key. |
| `standardId` | `string` | — | Suggestions about one standard, for the detail page. |
| `language` | `LanguageCode` | caller's `preferredLanguage` | Language of the returned question text. |
| `limit` | `number` | `6` | 1–12. Outside that range is a `VALIDATION_ERROR`. |

Not paginated — it is a fixed-size seed list, so there is no `meta.pagination`.
An organization caller with no `sector` filter gets suggestions biased to its own
sector automatically.

Returns `[]` rather than an error when the corpus is too thin to suggest anything;
the frontend then shows the plain prompt with no chips.

**Success — 200**

```json
{
  "success": true,
  "data": [
    { "id": "sq_01J8ZR7A1B2C3D4E5F6G7H8J9K", "question": "Which standards apply to cotton knitted fabric for garments?" },
    { "id": "sq_01J8ZR7B2C3D4E5F6G7H8J9K0M", "question": "What colour fastness grades does IS 15702 require?" },
    { "id": "sq_01J8ZR7C3D4E5F6G7H8J9K0M1N", "question": "How do I apply for the ISI mark for textile products?" }
  ],
  "meta": { "durationMs": 88 }
}
```

**Failure — 400**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields need attention.",
    "fields": [{ "field": "limit", "message": "limit must be between 1 and 12." }],
    "requestId": "req_01J8ZR7D4E5F6G7H8J9K0M1N2P"
  }
}
```

---

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-08-25 | Initial contract. Settled `answerable: false` as HTTP 200 and reserved `INSUFFICIENT_KNOWLEDGE` for artifact endpoints. |
