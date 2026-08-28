import React, { useState } from 'react';
import { Button } from './ui/Button';
import { pdfApi } from '../services/pdfApi';
import { useLanguage } from '../i18n/LanguageContext';

interface PdfDownloadButtonProps {
  type: 'handbook' | 'report';
  id: string;
  filename: string;
  variant?: 'primary' | 'secondary' | 'text';
  children: React.ReactNode;
}

export function PdfDownloadButton({ type, id, filename, variant = 'primary', children }: PdfDownloadButtonProps) {
  const {t} = useLanguage();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const download = async () => {
    if (status === 'loading') return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const blob = type === 'handbook' 
        ? await pdfApi.downloadHandbookPdf(id) 
        : await pdfApi.downloadReportPdf(id);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setErrorMsg(message);
      setStatus('error');
    }
  };

  if (variant === 'text') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <button onClick={download} disabled={status === 'loading'} className="text-button" style={{ opacity: status === 'loading' ? 0.5 : 1 }}>
          {status === 'loading' ? t('pdf.downloading') : children}
        </button>
        {status === 'error' && <small style={{ color: 'red' }}>{errorMsg}</small>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <Button variant={variant} onClick={download} disabled={status === 'loading'}>
        {status === 'loading' ? t('pdf.downloading') : children}
      </Button>
      {status === 'error' && <small style={{ color: 'red', marginTop: 4 }}>{errorMsg}</small>}
    </div>
  );
}
