---
summary: "When to write a class instead of functions."
checks: both
severity: advisory
example:
  kind: repo
  focus:
    fail: src/pricing/PriceFormatter.ts
    pass: src/rate/RateLimiter.ts
---

## Prefer Functions

Default to functions. Write a class if, and only if, at least one of these holds:

- **(a)** Mutable state persists across method calls: a `RateLimiter` counting its remaining tokens, a cache, a connection pool.
- **(b)** Three or more operations share injected config or dependencies: an `HttpClient` whose base URL, retries and credentials are injected once and used by every method.
- **(c)** Several implementations share one interface: `FileSource` and `S3Source` behind a `RecordSource` contract.
- **(d)** The framework requires it: NestJS services, resolvers and guards, because its dependency injection needs classes.

When none holds, write functions in a module. To check, ask whether "how many of these exist right now?" is a meaningful question: two `HttpClient`s pointed at different APIs, yes, so a class; two `formatDate`s, no, so a function.

Two shapes never pass that test:

- A class with only static members. It is a module in disguise: it adds a `ClassName.` prefix to every call and binds no state. Write module functions instead.
- A stateless class with one method, such as `class ReportGenerator { execute() }`. Write the function.

A class that is decorated, is abstract, or implements or extends another type is not one of these shapes; the four criteria above judge it.

Keep a class's methods to behaviour that needs its state. Put other logic in functions rather than instance methods: logic that needs no state is easier to read and reuse as a function.
