---
summary: "When to write a class instead of functions."
checked: false
severity: advisory
---

## Class Bright Line

Default to functions. Write a class if, and only if, at least one of these holds:

- **(a)** Mutable state persists across method calls: a `RateLimiter` counting its remaining tokens, a cache, a connection pool.
- **(b)** Three or more operations share injected config or dependencies: an `HttpClient` whose base URL, retries and credentials are injected once and used by every method.
- **(c)** Several implementations share one interface: `FileSource` and `S3Source` behind a `RecordSource` contract.
- **(d)** The framework requires it: NestJS services, resolvers and guards, because its dependency injection needs classes.

When none holds, write functions in a module. To check, ask whether "how many of these exist right now?" is a meaningful question: two `HttpClient`s pointed at different APIs, yes, so a class; two `formatDate`s, no, so a function.

Keep a class's methods to behaviour that needs its state. Put other logic in functions rather than instance methods, placed as `private-helper-colocation` and `module-file-to-folder` say: logic that needs no state is easier to read and reuse as a function.
