import type { Donation, User } from '../../types';

/** MOCK — demo donor & demo admin accounts for Phase 1 testing. */
export const DEMO_USER: User = {
  id: 'demo-user',
  name: 'Siti Rahma',
  email: 'demo@rimbun.id',
  phone: '0812-3456-7890',
  city: 'Samarinda',
  joined_at: '2026-05-02',
  is_demo: true,
  role: 'donor',
};

export const DEMO_ADMIN: User = {
  id: 'u-admin-demo',
  name: 'Raka Mahendra',
  email: 'admin@rimbun.org',
  phone: '0813-9000-2026',
  city: 'Tenggarong / Loa Kulu',
  joined_at: '2026-03-15',
  is_demo: true,
  role: 'admin',
};

export const DEMO_PASSWORD_HINT = 'demo1234';

/** Seed history for the demo donor account tied to real Loa Kulu polygon programs. */
export const DEMO_DONATIONS: Donation[] = [
  {
    id: 'SIM-LK124-01',
    project_id: 'LK-124',
    user_id: 'demo-user',
    amount: 250_000,
    display_name: 'Siti Rahma',
    anonymous: false,
    message: 'Semoga lahan pascatambang Loa Kulu cepat tertutup tajuk.',
    payment_method: 'va-bank',
    created_at: '2026-09-14T09:12:00+07:00',
    status: 'simulasi-berhasil',
  },
  {
    id: 'SIM-LK002-02',
    project_id: 'LK-002',
    user_id: 'demo-user',
    amount: 100_000,
    display_name: 'Hamba Allah',
    anonymous: true,
    message: '',
    payment_method: 'qris',
    created_at: '2026-10-08T19:40:00+07:00',
    status: 'simulasi-berhasil',
  },
  {
    id: 'SIM-LK023-03',
    project_id: 'LK-023',
    user_id: 'demo-user',
    amount: 150_000,
    display_name: 'Siti Rahma',
    anonymous: false,
    message: 'Untuk kebun agroforestri warga Loa Kulu.',
    payment_method: 'ewallet',
    created_at: '2026-11-04T07:05:00+07:00',
    status: 'simulasi-berhasil',
  },
];

export const DEMO_SAVED = ['LK-124', 'LK-002'];

/** Initial simulated public nominations ("Usulkan Jadi Program") on non-program Loa Kulu polygons. */
export const INITIAL_NOMINATIONS: Record<string, number> = {
  'LK-106': 19,
  'LK-132': 14,
  'LK-141': 9,
  'LK-007': 7,
  'LK-060': 5,
};
