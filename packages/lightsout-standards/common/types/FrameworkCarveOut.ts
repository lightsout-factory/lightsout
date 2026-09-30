/**
 * The directory rides along because a rule also needs to know which `src/` the
 * mandates apply inside: a monorepo with a NestJS API and a React front end gets
 * each package's own answer rather than the union.
 */
export interface FrameworkCarveOut {
	/** Package directory whose declared dependencies earned these exemptions ('.' for the repo root). */
	directory: string;
	/**
	 * Files the framework resolves by convention, relative to the package's
	 * `src/` — e.g. TanStack Start's `router.tsx` or NestJS's `main.ts`.
	 */
	entryFiles: string[];
	/**
	 * Only what a framework's own documents require, never what a repo prefers.
	 * No framework in the table fills it yet: React mandates no folder structure
	 * and NestJS wires by decorators rather than by directory.
	 */
	exemptFolderNames: string[];
	/** True when the framework mandates kebab-case folders throughout (NestJS). */
	kebabCase: boolean;
	/** Route directory names whose segments are URL-mapped and therefore kebab-case by mandate. */
	routerRoots: string[];
}
