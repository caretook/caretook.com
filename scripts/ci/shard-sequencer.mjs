// The Vitest sequencer (vitest.config.ts's `sequence.sequencer`): Vitest's own order,
// but its shard step (`--shard=i/n`) balances the files by their past seconds in the
// durations table, and a file with none by count (shards.mjs). Every project's
// files are dealt out together, so the component tests' two zones share the shards.
import { relative } from "node:path";

import { BaseSequencer } from "vitest/node";

import { balanceShards, durationOf, readDurations, shardKey } from "./shards.mjs";

/** A project's name in the table: a browser project's instance, " (chromium)", dropped, as the log prints it apart. */
export const tableProject = (/** @type {string} */ name) => name.replace(/ \([\w-]+\)$/, "");

/**
 * Which of `specs` the shard `index` of `count` runs.
 * @template {{ moduleId: string, project: { name: string, config: { root: string } } }} S
 * @param {S[]} specs @param {{ index: number, count: number }} shard
 * @param {import("./shards.mjs").Durations} table
 * @returns {S[]}
 */
export function shardSpecs(specs, { index, count }, table) {
  /** @type {Map<string, S>} */
  const byKey = new Map();
  const items = specs.map((spec) => {
    const file = relative(spec.project.config.root, spec.moduleId).split("\\").join("/");
    const key = shardKey(spec.project.name, file);
    byKey.set(key, spec);
    return { key, seconds: durationOf(table, tableProject(spec.project.name), file) };
  });
  const keys = balanceShards(items, count)[index - 1] ?? [];
  return keys.map((k) => /** @type {S} */ (byKey.get(k)));
}

export class DurationSequencer extends BaseSequencer {
  /** @param {import("vitest/node").TestSpecification[]} files */
  async shard(files) {
    const { shard } = this.ctx.config;
    if (!shard) return files;
    return shardSpecs(files, shard, readDurations());
  }
}
