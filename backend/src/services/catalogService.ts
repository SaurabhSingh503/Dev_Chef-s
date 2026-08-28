import { AppError } from '../utils/appError.js'; 
import type { Page } from '../types/api.js';
import { supabase } from '../config/supabase.js';
import { env } from '../config/env.js';

export type Standard = {
  id: string;
  code: string;
  title: string;
  category: string;
  categories?: string[];
  industry: string;
  status: 'current' | 'under_review';
  description: string;
  file_name?: string;
  year?: string;
};

const paginate = <T>(items: T[], page = 1, pageSize = 12): Page<T> => ({
  items: items.slice((page - 1) * pageSize, page * pageSize),
  page,
  pageSize,
  total: items.length
});

import { getRealStandards } from './pdfMatcher.js';

export const standardsService = {
  async list(input: { search?: string; category?: string; industry?: string; status?: string; page?: number; pageSize?: number } = {}) {
    let allStandards = await getRealStandards();

    // In-memory filter, search, sort
    if (input.search) {
      const q = input.search.toLowerCase();
      allStandards = allStandards.filter(s => 
        s.code.toLowerCase().includes(q) || 
        s.title.toLowerCase().includes(q) || 
        (s.file_name && s.file_name.toLowerCase().includes(q)) ||
        (s.year && s.year.includes(q))
      );
    }
    if (input.category) {
      allStandards = allStandards.filter(s => s.categories && s.categories.includes(input.category as string));
    }
    if (input.industry) allStandards = allStandards.filter(s => s.industry === input.industry);
    if (input.status) allStandards = allStandards.filter(s => s.status === input.status);

    return paginate(allStandards, input.page, input.pageSize);
  },

  async get(id: string) {
    const { data: s, error } = await supabase.from('standards')
      .select('*, documents!inner(title, description, category, industry)')
      .eq('id', id)
      .single();
    if (error || !s) throw new AppError(404, 'STANDARD_NOT_FOUND', 'Standard not found');
    
    const doc = Array.isArray(s.documents) ? s.documents[0] : s.documents;
    const category = (doc as Record<string, string>)?.category || '';

    const { data: related } = await supabase.from('standards')
      .select('*, documents!inner(title, description, category, industry)')
      .eq('documents.category', category)
      .neq('id', id);

    const formatted = {
      id: s.id,
      code: s.standard_number,
      title: (doc as Record<string, string>)?.title || '',
      category: category,
      industry: (doc as Record<string, string>)?.industry || '',
      status: s.status as 'current' | 'under_review',
      description: (doc as Record<string, string>)?.description || ''
    };

    return {
      ...formatted,
      related: (related || []).map(rel => {
        const relDoc = Array.isArray(rel.documents) ? rel.documents[0] : rel.documents;
        return {
          id: rel.id,
          code: rel.standard_number,
          title: (relDoc as Record<string, string>)?.title || '',
          category: (relDoc as Record<string, string>)?.category || '',
          industry: (relDoc as Record<string, string>)?.industry || '',
          status: rel.status as 'current' | 'under_review',
          description: (relDoc as Record<string, string>)?.description || ''
        };
      })
    };
  },

  async save(userId: string, standardId: string) {
    const { error } = await supabase.from('saved_standards').insert({
      user_id: userId,
      standard_id: standardId
    });
    if (error) {
      if (error.code === '23505') return { userId, standardId, saved: true };
      throw new Error(`Failed to save standard: ${error.message}`);
    }
    return { userId, standardId, saved: true };
  }
};

import { geocode, calculateDistance } from './locationService.js';

export type Laboratory = {
  id: string;
  name: string;
  city: string;
  district?: string;
  state: string;
  pin: string;
  address: string;
  distanceKm?: number;
  latitude?: number;
  longitude?: number;
  services: string[];
  status: string;
  oslCode?: string;
  recognitionStatus?: string;
  recognitionValidUntil?: string;
};

export const testingService = {
  async search(pin?: string) {
    let searchLat: number | undefined = undefined;
    let searchLon: number | undefined = undefined;
    let locationStr: string | undefined = undefined;
    
    if (pin) {
      if (!env.LOCATIONIQ_API_KEY) {
        locationStr = `Pincode: ${pin} (Location services disabled: LOCATIONIQ_API_KEY is missing)`;
      } else {
        try {
          const coords = await geocode(pin);
          if (coords) {
            searchLat = coords.lat;
            searchLon = coords.lon;
            const parts = [];
            if (coords.city) parts.push(coords.city);
            if (coords.state) parts.push(coords.state);
            const nameStr = parts.join(', ');
            locationStr = nameStr ? `${nameStr} (${pin})` : `Pincode: ${pin}`;
          } else {
            locationStr = `Pincode: ${pin}`;
          }
        } catch (err: any) {
          locationStr = `Pincode: ${pin} (Location service unavailable: ${err.message})`;
        }
      }
    }
    
    const query = supabase.from('organizations').select('*').eq('type', 'Laboratory');
    const { data, error } = await query;
    if (error) throw new Error(`Supabase query failed: ${error.message}`);

    const rawOrgs = data || [];
    let geocodeQuota = 5;
    
    const processedLabs = await Promise.all(rawOrgs.map(async (org) => {
      let lat = org.latitude ? parseFloat(org.latitude) : undefined;
      let lon = org.longitude ? parseFloat(org.longitude) : undefined;
      let city = org.metadata?.city || '';
      let state = org.metadata?.state || '';
      
      if (lat === undefined || lon === undefined || !city || !state) {
        if (geocodeQuota > 0 && env.LOCATIONIQ_API_KEY && (org.postal_code || org.address)) {
          geocodeQuota--;
          const geocodeQuery = org.postal_code || org.address;
          try {
            const orgCoords = await geocode(geocodeQuery);
            if (orgCoords) {
              lat = orgCoords.lat;
              lon = orgCoords.lon;
              city = orgCoords.city;
              state = orgCoords.state;
              
              const newMetadata = { ...(org.metadata || {}), city, state };
              supabase.from('organizations')
                .update({ latitude: lat, longitude: lon, metadata: newMetadata })
                .eq('id', org.id)
                .then(({ error }) => {
                  if (error) console.error(`Failed to cache coords for org ${org.id}:`, error.message);
                });
            }
          } catch (err) {
            console.error(`Failed to geocode org ${org.id}:`, err);
          }
        }
      }

      let dist: number | undefined = undefined;
      if (searchLat !== undefined && searchLon !== undefined && lat !== undefined && lon !== undefined) {
        dist = calculateDistance(searchLat, searchLon, lat, lon);
      }

      return {
        id: org.id,
        name: org.name,
        city: city,
        district: org.metadata?.district || '',
        state: state,
        pin: org.postal_code || '',
        address: org.address || '',
        distanceKm: dist !== undefined ? Number(dist.toFixed(2)) : undefined, 
        latitude: lat,
        longitude: lon,
        services: org.metadata?.services || [], 
        status: org.metadata?.status || 'Active',
        oslCode: org.metadata?.oslCode || '',
        recognitionStatus: org.metadata?.recognitionStatus || 'Recognized',
        recognitionValidUntil: org.metadata?.recognitionValidUntil || ''
      };
    }));
    
    processedLabs.sort((a, b) => {
      if (a.distanceKm === undefined && b.distanceKm === undefined) return 0;
      if (a.distanceKm === undefined) return 1;
      if (b.distanceKm === undefined) return -1;
      return a.distanceKm - b.distanceKm;
    });

    const unmappedCount = processedLabs.filter(l => l.latitude === undefined || l.longitude === undefined).length;
    let notice = 'City, state, and precise testing services are not yet natively backed by the organizations table schema.';
    if (unmappedCount > 0) {
      notice += ` Warning: ${unmappedCount} laboratories lack coordinates and could not be geocoded or sorted by distance.`;
    }

    return {
      location: locationStr,
      city: locationStr ? locationStr.split(',')[0].replace(/ \(.*\)/, '') : undefined,
      state: locationStr && locationStr.includes(',') ? locationStr.split(',')[1].split('(')[0].trim() : undefined,
      latitude: searchLat,
      longitude: searchLon,
      laboratories: processedLabs,
      notice
    };
  },

  async get(id: string) {
    const { data: org, error } = await supabase.from('organizations').select('*').eq('id', id).eq('type', 'Laboratory').single();
    if (error || !org) throw new AppError(404, 'LABORATORY_NOT_FOUND', 'Laboratory not found');
    
    const lat = org.latitude ? parseFloat(org.latitude) : undefined;
    const lon = org.longitude ? parseFloat(org.longitude) : undefined;

    return {
      id: org.id,
      name: org.name,
      city: org.metadata?.city || '',
      state: org.metadata?.state || '',
      pin: org.postal_code || '',
      address: org.address || '',
      distanceKm: undefined,
      latitude: lat,
      longitude: lon,
      services: org.metadata?.services || [],
      status: org.metadata?.status || 'Active'
    };
  },

  requirements() {
    return {
      steps: ['Identify applicable standard', 'Confirm test parameters', 'Prepare representative samples', 'Contact an approved laboratory'],
      notice: 'General guidance only; verify applicable requirements.'
    };
  }
};
