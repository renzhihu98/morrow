import {
  fixtures,
  type DossierResponse,
  type SourceKind,
  type SourcesResponse,
} from '@morrow/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { api, isDemoMode, readingDetailFixture, subscribeDemoMode, withFallback } from './api';

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

export const useToday = () =>
  useQuery({ queryKey: queryKeys.today, queryFn: () => withFallback(api.getToday, () => fixtures.api.today) });

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

export function useConnectSource() {
  return useMutation({
    mutationFn: (kind: SourceKind) => withFallback(() => api.connectSource(kind), () => ({ kind, authorizeUrl: null })),
  });
}

/** True while the app runs on fixtures because the API is unreachable. */
export function useDemoMode(): boolean {
  return useSyncExternalStore(subscribeDemoMode, isDemoMode, isDemoMode);
}
