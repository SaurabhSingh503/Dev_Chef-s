import type { Standard } from '../types';
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
export const standardsApi = { 
  async list(query = '', category = '', page = 1, pageSize = 12): Promise<{items: Standard[], total: number, page: number, pageSize: number}> {
    const res = await fetch(`${API_URL}/api/standards?search=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&page=${page}&pageSize=${pageSize}`);
    if (!res.ok) throw new Error('API Error');
    const json = await res.json();
    return json.data;
  }, 
  async get(id:string) { 
    const res = await fetch(`${API_URL}/api/standards/${id}`);
    if (!res.ok) throw new Error('API Error');
    const json = await res.json();
    return json.data;
  } 
};
