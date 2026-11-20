import type { QuickEntryReading, UnitChoices } from "@caretook/data/schema";
import type { QuickEntryCard } from "./quickEntryCards";
import type { DuePass } from "~/lib/duePasses";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { parseQuickEntry } from "@caretook/data/schema";
import { usePassLog } from "~/components/medications";
import { appUrls } from "~/lib/appUrls";
import { useGroup } from "~/lib/group";
import { offerUndo } from "~/lib/passUndo";
import { actionPreview } from "~/lib/quickEntryPreview";
import { recordLine } from "~/lib/recentLines";
import { getSync } from "~/lib/sync";
import { runActions } from "~/lib/sync/quickEntry";
import {
  buildCards,
  canSaveCards,
  cardActions,
  cardsAnnouncement,
  editTarget,
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
  const { medications, providers } = useQuickEntryData(groupId);
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
    () => parseQuickEntry(text, { now: new Date(), timeZone, units, medications, providers, passes }).parts,
    [text, timeZone, units, medications, providers, passes],
  );

  const preview = useMemo(() => {
    const context = {
      units,
      now: new Date(),
      medications: new Map(medications.map((m) => [m.id, m])),
      providers: new Map(providers.map((p) => [p.id, p])),
      passes: new Map(passes.map((p) => [p.id, p])),
    };
    return (reading: QuickEntryReading) => actionPreview(reading.actions[0]!, context);
  }, [units, medications, providers, passes]);
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

  /** Write these cards together; true when they're saved. */
  const write = async (which: readonly QuickEntryCard[]) => {
    const planned = cardActions(which);
    const result = await runActions(
      getSync(),
      groupId,
      planned.map((p) => p.action),
    );
    if (result.ok) return result.ids;
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
      const ids = await write(cards);
      if (ids) {
        recordLine(group.userId, groupId, text);
        reset();
        // "Saved 3 entries · Undo": Undo removes the whole line.
        offerUndo({
          groupId,
          label: savedText(ids.length),
          doseIds: [],
          entryIds: ids,
          place: QUICK_ENTRY_UNDO,
        });
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
      const ids = await write([card]);
      if (!ids?.[0]) return;
      remove(card);
      await navigate(appUrls.entry(groupId, ids[0]));
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
