import type { Config as LegacyConfig } from '../types';
import type { LegacyConfigEnvelope, ReferenceConfig } from './types';

export function wrapLegacyConfig(config: LegacyConfig): LegacyConfigEnvelope {
  return {
    schemaVersion: 2,
    preset: 'legacy_browser',
    inputMode: 'synthetic',
    legacy: { ...config },
  };
}

// Return a fresh object each time: editing a preset must not mutate defaults.
export function createReferenceConfig(seed = 26169): ReferenceConfig {
  return {
    schemaVersion: 2,
    preset: 'specification_reference',
    inputMode: 'synthetic',
    world: { widthPx: 2000, heightPx: 2000 },
    camera: {
      widthPx: 640,
      heightPx: 480,
      fovHorizontalDeg: 4,
      fovVerticalDeg: 3,
      frameRateHz: 30,
      initialPositionPolicy: 'world_center',
    },
    control: {
      updateRateHz: 30,
      maxPanSpeedDegPerSec: 5,
      maxTiltSpeedDegPerSec: 5,
    },
    beacon: {
      count: 1,
      shape: 'square',
      widthPx: 10,
      heightPx: 10,
      initialLocationPolicy: 'seeded_random',
      initialXWorldPx: null,
      initialYWorldPx: null,
      motionType: 'straight',
      speedWorldPxPerSec: 100,
      edgeBehavior: 'bounce',
      identityMode: 'appearance_motion',
      modulationFrequencyHz: null,
    },
    disturbances: {
      noise: {
        enabledTypes: [],
        compositionOrder: ['salt_pepper', 'gaussian', 'poisson'],
        saltPepperFraction: 0.1,
        gaussianStdDevIntensity: 20,
        poissonPeakPhotons: 100,
      },
      jitter: { maxDisplacementPxPerFrame: 0, model: 'none' },
      atmosphere: { preset: 'clear', contrastScale: 1, brightnessScale: 1 },
      platform: {
        motionType: 'linear',
        maxDisplacementPxPerFrame: 0,
        directionDeg: 0,
      },
    },
    video: {
      sourceIdentifier: null,
      referenceIdentifier: null,
      sourceCoordinateConvention: 'top_left_x_right_y_down',
      bypassVirtualPtz: true,
    },
    experiment: {
      seed,
      metricDefinitionsVersion: 'pixel_metrics_v1',
      assumptions: [
        'The 2000x2000 screen is interpreted as a virtual world, not a physical monitor.',
        'Target dimensions must be mapped to a documented pixel coordinate space by the renderer.',
        'Straight motion at 100 world pixels/s and bounce edges are development choices, not official defaults.',
        'Control rate 30 Hz is a development choice satisfying the stated minimum 20 Hz.',
        'Noise is initially disabled. Its parameters are development settings, not certified sensor values.',
        'Gaussian deviation is in gray8 intensity levels. The stated noise unit of pixels remains unresolved.',
        'Poisson peak photons defines a development sensor-noise model; the physical camera is not calibrated.',
        'Weather contrast and brightness scales are visual proxies, not calibrated atmospheric physics.',
      ],
    },
  };
}
