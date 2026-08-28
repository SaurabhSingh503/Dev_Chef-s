# API Documentation

This document describes the ACTUAL backend API contracts currently implemented in the Node.js Express server.

## Authentication

### `POST /auth/register` [IMPLEMENTED]
- **Auth:** None
- **Role:** None
- **Request:** `{ name, email, password, role ('individual'|'organization'), organizationName? }`
- **Response:** `{ success: true, data: { user: AuthUser, token: string } }`
- **Errors:** 409 Conflict, 400 Bad Request (Supabase error)

### `POST /auth/login` [IMPLEMENTED]
- **Auth:** None
- **Role:** None
- **Request:** `{ email, password }`
- **Response:** `{ success: true, data: { user: AuthUser, token: string } }`
- **Errors:** 401 Unauthorized

### `POST /auth/forgot-password` [IMPLEMENTED]
- **Auth:** None
- **Request:** `{ email }`
- **Response:** `{ success: true, message: 'If the account exists, reset instructions will be sent' }`
- **Errors:** 500 Server Error (safely hides user existence).

### `POST /auth/update-password` [IMPLEMENTED]
- **Auth:** None (uses recovery token)
- **Request:** `{ token: string, password: string }`
- **Response:** `{ success: true, message: 'Password successfully updated' }`
- **Errors:** 401 Unauthorized (invalid/expired token), 500 Server Error

### `GET /auth/me` [IMPLEMENTED]
- **Auth:** Bearer Token
- **Request:** None
- **Response:** `{ success: true, data: AuthUser }`
- **Errors:** 401 Unauthenticated

## AI / RAG

### `POST /ai/chat` [IMPLEMENTED - STATELESS]
- **Auth:** Bearer Token
- **Request:** `{ message: string, language?: string }`
- **Response:** `{ success: true, data: { text, sources, citations, confidence } }`
- **Notice:** This endpoint currently proxies the message directly to the RAG service statelessly.
- **AI Persistence:** NOT IMPLEMENTED (No conversations/messages are stored in DB via backend yet).

## Catalog / Domain

### `GET /standards` [IMPLEMENTED]
- **Auth:** Optional
- **Query:** `search`, `category`, `industry`, `status`, `page`, `pageSize`
- **Response:** `{ success: true, data: Page<Standard> }`

### `POST /standards/:id/save` [IMPLEMENTED]
- **Auth:** Bearer Token
- **Response:** `{ success: true, data: { userId, standardId, saved: true } }`

### `GET /testing/search` [IMPLEMENTED]
- **Auth:** Optional
- **Query:** `pin`
- **Response:** `{ success: true, data: { location, laboratories, notice } }`
- **Limitations:** City, state, distance, and precise testing services are omitted (undefined/empty) as they are not natively mapped in the Postgres schemas yet.

## Admin

### `GET /admin/dashboard` [IMPLEMENTED]
- **Auth:** Bearer Token
- **Role:** 'admin'
- **Response:** `{ success: true, data: { documents, users, rag } }`

## Voice / Multilingual / PDF

- **Voice AI:** NOT IMPLEMENTED (Endpoints do not exist on backend).
- **Multilingual:** PARTIAL (Passed as parameter to RAG, but UI translation is frontend-only).
- **PDF Generation:** NOT IMPLEMENTED.

## PDF Generation Endpoints

### Generate Handbook PDF
- **Method**: `GET`
- **Endpoint**: `/handbooks/:id/pdf`
- **Authentication**: Required (Bearer token)
- **Role Requirements**: Organization Member (tied to Handbook's parent document) or Admin
- **Parameters**: `id` (Handbook ID)
- **Success Response**: `200 OK`
- **Content-Type**: `application/pdf`
- **Error Responses**: `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

### Generate Report PDF
- **Method**: `GET`
- **Endpoint**: `/reports/:id/pdf`
- **Authentication**: Required (Bearer token)
- **Role Requirements**: Report Owner, Organization Member, or Admin
- **Parameters**: `id` (Report ID)
- **Success Response**: `200 OK`
- **Content-Type**: `application/pdf`
- **Error Responses**: `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

### List AI Conversations
- **Method**: `GET`
- **Endpoint**: `/ai/conversations`
- **Authentication**: Required (Bearer token)
- **Role Requirements**: Authenticated user
- **Success Response**: `200 OK`
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "title": "string",
        "createdAt": "datetime",
        "updatedAt": "datetime",
        "messageCount": "number"
      }
    ]
  }
  ```
- **Error Responses**: `401 Unauthorized`, `500 Internal Server Error`
