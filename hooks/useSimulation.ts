import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_CONFIG,
  SCENES,
  type Config,
  type Frame,
  type Sample,
} from '@/lib/types';
import { BrowserTransport } from '../lib/transports/BrowserTransport';
import type { SimulationTransport } from '../lib/transports/SimulationTransport';

type SimulationCallbacks = {
  onFrame: (frame: Frame) => void;
  onError: (message: string) => void;
};

function readInitialConfig(): Config {
  try {
    const config = JSON.parse(localStorage.getItem('archis-config-v1') || 'null');
    if (
      config &&
      SCENES.some((scene) => scene.id === config.scene) &&
      Number.isFinite(config.seed) &&
      config.fov >= 2 &&
      config.fov <= 16
    )
      return { ...DEFAULT_CONFIG, ...config };
  } catch {
    // Preserve the existing fallback when browser storage is unavailable.
  }
  return { ...DEFAULT_CONFIG };
}

export function useSimulation(callbacks: SimulationCallbacks) {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [events, setEvents] = useState<Frame['events']>([]);

  const transportRef = useRef<SimulationTransport | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const configRef = useRef(config);
  const initialConfigRef = useRef<Config>(DEFAULT_CONFIG);
  const frameRef = useRef<Frame | null>(null);
  const samplesRef = useRef<Sample[]>([]);
  const eventsRef = useRef<Frame['events']>([]);
  const lastUpdate = useRef(0);
  const lastSample = useRef(0);

  useEffect(() => {
    let active = true;
    const initial = readInitialConfig();
    configRef.current = initial;
    initialConfigRef.current = { ...initial };
    setConfig(initial);

    const transport = new BrowserTransport();
    transportRef.current = transport;

    const unsubscribe = transport.subscribe((nextFrame: Frame) => {
      if (!active) return;
      frameRef.current = nextFrame;
      callbacksRef.current.onFrame(nextFrame);

      if (nextFrame.events.length) {
        eventsRef.current = [...eventsRef.current, ...nextFrame.events].slice(-500);
        setEvents([...eventsRef.current]);
      }
      if (
        nextFrame.sample.t - lastSample.current >= 0.2 ||
        samplesRef.current.length === 0
      ) {
        samplesRef.current.push(nextFrame.sample);
        if (samplesRef.current.length > 18000) samplesRef.current.shift();
        lastSample.current = nextFrame.sample.t;
      }
      const now = performance.now();
      if (lastUpdate.current === 0 || now - lastUpdate.current > 110) {
        lastUpdate.current = now;
        setFrame(nextFrame);
        setSamples(samplesRef.current.slice(-180));
      }
    });

    const unsubscribeErrors = transport.subscribeErrors((message: string) => {
      if (!active) return;
      setReady(false);
      setRunning(false);
      callbacksRef.current.onError(message);
    });

    transport
      .connect(initial)
      .then(() => {
        if (!active) return;
        setInitialized(true);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setReady(false);
        setRunning(false);
        callbacksRef.current.onError(
          error instanceof Error ? error.message : 'Simulation connection failed.',
        );
      });

    return () => {
      active = false;
      unsubscribe();
      unsubscribeErrors();
      transport.close();
      if (transportRef.current === transport) transportRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;
    configRef.current = config;
    try {
      transportRef.current?.configure(config);
    } catch (error) {
      setRunning(false);
      setReady(false);
      callbacksRef.current.onError(
        error instanceof Error ? error.message : 'Configuration update failed.',
      );
    }
    try {
      localStorage.setItem('archis-config-v1', JSON.stringify(config));
    } catch {}
  }, [config, initialized]);

  const execute = useCallback(
    (command: (transport: SimulationTransport) => void): boolean => {
      const transport = transportRef.current;
      if (!transport) return false;
      try {
        command(transport);
        return true;
      } catch (error) {
        setRunning(false);
        setReady(false);
        callbacksRef.current.onError(
          error instanceof Error ? error.message : 'Simulation command failed.',
        );
        return false;
      }
    },
    [],
  );

  const start = useCallback(() => {
    if (ready && execute((transport) => transport.start())) setRunning(true);
  }, [ready, execute]);

  const pause = useCallback(() => {
    execute((transport) => transport.pause());
    setRunning(false);
  }, [execute]);

  const reset = useCallback(
    (nextConfig: Config = configRef.current) => {
      initialConfigRef.current = { ...nextConfig };
      configRef.current = nextConfig;
      setConfig(nextConfig);
      setRunning(false);
      samplesRef.current = [];
      eventsRef.current = [];
      frameRef.current = null;
      lastSample.current = 0;
      lastUpdate.current = 0;
      setSamples([]);
      setEvents([]);
      setFrame(null);
      execute((transport) => transport.reset(nextConfig));
    },
    [execute],
  );

  const injectDropout = useCallback(
    (seconds = 2.5) => {
      execute((transport) => transport.injectDropout(seconds));
    },
    [execute],
  );

  return {
    config,
    setConfig,
    configRef,
    initialConfigRef,
    running,
    ready,
    frame,
    frameRef,
    samples,
    samplesRef,
    events,
    eventsRef,
    start,
    pause,
    reset,
    injectDropout,
  };
}
