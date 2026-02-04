export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export async function fetchTasks() {
  const res = await fetch(`${API_BASE_URL}/tasks`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function fetchRuns(includeMetrics: boolean = false) {
  const res = await fetch(`${API_BASE_URL}/runs?limit=50&include_metrics=${includeMetrics}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch runs');
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

export async function submitSus(taskId: string, baselineId: string, responses: number[]) {
  const res = await fetch(`${API_BASE_URL}/sus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId, baseline_id: baselineId, responses }),
  });
  if (!res.ok) throw new Error('Failed to submit SUS');
  return res.json();
}

export async function fetchTaskStatus(taskId: string) {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

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
