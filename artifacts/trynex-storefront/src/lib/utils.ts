import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price).replace('BDT', '৳');
}

export function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('trynex_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Production fallback: when VITE_API_BASE_URL is not configured at build
// time (e.g. Cloudflare Pages env var missing), default to the live Render
// API so the storefront always knows where to reach the backend. In local
// dev we still fall back to a same-origin relative URL.
export const PRODUCTION_API_BASE_URL = "https://trynex-api.onrender.com";

export function getApiBaseUrl(): string {
  // In Vite dev mode the dev server proxy rewrites /api/* → localhost:8080
  // no matter what domain the page is served from (localhost *or* the
  // Replit preview URL). Always use same-origin so the proxy handles it.
  if (import.meta.env.DEV) return '';

  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  return PRODUCTION_API_BASE_URL;
}

export function getApiUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}
