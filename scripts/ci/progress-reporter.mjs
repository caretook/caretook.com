// A Vitest reporter for CI test steps (test-job.mjs adds it): it records the files
// each run started and finished in <report>.progress.json beside the report, and
// a per-file watchdog stops the run when one file runs past FILE_LIMIT_SECONDS
// (CARETOOK_CI_FILE_LIMIT overrides it), naming that file in `timedOut`, well
// before the job's own limit cancels it with nothing reported. verdict.mjs reads
// the file: the files a run left unfinished are its `hung` files, failed by name.
//
// Off unless CARETOOK_CI_PROGRESS names the file. Imports only node built-ins.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";

/** Past this a file is hung: the slowest component files take about a minute. */
export const FILE_LIMIT_SECONDS = 300;

/** Where a report's progress goes: beside it. */
export const progressFileOf = (/** @type {string} */ out) => out.replace(/\.json$/, ".progress.json");

/**
 * @typedef {{ limitSeconds: number, started: string[], finished: string[], failed: string[], timedOut: string[] }} Progress
 */

/**
 * The files a run left hung: those its watchdog stopped, else those it started and
 * never finished (a run killed from outside). [] for a run that ended, or no file.
 * @param {any} progress a parsed progress file, or null
 * @returns {string[]}
 */
export function hungFiles(progress) {
  if (!progress || !Array.isArray(progress.started)) return [];
  if (Array.isArray(progress.timedOut) && progress.timedOut.length) return [...progress.timedOut];
  const finished = new Set(Array.isArray(progress.finished) ? progress.finished : []);
  return progress.started.filter((/** @type {string} */ f) => !finished.has(f));
}

/**
 * @typedef {{ path?: string | null, limitSeconds?: number, root?: string,
 *   write?: (path: string, text: string) => void, log?: (line: string) => void,
 *   exit?: (code: number) => void,
 *   setTimer?: (fn: () => void, ms: number) => unknown, clearTimer?: (timer: unknown) => void }} ReporterIo
 */

const envLimit = () => {
  const n = Number(process.env.CARETOOK_CI_FILE_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : FILE_LIMIT_SECONDS;
};

export default class ProgressReporter {
  /** @param {ReporterIo} [io] */
  constructor(io = {}) {
    this.path = io.path === undefined ? (process.env.CARETOOK_CI_PROGRESS ?? null) : io.path;
    this.root = io.root ?? process.cwd();
    this.write =
      io.write ??
      ((/** @type {string} */ path, /** @type {string} */ text) => {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, text);
      });
    this.log = io.log ?? ((/** @type {string} */ line) => console.error(`progress: ${line}`));
    this.exit = io.exit ?? ((/** @type {number} */ code) => process.exit(code));
    this.setTimer =
      io.setTimer ??
      ((/** @type {() => void} */ fn, /** @type {number} */ ms) => {
        const t = setTimeout(fn, ms);
        t.unref();
        return t;
      });
    this.clearTimer =
      io.clearTimer ?? ((/** @type {unknown} */ t) => clearTimeout(/** @type {NodeJS.Timeout} */ (t)));
    /** @type {Progress} */
    this.progress = {
      limitSeconds: io.limitSeconds ?? envLimit(),
      started: [],
      finished: [],
      failed: [],
      timedOut: [],
    };
    /** @type {Map<string, unknown>} */ this.timers = new Map();
  }

  save() {
    if (this.path) this.write(this.path, `${JSON.stringify(this.progress, null, 2)}\n`);
  }

  onInit() {
    this.save();
  }

  /** @param {{ moduleId: string }} testModule */
  onTestModuleStart(testModule) {
    if (!this.path) return;
    const file = relative(this.root, testModule.moduleId);
    this.progress.started.push(file);
    this.timers.set(
      file,
      this.setTimer(() => this.timeOut(file), this.progress.limitSeconds * 1000),
    );
    this.save();
  }

  /** @param {{ moduleId: string, state: () => string }} testModule */
  onTestModuleEnd(testModule) {
    if (!this.path) return;
    const file = relative(this.root, testModule.moduleId);
    this.clearTimer(this.timers.get(file));
    this.timers.delete(file);
    this.progress.finished.push(file);
    if (testModule.state() === "failed") this.progress.failed.push(file);
    this.save();
  }

  /** A file past its limit: name it, then stop the run before the job's limit does. */
  timeOut(/** @type {string} */ file) {
    this.progress.timedOut.push(file);
    this.save();
    this.log(`${file} has run past ${this.progress.limitSeconds} s: stopping the run (hung)`);
    this.exit(1);
  }
}
