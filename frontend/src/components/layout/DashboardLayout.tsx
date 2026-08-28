import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../i18n/LanguageContext';

const navKeys = [
  { key: 'nav.dashboard', path: '/dashboard' },
  { key: 'nav.aiIntelligence', path: '/ai-intelligence' },
  { key: 'nav.standards', path: '/standards' },
  { key: 'nav.handbooks', path: '/handbooks' },
  { key: 'nav.testingLabs', path: '/testing-labs' },
  { key: 'nav.consumerServices', path: '/consumer-services' },
  { key: 'nav.reports', path: '/reports' },
  { key: 'nav.profile', path: '/profile' }
];

export function DashboardLayout({children,go,path,isHome}:{children:ReactNode;go:(to:string)=>void;path?:string;isHome?:boolean}) {
  const {user, signOut}=useApp(); 
  const {t}=useLanguage();
  
  const organizationOnlyRoutes = [
    '/handbooks',
    '/testing-labs',
    '/consumer-services',
    '/reports'
  ];
  
  const visibleNavKeys = navKeys.filter(n => 
    user?.account_type === 'organization' ? true : !organizationOnlyRoutes.includes(n.path)
  );
  
  return <><Navbar go={go}/><div className="shell"><aside><div className="role-label">{user?.role ?? 'individual'} {t('nav.workspace')}</div><button aria-label="Home" title="Home" className={path === '/' ? 'active' : ''} onClick={()=>go('/')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> Home</button>{visibleNavKeys.map(n=><button key={n.key} className={path === n.path ? 'active' : ''} onClick={()=>go(n.path)}>{t(n.key)}</button>)}<div style={{ marginTop: 'auto' }} /><button aria-label="Log out" title="Log out" onClick={()=>{ signOut().then(()=>go('/')); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px', color: 'var(--muted)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Log out</button></aside><main className={`dashboard-main ${isHome ? 'no-padding' : ''}`}>{children}</main></div></>; 
}
