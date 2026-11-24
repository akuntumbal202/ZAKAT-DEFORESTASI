import { createContext, useCallback, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

/**
 * Lightweight hash router supporting Public, Donor Dashboard, and Admin Curation routes.
 * Uses encodeURIComponent/decodeURIComponent safely for polygon codes and IDs.
 */

export type RouteName =
  | 'home'
  | 'explore'
  | 'programs'
  | 'program'
  | 'calculator'
  | 'transparency'
  | 'about'
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'dashboard'
  | 'dashboard-history'
  | 'dashboard-impact'
  | 'dashboard-saved'
  | 'dashboard-profile'
  | 'admin'
  | 'admin-map'
  | 'donation-success'
  | 'not-found';

export interface Route {
  name: RouteName;
  param?: string;
  section?: string;
  path: string;
}

const STATIC: RouteName[] = [
  'explore',
  'programs',
  'calculator',
  'transparency',
  'about',
  'login',
  'register',
  'forgot-password',
  'dashboard',
  'dashboard-history',
  'dashboard-impact',
  'dashboard-saved',
  'dashboard-profile',
  'admin',
  'admin-map',
];

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '').trim();
  const [pathPart, sectionPart] = raw.split('::');
  const path = decodeURIComponent(pathPart ?? '').trim();

  if (!path || path === 'home') return { name: 'home', path: '' };
  if ((STATIC as string[]).includes(path)) {
    return { name: path as RouteName, section: sectionPart, path };
  }
  if (path.startsWith('program-')) return { name: 'program', param: path.slice(8), path };
  if (path.startsWith('explore-')) return { name: 'explore', param: path.slice(8), path };
  if (path.startsWith('admin-map-')) return { name: 'admin-map', param: path.slice(10), path };
  if (path.startsWith('donation-success-')) return { name: 'donation-success', param: path.slice(17), path };
  return { name: 'not-found', path };
}

/** Typed path builders. */
export const to = {
  home: () => '',
  explore: (code?: string) => (code ? `explore-${encodeURIComponent(code)}` : 'explore'),
  programs: () => 'programs',
  program: (id: string) => `program-${encodeURIComponent(id)}`,
  calculator: () => 'calculator',
  transparency: () => 'transparency',
  about: (section?: 'ziswaf' | 'metodologi') => (section ? `about::${section}` : 'about'),
  login: () => 'login',
  register: () => 'register',
  forgot: () => 'forgot-password',
  dashboard: (section?: 'history' | 'impact' | 'saved' | 'profile') => (section ? `dashboard-${section}` : 'dashboard'),
  admin: () => 'admin',
  adminMap: (code?: string) => (code ? `admin-map-${encodeURIComponent(code)}` : 'admin-map'),
  donationSuccess: (id: string) => `donation-success-${encodeURIComponent(id)}`,
};

interface RouterCtx {
  route: Route;
  navigate: (path: string, opts?: { replace?: boolean; keepScroll?: boolean }) => void;
}

const Ctx = createContext<RouterCtx | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!route.section) return;
    const t = window.setTimeout(() => {
      document.getElementById(route.section!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [route.path, route.section]);

  const navigate = useCallback<RouterCtx['navigate']>((path, opts) => {
    const target = `#${path}`;
    if (opts?.replace) {
      try {
        window.history.replaceState(null, '', target || '#');
      } catch {
        /* sandbox */
      }
      setRoute(parseHash(target));
    } else if (window.location.hash === target || (!path && !window.location.hash)) {
      setRoute(parseHash(target));
    } else {
      window.location.hash = path;
    }
    if (!opts?.keepScroll && !path.includes('::')) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, []);

  const value = useMemo(() => ({ route, navigate }), [route, navigate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRouter() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useRouter must be inside RouterProvider');
  return c;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; keepScroll?: boolean };

export function Link({ to: path, keepScroll, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(path, { keepScroll });
  };
  return (
    <a href={`#${path}`} onClick={handle} {...rest}>
      {children}
    </a>
  );
}
