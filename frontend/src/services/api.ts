export const api = { baseUrl: import.meta.env.VITE_API_URL ?? '/api', mode: 'mock' as const };

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('manak_auth_token');
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  
  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    localStorage.removeItem('manak_auth_token');
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  
  return response;
}
