import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { reviewStandards } from '#src/cli/reviewStandards.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';

// Mocked Imports
// -------------------------
// The review runner spawns a harness and has its own tests; what this resolver
// owns is everything it hands over — groups, file scope, driver, time bound —
// all observable with the runner stubbed.

interface RunStandardsReviewParams {
	cwd: string;
	driver: Driver;
	groups: StandardsGroup[];
	files: string[];
	packagesDir: string;
	timeoutMs?: number;
	onProgress?: (message: string) => void;
}

const mockRunStandardsReview = jest.fn<(params: RunStandardsReviewParams) => Promise<{ findings: StandardsFinding[]; notes: string[] }>>();

jest.mock('#src/standardsCheck/runStandardsReview.ts', () => ({
	runStandardsReview: (params: RunStandardsReviewParams) => mockRunStandardsReview(params),
}));
// -------------------------
interface ResolveStandardsGroupsParams {
	cwd: string;
	config: LightsoutConfig | undefined;
	packages?: string[];
}

const mockResolveStandardsGroups = jest.fn<(params: ResolveStandardsGroupsParams) => Promise<StandardsGroup[]>>();

jest.mock('#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts', () => ({
	resolveStandardsGroups: (params: ResolveStandardsGroupsParams) => mockResolveStandardsGroups(params),
}));
// -------------------------

const gates: LightsoutConfig['gates'] = { check: 'true', test: 'true', 'test-coverage': false };

/** A resolved group as the resolver hands one back — only the fields a caller carrying it through can see. */
const resolvedGroup = (): StandardsGroup => ({
	packages: [''],
	pack: { name: 'acme/house', topics: [], rules: [], conditionalPacks: [], inactiveRules: [] },
	states: new Map(),
});

/**
 * A repo the review reads its own answers off: source files and a plain
 * manifest. Groups given here stand in for the resolver's answer; without them
 * the real resolver reads the config the review is handed.
 */
const setupRepo = ({ groups, sources = ['src/index.ts'] }: { groups?: StandardsGroup[]; sources?: string[] } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-review-'));

	for (const source of sources) {
		mkdirSync(join(cwd, source, '..'), { recursive: true });
		writeFileSync(join(cwd, source), 'export const one = 1;\n');
	}

	writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'consumer', dependencies: {} }));

	if (groups === undefined) {
		mockResolveStandardsGroups.mockImplementation(
			jest.requireActual<typeof import('#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts')>(
				'#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts',
			).resolveStandardsGroups,
		);
	} else {
		mockResolveStandardsGroups.mockResolvedValue(groups);
	}

	mockRunStandardsReview.mockResolvedValue({ findings: [], notes: [] });

	return cwd;
};

const reviewParams = () => mockRunStandardsReview.mock.calls[0]?.[0];

/**
 * A repo that switched standards off, reviewed by the real runner against a
 * harness that would report a finding if it were ever spawned — so an agent
 * spent, or anything it said, shows in the result.
 */
const setupSwitchedOffReview = () => {
	const cwd = setupRepo();
	const config: LightsoutConfig = { gates, 'standards-pack': false };
	const invoke = jest.fn<Driver['invoke']>().mockResolvedValue({
		text: JSON.stringify({ findings: [{ rule: 'import-paths', files: [{ path: 'src/index.ts' }], detail: 'should never be asked for' }] }),
		exitCode: 0,
	});
	const harness: Driver = { name: 'claude-code', invoke };
	const actual = jest.requireActual<typeof import('#src/standardsCheck/runStandardsReview.ts')>('#src/standardsCheck/runStandardsReview.ts');

	mockRunStandardsReview.mockImplementation((params) => actual.runStandardsReview({ ...params, driver: harness }));

	return { cwd, config, invoke };
};

describe('reviewStandards', () => {
	test('a repo that configured nothing gets the default harness and the default bound', async () => {
		const cwd = setupRepo();

		await reviewStandards({ cwd });

		expect(reviewParams()).toEqual(expect.objectContaining({ timeoutMs: 60 * 60_000 }));
		expect(reviewParams()?.driver.name).toBe('claude-code');
	});

	test('the packs the resolver loaded for this config are the ones the review runs against', async () => {
		const group = resolvedGroup();
		const cwd = setupRepo({ groups: [group] });
		const config: LightsoutConfig = { gates, 'standards-pack': 'acme/house' };

		await reviewStandards({ cwd, config });

		// the repo's own config decides which pack is loaded, and every group resolved is judged
		expect(mockResolveStandardsGroups).toHaveBeenCalledWith({ cwd, config });
		expect(reviewParams()?.groups).toStrictEqual([group]);
	});

	test('without a path filter the review covers every source file in the repo', async () => {
		const cwd = setupRepo();

		await reviewStandards({ cwd });

		expect(reviewParams()?.files).toStrictEqual(['src/index.ts']);
	});

	test("the review is bounded and scoped by the repo's own config, over the files the path filter leaves", async () => {
		const cwd = setupRepo({ sources: ['src/index.ts', 'scripts/build.ts'] });
		const config: LightsoutConfig = { gates, harness: 'codex', 'standards-pack': 'lightsout/fractal', timeouts: { 'agent-minutes': 5 } };

		await reviewStandards({ cwd, config, path: 'src' });

		expect(reviewParams()?.driver.name).toBe('codex');
		// the configured pack is taken as given — the same answer the machine half gets
		expect(reviewParams()?.groups.map(({ pack }) => pack.name)).toStrictEqual(['lightsout/fractal']);
		expect(reviewParams()?.timeoutMs).toBe(5 * 60_000);
		// and the scope is the subtree the caller named
		expect(reviewParams()?.files).toStrictEqual(['src/index.ts']);
	});

	test("the runner's progress reaches the caller as it reports it — the caller decides how it is shown", async () => {
		const cwd = setupRepo();
		const { logged } = captureCommandOutput();
		const progress: string[] = [];

		mockRunStandardsReview.mockImplementation(async ({ onProgress }) => {
			onProgress?.('reading 4 agent-checked rule(s) against 12 file(s)');

			return { findings: [], notes: [] };
		});

		await reviewStandards({ cwd, onProgress: (message) => progress.push(message) });

		expect(progress).toStrictEqual(['reading 4 agent-checked rule(s) against 12 file(s)']);
		// nothing is printed here: presentation belongs to the command
		expect(logged).toStrictEqual([]);
	});

	test("the runner's answer comes back whole — findings and notes alike", async () => {
		const cwd = setupRepo();
		const skipNote = 'agent review skipped — agent invocation failed: spawn claude ENOENT';

		mockRunStandardsReview.mockResolvedValue({ findings: [], notes: [skipNote] });

		await expect(reviewStandards({ cwd })).resolves.toStrictEqual({ findings: [], notes: [skipNote] });
	});

	test.each([
		{ config: { gates, 'packages-dir': 'apps' } satisfies LightsoutConfig, packagesDir: 'apps' },
		{ config: { gates } satisfies LightsoutConfig, packagesDir: 'packages' },
	])("hands the review the config's packages-dir, defaulting to packages", async ({ config, packagesDir }) => {
		const cwd = setupRepo({ groups: [resolvedGroup()] });

		await reviewStandards({ cwd, config });

		expect(reviewParams()).toEqual(expect.objectContaining({ packagesDir }));
	});

	test('reviewStandards: standards-pack false reviews nothing', async () => {
		const { cwd, config, invoke } = setupSwitchedOffReview();

		const result = await reviewStandards({ cwd, config });

		// no group means no agent-checked rule to read the source file against, so no agent is spent
		expect({ result, spawned: invoke.mock.calls.length }).toStrictEqual({ result: { findings: [], notes: [] }, spawned: 0 });
	});
});
