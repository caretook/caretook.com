import type { FilterSection } from "~/components/ui";

import { useState } from "react";
import { useLocation } from "react-router";
import { FilterMenu, FilterMenuChips, SearchFilterBar } from "~/components/ui";
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

/** `search` with `q` as its text, the rest kept. */
const withQuery = (search: string, q: string) => {
  const params = new URLSearchParams(search);
  if (q.trim()) params.set("q", q.trim());
  else params.delete("q");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
};

export function FilterMenuSection() {
  const { search } = useLocation();
  const [text, setText] = useState("");
  const filters = { label: "Filter to-dos", sections: [statusFilter(search)], clear: "" };
  return (
    <>
      <Example label="The button with its count, and the chips">
        <FilterMenu {...filters} />
        <FilterMenuChips {...filters} />
      </Example>
      <Example label="Every list page's search and filter bar">
        <SearchFilterBar
          searchLabel="Search to-dos"
          value={text}
          urlQuery={new URLSearchParams(search).get("q") ?? ""}
          onChange={setText}
          withQuery={withQuery}
          filters={() => ({ ...filters, clear: withQuery("", text) })}
        />
      </Example>
    </>
  );
}
