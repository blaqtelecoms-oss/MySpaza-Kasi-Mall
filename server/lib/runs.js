/**
 * File-backed run store. Keeping run state on disk (a compose volume) makes
 * the migration resumable across service restarts without writing bookkeeping
 * rows into the target project during a dry run.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_RUNS = 40;

export class RunStore {
  constructor(dir) {
    this.dir = path.resolve(dir);
    fs.mkdirSync(this.dir, { recursive: true });
    this.cache = new Map();
  }

  #file(id) {
    return path.join(this.dir, `${id}.json`);
  }

  create({ mode, conflictMode, phases }) {
    const now = new Date().toISOString();
    const run = {
      id: `run_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      mode,
      conflictMode,
      status: 'queued',
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      phases: phases.map((name) => ({
        name,
        status: 'pending',
        startedAt: null,
        finishedAt: null,
        progress: null,
        summary: null,
        error: null,
      })),
      inventory: null,
      report: null,
      failures: [],
      error: null,
    };
    this.save(run);
    return run;
  }

  save(run) {
    this.cache.set(run.id, run);
    fs.writeFileSync(this.#file(run.id), JSON.stringify(run, null, 2));
    return run;
  }

  get(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const file = this.#file(id);
    if (!fs.existsSync(file)) return null;
    try {
      const run = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.cache.set(id, run);
      return run;
    } catch {
      return null;
    }
  }

  list() {
    if (!fs.existsSync(this.dir)) return [];
    return fs
      .readdirSync(this.dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => this.get(path.basename(name, '.json')))
      .filter(Boolean)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, MAX_RUNS);
  }

  /** Runs that never reached a terminal state (e.g. the service restarted). */
  reconcileInterrupted() {
    for (const run of this.list()) {
      if (run.status === 'queued' || run.status === 'running') {
        run.status = 'interrupted';
        run.error = 'The migration service restarted while this run was in progress. Retry to resume.';
        for (const phase of run.phases) {
          if (phase.status === 'running') phase.status = 'pending';
        }
        this.save(run);
      }
    }
  }
}

export function summarizeRun(run) {
  if (!run) return null;
  return {
    id: run.id,
    mode: run.mode,
    status: run.status,
    conflictMode: run.conflictMode,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    error: run.error,
  };
}
