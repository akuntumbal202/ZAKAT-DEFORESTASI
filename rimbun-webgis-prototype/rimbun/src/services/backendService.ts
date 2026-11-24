import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Donation, RestorationProject, User } from '../types';
import type { AuthResult } from './authService';

export interface BackendSnapshot {
  programs: Record<string, RestorationProject>;
  donations: Donation[];
  nominations: Record<string, number>;
  userNominated: string[];
  savedProjectIds: string[];
}

function mapProfileRow(row: Record<string, unknown>, fallbackEmail = ''): User {
  return {
    id: String(row.id),
    name: String(row.name || 'Donatur Rimbun'),
    email: String(row.email || fallbackEmail),
    phone: String(row.phone || ''),
    city: String(row.city || ''),
    role: row.role === 'admin' ? 'admin' : 'donor',
    joined_at: String(row.joined_at || new Date().toISOString().slice(0, 10)).slice(0, 10),
    is_demo: false,
  };
}

function mapProgramRow(row: Record<string, unknown>): RestorationProject {
  return {
    id: String(row.id),
    polygon_code: String(row.polygon_code || row.id),
    publication_status: row.publication_status === 'published' ? 'published' : 'draft',
    name: String(row.name || ''),
    short_name: String(row.short_name || ''),
    summary: String(row.summary || ''),
    description: String(row.description || ''),
    status: (row.status as RestorationProject['status']) || 'open',
    category: (row.category as RestorationProject['category']) || 'hutan-lahan-kering',
    condition_summary: String(row.condition_summary || ''),
    rehab_needs: String(row.rehab_needs || ''),
    recommended_species: Array.isArray(row.recommended_species) ? row.recommended_species : [],
    cost_breakdown: Array.isArray(row.cost_breakdown) ? row.cost_breakdown : [],
    funding_target: Number(row.funding_target || 0),
    funding_collected_base: Number(row.funding_collected_base || 0),
    donor_count_base: Number(row.donor_count_base || 0),
    started_at: String(row.started_at || new Date().toISOString().slice(0, 10)),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    updates: Array.isArray(row.updates) ? row.updates : [],
    visual_seed: Number(row.visual_seed || 1),
    image_url: String(row.image_url || '/images/site-watershed.jpg'),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
  };
}

function mapDonationRow(row: Record<string, unknown>): Donation {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    user_id: String(row.user_id),
    amount: Number(row.amount || 0),
    display_name: String(row.display_name || 'Donatur'),
    anonymous: Boolean(row.anonymous),
    message: String(row.message || ''),
    payment_method: (row.payment_method as Donation['payment_method']) || 'qris',
    created_at: String(row.created_at || new Date().toISOString()),
    status: 'simulasi-berhasil',
  };
}

/** Fetches the current real (non-anonymous) authenticated Supabase user + profile. */
export async function fetchCurrentSupabaseUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const authUser = sessionData.session?.user;
  if (!authUser || authUser.is_anonymous) return null;

  const { data: prof } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (prof) return mapProfileRow(prof as Record<string, unknown>, authUser.email ?? '');

  return {
    id: authUser.id,
    name: (authUser.user_metadata?.name as string) || (authUser.email?.split('@')[0] ?? 'Donatur'),
    email: authUser.email ?? '',
    phone: '',
    city: '',
    role: 'donor',
    joined_at: (authUser.created_at ?? new Date().toISOString()).slice(0, 10),
    is_demo: false,
  };
}

/** Signs in a real user via Supabase Auth. */
export async function signInWithSupabase(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Supabase belum dikonfigurasi.' };
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user) {
    const msg = error?.message?.toLowerCase().includes('invalid')
      ? 'Email atau kata sandi salah. Periksa kembali atau daftar akun baru.'
      : error?.message?.toLowerCase().includes('confirmed')
        ? 'Email belum dikonfirmasi. Cek inbox email Anda atau matikan Confirm Email di Supabase Auth.'
        : error?.message || 'Gagal masuk ke server.';
    return { ok: false, error: msg };
  }
  const user = await fetchCurrentSupabaseUser();
  if (!user) return { ok: false, error: 'Gagal memuat profil pengguna dari server.' };
  return { ok: true, user };
}

/** Registers a real donor user via Supabase Auth. */
export async function signUpWithSupabase(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Supabase belum dikonfigurasi.' };
  const email = input.email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { name: input.name.trim() } },
  });
  if (error) {
    const msg = error.message.toLowerCase().includes('already')
      ? 'Email ini sudah terdaftar. Silakan masuk menggunakan kata sandi Anda.'
      : error.message;
    return { ok: false, error: msg };
  }
  if (!data.session) {
    return {
      ok: false,
      error: 'Pendaftaran berhasil! Silakan konfirmasi tautan di email Anda terlebih dahulu sebelum masuk.',
    };
  }
  const user = await fetchCurrentSupabaseUser();
  if (!user) {
    return {
      ok: true,
      user: {
        id: data.user!.id,
        name: input.name.trim(),
        email,
        phone: '',
        city: '',
        role: 'donor',
        joined_at: new Date().toISOString().slice(0, 10),
        is_demo: false,
      },
    };
  }
  return { ok: true, user };
}

export async function resetPasswordSupabase(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: true };
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOutSupabase(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Loads synchronized snapshot of programs, nominations, donations, and own bookmarks from Supabase. */
export async function fetchBackendSnapshot(realUser: User | null): Promise<BackendSnapshot | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  const [progRes, countRes, donRes, sessionRes] = await Promise.all([
    supabase.from('programs').select('*'),
    supabase.rpc('get_nomination_counts'),
    supabase.from('donations').select('*').order('created_at', { ascending: false }),
    supabase.auth.getSession(),
  ]);

  if (progRes.error) {
    throw new Error(progRes.error.message);
  }

  const programs: Record<string, RestorationProject> = {};
  for (const row of (progRes.data ?? []) as Record<string, unknown>[]) {
    const p = mapProgramRow(row);
    programs[p.id] = p;
  }

  const nominations: Record<string, number> = {};
  if (!countRes.error && Array.isArray(countRes.data)) {
    for (const row of countRes.data as { polygon_code: string; votes: number }[]) {
      nominations[row.polygon_code] = Number(row.votes || 0);
    }
  }

  const donations: Donation[] = !donRes.error
    ? ((donRes.data ?? []) as Record<string, unknown>[]).map(mapDonationRow)
    : [];

  let userNominated: string[] = [];
  const activeAuthId = sessionRes.data.session?.user?.id;
  if (activeAuthId) {
    const ownNomRes = await supabase
      .from('nominations')
      .select('polygon_code')
      .eq('voter_id', activeAuthId);
    if (!ownNomRes.error && ownNomRes.data) {
      userNominated = ownNomRes.data.map((r: { polygon_code: string }) => r.polygon_code);
    }
  }

  let savedProjectIds: string[] = [];
  if (realUser && !realUser.is_demo) {
    const savedRes = await supabase
      .from('saved_projects')
      .select('project_id')
      .eq('user_id', realUser.id);
    if (!savedRes.error && savedRes.data) {
      savedProjectIds = savedRes.data.map((r: { project_id: string }) => r.project_id);
    }
  }

  return { programs, donations, nominations, userNominated, savedProjectIds };
}

/** Ensures either a real user session or Supabase Anonymous Auth session exists for voting. */
export async function toggleNominationRemote(
  lkCode: string,
  currentlyVoted: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase belum dikonfigurasi.' };

  let { data: sessData } = await supabase.auth.getSession();
  if (!sessData.session) {
    const anon = await supabase.auth.signInAnonymously();
    if (anon.error || !anon.data.session) {
      return {
        ok: false,
        error:
          'Aktifkan "Allow anonymous sign-ins" di dashboard Supabase (Authentication → Sign In / Providers) atau masuk sebagai Donatur untuk mengusulkan poligon.',
      };
    }
    sessData = { session: anon.data.session };
  }

  const voterId = sessData.session.user.id;
  if (currentlyVoted) {
    const { error } = await supabase
      .from('nominations')
      .delete()
      .eq('polygon_code', lkCode)
      .eq('voter_id', voterId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await supabase
    .from('nominations')
    .insert({ polygon_code: lkCode, voter_id: voterId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function upsertProgramRemote(project: RestorationProject): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase belum dikonfigurasi.' };
  const payload = {
    id: project.id,
    polygon_code: project.polygon_code || project.id,
    publication_status: project.publication_status,
    name: project.name,
    short_name: project.short_name,
    summary: project.summary,
    description: project.description,
    status: project.status,
    category: project.category,
    condition_summary: project.condition_summary,
    rehab_needs: project.rehab_needs,
    recommended_species: project.recommended_species,
    cost_breakdown: project.cost_breakdown,
    funding_target: Math.round(project.funding_target),
    funding_collected_base: Math.round(project.funding_collected_base),
    donor_count_base: Math.round(project.donor_count_base),
    started_at: project.started_at,
    updated_at: new Date().toISOString().slice(0, 10),
    updates: project.updates ?? [],
    visual_seed: project.visual_seed,
    image_url: project.image_url,
    tags: project.tags,
  };
  const { error } = await supabase.from('programs').upsert(payload, { onConflict: 'id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function insertDonationRemote(d: Donation): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase belum dikonfigurasi.' };
  const { error } = await supabase.from('donations').insert({
    id: d.id,
    project_id: d.project_id,
    user_id: d.user_id,
    amount: Math.round(d.amount),
    display_name: d.display_name,
    anonymous: d.anonymous,
    message: d.message,
    payment_method: d.payment_method,
    status: d.status,
    created_at: d.created_at,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function toggleSavedRemote(
  userId: string,
  projectId: string,
  shouldSave: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase belum dikonfigurasi.' };
  if (shouldSave) {
    const { error } = await supabase.from('saved_projects').upsert({ user_id: userId, project_id: projectId });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const { error } = await supabase
    .from('saved_projects')
    .delete()
    .eq('user_id', userId)
    .eq('project_id', projectId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateProfileRemote(
  userId: string,
  patch: Pick<User, 'name' | 'phone' | 'city'>,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase belum dikonfigurasi.' };
  const { error } = await supabase
    .from('profiles')
    .update({ name: patch.name, phone: patch.phone, city: patch.city })
    .eq('id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
