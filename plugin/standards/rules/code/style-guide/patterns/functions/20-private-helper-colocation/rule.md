---
summary: "When a helper may share its caller's file."
checked: false
severity: advisory
---

## Private Helper Colocation

A helper may live in the file of the export it serves while it has no `export` keyword and only this file calls it. The moment a second file needs it, export it and move it where `shared-code-placement` says.

```typescript
interface Params {
	records: ReportRecord[];
}

const sumTotals = ({ records }: { records: ReportRecord[] }) => {
	return records.reduce((total, record) => total + record.amount, 0);
};

export const buildReportSummary = ({ records }: Params): { total: number } => {
	return { total: sumTotals({ records }) };
};
```

Delete a branch of a helper that the export's inputs cannot reach: it is dead code. When covering a helper through the export is impractical, because its inputs are combinatorial, give it its own file and its own tests.
