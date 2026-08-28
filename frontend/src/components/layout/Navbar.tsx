import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { LanguageSelector } from '../../i18n/LanguageSelector';
import { useLanguage } from '../../i18n/LanguageContext';

export function Navbar({go}:{go:(to:string)=>void}) { 
  const {user,theme,setTheme}=useApp(); 
  const {t}=useLanguage();
  return <header className="nav"><button className="brand" onClick={()=>go('/')}>MANAK <span>मानक</span></button><nav><button onClick={()=>go('/standards')}>{t('nav.standards')}</button><button onClick={()=>go('/services')}>{t('nav.consumerServices')}</button><button onClick={()=>go('/how-it-works')}>How it works</button></nav><div className="nav-actions"><LanguageSelector /><button className="icon-button" aria-label="Toggle theme" onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme==='light'?'◐':'☼'}</button>{user?<button aria-label="Profile" className="profile" onClick={()=>go('/profile')} style={user.avatar_url ? { padding: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}}>{user.avatar_url ? <img src={user.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.parentElement) { e.currentTarget.parentElement.style.padding = ''; e.currentTarget.parentElement.innerText = user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'; } }} /> : (user.name?.slice(0,1)?.toUpperCase() || user.email?.slice(0,1)?.toUpperCase() || '?')}</button>:<Button onClick={()=>go('/login')}>{t('nav.login')}</Button>}</div></header>; 
}
