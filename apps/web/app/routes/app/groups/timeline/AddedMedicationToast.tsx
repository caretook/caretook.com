import { useEffect, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router";
import { dismissToast, toast } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import {
  addedNoticeAt,
  addedNoticeSnapshot,
  addedNoticeText,
  clearAddedNotice,
  followLocation,
  subscribeAddedNotice,
} from "~/lib/medications/addedNotice";

const noNotice = () => null;

/**
 * After the Dose sheet's quick add: the toast "Added Ibuprofen · Add details"
 * once the sheet has closed, for about 10 s or until the next navigation
 * (`lib/medications/addedNotice.ts` keeps that time, so the toast has none of
 * its own). Add details opens the new medication's edit sheet, for its
 * strength, directions and the rest. The timeline mounts it beside its
 * sheets; it draws nothing itself.
 */
export function AddedMedicationToast({ groupId }: { groupId: string }) {
  const notice = useSyncExternalStore(subscribeAddedNotice, addedNoticeSnapshot, noNotice);
  const { pathname, key } = useLocation();
  const navigate = useNavigate();
  const shown = notice ? addedNoticeAt(groupId, { pathname, locationKey: key }) : null;

  useEffect(() => {
    if (notice) followLocation(groupId, { pathname, locationKey: key });
  }, [notice, groupId, pathname, key]);

  // Clears itself when its time is up.
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => clearAddedNotice(shown.key), Math.max(0, shown.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [shown]);

  // The toast, while the notice is shown: one per notice (its key).
  const shownKey = shown?.key;
  const medicationId = shown?.medicationId;
  const text = shown ? addedNoticeText(shown) : null;
  useEffect(() => {
    if (!shownKey || !medicationId || !text) return;
    const id = toast({
      message: text,
      action: {
        label: "Add details",
        onAction: () => {
          clearAddedNotice(shownKey);
          void navigate(appUrls.editMedication(groupId, medicationId, "list"));
        },
      },
      timeout: null,
      data: { "data-added-medication": medicationId },
    });
    return () => dismissToast(id);
  }, [shownKey, medicationId, text, groupId, navigate]);

  return null;
}
