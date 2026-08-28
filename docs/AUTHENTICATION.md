# Authentication Architecture

MANAK employs a backend-mediated authentication strategy backed by Supabase Auth.

## Password Reset Flow

The password reset flow requires a specific interaction sequence to securely proxy Supabase Auth magic links through the frontend application to the backend service.

1. **Forgot Password Request**
   - User navigates to `/forgot-password` on the frontend.
   - Frontend calls `POST /auth/forgot-password` with the user's email.
   - Backend calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '${FRONTEND_URL}/reset-password' })`.
   - Supabase sends an email containing a recovery link (a magic link).

2. **Recovery Session Verification**
   - User clicks the link in the email.
   - The browser navigates to `${FRONTEND_URL}/reset-password#access_token=...&refresh_token=...&type=recovery`.
   - The frontend `ResetPassword` component parses the URL hash to extract the `access_token`.

3. **Password Update**
   - The user inputs a new password in the frontend.
   - The frontend calls `POST /auth/update-password` providing the `{ token: access_token, password: newPassword }`.
   - The backend validates the recovery token via `supabase.auth.getUser(token)`.
   - Upon successful validation, the backend uses `supabase.auth.admin.updateUserById(user.id, { password: newPassword })` to update the password in Supabase.
   - The user is notified of success and redirected to login.

## Security Considerations
- **No Client-Side Supabase Keys:** The frontend never handles Supabase keys or service role keys directly. All secure operations occur on the backend.
- **User Enumeration Protection:** The `POST /auth/forgot-password` endpoint silently succeeds for non-existent users (ignoring 404/422 responses from Supabase), preventing malicious actors from determining if an email is registered.
- **Token Validation:** The backend rigorously verifies the token provided to `/auth/update-password` by passing it back to Supabase. This ensures arbitrary user IDs cannot be supplied by the frontend to maliciously overwrite passwords.
