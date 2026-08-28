import 'dotenv/config';
import { z } from 'zod';
const schema=z.object({NODE_ENV:z.enum(['development','test','production']).default('development'),PORT:z.coerce.number().int().positive().default(4000),CLIENT_ORIGIN:z.string().default('http://localhost:5173'),JWT_SECRET:z.string().min(16).default('development-only-secret-change-me'),RAG_SERVICE_URL:z.string().url().optional().or(z.literal('')),VOICE_SERVICE_URL:z.string().url().optional().or(z.literal('')),DATABASE_URL:z.string().optional(),SUPABASE_URL:z.string().url(),SUPABASE_SERVICE_ROLE_KEY:z.string().min(30),LOCATIONIQ_API_KEY:z.string().optional()});
export const env=schema.parse(process.env);
