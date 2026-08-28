import jwt from 'jsonwebtoken'; 
import { randomUUID } from 'node:crypto'; 
import { env } from '../config/env.js'; 
import { SupabaseUserRepository } from '../models/repositories.js'; 
import type { AuthUser, Role } from '../types/api.js'; 
import { AppError } from '../utils/appError.js';
import { supabase } from '../config/supabase.js';
import { createClient } from '@supabase/supabase-js';

const users = new SupabaseUserRepository(); 
const revokedTokens = new Set<string>();

export type RegisterInput = {
  name?: string;
  email: string;
  password: string;
  role: Exclude<Role, 'admin'>;
  account_type: 'individual' | 'organization';
  organizationName?: string;
  product_type?: string;
};

const publicUser = (u: { id: string; name: string; email: string; role: Role; account_type: 'individual'|'organization'; product_type?: string; organizationName?: string; avatar_url?: string }): AuthUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  account_type: u.account_type,
  product_type: u.product_type,
  organizationName: u.organizationName,
  avatar_url: u.avatar_url
});

const tokenFor = (user: AuthUser) => jwt.sign(user, env.JWT_SECRET, { expiresIn: '8h', jwtid: randomUUID() });

export const authService = {
  async register(input: RegisterInput) {
    if (input.account_type === 'organization') {
      if (!input.organizationName) throw new AppError(400, 'BAD_REQUEST', 'Organization name is required');
      if (!input.product_type) throw new AppError(400, 'BAD_REQUEST', 'Product type is required');
    } else {
      if (!input.name) throw new AppError(400, 'BAD_REQUEST', 'Full name is required for individuals');
    }

    if (await users.findByEmail(input.email.toLowerCase())) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account already exists for this email');
    }

    // Create in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: input.email.toLowerCase(),
      password: input.password,
      email_confirm: true
    });

    if (authError || !authData.user) {
      throw new AppError(400, 'AUTH_ERROR', authError?.message || 'Failed to create user');
    }

    const user = {
      id: authData.user.id,
      name: input.account_type === 'organization' ? input.organizationName! : input.name!,
      email: input.email.toLowerCase(),
      role: input.role,
      account_type: input.account_type,
      product_type: input.account_type === 'organization' ? input.product_type : undefined,
      passwordHash: '',
      organizationName: input.account_type === 'organization' ? input.organizationName : undefined
    };

    // Insert into public.users
    await users.create(user);

    const safe = publicUser(user);
    return { user: safe, token: tokenFor(safe) };
  },

  async login(email: string, password: string) {
    const ephemeralClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Validate credentials using Supabase Auth
    const { data: authData, error: authError } = await ephemeralClient.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    });

    if (authError || !authData.user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Retrieve full profile from repository
    const user = await users.findById(authData.user.id);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User profile not found in database');
    }

    const safe = publicUser(user);
    return { user: safe, token: tokenFor(safe) };
  },

  async verify(token: string) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (typeof decoded === 'string' || !decoded.id || !decoded.email || !decoded.role) {
        throw new Error();
      }
      return decoded as AuthUser;
    } catch {
      throw new AppError(401, 'UNAUTHENTICATED', 'Your session is invalid or expired');
    }
  },

  async current(id: string) {
    const user = await users.findById(id);
    if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'User account is unavailable');
    return publicUser(user);
  },

  async updateProfile(id: string, input: { name?: string; organizationName?: string }) {
    const updated = await users.update(id, input);
    if (!updated) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    return publicUser(updated);
  },

  async updateAvatar(userId: string, base64Data: string): Promise<AuthUser> {
    const user = await users.findById(userId);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    // Basic validation
    if (!base64Data.startsWith('data:image/')) {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid image format');
    }
    
    const matches = base64Data.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!matches) {
      throw new AppError(400, 'BAD_REQUEST', 'Only JPG, PNG, and WEBP formats are supported');
    }
    
    const ext = matches[1].replace('jpeg', 'jpg');
    const buffer = Buffer.from(matches[2], 'base64');
    
    if (buffer.length > 5 * 1024 * 1024) {
      throw new AppError(400, 'BAD_REQUEST', 'Image size exceeds 5MB limit');
    }

    const filePath = `${userId}/profile.${ext}`;
    
    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: `image/${ext}`,
        upsert: true
      });

    if (error) {
      throw new AppError(500, 'STORAGE_ERROR', `Storage error: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);
      
    // Cache bust
    const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const updated = await users.update(userId, { avatar_url: avatarUrl });
    if (!updated) throw new AppError(500, 'UPDATE_FAILED', 'Failed to update user record');

    return publicUser(updated);
  },

  logout(token: string) {
    revokedTokens.add(token);
  },

  isRevoked(token: string) {
    return revokedTokens.has(token);
  },

  async requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
      redirectTo: `${env.CLIENT_ORIGIN}/reset-password`,
    });
    // Do not throw an error if the user isn't found, just silently succeed to prevent user enumeration
    if (error && error.status !== 404 && error.status !== 422) {
      throw new AppError(500, 'AUTH_ERROR', 'Failed to request password reset');
    }
  },

  async updatePassword(token: string, newPassword: string) {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new AppError(401, 'INVALID_TOKEN', 'The recovery link is invalid or has expired');
    }
    
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    });
    
    if (updateError) {
      throw new AppError(500, 'UPDATE_FAILED', 'Failed to update password');
    }
  }
};
