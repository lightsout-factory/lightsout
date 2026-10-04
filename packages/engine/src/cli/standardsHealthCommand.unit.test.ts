import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { parseFlags } from '#src/cli/common/args/parseFlags.ts';
import { standardsHealthCommand } from '#src/cli/standardsHealthCommand.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { StandardsHealth } from '#src/standardsCheck/common/types/StandardsHealth.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// Mocked Imports
// -------------------------
// Resolving the repo's standards groups and aggregating a repo's run history are other
// modules' entry points, each with its own tests. What this command owns is what
// it hands them, that it renders the result, and how it ends.

interface BuildStandardsHealthParams {
	cwd: string;
	groups: StandardsGroup[];
}

const mockBuildStandardsHealth = jest.fn<(params: BuildStandardsHealthParams) => Promise<StandardsHealth>>();

interface ResolveStandardsGroupsParams {
	cwd: string;
	config: LightsoutConfig | undefined;
	packages?: string[];
}

const mockResolveStandardsGroups = jest.fn<(params: ResolveStandardsGroupsParams) => Promise<StandardsGroup[]>>();

jest.mock('#src/standardsCheck/buildStandardsHealth.ts', () => ({
	buildStandardsHealth: (params: BuildStandardsHealthParams) => mockBuildStandardsHealth(params),
}));
jest.mock('#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts', () => ({
	resolveStandardsGroups: (params: ResolveStandardsGroupsParams) => mockResolveStandardsGroups(params),
}));
// -------------------------

const resolvedGroup: StandardsGroup = {
	packages: [''],
	pack: { name: 'acme/house', topics: [], rules: [], conditionalPacks: [], inactiveRules: [] },
	states: new Map(),
};

/** The command over a repo on disk — one holding the given config, or one holding none. */
const setupCommand = ({ health, config }: { health?: StandardsHealth; config?: Record<string, unknown> } = {}) => {
	const captured = captureCommandOutput();
	const cwd = config === undefined ? mkdtempSync(join(tmpdir(), 'lightsout-test-')) : setupConsumerRepo({ git: false, config });

	mockResolveStandardsGroups.mockResolvedValue([resolvedGroup]);
	mockBuildStandardsHealth.mockResolvedValue(
		health ?? {
			rules: [
				{
					rule: 'lightsout/multi-export',
					set: 'code',
					documentPath: 'code/fractal/modules',
					deterministic: true,
					agent: false,
					attempted: 2,
					resolved: 1,
					declined: 1,
					untracked: 0,
					adviceApplied: 0,
					adviceDeclined: 0,
					adviceAlreadyMet: 0,
					reasons: ['[plan] the barrel would break'],
				},
			],
			totals: { rules: 1, deterministic: 1, agent: 0 },
		},
	);

	return { context: { flags: parseFlags({ args: [] }), rest: [], cwd }, cwd, ...captured };
};

const cellsOf = ({ logged }: { logged: string[] }) =>
	logged
		.filter((line) => line.startsWith('│'))
		.map((line) =>
			line
				.split('│')
				.slice(1, -1)
				.map((cell) => cell.trim()),
		);

describe('standardsHealthCommand', () => {
	test('renders the report and exits 0 — it reports on the rules, never gates on the code', async () => {
		const { context, logged, errors, exitCodes } = setupCommand();

		await expect(standardsHealthCommand(context)).rejects.toThrow(/process\.exit/);

		expect(cellsOf({ logged })[1]).toStrictEqual(['lightsout/multi-export', 'deterministic', '2', '1', '1', '—', '50%', '—', '—']);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test("the repo's own config decides which packs the report has rows for", async () => {
		const { context, cwd } = setupCommand({ config: { 'standards-libraries': { acme: './standards/acme' }, 'standards-pack': 'acme/house' } });

		await expect(standardsHealthCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockResolveStandardsGroups.mock.calls[0]?.[0]).toEqual(
			expect.objectContaining({ cwd, config: expect.objectContaining({ 'standards-pack': 'acme/house' }) }),
		);
		// and the run history read is this repo's, beside that pack's groups
		expect(mockBuildStandardsHealth.mock.calls[0]?.[0]).toStrictEqual({ cwd, groups: [resolvedGroup] });
	});

	test('a repo with no config still gets an answer — the pack lightsout ships, every rule at its default', async () => {
		const { context } = setupCommand();

		await expect(standardsHealthCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockResolveStandardsGroups.mock.calls[0]?.[0]?.config).toBe(undefined);
	});

	test('packs that cannot be loaded stop the command rather than printing an empty report', async () => {
		const { context, logged, exitCodes } = setupCommand();
		mockResolveStandardsGroups.mockRejectedValue(new Error('pack acme/house: names library "acme", which is not registered'));

		await expect(standardsHealthCommand(context)).rejects.toThrow('pack acme/house: names library "acme", which is not registered');

		expect(logged).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([]);
	});

	test('every recorded reason prints beneath its own rule — a decline rate without the argument behind it says which rule to distrust, never why', async () => {
		const { context, logged } = setupCommand();

		await expect(standardsHealthCommand(context)).rejects.toThrow(/process\.exit/);

		expect(cellsOf({ logged })[2]).toStrictEqual(['· [plan] the barrel would break', '', '', '', '', '', '', '', '']);
	});

	test('the same rationale repeated across a rule’s batches is stated once, and a long one is cut rather than stretching the table', async () => {
		const { context, logged } = setupCommand({
			health: {
				rules: [
					{
						rule: 'lightsout/file-size',
						set: 'code',
						documentPath: 'code/fractal/size',
						deterministic: true,
						agent: false,
						attempted: 3,
						resolved: 0,
						declined: 3,
						untracked: 0,
						adviceApplied: 0,
						adviceDeclined: 0,
						adviceAlreadyMet: 0,
						reasons: ['  splitting   this file\n  would break the barrel  ', 'splitting this file would break the barrel', '', 'x'.repeat(120)],
					},
				],
				totals: { rules: 1, deterministic: 1, agent: 0 },
			},
		});

		await expect(standardsHealthCommand(context)).rejects.toThrow(/process\.exit/);

		const reasons = cellsOf({ logged })
			.map((cells) => cells[0] ?? '')
			.filter((cell) => cell.startsWith('· '));

		// whitespace-normalized the two spellings are one reason, the empty one is nothing, and the 120-character one is cut to 96
		expect(reasons).toStrictEqual(['· splitting this file would break the barrel', `· ${'x'.repeat(95)}…`]);
	});
});
