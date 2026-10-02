---
summary: "Where server functions live."
checked: false
severity: advisory
---

## Server Functions

Put server functions in a `serverFns/` folder, in a feature or at app level. A server function becomes a folder only as `module-file-to-folder` says, such as when a GraphQL document is used by it alone:

```
serverFns/
├── countIssuesServerFn.ts        # one file
└── findIssues/                   # a folder: it has a file of its own
    ├── FindIssuesDocument.ts
    └── findIssuesServerFn.ts
```

Every call to the server is then in one place to find.
