---
summary: "How a class takes its arguments and declares its methods."
checked: false
severity: advisory
---

## Class Syntax

- The constructor takes one object argument, destructured, typed by a `ConstructorParams` interface.
- An instance method types its argument with an inline object type, not a separate interface. The signature stays self-contained, and interface files don't pile up.
- A public method of an exported class declares its return type. A `private` method infers it, as a non-exported function does (`explicit-return-type`).

```typescript
interface ConstructorParams {
	name: string;
	isActive?: boolean;
}

export class Person {
	private readonly name: string;
	private isActive: boolean;

	constructor({ name, isActive = true }: ConstructorParams) {
		this.name = name;
		this.isActive = isActive;
	}

	setActiveStatus({ status }: { status: boolean }): void {
		this.isActive = status;
	}
}
```
