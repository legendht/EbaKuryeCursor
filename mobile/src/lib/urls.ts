const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:3000';

export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const base = APP_URL.replace(/\/$/, '');
  if (url.startsWith('/')) return `${base}${url}`;
  return `${base}/${url}`;
}

export function getAppUrl(): string {
  return APP_URL;
}
