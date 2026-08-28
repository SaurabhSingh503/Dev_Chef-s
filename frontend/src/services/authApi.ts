const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const authApi = {
  async register(data: { name?: string, email: string, password: string, role: string, account_type: 'individual'|'organization', organizationName?: string, product_type?: string }) {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || 'Registration failed');
    }
    
    return (await response.json()).data;
  },

  async login(email: string, password: string) {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || 'Login failed');
    }
    
    return (await response.json()).data;
  },

  async me(token: string) {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}` 
      }
    });
    
    if (!response.ok) {
      throw new Error('Session invalid');
    }
    
    return (await response.json()).data;
  },

  async logout(token: string) {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}` 
      }
    }).catch(() => {});
  },

  async forgotPassword(email: string) {
    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    if (!response.ok) {
      throw new Error('Failed to request password reset');
    }
  },
  
  async updatePassword(token: string, password: string) {
    const response = await fetch(`${API_URL}/api/auth/update-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update password');
    }
  },

  async updateAvatar(token: string, avatarBase64: string) {
    const response = await fetch(`${API_URL}/api/auth/profile/avatar`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ avatarBase64 })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.message || 'Failed to update avatar');
    }
    
    return (await response.json()).data;
  }
};
