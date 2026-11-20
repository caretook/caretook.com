import type { Tx } from "../db";
import type { AppSettingKey, AppSettingValue, AppSettingValues, LinkLimits, SignupPath } from "../db/schema";
import type { ServiceContext } from "./types";

import { withTransaction } from "../db";
import {
  APP_SETTING_KEYS,
  APP_SETTINGS,
  auditChanges,
  isAppSettingKey,
  linkLimits,
  parseAppSetting,
  SIGNUP_SWITCHES,
  staffReasonZSchema,
  storedOrDefault,
} from "../db/schema";
import { isError, newError } from "../errors";
import { appSettingModel } from "../models";
import * as adminAuditService from "./adminAuditService";
import { auditActorId, staffRefusal } from "./staffAccess";

export const serviceName = "appSetting";
export const schemaName = appSettingModel.schemaName;

// The app settings (admin PRD): what staff change without a deploy. Every
// read goes through `getSetting`, which caches the whole table per process
// for 30 s, so a change takes effect everywhere within a minute without a
// query per request. `setSetting` validates against the registry
// (APP_SETTINGS), writes, and records one audit entry in one transaction,
// then clears this process's cache.

/** How long a process keeps the settings it read. */
export const SETTINGS_CACHE_MS = 30_000;

let cache: { at: number; values: AppSettingValues } | undefined;

const effective = (rows: { key: string; value: unknown }[]): AppSettingValues => {
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(
    APP_SETTING_KEYS.map((key) => [key, storedOrDefault(key, stored.has(key) ? stored.get(key) : undefined)]),
  ) as AppSettingValues;
};

const defaults = () => effective([]);

/**
 * Every setting's current value (defaults for keys never set). Cached per
 * process for `SETTINGS_CACHE_MS`; `now` is for tests. If the table can't be
 * read, the last values (or the defaults) are used: a database hiccup
 * mustn't close sign-up.
 */
export const getSettings = async ({ now = Date.now() }: { now?: number } = {}): Promise<AppSettingValues> => {
  if (cache && now - cache.at < SETTINGS_CACHE_MS) return cache.values;
  const rows = await appSettingModel.all();
  if (isError(rows)) return cache?.values ?? defaults();
  cache = { at: now, values: effective(rows) };
  return cache.values;
};

/** One setting's current value (cached; see `getSettings`). */
export const getSetting = async <K extends AppSettingKey>(
  key: K,
  opts: { now?: number } = {},
): Promise<AppSettingValue<K>> => (await getSettings(opts))[key];

/** Forget the cached values (after a change, and in tests). */
export const clearSettingsCache = () => {
  cache = undefined;
};

/** `settings:signupClosed` when `path`'s switch is off, else null. */
export const signupRefusal = async (path: SignupPath) =>
  (await getSetting(SIGNUP_SWITCHES[path])) ? null : newError({ code: "settings:signupClosed" });

/** The limits new invite links follow (`invites.link*`). */
export const getLinkLimits = async (): Promise<LinkLimits> => {
  const s = await getSettings();
  return linkLimits({
    defaultDays: s["invites.linkDefaultDays"],
    maxDays: s["invites.linkMaxDays"],
    maxUses: s["invites.linkMaxUses"],
  });
};

/** Staff (`settings.read`): every setting with its stored row's details, in registry order. Uncached. */
export const list = async (ctx: ServiceContext) => {
  const refused = staffRefusal(ctx, "settings.read");
  if (refused) return refused;
  const rows = await appSettingModel.all(ctx.tx);
  if (isError(rows)) return rows;
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return APP_SETTING_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      value: storedOrDefault(key, row ? row.value : undefined),
      default: APP_SETTINGS[key].default,
      isDefault: !row,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  });
};

/**
 * Admins (`settings.write`): change one setting, with why. Validated
 * against its schema (`settings:invalid` with the issues), written, and
 * recorded as `setting.set` with `{ [key]: [before, after] }`, in one
 * transaction. Saving the value it already has records nothing new and
 * returns it unchanged.
 */
export const setSetting = async (
  ctx: ServiceContext,
  input: { key: string; value: unknown; reason: string },
) => {
  const refused = staffRefusal(ctx, "settings.write");
  if (refused) return refused;
  const { key } = input;
  if (!isAppSettingKey(key)) return newError({ code: "settings:unknownKey", meta: { key } });
  const reason = staffReasonZSchema.safeParse(input.reason);
  if (!reason.success) return newError({ code: "settings:noReason" });
  const parsed = parseAppSetting(key, input.value);
  if (!parsed.ok) return newError({ code: "settings:invalid", meta: { key, issues: parsed.issues } });

  const result = await withTransaction(async (tx: Tx) => {
    const row = await appSettingModel.getForUpdate(tx, key);
    if (isError(row)) return row;
    const before = storedOrDefault(key, row ? row.value : undefined);
    const changes = auditChanges({ [key]: before }, { [key]: parsed.value }, [key]);
    if (!Object.keys(changes).length) return { key, value: before, changed: false };
    const saved = await appSettingModel.put(tx, key, parsed.value, auditActorId(ctx));
    if (isError(saved)) return saved;
    const recorded = await adminAuditService.record(tx, {
      actorId: auditActorId(ctx),
      action: "setting.set",
      reason: reason.data,
      changes,
    });
    if (isError(recorded)) return recorded;
    return { key, value: parsed.value, changed: true };
  }, ctx);
  clearSettingsCache();
  return result;
};
