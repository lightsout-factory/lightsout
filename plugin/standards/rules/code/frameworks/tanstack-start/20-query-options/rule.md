---
summary: "Where query options are declared, and how their type is written."
checked: false
severity: advisory
requires:
  - module-folder-layout
---

## Query Options

Declare query-options factories in the feature's `queries/` folder. Consistency across repos is worth the folder name.

Leave a factory's return type in `queries/` to inference, an exception to `explicit-return-type`. The inferred `queryOptions` type carries the key and data types that a written annotation would flatten.

```typescript
// features/issues/queries/issuesQueryOptions.ts
interface Params {
	searchParams: IssuesSearchParams;
}

export const issuesQueryOptions = ({ searchParams }: Params) =>
	queryOptions({
		queryKey: [QueryKey.Issues, searchParams],
		queryFn: () => findAllIssuesServerFn({ data: searchParams }),
	});
```
