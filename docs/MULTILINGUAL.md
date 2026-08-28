# Multilingual Support

STATUS: IMPLEMENTED

## Localization Architecture
MANAK uses a lightweight React Context architecture for UI localization, avoiding heavy external dependencies.

- **`LanguageContext.tsx`**: Provides the global language state and `t()` translation function.
- **`translations.ts`**: Contains typed dictionaries mapping string keys to `en` (English) and `hi` (Hindi) values.
- **`LanguageSelector.tsx`**: A responsive `EN | हिन्दी` toggle injected into the navigation headers.

## Supported Languages
- English (`en`)
- Hindi (`hi`)

## Persistence
Language preferences are stored in the client's `localStorage` (`manak_language`) to ensure they survive browser refreshes and page navigation. Language preference is **not** stored in the database, nor in the AI conversational history records.

## Translation Scope
- **Translated**: The entire application UI chrome including Navigation, Dashboard panels, AI chat controls, Authentication flows, Error messages, Form Validation, and Empty states.
- **Not Translated**: Dynamic RAG/database source content is strictly preserved in its original form. This includes Standard titles and descriptions, Laboratory names, Report content, Handbook content, and user-generated conversational history.

## AI Language Propagation
The RAG service natively utilizes localized prompt injection for answering. The frontend `aiApi.ask` call captures the currently selected language from the Context and propagates it to the backend `ragService`, ensuring the backend generates appropriate semantic context without requiring any API contract overhauls.
