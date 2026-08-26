/**
 * MANAK — small, dependency-free helpers.
 *
 * `cn` is implemented locally rather than pulling in clsx + tailwind-merge:
 * the project only needs conditional joining, and every added dependency is a
 * dependency the whole team has to install.
 */

export type ClassValue = string | number | null | false | undefined | ClassValue[];

/** Joins conditional class names, flattening arrays and dropping falsy values. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];

  const walk = (value: ClassValue): void => {
    if (!value && value !== 0) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    out.push(String(value));
  };

  values.forEach(walk);
  return out.join(' ');
}

/* --------------------------------- formatting -------------------------------- */

const IN_LOCALE = 'en-IN';

/** e.g. "14 Mar 2024". Returns an em dash for missing dates so tables align. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(IN_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Relative time for activity feeds: "3 hours ago". */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];

  const formatter = new Intl.RelativeTimeFormat(IN_LOCALE, { numeric: 'auto' });
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return formatter.format(Math.round(seconds / secondsInUnit), unit);
    }
  }
  return formatter.format(seconds, 'second');
}

/** Indian digit grouping (1,23,456). */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(IN_LOCALE).format(value);
}

/** "IS 1234 : 2021" → normalised "IS 1234:2021" for consistent display. */
export function formatStandardNumber(raw: string): string {
  return raw.replace(/\s*:\s*/g, ':').replace(/\s+/g, ' ').trim();
}

/** Percent for confidence and trend deltas. */
export function formatPercent(value: number, fractionDigits = 0): string {
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Turns an enum-ish key into a readable label: `food_processing` → "Food processing". */
export function humanise(key: string): string {
  const spaced = key.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** Initials for avatars. */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

/* ---------------------------------- timing ---------------------------------- */

/** Trailing-edge debounce, used by search inputs. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs = 300,
): ((...args: A) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: A): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };

  debounced.cancel = (): void => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  return debounced;
}

/** Clamps a number into a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Page numbers for a pagination control, with gaps collapsed to `'…'`.
 * The reference shows `1 2 3 . . . 99`, i.e. edges plus a window around
 * the current page.
 */
export function paginationRange(
  current: number,
  total: number,
  window = 1,
): (number | '…')[] {
  if (total <= 1) return [1];

  const pages = new Set<number>([1, total]);
  for (let p = current - window; p <= current + window; p += 1) {
    if (p >= 1 && p <= total) pages.add(p);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | '…')[] = [];

  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1]! > 1) out.push('…');
    out.push(page);
  });

  return out;
}
