#!/usr/bin/env node
// A forwarding path, until slice 7 points the core's callers (browser.sh) at the
// engine: the check-areas resolver is Caretook's, at scripts/project/check-areas.mjs.
import { main } from "../project/check-areas.mjs";

process.exit(main(process.argv.slice(2)));
