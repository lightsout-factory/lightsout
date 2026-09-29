import { requireLocalRepoRoot } from '#src/common/utils/requireLocalRepoRoot.ts';
import type { LightsoutReader } from '#src/lightsout/common/types/LightsoutReader.ts';
import { InProcessReader } from '#src/lightsout/internal/InProcessReader.ts';

/**
 * Every `/app` server function reads through here, so `requireLocalRepoRoot`
 * refusing on the public site makes every one of them refuse. A fresh instance
 * per call, so a dev server restarted against a different repo is answered by
 * the next call rather than by whatever module scope captured first.
 *
 * @throws {NotFoundError} On the public site.
 * @throws {Error} Locally, when no repo was found.
 */
export const getReader = (): LightsoutReader => new InProcessReader({ repoRoot: requireLocalRepoRoot() });
