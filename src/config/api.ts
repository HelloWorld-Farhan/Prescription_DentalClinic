/**
 * Central API & Cloud Infrastructure Configuration
 * 
 * Provides guaranteed production fallbacks for Render FastAPI backend
 * and Cloudflare R2 storage so that deployments (e.g. Cloudflare Pages)
 * work across all devices (Desktop, Mobile, Tablet) without relying on local env injection.
 */

export const API_BASE_URL: string = (
  (import.meta as any).env?.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://dentalclinic-backend-eiav.onrender.com')
).replace(/\/$/, '') || 'https://dentalclinic-backend-eiav.onrender.com';

export const R2_PUBLIC_URL: string = (
  (import.meta as any).env?.VITE_R2_PUBLIC_URL ||
  'https://pub-e6b50314f766405596ea974a88ed73cd.r2.dev'
).replace(/\/$/, '') || 'https://pub-e6b50314f766405596ea974a88ed73cd.r2.dev';

export const GOOGLE_APPS_SCRIPT_URL: string = (
  (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbyOEBu486Gs2wZmDYio9NMHK5imKsJ6W6QSGRUT11Kxog6kQfgaY-7baMAfklabcHJCXg/exec'
);
