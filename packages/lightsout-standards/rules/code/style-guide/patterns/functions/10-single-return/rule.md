---
summary: "Where a function returns its result."
checked: false
severity: advisory
---

## Single Return

In business logic, return once, at the end. Guard clauses at the top may return early for validation and null checks.

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

One return gives the result one place to be found, and a step every path shares, such as a floor, a wrapper or a log, is written once instead of forgotten in one branch.
