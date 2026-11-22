import type { FilterSection } from "~/components/ui";

import { useLocation } from "react-router";
import { FilterMenu, FilterMenuChips } from "~/components/ui";
import { Example } from "../Example";

/** A status filter read from `?status=`, as a list screen builds it. */
const statusFilter = (search: string): FilterSection => {
  const current = new URLSearchParams(search).get("status") ?? "all";
  return {
    id: "status",
    title: "Status",
    defaultId: "all",
    current,
    options: [
      { id: "all", label: "All", search: "" },
      { id: "open", label: "Open", search: "?status=open" },
      { id: "done", label: "Done", search: "?status=done" },
    ],
  };
};

export function FilterMenuSection() {
  const { search } = useLocation();
  const filters = { label: "Filter to-dos", sections: [statusFilter(search)], clear: "" };
  return (
    <Example label="The button with its count, and the chips">
      <FilterMenu {...filters} />
      <FilterMenuChips {...filters} />
    </Example>
  );
}
