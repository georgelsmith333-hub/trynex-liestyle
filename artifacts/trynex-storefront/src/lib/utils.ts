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
  const token = localStorage.getItem('trynex_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getApiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? '';
  return `${base}${path}`;
}
