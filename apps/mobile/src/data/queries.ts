import {
  ApiError,
  fixtures,
  type DossierResponse,
  type SourceKind,
  type SourcesResponse,
} from '@morrow/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { api, isDemoMode, readingDetailFixture, subscribeDemoMode, withFallback } from './api';
import { authClient, LINKABLE } from './auth';
import { meKey, useFirstReading, useGate } from './session';

/** In-session edits applied on top of fixtures while in demo mode. */
const demoEdits = { forgottenFacts: new Set<string>(), forgotEverything: false };

export function resetDemoEdits() {
  demoEdits.forgottenFacts.clear();
  demoEdits.forgotEverything = false;
}

const dossierFixture = (): DossierResponse => {
  const d = fixtures.api.dossier.dossier;
  const facts = d.facts.filter((f) => !demoEdits.forgottenFacts.has(f.id));
  return { dossier: { ...d, facts } };
};

const sourcesFixture = (): SourcesResponse => ({
  ...fixtures.api.sources,
  dossier: { ...fixtures.api.sources.dossier, factCount: dossierFixture().dossier.facts.length },
});

export const queryKeys = {
  today: ['today'] as const,
  readings: ['readings'] as const,
  reading: (date: string) => ['reading', date] as const,
  prophecies: ['prophecies'] as const,
  sources: ['sources'] as const,
  dossier: ['dossier'] as const,
};

/** Today's reading. Paused while the first reading is being drawn (the onboarding response seeds it). */
export function useToday() {
  const drawing = useFirstReading().state === 'drawing';
  return useQuery({
    queryKey: queryKeys.today,
    queryFn: () => withFallback(api.getToday, () => fixtures.api.today),
    enabled: !drawing,
  });
}

export const useReadings = () =>
  useQuery({ queryKey: queryKeys.readings, queryFn: () => withFallback(api.getReadings, () => fixtures.api.readings) });

export const useReading = (date: string) =>
  useQuery({
    queryKey: queryKeys.reading(date),
    queryFn: () => withFallback(() => api.getReading(date), () => readingDetailFixture(date)),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(date),
  });

export const useProphecies = () =>
  useQuery({
    queryKey: queryKeys.prophecies,
    queryFn: () => withFallback(api.getProphecies, () => fixtures.api.prophecies),
  });

export const useSources = () =>
  useQuery({ queryKey: queryKeys.sources, queryFn: () => withFallback(api.getSources, sourcesFixture) });

export const useDossier = () =>
  useQuery({ queryKey: queryKeys.dossier, queryFn: () => withFallback(api.getDossier, dossierFixture) });

export function useForgetFact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      withFallback(
        () => api.forgetFact(id),
        () => {
          demoEdits.forgottenFacts.add(id);
          return { ok: true as const };
        },
      ),
    onSuccess: (_res, id) => {
      qc.setQueryData<DossierResponse>(queryKeys.dossier, (prev) =>
        prev ? { dossier: { ...prev.dossier, facts: prev.dossier.facts.filter((f) => f.id !== id) } } : prev,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.sources });
    },
  });
}

export function useForgetEverything() {
  return useMutation({
    mutationFn: () =>
      withFallback(api.forgetEverything, () => {
        demoEdits.forgotEverything = true;
        return { ok: true as const };
      }),
  });
}

export type LinkResult = { linked: boolean; notice: string | null };

/**
 * Connect a source via Better Auth account linking (§12.3): opens the provider in an auth session
 * with incremental scopes, then refreshes sources. Gmail / Instagram aren't linkable in v0.2.
 */
export function useLinkSource(callbackURL: string) {
  const qc = useQueryClient();
  const { userId } = useGate();
  return useMutation({
    mutationFn: async (kind: SourceKind): Promise<LinkResult> => {
      const link = LINKABLE[kind];
      if (!link) return { linked: false, notice: 'Morrow will ask for this source when a prophecy needs it.' };
      if (isDemoMode()) return { linked: false, notice: 'Demo mode: start the Morrow server to connect real accounts.' };
      const res = await authClient.linkSocial({ provider: link.provider, scopes: link.scopes, callbackURL });
      if (res.error) throw new ApiError(res.error.status ?? 0, res.error.status === 401 ? 'unauthorized' : 'unknown', res.error.message);
      return { linked: true, notice: null };
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sources });
      void qc.invalidateQueries({ queryKey: meKey(userId) });
    },
  });
}

/** `DELETE /api/sources/[kind]` — unlink + delete that source's raw events + rebuild the dossier. */
export function useDisconnectSource() {
  const qc = useQueryClient();
  const { userId } = useGate();
  return useMutation({
    mutationFn: (kind: SourceKind) => withFallback(() => api.disconnectSource(kind), () => ({ ok: true as const })),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.sources });
      void qc.invalidateQueries({ queryKey: queryKeys.dossier });
      void qc.invalidateQueries({ queryKey: meKey(userId) });
    },
  });
}

/** True while the app runs on fixtures because the API is unreachable. */
export function useDemoMode(): boolean {
  return useSyncExternalStore(subscribeDemoMode, isDemoMode, isDemoMode);
}
