---
summary: "Where a feature's hooks live, and why a query hook infers its return type."
checked: false
severity: advisory
---

## TanStack Hooks

Put a custom hook that wraps a query or manages state in the feature's `hooks/` folder.

Leave a hook that wraps a TanStack query to infer its return type, an exception to `explicit-return-type`. That type is a deep generic instantiation, which can be impractical to write out or can even break the compiler.

```typescript
// features/issues/hooks/useIssues.ts
interface Params {
	searchParams: IssuesSearchParams;
}

export const useIssues = ({ searchParams }: Params) => {
	return useSuspenseQuery(issuesQueryOptions({ searchParams }));
};
```
