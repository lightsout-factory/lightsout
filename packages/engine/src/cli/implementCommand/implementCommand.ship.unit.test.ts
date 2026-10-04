import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { parseFlags } from '#src/cli/common/parseFlags.ts';
import { implementCommand } from '#src/cli/implementCommand/implementCommand.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// Mocked Imports
// -------------------------
// The harness is the one unowned boundary: every spawn fails as a step failure,
// so the first agent a phase reaches ends that phase — and with it the sequence.
const mockStubDriver: Driver = {
	name: 'stub',
	invoke: async () => {
		throw new Error('the stub harness ends the phase');
	},
};

jest.mock('#src/drivers/getDriver/getDriver.ts', () => ({ getDriver: () => mockStubDriver }));
// -------------------------

/** The plan folder the phased case points `--plan` at. */
const planFolder = 'plans/demo';

/**
 * A real consumer repo whose `--plan` names a file that is not there: the
 * pipeline mints the run, then fails at the plan read, so the manifest the
 * command stamped is on disk and nothing spawned a harness to write over it.
 *
 * `phases` seeds the folder with a two-phase overview. The stub driver fails
 * the first agent the first phase spawns, so a phased sequence ends at its
 * first phase — leaving the coordinator's manifest and that phase's own run.
 */
const setupImplementShip = ({ args, config, phases }: { args: string[]; config?: Record<string, unknown>; phases?: number }) => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ config });

	if (phases !== undefined) {
		const rows = Array.from({ length: phases }, (_, index) => `| ${index + 1} | \`phase${index + 1}.md\` | scope |`);

		const overview = `# Feature — Overview\n\n## Phases\n\n| # | File | Scope |\n|---|------|-------|\n${rows.join('\n')}\n`;

		mkdirSync(join(cwd, planFolder), { recursive: true });
		writeFileSync(join(cwd, planFolder, 'overview.md'), overview);

		for (let phase = 1; phase <= phases; phase += 1) {
			writeFileSync(join(cwd, planFolder, `phase${phase}.md`), `# Feature — Phase ${phase}\n`);
		}
	}

	// `implement` refuses to start in a checkout holding uncommitted changes,
	// because a passing run commits what it built — so the phase files this
	// fixture plants are committed rather than left in the tree.
	execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm plans --allow-empty', { cwd, stdio: 'ignore' });

	return { context: { flags: parseFlags({ args: [...args, '--no-worktree'] }), rest: [], cwd }, cwd, ...captured };
};

/** Every manifest the command left on disk — the record the progress view later draws its ship row from. */
const readManifests = ({ cwd }: { cwd: string }): { runId: string; pipeline?: string; willShip?: boolean }[] => {
	// Every run these cases start belongs to no plan, so the implement command's own runs folder holds them all.
	const runsDir = dirname(runDirFor({ cwd, runId: 'any' }));

	if (!existsSync(runsDir)) {
		return [];
	}

	return readdirSync(runsDir).map((runId) => JSON.parse(readFileSync(join(runsDir, runId, 'manifest.json'), 'utf8')));
};

describe('implementCommand ship intent', () => {
	test('refuses --ship and --no-ship together before the run starts, rather than after the whole run has gone by', async () => {
		const { context, cwd, logged, errors, exitCodes } = setupImplementShip({ args: ['--plan', 'ghost.md', '--ship', '--no-ship'] });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors).toStrictEqual(['--ship and --no-ship contradict each other — pass at most one']);
		// no banner and no run on disk: the refusal lands before anything starts
		expect(logged).toStrictEqual([]);
		expect(readManifests({ cwd })).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([1]);
	});

	test.each([
		{ label: '--ship was typed', args: ['--ship'], config: undefined, willShip: true },
		{ label: 'nobody asked at all', args: [] as string[], config: undefined, willShip: false },
		{ label: 'the config says after-implement', args: [] as string[], config: { ship: { 'after-implement': true } }, willShip: true },
		{ label: '--no-ship beats the config', args: ['--no-ship'], config: { ship: { 'after-implement': true } }, willShip: false },
		{ label: '--ship outlives a ticket pattern nothing can compile', args: ['--ship'], config: { ship: { 'ticket-pattern': '^(?<broken>' } }, willShip: true },
	])('records on the manifest that $label, so a reader is shown the ship row before the ship happens', async ({ args, config, willShip }) => {
		const { context, cwd } = setupImplementShip({ args: ['--plan', 'ghost.md', ...args], config });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		expect(readManifests({ cwd })).toEqual([expect.objectContaining({ willShip })]);
	});

	test('stamps a phased run’s intent on the coordinator when a stub driver ends its first phase', async () => {
		const { context, cwd } = setupImplementShip({ args: ['--plan', planFolder, '--ship'], phases: 2 });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		// the coordinator is the one run of the sequence that can do the shipping;
		// the first phase's own run must never carry a stamp it could not fill
		const manifests = readManifests({ cwd });
		const coordinators = manifests.filter((manifest) => manifest.pipeline === 'phases');
		const children = manifests.filter((manifest) => manifest.pipeline !== 'phases');

		expect({
			coordinatorWillShip: coordinators.map((manifest) => manifest.willShip),
			childrenStampedToShip: children.map((manifest) => manifest.willShip === true),
		}).toStrictEqual({ coordinatorWillShip: [true], childrenStampedToShip: [false] });
	});
});
