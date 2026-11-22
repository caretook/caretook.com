import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router";
import { Toast } from "~/components/ui";
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
 * After the Dose sheet's quick add: "Added Ibuprofen · Add details" once the
 * sheet has closed, for about 10 s or until the next navigation
 * (`lib/medications/addedNotice.ts`). Add details opens the new
 * medication's edit sheet, for its strength, directions and the rest. The
 * timeline mounts it beside its sheets. The last notice stays rendered
 * while the toast fades out.
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

  // The last notice shown, kept for the toast's exit.
  const [last, setLast] = useState(shown);
  if (shown && shown !== last) setLast(shown);

  if (!last) return null;
  return (
    <div data-added-medication={shown ? last.medicationId : undefined}>
      <Toast
        open={!!shown}
        message={addedNoticeText(last)}
        actionLabel="Add details"
        onAction={() => {
          clearAddedNotice(last.key);
          void navigate(appUrls.editMedication(groupId, last.medicationId, "list"));
        }}
      />
    </div>
  );
}
