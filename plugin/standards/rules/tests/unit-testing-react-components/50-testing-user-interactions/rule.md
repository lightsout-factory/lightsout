---
summary: "Testing what a user does."
checked: false
severity: advisory
---

## Testing User Interactions

`userEvent` is async — create the user in the test and `await` the interaction. The query that locates the interaction target groups with the act (the `userEvent` call), not with arrange:

```typescript
test('calls the dismiss handler when the dismiss button is clicked', async () => {
	const { onDismiss } = setupBanner();
	const user = userEvent.setup();

	const dismissButton = screen.getByRole('button', { name: /dismiss/i });
	await user.click(dismissButton);

	expect(onDismiss).toHaveBeenCalledTimes(1);
});
```

With `fireEvent`, which is synchronous and has no setup object, the same grouping applies: `fireEvent.click(dismissButton);`.
