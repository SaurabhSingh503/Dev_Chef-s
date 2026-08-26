# Authentication — API contract

| | |
| --- | --- |
| Contract version | 1.0.1 |
| Base path | `/api/v1/auth` |
| Shared types | [`shared/types/auth.ts`](../types/auth.ts), [`shared/types/api.ts`](../types/api.ts) |
| Backend files | `routes/auth.routes.ts`, `controllers/auth.controller.ts`, `services/auth.service.ts`, `validators/auth.validator.ts` |
| Frontend files | `services/authApi.ts`, `context/AuthContext.tsx`, `hooks/useAuth.ts` |

Identity is issued by Supabase Auth. The backend is the only tier that talks to
Supabase with elevated privileges; the browser holds nothing but the tokens
returned by these endpoints. Tokens are never minted client-side. See
[`docs/AUTHENTICATION.md`](../../docs/AUTHENTICATION.md) for the full flow and the
key-handling rules.

Every response uses the standard envelope described in [`README.md`](./README.md).

## Endpoint summary

| Method | Path | Auth | Request | Success |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/register/individual` | public | `IndividualRegisterRequest` | `ApiSuccess<AuthResponse>` (201) |
| `POST` | `/auth/register/organization` | public | `OrganizationRegisterRequest` | `ApiSuccess<AuthResponse>` (201) |
| `POST` | `/auth/login` | public | `LoginRequest` | `ApiSuccess<AuthResponse>` (200) |
| `POST` | `/auth/google` | public | `GoogleAuthRequest` *(inline)* | `ApiSuccess<AuthResponse>` (200) |
| `POST` | `/auth/logout` | auth | *(empty)* | `ApiSuccess<AcknowledgementResponse>` (200) |
| `GET` | `/auth/me` | auth | — | `ApiSuccess<CurrentUserResponse>` (200) |
| `PATCH` | `/auth/me` | auth | `UpdateProfileRequest` | `ApiSuccess<CurrentUserResponse>` (200) |
| `POST` | `/auth/forgot-password` | public | `ForgotPasswordRequest` | `ApiSuccess<AcknowledgementResponse>` (202) |
| `POST` | `/auth/reset-password` | public | `ResetPasswordRequest` | `ApiSuccess<AcknowledgementResponse>` (200) |

`AuthResponse` is a type alias for `AuthSession`, and `CurrentUserResponse` is an
alias for `AuthUser`. Both aliases are used in the tables below because they name
the intent, but the wire shape is `AuthSession` / `AuthUser` exactly.

## Password policy

Enforced identically on both sides — the frontend validator in
`frontend/src/lib/validators.ts` and the backend validator in
`backend/src/validators/auth.validator.ts` both import the same constants:

```ts
PASSWORD_MIN_LENGTH = 8;
PASSWORD_POLICY_HINT = 'At least 8 characters, including one letter and one number.';
```

At least 8 characters, at least one letter, at least one digit. The frontend
check is a courtesy that saves a round trip; the backend check is the one that
counts, and it runs on `register/*` and `reset-password`. A violation is a
`VALIDATION_ERROR` whose `fields[].message` is `PASSWORD_POLICY_HINT`, so the
wording never drifts between the two layers.

---

## `POST /auth/register/individual`

| | |
| --- | --- |
| Auth | public |
| Roles | — |
| Request | `IndividualRegisterRequest` |
| Success | `ApiSuccess<AuthResponse>` — **201 Created** |
| Errors | `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL_ERROR` |

Creates an individual account. `role` is a literal discriminant and must be the
string `"individual"`; the server does not infer it from the path, because the
same union is validated on both sides and an absent discriminant would make
`RegisterRequest` unnarrowable.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `role` | `'individual'` | yes | Literal. |
| `email` | `string` | yes | Lowercased and trimmed before storage. |
| `password` | `string` | yes | Password policy above. |
| `fullName` | `string` | yes | 2–120 characters after trimming. |
| `preferredLanguage` | `LanguageCode` | no | Defaults to `en`. |
| `pincode` | `string` | no | Six digits. Powers pincode-based facility discovery. |

The new account is created with `status: 'pending_verification'` and a
verification email is sent. A session is still returned so the frontend can show
a "verify your email" state with the user's name rather than bouncing to login —
but note that `auth.middleware` rejects a non-`active` account on protected
routes with `FORBIDDEN`, so this session cannot be used to read protected data
until verification completes.

An already-registered email is `CONFLICT` (409). The response deliberately does
not reveal whether the existing account belongs to an individual or an
organization.

**Request**

```json
{
  "role": "individual",
  "email": "asha.menon@example.in",
  "password": "atta1968flour",
  "fullName": "Asha Menon",
  "preferredLanguage": "ta",
  "pincode": "600042"
}
```

**Success — 201**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.PLACEHOLDER.access",
    "refreshToken": "v1.PLACEHOLDER.refresh",
    "expiresAt": "2026-08-25T10:14:02.000Z",
    "user": {
      "id": "usr_01J8ZQ4K7X9V2N3P4R5S6T7U8V",
      "email": "asha.menon@example.in",
      "fullName": "Asha Menon",
      "role": "individual",
      "status": "pending_verification",
      "preferredLanguage": "ta",
      "avatarUrl": null,
      "organizationId": null,
      "createdAt": "2026-08-25T09:14:02.481Z"
    }
  }
}
```

**Failure — 409**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "An account already exists for this email address.",
    "requestId": "req_01J8ZQ5M2A4B6C8D0E2F4G6H8J"
  }
}
```

---

## `POST /auth/register/organization`

| | |
| --- | --- |
| Auth | public |
| Roles | — |
| Request | `OrganizationRegisterRequest` |
| Success | `ApiSuccess<AuthResponse>` — **201 Created** |
| Errors | `VALIDATION_ERROR`, `CONFLICT`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `INTERNAL_ERROR` |

Creates an organization account *and* the `OrganizationDetail` row it owns, in one
transaction. The returned `AuthUser.organizationId` is non-null — it is the id the
`/organization/*` endpoints operate on.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `role` | `'organization'` | yes | Literal. |
| `email` | `string` | yes | Becomes both the login and the initial `contactEmail`. |
| `password` | `string` | yes | Password policy above. |
| `fullName` | `string` | yes | The signing-up person, not the company. |
| `preferredLanguage` | `LanguageCode` | no | Defaults to `en`. |
| `organizationName` | `string` | yes | 2–200 characters. |
| `sector` | `string` | yes | An `IndustrySector` key, e.g. `food_processing`. |
| `registrationNumber` | `string` | yes | GSTIN or equivalent registry id. |
| `contactPhone` | `string` | yes | E.164 or a 10-digit Indian number. |
| `pincode` | `string` | yes | Six digits. Required here, optional for individuals. |
| `address` | `string` | yes | Free text, up to 500 characters. |

`sector` is validated against `INDUSTRY_SECTORS` from
[`shared/types/users.ts`](../types/users.ts); anything else is a
`VALIDATION_ERROR` on `sector`. The new organization starts at
`verificationStatus: 'unverified'` — MANAK does not claim to have checked a GSTIN
it has not checked. An admin moves it to `in_review` and then `verified`.

**Request**

```json
{
  "role": "organization",
  "email": "compliance@sundarammills.in",
  "password": "textile2026grade",
  "fullName": "R. Sundaram",
  "preferredLanguage": "en",
  "organizationName": "Sundaram Mills Private Limited",
  "sector": "textiles",
  "registrationNumber": "33AABCS1429L1ZT",
  "contactPhone": "+914428412200",
  "pincode": "641604",
  "address": "18 Mill Road, Tirupur, Tamil Nadu"
}
```

**Success — 201**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.PLACEHOLDER.access",
    "refreshToken": "v1.PLACEHOLDER.refresh",
    "expiresAt": "2026-08-25T10:20:11.000Z",
    "user": {
      "id": "usr_01J8ZQ6N3B5C7D9E1F3G5H7J9K",
      "email": "compliance@sundarammills.in",
      "fullName": "R. Sundaram",
      "role": "organization",
      "status": "pending_verification",
      "preferredLanguage": "en",
      "avatarUrl": null,
      "organizationId": "org_01J8ZQ6N4C6D8E0F2G4H6J8K0M",
      "createdAt": "2026-08-25T09:20:11.902Z"
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
      { "field": "sector", "message": "Choose one of the listed industry sectors." },
      { "field": "pincode", "message": "Enter a six-digit pincode." },
      { "field": "password", "message": "At least 8 characters, including one letter and one number." }
    ],
    "requestId": "req_01J8ZQ6P5D7E9F1G3H5J7K9M1N"
  }
}
```

---

## `POST /auth/login`

| | |
| --- | --- |
| Auth | public |
| Roles | — |
| Request | `LoginRequest` |
| Success | `ApiSuccess<AuthResponse>` (200) |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE` |

| Field | Type | Required |
| --- | --- | --- |
| `email` | `string` | yes |
| `password` | `string` | yes |

Wrong email and wrong password produce the *same* `UNAUTHENTICATED` response with
the same message — the endpoint is not an account-existence oracle. A correct
credential pair for a `suspended` account returns `FORBIDDEN`, because in that
case telling the user why is the helpful thing and the account is already known
to them.

Login is rate limited per IP and per email. Exceeding it is `RATE_LIMITED` with a
`Retry-After` header.

**Request**

```json
{ "email": "asha.menon@example.in", "password": "atta1968flour" }
```

**Success — 200**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.PLACEHOLDER.access",
    "refreshToken": "v1.PLACEHOLDER.refresh",
    "expiresAt": "2026-08-25T10:31:44.000Z",
    "user": {
      "id": "usr_01J8ZQ4K7X9V2N3P4R5S6T7U8V",
      "email": "asha.menon@example.in",
      "fullName": "Asha Menon",
      "role": "individual",
      "status": "active",
      "preferredLanguage": "ta",
      "avatarUrl": "https://cdn.example.in/avatars/usr_01J8ZQ4K.png",
      "organizationId": null,
      "createdAt": "2026-08-25T09:14:02.481Z"
    }
  }
}
```

**Failure — 401**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Email or password is incorrect.",
    "requestId": "req_01J8ZQ7Q6E8F0G2H4J6K8M0N2P"
  }
}
```

---

## `POST /auth/google`

| | |
| --- | --- |
| Auth | public |
| Roles | — |
| Request | `GoogleAuthRequest` |
| Success | `ApiSuccess<AuthResponse>` (200 existing user, 201 first sign-in) |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `CONFLICT`, `UPSTREAM_UNAVAILABLE` |

Exchanges a Google OAuth credential for a MANAK session. The browser completes the
Google flow via the Supabase JS client and posts the resulting credential here;
the backend verifies it against Supabase, then creates or loads the MANAK profile
row. The browser never sees a MANAK service-role key at any point.

`shared/types/auth.ts` defines both the response (`AuthResponse`) and the request
(`GoogleAuthRequest`). Both layers import it rather than restating it:

```ts
// shared/types/auth.ts
interface GoogleAuthRequest {
  /** Google ID token (JWT) obtained by the browser from the Supabase OAuth flow. */
  idToken: string;
  /** Applied only when this is a first sign-in; ignored for an existing account. */
  role?: 'individual' | 'organization';
  preferredLanguage?: LanguageCode;
}
```

Google sign-in only ever provisions an `individual` account directly. If `role`
is `organization` the response is still a valid session, but the account is
created with `role: 'individual'` and `organizationId: null` — becoming an
organization requires the fields in `OrganizationRegisterRequest`, which a Google
credential cannot supply. Clients should send `role: 'individual'` or omit it and
route the user to `/register/organization` instead. `admin` is never
self-assignable; requesting it is a `VALIDATION_ERROR` on `role`.

A Google account whose email matches an existing password account is `CONFLICT` —
MANAK does not silently link identities.

Because Google has already verified the email, a first sign-in lands directly on
`status: 'active'`.

**Request**

```json
{ "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IlBMQUNFSE9MREVSIn0.PLACEHOLDER.google", "preferredLanguage": "hi" }
```

**Success — 200**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.PLACEHOLDER.access",
    "refreshToken": "v1.PLACEHOLDER.refresh",
    "expiresAt": "2026-08-25T10:44:03.000Z",
    "user": {
      "id": "usr_01J8ZQ8R7F9G1H3J5K7M9N1P3Q",
      "email": "vikram.rao@gmail.com",
      "fullName": "Vikram Rao",
      "role": "individual",
      "status": "active",
      "preferredLanguage": "hi",
      "avatarUrl": "https://lh3.googleusercontent.com/a/PLACEHOLDER",
      "organizationId": null,
      "createdAt": "2026-08-25T09:44:03.117Z"
    }
  }
}
```

**Failure — 409**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "This email is already registered with a password. Sign in with your password instead.",
    "requestId": "req_01J8ZQ8S8G0H2J4K6M8N0P2Q4R"
  }
}
```

---

## `POST /auth/logout`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | *(empty body)* |
| Success | `ApiSuccess<AcknowledgementResponse>` (200) |
| Errors | `UNAUTHENTICATED`, `UPSTREAM_UNAVAILABLE` |

Revokes the refresh token behind the presented access token, so the session
cannot be silently renewed. The access token remains cryptographically valid
until `expiresAt`; the frontend therefore also clears it locally rather than
relying on server-side revocation alone.

Logout is idempotent. Calling it with an already-revoked refresh token still
returns 200 — a client trying to log out must never be blocked from doing so.
Only a completely missing or malformed `Authorization` header is
`UNAUTHENTICATED`.

**Success — 200**

```json
{
  "success": true,
  "data": { "acknowledged": true, "message": "Signed out." }
}
```

**Failure — 401**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Sign in to continue.",
    "requestId": "req_01J8ZQ9T9H1J3K5M7N9P1Q3R5S"
  }
}
```

---

## `GET /auth/me`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | — |
| Success | `ApiSuccess<CurrentUserResponse>` (200) |
| Errors | `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR` |

Returns the `AuthUser` for the bearer token. This is the rehydration endpoint:
`AuthContext` calls it on mount when a stored token exists, so the app trusts the
server's view of `role` and `status` rather than a possibly stale cached copy.
Never trust a role read from `localStorage`.

This endpoint intentionally answers for accounts whose `status` is
`pending_verification`, so the frontend can render the verification prompt. Other
protected endpoints do not.

`NOT_FOUND` covers the narrow case of a token that verifies against Supabase but
whose MANAK profile row is missing — a broken account rather than a broken token,
and the frontend should sign the user out.

**Success — 200**

```json
{
  "success": true,
  "data": {
    "id": "usr_01J8ZQ6N3B5C7D9E1F3G5H7J9K",
    "email": "compliance@sundarammills.in",
    "fullName": "R. Sundaram",
    "role": "organization",
    "status": "active",
    "preferredLanguage": "en",
    "avatarUrl": null,
    "organizationId": "org_01J8ZQ6N4C6D8E0F2G4H6J8K0M",
    "createdAt": "2026-08-25T09:20:11.902Z"
  }
}
```

**Failure — 403**

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "This account has been suspended. Contact support.",
    "requestId": "req_01J8ZQAU0J2K4M6N8P0Q2R4S6T"
  }
}
```

---

## `PATCH /auth/me`

| | |
| --- | --- |
| Auth | auth |
| Roles | any |
| Request | `UpdateProfileRequest` |
| Success | `ApiSuccess<CurrentUserResponse>` (200) |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `INTERNAL_ERROR` |

Partial update of the caller's own profile. Every field is optional; omitted
fields are left untouched. An empty object is a `VALIDATION_ERROR` rather than a
no-op success, so a buggy client cannot appear to have saved nothing successfully.

| Field | Type | Notes |
| --- | --- | --- |
| `fullName` | `string` | 2–120 characters after trimming. |
| `preferredLanguage` | `LanguageCode` | Must be in `SUPPORTED_LANGUAGES`. Also switches the AI answer language default. |
| `avatarUrl` | `string \| null` | Explicit `null` clears the avatar. An absent key leaves it alone — this is the one place the null/absent distinction is load-bearing in a request. |
| `pincode` | `string` | Six digits. |

Fields deliberately **not** patchable here: `email`, `role`, `status`,
`organizationId`. Email changes need re-verification, and the other three are
privilege — a user cannot promote themselves. Sending any of them is a
`VALIDATION_ERROR` naming the offending field, not a silent drop, because a
silent drop looks like success to the client.

Organization *profile* fields live on `PATCH /organization/me`, documented in
[`organization.md`](./organization.md).

**Request**

```json
{ "fullName": "Asha R. Menon", "preferredLanguage": "en", "avatarUrl": null }
```

**Success — 200**

```json
{
  "success": true,
  "data": {
    "id": "usr_01J8ZQ4K7X9V2N3P4R5S6T7U8V",
    "email": "asha.menon@example.in",
    "fullName": "Asha R. Menon",
    "role": "individual",
    "status": "active",
    "preferredLanguage": "en",
    "avatarUrl": null,
    "organizationId": null,
    "createdAt": "2026-08-25T09:14:02.481Z"
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
    "fields": [{ "field": "role", "message": "Role cannot be changed here." }],
    "requestId": "req_01J8ZQBV1K3M5N7P9Q1R3S5T7U"
  }
}
```

---

## `POST /auth/forgot-password`

| | |
| --- | --- |
| Auth | public |
| Roles | — |
| Request | `ForgotPasswordRequest` |
| Success | `ApiSuccess<AcknowledgementResponse>` — **202 Accepted** |
| Errors | `VALIDATION_ERROR`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE` |

Sends a password-reset link. **The response is identical whether or not the email
is registered** — 202 with the same acknowledgement text — so the endpoint cannot
be used to enumerate accounts. There is deliberately no `NOT_FOUND` in the error
list. Rate limited per email and per IP.

**Request**

```json
{ "email": "asha.menon@example.in" }
```

**Success — 202**

```json
{
  "success": true,
  "data": {
    "acknowledged": true,
    "message": "If that email is registered, a reset link is on its way."
  }
}
```

**Failure — 429**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many reset requests. Try again in a few minutes.",
    "requestId": "req_01J8ZQCW2M4N6P8Q0R2S4T6U8V"
  }
}
```

---

## `POST /auth/reset-password`

| | |
| --- | --- |
| Auth | public |
| Roles | — |
| Request | `ResetPasswordRequest` |
| Success | `ApiSuccess<AcknowledgementResponse>` (200) |
| Errors | `VALIDATION_ERROR`, `UNAUTHENTICATED`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE` |

Completes the reset. This route is public because the caller has no session — the
single-use `token` from the email *is* the credential.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | `string` | yes | Single-use recovery token from the email link. |
| `newPassword` | `string` | yes | Password policy above. |

An expired, already-used, or forged token is `UNAUTHENTICATED` — the credential
failed, so it is not a validation problem. A structurally fine token with a
policy-violating password is `VALIDATION_ERROR` on `newPassword`.

On success every existing refresh token for the account is revoked, so a session
an attacker may already hold dies with the password change. No session is
returned; the frontend routes to `/login`. That is a deliberate choice — it
confirms to the user that the new password works.

**Request**

```json
{ "token": "rt_01J8ZQDX3N5P7Q9R1S3T5U7V9W", "newPassword": "moisture14pct" }
```

**Success — 200**

```json
{
  "success": true,
  "data": {
    "acknowledged": true,
    "message": "Password updated. Sign in with your new password."
  }
}
```

**Failure — 401**

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "This reset link has expired. Request a new one.",
    "requestId": "req_01J8ZQEY4P6Q8R0S2T4U6V8W0X"
  }
}
```

---

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0.1 | 2026-08-26 | `GoogleAuthRequest` moved from this document into `shared/types/auth.ts`. No wire change. |
| 1.0.0 | 2026-08-25 | Initial contract. `GoogleAuthRequest` frozen inline pending a shared type. |
