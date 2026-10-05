---
summary: "Where a function returns its result."
checks: deterministic
severity: advisory
---

## Single Return

Return once, at the end of the function. Guard clauses at the top may return early for validation and null checks.

```typescript
export const calculateShippingCost = ({ weightKg, isExpress, destination }: Params): number => {
	let cost = weightKg * destination.ratePerKg;

	if (isExpress) {
		cost += destination.expressSurcharge;
	}

	// The minimum-charge floor applies to every path, so it is written once.
	if (cost < destination.minimumCharge) {
		cost = destination.minimumCharge;
	}

	return cost;
};
```

A `switch` assigns in each case, and the function returns after it. When a `switch` only maps one value to another, use a lookup map instead.

One return gives the result one place to be found, and a step every path shares, such as a floor, a wrapper or a log, is written once instead of forgotten in one branch.
