import type { Config, Frame } from '@/lib/types';

// This version deliberately uses the existing browser configuration.
// The specification-reference schema will be introduced separately.
export interface SimulationTransport {
  connect(config: Config): Promise<void>;
  start(): void;
  pause(): void;
  reset(config: Config): void;
  configure(config: Config): void;
  injectDropout(seconds: number): void;
  subscribe(listener: (frame: Frame) => void): () => void;
  subscribeErrors(listener: (message: string) => void): () => void;
  close(): void;
}
