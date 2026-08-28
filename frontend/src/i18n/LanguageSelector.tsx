import { useState, useRef, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { Language } from './translations';

const LANGUAGES: { code: Language, label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'or', label: 'ଓଡ଼ିଆ' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'gu', label: 'ગુજરાતી' }
];

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <div className="language-selector" ref={containerRef} style={{ position: 'relative' }}>
      <button 
        className="text-button" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select Language"
        style={{ 
          fontSize: '13px', 
          fontWeight: 500, 
          padding: '4px 8px', 
          border: '1px solid transparent', 
          background: 'transparent',
          color: 'var(--ink)'
        }}
      >
        {currentLang.label.toUpperCase()} ▾
      </button>

      {isOpen && (
        <div 
          className="lang-popover" 
          style={{ 
            position: 'absolute', 
            top: '100%', 
            right: 0, 
            marginTop: '8px', 
            backgroundColor: 'var(--paper)', 
            border: '1px solid var(--line)', 
            borderRadius: '8px', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
            zIndex: 100, 
            minWidth: '120px',
            display: 'flex',
            flexDirection: 'column',
            padding: '4px'
          }}
        >
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code);
                setIsOpen(false);
              }}
              style={{
                textAlign: 'left',
                padding: '8px 12px',
                border: 'none',
                background: language === lang.code ? 'var(--soft)' : 'transparent',
                color: language === lang.code ? 'var(--green)' : 'var(--ink)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: language === lang.code ? 600 : 400
              }}
              onMouseEnter={(e) => {
                if (language !== lang.code) e.currentTarget.style.background = 'var(--soft)';
              }}
              onMouseLeave={(e) => {
                if (language !== lang.code) e.currentTarget.style.background = 'transparent';
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
