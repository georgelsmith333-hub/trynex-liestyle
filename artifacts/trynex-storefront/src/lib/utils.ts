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
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Local dev only uses same-origin (Vite proxy → API on localhost).
    // Every other host — including Cloudflare Pages preview deploys —
    // hits the production Render API directly. We deliberately do NOT
    // special-case any Replit host here; production must be provably
    // independent of Replit infrastructure.
    if (host === 'localhost' || host === '127.0.0.1') {
      return '';
    }
  }
  return PRODUCTION_API_BASE_URL;
}

export function getApiUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}
