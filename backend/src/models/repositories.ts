import type { AuthUser, Role } from '../types/api.js';
export type StoredUser=AuthUser & {passwordHash:string;organizationName?:string;account_type:'individual'|'organization';product_type?:string;avatar_url?:string};
export interface UserRepository { create(user:StoredUser):Promise<StoredUser>; findByEmail(email:string):Promise<StoredUser|undefined>; findById(id:string):Promise<StoredUser|undefined>; update(id:string,patch:Partial<Pick<StoredUser,'name'|'organizationName'|'avatar_url'>>):Promise<StoredUser|undefined>; }


import { supabase } from '../config/supabase.js';

export class SupabaseUserRepository implements UserRepository {
  async create(user: StoredUser): Promise<StoredUser> {
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        account_type: user.account_type,
        product_type: user.product_type
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase error: ${error.message}`);
    
    return { ...user, id: data.id };
  }

  async findByEmail(email: string): Promise<StoredUser | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*, organization_members(organizations(name))')
      .eq('email', email)
      .single();

    if (error || !data) return undefined;

    let orgName = undefined;
    if (data.organization_members && data.organization_members.length > 0) {
      orgName = (data.organization_members[0].organizations as {name?: string})?.name;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as Role,
      account_type: data.account_type || 'individual',
      product_type: data.product_type,
      organizationName: orgName,
      avatar_url: data.avatar_url,
      passwordHash: '' 
    };
  }

  async findById(id: string): Promise<StoredUser | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*, organization_members(organizations(name))')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase findById error:', error);
      return undefined;
    }
    if (!data) return undefined;

    let orgName = undefined;
    if (data.organization_members && data.organization_members.length > 0) {
      orgName = (data.organization_members[0].organizations as {name?: string})?.name;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as Role,
      account_type: data.account_type || 'individual',
      product_type: data.product_type,
      organizationName: orgName,
      avatar_url: data.avatar_url,
      passwordHash: ''
    };
  }

  async update(id: string, patch: Partial<Pick<StoredUser, 'name' | 'organizationName' | 'avatar_url'>>): Promise<StoredUser | undefined> {
    const updateData: Record<string, unknown> = {};
    if (patch.name) updateData.name = patch.name;
    if (patch.avatar_url) updateData.avatar_url = patch.avatar_url;
    
    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase.from('users').update(updateData).eq('id', id);
      if (error) {
        console.error('Supabase update error:', error);
        throw new Error(`Database update failed: ${error.message}`);
      }
    }
    return this.findById(id);
  }
}
