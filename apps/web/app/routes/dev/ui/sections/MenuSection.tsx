import { ArrowUpDown, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Menu, SEPARATOR, TOOL_CIRCLE } from "~/components/ui";
import { Example } from "../Example";

export function MenuSection() {
  const [sort, setSort] = useState("newest");
  return (
    <>
      <Example label="Actions, a separator and a danger item">
        <Menu
          label="Note actions"
          title="Note actions"
          className={TOOL_CIRCLE}
          items={[
            { id: "edit", label: "Edit", icon: Pencil, onAction: () => undefined },
            SEPARATOR,
            { id: "delete", label: "Delete", icon: Trash2, tone: "danger", onAction: () => undefined },
          ]}
        >
          <EllipsisVertical className="size-4" aria-hidden="true" />
        </Menu>
      </Example>
      <Example label="A section with single selection">
        <Menu
          label="Sort"
          title="Sort"
          className={TOOL_CIRCLE}
          items={[
            {
              type: "section",
              id: "sort",
              title: "Sort by",
              selection: { selected: sort, onChange: setSort },
              items: [
                { id: "newest", label: "Newest first" },
                { id: "oldest", label: "Oldest first" },
              ],
            },
          ]}
        >
          <ArrowUpDown className="size-4" aria-hidden="true" />
        </Menu>
      </Example>
    </>
  );
}
