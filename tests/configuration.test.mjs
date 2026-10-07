import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Run the real TypeScript config modules using the existing dev dependency.
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lib/config');
const cache = new Map();
function load(name) {
  const filename = path.resolve(root, `${name}.ts`);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const localRequire = (specifier) =>
    load(path.relative(root, path.resolve(path.dirname(filename), specifier)));
  new Function('require', 'module', 'exports', outputText)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}
const { createReferenceConfig, wrapLegacyConfig } = load('defaults');
const { validateConfig } = load('validate');
const { loadVersionedConfig, saveVersionedConfig } = load('storage');
const legacy = {
  seed: 26169,
  scene: 'orbital',
  fov: 8,
  speed: 0.55,
  targets: 2,
  turbulence: 0,
  vibration: 6,
  noise: 12,
  blur: 6,
  decoys: true,
  gain: 1,
};
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  };
}

test('reference defaults match the stated camera, world, target and speed settings', () => {
  const config = createReferenceConfig();
  assert.equal(validateConfig(config).ok, true);
  assert.deepEqual(config.world, { widthPx: 2000, heightPx: 2000 });
  assert.equal(config.camera.widthPx, 640);
  assert.equal(config.camera.heightPx, 480);
  assert.equal(config.camera.fovHorizontalDeg, 4);
  assert.equal(config.camera.fovVerticalDeg, 3);
  assert.equal(config.camera.frameRateHz, 30);
  assert.equal(config.beacon.widthPx, 10);
  assert.equal(config.control.maxPanSpeedDegPerSec, 5);
});

test('new presets do not share mutable nested defaults', () => {
  const first = createReferenceConfig();
  first.disturbances.noise.enabledTypes.push('gaussian');
  first.camera.widthPx = 800;
  assert.equal(createReferenceConfig().camera.widthPx, 640);
  assert.deepEqual(createReferenceConfig().disturbances.noise.enabledTypes, []);
});

test('invalid world, rates, actuator limits and jitter produce named errors', () => {
  const config = createReferenceConfig();
  config.world.widthPx = 1999;
  config.camera.frameRateHz = 29;
  config.control.updateRateHz = 19;
  config.control.maxTiltSpeedDegPerSec = 11;
  config.disturbances.jitter.maxDisplacementPxPerFrame = 21;
  const result = validateConfig(config);
  assert.equal(result.ok, false);
  for (const field of [
    'world.widthPx',
    'camera.frameRateHz',
    'control.updateRateHz',
    'control.maxTiltSpeedDegPerSec',
    'disturbances.jitter.maxDisplacementPxPerFrame',
  ]) {
    assert(result.errors.some((error) => error.includes(field)));
  }
});

test('required motions, noise modes and weather presets are accepted', () => {
  for (const motion of ['straight', 'circular', 'figure_eight', 'random']) {
    const config = createReferenceConfig();
    config.beacon.motionType = motion;
    config.disturbances.noise.enabledTypes = ['salt_pepper', 'gaussian', 'poisson'];
    assert.equal(validateConfig(config).ok, true);
  }
  for (const preset of ['clear', 'haze', 'fog', 'rain', 'low_light']) {
    const config = createReferenceConfig();
    config.disturbances.atmosphere.preset = preset;
    assert.equal(validateConfig(config).ok, true);
  }
});

test('manual positions, target dimensions and noise composition are validated', () => {
  const config = createReferenceConfig();
  config.beacon.initialLocationPolicy = 'manual';
  assert.equal(validateConfig(config).ok, false);
  config.beacon.initialXWorldPx = 400;
  config.beacon.initialYWorldPx = 500;
  assert.equal(validateConfig(config).ok, true);
  config.beacon.widthPx = 21;
  assert.equal(validateConfig(config).ok, false);
  config.beacon.widthPx = 5;
  config.disturbances.noise.enabledTypes = ['gaussian'];
  config.disturbances.noise.compositionOrder = ['poisson'];
  assert.equal(validateConfig(config).ok, false);
});

test('video requires a source and rejects PTZ feedback', () => {
  const config = createReferenceConfig();
  config.inputMode = 'video';
  assert.equal(validateConfig(config).ok, false);
  config.video.sourceIdentifier = 'development-fixture.mp4';
  assert.equal(validateConfig(config).ok, true);
  config.video.bypassVirtualPtz = false;
  assert.equal(validateConfig(config).ok, false);
});

test('legacy wrapping preserves exact field values and storage is unchanged by loading', () => {
  const raw = JSON.stringify(legacy);
  const storage = memoryStorage({
    'archis-config-v1': raw,
    'archis-runs-v1': '[{"id":"old"}]',
  });
  assert.deepEqual(wrapLegacyConfig(legacy).legacy, legacy);
  const result = loadVersionedConfig(storage);
  assert.equal(result.source, 'legacy');
  assert.deepEqual(result.config.legacy, legacy);
  assert.equal(storage.getItem('archis-config-v1'), raw);
  assert.equal(storage.getItem('axiom-config-v2'), null);
});

test('v2 saving round-trips and never overwrites old settings or runs', () => {
  const storage = memoryStorage({
    'archis-config-v1': JSON.stringify(legacy),
    'archis-runs-v1': 'old-runs',
  });
  const config = createReferenceConfig(42);
  assert.equal(saveVersionedConfig(config, storage).ok, true);
  assert.deepEqual(loadVersionedConfig(storage).config, config);
  assert.equal(storage.getItem('archis-runs-v1'), 'old-runs');
  assert.equal(storage.getItem('archis-config-v1'), JSON.stringify(legacy));
  config.control.maxPanSpeedDegPerSec = 100;
  const before = storage.getItem('axiom-config-v2');
  assert.equal(saveVersionedConfig(config, storage).ok, false);
  assert.equal(storage.getItem('axiom-config-v2'), before);
});

test('malformed and unavailable storage are reported without invented defaults or writes', () => {
  const storage = memoryStorage({ 'axiom-config-v2': '{broken' });
  const result = loadVersionedConfig(storage);
  assert.equal(result.config, null);
  assert(result.errors.length > 0);
  assert.equal(storage.getItem('axiom-config-v2'), '{broken');
  const unavailable = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  assert(loadVersionedConfig(unavailable).errors.length > 0);
  assert.equal(saveVersionedConfig(createReferenceConfig(), unavailable).ok, false);
});