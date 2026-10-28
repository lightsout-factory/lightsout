# Monorepos

Whole-repository gates can make monorepo runs slower and less reliable. An unrelated broken package can block the pipeline, while coverage is measured across code that the current change never touched.

Lightsout reads one packages directory, `packages-dir`. Only its direct child folders that contain a `package.json` count as workspace packages.

`package-gates` lets lightsout gate only the packages affected by a run. Each command template runs once per affected package, in parallel, with `{package}` replaced by the `name` in that package's `package.json`:

```json
{
  "package-gates": {
    "check": "pnpm --filter {package} check",
    "test": "pnpm --filter {package} test:unit",
    "test-coverage": "pnpm --filter {package} test:coverage"
  }
}
```

Every template must include `{package}`. Commands that should run identically across the entire repository belong under `gates` instead.

Two kinds of package name appear in configuration, and they differ when a package's folder is not named after its `package.json` `name`:

- `{package}` in a `package-gates` template becomes the `package.json` `name`, such as `@acme/web-app`, because that is what a package manager filter expects.
- `--packages`, a plan's `packages:` list and the keys of `package-standards-packs` take folder names under the packages directory, such as `web-app`.

If your workspace packages do not live in `packages/`, set `packages-dir`:

```json
{
  "packages-dir": "apps"
}
```

## How package gates work

**A run's packages come from the first of these that names any.**

1. The `--packages` flag:

   ```text
   /implement plan.md --packages backend-api,shared
   ```

2. A `packages:` list in the plan's front-matter.
3. Paths in the plan of the form `<packages-dir>/<name>/`, such as `packages/backend-api/src/index.ts`.

When none of them names a package, the run stops before any gate runs, and the error asks you to add a `packages:` list to the plan, pass `--packages`, or name concrete `<packages-dir>/<name>/` paths in the plan. Once the run is going, a package whose files the agents change is added to the scope.

**A package name that does not exist is handled by where it came from.** Names lightsout reads out of the plan's prose are filtered down to directories that exist under the packages directory, and each name it drops is recorded in the run log. A scope you declared yourself — `--packages`, or a `packages:` list in the plan's front-matter — is not filtered: if it names a package that does not exist, the run stops before any gate runs and tells you which packages do exist.

**Packages only run the gates they support.** If a package does not define the script referenced by a template, that gate is skipped for the package and recorded in the run log. Documentation and infrastructure packages do not need placeholder scripts.

**Every package finishes its cheap gates before any package starts an expensive one.** Lightsout runs the type-check, lint and unit gates for every package in scope first, and starts the custom `test-*` suites and the build only once all of them are green. One package's red lint therefore never costs another package its end-to-end suite, and because every cheap gate still runs, all of the cheap failures across every package arrive in one repair report.

**Changes outside the packages directory still get verified.** Package-only changes run the affected-package templates. Root-only changes run the repository-wide commands configured under `gates`. Mixed changes also run only the repository-wide `gates`, rather than the affected-package templates too, because those root commands verify the whole repository.

**Dependent packages can be included.** Use your package manager’s dependent-package filtering syntax when you want changes to a shared package to also verify its consumers. With pnpm, for example:

```json
{
  "package-gates": {
    "check": "pnpm --filter ...{package} check",
    "test": "pnpm --filter ...{package} test:unit",
    "test-coverage": "pnpm --filter ...{package} test:coverage"
  }
}
```

## Standards per package

**Each package gets its standards in this order.** The package's entry in `package-standards-packs` wins. Otherwise the package uses `standards-pack`. When neither names it, the package has no standards. Files outside the packages directory form the repository root, which always uses `standards-pack`.

An entry replaces `standards-pack` for that package rather than adding to it. To give a web package the React rules on top of the general ones, list both:

```json
{
  "standards-pack": "lightsout/standards",
  "package-standards-packs": {
    "web-app": ["lightsout/standards", "lightsout/react"]
  }
}
```

A standards library whose framework packs declare `applies-when` can do this from one pack instead: each conditional pack reaches only the packages whose own `package.json` declares one of the dependencies it lists. See [Register standards libraries](configuration.md#register-standards-libraries). None of the built-in packs is conditional.

**`standards-pack: false` turns standards off for everything the map does not name.** The repository root and every unnamed package get no standards, while each package that `package-standards-packs` names still gets its pack.

**`standards-rule-settings` stays one layer over every package's pack.** An entry applies to each package whose pack holds the rule and leaves the others alone.

**A pack's `exclude` globs read from each package's own root.** A pack's `rule-settings` exclude is matched against a file's path inside its workspace package, so one pack serves every package that uses it; a file outside every package is matched from the repo root. A `standards-rule-settings` exclude is always matched from the repo root.

**An agent working across packages reads each topic once.** A topic is a group of related rules in a standards library, such as its React rules. When the packs differ, the standards an agent receives are grouped under `Applies to:` headings, one for each set of packages, widest first. A rule that holds in fewer packages than its topic carries an `Applies only to:` line. When every topic and rule applies everywhere, there are no headings at all.

**Deterministic checks and the agent review follow the package a file lives in.** The agent review is the part of the standards check where an agent reads your code against the rules that have an agent check. A finding is graded with the pack of the package that holds its first file, so one rule can block in one package and only advise in another. Checks that compare packages, such as duplicate-code detection, still read the whole repository.

**The run header and `lightsout standards-check --list` show each package's pack.** The header prints the repository root's pack, then one line for each package whose pack differs from it. The rule list adds an `applies to` column naming the packages each row covers.
