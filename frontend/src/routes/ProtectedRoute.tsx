import type { ReactNode } from 'react';
import { useApp } from '../context/AppContext';
export function ProtectedRoute({children,fallback}:{children:ReactNode;fallback:ReactNode}) {return useApp().user?children:fallback;}
