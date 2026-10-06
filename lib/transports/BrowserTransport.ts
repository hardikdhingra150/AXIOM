import type { Config, Frame } from '@/lib/types';
import type { SimulationTransport } from './SimulationTransport';

type WorkerCommand =
  | { type: 'init' | 'reset' | 'config'; config: Config }
  | { type: 'start' | 'pause' }
  | { type: 'dropout'; seconds: number };

export class BrowserTransport implements SimulationTransport {
  private worker: Worker | null = null;
  private listeners = new Set<(frame: Frame) => void>();
  private errorListeners = new Set<(message: string) => void>();

  async connect(config: Config): Promise<void> {
    if (this.worker) throw new Error('Simulation transport is already connected.');

    const worker = new Worker('/simulation-worker.js', { type: 'module' });
    this.worker = worker;

    worker.onmessage = ({ data }) => {
      if (data.type === 'error') {
        this.fail(`Simulation stopped: ${data.message}`);
        return;
      }
      if (data.type !== 'frame') return;
      for (const listener of this.listeners) listener(data as Frame);
    };

    worker.onerror = () => {
      this.fail('The simulation worker could not start. Reload this page to retry.');
    };
    worker.onmessageerror = () => {
      this.fail('A simulation message could not be read. Reload this page to retry.');
    };

    try {
      this.send({ type: 'init', config });
    } catch (error) {
      this.close();
      throw error;
    }
  }

  start(): void {
    this.send({ type: 'start' });
  }

  pause(): void {
    this.send({ type: 'pause' });
  }

  reset(config: Config): void {
    this.send({ type: 'reset', config });
  }

  configure(config: Config): void {
    this.send({ type: 'config', config });
  }

  injectDropout(seconds: number): void {
    this.send({ type: 'dropout', seconds });
  }

  subscribe(listener: (frame: Frame) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeErrors(listener: (message: string) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  close(): void {
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.onmessageerror = null;
      this.worker.terminate();
      this.worker = null;
    }
    this.listeners.clear();
    this.errorListeners.clear();
  }

  private send(command: WorkerCommand): void {
    if (!this.worker) throw new Error('Simulation transport is disconnected.');
    this.worker.postMessage(command);
  }

  private fail(message: string): void {
    const listeners = [...this.errorListeners];
    this.close();
    for (const listener of listeners) listener(message);
  }
}
