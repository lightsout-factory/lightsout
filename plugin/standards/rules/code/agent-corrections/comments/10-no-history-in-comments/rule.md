---
summary: "Where the history of the code belongs."
checks: agent
severity: advisory
---

## No History In Comments

A comment describes the code as it is now. Never record history in one: no dates of past events, no measurements or run counts, no ticket ids, and no account of an earlier design or why it changed. Put that in the commit message, the pull request or the ticket.

A date or number the code depends on today is not history, and it stays: a vendor's retirement date for an API, or a limit an agreement sets.

Nothing updates a note about the past when the code changes, so it goes stale and misleads the next reader.
