import { useCallback } from 'react';
import { useStore } from './AppStore';
import { to, useRouter } from '../router/router';
import type { AuthIntent, User } from '../types';
import { isAcceptingDonations } from '../services/projectService';

/**
 * Auth-gated actions. Guests are sent to login and their context is remembered
 * so the flow resumes right after login.
 */
export function useGatedActions() {
  const { state, dispatch, getProject, toggleSaveProject, ensureSavedProject, toast } = useStore();
  const { navigate, route } = useRouter();

  const requireAuth = useCallback(
    (intent: AuthIntent, message: string) => {
      dispatch({ type: 'setIntent', intent });
      toast(message, 'info');
      navigate(to.login());
    },
    [dispatch, navigate, toast],
  );

  const donate = useCallback(
    (projectId: string, amount?: number) => {
      const p = getProject(projectId);
      if (p && !isAcceptingDonations(p)) {
        toast('Program ini sudah tidak menerima donasi.', 'warn');
        return;
      }
      if (!state.user) {
        requireAuth(
          { kind: 'donate', project_id: projectId, amount, return_to: route.path || to.program(projectId) },
          'Silakan masuk terlebih dahulu untuk melanjutkan simulasi donasi. Pilihan program Anda sudah disimpan.',
        );
        return;
      }
      dispatch({ type: 'openDonate', projectId, amount });
    },
    [dispatch, getProject, requireAuth, route.path, state.user, toast],
  );

  const toggleSave = useCallback(
    (projectId: string) => {
      if (!state.user) {
        requireAuth({ kind: 'save', project_id: projectId, return_to: route.path }, 'Masuk untuk menyimpan program favorit.');
        return;
      }
      void toggleSaveProject(projectId).then((nowSaved) => {
        toast(nowSaved ? 'Disimpan ke favorit.' : 'Dihapus dari tersimpan.', nowSaved ? 'ok' : 'info');
      });
    },
    [requireAuth, route.path, state.user, toast, toggleSaveProject],
  );

  /** Call right after a successful login/register. */
  const resumeIntent = useCallback(
    (loggedInUser?: User) => {
      const intent = state.intent;
      dispatch({ type: 'setIntent', intent: null });
      if (loggedInUser?.role === 'admin' && (!intent || intent.kind === 'admin' || intent.kind === 'dashboard')) {
        navigate(intent?.return_to || to.admin());
        return;
      }
      if (!intent) {
        navigate(to.dashboard());
        return;
      }
      if (intent.kind === 'donate' && intent.project_id) {
        navigate(intent.return_to || to.program(intent.project_id));
        dispatch({ type: 'openDonate', projectId: intent.project_id, amount: intent.amount });
        return;
      }
      if (intent.kind === 'save' && intent.project_id) {
        void ensureSavedProject(intent.project_id);
        toast('Program disimpan ke favorit.');
      }
      navigate(intent.return_to || to.dashboard());
    },
    [dispatch, ensureSavedProject, navigate, state.intent, toast],
  );

  return { donate, toggleSave, resumeIntent, requireAuth };
}
