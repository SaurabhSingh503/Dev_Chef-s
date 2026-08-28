import type { Laboratory } from '../types';
import { fetchWithAuth } from './api';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const testingApi = { 
  async locate(pin: string): Promise<{ location: string | undefined; laboratories: Laboratory[], notice?: string }> { 
    const res = await fetchWithAuth(`${API_URL}/api/testing/search?pin=${encodeURIComponent(pin)}`);
    if (!res.ok) {
      const errorJson = await res.json().catch(() => null);
      throw new Error(errorJson?.error?.message || 'API Error');
    }
    const json = await res.json();
    return json.data;
  } 
};
