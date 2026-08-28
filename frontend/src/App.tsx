import { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/layout/Navbar';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Input } from './components/ui/Input';
import { EmptyState } from './components/common/States';
import { news } from './data/mockData';
import { standardsApi } from './services/standardsApi';
import { testingApi } from './services/testingApi';
import { aiApi } from './services/aiApi';
import { authApi } from './services/authApi';
import { handbookApi } from './services/handbookApi';
import { reportsApi } from './services/reportsApi';
import { useApp } from './context/AppContext';
import type { ChatMessage, Standard, Laboratory } from './types';
import { useLanguage } from './i18n/LanguageContext';
import type { AIConversationSummary } from './types';
import { AboutPage } from './pages/AboutPage';
import { ConsumerServicesPage } from './pages/ConsumerServicesPage';

const feature=[['✦','AI Intelligence','Ask clear, cited questions across your standards knowledge.'],['⌘','Standards','Discover structured, useful demo standards references.'],['▤','Handbooks','Turn guidance into practical next steps.'],['◎','Testing','Find the right testing pathway and laboratory.'],['◇','Consumer guidance','Make confident choices with trusted context.']];
export function App({path,go}:{path:string;go:(p:string)=>void}) { 
  const {user, loading}=useApp(); 
  const protectedPath=['/dashboard','/ai-intelligence','/handbooks','/testing-labs','/reports','/consumer-services','/profile'].includes(path); 
  if(loading) return <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw' }}>Loading...</main>; 
  if(protectedPath&&!user) return <Login go={go}/>; 
  if(path==='/login') return <Login go={go}/>; 
  if(path==='/register') return <Register go={go}/>; 
  if(path==='/forgot-password') return <ForgotPassword go={go}/>; 
  if(path==='/reset-password') return <ResetPassword go={go}/>; 
  if(path==='/about') return <Public><Simple title="Knowledge for every standards journey" text="Built for consumers, industry teams and administrators to turn complex requirements into usable understanding."/></Public>; 
  
  const Layout = user ? DashboardLayout : Public;
  if(path==='/how-it-works') return <Layout path={path} go={go} isHome={true}><AboutPage go={go}/></Layout>; 
  if(path==='/standards'||path==='/standards-explorer') return <Layout path={path} go={go}><Standards/></Layout>; 
  if(path==='/') return <Layout path={path} go={go} isHome={true}><Home go={go}/></Layout>;
  
  // Authenticated routes
  if(path==='/dashboard') return <DashboardLayout path={path} go={go}><Dashboard go={go}/></DashboardLayout>; 
  if(path==='/ai-intelligence') return <DashboardLayout path={path} go={go}><AI/></DashboardLayout>; 
  if(path==='/handbooks') return user?.account_type === 'organization' ? <DashboardLayout path={path} go={go}><Handbooks/></DashboardLayout> : <DashboardLayout path={path} go={go}><Dashboard go={go}/></DashboardLayout>; 
  if(path==='/testing-labs') return user?.account_type === 'organization' ? <DashboardLayout path={path} go={go}><LaboratoryFinder/></DashboardLayout> : <DashboardLayout path={path} go={go}><Dashboard go={go}/></DashboardLayout>; 
  if(path==='/profile') return <DashboardLayout path={path} go={go}><ProfilePage /></DashboardLayout>;
  if(path==='/services'||path==='/consumer-services') return <Layout path={path} go={go} isHome={true}><ConsumerServicesPage go={go}/></Layout>;
  if(path==='/reports') return user?.account_type === 'organization' ? <DashboardLayout path={path} go={go}><ReportsPage /></DashboardLayout> : <DashboardLayout path={path} go={go}><Dashboard go={go}/></DashboardLayout>; 
  
  if(user) return <DashboardLayout path={path} go={go}><div style={{padding: '40px'}}><EmptyState title="Page not found" /></div></DashboardLayout>;
  return <Public><Home go={go}/></Public>; 
}
function Public({children}:{children:React.ReactNode}) { return <><Navbar go={(p)=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));}}/>{children}<footer>MANAK <span>मानक</span><small>Frontend demonstration · content, standards and facilities are illustrative only.</small></footer></>; }
function Home({go}:{go:(p:string)=>void}) {
  const {t}=useLanguage();
  const {user}=useApp();
  return <><section className="hero"><div><p className="eyebrow">{t('home.eyebrow')}</p><h1>{t('home.title1')}<br/><i>{t('home.title2')}</i></h1><p className="hero-copy">{t('home.subtitle')}</p><div className="actions"><Button onClick={()=>go('/standards')}>{t('home.explore')}</Button><Button variant="secondary" onClick={()=>go(user ? '/dashboard' : '/login')}>{t('home.getStarted')}</Button></div><div className="trustline">{t('home.trustline')}</div></div><div className="hero-art"><span className="orb one"/><span className="orb two"/><div className="seal">M</div><div className="floating doc">IS 10500<br/><small>Water quality</small></div><div className="floating ai">{t('home.aiContext')}</div></div></section><section className="section"><p className="eyebrow">{t('home.section.eyebrow')}</p><h2 style={{whiteSpace:'pre-line'}}>{t('home.section.title')}</h2><div className="feature-grid">{feature.map(([icon,title,text])=><Card key={title}><b className="feature-icon">{icon}</b><h3>{title}</h3><p>{text}</p></Card>)}</div></section><section className="process section"><p className="eyebrow">How MANAK works</p><div className="steps">{['Ask','Discover','Understand','Comply'].map((x,i)=><div key={x}><span>0{i+1}</span><h3>{x}</h3><p>{['Start with a real product, question or challenge.','Find connected standards, guidance and pathways.','Use clear explanations, sources and relevant context.','Turn knowledge into the next practical action.'][i]}</p></div>)}</div></section><section className="cta"><p className="eyebrow">Make standards usable</p><h2>Explore MANAK.</h2><Button onClick={()=>go(user ? '/dashboard' : '/login')}>Enter the platform →</Button></section></>}
function Login({go}:{go:(p:string)=>void}) {
  const {signIn}=useApp();
  const [email,setEmail]=useState('demo@manak.in');
  const [password,setPassword]=useState('password');
  const [showPassword,setShowPassword]=useState(false);
  const [loginState,setLoginState]=useState<'idle'|'loading'|'error'>('idle');
  const [errorMsg,setErrorMsg]=useState('');
  
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    setLoginState('loading');
    try {
      const data = await authApi.login(email, password);
      signIn(data.user, data.token);
      go('/dashboard');
    } catch(err:unknown) {
      const message = err instanceof Error ? err.message : '';
      console.error("LOGIN ERROR:", err);
      if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('incorrect') || message.toLowerCase().includes('not found')) {
        setErrorMsg('Incorrect email or password.');
      } else {
        setErrorMsg('Unable to sign in right now. Please try again.');
      }
      setLoginState('error');
    }
  };

  return <main className="auth"><div className="auth-brand"><button className="brand" onClick={()=>go('/')}>MANAK <span>मानक</span></button><h1>Ready to go<br/><i>beyond standards?</i></h1><p>Move from requirements to confident action with knowledge designed for India.</p><div className="auth-graphic">✦</div></div>
  <form className="auth-form" onSubmit={submit} style={{ maxWidth: '400px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
    <p className="eyebrow" style={{ textTransform: 'uppercase' }}>Welcome to MANAK</p>
    <h2>Sign in to your workspace</h2>
    
    <label style={{ marginTop: '1.5rem' }}>Email address
      <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/>
    </label>
    
    <label style={{ marginTop: '1rem' }}>Password
      <div style={{ position: 'relative' }}>
        <Input type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" style={{ paddingRight: '40px' }}/>
        <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}>
          {showPassword ? '👁' : '👁‍🗨'}
        </button>
      </div>
    </label>
    
    {loginState==='error' && (
      <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.75rem', borderRadius: '4px', fontSize: '0.875rem', marginTop: '0.5rem', fontWeight: 500 }}>
        {errorMsg}
      </div>
    )}
    
    <Button type="submit" disabled={loginState==='loading'} style={{ width: '100%', marginTop: '1.5rem' }}>
      {loginState==='loading'?'Signing in...':'Sign in'}
    </Button>
    
    <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
      <button type="button" className="text-button" onClick={()=>go('/forgot-password')}>Forgot password?</button>
    </div>
    
    <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-light)', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
      Don't have an account?<br/>
      <button type="button" className="text-button" onClick={()=>go('/register')} style={{ marginTop: '0.5rem', fontWeight: 600 }}>Create account</button>
    </div>
  </form>
  </main>
}

function Register({go}:{go:(p:string)=>void}) {
  const {signIn}=useApp();
  const [firstName,setFirstName]=useState('');
  const [lastName,setLastName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [showConfirmPassword,setShowConfirmPassword]=useState(false);
  const [accountType,setAccountType]=useState<'individual'|'organization'>('individual');
  const [organizationName,setOrganizationName]=useState('');
  const [productType,setProductType]=useState('');
  const [terms,setTerms]=useState(false);
  const [regState,setRegState]=useState<'idle'|'loading'|'error'>('idle');
  const [errorMsg,setErrorMsg]=useState('');
  
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      setRegState('error');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters');
      setRegState('error');
      return;
    }
    if (!terms) {
      setErrorMsg('You must agree to the Terms and Privacy Policy');
      setRegState('error');
      return;
    }
    
    setRegState('loading');
    try {
      const name = `${firstName} ${lastName}`.trim();
      const payload = accountType === 'organization'
        ? { account_type: 'organization' as const, organizationName, product_type: productType, email, password, role: 'organization' }
        : { account_type: 'individual' as const, name, email, password, role: 'individual' };
        
      const data = await authApi.register(payload);
      signIn(data.user, data.token);
      go('/dashboard');
    } catch(err:unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setErrorMsg(message);
      setRegState('error');
    }
  };

  return <main className="auth"><div className="auth-brand"><button className="brand" onClick={()=>go('/')}>MANAK <span>मानक</span></button><h1>Ready to go<br/><i>beyond standards?</i></h1><p>Move from requirements to confident action with knowledge designed for India.</p><div className="auth-graphic">✦</div></div>
  <form className="auth-form" onSubmit={submit} style={{ maxWidth: '400px' }}>
    <p className="eyebrow">Join MANAK</p>
    <h2>Create your account</h2>
    
    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'var(--surface-sunken)', padding: '0.5rem', borderRadius: '0.5rem' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
        <input type="radio" name="accountType" checked={accountType === 'individual'} onChange={() => setAccountType('individual')} />
        Individual
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
        <input type="radio" name="accountType" checked={accountType === 'organization'} onChange={() => setAccountType('organization')} />
        Organization
      </label>
    </div>

    {accountType === 'individual' && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <label>First name<Input type="text" value={firstName} onChange={e=>setFirstName(e.target.value)} required/></label>
        <label>Last name<Input type="text" value={lastName} onChange={e=>setLastName(e.target.value)} required/></label>
      </div>
    )}
    
    {accountType === 'organization' && (
      <>
        <label>Organization name<Input type="text" value={organizationName} onChange={e=>setOrganizationName(e.target.value)} required placeholder="e.g. ABC Manufacturing Pvt Ltd"/></label>
        <label>What product do you manufacture or plan to manufacture?<Input type="text" value={productType} onChange={e=>setProductType(e.target.value)} required placeholder="e.g. Electrical appliances, Cement"/></label>
      </>
    )}
    
    <label>Email<Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
    
    <label>Password
      <div style={{ position: 'relative' }}>
        <Input type={showPassword ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} style={{ paddingRight: '40px' }}/>
        <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {showPassword ? '👁' : '👁‍🗨'}
        </button>
      </div>
    </label>
    <label>Confirm password
      <div style={{ position: 'relative' }}>
        <Input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required minLength={8} style={{ paddingRight: '40px' }}/>
        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? "Hide password" : "Show password"} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {showConfirmPassword ? '👁' : '👁‍🗨'}
        </button>
      </div>
    </label>
    
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal', marginBottom: '1rem' }}>
      <input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)} required />
      <span style={{ fontSize: '0.85rem' }}>I agree to the <button type="button" onClick={()=>go('/about')} className="text-button" style={{ display: 'inline', padding: 0 }}>Terms</button> and <button type="button" onClick={()=>go('/about')} className="text-button" style={{ display: 'inline', padding: 0 }}>Privacy Policy</button></span>
    </label>
    
    {regState==='error' && <p style={{color:'red', margin:0, marginBottom: '1rem'}}>{errorMsg}</p>}
    <Button type="submit" disabled={regState==='loading'}>{regState==='loading'?'Creating account...':'Create account'}</Button>
    <p><button type="button" className="text-button" onClick={()=>go('/login')}>Already have an account? Login</button></p>
  </form>
  </main>
}

function ForgotPassword({go}:{go:(p:string)=>void}) {
  const {t}=useLanguage();
  const [email,setEmail]=useState('');
  const [status,setStatus]=useState<'idle'|'loading'|'success'|'error'>('idle');
  const [errorMsg,setErrorMsg]=useState('');
  
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    setStatus('loading');
    try {
      await authApi.forgotPassword(email);
      setStatus('success');
    } catch(err:unknown) {
      const message = err instanceof Error ? err.message : t('common.error');
      setErrorMsg(message);
      setStatus('error');
    }
  };
  
  return <main className="auth"><div className="auth-brand"><button className="brand" onClick={()=>go('/')}>MANAK <span>मानक</span></button><h1>Recover your<br/><i>account</i></h1></div>
    <form className="auth-form" onSubmit={submit}>
      <p className="eyebrow">{t('auth.forgotTitle')}</p>
      <h2>{t('auth.forgotTitle')}</h2>
      {status==='success' ? (
        <><p>If an account exists, a password recovery email has been sent to {email}.</p><Button type="button" onClick={()=>go('/login')}>{t('auth.backToLogin')}</Button></>
      ) : (
        <>
          <label>{t('auth.email')}<Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
          {status==='error' && <p style={{color:'red'}}>{errorMsg}</p>}
          <Button type="submit" disabled={status==='loading'}>{status==='loading'?'Sending...':'Send Recovery Email →'}</Button>
          <p><button type="button" className="text-button" onClick={()=>go('/login')}>Back to login</button></p>
        </>
      )}
    </form>
  </main>;
}

function ResetPassword({go}:{go:(p:string)=>void}) {
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [status,setStatus]=useState<'idle'|'loading'|'success'|'error'>('idle');
  const [errorMsg,setErrorMsg]=useState('');
  
  // Try to parse the token from the hash: #access_token=...&type=recovery
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  const type = params.get('type');
  
  if (!token || type !== 'recovery') {
    return <main className="auth"><div className="auth-form"><h2>Invalid link</h2><p>This password reset link is invalid or has expired.</p><Button onClick={()=>go('/forgot-password')}>Request new link</Button></div></main>;
  }
  
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(password!==confirm) {
      setErrorMsg('Passwords do not match');
      setStatus('error');
      return;
    }
    if(password.length<8) {
      setErrorMsg('Password must contain at least 8 characters');
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      await authApi.updatePassword(token, password);
      setStatus('success');
    } catch(err:unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update password';
      setErrorMsg(message);
      setStatus('error');
    }
  };
  
  return <main className="auth"><div className="auth-brand"><button className="brand" onClick={()=>go('/')}>MANAK <span>मानक</span></button><h1>Set new<br/><i>password</i></h1></div>
    <form className="auth-form" onSubmit={submit}>
      <p className="eyebrow">Password Reset</p>
      <h2>Update Password</h2>
      {status==='success' ? (
        <><p>Your password has been successfully updated.</p><Button type="button" onClick={()=>go('/login')}>Proceed to login →</Button></>
      ) : (
        <>
          <label>New Password<Input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8}/></label>
          <label>Confirm Password<Input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>
          {status==='error' && <p style={{color:'red'}}>{errorMsg}</p>}
          <Button type="submit" disabled={status==='loading'}>{status==='loading'?'Updating...':'Update Password →'}</Button>
        </>
      )}
    </form>
  </main>;
}
const GREETINGS = [
  "Hello, ",
  "नमस्ते, ",
  "ನಮಸ್ಕಾರ, ",
  "வணக்கம், ",
  "నమస్కారం, ",
  "ନମସ୍କାର, ",
  "নমস্কার, ",
  "નમસ્તે, "
];

function Dashboard({go}:{go:(p:string)=>void}) {
  const {user}=useApp();
  const isOrg = user?.account_type === 'organization';
  
  const [greetingIdx] = useState(() => {
    try {
      const saved = sessionStorage.getItem('manak_gidx');
      let next = saved ? parseInt(saved, 10) + 1 : 0;
      if (isNaN(next) || next >= GREETINGS.length) next = 0;
      sessionStorage.setItem('manak_gidx', next.toString());
      return next;
    } catch {
      return 0;
    }
  });
  
  let displayName = user?.name || '';
  if (isOrg) {
    const lower = displayName.toLowerCase().trim();
    if (!lower.endsWith('org.') && !lower.endsWith('org')) {
      displayName = displayName.trim() + ' org.';
    } else if (lower.endsWith('org')) {
      displayName = displayName.trim() + '.';
    }
  } else {
    displayName = displayName.split(' ')[0] + '.';
  }
  
  return (
    <>
      <div className="welcome">
        <div>
          <p className="eyebrow">{user?.role} workspace</p>
          <h1>{GREETINGS[greetingIdx]}{displayName}</h1>
          <p>Your knowledge workspace is ready for the next decision.</p>
        </div>
        <span className="notification">◌</span>
      </div>
      
      <div className="spotlight">
        <div>
          <p className="eyebrow">AI intelligence</p>
          <h2>Ask a standards question.<br/>Get the context behind it.</h2>
          <Button onClick={()=>go('/ai-intelligence')}>Start a conversation →</Button>
        </div>
        <div className="ai-visual">✦</div>
      </div>
      
      <div className="dashboard-grid">
        {isOrg && (
          <Card className="handbook-hero">
            <p className="eyebrow">Handbooks</p>
            <h2>Make knowledge practical.</h2>
            <p>Explore curated guides designed to move work forward.</p>
            <button onClick={()=>go('/handbooks')}>Browse handbooks →</button>
          </Card>
        )}
        <Card>
          <p className="eyebrow">What’s new</p>
          {news.map((n, i) => {
            let route = '';
            if (n.includes('handbook')) route = '/handbooks';
            else if (n.includes('Standards')) route = '/standards';
            else if (n.includes('Voice')) route = '/ai-intelligence';

            return (
              <p 
                className="news" 
                key={n}
                onClick={() => route && go(route)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && route) {
                    e.preventDefault();
                    go(route);
                  }
                }}
                tabIndex={0}
                role="button"
                style={{
                  borderBottom: i < news.length - 1 ? '1px solid var(--border)' : 'none',
                  padding: '1rem 0',
                  margin: 0,
                  cursor: route ? 'pointer' : 'default',
                  transition: 'color 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  outline: 'none'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'inherit' }}
                onFocus={(e) => { e.currentTarget.style.color = 'var(--primary)' }}
                onBlur={(e) => { e.currentTarget.style.color = 'inherit' }}
              >
                <span>✦ {n}</span>
                {route && <span style={{ opacity: 0.5, fontSize: '1.2em' }}>→</span>}
              </p>
            );
          })}
        </Card>
      </div>
      
      <div className="quick">
        <h2>Continue exploring</h2>
        <button onClick={()=>go('/standards')}>Browse standards <span>→</span></button>
        {isOrg && <button onClick={()=>go('/testing-labs')}>Find a testing lab <span>→</span></button>}
        {isOrg && <button onClick={()=>go('/consumer-services')}>Consumer guidance <span>→</span></button>}
      </div>
    </>
  );
}
function Standards() {
  const [q,setQ]=useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items,setItems]=useState<Standard[]>([]); 
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<Standard | null>(null);
  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
  
  useEffect(()=>{
    standardsApi.list('', '', 1, 100).then(res => {
      const all = res.items;
      const cats = new Set<string>();
      all.forEach(s => {
        if (s.categories && s.categories.length > 0) {
          s.categories.forEach(c => cats.add(c));
        } else if (s.category) {
          cats.add(s.category);
        }
      });
      setCategories(Array.from(cats).sort());
    });
  }, []);
  
  useEffect(()=>{
    standardsApi.list(q, category, page, 12).then(res => {
      setItems(res.items);
      setTotal(res.total);
    });
  },[q, category, page]);

  const totalPages = Math.ceil(total / 12);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };



  return (
    <section className="page">
      <p className="eyebrow">Bureau of Indian Standards</p>
      <h1>Explore standards</h1>
      <p className="intro">Searchable official catalogue of standards, handbooks, and regulatory documents.</p>
      <div className="search-row">
        <Input aria-label="Search standards" value={q} onChange={e=>{setQ(e.target.value); setPage(1);}} placeholder="Search number, title, category or industry"/>
        <select className="filter" value={category} onChange={e => {setCategory(e.target.value); setPage(1);}} style={{ padding: '0 16px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
          <option value="">All categories ▾</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      
      {total > 0 && (
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
          Showing {(page - 1) * 12 + 1}–{Math.min(page * 12, total)} of {total} {total === 1 ? 'standard' : 'standards'} found
        </p>
      )}

      <div className="standard-grid">
        {items.map(s=>
          <Card key={s.id} className="standard" onClick={() => setSelected(s)} style={{ cursor: 'pointer' }}>
            <div className="card-top">
              <b>{s.code}</b>
              {s.status && <span className={s.status==='current'?'status':'status review'}>{s.status}</span>}
            </div>
            <h3>{s.title}</h3>
            {s.description && s.description !== 'Document Type: Standard' && s.description !== 'Document Type: Handbook' && <p>{s.description}</p>}
            <div className="tags">
              {s.year && <span>{s.year}</span>}
              {s.categories && s.categories.length > 0 ? (
                s.categories.map(c => <span key={c}>{c}</span>)
              ) : (
                s.category && <span>{s.category}</span>
              )}
              {s.description && (s.description === 'Document Type: Standard' || s.description === 'Document Type: Handbook') && <span>{s.description.split(': ')[1]}</span>}
            </div>
          </Card>
        )}
      </div>
      
      {!items.length&&<EmptyState title="No standards match that search"/>}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '32px', marginBottom: '32px' }}>
          <button 
            onClick={() => handlePageChange(page - 1)} 
            disabled={page === 1}
            style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1, color: 'var(--text)' }}
          >
            ← Previous
          </button>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button 
              key={p} 
              onClick={() => handlePageChange(p)}
              style={{ 
                padding: '8px 16px', 
                background: p === page ? 'var(--accent)' : 'transparent', 
                color: p === page ? 'white' : 'var(--text)', 
                border: p === page ? '1px solid var(--accent)' : '1px solid var(--border)', 
                borderRadius: '4px', 
                cursor: 'pointer',
                fontWeight: p === page ? 'bold' : 'normal'
              }}
            >
              {p}
            </button>
          ))}
          
          <button 
            onClick={() => handlePageChange(page + 1)} 
            disabled={page === totalPages}
            style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1, color: 'var(--text)' }}
          >
            Next →
          </button>
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setSelected(null)}>
          <div style={{ background: 'var(--surface)', padding: '32px', borderRadius: '8px', maxWidth: '600px', width: '90%', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</button>
            <div style={{ marginBottom: '24px' }}>
              <p className="eyebrow">{selected.code} {selected.year ? `(${selected.year})` : ''}</p>
              <h2 style={{ marginTop: '8px', marginBottom: '16px' }}>{selected.title}</h2>
              {selected.description && <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>{selected.description}</p>}
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Categories</small>
                  <b>{selected.categories && selected.categories.length > 0 ? selected.categories.join(', ') : selected.category || 'N/A'}</b>
                </div>
                <div>
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Industry</small>
                  <b>{selected.industry || 'N/A'}</b>
                </div>
                <div>
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Status</small>
                  <b style={{ textTransform: 'capitalize' }}>{selected.status?.replace('_', ' ') || 'N/A'}</b>
                </div>
                <div>
                  <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Source File</small>
                  <b>{selected.file_name || 'N/A'}</b>
                </div>
              </div>
            </div>
            
            {selected.file_name ? (
              <div style={{ display: 'flex', gap: '16px' }}>
                <a href={`${API_URL}/datasets/${selected.file_name}`} target="_blank" rel="noopener noreferrer" style={{ padding: '12px 24px', background: 'var(--accent)', color: 'white', borderRadius: '4px', textDecoration: 'none', fontWeight: 600, flex: 1, textAlign: 'center' }}>OPEN PDF →</a>
                <a href={`${API_URL}/datasets/${selected.file_name}`} download style={{ padding: '12px 24px', background: 'var(--surface-sunken)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', textDecoration: 'none', fontWeight: 600, flex: 1, textAlign: 'center' }}>DOWNLOAD PDF ↓</a>
              </div>
            ) : (
              <p style={{ color: 'var(--error)' }}>PDF source file not available for this standard.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
function AI(){
  const { t, language } = useLanguage();
  const [question,setQuestion]=useState('');
  const [loading,setLoading]=useState(false);
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [conversations,setConversations]=useState<AIConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState('');
  const [activeConversationId,setActiveConversationId]=useState<string|undefined>();
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const voiceLanguages = [
    { code: 'en-IN', label: 'English', display: 'English · English' },
    { code: 'hi-IN', label: 'हिन्दी', display: 'Hindi · हिन्दी' },
    { code: 'kn-IN', label: 'ಕನ್ನಡ', display: 'Kannada · ಕನ್ನಡ' },
    { code: 'ta-IN', label: 'தமிழ்', display: 'Tamil · தமிழ்' },
    { code: 'te-IN', label: 'తెలుగు', display: 'Telugu · తెలుగు' },
    { code: 'or-IN', label: 'ଓଡ଼ିଆ', display: 'Odia · ଓଡ଼ିଆ' }
  ];

  const [voiceLang, setVoiceLang] = useState(() => {
    return localStorage.getItem('manak_voice_lang') || 'en-IN';
  });

  useEffect(() => {
    localStorage.setItem('manak_voice_lang', voiceLang);
  }, [voiceLang]);

  const startVoiceInput = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser.');
      return;
    }
    
    // Use the stored instance if available, or create a new one
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
    }
    
    const recognition = recognitionRef.current;
    
    // Set Speech API lang code
    recognition.lang = voiceLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        alert('Microphone access is required for voice input.');
      } else {
        alert('Voice service is unavailable right now.');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const loadHistory = () => {
    setConversationsLoading(true);
    setConversationsError('');
    aiApi.getConversations()
      .then(setConversations)
      .catch(e => setConversationsError(e.message || 'Failed to load history'))
      .finally(() => setConversationsLoading(false));
  };

  useEffect(()=>{
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
  },[]);

  const loadConversation=async(id:string)=>{
    setLoading(true);
    try {
      const conv = await aiApi.getConversationHistory(id);
      setActiveConversationId(conv.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMessages(conv.messages.map((m: any)=>({
        id: m.id,
        role: m.role,
        text: m.content,
        citations: m.citations,
        confidence: m.metadata?.confidence !== null && m.metadata?.confidence !== undefined ? Math.round(m.metadata.confidence) : undefined
      })));
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  };

  const startNew=()=>{
    setActiveConversationId(undefined);
    setMessages([]);
  };

  const ask=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!question.trim()||loading)return;
    const q=question;
    setQuestion('');
    setMessages(m=>[...m,{id:crypto.randomUUID(),role:'user',text:q}]);
    setLoading(true);
    try {
      const reply=await aiApi.ask(q, activeConversationId, language);
      setActiveConversationId(reply.conversationId);
      setMessages(m=>[...m,reply.message]);
      // refresh conversations to show new title
      loadHistory();
    } catch(e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
      setMessages(m=>[...m,{
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `⚠️ Request failed: ${errorMessage}.\n\nIf this persists, verify that the AI service is running and properly configured.`
      }]);
    }
    setLoading(false);
  };

  return <section className="ai-page">
    <div className="ai-head">
      <div>
        <p className="eyebrow">{t('ai.eyebrow')}</p>
        <h1 style={{whiteSpace:'pre-line'}}>{t('ai.title')}</h1>
      </div>
      <p>{t('ai.subtitle')}</p>
    </div>
    <div className="chat">
      <div className="chat-side">
        <button className="new-chat-btn" onClick={startNew}>{t('ai.newConversation')}</button>
        <div className="conv-list">
          <p className="eyebrow">{t('ai.searchHistory')}</p>
          {conversationsLoading && <p className="history-msg">{t('ai.historyLoading')}</p>}
          {conversationsError && <div className="history-msg error">
            <p>{conversationsError}</p>
            <button onClick={loadHistory} className="retry-btn">{t('common.retry')}</button>
          </div>}
          {!conversationsLoading && !conversationsError && conversations.length === 0 && <p className="history-msg empty">{t('ai.historyEmpty')}</p>}
          {!conversationsLoading && !conversationsError && conversations.map(c=>(
            <button key={c.id} className={`history-item ${activeConversationId===c.id?'active':''}`} onClick={()=>loadConversation(c.id)}>
              <span className="title">{c.title || t('ai.untitled')}</span>
              <span className="meta">
                {new Date(c.updatedAt).toLocaleDateString()} · {c.messageCount} {c.messageCount !== 1 ? t('ai.msgs') : t('ai.msg')}
              </span>
            </button>
          ))}
        </div>
        <p className="eyebrow">{t('ai.suggested')}</p>
        {['What testing is typically involved?','Help me understand IS 10500','What requirements apply to this product?'].map(q=><button key={q} onClick={()=>setQuestion(q)}>{q} →</button>)}
        <div className="voice-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('ai.voice')}</span>
            <select
              value={voiceLang}
              onChange={(e) => setVoiceLang(e.target.value)}
              style={{ padding: '2px 5px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--surface)' }}
              aria-label="Voice language"
            >
              {voiceLanguages.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <small>{voiceLanguages.find(l => l.code === voiceLang)?.display}</small>
        </div>
      </div>
      <div className="messages">
        {messages.length === 0 && !loading && (
           <article className="message assistant">
             <div className="avatar">✦</div>
             <div><p>{t('ai.greeting')}</p></div>
           </article>
        )}
        {messages.map(m=><article key={m.id} className={`message ${m.role}`}>
          <div className="avatar">{m.role==='assistant'?'✦':'You'}</div>
          <div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{m.text}</div>
            {m.citations && m.citations.length > 0 && <>
              {m.confidence !== undefined && <div className="confidence">{t('ai.confidence')} {m.confidence}%</div>}
              <div className="sources">
                {m.citations.map((c, i)=>{
                  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
                  const href = c.file_name ? `${API_URL}/datasets/${c.file_name}${c.page ? `#page=${c.page}` : ''}` : undefined;
                  const content = `▤ Source: ${c.document_title || c.document_id}${c.page ? `, Page ${c.page}` : ''}${c.section ? `, Sec ${c.section}` : ''}${c.clause ? `, Clause ${c.clause}` : ''}${c.source ? `, File: ${c.source.replace('internal:', '')}` : ''}`;
                  return href ? <a key={i} href={href} target="_blank" rel="noopener noreferrer" title={`Relevance: ${c.relevance}`}>{content}</a> : <span key={i} title={`Relevance: ${c.relevance}`}>{content}</span>;
                })}
              </div>
            </>}
          </div>
        </article>)}
        {loading&&<article className="message assistant"><div className="avatar">✦</div><div className="typing"><i/><i/><i/> {t('ai.reading')}</div></article>}
        <form className="ai-input" onSubmit={ask}>
          <Input value={question} onChange={e=>setQuestion(e.target.value)} placeholder={t('ai.placeholder')} disabled={loading} />
          <button type="button" aria-label="Voice input" onClick={startVoiceInput} disabled={loading} style={isListening ? {color: 'var(--red)', fontWeight: 'bold', width: 'auto', padding: '0 12px'} : {}}>
            {isListening ? `● Listening... (${voiceLanguages.find(l => l.code === voiceLang)?.label})` : '◉'}
          </button>
          <Button type="submit" disabled={loading || !question.trim()}>{t('ai.send')}</Button>
        </form>
        <div ref={messagesEndRef} />
      </div>
    </div>
  </section>;
}
function Handbooks() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Standard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingHandout, setLoadingHandout] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    standardsApi.list('', '', 1, 100).then(res => setItems(res.items));
  }, []);

  const filteredItems = items.filter(h => 
    h.title.toLowerCase().includes(q.toLowerCase()) || 
    h.code.toLowerCase().includes(q.toLowerCase())
  );

  const toggleSelect = (fileName: string) => {
    const next = new Set(selected);
    if (next.has(fileName)) next.delete(fileName);
    else next.add(fileName);
    setSelected(next);
  };

  const handleMakeHandout = async () => {
    if (selected.size === 0 || !localStorage.getItem('manak_auth_token')) return;
    setLoadingHandout(true);
    setErrorMsg('');
    try {
      const blob = await handbookApi.makeHandout(Array.from(selected), localStorage.getItem('manak_auth_token') || '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MANAK-Handout-${selected.size}-Documents.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate handout');
    } finally {
      setLoadingHandout(false);
    }
  };


  return (
    <section className="page">
      <div className="handbook-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: '8px' }}>CURATED GUIDANCE</p>
          <h1 style={{ margin: 0 }}>Handbooks</h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          {selected.size > 0 && (
            <Button 
              disabled={loadingHandout} 
              onClick={handleMakeHandout}
            >
              {loadingHandout ? 'Creating Handout...' : `Make Handout · ${selected.size} PDF${selected.size > 1 ? 's' : ''}`}
            </Button>
          )}
          {errorMsg && <p style={{ color: 'red', marginTop: '0.5rem', fontSize: '0.9rem' }}>{errorMsg}</p>}
        </div>
      </div>
      
      <div className="search-row" style={{ position: 'relative', marginBottom: '2rem' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <Input 
          value={q} 
          onChange={e => setQ(e.target.value)} 
          placeholder="Search standards by number or title" 
          style={{ paddingLeft: '48px', height: '48px', fontSize: '1rem', width: '100%', maxWidth: '600px' }} 
        />
      </div>
      
      <div className="standards-grid">
        {filteredItems.map(s => {
          const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
          const pdfUrl = `${API_URL}/datasets/${s.file_name}`;
          
          return (
            <Card key={s.id} className="standard-card interactive-card" style={{ cursor: 'pointer' }} onClick={() => { if(s.file_name) toggleSelect(s.file_name); }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <input 
                  type="checkbox" 
                  checked={s.file_name ? selected.has(s.file_name) : false} 
                  onChange={() => {}} 
                  style={{ marginTop: '6px', width: '20px', height: '20px', cursor: 'pointer' }}
                  onClick={(e) => e.stopPropagation()} 
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--ink)' }}>{s.code}</h3>
                    <div className="status" style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', backgroundColor: s.status === 'current' ? 'var(--green)' : 'var(--border)', color: s.status === 'current' ? '#fff' : 'var(--ink)', fontWeight: 600 }}>
                      {s.status === 'current' ? 'Current' : 'Under Review'}
                    </div>
                  </div>
                  <p style={{ color: 'var(--muted)', marginBottom: '16px', lineHeight: '1.5' }}>{s.title}</p>
                  
                  <div className="tags" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    {s.year && <span style={{ backgroundColor: 'var(--surface)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', border: '1px solid var(--border)' }}>{s.year}</span>}
                    {s.description && (s.description === 'Document Type: Standard' || s.description === 'Document Type: Handbook') && <span style={{ backgroundColor: 'var(--surface)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', border: '1px solid var(--border)' }}>{s.description.split(': ')[1]}</span>}
                    {s.categories && s.categories.length > 0 ? (
                      s.categories.map(c => <span key={c} style={{ backgroundColor: 'var(--surface)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', border: '1px solid var(--border)' }}>{c}</span>)
                    ) : (
                      s.category && <span style={{ backgroundColor: 'var(--surface)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', border: '1px solid var(--border)' }}>{s.category}</span>
                    )}
                  </div>
                  
                  <div className="standard-actions" style={{ display: 'flex', gap: '16px', marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '16px' }} onClick={e => e.stopPropagation()}>
                    <button 
                      className="pdf-btn"
                      onClick={() => window.open(pdfUrl, '_blank')}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      Open PDF →
                    </button>
                    <a 
                      className="pdf-btn"
                      href={pdfUrl} 
                      download 
                      style={{ color: 'var(--muted)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      Download PDF ↓
                    </a>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
function LaboratoryFinder(){
  const {t} = useLanguage();
  const [pin, setPin] = useState('');
  const [location, setLocation] = useState<string | undefined>('');
  const [result, setResult] = useState<Laboratory[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [notice, setNotice] = useState<string>('');

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      setError(t('auth.invalidPin'));
      return;
    }
    setError('');
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await testingApi.locate(pin);
      setLocation(data.location);
      setResult(data.laboratories);
      setNotice(data.notice || '');
      if (data.laboratories[0]) setSelected(data.laboratories[0].id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg === 'API Error' ? t('lab.error') : msg || t('lab.error'));
    } finally {
      setLoading(false);
    }
  };

  const active = result.find(x => x.id === selected);
  
  let mapUrl = '';
  if (active && active.latitude !== undefined && active.longitude !== undefined) {
    // OpenStreetMap simple embed
    const offset = 0.005; // rough bounding box
    const bbox = `${active.longitude - offset},${active.latitude - offset},${active.longitude + offset},${active.latitude + offset}`;
    mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${active.latitude},${active.longitude}`;
  }

  return (
    <section className="page">
      <p className="eyebrow">{t('lab.eyebrow')}</p>
      <h1>{t('lab.title')}</h1>
      <p className="intro">{t('lab.intro')}</p>
      <form className="pin-form" onSubmit={find}>
        <Input 
          value={pin} 
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))} 
          placeholder={t('lab.placeholder')}
          maxLength={6} 
          disabled={loading}
        />
        <Button disabled={loading}>{t('lab.find')}</Button>
      </form>
      {error && <p className="validation">{error}</p>}
      {loading && <p className="validation loading">{t('lab.loading')}</p>}
      {!loading && hasSearched && result.length === 0 && !error && (
        <p className="validation empty">{t('lab.empty')}</p>
      )}
      {!loading && location && (
        <p className="location">{t('lab.resolved')}<b>{location}</b></p>
      )}
      {!loading && notice && <small className="notice">{notice}</small>}
      
      {!loading && result.length > 0 && (
        <div className="lab-layout">
          <div className="lab-list">
            {result.map(l => (
              <Card 
                key={l.id} 
                className={selected === l.id ? 'lab selected' : 'lab'} 
                onClick={() => setSelected(l.id)}
              >
                <div className="card-top">
                  <b>{l.name}</b>
                  {l.distanceKm !== undefined && <strong>{l.distanceKm} {t('lab.km')} away</strong>}
                </div>
                {l.oslCode && <p className="osl-code">OSL: {l.oslCode}</p>}
                {(l.city || l.state) && <p>{[l.city, l.state].filter(Boolean).join(', ')}</p>}
                {(l.pin || l.address) && <p>{[l.address, l.pin].filter(Boolean).join(' - ')}</p>}
                
                <div className="status-section" style={{ marginTop: '0.5rem' }}>
                  {l.recognitionStatus && <strong>{l.recognitionStatus}</strong>}
                  {l.recognitionValidUntil && <div style={{ fontSize: '0.85em', color: 'var(--text-light)' }}>Valid until: {l.recognitionValidUntil}</div>}
                  {(!l.recognitionStatus && l.status) && <p><small>{l.status}</small></p>}
                </div>
                
                {l.services && l.services.length > 0 ? (
                  <div className="tags" style={{ marginTop: '0.5rem' }}>
                    {l.services.map((s: string) => <span key={s}>{s}</span>)}
                  </div>
                ) : (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.85em', color: 'var(--text-light)', fontStyle: 'italic' }}>
                    Testing scope information is not yet available for this laboratory.
                  </p>
                )}
                {l.latitude !== undefined && l.longitude !== undefined && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
                    <a target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${l.latitude}&mlon=${l.longitude}#map=16/${l.latitude}/${l.longitude}`}>{t('lab.viewMap')}</a>
                    <a target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/directions?engine=osrm_car&route=${l.latitude},${l.longitude};${l.latitude},${l.longitude}`}>{t('lab.directions')}</a>
                  </div>
                )}
              </Card>
            ))}
          </div>
          <div className="map" style={{ padding: 0, overflow: 'hidden' }}>
            {mapUrl ? (
              <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no" 
                marginHeight={0} 
                marginWidth={0} 
                src={mapUrl}
                style={{ border: 'none', background: '#e5e7eb' }}
                title="Laboratory Location"
              />
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                <p>Location preview unavailable</p>
                <small>Coordinates missing for this laboratory.</small>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ReportsPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<Standard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sections, setSections] = useState({
    standardInformation: true,
    requirements: true,
    testing: true,
    laboratories: true,
    citations: true
  });

  useEffect(() => {
    standardsApi.list('', '', 1, 100).then(res => setItems(res.items));
  }, []);

  const toggleSelect = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected(next);
  };

  const handleGenerate = async () => {
    const token = localStorage.getItem('manak_auth_token');
    if (selected.size === 0 || !token) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const blob = await reportsApi.generate({
        title: title || 'MANAK Report',
        standardNumbers: Array.from(selected),
        sections
      }, token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MANAK-Report-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page" style={{ padding: '2rem' }}>
      <div className="reports-heading" style={{ marginBottom: '2rem' }}>
        <p className="eyebrow">{t('feature.workspace')}</p>
        <h1>Reports</h1>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>Create and download structured reports from your selected BIS standards and supporting information.</p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 400px' }}>
          <Card style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>SECTION 1: CREATE REPORT</h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Report title:</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter report title..." />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Select standards:</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {Array.from(selected).map(code => (
                  <span key={code} style={{ background: 'var(--surface-sunken)', padding: '0.25rem 0.75rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    {code} <button onClick={() => toggleSelect(code)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}>×</button>
                  </span>
                ))}
              </div>
              <select 
                onChange={(e) => { if(e.target.value) toggleSelect(e.target.value); e.target.value = ''; }}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}
                defaultValue=""
              >
                <option value="" disabled>Select BIS standards...</option>
                {items.filter(i => !selected.has(i.code)).map(i => (
                  <option key={i.id} value={i.code}>{i.code} - {i.title}</option>
                ))}
              </select>
            </div>
          </Card>
        </div>

        <div style={{ flex: '1 1 400px' }}>
          <Card style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>SECTION 2: REPORT CONTENT</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(sections).map(([k, v]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={v} 
                    onChange={e => setSections(prev => ({ ...prev, [k]: e.target.checked }))}
                    style={{ width: '1.2rem', height: '1.2rem' }}
                  />
                  {k === 'standardInformation' && 'Standard information'}
                  {k === 'requirements' && 'Requirements / relevant clauses'}
                  {k === 'testing' && 'Testing information'}
                  {k === 'laboratories' && 'Laboratory information'}
                  {k === 'citations' && 'Source citations'}
                </label>
              ))}
            </div>
          </Card>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Button disabled={selected.size === 0 || loading} onClick={handleGenerate} style={{ width: '100%' }}>
              {loading ? 'Generating Report...' : 'Generate Report'}
            </Button>
            {errorMsg && <p style={{ color: 'red', fontSize: '0.9rem' }}>{errorMsg}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfilePage() {
  const { user, updateUser } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const isOrg = user.account_type === 'organization';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please select a JPG, PNG, or WEBP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!preview) return;
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('manak_auth_token');
      if (!token) throw new Error('Not authenticated');
      
      const updatedUser = await authApi.updateAvatar(token, preview);
      updateUser(updatedUser);
      setSuccess('Profile photo updated.');
      setPreview(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Unable to update profile photo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <section className="feature-page">
      <p className="eyebrow">PROFILE</p>
      <h1>Your account information</h1>

      <div className="profile-layout">
        <div className="profile-photo-container">
          <div className="profile-photo">
            {preview ? (
              <img src={preview} alt="New profile preview" />
            ) : user.avatar_url ? (
              <img src={user.avatar_url} alt="Profile" />
            ) : (
              <div className="profile-initials">{user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}</div>
            )}
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="image/jpeg,image/png,image/webp" 
            style={{ display: 'none' }}
            id="avatar-upload"
            aria-label="Upload profile photo"
          />
          
          <div className="profile-upload-actions">
            {!preview && (
              <Button onClick={() => fileInputRef.current?.click()} className="secondary" disabled={loading}>
                Change photo
              </Button>
            )}
            
            {preview && (
              <div className="preview-actions">
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? 'Uploading...' : 'Save photo'}
                </Button>
                <Button onClick={handleCancel} className="secondary" disabled={loading} style={{ marginLeft: '12px' }}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
          
          {error && <p className="error-text" style={{ marginTop: '1rem', color: 'var(--red, red)' }}>{error}</p>}
          {success && <p className="success-text" style={{ marginTop: '1rem', color: 'var(--green, green)' }}>{success}</p>}
        </div>

        <div className="feature-grid" style={{ marginTop: '2rem' }}>
          <Card>
            <h3>Account Type</h3>
            <p style={{ marginTop: '0.5rem', fontWeight: 500, color: 'var(--primary)' }}>
              {isOrg ? 'Organization' : 'Individual'}
            </p>
          </Card>

          {isOrg ? (
            <>
              <Card>
                <h3>Organization Name</h3>
                <p style={{ marginTop: '0.5rem' }}>{user.organizationName || user.name || 'Not provided'}</p>
              </Card>
              <Card>
                <h3>Product / Manufacturing Type</h3>
                <p style={{ marginTop: '0.5rem' }}>{user.product_type || 'Not provided'}</p>
              </Card>
            </>
          ) : (
            <Card>
              <h3>Full Name</h3>
              <p style={{ marginTop: '0.5rem' }}>{user.name || 'Not provided'}</p>
            </Card>
          )}

          <Card>
            <h3>Email</h3>
            <p style={{ marginTop: '0.5rem' }}>{user.email || 'Not provided'}</p>
          </Card>
        </div>
      </div>
    </section>
  );
}
function Simple({title,text}:{title:string;text:string}){return <section className="simple page"><p className="eyebrow">About MANAK</p><h1>{title}</h1><p className="intro">{text}</p></section>}
