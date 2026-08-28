import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type GeocodeResult = {
  lat: number;
  lon: number;
  city: string;
  state: string;
  displayName: string;
};

export async function geocode(query: string): Promise<GeocodeResult | null> {
  if (!env.LOCATIONIQ_API_KEY) {
    throw new AppError(500, 'LOCATIONIQ_CONFIG_ERROR', 'LOCATIONIQ_API_KEY is not configured in the backend environment.');
  }

  const encoded = encodeURIComponent(query);
  const url = `https://us1.locationiq.com/v1/search.php?key=${env.LOCATIONIQ_API_KEY}&q=${encoded}&format=json&limit=1&addressdetails=1`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) return null; // No results found
      throw new AppError(503, 'LOCATIONIQ_API_ERROR', `LocationIQ API returned ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      const address = item.address || {};
      const city = address.city || address.town || address.village || address.county || address.state_district || '';
      const state = address.state || '';
      return {
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        city,
        state,
        displayName: item.display_name || ''
      };
    }
    return null;
  } catch (err) {
    console.error('LocationIQ geocode error:', err);
    throw err;
  }
}
