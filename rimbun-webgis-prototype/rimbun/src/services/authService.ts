import type { User } from '../types';
import { DEMO_ADMIN, DEMO_USER } from '../data/mock/users';
import { simulateLatency } from './projectService';

/**
 * SIMULATED authentication supporting Donor and Admin demo roles.
 * Replace with Supabase Auth later.
 */
export interface StoredAccount {
  user: User;
}

export type AuthResult = { ok: true; user: User } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string) {
  return EMAIL_RE.test(email.trim());
}

export async function simulateLogin(email: string, password: string, accounts: StoredAccount[]): Promise<AuthResult> {
  await simulateLatency(400);
  const e = email.trim().toLowerCase();
  if (!validateEmail(e)) return { ok: false, error: 'Format email belum valid.' };
  if (password.length < 6) return { ok: false, error: 'Kata sandi minimal 6 karakter.' };
  if (e === DEMO_USER.email) return { ok: true, user: DEMO_USER };
  if (e === DEMO_ADMIN.email) return { ok: true, user: DEMO_ADMIN };
  const found = accounts.find((a) => a.user.email === e);
  if (!found) return { ok: false, error: 'Akun tidak ditemukan di simulasi ini. Daftar dulu atau gunakan akun demo.' };
  return { ok: true, user: { ...found.user, role: found.user.role ?? 'donor' } };
}

export async function simulateRegister(input: { name: string; email: string; password: string }, accounts: StoredAccount[]): Promise<AuthResult> {
  await simulateLatency(500);
  const email = input.email.trim().toLowerCase();
  if (input.name.trim().length < 2) return { ok: false, error: 'Nama minimal 2 karakter.' };
  if (!validateEmail(email)) return { ok: false, error: 'Format email belum valid.' };
  if (input.password.length < 6) return { ok: false, error: 'Kata sandi minimal 6 karakter.' };
  if (email === DEMO_USER.email || email === DEMO_ADMIN.email || accounts.some((a) => a.user.email === email))
    return { ok: false, error: 'Email ini sudah terdaftar di simulasi.' };
  return {
    ok: true,
    user: {
      id: `u-${Date.now().toString(36)}`,
      name: input.name.trim(),
      email,
      phone: '',
      city: '',
      joined_at: new Date().toISOString(),
      is_demo: false,
      role: 'donor',
    },
  };
}
