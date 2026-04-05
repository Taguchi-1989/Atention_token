// Same origin when served by FastAPI; override with env var for separate deployment
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

// ── Tasks ──

export async function fetchTasks() {
  const res = await fetch(`${API_BASE_URL}/tasks`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function runTask(taskId: string, baselineId: string, mock: boolean = false) {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseline_id: baselineId, mock }),
  });
  if (!res.ok) throw new Error('Failed to start task');
  return res.json();
}

export async function fetchTaskStatus(taskId: string) {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

// ── Runs ──

export async function fetchRuns(includeMetrics: boolean = false) {
  const res = await fetch(`${API_BASE_URL}/runs?limit=50&include_metrics=${includeMetrics}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch runs');
  return res.json();
}

// ── Baselines ──

export async function fetchBaselines() {
  const res = await fetch(`${API_BASE_URL}/baselines`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch baselines');
  return res.json();
}

export async function createBaseline(data: {
  baseline_id: string;
  model?: string;
  engine?: string;
  temperature?: number;
  system_prompt?: string;
}) {
  const res = await fetch(`${API_BASE_URL}/baselines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create baseline');
  return res.json();
}

export async function deleteBaseline(baselineId: string) {
  const res = await fetch(`${API_BASE_URL}/baselines/${baselineId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete baseline');
  return res.json();
}

// ── Metrics Diff ──

export async function fetchMetricsDiff(taskId: string, baselineA: string, baselineB: string) {
  const params = new URLSearchParams({ task_id: taskId, baseline_a: baselineA, baseline_b: baselineB });
  const res = await fetch(`${API_BASE_URL}/metrics/diff?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch diff');
  return res.json();
}

// ── Dashboard Stats ──

export async function fetchStats() {
  const res = await fetch(`${API_BASE_URL}/stats`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

// ── SUS ──

export async function submitSus(runId: number, responses: number[]) {
  const res = await fetch(`${API_BASE_URL}/sus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run_id: runId, responses }),
  });
  if (!res.ok) throw new Error('Failed to submit SUS');
  return res.json();
}

// ── Config ──

export async function fetchConfig() {
  const res = await fetch(`${API_BASE_URL}/config`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export async function updateConfig(config: { ollama_url: string; model_name: string; temperature: number }) {
  const res = await fetch(`${API_BASE_URL}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to update config');
  return res.json();
}

// ── CSV Export ──

export function getExportCsvUrl(taskId?: string, baselineId?: string): string {
  const params = new URLSearchParams();
  if (taskId) params.set('task_id', taskId);
  if (baselineId) params.set('baseline_id', baselineId);
  const qs = params.toString();
  return `${API_BASE_URL}/export/csv${qs ? `?${qs}` : ''}`;
}

// ── Task Runs (for trend charts) ──

export async function fetchRunsForTask(taskId: string, limit = 100) {
  const res = await fetch(`${API_BASE_URL}/runs?limit=${limit}&include_metrics=true`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch runs');
  const all = await res.json();
  return (all as Array<{ task_id: string }>).filter(r => r.task_id === taskId);
}
