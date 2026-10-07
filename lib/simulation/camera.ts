import type { ReferenceConfig } from '../config/types';

import type {
  CameraPose,
  WorldPoint,
} from './types';

export const WORLD_ANGULAR_SPAN = {
  horizontalDeg: 20,
  verticalDeg: 15,
};

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

function degrees(value: number): number {
  return (value * 180) / Math.PI;
}

export class ReferenceCamera {
  readonly fx: number;
  readonly fy: number;

  pose: CameraPose = {
    panDeg: 0,
    tiltDeg: 0,
  };

  constructor(readonly config: ReferenceConfig) {
    this.fx =
      config.camera.widthPx /
      (
        2 *
        Math.tan(
          radians(config.camera.fovHorizontalDeg / 2)
        )
      );

    this.fy =
      config.camera.heightPx /
      (
        2 *
        Math.tan(
          radians(config.camera.fovVerticalDeg / 2)
        )
      );
  }

  worldToAngles(point: WorldPoint): CameraPose {
    return {
      panDeg:
        (
          point.x / this.config.world.widthPx - 0.5
        ) *
        WORLD_ANGULAR_SPAN.horizontalDeg,

      tiltDeg:
        (
          0.5 - point.y / this.config.world.heightPx
        ) *
        WORLD_ANGULAR_SPAN.verticalDeg,
    };
  }

  anglesToWorld(angles: CameraPose): WorldPoint {
    return {
      x:
        (
          angles.panDeg /
            WORLD_ANGULAR_SPAN.horizontalDeg +
          0.5
        ) *
        this.config.world.widthPx,

      y:
        (
          0.5 -
          angles.tiltDeg /
            WORLD_ANGULAR_SPAN.verticalDeg
        ) *
        this.config.world.heightPx,
    };
  }

  project(point: WorldPoint): WorldPoint {
    const target = this.worldToAngles(point);

    return {
      x:
        this.config.camera.widthPx / 2 +
        this.fx *
          Math.tan(
            radians(
              target.panDeg - this.pose.panDeg
            )
          ),

      y:
        this.config.camera.heightPx / 2 -
        this.fy *
          Math.tan(
            radians(
              target.tiltDeg - this.pose.tiltDeg
            )
          ),
    };
  }

  inverse(point: WorldPoint): WorldPoint {
    return this.anglesToWorld({
      panDeg:
        this.pose.panDeg +
        degrees(
          Math.atan(
            (
              point.x -
              this.config.camera.widthPx / 2
            ) / this.fx
          )
        ),

      tiltDeg:
        this.pose.tiltDeg -
        degrees(
          Math.atan(
            (
              point.y -
              this.config.camera.heightPx / 2
            ) / this.fy
          )
        ),
    });
  }

  setPose(pose: CameraPose): void {
    if (
      !Number.isFinite(pose.panDeg) ||
      !Number.isFinite(pose.tiltDeg)
    ) {
      throw new Error(
        'Camera pose must contain finite angles.'
      );
    }

    if (
      Math.abs(pose.panDeg) > 10 ||
      Math.abs(pose.tiltDeg) > 7.5
    ) {
      throw new Error(
        'Preview camera pose is outside the development angular world.'
      );
    }

    // Direct geometry inspection.
    // Rate-limited actuator control comes later.
    this.pose = {
      ...pose,
    };
  }
}