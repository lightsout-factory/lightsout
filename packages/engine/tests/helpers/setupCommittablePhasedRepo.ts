import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setupPhasedRepo } from '#tests/helpers/setupPhasedRepo.ts';

/** A phased repo whose own commits can succeed: a repo-level identity, because a CI runner has no global one, and run state kept out of `git add -A`. */
export const setupCommittablePhasedRepo = ({ phases }: { phases: number }) => {
	const phased = setupPhasedRepo({ phases });

	writeFileSync(join(phased.dir, '.gitignore'), '.lightsout/\n');
	execSync('git config user.name t && git config user.email t@t && git add -A && git commit -qm ignore', { cwd: phased.dir, stdio: 'ignore' });

	return phased;
};
