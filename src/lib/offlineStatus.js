// Reactive shared status for offline mode + sync progress.
// Components subscribe via useOfflineStatus; the offline layer + sync engine update it.

const listeners = new Set();
let state = {
  online: true,
  pending: 0,
  syncing: false,
  conflicts: 0,
};

export function getStatus() {
  return state;
}

export function setStatus(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isOnline() {
  return state.online;
}