import { Info } from "lucide-react";
import { ICON, ICON_LG, ICON_SM, LINK, TITLE_PAGE, TITLE_SECTION, TITLE_SUB } from "~/components/ui";
import { Example } from "../Example";

export function TokensSection() {
  return (
    <div className="space-y-4">
      <Example label="The heading scale: page, section and sub-heading">
        <div className="space-y-1">
          <p className={TITLE_PAGE}>Page title</p>
          <p className={TITLE_SECTION}>Section or card title</p>
          <p className={TITLE_SUB}>Sub-heading</p>
        </div>
      </Example>
      <Example label="Text tones on the page and on a card">
        {(["bg-base-200", "bg-base-100"] as const).map((surface) => (
          <div key={surface} className={`${surface} border-base-300 space-y-1 rounded-lg border p-3`}>
            <p>Body text</p>
            <p className="text-muted">text-muted: supporting copy</p>
            <p className="text-faint">text-faint: the quietest text</p>
          </div>
        ))}
      </Example>
      <Example label="Link and icon sizes (small, default, large)">
        <a href="#tokens" className={LINK}>
          An inline link
        </a>
        <Info className={ICON_SM} aria-hidden="true" />
        <Info className={ICON} aria-hidden="true" />
        <Info className={ICON_LG} aria-hidden="true" />
      </Example>
    </div>
  );
}
