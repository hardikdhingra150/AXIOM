# AXIOM — Virtual FSOC Laboratory

Frontend demonstration for SIH problem statement **26169**. Team **Naut IQ / 130473**.

## Run locally

Requirements: Node.js 20.9 or newer and npm. Dependencies are already installed in this workspace.

```sh
cd /Users/hardik/Desktop/SIH_26169/frontend
npm run dev
```

Open **http://127.0.0.1:3000**. A production build is also available:

```sh
npm run build
npm run start
```

For a clean checkout use `npm ci` first. All runtime assets are bundled locally. No CDN, cloud login, paid API or optical hardware is needed. The server binds to loopback only. A static export requires configuring an appropriate deployment host and testing the worker asset paths.

## What you can demonstrate

- Smooth Three.js orbital overview with terminal models, optical line of sight and orbit navigation. This view is conceptual, not an orbital-mechanics simulation.
- Independent 320 × 240 synthetic grayscale camera feed.
- Pixel-based bright-spot extraction, weighted centroid and temporal signature verification. The designated beacon uses a 2.5 Hz modulation signature; decoys use different signatures.
- Constant-velocity alpha-beta estimation and bounded proportional control with velocity feed-forward. No trained AI model or full PID implementation is claimed.
- SEARCH, ACQUIRE, TRACK, COAST and REACQUIRE states. Search sweeps the configured synthetic angular region. Identity is reconfirmed after measurement loss.
- Configurable targets, seed, FOV, angular speed, image noise, exposure blur and platform vibration. Atmospheric disturbance applies only to atmospheric scenarios.
- Real synthetic acquisition, pointing error, frame rate, processing time, correct lock retention, all-frame availability, lock-loss count and reacquisition interval.
- Current and saved-run HTML reports, CSV time series and JSON manifests/events. HTML reports include a print/save-PDF button.
- Local run library with up to 30 saved runs, initial and final configuration, sampled frame history and intervention event logs.
- Guided 64-second demonstration, presenter mode, screen recording and a downloadable 3:30 narration plan.
- Responsive layouts, keyboard focus styles, modal focus trapping, error handling and a WebGL fallback.

## Video workflow

1. Open Demo guide and read the recording sequence.
2. Use Chrome or Edge at 1440 × 900 or larger. Disable unrelated notifications.
3. Click **Record demo** and choose this tab/window in the browser picker. This is user-controlled screen sharing, with no uploads. The recorder captures video only. Use a system recorder or OBS if narration audio must be recorded together.
4. Introduce the PS and prototype for about one minute.
5. Click **Start guided demo**. It runs acquisition, decoys, disturbance injection, a 2.5 second dropout, recovery and stabilisation, then pauses and saves the run.
6. Open Telemetry. Show the event log, correct-lock metrics and angular error.
7. Export a report, then show Architecture and the planned AI/backend integration.
8. Stop recording to download WebM or MP4, depending on browser support.

The application cannot bypass browser screen-sharing permissions. Screen recording requires a compatible browser and a secure context; localhost qualifies. Native macOS screen recording is a fallback.

## Architecture

```
Next.js / React UI
 ├─ Three.js conceptual scene
 ├─ Canvas camera feed + SVG plots
 ├─ localStorage run catalogue
 └─ module Web Worker
     ├─ deterministic angular trajectories / sensor projection
     ├─ disturbance and spot synthesis
     ├─ pixel detector / temporal identity / alpha-beta estimator
     ├─ bounded camera steering and recovery
     └─ independent evaluator / event log / transferable RGBA frame
```

The detector's `perceive(pixels)` receives only the grayscale frame. Target ground truth is used for rendering and subsequent evaluation, not candidate selection or control. The interface observes the loop and sends configuration commands.

## Metric definitions

- **Acquisition:** time to the first accepted temporal identity signature. This is not a full alignment-dwell acquisition definition.
- **Coarse aligned:** correct tracked target, error under 0.35°, maintained for more than 0.35 seconds. No hardware handoff occurs.
- **Pointing error:** Euclidean azimuth/elevation separation in synthetic degrees. It is an approximation to spherical line-of-sight angular separation and is suitable only within this small-angle setup.
- **Lock retention:** correctly tracked eligible visible frames below the angular tolerance divided by all eligible visible frames, including acquisition.
- **All-frame availability:** correct lock divided by all simulation frames, including occlusion and initial acquisition.
- **Processing:** worker sensor synthesis, perception, estimation, control and evaluation. Transport and UI rendering are excluded. Current processing and the p95 of the latest 600 samples are reported.
- **Worker FPS:** measured frame delivery rate for the active interval. Simulated time advances in fixed 1/30 s steps; browser scheduling can make wall time differ.
- **Reacquisition:** interval from the declared lock loss (seven missed frames) to the next accepted signature. There is a grace interval before loss declaration.

Run JSON includes the current configuration, the initial configuration, intervention events, software evidence scope and sampled time series. Export samples are taken about five times per simulated second, not every rendered frame. The Repeat setup action restores the initial manifest and seed. Mid-run interventions must be repeated manually from the event log. Timing measurements are hardware-dependent.

## Scope and integration path

This is a polished, buildable **frontend prototype with a working classical browser simulation**, not a validated production FSOC terminal system. It does not train or run a CNN, model real orbital propagation, provide calibrated atmospheric physics, control hardware, or validate communication throughput. No measured performance from this browser is presented as ISRO compliance. The official missing parameter/evaluation tables still require confirmation.

The full solution can integrate:

1. Python / NumPy / SciPy / OpenCV authoritative simulation and validated optics.
2. FastAPI / Pydantic / WebSockets configuration and telemetry.
3. Scene-split PyTorch heatmap detector training with ONNX Runtime inference.
4. Comparative baselines, calibration, bounded PID or other justified controllers.
5. Electron desktop packaging, SQLite run records and clean-machine tests.

The UI contract is defined in `lib/types.ts`. Replace the Web Worker transport with the backend telemetry connection while preserving independent evaluation.

## Check the implementation

```sh
npm test
npm run typecheck
npm run build
```

Tests exercise projection/inverse consistency, deterministic sensor replay, empty-frame detection, identity selection despite brighter decoys and dropout recovery. The browser walkthrough also checks controls, reports and responsive layout. Tests establish prototype behavior, not hardware validity.

## Files

- `components/MissionControl.tsx`: application pages, recording, local records and exports.
- `components/OrbitalScene.tsx`: smooth Three.js context view.
- `components/Chart.tsx`: plots of measured samples.
- `public/simulation-engine.mjs`: testable pixel/temporal baseline and evaluator.
- `public/simulation-worker.js`: authoritative timed loop.
- `lib/types.ts`: typed configuration and telemetry.
- `app/globals.css`: dark orbital theme adapted from the supplied reference, without pixel art.

The design and implementation use original code. The supplied orbital HTML was treated as visual reference, not as application instructions. Dependencies retain their respective licences. Research links are in Architecture.

## Visual direction
AXIOM follows the supplied orbital reference: near-black #05060a, yellow #f5e600, pink #ff2e63, Bebas Neue display type and Space Mono instrument labels. Fonts are hosted locally under their included SIL Open Font Licenses. The procedural Three.js Earth is a conceptual visualization, not geospatial imagery. Older browser-storage keys are retained internally so existing saved runs survive the rename.

## Routes
`/` is the public AXIOM landing page, with the mission overview and workflow. `/lab` opens the complete simulation application. The AXIOM logo in the lab returns to the landing page.
