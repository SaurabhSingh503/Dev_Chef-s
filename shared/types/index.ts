/**
 * MANAK shared types — barrel.
 *
 * Import from here rather than deep paths:
 *   import type { ApiResponse, AIAnswer } from '@shared/types';
 *
 * `frontend` resolves `@shared` via a Vite alias + tsconfig path; `backend`
 * resolves it via its own tsconfig path. Both point at this directory, so a
 * change here is a change for every layer at once — which is the intent.
 */

export * from './api';
export * from './auth';
export * from './users';
export * from './ai';
export * from './standards';
export * from './handbook';
export * from './reports';
export * from './voice';
