import type { SavedRun } from './types';

export type ExportFormat = 'json' | 'csv' | 'html';

export function exportFile(
  body: string,
  name: string,
  mimeType: string
): void {
  const url = URL.createObjectURL(
    new Blob([body], { type: mimeType })
  );

  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(value: string): string {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return value.replace(
    /[&<>"']/g,
    character => replacements[character]
  );
}

function formatNumber(
  value: number | undefined,
  decimals = 2
): string {
  return Number.isFinite(value)
    ? value!.toFixed(decimals)
    : '—';
}

function buildJson(run: SavedRun): string {
  return JSON.stringify(
    {
      schema: 'axiom.frontend-run.v1',
      ...run,
      implementation:
        'Browser classical baseline. No trained AI or backend.',
      definitions: {
        retention:
          'Correct target tracked within 0.35 degrees on visible eligible frames, including acquisition.',
        availability:
          'Correct visible lock over all simulation frames.',
        fps:
          'Worker frame delivery rate, not camera hardware FPS.',
        processing:
          'Sensor synthesis, pixel detection, estimation, control and evaluation, excluding transport/UI.',
        coordinates:
          'Synthetic azimuth/elevation in degrees. Orbital view is conceptual.',
      },
    },
    null,
    2
  );
}

function buildCsv(run: SavedRun): string {
  const header =
    'simulation_time_s,pointing_error_deg,signature_confidence_pct,processing_ms,correct_lock';

  const rows = run.samples.map(sample =>
    [
      sample.t,
      sample.error,
      sample.confidence,
      sample.processing,
      sample.locked,
    ]
      .map(value => value.toFixed(5))
      .join(',')
  );

  return [header, ...rows].join('\n');
}

function buildHtml(run: SavedRun): string {
  const metrics = run.metrics;

  const rows: [string, string][] = [
    [
      'Simulation duration',
      `${formatNumber(metrics.duration)} s`,
    ],
    ['Worker FPS', formatNumber(metrics.fps, 1)],
    [
      'Acquisition time',
      metrics.acquisition === null
        ? 'Not acquired'
        : `${formatNumber(metrics.acquisition)} s`,
    ],
    [
      'Mean pointing error',
      `${formatNumber(metrics.meanError, 3)}°`,
    ],
    [
      'Maximum pointing error',
      `${formatNumber(metrics.maxError, 3)}°`,
    ],
    [
      'Visible-frame lock retention',
      `${formatNumber(metrics.retention, 1)}%`,
    ],
    [
      'All-frame lock availability',
      `${formatNumber(metrics.availability, 1)}%`,
    ],
    [
      'Current processing time',
      `${formatNumber(metrics.processing)} ms`,
    ],
    [
      'Processing p95',
      `${formatNumber(metrics.p95)} ms`,
    ],
    ['Losses / recoveries', String(metrics.losses)],
    [
      'Latest reacquisition',
      metrics.reacquisition === null
        ? 'Not observed'
        : `${formatNumber(metrics.reacquisition)} s`,
    ],
  ];

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`
    )
    .join('');

  const eventLog = run.events
    .map(
      event =>
        `<p>${formatNumber(event.time)}s — ${escapeHtml(event.type)}: ${escapeHtml(event.message)}</p>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AXIOM Performance Report</title>
  <style>
    body {
      font: 16px system-ui;
      background: #080e17;
      color: #e8eee9;
      max-width: 900px;
      margin: 50px auto;
      padding: 24px;
    }
    h1 { font-size: 44px; }
    small { color: #f5e600; }
    table { width: 100%; border-collapse: collapse; }
    td, th {
      padding: 13px;
      border-bottom: 1px solid #28333f;
      text-align: left;
    }
    p { line-height: 1.6; color: #9aaab5; }
    pre { white-space: pre-wrap; color: #9aaab5; }
    button { padding: 12px 20px; cursor: pointer; }
    @media print {
      body { background: white; color: black; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <small>NAUT IQ / SIH 26169</small>
  <h1>Simulation performance report</h1>
  <p>
    ${escapeHtml(run.name)}<br>
    ${escapeHtml(new Date(run.date).toLocaleString())}
    / seed ${run.config.seed}
  </p>

  <table>
    <tr>
      <th>Measure</th>
      <th>Observed in this browser run</th>
    </tr>
    ${tableRows}
  </table>

  <h2>Configuration</h2>
  <pre>${escapeHtml(JSON.stringify(run.config, null, 2))}</pre>

  <h2>Event log</h2>
  ${eventLog}

  <h2>Evidence scope</h2>
  <p>
    This report contains measured browser-simulation data.
    It does not establish real FSOC terminal performance.
    The detector is a classical pixel/temporal-signature baseline.
    A trained CNN and Python/FastAPI integration are planned.
    Ground truth is used for rendering and independent evaluation,
    not detector or controller input.
    Retention includes acquisition and is conditioned on visibility.
    All-frame availability includes dropouts.
    The 3D orbital view is conceptual.
    Processing excludes transport and UI rendering.
    Download JSON for configuration and sample evidence.
  </p>

  <button onclick="window.print()">Print / Save PDF</button>
</body>
</html>`;
}

export function exportRun(
  run: SavedRun,
  format: ExportFormat
): void {
  const name =
    `AXIOM-${run.config.seed}-${Math.floor(run.metrics.duration)}s`;

  switch (format) {
    case 'json':
      exportFile(
        buildJson(run),
        `${name}.json`,
        'application/json'
      );
      break;

    case 'csv':
      exportFile(
        buildCsv(run),
        `${name}.csv`,
        'text/csv'
      );
      break;

    case 'html':
      exportFile(
        buildHtml(run),
        `${name}-report.html`,
        'text/html'
      );
      break;
  }
}