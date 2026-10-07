import type { Config as LegacyConfig } from '../types';
import { wrapLegacyConfig } from './defaults';
import { validateConfig } from './validate';
import type { VersionedConfig } from './types';

export const REFERENCE_CONFIG_KEY = 'axiom-config-v2';
export const LEGACY_CONFIG_KEY = 'archis-config-v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type LoadResult = {
  config: VersionedConfig | null;
  source: 'v2' | 'legacy' | 'none';
  errors: string[];
};
type SaveResult = { ok: true } | { ok: false; errors: string[] };

export function loadVersionedConfig(storage?: StorageLike): LoadResult {
  try {
    const target = storage ?? localStorage;
    const current = target.getItem(REFERENCE_CONFIG_KEY);
    if (current !== null) {
      const result = validateConfig(JSON.parse(current));
      return result.ok
        ? { config: result.config, source: 'v2', errors: [] }
        : { config: null, source: 'v2', errors: result.errors };
    }

    const legacy = target.getItem(LEGACY_CONFIG_KEY);
    if (legacy === null) return { config: null, source: 'none', errors: [] };
    const envelope = wrapLegacyConfig(JSON.parse(legacy) as LegacyConfig);
    const result = validateConfig(envelope);
    return result.ok
      ? { config: result.config, source: 'legacy', errors: [] }
      : { config: null, source: 'legacy', errors: result.errors };
  } catch {
    return {
      config: null,
      source: 'none',
      errors: ['Configuration could not be read. Existing storage was not changed.'],
    };
  }
}

export function saveVersionedConfig(value: unknown, storage?: StorageLike): SaveResult {
  const result = validateConfig(value);
  if (!result.ok) return { ok: false, errors: result.errors };

  try {
    const target = storage ?? localStorage;
    // Never overwrite archis-config-v1 or archis-runs-v1 during migration.
    target.setItem(REFERENCE_CONFIG_KEY, JSON.stringify(result.config));
    return { ok: true };
  } catch {
    return {
      ok: false,
      errors: [
        'Configuration could not be saved. Browser storage may be full or unavailable.',
      ],
    };
  }
}
