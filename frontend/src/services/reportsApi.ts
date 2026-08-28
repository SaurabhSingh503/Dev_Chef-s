const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export interface ReportRequest {
  title: string;
  standardNumbers: string[];
  sections: {
    standardInformation: boolean;
    requirements: boolean;
    testing: boolean;
    laboratories: boolean;
    citations: boolean;
  };
}

export const reportsApi = {
  async generate(request: ReportRequest, token: string): Promise<Blob> {
    const response = await fetch(`${API_URL}/api/reports/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate report');
    }
    
    return response.blob();
  }
};
