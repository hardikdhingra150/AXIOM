import type { ValidationResult, VersionedConfig } from './types';

function readPath(value: unknown, path: string): unknown {
  let current = value;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function validateConfig(value: unknown): ValidationResult {
  const errors: string[] = [];
  const get = (path: string) => readPath(value, path);
  const number = (path: string, min: number, max = Infinity, integer = false) => {
    const actual = get(path);
    if (
      typeof actual !== 'number' ||
      !Number.isFinite(actual) ||
      actual < min ||
      actual > max ||
      (integer && !Number.isInteger(actual))
    )
      errors.push(
        `${path} must be ${integer ? 'an integer' : 'a finite number'} in [${min}, ${max}].`,
      );
  };
  const choice = (path: string, allowed: readonly unknown[]) => {
    if (!allowed.includes(get(path)))
      errors.push(`${path} must be one of: ${allowed.join(', ')}.`);
  };
  const nullableString = (path: string) => {
    const actual = get(path);
    if (actual !== null && (typeof actual !== 'string' || !actual.trim())) {
      errors.push(`${path} must be null or a non-empty string.`);
    }
  };

  choice('schemaVersion', [2]);
  choice('preset', ['legacy_browser', 'specification_reference']);

  if (get('preset') === 'legacy_browser') {
    choice('inputMode', ['synthetic']);
    choice('legacy.scene', ['orbital', 'uav', 'ground', 'stress']);
    number('legacy.seed', 0, Number.MAX_SAFE_INTEGER, true);
    number('legacy.fov', 2, 16);
    number('legacy.speed', 0);
    number('legacy.targets', 1, Infinity, true);
    for (const field of ['noise', 'blur', 'vibration', 'turbulence']) {
      number(`legacy.${field}`, 0, 100);
    }
    number('legacy.gain', 0);
    choice('legacy.decoys', [true, false]);
  } else if (get('preset') === 'specification_reference') {
    choice('inputMode', ['synthetic', 'video']);
    number('world.widthPx', 2000, Infinity, true);
    number('world.heightPx', 2000, Infinity, true);
    number('camera.widthPx', 1, Infinity, true);
    number('camera.heightPx', 1, Infinity, true);
    number('camera.fovHorizontalDeg', Number.EPSILON, 179);
    number('camera.fovVerticalDeg', Number.EPSILON, 179);
    number('camera.frameRateHz', 30);
    choice('camera.initialPositionPolicy', ['world_center']);
    number('control.updateRateHz', 20);
    number('control.maxPanSpeedDegPerSec', 5, 10);
    number('control.maxTiltSpeedDegPerSec', 5, 10);
    number('beacon.count', 1, Infinity, true);
    choice('beacon.shape', ['square', 'circle', 'gaussian']);
    number('beacon.widthPx', 5, 20);
    number('beacon.heightPx', 5, 20);
    choice('beacon.initialLocationPolicy', ['seeded_random', 'manual']);
    for (const [position, dimension] of [
      ['initialXWorldPx', 'widthPx'],
      ['initialYWorldPx', 'heightPx'],
    ]) {
      const path = `beacon.${position}`;
      if (get('beacon.initialLocationPolicy') === 'manual' || get(path) !== null) {
        const size = get(`world.${dimension}`);
        number(path, 0, typeof size === 'number' ? size - 1 : -1);
      }
    }
    choice('beacon.motionType', ['straight', 'circular', 'figure_eight', 'random']);
    number('beacon.speedWorldPxPerSec', 0);
    choice('beacon.edgeBehavior', ['bounce', 'wrap']);
    choice('beacon.identityMode', ['appearance_motion', 'temporal_code']);
    if (
      get('beacon.identityMode') === 'temporal_code' ||
      get('beacon.modulationFrequencyHz') !== null
    ) {
      number('beacon.modulationFrequencyHz', Number.EPSILON);
    }

    const noiseTypes = ['salt_pepper', 'gaussian', 'poisson'];
    for (const field of ['enabledTypes', 'compositionOrder']) {
      const actual = get(`disturbances.noise.${field}`);
      if (
        !Array.isArray(actual) ||
        actual.some((item) => !noiseTypes.includes(item)) ||
        new Set(actual).size !== actual.length
      ) {
        errors.push(
          `disturbances.noise.${field} must contain unique supported noise types.`,
        );
      }
    }
    const enabled = get('disturbances.noise.enabledTypes');
    const order = get('disturbances.noise.compositionOrder');
    if (
      Array.isArray(enabled) &&
      Array.isArray(order) &&
      enabled.some((item) => !order.includes(item))
    ) {
      errors.push('Every enabled noise type must be present in compositionOrder.');
    }
    number('disturbances.noise.saltPepperFraction', 0, 1);
    number('disturbances.noise.gaussianStdDevIntensity', 0);
    number('disturbances.noise.poissonPeakPhotons', Number.EPSILON);
    number('disturbances.jitter.maxDisplacementPxPerFrame', 0, 20);
    choice('disturbances.jitter.model', ['none', 'seeded_uniform']);
    if (
      get('disturbances.jitter.model') === 'none' &&
      get('disturbances.jitter.maxDisplacementPxPerFrame') !== 0
    ) {
      errors.push('A none jitter model must have zero displacement.');
    }
    choice('disturbances.atmosphere.preset', [
      'clear',
      'haze',
      'fog',
      'rain',
      'low_light',
    ]);
    number('disturbances.atmosphere.contrastScale', 0, 1);
    number('disturbances.atmosphere.brightnessScale', 0, 1);
    choice('disturbances.platform.motionType', ['linear']);
    number('disturbances.platform.maxDisplacementPxPerFrame', 0, 20);
    number('disturbances.platform.directionDeg', 0, 360);
    nullableString('video.sourceIdentifier');
    nullableString('video.referenceIdentifier');
    choice('video.sourceCoordinateConvention', ['top_left_x_right_y_down']);
    choice('video.bypassVirtualPtz', [true]);
    if (get('inputMode') === 'video' && get('video.sourceIdentifier') === null) {
      errors.push('Video mode requires a sourceIdentifier.');
    }
    number('experiment.seed', 0, Number.MAX_SAFE_INTEGER, true);
    choice('experiment.metricDefinitionsVersion', ['pixel_metrics_v1']);
    const assumptions = get('experiment.assumptions');
    if (
      !Array.isArray(assumptions) ||
      assumptions.some((item) => typeof item !== 'string')
    ) {
      errors.push('experiment.assumptions must be an array of strings.');
    }
  }

  return errors.length
    ? { ok: false, errors }
    : { ok: true, config: value as VersionedConfig };
}
