import type { Config as LegacyConfig } from '../types';

export type MotionType = 'straight' | 'circular' | 'figure_eight' | 'random';
export type NoiseType = 'salt_pepper' | 'gaussian' | 'poisson';
export type WeatherPreset = 'clear' | 'haze' | 'fog' | 'rain' | 'low_light';

export type LegacyConfigEnvelope = {
  schemaVersion: 2;
  preset: 'legacy_browser';
  inputMode: 'synthetic';
  // Preserve original units. Do not reinterpret these as reference parameters.
  legacy: LegacyConfig;
};

export type ReferenceConfig = {
  schemaVersion: 2;
  preset: 'specification_reference';
  inputMode: 'synthetic' | 'video';
  world: { widthPx: number; heightPx: number };
  camera: {
    widthPx: number;
    heightPx: number;
    fovHorizontalDeg: number;
    fovVerticalDeg: number;
    frameRateHz: number;
    initialPositionPolicy: 'world_center';
  };
  control: {
    updateRateHz: number;
    maxPanSpeedDegPerSec: number;
    maxTiltSpeedDegPerSec: number;
  };
  beacon: {
    count: number;
    shape: 'square' | 'circle' | 'gaussian';
    widthPx: number;
    heightPx: number;
    initialLocationPolicy: 'seeded_random' | 'manual';
    initialXWorldPx: number | null;
    initialYWorldPx: number | null;
    motionType: MotionType;
    speedWorldPxPerSec: number;
    edgeBehavior: 'bounce' | 'wrap';
    identityMode: 'appearance_motion' | 'temporal_code';
    modulationFrequencyHz: number | null;
  };
  disturbances: {
    noise: {
      enabledTypes: NoiseType[];
      compositionOrder: NoiseType[];
      saltPepperFraction: number;
      gaussianStdDevIntensity: number;
      poissonPeakPhotons: number;
    };
    jitter: {
      maxDisplacementPxPerFrame: number;
      model: 'none' | 'seeded_uniform';
    };
    atmosphere: {
      preset: WeatherPreset;
      contrastScale: number;
      brightnessScale: number;
    };
    platform: {
      motionType: 'linear';
      maxDisplacementPxPerFrame: number;
      directionDeg: number;
    };
  };
  video: {
    sourceIdentifier: string | null;
    referenceIdentifier: string | null;
    sourceCoordinateConvention: 'top_left_x_right_y_down';
    bypassVirtualPtz: true;
  };
  experiment: {
    seed: number;
    metricDefinitionsVersion: 'pixel_metrics_v1';
    assumptions: string[];
  };
};

export type VersionedConfig = LegacyConfigEnvelope | ReferenceConfig;
export type ValidationResult =
  { ok: true; config: VersionedConfig } | { ok: false; errors: string[] };
