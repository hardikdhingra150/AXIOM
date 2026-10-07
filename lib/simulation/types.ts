export type WorldPoint = {
    x: number;
    y: number;
  };
  
  export type CameraPose = {
    panDeg: number;
    tiltDeg: number;
  };
  
  // Only camera observations should enter the future detector.
  // Ground-truth coordinates are deliberately excluded.
  export type ObservationFrame = {
    sourceMode: 'synthetic';
    sequence: number;
    timestampSeconds: number;
    width: number;
    height: number;
    pixelFormat: 'gray8';
    pixels: ArrayBuffer;
  };
  
  export type BeaconTruth = {
    id: string;
    world: WorldPoint;
    image: WorldPoint;
    visible: boolean;
    clipped: boolean;
  };
  
  export type ReferenceFrame = {
    type: 'frame';
    observation: ObservationFrame;
  
    // For preview and independent evaluation.
    // Do not pass this object into detection or control.
    evaluation: {
      beacons: BeaconTruth[];
      camera: CameraPose;
      processingMs: number;
    };
  };