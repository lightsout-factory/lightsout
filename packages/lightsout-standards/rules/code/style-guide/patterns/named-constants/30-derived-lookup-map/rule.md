---
summary: "Lookup tables built on a named set of values."
checked: false
severity: advisory
---

## Derived Lookup Map

A lookup map is derived when the union is its key type, `Record<LogLevel, string>`, so that every member has an entry. A derived map may share the `const` object's file, as `multi-export`'s exceptions allow, because a change to one always changes the other. A constant that only uses the union, such as a default value or a subset of members, gets its own file, placed as `types-and-interfaces` says.

```typescript
export const LogLevel = {
	Debug: 'debug',
	Info: 'info',
	Error: 'error',
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export const logLevelLabels: Record<LogLevel, string> = {
	[LogLevel.Debug]: 'Debug',
	[LogLevel.Info]: 'Info',
	[LogLevel.Error]: 'Error',
};
```
