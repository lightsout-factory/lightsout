import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { parseFlags } from '#src/cli/parseFlags.ts';
import type { PlanWorktree } from '#src/cli/plan/planCommand/common/types/PlanWorktree.ts';
import { planCommand } from '#src/cli/plan/planCommand/planCommand.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { queueConfigBlock, ticketTrackerConfigBlock } from '#tests/helpers/queueConfigBlock.ts';

// Mocked Imports
// -------------------------
// planCommand is a dispatcher: the only behaviour it owns is which subcommand
// runs and what reaches it. The subcommands are other modules' entry points, so
// they are stubbed rather than driven — running them for real would spawn a
// harness to prove a routing decision.

const mockPlanVerifyFactsCommand = jest.fn<(params: unknown) => Promise<void>>();
const mockPlanLintCommand = jest.fn<(params: unknown) => Promise<void>>();
const mockPlanDraftCommand = jest.fn<(params: unknown) => Promise<void>>();
const mockPlanDedupCommand = jest.fn<(params: unknown) => Promise<void>>();
const mockPlanGradeCommand = jest.fn<(params: unknown) => Promise<void>>();
const mockPlanPublishCommand = jest.fn<(params: unknown) => Promise<void>>();
const mockPlanSyncDecisionsCommand = jest.fn<(params: unknown) => Promise<void>>();
const mockPlanSyncPhasesCommand = jest.fn<(params: unknown) => Promise<void>>();
const mockResolveConfigAndDriver = jest.fn<(params: unknown) => Promise<{ config?: LightsoutConfig; driver: Driver; configPath?: string }>>();
const mockLoadPlanningStandards = jest.fn<(params: unknown) => Promise<string | undefined>>();

// -------------------------
// The planning worktree is established through git, and its own rules are
// pinned beside the resolver; here only where the dispatcher sends a
// subcommand is under test. The default answer is the launching checkout
// itself, as with isolation off, so every routing case above still reads the
// checkout it was launched from.

type OpenPlanWorktreeParams = { cwd: string; config: LightsoutConfig | undefined; flags: CommandContext['flags']; name: string };

const mockOpenPlanWorktree = jest.fn<(params: OpenPlanWorktreeParams) => Promise<{ worktree: PlanWorktree } | { error: string }>>(async ({ cwd }) => ({
	worktree: { cwd, isolated: false, created: false },
}));

// -------------------------

jest.mock('#src/cli/plan/planCommand/planVerifyFactsCommand/planVerifyFactsCommand.ts', () => ({
	planVerifyFactsCommand: (params: unknown) => mockPlanVerifyFactsCommand(params),
}));
jest.mock('#src/cli/plan/planCommand/planLintCommand.ts', () => ({ planLintCommand: (params: unknown) => mockPlanLintCommand(params) }));
jest.mock('#src/cli/plan/planCommand/planDraftCommand/planDraftCommand.ts', () => ({ planDraftCommand: (params: unknown) => mockPlanDraftCommand(params) }));
jest.mock('#src/cli/plan/planCommand/planDedupCommand.ts', () => ({ planDedupCommand: (params: unknown) => mockPlanDedupCommand(params) }));
jest.mock('#src/cli/plan/planCommand/planGradeCommand/planGradeCommand.ts', () => ({ planGradeCommand: (params: unknown) => mockPlanGradeCommand(params) }));
jest.mock('#src/cli/plan/planCommand/planPublishCommand.ts', () => ({ planPublishCommand: (params: unknown) => mockPlanPublishCommand(params) }));
jest.mock('#src/cli/plan/planCommand/planSyncDecisionsCommand.ts', () => ({
	planSyncDecisionsCommand: (params: unknown) => mockPlanSyncDecisionsCommand(params),
}));
jest.mock('#src/cli/plan/planCommand/planSyncPhasesCommand.ts', () => ({ planSyncPhasesCommand: (params: unknown) => mockPlanSyncPhasesCommand(params) }));
jest.mock('#src/cli/common/resolveConfigAndDriver.ts', () => ({
	resolveConfigAndDriver: (params: unknown) => mockResolveConfigAndDriver(params),
}));
jest.mock('#src/cli/plan/planCommand/readPlanningStandards.ts', () => ({ readPlanningStandards: (params: unknown) => mockLoadPlanningStandards(params) }));
jest.mock('#src/cli/plan/planCommand/openPlanWorktree/openPlanWorktree.ts', () => ({
	openPlanWorktree: (params: OpenPlanWorktreeParams) => mockOpenPlanWorktree(params),
}));

const stubDriver: Driver = { name: 'stub', invoke: async () => ({ text: '', exitCode: 0 }) };

/** The gate block every config in this file carries — the smallest one the contract accepts. */
const gates: LightsoutConfig['gates'] = { check: 'true', test: 'true', 'test-coverage': false };

/**
 * The config a repo carries when it has chosen a ticket convention: the
 * presence of a `ticket-tracker` block is the whole signal that the plan-folder
 * advisory applies to it.
 */
const trackerRepoConfig = { gates, queue: queueConfigBlock, 'ticket-tracker': ticketTrackerConfigBlock };

/**
 * The same repo with the tracker block taken away: a `queue` block on its own
 * names no tracker, so this repo has chosen no ticket convention.
 */
const queueOnlyRepoConfig = { gates, queue: queueConfigBlock };

/** Every subcommand the dispatcher can hand a call to. */
const subcommandMocks = [
	mockPlanVerifyFactsCommand,
	mockPlanLintCommand,
	mockPlanDraftCommand,
	mockPlanDedupCommand,
	mockPlanGradeCommand,
	mockPlanPublishCommand,
	mockPlanSyncDecisionsCommand,
	mockPlanSyncPhasesCommand,
];

const setupPlan = ({ args, repoConfig }: { args: string[]; repoConfig?: Record<string, unknown> }) => {
	const captured = captureCommandOutput();
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-plan-command-'));
	const config: LightsoutConfig = { gates };

	if (repoConfig) {
		writeFileSync(join(cwd, 'lightsout.config.json'), JSON.stringify(repoConfig));
	}

	mockResolveConfigAndDriver.mockResolvedValue({ config, driver: stubDriver, configPath: join(cwd, 'lightsout.config.json') });
	mockLoadPlanningStandards.mockResolvedValue('STANDARDS');

	for (const mock of subcommandMocks) {
		mock.mockResolvedValue(undefined);
	}

	return { context: { flags: parseFlags({ args }), rest: args, cwd }, cwd, config, ...captured };
};

describe('planCommand', () => {
	test.each(['lint', 'publish', 'sync-decisions', 'verify-facts'])(
		'%s addresses a plan by name and says nothing about the folder, whatever its label spells',
		async (subcommand) => {
			const { context, logged, exitCodes } = setupPlan({ args: [subcommand, '--name', 'rate-limit-banner/001-banner'], repoConfig: trackerRepoConfig });

			await planCommand(context);

			// A label is only a label now: which ticket the work belongs to is the
			// work order record's answer, so there is nothing to advise about.
			expect(logged).toStrictEqual([]);
			expect(exitCodes).toStrictEqual([]);
		},
	);

	test.each(['draft', 'dedup', 'grade'])(
		'%s names the config file it read and says nothing about the folder, whatever its label spells',
		async (subcommand) => {
			const { context, cwd, logged, exitCodes } = setupPlan({ args: [subcommand, '--name', 'rate-limit-banner/001-banner'], repoConfig: trackerRepoConfig });

			await planCommand(context);

			// an agent run reports which checkout's config it read, since every
			// worktree carries its own copy — and that line is all it prints here
			expect(logged).toStrictEqual([`  config: ${join(cwd, 'lightsout.config.json')}`]);
			expect(exitCodes).toStrictEqual([]);
		},
	);

	test('a repo carrying a queue block and no ticket-tracker block is told nothing either, because a queue names no tracker', async () => {
		const { context, logged } = setupPlan({ args: ['lint', '--name', 'rate-limit-banner/001-banner'], repoConfig: queueOnlyRepoConfig });

		await planCommand(context);

		expect(logged).toStrictEqual([]);
		expect(mockPlanLintCommand).toHaveBeenCalledTimes(1);
	});

	test('a subcommand given no --name names no plan at all, and still prints nothing', async () => {
		const { context, logged } = setupPlan({ args: ['verify-facts'], repoConfig: trackerRepoConfig });

		await planCommand(context);

		expect(logged).toStrictEqual([]);
	});

	test('an unknown subcommand addresses no plan — the usage error stands alone', async () => {
		const { context, logged, exitCodes } = setupPlan({ args: ['sideways', '--name', 'rate-limit-banner'], repoConfig: trackerRepoConfig });

		await expect(planCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([1]);
	});
});
