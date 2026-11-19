import { useEffect, useState } from "react";
import { historyCutoff } from "~/lib/upcoming";

// A margin past each minute's turn, so the new cutoff is always the next one.
const AFTER_MS = 50;

/**
 * Where the timeline's history ends, as ISO 8601 (`historyCutoff`: the end
 * of the current minute), moving on as each minute turns. `loaded` is the
 * loader's cutoff, so the first render reads the loader's rows; the later of
 * the two wins. Between turns it stays the same, so the queries built on it
 * change once a minute, and an item whose time passes crosses from the
 * Upcoming block and the Next strip into the history without a reload.
 */
export function useHistoryCutoff(loaded: string): string {
  const [ticked, setTicked] = useState(loaded);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const turn = new Date(historyCutoff(new Date())).getTime();
      timer = setTimeout(
        () => {
          setTicked(historyCutoff(new Date()));
          schedule();
        },
        turn - Date.now() + AFTER_MS,
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return ticked > loaded ? ticked : loaded;
}
