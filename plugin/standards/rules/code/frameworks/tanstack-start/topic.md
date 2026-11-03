# TanStack Start

How a TanStack Start app is laid out and how its data moves: the framework's own files, the folders it adds to the React layout, routes, screens, server functions and queries.

The framework names the route files under `routes/`, the generated route tree and the entry files, and decides where they sit, so the layout and naming rules do not judge them. Everything else is laid out as the React layout rules say, with the framework's folders on top:

- `routes/`, at the top of `src/`, holds the route files.
- `queries/`, in a feature, holds its query options factories, each named with a `QueryOptions` suffix.
- `server/`, in a feature or at the top of `src/`, holds server functions and the server-only code they use.
