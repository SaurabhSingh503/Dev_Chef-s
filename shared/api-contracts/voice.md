# Voice — API contract

| | |
| --- | --- |
| Contract version | 1.0.0 |
| Base path | `/api/v1/voice` |
| Shared types | [`shared/types/voice.ts`](../types/voice.ts), [`shared/types/ai.ts`](../types/ai.ts) |
| Backend files | `routes/voice.routes.ts`, `controllers/voice.controller.ts`, `services/voice.service.ts`, `middleware/upload.middleware.ts` |
| Frontend files | `services/voiceApi.ts`, `hooks/useVoice.ts`, `components/voice/*` |

Voice is a first-class MANAK affordance, not a gimmick. Many of the people who
most need standards information are more comfortable speaking a regional language
than typing it, and typing Devanagari or Tamil on a phone keyboard is a real
barrier. So speech in, grounded answer out, speech back.

Speech-to-text and text-to-speech both run **server-side**. The browser records
audio and plays audio; it never holds a provider key. A design in which the
frontend calls a speech API directly is a security regression, not an
optimisation. See [`docs/VOICE_AI.md`](../../docs/VOICE_AI.md) for the client state
machine and [`docs/MULTILINGUAL.md`](../../docs/MULTILINGUAL.md) for language
handling.

## Endpoint summary

| Method | Path | Auth | Request | Success |
| --- | --- | --- | --- | --- |
| `POST` | `/voice/transcribe` | auth | `TranscribeRequest` (JSON or multipart) | `ApiSuccess<TranscribeResponse>` (200) |
| `POST` | `/voice/synthesize` | auth | `SynthesizeRequest` | `ApiSuccess<SynthesizeResponse>` (200) |
| `POST` | `/voice/query` | auth | `VoiceQueryRequest` *(inline)* | `ApiSuccess<VoiceQueryResponse>` (200) |

All three require a token of any role. Voice costs money per call, so all three
are rate limited per user more tightly than text endpoints.

## Limits and formats

```ts
MAX_RECORDING_SECONDS = 60;   // shared/types/voice.ts
WAVEFORM_BAR_COUNT = 48;      // visualiser only, never sent over the wire
type AudioFormat = 'webm' | 'mp4' | 'wav' | 'ogg';
```

| Limit | Value | Violation |
| --- | --- | --- |
| Recording duration | 60 s (`MAX_RECORDING_SECONDS`) | `PAYLOAD_TOO_LARGE` |
| Encoded upload size | 8 MB | `PAYLOAD_TOO_LARGE` |
| Container | one of `AudioFormat` | `UNSUPPORTED_MEDIA_TYPE` |
| `SynthesizeRequest.text` | 4000 characters | `VALIDATION_ERROR` |

`format` is a **declared** field, not sniffed from the bytes. If the declared
format and the actual container disagree, the response is
`UNSUPPORTED_MEDIA_TYPE` rather than a confusing downstream failure. Browser
`MediaRecorder` typically produces `webm` on Chromium and `mp4` on Safari, so
clients must read the real MIME type from the `MediaRecorder` instance instead of
hard-coding `webm`.

`WaveformSamples` (`number[]`, normalised 0..1) and `VoiceSessionStatus`
(`idle | recording | transcribing | thinking | speaking | error`) are client-side
types. They appear in `shared/types/voice.ts` so both layers agree on the
vocabulary, but neither crosses the wire.

## Two upload encodings, one route

`TranscribeRequest.audioBase64` is optional precisely because each route accepts
two encodings:

| `Content-Type` | Body |
| --- | --- |
| `application/json` | `TranscribeRequest` with `audioBase64` populated. |
| `multipart/form-data` | File part `audio`, plus text parts `format` and optionally `language`. `audioBase64` is omitted. |

Multipart is preferred for anything beyond a couple of seconds — base64 inflates
the payload by roughly a third and has to be buffered as a string. JSON exists
because it composes with the rest of the API and is far easier to test with
`curl`. A JSON body with `audioBase64` absent is a `VALIDATION_ERROR`; the field
is optional in the type only to accommodate the multipart path.

Any other `Content-Type` is `UNSUPPORTED_MEDIA_TYPE`.

---

## `POST /voice/transcribe`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | `TranscribeRequest` |
| Success | `ApiSuccess<TranscribeResponse>` (200) |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL_ERROR` |

Speech to text only. No retrieval, no generation. Used when the user wants to
dictate into the text box and edit before sending — which matters because
recognisers mishear technical strings like "IS 1155" and the user should get a
chance to fix it.

### Request — `TranscribeRequest`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `audioBase64` | `string` | JSON path only | Base64, no data-URI prefix. Send the raw base64, not `data:audio/webm;base64,...`. |
| `format` | `AudioFormat` | yes | Declared container. |
| `language` | `LanguageCode` | no | A **hint**. Omit for auto-detection. |

### Response — `TranscribeResponse`

| Field | Type | Notes |
| --- | --- | --- |
| `transcript` | `string` | May be `""` for silence — a valid 200, not an error. |
| `detectedLanguage` | `LanguageCode` | What the recogniser actually heard. **May differ from the `language` hint.** |
| `confidence` | `number` | 0..1 recogniser confidence, unrelated to `AIConfidence`. |
| `durationMs` | `number` | Audio length, not processing time. |

`detectedLanguage` is always one of `SUPPORTED_LANGUAGES`. Speech in a language
MANAK does not support is mapped to the nearest supported code with a low
`confidence`; the frontend should surface a "we heard X, is that right?"
affordance below roughly 0.6 rather than silently proceeding.

An empty `transcript` with a low `confidence` is how "silence or noise" arrives.
`components/voice/VoiceTranscript.tsx` renders a retry prompt for that case.

**Request (JSON)**

```json
{
  "audioBase64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=",
  "format": "webm",
  "language": "hi"
}
```

**Success — 200**

```json
{
  "success": true,
  "data": {
    "transcript": "गेहूं के आटे में नमी की सीमा क्या है",
    "detectedLanguage": "hi",
    "confidence": 0.93,
    "durationMs": 4120
  },
  "meta": { "durationMs": 1380 }
}
```

**Failure — 413**

```json
{
  "success": false,
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Recordings are limited to 60 seconds. Please record a shorter question.",
    "requestId": "req_01J8ZS1A2B3C4D5E6F7G8H9J0K"
  }
}
```

**Failure — 415**

```json
{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_MEDIA_TYPE",
    "message": "Unsupported audio format. Use webm, mp4, wav, or ogg.",
    "requestId": "req_01J8ZS1B3C4D5E6F7G8H9J0K1M"
  }
}
```

---

## `POST /voice/synthesize`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | `SynthesizeRequest` |
| Success | `ApiSuccess<SynthesizeResponse>` (200) |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL_ERROR` |

Text to speech. Used by `VoicePlayer.tsx` to read an existing answer aloud —
typically when a user read an answer, then wanted to hear it.

### Request — `SynthesizeRequest`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `text` | `string` | yes | 1–4000 characters. |
| `language` | `LanguageCode` | **yes** | Required here, unlike elsewhere: a synthesiser cannot guess a voice. |
| `voice` | `'default' \| 'female' \| 'male'` | no | Named preset. The server maps it to the provider's voice id — provider voice ids never appear in the contract or the client. |

Callers should strip citation markers (`[1]`, `[2]`) and Markdown before sending
`AIAnswer.answer` for synthesis; "bracket one" read aloud is noise. The backend
performs the same normalisation defensively, so a client that forgets still gets
clean audio.

### Response — `SynthesizeResponse`

| Field | Type | Notes |
| --- | --- | --- |
| `audioBase64` | `string` | Raw base64, no data-URI prefix. The client builds the data URI or a `Blob` itself. |
| `format` | `AudioFormat` | Whatever the provider produced; do not assume it matches any request format. |
| `durationMs` | `number` | Length of the generated audio. |

Long text produces a large base64 string. Clients should decode to a `Blob` and
use `URL.createObjectURL` rather than assigning a multi-megabyte data URI to
`audio.src`.

**Request**

```json
{
  "text": "Packaged wheat atta is covered by IS 1155:1968, which limits moisture to 14.0 percent by mass.",
  "language": "en",
  "voice": "female"
}
```

**Success — 200**

```json
{
  "success": true,
  "data": {
    "audioBase64": "SUQzBAAAAAABMVRYWFgAAAASAAADbWFqb3JfYnJhbmQAAAAA",
    "format": "mp4",
    "durationMs": 7240
  },
  "meta": { "durationMs": 910 }
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
      { "field": "text", "message": "Text must be between 1 and 4000 characters." },
      { "field": "language", "message": "language is required for synthesis." }
    ],
    "requestId": "req_01J8ZS2C4D5E6F7G8H9J0K1M2N"
  }
}
```

**Failure — 502**

```json
{
  "success": false,
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "message": "Speech generation is temporarily unavailable. The written answer is still available.",
    "requestId": "req_01J8ZS2D5E6F7G8H9J0K1M2N3P"
  }
}
```

Synthesis failure must never block the answer. `VoiceModal.tsx` shows the
transcript and the written answer with the audio control disabled.

---

## `POST /voice/query`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | `VoiceQueryRequest` — **no shared type yet; frozen below** |
| Success | `ApiSuccess<VoiceQueryResponse>` (200) |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `RATE_LIMITED`, `RAG_UNAVAILABLE`, `UPSTREAM_UNAVAILABLE`, `INTERNAL_ERROR` |

The full round trip in one call: transcribe, retrieve, generate, synthesise. One
request instead of three, because three sequential round trips on a slow mobile
connection is the difference between usable and not.

### Request — frozen shape

`shared/types/voice.ts` defines `VoiceQueryResponse` but not the request. This is
the frozen shape; both layers implement exactly this:

```ts
// Frozen in this contract. Canonical home when needed in TS: shared/types/voice.ts
interface VoiceQueryRequest {
  /** Base64 audio (JSON path). Omit when uploading multipart. */
  audioBase64?: string;
  format: AudioFormat;
  /** Recogniser hint; omit to auto-detect. */
  language?: LanguageCode;

  /** Continue an existing AI conversation. Omit to start a new one. */
  conversationId?: string;
  /** Narrow retrieval, as AIQueryRequest.documentTypes. */
  documentTypes?: KnowledgeDocumentType[];
  sector?: string;
  standardId?: string;

  /** Default true. When false the response's audioBase64 is null. */
  speak?: boolean;
}
```

The audio fields mirror `TranscribeRequest`; the retrieval fields mirror
`AIQueryRequest` minus `question`, which comes from the audio. Both encodings from
["Two upload encodings"](#two-upload-encodings-one-route) apply; in multipart,
the non-audio fields are text parts and `documentTypes` is repeated once per
value.

`speak: false` is for a client that will display the answer but not play it —
worth using, since skipping synthesis removes a second or two of latency.

### Response — `VoiceQueryResponse`

| Field | Type | Notes |
| --- | --- | --- |
| `transcript` | `string` | What was heard, after normalisation. |
| `detectedLanguage` | `LanguageCode` | Drives the answer language unless overridden. |
| `answer` | `AIAnswer` | The identical shape `POST /ai/query` returns. |
| `audioBase64` | `string \| null` | Spoken answer, or `null` when `speak: false`. |

Language resolution, in order: `detectedLanguage` wins, because a user who spoke
Hindi wants a Hindi answer regardless of their interface setting. The `language`
hint only assists recognition. `answer.language` reports the language actually
used, and the frontend should trust that field rather than assuming.

`answer` obeys every rule in [`ai.md`](./ai.md), including the important one:

> **An unanswerable voice question is still HTTP 200.** `answer.answerable` is
> `false`, `answer.insufficientKnowledge` is populated, `sources` and `citations`
> are `[]`. When `speak` is true, `audioBase64` contains the refusal read aloud —
> a user who asked by voice deserves the answer by voice, including the honest
> "I don't have that".

If transcription succeeds but synthesis fails, the response is still 200 with
`audioBase64: null` and a complete `answer`. Partial degradation beats losing the
answer. Only a transcription failure fails the whole request.

`VoiceQueryResponse` has no `durationMs`; per-stage timing is in
`answer.durationMs` (pipeline) and `meta.durationMs` (whole request).

**Request (JSON)**

```json
{
  "audioBase64": "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAHF",
  "format": "webm",
  "language": "hi",
  "sector": "food_processing",
  "speak": true
}
```

**Success — 200**

```json
{
  "success": true,
  "data": {
    "transcript": "गेहूं के आटे में नमी की सीमा क्या है",
    "detectedLanguage": "hi",
    "answer": {
      "conversationId": "cnv_01J8ZS3A2B3C4D5E6F7G8H9J0K",
      "messageId": "msg_01J8ZS3A9K8J7H6G5F4E3D2C1B",
      "question": "गेहूं के आटे में नमी की सीमा क्या है",
      "answerable": true,
      "answer": "पैकबंद गेहूं के आटे पर IS 1155:1968 लागू होता है, जिसमें नमी की अधिकतम सीमा 14.0 प्रतिशत (द्रव्यमान के अनुसार) है।",
      "sources": [
        {
          "id": "chk_01J8ZS3B0C1D2E3F4G5H6J7K8M",
          "documentId": "doc_01J8ZQZZ1155ATTA000000000",
          "documentTitle": "IS 1155:1968 — Specification for Wheat Atta",
          "documentType": "standard",
          "standardNumber": "IS 1155:1968",
          "section": "4.2 Moisture",
          "pageNumber": 6,
          "excerpt": "The moisture content of wheat atta shall not exceed 14.0 percent by mass.",
          "relevanceScore": 0.9,
          "url": "/standards/std_01J8ZQZZ1155ATTA000000000",
          "publishedDate": "1968-09-30"
        }
      ],
      "citations": [
        {
          "marker": 1,
          "sourceId": "chk_01J8ZS3B0C1D2E3F4G5H6J7K8M",
          "startOffset": 0,
          "endOffset": 114,
          "claim": "पैकबंद गेहूं के आटे पर IS 1155:1968 लागू होता है, जिसमें नमी की अधिकतम सीमा 14.0 प्रतिशत (द्रव्यमान के अनुसार) है।"
        }
      ],
      "confidence": {
        "level": "high",
        "score": 0.87,
        "rationale": "स्रोत दस्तावेज़ में सीमा स्पष्ट रूप से दी गई है।"
      },
      "relatedStandards": [],
      "suggestedQuestions": [
        { "id": "sq_01J8ZS3C1D2E3F4G5H6J7K8M9N", "question": "आटे में राख की अनुमत मात्रा कितनी है?" }
      ],
      "insufficientKnowledge": null,
      "language": "hi",
      "durationMs": 3110,
      "createdAt": "2026-08-25T10:07:44.512Z"
    },
    "audioBase64": "SUQzBAAAAAABMVRYWFgAAAASAAADbWFqb3JfYnJhbmQAAAAA"
  },
  "meta": { "durationMs": 5240 }
}
```

The `claim` here is the whole answer string, and the citation spans `[0, 114)` —
its length in UTF-16 code units, which is what a JavaScript `string.length` and
`slice()` see. Offsets are always UTF-16 code units, computed against the exact
`answer` string the client renders. This matters for Indic scripts: a combining
mark is its own code unit, so a Devanagari cluster the user perceives as one
character can span several offsets. Never re-derive offsets from a
grapheme-segmented view of the text.

**Success — 200, unanswerable**

```json
{
  "success": true,
  "data": {
    "transcript": "सोने के आभूषण की कीमत आज क्या है",
    "detectedLanguage": "hi",
    "answer": {
      "conversationId": "cnv_01J8ZS4A2B3C4D5E6F7G8H9J0K",
      "messageId": "msg_01J8ZS4A9K8J7H6G5F4E3D2C1B",
      "question": "सोने के आभूषण की कीमत आज क्या है",
      "answerable": false,
      "answer": "MANAK मानकों और प्रमाणन की जानकारी देता है; सोने का बाज़ार भाव इसमें शामिल नहीं है।",
      "sources": [],
      "citations": [],
      "confidence": {
        "level": "low",
        "score": 0.08,
        "rationale": "प्रश्न MANAK के दायरे से बाहर है।"
      },
      "relatedStandards": [],
      "suggestedQuestions": [],
      "insufficientKnowledge": {
        "reason": "out_of_scope",
        "message": "MANAK मानक, परीक्षण और प्रमाणन से जुड़े प्रश्नों के उत्तर देता है।",
        "suggestions": [
          "हॉलमार्किंग और HUID के बारे में पूछें।",
          "सोने की शुद्धता के मानक कौन से हैं, यह पूछें।"
        ]
      },
      "language": "hi",
      "durationMs": 640,
      "createdAt": "2026-08-25T10:11:02.331Z"
    },
    "audioBase64": "SUQzBAAAAAABMVRYWFgAAAASAAADbWFqb3JfYnJhbmQAAAAB"
  },
  "meta": { "durationMs": 1980 }
}
```

**Failure — 503**

```json
{
  "success": false,
  "error": {
    "code": "RAG_UNAVAILABLE",
    "message": "The knowledge service is temporarily unavailable. Your recording was understood but could not be answered.",
    "requestId": "req_01J8ZS4B3C4D5E6F7G8H9J0K1M"
  }
}
```

---

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-08-25 | Initial contract. `VoiceQueryRequest` frozen inline pending a shared type. |
