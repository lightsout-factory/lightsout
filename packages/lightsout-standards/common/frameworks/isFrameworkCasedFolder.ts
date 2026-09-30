import type { FrameworkCarveOut } from '../types/FrameworkCarveOut.ts';
import { isUnderRouterRoot } from './isUnderRouterRoot.ts';

interface Params {
	/** A repo-relative folder path. */
	folder: string;
	/** The carve-out of the package that governs this folder. */
	carveOut: FrameworkCarveOut;
}

/**
 * NestJS mandates kebab-case throughout, and a router root's segments become
 * URL path segments and are therefore kebab-case by mandate.
 */
export const isFrameworkCasedFolder = ({ folder, carveOut }: Params): boolean => carveOut.kebabCase || isUnderRouterRoot({ path: folder, carveOut });
