import type { FrameworkCarveOut } from '../types/FrameworkCarveOut.ts';
import { isUnderRouterRoot } from './isUnderRouterRoot.ts';

interface Params {
	/** Repo-relative path of a test file. */
	test: string;
	/** The carve-out of the package that governs this test. */
	carveOut: FrameworkCarveOut;
}

/**
 * When true, the test's subject is the stem minus the test suffix rather than
 * the first segment: `runs.$runId.unit.test.tsx` names `runs.$runId`, not `runs`.
 *
 * Entry files are deliberately excluded: their names (`main.ts`, `router.tsx`)
 * carry no dots beyond the extension, so the ordinary first-segment rule
 * already resolves them.
 */
export const isFrameworkNamedTest = ({ test, carveOut }: Params): boolean => isUnderRouterRoot({ path: test, carveOut });
