# TanStack Start

How a TanStack Start app is laid out and how its data moves: the framework's own files, a feature's shape, routes, screens, server functions and queries.

The framework names the route files under `routes/`, the generated route tree and the entry files, and decides where they sit, so the layout and naming rules do not judge them. Everything else is laid out as the layout rules say, with these conventions on top:

- A feature is a subject folder at the top of `src/`, such as `src/issues/`.
- A screen is the component a route renders. Its name ends in `Screen`.
- A query options factory's name ends in `QueryOptions`.
- A server function lives in a `server/` folder.
