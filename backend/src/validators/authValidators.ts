import { z } from 'zod';
const email=z.string().email('Provide a valid email address').max(254); const password=z.string().min(8,'Password must contain at least 8 characters').max(128);
export const registerSchema=z.object({body:z.object({name:z.string().trim().min(2).max(100).optional(),email,password,role:z.enum(['individual','organization']),account_type:z.enum(['individual','organization']),organizationName:z.string().trim().min(2).max(160).optional(),product_type:z.string().trim().optional()}),query:z.object({}),params:z.object({})});
export const loginSchema=z.object({body:z.object({email,password}),query:z.object({}),params:z.object({})});
export const resetSchema=z.object({body:z.object({email}),query:z.object({}),params:z.object({})});
export const updatePasswordSchema=z.object({body:z.object({token:z.string().min(1),password}),query:z.object({}),params:z.object({})});
export const profileSchema=z.object({body:z.object({name:z.string().trim().min(2).max(100).optional(),organizationName:z.string().trim().min(2).max(160).optional()}).refine(v=>Object.keys(v).length>0,'Provide at least one profile field'),query:z.object({}),params:z.object({})});
