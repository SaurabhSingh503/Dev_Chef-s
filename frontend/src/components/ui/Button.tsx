import type { ButtonHTMLAttributes, ReactNode } from 'react';
export function Button({children,variant='primary',className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'quiet';children:ReactNode}) { return <button className={`button ${variant} ${className}`} {...props}>{children}</button>; }
