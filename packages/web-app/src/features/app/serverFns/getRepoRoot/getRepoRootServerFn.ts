import { createServerFn } from '@tanstack/react-start';
import { requireLocalRepoRoot } from '#src/common/utils/requireLocalRepoRoot.ts';

/**
 * Not a `LightsoutReader` method: the root is app configuration rather than
 * run data. It still passes the reader's gate because the path is this
 * machine's disk, which the public site never shows.
 *
 * @throws {NotFoundError} On the public site.
 * @throws {Error} Locally, when no repo was found.
 */
export const getRepoRootServerFn = createServerFn({ method: 'GET' }).handler(async () => ({ repoRoot: requireLocalRepoRoot() }));
