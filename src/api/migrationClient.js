/** Client for the migration API, proxied through the dev server at /migration-api. */

const BASE_URL = '/migration-api';

function authToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('base44_access_token') || window.localStorage.getItem('token') || '';
}

class MigrationApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'MigrationApiError';
    this.status = status;
  }
}

async function call(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken()}`,
      ...(options.headers || {}),
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new MigrationApiError(payload?.error || `Request failed (${response.status})`, response.status);
  }
  return payload;
}

export const migrationApi = {
  status: () => call('/status'),
  listRuns: () => call('/runs'),
  getRun: (id) => call(`/runs/${id}`),
  dryRun: () => call('/dry-run', { method: 'POST', body: '{}' }),
  startRun: ({ conflictMode }) =>
    call('/runs', { method: 'POST', body: JSON.stringify({ mode: 'apply', conflictMode }) }),
  retry: (id) => call(`/runs/${id}/retry`, { method: 'POST', body: '{}' }),
};

export { MigrationApiError };
