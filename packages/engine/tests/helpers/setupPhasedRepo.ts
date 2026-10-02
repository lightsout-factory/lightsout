import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

/**
 * A consumer repo holding a plan folder: an overview whose Phases table names
 * one file per phase, plus the phase files themselves. Each phase file carries
 * its own sentinel, so a stub agent can tell which phase it was handed.
 *
 * The plan folder is committed, because every phase that starts for the first
 * time refuses a tree holding uncommitted changes.
 */
export const setupPhasedRepo = ({ phases, duplicate = false }: { phases: number; duplicate?: boolean }) => {
	const dir = setupConsumerRepo();
	const folder = join(dir, 'plans', 'demo');
	const rows = Array.from({ length: phases }, (_, index) => `| ${index + 1} | \`phase${duplicate ? 1 : index + 1}.md\` | scope |`);

	mkdirSync(folder, { recursive: true });
	writeFileSync(join(folder, 'overview.md'), `# Feature — Overview\n\n## Phases\n\n| # | File | Scope |\n|---|------|-------|\n${rows.join('\n')}\n`);

	for (let phase = 1; phase <= phases; phase += 1) {
		writeFileSync(join(folder, `phase${phase}.md`), `# Feature — Phase ${phase}\n\nPHASE-${phase}-SENTINEL\n`);
	}

	execSync('git add -A && git commit -qm plans', { cwd: dir, stdio: 'ignore' });

	return { dir, overviewPath: join('plans', 'demo', 'overview.md') };
};
