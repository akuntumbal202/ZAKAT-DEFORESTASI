/**
 * Resolves public/ static asset paths safely across both local dev (`/`),
 * root domains (Vercel/Netlify), and GitHub Pages subpaths (`/<repo-name>/`).
 */
export function assetUrl(path: string): string {
  if (!path || /^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = path.replace(/^\/+/, '');
  return `${cleanBase}${cleanPath}`;
}
