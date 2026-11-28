import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import type {
  AuthIntent,
  Donation,
  ProjectView,
  PublicationStatus,
  RestorationProject,
  SpeciesCatalogItem,
  User,
} from '../types';
import { buildAllProjectViews, getSeedProjects } from '../services/projectService';
import { SPECIES_CATALOG } from '../data/speciesCatalog';
import { loadState, saveState, clearState } from '../services/storage';
import type { StoredAccount } from '../services/authService';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  deleteSpeciesBatchRemote,
  deleteSpeciesRemote,
  fetchBackendSnapshot,
  fetchCurrentSupabaseUser,
  insertDonationRemote,
  signOutSupabase,
  toggleNominationRemote,
  toggleSavedRemote,
  updateProfileRemote,
  upsertProgramRemote,
  upsertSpeciesBatchRemote,
  upsertSpeciesRemote,
} from '../services/backendService';
import {
  DEMO_ADMIN,
  DEMO_DONATIONS,
  DEMO_SAVED,
  DEMO_USER,
  INITIAL_NOMINATIONS,
} from '../data/mock/users';

/**
 * Unified Store supporting:
 * 1. Live Supabase PostgreSQL + Auth + RLS (when VITE_SUPABASE_URL/KEY are set).
 * 2. Sandbox Demo Mode for 1-click Demo Donor & Demo Admin:
 *    - Loads live DB snapshot as starting data.
 *    - Keeps ALL mutations strictly in local session memory (ZERO DB writes).
 *    - Automatically resets back to real DB state on logout.
 * 3. Seamless localStorage fallback when Supabase env vars are not configured yet.
 */

interface PersistedState {
  user: User | null;
  accounts: StoredAccount[];
  donations: Donation[];
  saved: Record<string, string[]>;
  intent: AuthIntent | null;
  demoSeeded: boolean;
  customProjects: Record<string, RestorationProject>;
  speciesList: SpeciesCatalogItem[];
  nominations: Record<string, number>;
  userNominated: string[];
}

interface UIState {
  donateFor: { projectId: string; amount?: number } | null;
  toast: { id: number; text: string; tone: 'ok' | 'info' | 'warn' } | null;
  backendConnected: boolean;
  remoteAuthoritative: boolean;
  speciesTableReady: boolean;
  syncing: boolean;
}

type State = PersistedState & UIState;

type Action =
  | { type: 'login'; user: User }
  | { type: 'enterDemo'; user: User }
  | { type: 'register'; user: User }
  | { type: 'logout'; restore?: Partial<PersistedState> }
  | { type: 'updateProfile'; patch: Partial<User> }
  | { type: 'addDonation'; donation: Donation }
  | { type: 'toggleSave'; projectId: string }
  | { type: 'ensureSaved'; projectId: string }
  | { type: 'setIntent'; intent: AuthIntent | null }
  | { type: 'openDonate'; projectId: string; amount?: number }
  | { type: 'closeDonate' }
  | { type: 'toast'; text: string; tone?: 'ok' | 'info' | 'warn' }
  | { type: 'clearToast' }
  | { type: 'toggleNominate'; lkCode: string }
  | { type: 'upsertProject'; project: RestorationProject }
  | { type: 'upsertSpecies'; species: SpeciesCatalogItem }
  | { type: 'upsertSpeciesBatch'; items: SpeciesCatalogItem[] }
  | { type: 'deleteSpecies'; id: string }
  | { type: 'deleteSpeciesBatch'; ids: string[] }
  | { type: 'importPayload'; customProjects: Record<string, RestorationProject>; nominations?: Record<string, number> }
  | {
      type: 'hydrateRemote';
      user?: User | null;
      keepCurrentUser?: boolean;
      programs: Record<string, RestorationProject>;
      donations: Donation[];
      nominations: Record<string, number>;
      userNominated: string[];
      savedProjectIds: string[];
      speciesList?: SpeciesCatalogItem[];
      speciesTableReady: boolean;
      remoteAuthoritative: boolean;
    }
  | { type: 'setSyncing'; syncing: boolean }
  | { type: 'resetDemo' };

const initialPersisted: PersistedState = {
  user: null,
  accounts: [],
  donations: [],
  saved: {},
  intent: null,
  demoSeeded: false,
  customProjects: {},
  speciesList: SPECIES_CATALOG,
  nominations: INITIAL_NOMINATIONS,
  userNominated: [],
};

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case 'login':
      return { ...state, user: a.user };

    case 'enterDemo': {
      // Sandbox Demo Mode: keep current programs/nominations as baseline, add sample donor rows in memory only
      let next: State = { ...state, user: a.user };
      if (a.user.role === 'donor') {
        const existingIds = new Set(state.donations.map((d) => d.id));
        const extraDemo = DEMO_DONATIONS.filter((d) => !existingIds.has(d.id));
        next = {
          ...next,
          demoSeeded: true,
          donations: [...extraDemo, ...state.donations],
          saved: { ...state.saved, [a.user.id]: state.saved[a.user.id] ?? DEMO_SAVED },
        };
      } else if (a.user.role === 'admin' && state.remoteAuthoritative) {
        // Ensure Demo Admin can also try a draft sample in sandbox even if logged out beforehand
        const hasDraft = Object.values(state.customProjects).some((p) => p.publication_status === 'draft');
        if (!hasDraft) {
          const seedDraft = getSeedProjects().find((p) => p.publication_status === 'draft');
          if (seedDraft && !state.customProjects[seedDraft.id]) {
            next = {
              ...next,
              customProjects: { ...state.customProjects, [seedDraft.id]: seedDraft },
            };
          }
        }
      }
      return next;
    }

    case 'register':
      return { ...state, user: a.user, accounts: [...state.accounts, { user: a.user }] };

    case 'logout':
      return {
        ...state,
        ...(a.restore ?? {}),
        user: null,
        intent: null,
        donateFor: null,
        demoSeeded: false,
      };

    case 'updateProfile': {
      if (!state.user) return state;
      const user = { ...state.user, ...a.patch };
      return {
        ...state,
        user,
        accounts: state.accounts.map((acc) => (acc.user.id === user.id ? { user } : acc)),
      };
    }

    case 'addDonation':
      return { ...state, donations: [a.donation, ...state.donations] };

    case 'toggleSave': {
      if (!state.user) return state;
      const list = state.saved[state.user.id] ?? [];
      const next = list.includes(a.projectId)
        ? list.filter((x) => x !== a.projectId)
        : [a.projectId, ...list];
      return { ...state, saved: { ...state.saved, [state.user.id]: next } };
    }

    case 'ensureSaved': {
      if (!state.user) return state;
      const list = state.saved[state.user.id] ?? [];
      if (list.includes(a.projectId)) return state;
      return { ...state, saved: { ...state.saved, [state.user.id]: [a.projectId, ...list] } };
    }

    case 'setIntent':
      return { ...state, intent: a.intent };
    case 'openDonate':
      return { ...state, donateFor: { projectId: a.projectId, amount: a.amount } };
    case 'closeDonate':
      return { ...state, donateFor: null };
    case 'toast':
      return { ...state, toast: { id: Date.now(), text: a.text, tone: a.tone ?? 'ok' } };
    case 'clearToast':
      return { ...state, toast: null };

    case 'toggleNominate': {
      const already = state.userNominated.includes(a.lkCode);
      const curr = state.nominations[a.lkCode] ?? 0;
      const nextCount = already ? Math.max(0, curr - 1) : curr + 1;
      return {
        ...state,
        nominations: { ...state.nominations, [a.lkCode]: nextCount },
        userNominated: already
          ? state.userNominated.filter((x) => x !== a.lkCode)
          : [a.lkCode, ...state.userNominated],
      };
    }

    case 'upsertProject':
      return {
        ...state,
        customProjects: {
          ...state.customProjects,
          [a.project.id]: { ...a.project, updated_at: new Date().toISOString().slice(0, 10) },
        },
      };

    case 'upsertSpecies': {
      const next = [...state.speciesList.filter((s) => s.id !== a.species.id), a.species].sort((x, y) =>
        x.local_name.localeCompare(y.local_name),
      );
      return { ...state, speciesList: next };
    }

    case 'upsertSpeciesBatch': {
      const map = new Map<string, SpeciesCatalogItem>(state.speciesList.map((s) => [s.id, s]));
      a.items.forEach((it) => map.set(it.id, it));
      return {
        ...state,
        speciesList: [...map.values()].sort((x, y) => x.local_name.localeCompare(y.local_name)),
      };
    }

    case 'deleteSpecies':
      return {
        ...state,
        speciesList: state.speciesList.filter((s) => s.id !== a.id),
      };

    case 'deleteSpeciesBatch': {
      const drop = new Set(a.ids);
      return {
        ...state,
        speciesList: state.speciesList.filter((s) => !drop.has(s.id)),
      };
    }

    case 'importPayload':
      return {
        ...state,
        customProjects: a.customProjects,
        nominations: a.nominations ? { ...INITIAL_NOMINATIONS, ...a.nominations } : state.nominations,
      };

    case 'hydrateRemote': {
      const nextUser = a.keepCurrentUser ? state.user : (a.user ?? null);
      const nextSaved = { ...state.saved };
      if (nextUser && !nextUser.is_demo) {
        nextSaved[nextUser.id] = a.savedProjectIds;
      }
      return {
        ...state,
        user: nextUser,
        customProjects: a.programs,
        speciesList: a.speciesList && a.speciesList.length > 0 ? a.speciesList : state.speciesList,
        donations: a.donations,
        nominations: a.nominations,
        userNominated: a.userNominated,
        saved: nextSaved,
        backendConnected: true,
        remoteAuthoritative: a.remoteAuthoritative,
        speciesTableReady: a.speciesTableReady,
        syncing: false,
      };
    }

    case 'setSyncing':
      return { ...state, syncing: a.syncing };

    case 'resetDemo':
      return {
        ...initialPersisted,
        donateFor: null,
        backendConnected: state.backendConnected,
        remoteAuthoritative: state.remoteAuthoritative,
        speciesTableReady: state.speciesTableReady,
        syncing: false,
        toast: { id: Date.now(), text: 'Data simulasi & kurasi direset ke seed awal Loa Kulu.', tone: 'info' },
      };
  }
}

interface Store {
  state: State;
  /** True when user is using 1-click Demo Donor / Demo Admin sandbox (isolated, zero DB writes). */
  isSandboxDemo: boolean;
  /** True when VITE_SUPABASE_URL & KEY are set and connected. */
  isBackendConfigured: boolean;
  /** True when `public.species` table exists and synced from Supabase. */
  speciesTableReady: boolean;
  /** Live species database (hydrated from Supabase `public.species`, fallback seed). */
  speciesCatalog: SpeciesCatalogItem[];
  speciesById: Record<string, SpeciesCatalogItem>;
  /** Published programs only (for Public views). */
  projects: ProjectView[];
  /** All programs including Drafts (for Admin views). */
  allProjects: ProjectView[];
  getProject: (id: string | undefined) => ProjectView | undefined;
  getProjectAnyStatus: (id: string | undefined) => ProjectView | undefined;
  myDonations: Donation[];
  savedIds: string[];
  isSaved: (id: string) => boolean;
  nominations: Record<string, number>;
  hasNominated: (lkCode: string) => boolean;
  enterDemo: (role: 'donor' | 'admin') => Promise<void>;
  loginRealUser: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  refreshFromBackend: () => Promise<void>;
  addDonation: (donation: Donation) => Promise<void>;
  toggleSaveProject: (projectId: string) => Promise<boolean>;
  ensureSavedProject: (projectId: string) => Promise<void>;
  updateUserProfile: (patch: Pick<User, 'name' | 'phone' | 'city'>) => Promise<boolean>;
  toggleNominate: (lkCode: string) => void;
  upsertProject: (project: RestorationProject) => void;
  upsertSpecies: (item: SpeciesCatalogItem) => Promise<{ ok: boolean; error?: string }>;
  upsertSpeciesBatch: (items: SpeciesCatalogItem[]) => Promise<{ ok: boolean; count: number; error?: string }>;
  deleteSpecies: (id: string) => Promise<{ ok: boolean; error?: string }>;
  purgeUnusedDummySpecies: () => Promise<{ ok: boolean; deleted: number; skippedInUse: string[]; error?: string }>;
  setPublicationStatus: (id: string, status: PublicationStatus) => void;
  exportConfigJson: () => string;
  importConfigJson: (raw: string) => { ok: boolean; error?: string };
  dispatch: Dispatch<Action>;
  toast: (text: string, tone?: 'ok' | 'info' | 'warn') => void;
  resetDemo: () => void;
}

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const base = isSupabaseConfigured ? initialPersisted : loadState(initialPersisted);
    // Never restore an expired Sandbox Demo user on hard reload
    const cleaned = base.user?.is_demo ? { ...base, user: null, demoSeeded: false } : base;
    // Ensure older localStorage payloads always have speciesList initialized
    const speciesList =
      Array.isArray(cleaned.speciesList) && cleaned.speciesList.length > 0 ? cleaned.speciesList : SPECIES_CATALOG;
    return {
      ...cleaned,
      speciesList,
      donateFor: null,
      toast: null,
      backendConnected: false,
      remoteAuthoritative: false,
      speciesTableReady: false,
      syncing: isSupabaseConfigured,
    };
  });

  const isSandboxDemo = Boolean(state.user?.is_demo);

  // Keeps pre-demo snapshot so Sandbox Demo resets cleanly on logout even in offline/local mode
  const sandboxBaselineRef = useRef<Partial<PersistedState> | null>(null);

  const syncFromSupabase = useCallback(async (knownRealUser?: User | null) => {
    if (!isSupabaseConfigured) return;
    dispatch({ type: 'setSyncing', syncing: true });
    try {
      const realUser = knownRealUser !== undefined ? knownRealUser : await fetchCurrentSupabaseUser();
      const snap = await fetchBackendSnapshot(realUser);
      if (snap) {
        const hasRemotePrograms = Object.keys(snap.programs).length > 0;
        const programs = hasRemotePrograms
          ? snap.programs
          : Object.fromEntries(getSeedProjects().map((p) => [p.id, p]));
        const speciesList =
          snap.species && snap.species.length > 0 ? snap.species : SPECIES_CATALOG;
        dispatch({
          type: 'hydrateRemote',
          user: realUser,
          programs,
          speciesList,
          speciesTableReady: snap.speciesTableReady,
          donations: snap.donations,
          nominations: snap.nominations,
          userNominated: snap.userNominated,
          savedProjectIds: snap.savedProjectIds,
          remoteAuthoritative: hasRemotePrograms,
        });
      } else {
        dispatch({ type: 'setSyncing', syncing: false });
      }
    } catch {
      dispatch({ type: 'setSyncing', syncing: false });
    }
  }, []);

  // Initial Supabase hydration on mount
  useEffect(() => {
    if (isSupabaseConfigured) {
      void syncFromSupabase();
    }
  }, [syncFromSupabase]);

  // Persist to localStorage ONLY in offline/local mode AND never during Sandbox Demo
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (isSupabaseConfigured || state.user?.is_demo) return;
    const {
      user,
      accounts,
      donations,
      saved,
      intent,
      demoSeeded,
      customProjects,
      speciesList,
      nominations,
      userNominated,
    } = state;
    saveState({
      user,
      accounts,
      donations,
      saved,
      intent,
      demoSeeded,
      customProjects,
      speciesList,
      nominations,
      userNominated,
    });
  }, [state]);

  const speciesCatalog = state.speciesList;
  const speciesById = useMemo<Record<string, SpeciesCatalogItem>>(
    () => Object.fromEntries(speciesCatalog.map((s) => [s.id, s])),
    [speciesCatalog],
  );

  const allProjects = useMemo(
    () => buildAllProjectViews(state.donations, state.customProjects, state.remoteAuthoritative),
    [state.donations, state.customProjects, state.remoteAuthoritative],
  );
  const projects = useMemo(
    () => allProjects.filter((p) => p.publication_status === 'published'),
    [allProjects],
  );

  const getProject = useCallback((id: string | undefined) => projects.find((p) => p.id === id), [projects]);
  const getProjectAnyStatus = useCallback((id: string | undefined) => allProjects.find((p) => p.id === id), [allProjects]);

  const myDonations = useMemo(
    () => (state.user ? state.donations.filter((d) => d.user_id === state.user!.id) : []),
    [state.donations, state.user],
  );
  const savedIds = useMemo(
    () => (state.user ? state.saved[state.user.id] ?? [] : []),
    [state.saved, state.user],
  );
  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);
  const hasNominated = useCallback((lkCode: string) => state.userNominated.includes(lkCode), [state.userNominated]);

  const toast = useCallback(
    (text: string, tone: 'ok' | 'info' | 'warn' = 'ok') => dispatch({ type: 'toast', text, tone }),
    [],
  );

  const enterDemo = useCallback(
    async (role: 'donor' | 'admin') => {
      // Save clean pre-demo state so logout restores exact real database / pre-demo snapshot
      if (!state.user?.is_demo) {
        sandboxBaselineRef.current = {
          customProjects: { ...state.customProjects },
          speciesList: [...state.speciesList],
          donations: [...state.donations],
          nominations: { ...state.nominations },
          userNominated: [...state.userNominated],
          saved: { ...state.saved },
        };
      }
      if (isSupabaseConfigured && state.user && !state.user.is_demo) {
        await signOutSupabase();
      }
      dispatch({ type: 'enterDemo', user: role === 'admin' ? DEMO_ADMIN : DEMO_USER });
    },
    [state.customProjects, state.donations, state.nominations, state.saved, state.user, state.userNominated],
  );

  const loginRealUser = useCallback(
    async (user: User) => {
      sandboxBaselineRef.current = null;
      dispatch({ type: 'login', user });
      if (isSupabaseConfigured) {
        await syncFromSupabase(user);
      }
    },
    [syncFromSupabase],
  );

  const logout = useCallback(async () => {
    const wasDemo = Boolean(state.user?.is_demo);
    if (wasDemo) {
      const restore = sandboxBaselineRef.current ?? undefined;
      sandboxBaselineRef.current = null;
      dispatch({ type: 'logout', restore });
      if (isSupabaseConfigured) {
        await syncFromSupabase(null);
      }
      toast('Keluar dari Mode Sandbox Demo. Data dikembalikan sesuai database asli.', 'info');
      return;
    }

    if (isSupabaseConfigured) {
      await signOutSupabase();
      dispatch({ type: 'logout' });
      await syncFromSupabase(null);
    } else {
      dispatch({ type: 'logout' });
    }
    toast('Anda telah keluar.', 'info');
  }, [state.user?.is_demo, syncFromSupabase, toast]);

  const addDonation = useCallback(
    async (donation: Donation) => {
      dispatch({ type: 'addDonation', donation });
      if (isSupabaseConfigured && !isSandboxDemo) {
        const res = await insertDonationRemote(donation);
        if (!res.ok) {
          toast(`Gagal menyimpan donasi ke server: ${res.error}`, 'warn');
          await syncFromSupabase();
        }
      }
    },
    [isSandboxDemo, syncFromSupabase, toast],
  );

  const toggleSaveProject = useCallback(
    async (projectId: string) => {
      const was = savedIds.includes(projectId);
      dispatch({ type: 'toggleSave', projectId });
      if (isSupabaseConfigured && state.user && !isSandboxDemo) {
        const res = await toggleSavedRemote(state.user.id, projectId, !was);
        if (!res.ok) {
          dispatch({ type: 'toggleSave', projectId });
          toast(`Gagal sinkron bookmark: ${res.error}`, 'warn');
          return was;
        }
      }
      return !was;
    },
    [isSandboxDemo, savedIds, state.user, toast],
  );

  const ensureSavedProject = useCallback(
    async (projectId: string) => {
      dispatch({ type: 'ensureSaved', projectId });
      if (isSupabaseConfigured && state.user && !isSandboxDemo) {
        await toggleSavedRemote(state.user.id, projectId, true);
      }
    },
    [isSandboxDemo, state.user],
  );

  const updateUserProfile = useCallback(
    async (patch: Pick<User, 'name' | 'phone' | 'city'>) => {
      dispatch({ type: 'updateProfile', patch });
      if (isSupabaseConfigured && state.user && !isSandboxDemo) {
        const res = await updateProfileRemote(state.user.id, patch);
        if (!res.ok) {
          toast(`Gagal menyimpan profil ke server: ${res.error}`, 'warn');
          return false;
        }
      }
      return true;
    },
    [isSandboxDemo, state.user, toast],
  );

  const toggleNominate = useCallback(
    (lkCode: string) => {
      const was = state.userNominated.includes(lkCode);
      dispatch({ type: 'toggleNominate', lkCode });

      if (isSandboxDemo) {
        toast(
          was
            ? `Usulan ${lkCode} dibatalkan (Mode Sandbox Demo).`
            : `Usulan ${lkCode} dicatat sementara di Mode Sandbox Demo.`,
          was ? 'info' : 'ok',
        );
        return;
      }

      if (isSupabaseConfigured) {
        void toggleNominationRemote(lkCode, was).then((res) => {
          if (!res.ok) {
            dispatch({ type: 'toggleNominate', lkCode });
            toast(res.error || 'Gagal mencatat usulan ke server.', 'warn');
          } else {
            toast(
              was
                ? `Usulan untuk ${lkCode} dibatalkan.`
                : `Usulan ${lkCode} tersimpan ke database! Admin dapat melihat prioritas ini.`,
              was ? 'info' : 'ok',
            );
          }
        });
        return;
      }

      toast(
        was
          ? `Usulan untuk ${lkCode} dibatalkan.`
          : `Usulan ${lkCode} dicatat! Admin dapat melihat prioritas ini.`,
        was ? 'info' : 'ok',
      );
    },
    [isSandboxDemo, state.userNominated, toast],
  );

  const upsertProject = useCallback(
    (project: RestorationProject) => {
      dispatch({ type: 'upsertProject', project });
      if (isSandboxDemo) {
        return;
      }
      if (isSupabaseConfigured) {
        void upsertProgramRemote(project).then((res) => {
          if (!res.ok) {
            toast(`Gagal menyimpan ke database Supabase: ${res.error}`, 'warn');
            void syncFromSupabase();
          }
        });
      }
    },
    [isSandboxDemo, syncFromSupabase, toast],
  );

  const upsertSpecies = useCallback(
    async (item: SpeciesCatalogItem): Promise<{ ok: boolean; error?: string }> => {
      const normalized: SpeciesCatalogItem = {
        ...item,
        updated_at: new Date().toISOString(),
      };
      dispatch({ type: 'upsertSpecies', species: normalized });
      if (isSandboxDemo || !isSupabaseConfigured) {
        return { ok: true };
      }
      const res = await upsertSpeciesRemote(normalized);
      if (!res.ok) {
        toast(`Gagal menyimpan spesies ke Supabase: ${res.error}`, 'warn');
        void syncFromSupabase();
        return res;
      }
      return { ok: true };
    },
    [isSandboxDemo, syncFromSupabase, toast],
  );

  const upsertSpeciesBatch = useCallback(
    async (items: SpeciesCatalogItem[]): Promise<{ ok: boolean; count: number; error?: string }> => {
      if (items.length === 0) return { ok: false, count: 0, error: 'Tidak ada data spesies yang valid untuk diimpor.' };
      const now = new Date().toISOString();
      const normalized = items.map((it) => ({ ...it, updated_at: now }));
      dispatch({ type: 'upsertSpeciesBatch', items: normalized });
      if (isSandboxDemo || !isSupabaseConfigured) {
        return { ok: true, count: normalized.length };
      }
      const res = await upsertSpeciesBatchRemote(normalized);
      if (!res.ok) {
        toast(`Gagal mengimpor spesies ke Supabase: ${res.error}`, 'warn');
        void syncFromSupabase();
        return { ok: false, count: 0, error: res.error };
      }
      return { ok: true, count: normalized.length };
    },
    [isSandboxDemo, syncFromSupabase, toast],
  );

  const deleteSpecies = useCallback(
    async (id: string): Promise<{ ok: boolean; error?: string }> => {
      const usedIn = allProjects
        .filter((p) => p.recommended_species.some((r) => r.species_id === id))
        .map((p) => p.polygon_code || p.id);
      if (usedIn.length > 0) {
        return {
          ok: false,
          error: `Tidak dapat dihapus karena sedang dipakai di program: ${usedIn.join(', ')}. Ganti dulu spesies di program tersebut.`,
        };
      }
      dispatch({ type: 'deleteSpecies', id });
      if (isSandboxDemo || !isSupabaseConfigured) {
        return { ok: true };
      }
      const res = await deleteSpeciesRemote(id);
      if (!res.ok) {
        toast(`Gagal menghapus spesies di Supabase: ${res.error}`, 'warn');
        void syncFromSupabase();
        return res;
      }
      return { ok: true };
    },
    [allProjects, isSandboxDemo, syncFromSupabase, toast],
  );

  const purgeUnusedDummySpecies = useCallback(async (): Promise<{
    ok: boolean;
    deleted: number;
    skippedInUse: string[];
    error?: string;
  }> => {
    const usedIds = new Set<string>();
    allProjects.forEach((p) => p.recommended_species.forEach((r) => usedIds.add(r.species_id)));

    const dummies = speciesCatalog.filter((s) => s.verification_status === 'dummy');
    const removable = dummies.filter((s) => !usedIds.has(s.id));
    const skippedInUse = dummies.filter((s) => usedIds.has(s.id)).map((s) => s.local_name);

    if (removable.length === 0) {
      return { ok: true, deleted: 0, skippedInUse };
    }

    const ids = removable.map((s) => s.id);
    dispatch({ type: 'deleteSpeciesBatch', ids });

    if (isSandboxDemo || !isSupabaseConfigured) {
      return { ok: true, deleted: ids.length, skippedInUse };
    }
    const res = await deleteSpeciesBatchRemote(ids);
    if (!res.ok) {
      toast(`Gagal membersihkan spesies dummy di Supabase: ${res.error}`, 'warn');
      void syncFromSupabase();
      return { ok: false, deleted: 0, skippedInUse, error: res.error };
    }
    return { ok: true, deleted: ids.length, skippedInUse };
  }, [allProjects, isSandboxDemo, speciesCatalog, syncFromSupabase, toast]);

  const setPublicationStatus = useCallback(
    (id: string, status: PublicationStatus) => {
      const target = allProjects.find((p) => p.id === id);
      if (!target) return;
      const {
        funding_collected: _fc,
        funding_percentage: _fp,
        funding_remaining: _fr,
        donor_count: _dc,
        restoration_cost: _rc,
        total_seedlings: _ts,
        cost_per_seedling: _cps,
        site: _s,
        ...rawProject
      } = target;
      upsertProject({ ...rawProject, publication_status: status });
    },
    [allProjects, upsertProject],
  );

  const exportConfigJson = useCallback(() => {
    const mapToExport: Record<string, RestorationProject> = {};
    allProjects.forEach((p) => {
      const {
        funding_collected: _fc,
        funding_percentage: _fp,
        funding_remaining: _fr,
        donor_count: _dc,
        restoration_cost: _rc,
        total_seedlings: _ts,
        cost_per_seedling: _cps,
        site: _s,
        ...raw
      } = p;
      mapToExport[raw.id] = raw;
    });
    return JSON.stringify(
      {
        schema: 'rimbun-loakulu-curation-v1',
        exported_at: new Date().toISOString(),
        customProjects: mapToExport,
        nominations: state.nominations,
      },
      null,
      2,
    );
  }, [allProjects, state.nominations]);

  const importConfigJson = useCallback(
    (raw: string): { ok: boolean; error?: string } => {
      try {
        const parsed = JSON.parse(raw) as {
          schema?: string;
          customProjects?: Record<string, RestorationProject>;
          nominations?: Record<string, number>;
        };
        if (!parsed || typeof parsed !== 'object' || !parsed.customProjects || typeof parsed.customProjects !== 'object') {
          return { ok: false, error: 'Format JSON tidak valid: objek customProjects tidak ditemukan.' };
        }
        dispatch({
          type: 'importPayload',
          customProjects: parsed.customProjects,
          nominations: parsed.nominations,
        });
        if (isSupabaseConfigured && !isSandboxDemo && state.user?.role === 'admin') {
          void Promise.all(Object.values(parsed.customProjects).map((p) => upsertProgramRemote(p))).then(() => {
            void syncFromSupabase();
          });
        }
        toast(
          isSandboxDemo
            ? `Impor berhasil di Mode Sandbox Demo (${Object.keys(parsed.customProjects).length} program).`
            : `Impor berhasil (${Object.keys(parsed.customProjects).length} konfigurasi program).`,
        );
        return { ok: true };
      } catch {
        return { ok: false, error: 'File JSON rusak atau tidak dapat dibaca.' };
      }
    },
    [isSandboxDemo, state.user?.role, syncFromSupabase, toast],
  );

  const resetDemo = useCallback(() => {
    if (isSandboxDemo) {
      const restore = sandboxBaselineRef.current;
      if (restore) {
        dispatch({ type: 'logout', restore });
      }
      void enterDemo(state.user?.role === 'admin' ? 'admin' : 'donor');
      toast('Sesi Sandbox Demo direset kembali sesuai data asli.', 'info');
      return;
    }
    if (isSupabaseConfigured) {
      void syncFromSupabase();
      toast('Data disinkronkan ulang dari server Supabase.', 'info');
      return;
    }
    clearState();
    dispatch({ type: 'resetDemo' });
  }, [enterDemo, isSandboxDemo, state.user?.role, syncFromSupabase, toast]);

  const value = useMemo<Store>(
    () => ({
      state,
      isSandboxDemo,
      isBackendConfigured: isSupabaseConfigured,
      speciesTableReady: state.speciesTableReady,
      speciesCatalog,
      speciesById,
      projects,
      allProjects,
      getProject,
      getProjectAnyStatus,
      myDonations,
      savedIds,
      isSaved,
      nominations: state.nominations,
      hasNominated,
      enterDemo,
      loginRealUser,
      logout,
      refreshFromBackend: () => syncFromSupabase(),
      addDonation,
      toggleSaveProject,
      ensureSavedProject,
      updateUserProfile,
      toggleNominate,
      upsertProject,
      upsertSpecies,
      upsertSpeciesBatch,
      deleteSpecies,
      purgeUnusedDummySpecies,
      setPublicationStatus,
      exportConfigJson,
      importConfigJson,
      dispatch,
      toast,
      resetDemo,
    }),
    [
      state,
      isSandboxDemo,
      speciesCatalog,
      speciesById,
      projects,
      allProjects,
      getProject,
      getProjectAnyStatus,
      myDonations,
      savedIds,
      isSaved,
      hasNominated,
      enterDemo,
      loginRealUser,
      logout,
      syncFromSupabase,
      addDonation,
      toggleSaveProject,
      ensureSavedProject,
      updateUserProfile,
      toggleNominate,
      upsertProject,
      upsertSpecies,
      upsertSpeciesBatch,
      deleteSpecies,
      purgeUnusedDummySpecies,
      setPublicationStatus,
      exportConfigJson,
      importConfigJson,
      toast,
      resetDemo,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore must be inside AppStoreProvider');
  return c;
}

export { DEMO_USER, DEMO_ADMIN };
