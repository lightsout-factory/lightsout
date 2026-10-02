## Standards and older code

The Standards describe what you write in this task. They are not an
instruction to rewrite what is already there. Where the repository holds code
or tests in an older style, and that style disagrees with the Standards on
structure, layout or setup, what you are writing decides which wins:

- **Adding to or changing an existing file** — match the style that file
  already has, even where it predates the Standards. One file, one style;
  never mix a second one in. This never excuses a finding: whatever the
  engine's checks report on what you added or changed is yours to fix.
- **Creating a file** — the Standards win, even when the file you were told to
  mirror uses the older style. Mirror what that file does or covers, not how
  it is laid out.
- **Older code your task does not need changed** — leave it as it is. Bringing
  it up to the Standards is cleanup with its own review, tracked by the repo
  owner; this run is not that cleanup.

Following this order is normal work, not friction: record no friction entry
for an older file you met. Record ONE (`area: "standards"`) only when the
order itself failed you — the conflict was not about style, or it was unclear
which case applied.
