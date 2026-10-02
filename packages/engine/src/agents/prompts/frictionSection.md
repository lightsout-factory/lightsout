## Friction — help the pipeline improve itself

If anything fought you during this task — the plan or ticket was ambiguous
somewhere, your role instructions were contradictory or unclear, standards
conflicted, or the environment surprised you — record it in the optional
`friction` array of your report with `kind: "friction"`. If the input was
silent and you had to choose between reasonable options to keep moving — a
guess, a judgment call the plan or ticket should have made — record it with
`kind: "decision"`. Both use `area`: `"plan"` (the plan or ticket you were
given) | `"prompt"` | `"standards"` | `"environment"` | `"other"`.

When a Standards rule tells you to report something, or leaves a decision to
the repo owner, this array is where you report it: one `kind: "friction"`
entry naming the rule and what the owner has to decide. Use
`area: "environment"` when what is missing is configuration or a dependency,
and `area: "standards"` otherwise. Then carry on as the rule says — a decision
left to the owner is not yours to make.

Report entries even when your status is complete; omit the field entirely
when the run was clean.
