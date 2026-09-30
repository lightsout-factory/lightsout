# Monorepos

Whole-repository gates can make monorepo runs slower and less reliable. An unrelated broken package can block the pipeline, while coverage is measured across code that the current change never touched.

`package-gates` lets lightsout gate only the packages affected by a run. Each command template runs once per affected package, in parallel, with `{package}` replaced by the package’s `package.json` name:

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

If your workspace packages do not live in `packages/`, set `packages-dir`:

```json
{
  "packages-dir": "apps"
}
```

## How package gates work

**Affected packages are detected automatically.** Lightsout determines package scope from the finished plan and the files agents actually change. To set the scope explicitly, pass `--packages`:

```text
/implement plan.md --packages backend-api,shared
```

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

**Each package gets one standards pack, chosen in this order.** The package's entry in `package-standards-packs` wins. Otherwise the package uses `standards-pack`. When `standards-pack` is unset, lightsout detects one of its own packs from the dependencies in the package's own `package.json`. Files outside the packages directory form the repository root, which always uses `standards-pack`, or detection from the root `package.json`:

```json
{
  "package-standards-packs": {
    "web-app": "lightsout/tanstack-start-app",
    "api": "lightsout/nestjs-app"
  }
}
```

**`standards-pack: false` turns standards off for everything the map does not name.** The repository root and every unnamed package get no standards, while each package that `package-standards-packs` names still gets its pack.

**`standards-rule-settings` stays one layer over every package's pack.** An entry applies to each package whose pack holds the rule and leaves the others alone.

**An agent working across packages reads each topic once.** When the packs differ, the standards an agent receives are grouped under `Applies to:` headings, one for each set of packages, widest first. A rule that holds in fewer packages than its topic carries an `Applies only to:` line. When every topic and rule applies everywhere, there are no headings at all.

**Code checks and the agent review follow the package a file lives in.** A finding is graded with the pack of the package that holds its first file, so one rule can block in one package and only advise in another. Checks that compare packages, such as duplicate-code detection, still read the whole repository.

**The run header and `lightsout standards-check --list` show each package's pack.** The header prints the repository root's pack, then one line for each package whose pack differs from it. The rule list adds an `applies to` column naming the packages each row covers.
