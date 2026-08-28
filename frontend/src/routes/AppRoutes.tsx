import { useEffect, useState } from 'react';
import { App } from '../App';
export function AppRoutes() { const [path,setPath]=useState(window.location.pathname); useEffect(()=>{const sync=()=>setPath(window.location.pathname); window.addEventListener('popstate',sync); return()=>window.removeEventListener('popstate',sync);},[]); const go=(to:string)=>{window.history.pushState({},'',to);setPath(to);window.scrollTo({top:0,behavior:'smooth'});}; return <App path={path} go={go}/>; }
