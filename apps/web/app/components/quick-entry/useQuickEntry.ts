import type { QuickEntryReading, UnitChoices } from "@caretook/data/schema";
import type { QuickEntryCard } from "./quickEntryCards";
import type { DuePass } from "~/lib/medications/duePasses";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { parseQuickEntry } from "@caretook/data/schema";
import { usePassLog } from "~/components/medications";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { offerUndo } from "~/lib/medications/passUndo";
import { actionPreview } from "~/lib/assistant/quickEntryPreview";
import { recentLineFor, recordLine } from "~/lib/assistant/recentLines";
import { getSync } from "~/lib/sync";
import { runActions } from "~/lib/assistant/quickEntry.sync";
import {
  buildCards,
  canSaveCards,
  cardActions,
  cardsAnnouncement,
  editTarget,
  openAfterSave,
  savedText,
} from "./quickEntryCards";
import { useQuickEntryData } from "./useQuickEntryData";
import { useQuickEntryPasses } from "./useQuickEntryPasses";

/** Where quick entry's Undo is shown (`PassUndoStatus`'s `place`): in the box, under what was saved. */
export const QUICK_ENTRY_UNDO = "quickEntry";

/** How long the cards wait after typing stops before they're announced. */
const ANNOUNCE_DELAY_MS = 800;

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Quick entry's state: the line, its cards (one per part, with the reading
 * chosen for each and the ones removed), Save (every card in one local
 * transaction, then Undo for about 10 s, which removes the whole line) and
 * Edit (the usual sheet, filled in), and the due passes offered as one tap
 * (`givePass`: Given all, with the same Undo). The line is read against the
 * group's medications, passes and providers on this device, in the user's
 * `units` and the recipient's time zone, so it all works offline.
 */
export function useQuickEntry({ groupId, units }: { groupId: string; units: UnitChoices }) {
  const group = useGroup();
  const navigate = useNavigate();
  const { search } = useLocation();
  const { medications, providers, members } = useQuickEntryData(groupId);
  const { passes, dueNow } = useQuickEntryPasses(groupId);
  const passLog = usePassLog(groupId);
  const [text, setTextState] = useState("");
  const [chosen, setChosen] = useState<ReadonlyMap<string, number>>(new Map());
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const timeZone = group.recipient?.timeZone ?? deviceZone();
  const parts = useMemo(
    () =>
      parseQuickEntry(text, { now: new Date(), timeZone, units, medications, providers, passes, members })
        .parts,
    [text, timeZone, units, medications, providers, passes, members],
  );

  const preview = useMemo(() => {
    const context = {
      units,
      now: new Date(),
      medications: new Map(medications.map((m) => [m.id, m])),
      providers: new Map(providers.map((p) => [p.id, p])),
      passes: new Map(passes.map((p) => [p.id, p])),
      members: new Map(members.map((m) => [m.id, { name: m.id === group.userId ? "You" : m.name }])),
      recipientTimeZone: timeZone,
    };
    return (reading: QuickEntryReading) => actionPreview(reading.actions[0]!, context);
  }, [units, medications, providers, passes, members, group.userId, timeZone]);
  const titleOf = useCallback((r: QuickEntryReading) => preview(r).title, [preview]);

  const cards = useMemo(
    () => buildCards(parts, { chosen, removed }, titleOf),
    [parts, chosen, removed, titleOf],
  );

  // Announce the cards once typing settles, not on every keystroke.
  const spoken = cardsAnnouncement(cards, titleOf);
  useEffect(() => {
    const timer = setTimeout(() => setAnnouncement(spoken), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [spoken]);

  const setText = useCallback((value: string) => {
    setTextState(value);
    setErrors(new Map());
    setStatus("");
  }, []);

  /** A due pass in one tap: Given all now, with Undo in the box. */
  const givePass = (pass: DuePass) => {
    setStatus("");
    void passLog.givenAll(pass, { place: QUICK_ENTRY_UNDO });
  };

  const reset = () => {
    setTextState("");
    setChosen(new Map());
    setRemoved(new Set());
    setErrors(new Map());
  };

  const choose = (card: QuickEntryCard, index: number) => {
    setChosen((m) => new Map(m).set(card.key, index));
    setErrors((m) => {
      const next = new Map(m);
      next.delete(card.key);
      return next;
    });
  };

  const remove = (card: QuickEntryCard) => setRemoved((s) => new Set(s).add(card.key));

  /** Write these cards together: what they wrote (and how many are todos), or null when refused. */
  const write = async (which: readonly QuickEntryCard[]) => {
    const planned = cardActions(which);
    const result = await runActions(
      getSync(),
      groupId,
      planned.map((p) => p.action),
    );
    if (result.ok) {
      const todos = planned.reduce(
        (n, p, i) => n + (p.action.type === "addTodo" ? (result.byAction[i]?.length ?? 0) : 0),
        0,
      );
      const typed = planned.map((p, i) => ({ type: p.action.type, ids: result.byAction[i] ?? [] }));
      return { ids: result.ids, todos, typed };
    }
    const key = result.index !== null ? planned[result.index]?.key : undefined;
    const message = result.issues[0]?.message ?? result.error;
    if (key) setErrors(new Map([[key, message]]));
    else setStatus(result.error);
    return null;
  };

  const save = async () => {
    if (busy || !canSaveCards(cards)) return;
    setBusy(true);
    try {
      const saved = await write(cards);
      if (saved) {
        recordLine(
          group.userId,
          groupId,
          recentLineFor(
            text,
            cards.map((c) => ({ text: c.text, readings: [c.reading] })),
          ),
        );
        const open = openAfterSave(saved.typed);
        reset();
        // "Saved 3 entries · Undo": Undo removes the whole line (its todos too).
        offerUndo({
          groupId,
          label: savedText(saved.ids.length, saved.todos),
          doseIds: [],
          entryIds: saved.ids,
          place: QUICK_ENTRY_UNDO,
        });
        // A lone note or event opens on its page (a push: Back returns here).
        if (open) await navigate(appUrls.entry(groupId, open));
      }
    } finally {
      setBusy(false);
    }
  };

  const edit = async (card: QuickEntryCard) => {
    const action = card.reading.actions[0]!;
    const target = editTarget(action, groupId, search);
    if (target === "saveAndOpen") {
      // A note or event is written on its page: save this card and open it there.
      if (card.blocking.length) return;
      const saved = await write([card]);
      if (!saved?.ids[0]) return;
      remove(card);
      await navigate(appUrls.entry(groupId, saved.ids[0]));
      return;
    }
    remove(card);
    await navigate(target.to, { state: target.state, preventScrollReset: true });
  };

  return {
    text,
    setText,
    cards,
    preview,
    errors,
    status,
    busy,
    announcement,
    canSave: canSaveCards(cards) && !busy,
    choose,
    remove,
    save,
    edit,
    clear: reset,
    passes,
    dueNow,
    givePass,
    passError: passLog.error,
    passBusy: passLog.busy,
  };
}
