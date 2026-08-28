const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
import { fetchWithAuth } from './api';

export const pdfApi = {
  async downloadHandbookPdf(id: string): Promise<Blob> {
    const response = await fetchWithAuth(`${API_URL}/api/handbooks/${id}/pdf`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to generate handbook PDF');
    }
    
    return response.blob();
  },

  async downloadReportPdf(id: string): Promise<Blob> {
    const response = await fetchWithAuth(`${API_URL}/api/reports/${id}/pdf`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to generate report PDF');
    }
    
    return response.blob();
  }
};
