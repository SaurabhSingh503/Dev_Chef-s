import type { Role, AuthUser } from '../types/api.js'; 
import { AppError } from '../utils/appError.js';
import { supabase } from '../config/supabase.js';

type Domain = 'certification' | 'handbooks' | 'reports' | 'organizations' | 'consumer' | 'trends' | 'admin';

const staticData: Record<string, unknown> = {
  certification: {
    process: ['Assess product scope', 'Review requirements', 'Prepare evidence', 'Test and apply'],
    timeline: [
      { stage: 'Readiness', duration: '1–2 weeks' },
      { stage: 'Testing', duration: 'Depends on laboratory' }
    ],
    notice: 'Guidance is illustrative; confirm official requirements.'
  },
  consumer: {
    services: ['Hallmarking guidance', 'Product safety guidance', 'Consumer support'],
    categories: ['Jewellery', 'Packaged goods', 'Electrical products']
  },
  trends: {
    topics: ['Quality systems', 'Safe packaging', 'Water compliance'],
    industries: ['Consumer goods', 'Electrical', 'Water']
  },
  admin: {
    dashboard: { documents: 0, users: 0, rag: 'waiting_for_dependency' },
    knowledgeBase: [],
    analytics: { queries: 0 }
  }
};

export const domainService = {
  async get(domain: Domain) {
    if (domain === 'handbooks') {
      const { data } = await supabase.from('handbooks').select('*');
      return (data || []).map(h => ({
        id: h.id,
        title: h.title,
        category: h.category,
        pages: 50 // arbitrary since pages isn't in db schema by default
      }));
    }
    
    if (domain === 'reports') {
      const { data } = await supabase.from('reports').select('*');
      return (data || []).map(r => ({
        id: r.id,
        title: r.title,
        status: r.status
      }));
    }

    if (domain === 'organizations') {
      const { count } = await supabase.from('organizations').select('*', { count: 'exact', head: true });
      return {
        dashboard: { savedStandards: count || 0, recentSearches: 0 },
        industryKnowledge: []
      };
    }

    return staticData[domain];
  },

  async getDetail(domain: Domain, id: string) {
    if (domain === 'handbooks') {
      const { data, error } = await supabase.from('handbooks').select('*').eq('id', id).single();
      if (error || !data) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');
      return { id: data.id, title: data.title, category: data.category, pages: 50 };
    }

    if (domain === 'reports') {
      const { data, error } = await supabase.from('reports').select('*').eq('id', id).single();
      if (error || !data) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');
      return { id: data.id, title: data.title, status: data.status };
    }

    const value = staticData[domain];
    if (Array.isArray(value)) {
      const found = value.find((v: Record<string, unknown>) => v && typeof v === 'object' && v.id === id);
      if (!found) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Resource not found');
      return found;
    }
    return { domain, id, ...(typeof value === 'object' && value !== null ? value : {}) };
  },

  previewHandbook(id: string) {
    return { id, format: 'preview', status: 'waiting_for_pdf_dependency', message: 'PDF preview requires a configured document service.' };
  },

  adminAction(action: string) {
    return { action, status: 'accepted_for_integration', message: 'Administrative mutations require the connected database and RAG subsystems.' };
  },

  assertRole(domain: Domain, role: Role) {
    if (domain === 'admin' && role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'Administrator access is required');
    if (domain === 'organizations' && role !== 'organization' && role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'Organization access is required');
  },
  
  async getPdfForHandbook(id: string, user: AuthUser) {
    // 1. Fetch handbook and its parent document
    const { data: handbook, error } = await supabase
      .from('handbooks')
      .select('*, documents(*)')
      .eq('id', id)
      .single();
      
    if (error || !handbook) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Handbook not found');
    
    // 2. Authorization (mirrors RLS)
    const doc = handbook.documents;
    if (user.role !== 'admin' && doc && doc.organization_id) {
      // Must check if user is in this organization
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('1')
        .eq('organization_id', doc.organization_id)
        .eq('user_id', user.id)
        .single();
      if (!orgMember) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this handbook');
      }
    }
    
    return handbook;
  },
  
  async getPdfForReport(id: string, user: AuthUser) {
    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error || !report) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Report not found');
    
    // 2. Authorization (mirrors RLS)
    if (user.role !== 'admin') {
      if (report.owner_id === user.id) {
        // Allowed
      } else if (report.organization_id) {
        const { data: orgMember } = await supabase
          .from('organization_members')
          .select('1')
          .eq('organization_id', report.organization_id)
          .eq('user_id', user.id)
          .single();
        if (!orgMember) {
          throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this report');
        }
      } else {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this report');
      }
    }
    
    return report;
  }
};
