import type { ReactNode, SVGProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * MANAK icon set.
 *
 * Hand-drawn rather than imported: the brief forbids installing libraries that
 * are not needed, and an icon pack would be ~40 kB for the two dozen glyphs this
 * product actually uses. More importantly, a single registry guarantees one line
 * language — same 24 grid, same 1.6 stroke, same round joins — which is what
 * stops a UI from looking like an assembled template.
 *
 * The registry stores JSX rather than bare `d` strings so an icon can use
 * circles and multiple sub-paths where that draws better.
 *
 * Icons are decorative by default (`aria-hidden`). Pass a `title` only when the
 * icon is the sole content of a control and nothing else labels it.
 */

export type IconName =
  | 'ai'
  | 'arrowRight'
  | 'bookmark'
  | 'building'
  | 'certificate'
  | 'chart'
  | 'check'
  | 'chevronDown'
  | 'chevronRight'
  | 'clock'
  | 'close'
  | 'database'
  | 'document'
  | 'download'
  | 'external'
  | 'filter'
  | 'flask'
  | 'grid'
  | 'handbook'
  | 'hallmark'
  | 'home'
  | 'info'
  | 'layers'
  | 'lightbulb'
  | 'logout'
  | 'menu'
  | 'plus'
  | 'search'
  | 'settings'
  | 'trending'
  | 'upload'
  | 'user'
  | 'users';

const PATHS: Record<IconName, ReactNode> = {
  ai: (
    <>
      <path d="M12 3.2l1.7 4.6 4.6 1.7-4.6 1.7L12 15.8l-1.7-4.6L5.7 9.5l4.6-1.7z" />
      <path d="M18.4 15.1l.75 2.05 2.05.75-2.05.75-.75 2.05-.75-2.05-2.05-.75 2.05-.75z" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4.5 12h15" />
      <path d="M13.5 6l6 6-6 6" />
    </>
  ),
  bookmark: <path d="M6.5 3.8h11v17.1l-5.5-4.1-5.5 4.1z" />,
  building: (
    <>
      <path d="M5 20.8V5.4a1.6 1.6 0 0 1 1.6-1.6h7.8A1.6 1.6 0 0 1 16 5.4v15.4" />
      <path d="M16 10.2h2.4a1.6 1.6 0 0 1 1.6 1.6v9" />
      <path d="M3.4 20.8h17.2" />
      <path d="M8.2 7.6h4.6M8.2 11.4h4.6M8.2 15.2h4.6" />
    </>
  ),
  certificate: (
    <>
      <path d="M12 3.2l7.4 2.5v5.5c0 4.4-3 8.1-7.4 9.2-4.4-1.1-7.4-4.8-7.4-9.2V5.7z" />
      <path d="M8.9 11.9l2.3 2.3 4-4.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20.4h16" />
      <path d="M7.6 20.4v-5.8M12 20.4V6.2M16.4 20.4V11" />
    </>
  ),
  check: <path d="M5 12.8l4.4 4.4L19 7.6" />,
  chevronDown: <path d="M6.5 9.8l5.5 5.4 5.5-5.4" />,
  chevronRight: <path d="M9.8 6.5l5.4 5.5-5.4 5.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 7.3V12l3.4 2" />
    </>
  ),
  close: <path d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8" />,
  database: (
    <>
      <path d="M12 3.4c4.1 0 7.4 1.2 7.4 2.7S16.1 8.8 12 8.8 4.6 7.6 4.6 6.1 7.9 3.4 12 3.4z" />
      <path d="M19.4 6.1v11.8c0 1.5-3.3 2.7-7.4 2.7s-7.4-1.2-7.4-2.7V6.1" />
      <path d="M4.6 12c0 1.5 3.3 2.7 7.4 2.7s7.4-1.2 7.4-2.7" />
    </>
  ),
  document: (
    <>
      <path d="M14.2 3.2H7.4a2 2 0 0 0-2 2v13.6a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V7.6z" />
      <path d="M14.2 3.2v4.4h4.4" />
      <path d="M8.6 13h6.8M8.6 16.4h4.4" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.8v10.6" />
      <path d="M7.8 10.4L12 14.6l4.2-4.2" />
      <path d="M4.6 18.4v.6a1.8 1.8 0 0 0 1.8 1.8h11.2a1.8 1.8 0 0 0 1.8-1.8v-.6" />
    </>
  ),
  external: (
    <>
      <path d="M13.6 4.2h6.2v6.2" />
      <path d="M19.8 4.2L11.4 12.6" />
      <path d="M17 13.8v4.6a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.4V9a1.8 1.8 0 0 1 1.8-1.8h4.6" />
    </>
  ),
  filter: <path d="M3.6 5.4h16.8l-6.6 7.6v6.4l-3.6-2.2v-4.2z" />,
  flask: (
    <>
      <path d="M9.4 3.4h5.2" />
      <path d="M10.4 3.4v5.3L5.5 17.2a2.6 2.6 0 0 0 2.3 3.9h8.4a2.6 2.6 0 0 0 2.3-3.9L13.6 8.7V3.4" />
      <path d="M7.4 14.6h9.2" />
    </>
  ),
  grid: (
    <>
      <path d="M4.4 4.4h6v6h-6zM13.6 4.4h6v6h-6zM4.4 13.6h6v6h-6zM13.6 13.6h6v6h-6z" />
    </>
  ),
  handbook: (
    <>
      <path d="M12 6.6C10.5 5.2 8.4 4.4 4.6 4.4v13.4c3.8 0 5.9.8 7.4 2.2 1.5-1.4 3.6-2.2 7.4-2.2V4.4c-3.8 0-5.9.8-7.4 2.2z" />
      <path d="M12 6.6V20" />
    </>
  ),
  hallmark: (
    <>
      <circle cx="12" cy="9.8" r="5.6" />
      <path d="M9.6 14.6L8.2 21l3.8-2 3.8 2-1.4-6.4" />
      <path d="M10.2 9.6l1.4 1.4 2.4-2.6" />
    </>
  ),
  home: (
    <>
      <path d="M3.4 10.6L12 3.4l8.6 7.2" />
      <path d="M5.8 9.4v11.2h12.4V9.4" />
      <path d="M9.8 20.6v-5.8h4.4v5.8" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 11v5.4" />
      <path d="M12 7.8h.01" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3.4l8.2 4.3-8.2 4.3-8.2-4.3z" />
      <path d="M3.8 12.2l8.2 4.3 8.2-4.3" />
      <path d="M3.8 16.4l8.2 4.3 8.2-4.3" />
    </>
  ),
  lightbulb: (
    <>
      <path d="M12 3.4a6 6 0 0 0-3.6 10.8v2.4h7.2v-2.4A6 6 0 0 0 12 3.4z" />
      <path d="M9.8 20.4h4.4" />
    </>
  ),
  logout: (
    <>
      <path d="M9.8 20.4H6a1.8 1.8 0 0 1-1.8-1.8V5.4A1.8 1.8 0 0 1 6 3.6h3.8" />
      <path d="M15.4 8.2L19.6 12l-4.2 3.8" />
      <path d="M19.6 12H9.4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  plus: <path d="M12 5.2v13.6M5.2 12h13.6" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.6" />
      <path d="M15.6 15.6l4.2 4.2" />
    </>
  ),
  settings: (
    <>
      <path d="M4.4 7.4h15.2M4.4 16.6h15.2" />
      <circle cx="9.4" cy="7.4" r="2.2" />
      <circle cx="15" cy="16.6" r="2.2" />
    </>
  ),
  trending: (
    <>
      <path d="M3.8 17.4l5.2-5.4 3.4 3.2 6.4-7" />
      <path d="M14.4 8.2h5.2v5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 14.6V4" />
      <path d="M7.8 8.2L12 4l4.2 4.2" />
      <path d="M4.6 18.4v.6a1.8 1.8 0 0 0 1.8 1.8h11.2a1.8 1.8 0 0 0 1.8-1.8v-.6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.2" r="3.9" />
      <path d="M4.9 20.4c0-3.6 3.2-5.8 7.1-5.8s7.1 2.2 7.1 5.8" />
    </>
  ),
  users: (
    <>
      <circle cx="9.6" cy="8.2" r="3.6" />
      <path d="M3.2 20.4c0-3.4 2.9-5.5 6.4-5.5s6.4 2.1 6.4 5.5" />
      <path d="M16.4 5.1a3.6 3.6 0 0 1 0 6.6" />
      <path d="M18.2 15.4c1.6.9 2.6 2.5 2.6 5" />
    </>
  ),
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'children'> {
  name: IconName;
  /** Pixel size for both dimensions. The grid is square. */
  size?: number;
  /** Accessible name. Omit for decorative icons (the default). */
  title?: string;
}

export function Icon({ name, size = 20, title, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      // A titled icon is a real image; an untitled one must be invisible to
      // assistive tech so it does not read out as a stray graphic.
      {...(title ? { role: 'img' } : { 'aria-hidden': true, focusable: false })}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
