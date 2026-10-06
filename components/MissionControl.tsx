'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Aperture,
  ArrowUpRight,
  ArrowRight,
  Activity,
  Orbit,
  SlidersHorizontal,
  Radio,
  Telescope,
  Play,
  Pause,
  RotateCcw,
  Download,
  ShieldCheck,
  Satellite,
  Layers,
  ChevronDown,
  Check,
  CheckCircle2,
  Timer,
  Target,
  ScanLine,
  WifiOff,
  FileText,
  FolderOpen,
  Plus,
  X,
  Info,
  Compass,
  Video,
  Square,
  Monitor,
  GitBranch,
  Sparkles,
  Search,
  ExternalLink,
  Command,
  Maximize2,
  BookOpen,
  Settings2,
  TriangleAlert,
  CircleDot,
  Signal,
  MousePointer2,
  Copy,
} from 'lucide-react';
import {
  DEFAULT_CONFIG,
  SCENES,
  type Config,
  type Frame,
  type SavedRun,
  type Sample,
  type SceneId,
} from '@/lib/types';
import Chart from './Chart';
import { useRunLibrary } from '@/hooks/useRunLibrary';
import { exportFile, exportRun, type ExportFormat } from '@/lib/exports';
const OrbitalScene = dynamic(() => import('./OrbitalScene'), {
  ssr: false,
  loading: () => (
    <div className="scene-loading">
      <Orbit size={36} />
      <span>Initialising orbital environment</span>
    </div>
  ),
});
type Tab = 'mission' | 'scenarios' | 'telemetry' | 'runs' | 'system' | 'demo';
const NAV = [
  { id: 'mission' as Tab, label: 'Mission control', icon: Aperture },
  { id: 'scenarios' as Tab, label: 'Scenarios', icon: Layers },
  { id: 'telemetry' as Tab, label: 'Telemetry', icon: Activity },
  { id: 'runs' as Tab, label: 'Run library', icon: FolderOpen },
  { id: 'system' as Tab, label: 'Architecture', icon: GitBranch },
  { id: 'demo' as Tab, label: 'Demo guide', icon: Video },
];
const fmt = (n: number | undefined, d = 2) => (Number.isFinite(n) ? n!.toFixed(d) : '—');
const clock = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      className={`toggle ${on ? 'on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
    >
      <span />
    </button>
  );
}
function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  disabled = false,
  help,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (n: number) => void;
  disabled?: boolean;
  help?: string;
}) {
  return (
    <label className={`range ${disabled ? 'disabled' : ''}`}>
      <span>
        {label}
        {help && (
          <span className="hint" title={help}>
            <Info size={12} />
          </span>
        )}
        <b>
          {value.toFixed(step < 1 ? 1 : 0)}
          {unit}
        </b>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={
          {
            '--range-progress': `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
      />
    </label>
  );
}
function StatePill({ state, running }: { state: string; running: boolean }) {
  return (
    <span className={`state-pill ${state === 'TRACK' ? 'locked' : ''}`}>
      <i />
      {running ? (state === 'TRACK' ? 'LOCK MAINTAINED' : state) : 'STANDBY'}
    </span>
  );
}
export default function MissionControl() {
  const [tab, setTab] = useState<Tab>('mission'),
    [config, setConfig] = useState<Config>(DEFAULT_CONFIG),
    [running, setRunning] = useState(false),
    [frame, setFrame] = useState<Frame | null>(null),
    [samples, setSamples] = useState<Sample[]>([]),
    [events, setEvents] = useState<Frame['events']>([]),
    [toast, setToast] = useState(''),
    [exportOpen, setExportOpen] = useState(false),
    [selectedRun, setSelectedRun] = useState<SavedRun | null>(null),
    [presenter, setPresenter] = useState(false),
    [guided, setGuided] = useState(false),
    [demoStage, setDemoStage] = useState(0),
    [recording, setRecording] = useState(false),
    [recordSeconds, setRecordSeconds] = useState(0),
    [ready, setReady] = useState(false),
    [confirmClear, setConfirmClear] = useState(false),
    [inspectTruth, setInspectTruth] = useState(false);
  const worker = useRef<Worker | null>(null),
    frameRef = useRef<Frame | null>(null),
    sensor = useRef<HTMLCanvasElement>(null),
    samplesRef = useRef<Sample[]>([]),
    eventsRef = useRef<Frame['events']>([]),
    configRef = useRef(config),
    initialConfigRef = useRef<Config>(DEFAULT_CONFIG),
    lastUpdate = useRef(0),
    lastSample = useRef(0),
    demoDone = useRef(new Set<number>()),
    recorder = useRef<MediaRecorder | null>(null),
    streamRef = useRef<MediaStream | null>(null),
    recordStart = useRef(0);
  const notify = useCallback((t: string) => setToast(t), []);
  const { runs, addRun, clearRuns, loadError } = useRunLibrary();

  useEffect(() => {
    if (loadError) notify(loadError);
  }, [loadError, notify]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [tab]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    configRef.current = config;
    worker.current?.postMessage({ type: 'config', config });
    try {
      localStorage.setItem('archis-config-v1', JSON.stringify(config));
    } catch {}
  }, [config]);
  useEffect(() => {
    let initial = DEFAULT_CONFIG;
    try {
      const c = JSON.parse(localStorage.getItem('archis-config-v1') || 'null');
      if (
        c &&
        SCENES.some((x) => x.id === c.scene) &&
        Number.isFinite(c.seed) &&
        c.fov >= 2 &&
        c.fov <= 16
      )
        initial = { ...DEFAULT_CONFIG, ...c };
    } catch {}
    setConfig(initial);
    initialConfigRef.current = { ...initial };
    const w = new Worker('/simulation-worker.js', { type: 'module' });
    worker.current = w;
    w.onmessage = ({ data }) => {
      if (data.type === 'error') {
        notify(`Simulation stopped: ${data.message}`);
        setRunning(false);
        return;
      }
      const f = data as Frame;
      frameRef.current = f;
      const canvas = sensor.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.putImageData(
            new ImageData(new Uint8ClampedArray(f.pixels), f.width, f.height),
            0,
            0,
          );
          drawSensor(ctx, f);
        }
      }
      if (f.events.length) {
        eventsRef.current = [...eventsRef.current, ...f.events].slice(-500);
        setEvents([...eventsRef.current]);
      }
      if (f.sample.t - lastSample.current >= 0.2 || samplesRef.current.length === 0) {
        samplesRef.current.push(f.sample);
        if (samplesRef.current.length > 18000) samplesRef.current.shift();
        lastSample.current = f.sample.t;
      }
      if (performance.now() - lastUpdate.current > 110) {
        lastUpdate.current = performance.now();
        setFrame(f);
        setSamples(samplesRef.current.slice(-180));
      }
    };
    w.onerror = () => {
      setRunning(false);
      notify('The simulation worker could not start. Reload this page to retry.');
    };
    w.postMessage({ type: 'init', config: initial });
    setReady(true);
    return () => {
      w.terminate();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [notify]);
  useEffect(() => {
    if (tab === 'mission' && frameRef.current && sensor.current) {
      const f = frameRef.current,
        ctx = sensor.current.getContext('2d');
      if (ctx) {
        ctx.putImageData(
          new ImageData(new Uint8ClampedArray(f.pixels), f.width, f.height),
          0,
          0,
        );
        drawSensor(ctx, f);
      }
    }
  }, [tab]);
  useEffect(() => {
    if (!exportOpen && !confirmClear) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled])',
        ) || [],
      );
    focusable()[0]?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExportOpen(false);
        setConfirmClear(false);
      }
      if (e.key === 'Tab') {
        const items = focusable();
        if (!items.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, [exportOpen, confirmClear]);
  const update = (key: keyof Config, value: Config[keyof Config]) =>
    setConfig((c) => ({ ...c, [key]: value }));
  const start = () => {
    if (!ready) return;
    worker.current?.postMessage({ type: 'start' });
    setRunning(true);
  };
  const pause = () => {
    worker.current?.postMessage({ type: 'pause' });
    setRunning(false);
  };
  const reset = (c: Config = configRef.current) => {
    initialConfigRef.current = { ...c };
    worker.current?.postMessage({ type: 'reset', config: c });
    setRunning(false);
    samplesRef.current = [];
    eventsRef.current = [];
    lastSample.current = 0;
    setSamples([]);
    setEvents([]);
    setFrame(null);
    frameRef.current = null;
    setGuided(false);
    demoDone.current.clear();
  };
  const chooseScene = (id: SceneId) => {
    const s = SCENES.find((x) => x.id === id)!;
    const next = {
      ...configRef.current,
      scene: id,
      speed: s.speed,
      turbulence: s.turbulence,
      vibration: s.vibration,
    };
    setConfig(next);
    reset(next);
    notify(`${s.name} loaded. Ready to launch.`);
  };
  const saveRun = useCallback(() => {
    const f = frameRef.current;
    if (!f || f.metrics.frames < 10) {
      notify('Run the simulation for a moment before saving evidence.');
      return null;
    }
    const run: SavedRun = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      name: `${SCENES.find((s) => s.id === configRef.current.scene)?.name} · ${clock(f.metrics.duration)}`,
      config: { ...configRef.current },
      initialConfig: { ...initialConfigRef.current },
      metrics: { ...f.metrics },
      samples: [...samplesRef.current],
      events: [...eventsRef.current],
    };
    const result = addRun(run);
    notify(result.ok ? 'Run saved to your local library.' : result.message);
    return run;
  }, [notify, addRun]);
  const getCurrentRun = (): SavedRun | null => {
    if (selectedRun) return selectedRun;
    const f = frameRef.current;
    if (!f || f.metrics.frames < 10) {
      notify('Start a simulation before exporting its report.');
      return null;
    }
    return {
      id: `AXIOM-${config.seed}-${Math.floor(f.metrics.duration)}`,
      name: SCENES.find((x) => x.id === config.scene)!.name,
      date: new Date().toISOString(),
      config: { ...config },
      initialConfig: { ...initialConfigRef.current },
      metrics: { ...f.metrics },
      samples: [...samplesRef.current],
      events: [...eventsRef.current],
    };
  };
  const doExport = (type: ExportFormat) => {
    const run = getCurrentRun();
    if (!run) return;
    exportRun(run, type);
    setExportOpen(false);
    notify(`${type.toUpperCase()} report downloaded.`);
  };
  useEffect(() => {
    if (!guided || !running || !frame) return;
    const t = frame.metrics.duration;
    const stages = [0, 12, 24, 36, 48, 64];
    for (let i = 0; i < stages.length; i++) {
      if (t >= stages[i] && !demoDone.current.has(i)) {
        demoDone.current.add(i);
        setDemoStage(i);
        if (i === 1) setConfig((c) => ({ ...c, decoys: true, targets: 3 }));
        if (i === 2)
          setConfig((c) => ({
            ...c,
            scene: 'uav',
            turbulence: 32,
            vibration: 35,
            noise: 22,
          }));
        if (i === 3) worker.current?.postMessage({ type: 'dropout', seconds: 2.5 });
        if (i === 4)
          setConfig((c) => ({ ...c, turbulence: 12, vibration: 8, noise: 12 }));
        if (i === 5) {
          worker.current?.postMessage({ type: 'pause' });
          setRunning(false);
          setGuided(false);
          saveRun();
          notify('Guided run complete. Export its report or replay from the library.');
        }
      }
    }
  }, [frame, guided, running, saveRun, notify]);
  const startDemo = () => {
    const next = { ...DEFAULT_CONFIG, turbulence: 0, targets: 1, decoys: false };
    reset(next);
    setConfig(next);
    demoDone.current.clear();
    setDemoStage(0);
    setGuided(true);
    setTab('mission');
    worker.current?.postMessage({ type: 'start' });
    setRunning(true);
  };
  const beginRecord = async () => {
    if (
      !navigator.mediaDevices?.getDisplayMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      notify(
        'Screen recording is unavailable in this browser. Use your system screen recorder.',
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      streamRef.current = stream;
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4'].find(
        (x) => MediaRecorder.isTypeSupported(x),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType }),
          url = URL.createObjectURL(blob),
          a = document.createElement('a');
        a.href = url;
        a.download = `AXIOM-Naut-IQ-demo.${rec.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRecording(false);
        notify('Demo recording downloaded.');
      };
      stream.getVideoTracks()[0].onended = () => {
        if (rec.state !== 'inactive') rec.stop();
      };
      recorder.current = rec;
      rec.start(1000);
      recordStart.current = Date.now();
      setRecordSeconds(0);
      setRecording(true);
      notify('Recording started. Choose Guided demo to begin the sequence.');
    } catch (e) {
      notify(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Recording cancelled. You can start it again when ready.'
          : 'Recording could not start. Use your system screen recorder.',
      );
    }
  };
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(
      () => setRecordSeconds(Math.floor((Date.now() - recordStart.current) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [recording]);
  const sceneInfo = SCENES.find((x) => x.id === config.scene)!;
  const m = frame?.metrics;
  const state = frame?.state || 'SEARCH';
  const eventColor = (type: string) =>
    ['ACQUIRED', 'REACQUIRED'].includes(type)
      ? 'lime'
      : ['LOCK_LOST', 'DISTURBANCE'].includes(type)
        ? 'amber'
        : 'muted';
  const loadRun = (r: SavedRun) => {
    setSelectedRun(r);
    setExportOpen(true);
  };
  return (
    <div className={`app-shell ${presenter ? 'presenter' : ''}`}>
      <header className="app-header">
        <a className="brand" href="/" aria-label="AXIOM home">
          <span className="brand-mark">
            <Aperture size={25} />
          </span>
          <span>
            AXIOM<small>VIRTUAL FSOC LABORATORY</small>
          </span>
        </a>
        <div className="header-center">
          <span className="live-dot" />
          LOCAL SIMULATION<span className="slash">/</span>SIH 26169
        </div>
        <div className="header-actions">
          <button
            className={`text-button ${recording ? 'recording' : ''}`}
            onClick={() => (recording ? recorder.current?.stop() : beginRecord())}
          >
            {recording ? <Square size={14} /> : <Video size={16} />}
            <span>{recording ? `Stop · ${clock(recordSeconds)}` : 'Record demo'}</span>
          </button>
          <span className="header-divider" />
          <div className="team-avatar">NQ</div>
          <div className="team">
            Naut IQ<small>TEAM 130473</small>
          </div>
        </div>
      </header>
      <aside className="sidebar">
        <div className="sidebar-top">
          {NAV.map((n, i) => (
            <button
              key={n.id}
              className={`nav-button ${tab === n.id ? 'active' : ''}`}
              aria-label={n.label}
              aria-current={tab === n.id ? 'page' : undefined}
              title={n.label}
              onClick={() => setTab(n.id)}
            >
              <em>{String(i + 1).padStart(2, '0')}</em>
              <n.icon size={21} />
              <span>{n.label}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <button
            className="nav-button"
            aria-label="Prototype information"
            title="Prototype information"
            onClick={() => setTab('system')}
          >
            <Info size={20} />
          </button>
          <span className="version">v1.0</span>
        </div>
      </aside>
      <main>
        <div className="page-top" id="alignment-lab">
          <div>
            <div className="eyebrow">
              <span />
              AUTONOMOUS OPTICAL TRACKING
            </div>
            <h1>
              {tab === 'mission'
                ? 'THE ALIGNMENT LAB'
                : tab === 'scenarios'
                  ? 'Build your environment.'
                  : tab === 'telemetry'
                    ? 'Every frame, accounted for.'
                    : tab === 'runs'
                      ? 'Experiments worth keeping.'
                      : tab === 'system'
                        ? 'Inside the tracking loop.'
                        : 'A mission worth showing.'}
            </h1>
            <p className="page-description">
              {tab === 'mission'
                ? 'Acquire the beacon. Predict its motion. Keep the camera aligned.'
                : tab === 'scenarios'
                  ? 'Configure repeatable scenes and explore the limits of coarse alignment.'
                  : tab === 'telemetry'
                    ? 'Live measurements from the independent simulation evaluator.'
                    : tab === 'runs'
                      ? 'Save, revisit and export your evidence. Stored locally in this browser.'
                      : tab === 'system'
                        ? 'A working classical baseline today. A clear path to the complete AI-assisted system.'
                        : 'A ready-to-record walkthrough for your SIH prototype submission.'}
            </p>
          </div>
          <div className="page-actions">
            {tab === 'mission' ? (
              <>
                <button
                  className="ghost icon-only"
                  title={presenter ? 'Exit presenter view' : 'Presenter view'}
                  aria-label="Toggle presenter view"
                  onClick={() => setPresenter((p) => !p)}
                >
                  <Maximize2 size={17} />
                </button>
                <button
                  className="ghost"
                  onClick={() => {
                    setSelectedRun(null);
                    setExportOpen(true);
                  }}
                >
                  <Download size={16} />
                  Export report
                </button>
                <button
                  className="primary"
                  onClick={running ? pause : start}
                  disabled={!ready}
                >
                  {running ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                  {running ? 'Pause simulation' : 'Launch simulation'}
                </button>
              </>
            ) : (
              <button className="primary" onClick={() => setTab('mission')}>
                <Aperture size={17} />
                Mission control
                <ArrowUpRight size={16} />
              </button>
            )}
          </div>
        </div>
        {tab === 'mission' && (
          <>
            <div className="mission-strip">
              <div>
                <span className="label">SCENARIO</span>
                <select
                  aria-label="Active scenario"
                  value={config.scene}
                  onChange={(e) => chooseScene(e.target.value as SceneId)}
                >
                  {SCENES.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} />
              </div>
              <span className="strip-separator" />
              <div className="strip-data">
                <span className="label">SEED</span>
                <span>{config.seed}</span>
              </div>
              <div className="strip-data">
                <span className="label">ELAPSED</span>
                <span>{clock(m?.duration || 0)}</span>
              </div>
              <div className="strip-right">
                <span className="baseline-label">
                  <ShieldCheck size={13} />
                  CLASSICAL BASELINE
                </span>
                <StatePill state={state} running={running} />
              </div>
            </div>
            <div className="workspace-grid">
              <section className="panel environment">
                <div className="panel-head">
                  <div>
                    <Orbit size={17} />
                    <h2>Tracking environment</h2>
                  </div>
                  <span className="quiet-tag">CONCEPTUAL 3D VIEW</span>
                </div>
                <div className="environment-body">
                  <OrbitalScene frameRef={frameRef} scene={config.scene} />
                  <section className="mission-intro">
                    <div className="intro-copy">
                      <span className="eyebrow">
                        NAUT IQ / EXPERIMENTAL OPTICAL SYSTEMS
                      </span>
                      <h2>
                        PRECISION
                        <br />
                        <em>ACROSS SPACE.</em>
                      </h2>
                    </div>
                    <div className="intro-index">
                      <span>SOFTWARE-DEFINED ALIGNMENT</span>
                      <p>
                        Find the light.
                        <br />
                        Follow the signal.
                        <br />
                        Hold the connection.
                      </p>
                      <small>VIRTUAL FSOC LAB / PS 26169</small>
                      <button
                        className="intro-direction"
                        onClick={() =>
                          document.getElementById('alignment-lab')?.scrollIntoView({
                            behavior: window.matchMedia(
                              '(prefers-reduced-motion: reduce)',
                            ).matches
                              ? 'instant'
                              : 'smooth',
                            block: 'start',
                          })
                        }
                      >
                        <ArrowRight size={28} />
                        <span>ENTER THE ALIGNMENT LAB</span>
                      </button>
                    </div>
                  </section>
                  <div className="scene-corner">
                    <span className="scene-corner-line" />
                    <div>
                      <small>DESIGNATED TARGET</small>
                      <strong>BEACON 01</strong>
                      <span>Temporal signature · 2.5 Hz</span>
                    </div>
                  </div>
                  <div className="scene-bottom">
                    <div className="terminal-tag">
                      <span className="terminal-icon">
                        <Telescope size={18} />
                      </span>
                      <span>
                        TERMINAL A<small>VIRTUAL PAN / TILT</small>
                      </span>
                    </div>
                    <div className="camera-angles">
                      <span>
                        PAN <b>{fmt(m?.pan, 2)}°</b>
                      </span>
                      <span>
                        TILT <b>{fmt(m?.tilt, 2)}°</b>
                      </span>
                    </div>
                  </div>
                  <div className="scene-legend">
                    <i />
                    Optical line of sight
                    <span />
                    <i className="blue-dot" />
                    Target trajectory
                  </div>
                  <span className="drag-hint">
                    <MousePointer2 size={12} />
                    Drag to orbit · Scroll to zoom
                  </span>
                </div>
                <div className="environment-footer">
                  <span>
                    <span className="live-dot" />
                    CAMERA GEOMETRY ACTIVE
                  </span>
                  <span>
                    {config.targets} {config.targets === 1 ? 'target' : 'targets'}
                    <i />
                    FOV {config.fov.toFixed(1)}°<i />
                    320 × 240 sensor
                  </span>
                </div>
              </section>
              <section className="panel sensor-panel">
                <div className="panel-head">
                  <div>
                    <ScanLine size={17} />
                    <h2>Virtual camera</h2>
                  </div>
                  <span className="sensor-active">
                    <i />
                    {running ? 'LIVE FEED' : frame ? 'FRAME HELD' : 'STANDBY'}
                  </span>
                </div>
                <div className="sensor-view">
                  <canvas
                    ref={sensor}
                    width={320}
                    height={240}
                    aria-label="Synthetic optical sensor image with detected beacon overlay"
                  />
                  <span className="sensor-label">CAM_01 / MONO</span>
                  <span className="sensor-time">
                    {clock(m?.duration || 0)}.
                    {String(Math.floor(((m?.duration || 0) % 1) * 100)).padStart(2, '0')}
                  </span>
                  <span className="sensor-mode">
                    {!running
                      ? frame
                        ? 'SIMULATION PAUSED'
                        : 'AWAITING LAUNCH'
                      : state === 'TRACK'
                        ? 'SIGNATURE VERIFIED'
                        : state === 'COAST'
                          ? 'PREDICTING MOTION'
                          : state === 'REACQUIRE'
                            ? 'SEARCHING ROI'
                            : 'ACQUIRING TARGET'}
                  </span>
                </div>
                <div className="sensor-readout">
                  <div>
                    <span className="label">POINTING ERROR</span>
                    <strong>
                      {fmt(frame?.sample.error, 3)}
                      <small>°</small>
                    </strong>
                  </div>
                  <div className="error-status">
                    {m?.aligned ? (
                      <>
                        <CheckCircle2 size={14} />
                        Coarse aligned
                      </>
                    ) : (
                      <>
                        <Target size={14} />
                        Awaiting alignment
                      </>
                    )}
                  </div>
                </div>
                <div className="confidence">
                  <div>
                    <span className="label">SIGNATURE CONFIDENCE</span>
                    <b>{fmt((frame?.confidence || 0) * 100, 0)}%</b>
                  </div>
                  <div className="confidence-track">
                    <i style={{ width: `${(frame?.confidence || 0) * 100}%` }} />
                  </div>
                </div>
                <div className="sensor-footer">
                  <Signal size={13} />
                  <span>Classical spot + temporal detection</span>
                  <span className="chip">ON DEVICE</span>
                </div>
              </section>
            </div>
            <div className="metrics-grid">
              <Metric
                icon={Timer}
                label="Acquisition time"
                value={m?.acquisition == null ? '—' : fmt(m.acquisition)}
                unit="s"
                description="First verified signature"
              />
              <Metric
                icon={ShieldCheck}
                label="Lock retention"
                value={m ? fmt(m.retention, 1) : '—'}
                unit="%"
                description="Visible eligible frames"
              />
              <Metric
                icon={Activity}
                label="Worker frame rate"
                value={running ? fmt(m?.fps, 1) : '—'}
                unit="FPS"
                description="Actual frame delivery rate"
              />
              <Metric
                icon={Command}
                label="Processing latency"
                value={fmt(m?.processing)}
                unit="ms"
                description={`p95 ${fmt(m?.p95)} ms · excludes UI`}
              />
            </div>
            {guided && (
              <div className="guided-banner">
                <Sparkles size={18} />
                <div>
                  <strong>
                    {
                      [
                        '01 / Acquisition and alignment',
                        '02 / Multiple targets and decoy rejection',
                        '03 / Disturbance injection',
                        '04 / Beacon loss and recovery',
                        '05 / Stabilisation and evidence',
                        '06 / Run complete',
                      ][demoStage]
                    }
                  </strong>
                  <p>
                    {
                      [
                        'Watch the camera find the designated beacon and close the tracking loop.',
                        'A brighter decoy appears. The detector checks temporal identity.',
                        'Vibration, noise and atmospheric effects now disturb the camera feed.',
                        'The beacon disappears for 2.5 seconds. Observe coast and reacquisition.',
                        'The environment stabilises. The run will finish and save automatically.',
                        'Export the saved report to show your evaluation evidence.',
                      ][demoStage]
                    }
                  </p>
                </div>
                <span>{clock(m?.duration || 0)} / 01:04</span>
                <button className="ghost" onClick={() => setGuided(false)}>
                  End guide
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="lower-grid">
              <section className="panel config-panel">
                <div className="panel-head">
                  <div>
                    <SlidersHorizontal size={17} />
                    <h2>Simulation parameters</h2>
                  </div>
                  <button
                    className="subtle-link"
                    onClick={() => {
                      setConfig(DEFAULT_CONFIG);
                      reset(DEFAULT_CONFIG);
                    }}
                  >
                    Reset defaults
                    <RotateCcw size={13} />
                  </button>
                </div>
                <div className="parameters-grid">
                  <div>
                    <h3>
                      <Compass size={14} />
                      Camera & target
                    </h3>
                    <Range
                      label="Camera field of view"
                      value={config.fov}
                      min={2}
                      max={16}
                      step={0.5}
                      unit="°"
                      onChange={(n) => update('fov', n)}
                    />
                    <Range
                      label="Target angular speed"
                      value={config.speed}
                      min={0.15}
                      max={2.5}
                      step={0.05}
                      unit="°/s"
                      onChange={(n) => update('speed', n)}
                    />
                    <div className="toggle-line">
                      <span>
                        Introduce decoys<small>Different temporal signatures</small>
                      </span>
                      <Toggle
                        label="Introduce decoys"
                        on={config.decoys}
                        onChange={() =>
                          setConfig((c) => ({
                            ...c,
                            decoys: !c.decoys,
                            targets: Math.max(2, c.targets),
                          }))
                        }
                      />
                    </div>
                    <div className="number-line">
                      <span>Moving targets</span>
                      <select
                        aria-label="Number of targets"
                        value={config.targets}
                        onChange={(e) => update('targets', Number(e.target.value))}
                      >
                        {[1, 2, 3].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <h3>
                      <Radio size={14} />
                      Disturbance model
                    </h3>
                    <Range
                      label="Atmospheric turbulence"
                      value={config.turbulence}
                      min={0}
                      max={80}
                      unit="%"
                      disabled={config.scene === 'orbital'}
                      help="Atmospheric effects are disabled for the vacuum orbital scene."
                      onChange={(n) => update('turbulence', n)}
                    />
                    <Range
                      label="Platform vibration"
                      value={config.vibration}
                      min={0}
                      max={100}
                      unit="%"
                      onChange={(n) => update('vibration', n)}
                    />
                    <Range
                      label="Sensor noise"
                      value={config.noise}
                      min={0}
                      max={100}
                      unit="%"
                      onChange={(n) => update('noise', n)}
                    />
                    <Range
                      label="Exposure blur"
                      value={config.blur}
                      min={0}
                      max={100}
                      unit="%"
                      onChange={(n) => update('blur', n)}
                    />
                  </div>
                </div>
                <div className="config-footer">
                  <button
                    className="ghost small"
                    onClick={() => {
                      worker.current?.postMessage({ type: 'dropout', seconds: 2.5 });
                      if (!running) start();
                      notify('A 2.5 second beacon dropout was injected.');
                    }}
                  >
                    <WifiOff size={14} />
                    Inject dropout
                  </button>
                  <button className="ghost small" onClick={() => reset()}>
                    <RotateCcw size={14} />
                    Restart run
                  </button>
                  <button className="subtle-link" onClick={() => setTab('scenarios')}>
                    Advanced setup
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </section>
              <section className="panel trend-panel">
                <div className="panel-head">
                  <div>
                    <Activity size={17} />
                    <h2>Tracking performance</h2>
                  </div>
                  <span className="quiet-tag">LIVE MEASUREMENTS</span>
                </div>
                <div className="trend-title">
                  <span>Camera-axis pointing error</span>
                  <strong>{fmt(frame?.sample.error, 3)}°</strong>
                </div>
                <Chart samples={samples} />
                <div className="trend-summary">
                  <span>
                    MEAN <b>{fmt(m?.meanError, 3)}°</b>
                  </span>
                  <span>
                    MAX <b>{fmt(m?.maxError, 3)}°</b>
                  </span>
                  <span>
                    LOSSES <b>{m?.losses || 0}</b>
                  </span>
                </div>
                <div className="event-mini">
                  {events
                    .slice(-2)
                    .reverse()
                    .map((e, i) => (
                      <div key={`${e.time}-${i}`}>
                        <i className={eventColor(e.type)} />
                        <time>{clock(e.time)}</time>
                        <span>{e.message}</span>
                      </div>
                    ))}
                  {events.length === 0 && (
                    <span className="muted">Simulation events will appear here.</span>
                  )}
                </div>
                <button
                  className="subtle-link trend-link"
                  onClick={() => setTab('telemetry')}
                >
                  View full telemetry
                  <ArrowUpRight size={13} />
                </button>
              </section>
            </div>
            <div className="mission-bottom">
              <span>
                <Info size={13} />
                Browser simulation prototype · AI model and hardware integration planned
              </span>
              <button className="subtle-link" onClick={startDemo}>
                <Sparkles size={14} />
                Run guided demonstration
                <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}
        {tab === 'scenarios' && (
          <>
            <div className="section-caption">
              <h2>Choose your operating environment</h2>
              <span>04 CONFIGURABLE SCENES</span>
            </div>
            <div className="scenario-grid">
              {SCENES.map((s, i) => (
                <button
                  key={s.id}
                  className={`scenario-card scene-${s.id} ${config.scene === s.id ? 'selected' : ''}`}
                  onClick={() => chooseScene(s.id)}
                >
                  <div className="scenario-art">
                    <span className="scenario-index">0{i + 1}</span>
                    {s.id === 'orbital' ? (
                      <Satellite size={47} />
                    ) : s.id === 'uav' ? (
                      <Radio size={47} />
                    ) : s.id === 'ground' ? (
                      <Telescope size={47} />
                    ) : (
                      <ScanLine size={47} />
                    )}
                    <div className="scenario-orbit" />
                  </div>
                  <span className="eyebrow">{s.label}</span>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <span className="scenario-select">
                    {config.scene === s.id ? (
                      <>
                        <CheckCircle2 size={15} />
                        Active environment
                      </>
                    ) : (
                      <>
                        Load environment
                        <ArrowUpRight size={15} />
                      </>
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="setup-grid">
              <section className="panel setup-panel">
                <div className="panel-head">
                  <div>
                    <Settings2 size={18} />
                    <h2>Experiment manifest</h2>
                  </div>
                </div>
                <div className="form-fields">
                  <label>
                    Scenario seed
                    <span className="input-wrap">
                      <input
                        type="number"
                        min="1"
                        max="999999999"
                        aria-label="Scenario seed"
                        value={config.seed}
                        onChange={(e) =>
                          update(
                            'seed',
                            Math.max(
                              1,
                              Math.min(
                                999999999,
                                Math.floor(Number(e.target.value) || 1),
                              ),
                            ),
                          )
                        }
                      />
                      <button
                        onClick={() => {
                          const next = {
                            ...config,
                            seed: Math.floor(Math.random() * 999999) + 1,
                          };
                          setConfig(next);
                          reset(next);
                        }}
                        aria-label="Generate new seed"
                      >
                        <RotateCcw size={16} />
                      </button>
                    </span>
                    <small>
                      Apply with Restart to regenerate the sensor noise stream.
                    </small>
                  </label>
                  <label>
                    Sensor resolution
                    <input value="320 × 240 · monochrome" disabled />
                  </label>
                  <label>
                    Detector
                    <select disabled>
                      <option>Classical + temporal signature baseline</option>
                    </select>
                  </label>
                  <label>
                    Control method
                    <input
                      value="Constant-velocity estimation + bounded proportional / feed-forward"
                      disabled
                    />
                  </label>
                  <label>
                    Angular lock tolerance
                    <input value="0.35° · evaluator threshold" disabled />
                  </label>
                  <label>
                    Tracking worker
                    <input value="Dedicated browser Web Worker" disabled />
                  </label>
                </div>
                <div className="panel-bottom">
                  <button
                    className="primary"
                    onClick={() => {
                      reset();
                      setTab('mission');
                      notify('Manifest applied. Launch the new run when ready.');
                    }}
                  >
                    <Check size={16} />
                    Apply & restart
                  </button>
                  <button
                    className="ghost"
                    onClick={() =>
                      exportFile(
                        JSON.stringify(config, null, 2),
                        'AXIOM-scenario.json',
                        'application/json',
                      )
                    }
                  >
                    <Download size={16} />
                    Export configuration
                  </button>
                </div>
              </section>
              <section className="panel setup-notes">
                <span className="eyebrow">A FAIR EXPERIMENT</span>
                <h2>
                  Change the condition.
                  <br />
                  Keep the comparison.
                </h2>
                <p>
                  Use the same scenario seed and trajectory when comparing algorithms. Log
                  unsuccessful acquisitions and track losses alongside successful runs.
                </p>
                <div>
                  <ShieldCheck size={19} />
                  <span>
                    <b>Independent ground truth</b>
                    <small>
                      The detector consumes pixels. The evaluator measures correctness
                      after control execution.
                    </small>
                  </span>
                </div>
                <div>
                  <Orbit size={19} />
                  <span>
                    <b>Atmospheric path only</b>
                    <small>
                      Turbulence applies to UAV and ground-to-air scenes. It is disabled
                      for orbital vacuum scenes.
                    </small>
                  </span>
                </div>
                <div>
                  <Info size={19} />
                  <span>
                    <b>Current prototype limits</b>
                    <small>
                      The optical model is approximate. These experiments do not validate
                      a physical FSOC terminal.
                    </small>
                  </span>
                </div>
              </section>
            </div>
          </>
        )}
        {tab === 'telemetry' && (
          <>
            <div className="metrics-grid telemetry-metrics">
              <Metric
                icon={Target}
                label="Mean pointing error"
                value={fmt(m?.meanError, 3)}
                unit="°"
                description="Across all simulation frames"
              />
              <Metric
                icon={ShieldCheck}
                label="All-frame availability"
                value={fmt(m?.availability, 1)}
                unit="%"
                description="Includes occlusion and acquisition"
              />
              <Metric
                icon={Timer}
                label="Latest reacquisition"
                value={m?.reacquisition == null ? '—' : fmt(m.reacquisition)}
                unit="s"
                description="Most recent recovery interval"
              />
              <Metric
                icon={Activity}
                label="Processing p95"
                value={fmt(m?.p95, 2)}
                unit="ms"
                description="Latest 600 processing samples"
              />
            </div>
            <div className="telemetry-chart-grid">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <Target size={17} />
                    <h2>Pointing error</h2>
                  </div>
                  <span className="quiet-tag">DEGREES</span>
                </div>
                <Chart samples={samples} kind="error" />
              </section>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <Signal size={17} />
                    <h2>Signature confidence</h2>
                  </div>
                  <span className="quiet-tag">CORRELATION / %</span>
                </div>
                <Chart samples={samples} kind="confidence" />
              </section>
            </div>
            <section className="panel event-log">
              <div className="panel-head">
                <div>
                  <GitBranch size={17} />
                  <h2>Tracking state & event log</h2>
                </div>
                <span className="quiet-tag">{events.length} EVENTS</span>
              </div>
              <div className="state-flow">
                {['SEARCH', 'ACQUIRE', 'TRACK', 'COAST', 'REACQUIRE'].map((x, i) => (
                  <div key={x}>
                    <span className={state === x ? 'current' : ''}>
                      {state === x && <i />}
                      {x}
                    </span>
                    {i < 4 && <ArrowRight size={16} />}
                  </div>
                ))}
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>SIMULATION TIME</th>
                      <th>EVENT</th>
                      <th>DESCRIPTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events
                      .slice()
                      .reverse()
                      .map((e, i) => (
                        <tr key={`${e.time}-${i}`}>
                          <td className="mono">{e.time.toFixed(3)} s</td>
                          <td>
                            <span className={`event-type ${eventColor(e.type)}`}>
                              {e.type}
                            </span>
                          </td>
                          <td>{e.message}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {events.length === 0 && (
                  <div className="empty-inline">
                    Launch a simulation to collect events.
                  </div>
                )}
              </div>
            </section>
            <div className="evaluation-note">
              <Info size={18} />
              <p>
                <b>Measurement definitions</b> Lock retention counts correctly tracked,
                visible frames within 0.35°. All-frame availability includes hidden
                intervals. Error is camera-axis error in synthetic angular coordinates.
                Worker processing excludes browser transport and rendering.
              </p>
            </div>
            <section className="panel truth-panel">
              <button className="truth-toggle" onClick={() => setInspectTruth((p) => !p)}>
                <span>
                  <ShieldCheck size={17} />
                  Evaluator-only ground truth
                </span>
                <ChevronDown size={18} />
              </button>
              {inspectTruth && (
                <div className="truth-values">
                  <span>
                    Target azimuth <b>{fmt(frame?.target.az, 3)}°</b>
                  </span>
                  <span>
                    Target elevation <b>{fmt(frame?.target.el, 3)}°</b>
                  </span>
                  <span>
                    Sensor visibility{' '}
                    <b>{m?.visible ? 'VISIBLE' : 'OCCLUDED / OUT OF FOV'}</b>
                  </span>
                  <p>
                    These values are for inspection only. They are never passed into the
                    detector or control policy.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
        {tab === 'runs' && (
          <>
            <div className="section-caption">
              <h2>
                Local run library <span className="count">{runs.length}</span>
              </h2>
              <div>
                <button className="ghost" onClick={saveRun}>
                  <Plus size={16} />
                  Save current run
                </button>
                {runs.length > 0 && (
                  <button
                    className="text-button muted"
                    onClick={() => setConfirmClear(true)}
                  >
                    Clear library
                  </button>
                )}
              </div>
            </div>
            {runs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-orbit">
                  <FolderOpen size={39} />
                </div>
                <span className="eyebrow">REPEATABLE BY DESIGN</span>
                <h2>Your evidence starts here.</h2>
                <p>
                  Run an experiment, save its measurements, and export a report for your
                  technical submission.
                </p>
                <button className="primary" onClick={() => setTab('mission')}>
                  <Play size={16} />
                  Start your first experiment
                </button>
              </div>
            ) : (
              <section className="panel">
                <div className="table-scroll">
                  <table className="runs-table">
                    <thead>
                      <tr>
                        <th>EXPERIMENT</th>
                        <th>DURATION</th>
                        <th>MEAN ERROR</th>
                        <th>RETENTION</th>
                        <th>SEED</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.name}</strong>
                            <small>{new Date(r.date).toLocaleString()}</small>
                          </td>
                          <td className="mono">{clock(r.metrics.duration)}</td>
                          <td className="mono">{r.metrics.meanError.toFixed(3)}°</td>
                          <td className="mono lime">{r.metrics.retention.toFixed(1)}%</td>
                          <td className="mono">{r.config.seed}</td>
                          <td>
                            <button className="ghost small" onClick={() => loadRun(r)}>
                              <Download size={14} />
                              Export
                            </button>
                            <button
                              className="text-button"
                              onClick={() => {
                                const initial = r.initialConfig || r.config;
                                setConfig(initial);
                                reset(initial);
                                setTab('mission');
                                notify(
                                  'Initial setup loaded. Replay interventions manually using the saved event log.',
                                );
                              }}
                              aria-label={`Replay ${r.name}`}
                              title="Load initial configuration"
                            >
                              <RotateCcw size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            <div className="evaluation-note">
              <FolderOpen size={18} />
              <p>
                Runs are stored in this browser only, with a 30-run limit. Export JSON to
                keep a portable copy. Repeat setup reuses the initial manifest and seed.
                Mid-run interventions remain in the event log for manual replay.
                Processing times can vary by hardware and browser load.
              </p>
            </div>
          </>
        )}
        {tab === 'system' && (
          <>
            <div className="architecture-intro">
              <span className="eyebrow">COARSE ALIGNMENT / CLOSED LOOP</span>
              <h2>From photons to pointing.</h2>
              <p>
                A dedicated worker owns the simulation loop. The interface observes
                telemetry without changing the detector’s inputs.
              </p>
            </div>
            <div className="architecture-grid">
              {[
                {
                  n: '01',
                  icon: Orbit,
                  title: 'Generate the world',
                  body: 'Seeded target trajectories, designated beacon and moving decoys.',
                  detail: 'Synthetic angular scene',
                  status: 'IMPLEMENTED',
                },
                {
                  n: '02',
                  icon: ScanLine,
                  title: 'Render the sensor',
                  body: 'Camera projection, spot profiles, image noise, vibration and atmospheric disturbance.',
                  detail: '320 × 240 monochrome image',
                  status: 'IMPLEMENTED',
                },
                {
                  n: '03',
                  icon: Search,
                  title: 'Detect & verify',
                  body: 'Pixel thresholding, weighted centroids and multi-frame temporal-signature correlation.',
                  detail: 'Classical baseline · no trained CNN',
                  status: 'IMPLEMENTED',
                },
                {
                  n: '04',
                  icon: Target,
                  title: 'Predict & steer',
                  body: 'Constant-velocity estimation and bounded proportional control with velocity feed-forward.',
                  detail: 'Pan / tilt command each frame',
                  status: 'IMPLEMENTED',
                },
                {
                  n: '05',
                  icon: WifiOff,
                  title: 'Recover visibility',
                  body: 'Coast through a brief dropout, search around the prediction and reset after timeout.',
                  detail: 'Identity confirmation on return',
                  status: 'IMPLEMENTED',
                },
                {
                  n: '06',
                  icon: FileText,
                  title: 'Evaluate & export',
                  body: 'Independent truth-based error, correct lock, frame timing and replayable records.',
                  detail: 'Local JSON / CSV / HTML',
                  status: 'IMPLEMENTED',
                },
              ].map((x) => (
                <section className="architecture-step" key={x.n}>
                  <div className="architecture-step-top">
                    <span>{x.n}</span>
                    <x.icon size={23} />
                  </div>
                  <h3>{x.title}</h3>
                  <p>{x.body}</p>
                  <small>{x.detail}</small>
                  <span className="implemented">
                    <CheckCircle2 size={12} />
                    {x.status}
                  </span>
                </section>
              ))}
            </div>
            <div className="system-bottom">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <Layers size={17} />
                    <h2>Frontend stack</h2>
                  </div>
                </div>
                <div className="stack-rows">
                  {[
                    ['Next.js + React', 'Application and interface'],
                    ['TypeScript', 'Typed UI and telemetry contracts'],
                    ['Three.js', 'Smooth 3D orbital overview'],
                    ['Web Worker', 'Authoritative browser baseline'],
                    ['Canvas + SVG', 'Live sensor and measured plots'],
                    ['Local browser storage', 'Saved configurations and run records'],
                  ].map(([a, b]) => (
                    <div key={a}>
                      <b>{a}</b>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="panel roadmap">
                <div className="panel-head">
                  <div>
                    <Sparkles size={17} />
                    <h2>Full-system integration</h2>
                  </div>
                  <span className="quiet-tag amber">PLANNED</span>
                </div>
                <p>
                  The production FSOC solution will add a Python simulation worker through
                  FastAPI/WebSockets, a trained PyTorch heatmap model exported to ONNX,
                  robust calibration and packaged desktop delivery.
                </p>
                <ul>
                  <li>Train on scene-level splits and held-out disturbances</li>
                  <li>Compare classical and hybrid detectors on identical seeds</li>
                  <li>Validate camera geometry and actuator dynamics</li>
                  <li>Test offline packaging on clean target machines</li>
                </ul>
                <span className="scope-note">
                  This frontend is a demonstration prototype. Hardware and trained AI
                  performance remain unverified.
                </span>
              </section>
            </div>
            <div className="source-links">
              <span className="eyebrow">RESEARCH FOUNDATIONS</span>
              <a
                href="https\://doi.org/10.1364/AO.55.008486"
                target="_blank"
                rel="noreferrer"
              >
                Adaptive beacon tracking
                <ExternalLink size={13} />
              </a>
              <a
                href="https\://www.mdpi.com/2072-4292/13/10/1931"
                target="_blank"
                rel="noreferrer"
              >
                Centroid error under turbulence
                <ExternalLink size={13} />
              </a>
              <a
                href="https\://openaccess.thecvf.com/content/WACV2021/html/Dai_Asymmetric_Contextual_Modulation_for_Infrared_Small_Target_Detection_WACV_2021_paper.html"
                target="_blank"
                rel="noreferrer"
              >
                Infrared small-target detection
                <ExternalLink size={13} />
              </a>
            </div>
          </>
        )}
        {tab === 'demo' && (
          <>
            <div className="demo-hero">
              <div>
                <span className="eyebrow">
                  <Sparkles size={14} />
                  BUILT FOR YOUR SIH WALKTHROUGH
                </span>
                <h2>
                  Show the complete
                  <br />
                  <em>tracking story.</em>
                </h2>
                <p>
                  A guided 64-second simulation demonstrates acquisition, decoys,
                  disturbances, loss of lock and recovery. Pair it with this narration
                  plan for a 3–5 minute submission video.
                </p>
                <div>
                  <button className="primary" onClick={startDemo}>
                    <Play size={16} />
                    Start guided demo
                  </button>
                  <button className="ghost" onClick={beginRecord} disabled={recording}>
                    <Video size={16} />
                    {recording ? 'Recording in progress' : 'Record your screen'}
                  </button>
                </div>
              </div>
              <div className="demo-orbit">
                <Aperture size={110} />
                <div className="demo-orbit-ring" />
                <span>
                  ACQUIRE
                  <br />
                  <b>TRACK</b>
                  <br />
                  RECOVER
                </span>
              </div>
            </div>
            <div className="demo-guide-grid">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <BookOpen size={18} />
                    <h2>Your recording sequence</h2>
                  </div>
                  <span className="quiet-tag">03:30 TOTAL</span>
                </div>
                <div className="demo-chapters">
                  {[
                    [
                      '00:00 – 00:30',
                      'Explain the problem',
                      'Mobile optical links need a coarse camera loop to find and retain a designated beacon before fine pointing.',
                    ],
                    [
                      '00:30 – 01:00',
                      'Introduce AXIOM',
                      'Show the scene, camera feed and stack. Explain that this is a software-only prototype with a classical baseline.',
                    ],
                    [
                      '01:00 – 02:10',
                      'Run the guided demonstration',
                      'Start the automatic sequence. Point out signature verification, decoys, disturbance effects and recovery after dropout.',
                    ],
                    [
                      '02:10 – 02:50',
                      'Show evidence',
                      'Open Telemetry, inspect event transitions, save the run and export its report. Explain angular error and visibility-conditioned retention.',
                    ],
                    [
                      '02:50 – 03:30',
                      'Explain delivery and next steps',
                      'Show Architecture. Cover the executable, source, report and manual. Describe CNN training and Python/FastAPI integration as planned work.',
                    ],
                  ].map(([t, h, b]) => (
                    <div key={t}>
                      <time>{t}</time>
                      <span>
                        <b>{h}</b>
                        <p>{b}</p>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="panel demo-checklist">
                <span className="eyebrow">BEFORE YOU PRESS RECORD</span>
                <h3>A clean presentation.</h3>
                {[
                  'Use a desktop browser at 1440 × 900 or larger.',
                  'Close unrelated tabs and notifications.',
                  'Choose this tab or window in the screen-share picker.',
                  'Use presenter view for a larger simulation scene.',
                  'Record narration separately or with your system recorder.',
                  'State that metrics come from synthetic browser runs.',
                ].map((s) => (
                  <div key={s}>
                    <CheckCircle2 size={17} />
                    <span>{s}</span>
                  </div>
                ))}
                <p className="scope-note">
                  The in-app recorder captures video only. Your browser will ask which tab
                  or window to share. If unavailable, use macOS screen recording or OBS.
                </p>
                <button
                  className="ghost"
                  onClick={() =>
                    exportFile(DEMO_SCRIPT, 'AXIOM-demo-narration.md', 'text/markdown')
                  }
                >
                  <Download size={16} />
                  Download narration script
                </button>
              </section>
            </div>
          </>
        )}
        <footer className="app-footer">
          <span>
            AXIOM <i />A VIRTUAL LAB FOR REAL POSSIBILITIES
          </span>
          <span>
            NAUT IQ / SIH 26169 <i />
            BROWSER PROTOTYPE
          </span>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        </div>
      )}
      {exportOpen && (
        <div className="modal-backdrop" onClick={() => setExportOpen(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Export performance report"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close export dialog"
              onClick={() => setExportOpen(false)}
            >
              <X size={19} />
            </button>
            <span className="eyebrow">REPEATABLE EVIDENCE</span>
            <h2>Take your results with you.</h2>
            <p>
              {selectedRun
                ? selectedRun.name
                : 'Export the current simulation run with its configuration and measured results.'}
            </p>
            <div className="export-options">
              <button onClick={() => doExport('html')}>
                <FileText size={23} />
                <span>
                  <b>Performance report</b>
                  <small>HTML report · print or save as PDF</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
              <button onClick={() => doExport('csv')}>
                <Activity size={23} />
                <span>
                  <b>Frame measurements</b>
                  <small>CSV · sampled time series</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
              <button onClick={() => doExport('json')}>
                <GitBranch size={23} />
                <span>
                  <b>Complete run record</b>
                  <small>JSON · manifest, events and samples</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="modal-note">
              <Info size={15} />
              Simulation measurements, not validated hardware performance.
            </div>
            <button
              className="ghost full"
              onClick={() => {
                saveRun();
                setExportOpen(false);
              }}
            >
              <FolderOpen size={16} />
              Save current run to library
            </button>
          </section>
        </div>
      )}
      {confirmClear && (
        <div className="modal-backdrop">
          <section
            className="modal small-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Clear run library"
          >
            <h2>Clear the local library?</h2>
            <p>
              This removes saved runs from this browser. Export any results you want to
              keep first.
            </p>
            <div className="page-actions">
              <button className="ghost" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={() => {
                  const result = clearRuns();
                  if (!result.ok) {
                    notify(result.message);
                    return;
                  }
                  setConfirmClear(false);
                  notify('Local run library cleared.');
                }}
              >
                Clear saved runs
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  unit,
  description,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
  unit: string;
  description: string;
}) {
  return (
    <section className="metric">
      <div>
        <Icon size={16} />
        <span>{label}</span>
      </div>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      <p>{description}</p>
    </section>
  );
}
function drawSensor(ctx: CanvasRenderingContext2D, f: Frame) {
  const w = f.width,
    h = f.height;
  ctx.strokeStyle = 'rgba(149,171,190,.18)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 15, h / 2);
  ctx.lineTo(w / 2 + 15, h / 2);
  ctx.moveTo(w / 2, h / 2 - 15);
  ctx.lineTo(w / 2, h / 2 + 15);
  ctx.stroke();
  ctx.strokeRect(w / 2 - 25, h / 2 - 25, 50, 50);
  if (f.detected) {
    const d = f.detected,
      r = Math.max(10, d.radius + 4);
    ctx.strokeStyle = f.state === 'TRACK' ? '#f5e600' : '#ffb875';
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    for (const [x, y, sx, sy] of [
      [d.x - r, d.y - r, 1, 1],
      [d.x + r, d.y - r, -1, 1],
      [d.x - r, d.y + r, 1, -1],
      [d.x + r, d.y + r, -1, -1],
    ]) {
      ctx.moveTo(x + sx * 6, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * 6);
    }
    ctx.stroke();
    ctx.font = '7px monospace';
    ctx.fillStyle = '#f5e600';
    ctx.fillText('BEACON 01', Math.min(w - 59, d.x + r + 5), Math.max(15, d.y - r));
  }
}
const DEMO_SCRIPT = `# AXIOM — SIH 26169 video narration\nTeam: Naut IQ / 130473\nTarget length: 3 minutes 30 seconds\n\n## 00:00–00:30 — Problem\nFree-space optical links need precise alignment. For a mobile terminal, the coarse camera stage must find a designated beacon and keep it visible before fine steering can take over. Real optical test setups are expensive.\n\n## 00:30–01:00 — Our proposal\nAXIOM is an offline virtual laboratory for developing coarse alignment algorithms. This browser prototype demonstrates a working classical detector, virtual camera control, disturbances, recovery and independent performance evaluation. The trained AI detector and Python backend are planned integrations.\n\n## 01:00–02:10 — Guided demo\nLaunch the guided demonstration. Point out the synthetic camera feed and temporal signature verification. Observe decoy introduction, motion disturbances, a 2.5 second dropout, coast and reacquisition. The orbital view is conceptual. Camera metrics come from a separate angular simulation and evaluator.\n\n## 02:10–02:50 — Evidence\nOpen Telemetry. Show angular pointing error, confidence and state events. Lock retention conditions on visible eligible frames and includes acquisition. All-frame availability includes hidden intervals. Save the run and export HTML, CSV or JSON.\n\n## 02:50–03:30 — Delivery\nShow Architecture. The complete submission will include a standalone executable, documented source, 10–15 page technical report, user manual and performance logs. Next we will train the small-beacon heatmap CNN, compare it fairly against the baseline, integrate the Python worker and validate offline packaging. Avoid claiming measured hardware performance or unimplemented AI.\n`;
