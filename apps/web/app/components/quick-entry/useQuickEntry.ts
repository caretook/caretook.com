import type { QuickEntryReading, UnitChoices, DuePass } from "@caretook/data/schema";
import type { QuickEntryCard, SymptomChoice } from "./quickEntryCards";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { parseQuickEntry, symptomKey } from "@caretook/data/schema";
import { usePassLog } from "~/components/medications";
import { appUrls } from "~/lib/app-shell/appUrls";
import { localTimeZone } from "~/lib/core/format";
import { useGroup } from "~/lib/app-shell/group";
import { offerUndo } from "~/lib/medications/passUndo";
import { eventDraftFor, QUICK_ENTRY_DRAFT } from "~/lib/assistant/quickEntryDraft";
import { recentLineFor, recordLine } from "~/lib/assistant/recentLines";
import { getSync } from "~/lib/sync";
import { inNewTab, runCommand } from "~/lib/assistant/runCommand";
import { runActions } from "~/lib/assistant/quickEntry.sync";
import { useSymptomTypes } from "~/lib/timeline/symptomTypes.sync";
import {
  buildCards,
  canSaveCards,
  cardActions,
  cardsAnnouncement,
  draftCardOf,
  draftSummary,
  editTarget,
  isDraftReading,
  markDraft,
  newItemLine,
  newItemPreview,
  newItemTarget,
  openAfterSave,
  partsForRole,
  pruneCardState,
  savedText,
  withSymptomGates,
} from "./quickEntryCards";
import { commandTarget, GO_TO_AHEAD, IN_NEW_TAB, READER_REFUSAL } from "./quickEntryCopy";
import { closeQuickEntry } from "~/lib/assistant/quickEntryOpen";
import { useQuickEntryData } from "./useQuickEntryData";
import { useQuickEntryPasses } from "./useQuickEntryPasses";
import { pageContextFor, readCommand } from "@caretook/data/domain";
import { actionPreview } from "@caretook/data/schema";

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
  const { pathname, search } = useLocation();
  const { medications, providers, members } = useQuickEntryData(groupId);
  const { passes, dueNow } = useQuickEntryPasses(groupId);
  const symptoms = useSymptomTypes(groupId);
  const passLog = usePassLog(groupId);
  const [text, setTextState] = useState("");
  const [chosen, setChosen] = useState<ReadonlyMap<string, number>>(new Map());
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const [symptomChoices, setSymptomChoices] = useState<ReadonlyMap<string, SymptomChoice>>(new Map());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const timeZone = group.recipient?.timeZone ?? deviceZone();
  // The provider's or medication's page the box is on (none on the timeline): what a line naming none is about.
  const params = useParams();
  const page = useMemo(() => pageContextFor(params), [params]);
  const parts = useMemo(
    () =>
      partsForRole(
        parseQuickEntry(text, {
          now: new Date(),
          timeZone,
          units,
          medications,
          providers,
          passes,
          members,
          symptoms,
          page,
        }).parts,
        group.canWrite,
      ),
    [text, timeZone, units, medications, providers, passes, members, symptoms, page, group.canWrite],
  );

  // A whole line opening a page or a day is a command: it has no save cards, so nothing can reach the runner.
  const command = readCommand(text, { now: new Date(), timeZone: localTimeZone() });
  const isCommand = command !== null;

  // Forget a card's state as soon as its part of the line is gone (adjusted while rendering, so no stale frame).
  const kept = pruneCardState(parts, { chosen, removed, errors, symptoms: symptomChoices });
  if (kept.chosen !== chosen) setChosen(kept.chosen);
  if (kept.removed !== removed) setRemoved(kept.removed);
  if (kept.errors !== errors) setErrors(kept.errors);
  if (kept.symptoms !== symptomChoices) setSymptomChoices(kept.symptoms!);

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
    const practiceName = (id: string) => context.providers.get(id)?.name;
    return (reading: QuickEntryReading) =>
      reading.newItem
        ? newItemPreview(reading.newItem, practiceName)
        : actionPreview(reading.actions[0]!, context);
  }, [units, medications, providers, passes, members, group.userId, timeZone]);
  const titleOf = useCallback((r: QuickEntryReading) => preview(r).title, [preview]);

  // A reader (a viewer, an Easy viewer) gets the box for what writes nothing: their line shows no cards.
  const reader = !group.canLog;
  const cards = useMemo(
    () =>
      isCommand || reader
        ? []
        : markDraft(
            withSymptomGates(buildCards(parts, { chosen, removed }, titleOf), symptoms, symptomChoices),
          ),
    [isCommand, reader, parts, chosen, removed, titleOf, symptoms, symptomChoices],
  );

  /** Why a reader's line has no Save. */
  const refusal = reader && !isCommand && parts.length > 0 ? READER_REFUSAL : "";

  // Announce the cards once typing settles, not on every keystroke.
  const spoken = command
    ? `Go to ${commandTarget(command)}${inNewTab(command) ? `. ${IN_NEW_TAB}` : ""}${command.kind === "day" && command.ahead ? `. ${GO_TO_AHEAD}` : ""}`
    : refusal || cardsAnnouncement(cards, titleOf);
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
    setSymptomChoices(new Map());
  };

  const choose = (card: QuickEntryCard, index: number) => {
    setChosen((m) => new Map(m).set(card.key, index));
    setErrors((m) => {
      const next = new Map(m);
      next.delete(card.key);
      return next;
    });
  };

  /** A symptom card's answer: the catalog's name to use, or null to add the name as typed. */
  const chooseSymptom = (card: QuickEntryCard, use: string | null) => {
    if (!card.symptomDefault) return;
    const answer = { key: symptomKey(card.symptomDefault.typed), use };
    setSymptomChoices((m) => new Map(m).set(card.key, answer));
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

  /** What a card that opens as the draft says: "Opens to finish · Dr. Elena Alvarez · Wed, Nov 25". */
  const draftLine = (card: QuickEntryCard) => {
    if (card.opensDraft && card.reading.newItem) return newItemLine(card.reading.newItem);
    const action = card.reading.actions[0];
    if (!card.opensDraft || action?.type !== "addEvent") return null;
    const names = action.providerIds.flatMap((id) => providers.find((p) => p.id === id)?.name ?? []);
    return draftSummary(names, preview(card.reading).when);
  };

  /**
   * Open a provider event on the new-event page, or a new medication or
   * provider on its Add sheet, filled in: nothing is written until it saves there.
   */
  const openDraft = (card: QuickEntryCard) => {
    if (card.reading.newItem) {
      const target = newItemTarget(card.reading.newItem, groupId);
      return navigate(target.to, { state: target.state });
    }
    const action = card.reading.actions[0];
    if (action?.type !== "addEvent") return;
    return navigate(appUrls.newEntry(groupId, "event"), {
      state: { [QUICK_ENTRY_DRAFT]: eventDraftFor(action) },
    });
  };

  /**
   * Run the line's command (read again, in case midnight passed): open its
   * page or the timeline on its day, here or in a new tab, then close the
   * sheet. Saves and records nothing.
   */
  const go = async () => {
    const target = readCommand(text, { now: new Date(), timeZone: localTimeZone() });
    if (!target || (target.kind === "day" && target.ahead)) return;
    reset();
    setStatus("");
    await runCommand(target, { groupId, pathname, search, navigate });
    closeQuickEntry();
  };

  const save = async () => {
    if (isCommand) return go();
    if (busy || !canSaveCards(cards)) return;
    setBusy(true);
    try {
      // The first provider event opens as a draft; everything else is written first, as one batch.
      const { draft, rest } = draftCardOf(cards);
      const saved = rest.length ? await write(rest) : { ids: [], todos: 0, typed: [] };
      if (saved) {
        recordLine(
          group.userId,
          groupId,
          recentLineFor(
            text,
            cards.map((c) => ({ text: c.text, readings: [c.reading] })),
          ),
        );
        const open = draft ? null : openAfterSave(saved.typed);
        reset();
        // "Saved 3 entries · Undo": Undo removes the whole line (its todos too). A lone draft wrote nothing.
        if (saved.ids.length)
          offerUndo({
            groupId,
            label: savedText(saved.ids.length, saved.todos),
            doseIds: [],
            entryIds: saved.ids,
            place: QUICK_ENTRY_UNDO,
          });
        // The draft opens on the new-event page; else a lone note or event opens on its page (a push: Back returns here).
        if (draft) await openDraft(draft);
        else if (open) await navigate(appUrls.entry(groupId, open));
      }
    } finally {
      setBusy(false);
    }
  };

  const edit = async (card: QuickEntryCard) => {
    // A provider event is finished on the new-event page, a new medication or provider on its Add sheet: Edit opens it there, writing nothing.
    if (isDraftReading(card.reading) || card.reading.newItem) {
      if (card.blocking.length) return;
      remove(card);
      await openDraft(card);
      return;
    }
    const target = editTarget(card.reading.actions[0]!, groupId, search, card.reading.asksAmount);
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
    command,
    preview,
    draftLine,
    errors,
    status,
    refusal,
    busy,
    announcement,
    canSave: canSaveCards(cards) && !busy,
    choose,
    chooseSymptom,
    remove,
    save,
    edit,
    clear: reset,
    medications,
    providers,
    passes,
    dueNow: reader ? [] : dueNow,
    givePass,
    passError: passLog.error,
    passBusy: passLog.busy,
  };
}
