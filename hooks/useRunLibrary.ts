'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SavedRun } from '@/lib/types';

// Keep the original key so runs saved before this refactor remain available.
const STORAGE_KEY = 'archis-runs-v1';
const MAX_RUNS = 30;

type StorageResult = { ok: true } | { ok: false; message: string };

function isSavedRun(value: unknown): value is SavedRun {
  if (!value || typeof value !== 'object') return false;

  const run = value as Partial<SavedRun>;

  // Preserve the legacy loader's acceptance rules in this extraction.
  return Boolean(
    run.id &&
    run.metrics &&
    run.config &&
    Array.isArray(run.samples) &&
    Array.isArray(run.events),
  );
}

export function useRunLibrary() {
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const runsRef = useRef<SavedRun[]>([]);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

      if (!Array.isArray(stored)) {
        throw new Error('Saved run catalogue is not an array.');
      }

      const loaded = stored.filter(isSavedRun).slice(0, MAX_RUNS);
      runsRef.current = loaded;
      setRuns(loaded);
      setLoadError(null);
    } catch {
      setLoadError(
        'Saved runs could not be loaded. Existing stored data has not been changed.',
      );
    }
  }, []);

  const addRun = useCallback((run: SavedRun): StorageResult => {
    const next = [run, ...runsRef.current].slice(0, MAX_RUNS);

    try {
      // Update the UI only after persistence succeeds.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      runsRef.current = next;
      setRuns(next);
      return { ok: true };
    } catch {
      return {
        ok: false,
        message:
          'Run could not be saved. Browser storage may be full or unavailable. Export JSON to keep this run.',
      };
    }
  }, []);

  const clearRuns = useCallback((): StorageResult => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      runsRef.current = [];
      setRuns([]);
      setLoadError(null);
      return { ok: true };
    } catch {
      return {
        ok: false,
        message: 'Saved runs could not be cleared. Browser storage is unavailable.',
      };
    }
  }, []);

  return { runs, addRun, clearRuns, loadError };
}
