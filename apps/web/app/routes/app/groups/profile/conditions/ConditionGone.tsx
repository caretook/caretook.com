import { Button } from "~/components/ui";

/** Deleted while open (here or on another device). */
export function ConditionGone({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-3" data-condition-gone="">
      <p>This condition was deleted.</p>
      <div className="flex justify-end">
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
