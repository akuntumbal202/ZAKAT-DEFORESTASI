import type { Donation, PaymentMethodId } from '../types';
import { simId } from '../lib/format';
import { simulateLatency } from './projectService';

/**
 * SIMULATED donation processing. No payment gateway, no real money.
 * A real integration (e.g. Midtrans/Xendit via the ZISWAF partner) would replace
 * `simulateDonation` with a server call that returns a pending transaction.
 */
export const PAYMENT_METHODS: { id: PaymentMethodId; label: string; hint: string }[] = [
  { id: 'qris', label: 'QRIS', hint: 'Simulasi pindai kode' },
  { id: 'va-bank', label: 'Virtual Account', hint: 'Simulasi transfer bank' },
  { id: 'ewallet', label: 'E-wallet', hint: 'Simulasi dompet digital' },
  { id: 'card', label: 'Kartu debit/kredit', hint: 'Simulasi, tanpa data kartu' },
];

export const PAYMENT_LABEL = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m.label])) as Record<PaymentMethodId, string>;

export interface DonationDraft {
  project_id: string;
  user_id: string;
  amount: number;
  display_name: string;
  anonymous: boolean;
  message: string;
  payment_method: PaymentMethodId;
}

export async function simulateDonation(draft: DonationDraft): Promise<Donation> {
  await simulateLatency(1100);
  return {
    ...draft,
    display_name: draft.anonymous ? 'Hamba Allah' : draft.display_name,
    id: simId('SIM'),
    created_at: new Date().toISOString(),
    status: 'simulasi-berhasil',
  };
}
