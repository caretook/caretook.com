import { TriangleAlert } from "lucide-react";
import { Badge } from "~/components/ui";

/**
 * A double dose called out: a warning badge ("Double dose") and the plain
 * text saying when each was given ("Given twice: 8:00 and 8:20"), so it reads
 * without the colour. Today's rows and pass cards, and the medication page.
 */
export function ExtraDoseWarning({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${className}`.trim()}
      data-extra-dose=""
    >
      <Badge tone="warning" icon={TriangleAlert} className="shrink-0" data-extra-dose-badge="">
        Double dose
      </Badge>
      <span data-extra-dose-text="">{text}</span>
    </p>
  );
}
