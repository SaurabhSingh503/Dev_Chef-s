const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const handbookApi = {
  async list(token: string) {
    const response = await fetch(`${API_URL}/api/handbooks`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { data } = await response.json();
    return data || [];
  },
  async get(id: string, token: string) {
    const response = await fetch(`${API_URL}/api/handbooks/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { data } = await response.json();
    return data;
  },
  async makeHandout(fileNames: string[], token: string): Promise<Blob> {
    const response = await fetch(`${API_URL}/api/handbooks/make-handout`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fileNames })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate handout');
    }
    return response.blob();
  }
};
