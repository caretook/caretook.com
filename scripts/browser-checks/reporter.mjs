// The browser checks' Playwright reporter: the same lines the .mjs checks print,
// so browser.sh's trimmed output, silence limit and tally work unchanged.
//
//   ·  <test> › <step> (1.2s)       a passed test.step (log only: keeps the silence limit fed)
//   ✗ <test> › <step>               a failed step, with its error indented below
//   PASS <test> (3.4s)
//   FAIL <test>                     with each error (message, then where) indented below
//   SKIP <test> (smoke)             skipped in smoke mode (or the skip's reason)
//   N/M passed                      the last line: passed of those that ran
//
// Colours are stripped, so the log reads as plain text.

// eslint-disable-next-line no-control-regex
const strip = (s) => String(s ?? "").replace(/\u001b\[[0-9;]*m/g, "");
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;
const indent = (s, by = "  ") =>
  strip(s)
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => by + l)
    .join("\n");
const titleOf = (test) => test.titlePath().slice(3).join(" › ") || test.title;
const out = (line) => process.stdout.write(`${line}\n`);

const errorBlock = (error) => {
  const where = error.location ? `at ${error.location.file.split("/").pop()}:${error.location.line}` : "";
  return [indent(error.message ?? error.value ?? "error"), where && `  ${where}`].filter(Boolean).join("\n");
};

export default class ChecksReporter {
  passed = 0;
  failed = 0;
  skipped = 0;

  printsToStdio() {
    return true;
  }

  onBegin(_config, suite) {
    out(`Running ${suite.allTests().length} tests`);
  }

  onStdOut(chunk) {
    process.stdout.write(strip(chunk));
  }

  onStdErr(chunk) {
    process.stdout.write(strip(chunk));
  }

  onStepEnd(test, _result, step) {
    if (step.category !== "test.step") return;
    const name = `${titleOf(test)} › ${step.titlePath().join(" › ")}`;
    if (step.error) out(`✗ ${name}\n${errorBlock(step.error)}`);
    else out(`·  ${name} (${secs(step.duration)})`);
  }

  onTestEnd(test, result) {
    const name = titleOf(test);
    if (result.status === "skipped") {
      this.skipped++;
      const why = result.annotations.find((a) => a.type === "skip")?.description;
      out(`SKIP ${name} (${why ?? "skipped"})`);
      return;
    }
    if (result.status === "passed") {
      this.passed++;
      out(`PASS ${name} (${secs(result.duration)})`);
      return;
    }
    this.failed++;
    const how = result.status === "timedOut" ? " (timed out)" : "";
    const errors = result.errors.length ? result.errors : [result.error ?? { message: result.status }];
    out(`FAIL ${name}${how}\n${errors.map(errorBlock).join("\n")}`);
  }

  onError(error) {
    this.failed++;
    out(`FAIL ${errorBlock(error).trimStart()}`);
  }

  onEnd() {
    out(`${this.passed}/${this.passed + this.failed} passed`);
  }
}
