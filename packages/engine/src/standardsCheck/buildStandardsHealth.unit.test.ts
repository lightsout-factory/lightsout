import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { BatchReport } from '#src/contracts/refactor/BatchReport.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { AdvisoryOutcome } from '#src/contracts/standardsCheck/AdvisoryOutcome.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { buildStandardsHealth } from '#src/standardsCheck/buildStandardsHealth.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

const rule = (overrides: Partial<LoadedStandardsRule> & { id: string }): LoadedStandardsRule => ({
	name: `acme/${overrides.id}`,
	library: 'acme',
	set: 'code',
	documentPath: 'code/architecture/folder-structure',
	summary: 'a rule',
	prose: 'the argument for the rule',
	deterministic: false,
	agent: overrides.deterministic !== true,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	fixturesPath: `/packages/acme/${overrides.id}/fixtures`,
	...overrides,
});

/**
 * One group whose pack brings in exactly `rules`, each at its rule.md default.
 * The topic lists `topicRuleIds`, so a library rule the pack leaves out can
 * still sit in a topic the pack includes.
 */
const groupOf = ({ pack, rules, topicRuleIds }: { pack: string; rules: LoadedStandardsRule[]; topicRuleIds: string[] }): StandardsGroup => ({
	packages: [''],
	pack: {
		name: pack,
		topics: [
			{
				set: 'code',
				library: 'acme',
				path: 'code/architecture/folder-structure',
				intro: '# Folder Structure',
				ruleIds: topicRuleIds,
			},
		],
		rules: rules.map((entry) => ({ rule: entry, severity: entry.defaultSeverity, options: entry.defaultOptions })),
		conditionalPacks: [],
		inactiveRules: [],
	},
	states: new Map<string, ResolvedRuleState>(
		rules.map((entry) => [entry.name, { severity: entry.defaultSeverity, options: entry.defaultOptions, fromConfig: false, reachesAgents: true }]),
	),
});

/** The groups of a repo on one pack, `pack`, that brings in exactly `rules`, each listed in its topic. */
const groupsOf = ({ pack = 'acme/house', rules }: { pack?: string; rules: LoadedStandardsRule[] }) => [
	groupOf({ pack, rules, topicRuleIds: rules.map((entry) => entry.id) }),
];

const finding = ({ rule: ruleId, path }: { rule: string; path: string }): StandardsFinding => ({
	rule: ruleId,
	severity: StandardsSeverity.Blocking,
	siteKey: `${ruleId}:${path}`,
	files: [{ path }],
	detail: 'a site',
});

const batch = ({ id, blocking }: { id: string; blocking: StandardsFinding[] }): RefactorBatch => ({
	id,
	rule: blocking[0]?.rule ?? 'unknown',
	folder: 'src',
	blocking,
	advisories: [],
});

interface RunSpec {
	runId?: string;
	/** `null` writes a manifest with no `pipeline` field at all — how runs from before the discriminator existed are stored. */
	pipeline?: string | null;
	batches: RefactorBatch[];
	reports?: Record<string, unknown>;
	worklistJson?: string;
	/** Raw manifest text, for the run whose manifest cannot be read at all. */
	manifestJson?: string;
	/** Batch ids the manifest holds no step record for — how a run stopped before a batch ran is stored. */
	unrecordedBatchIds?: string[];
}

/**
 * A repo with one persisted run: a frozen work-list plus the manifest step
 * records that answered it. `pipeline` and `plan` are what decide whether the
 * report treats the run as its material at all.
 */
const setupRun = ({
	cwd = mkdtempSync(join(tmpdir(), 'lightsout-health-')),
	runId = 'run-01',
	pipeline = 'refactor',
	batches,
	reports = {},
	worklistJson,
	manifestJson,
	unrecordedBatchIds = [],
}: RunSpec & { cwd?: string }) => {
	const runDir = runDirFor({ cwd, runId });

	mkdirSync(runDir, { recursive: true });
	writeFileSync(join(runDir, 'worklist.json'), worklistJson ?? JSON.stringify({ at: '2026-01-01T00:00:00.000Z', path: '.', all: false, batches }));
	writeFileSync(
		join(runDir, 'manifest.json'),
		manifestJson ??
			JSON.stringify({
				runId,
				createdAt: '2026-01-01T00:00:00.000Z',
				updatedAt: '2026-01-01T00:00:00.000Z',
				plan: join('.lightsout', 'runs', runId, 'worklist.json'),
				...(pipeline === null ? {} : { pipeline }),
				harness: 'stub',
				status: 'passed',
				currentStep: null,
				steps: batches
					.filter((entry) => !unrecordedBatchIds.includes(entry.id))
					.map((entry) => ({
						id: entry.id,
						status: 'passed',
						attempts: 1,
						...(Object.hasOwn(reports, entry.id) ? { report: reports[entry.id] } : {}),
					})),
				changedFiles: [],
			}),
	);

	return cwd;
};

/** A repo holding several persisted runs, written in the order given. */
const setupRuns = ({ runs }: { runs: RunSpec[] }) => runs.reduce((cwd, run) => setupRun({ ...run, cwd }), mkdtempSync(join(tmpdir(), 'lightsout-health-')));

const report = (overrides: Partial<BatchReport> = {}): BatchReport => ({
	outcome: 'declined',
	remainingSiteKeys: [],
	rationale: [],
	...overrides,
});

const advice = (overrides: Partial<AdvisoryOutcome> & { rule: string; siteKey: string }): AdvisoryOutcome => ({
	outcome: 'applied',
	...overrides,
});

/** The health row for one rule — the report is sorted by id, not indexed by it. */
/** The row of the rule `acme/<id>`, the library every rule here is built in. */
const rowFor = ({ rules, id }: { rules: Awaited<ReturnType<typeof buildStandardsHealth>>['rules']; id: string }) =>
	rules.find((entry) => entry.rule === `acme/${id}`);

describe('buildStandardsHealth', () => {
	test('a rule with both kinds of check counts both as deterministic and as agent', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'lightsout-health-partial-'));

		const health = await buildStandardsHealth({
			cwd,
			groups: groupsOf({ rules: [rule({ id: 'shared-code', deterministic: true, agent: true }), rule({ id: 'multi-export', deterministic: true })] }),
		});

		// code runs both; an agent still reads one — so the two counts pass the rule total
		expect(health.totals).toStrictEqual({ rules: 2, deterministic: 2, agent: 1 });
		expect(rowFor({ rules: health.rules, id: 'shared-code' })).toEqual(expect.objectContaining({ deterministic: true, agent: true }));
	});

	test('coverage is counted off the package folders, so it lands with no run history at all', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'lightsout-health-empty-'));

		const health = await buildStandardsHealth({
			cwd,
			groups: groupsOf({ rules: [rule({ id: 'multi-export', deterministic: true }), rule({ id: 'module-folder-layout' })] }),
		});

		expect(health.totals).toStrictEqual({ rules: 2, deterministic: 1, agent: 1 });
		// sorted by id, so the report diffs cleanly between runs
		expect(health.rules.map((entry) => entry.rule)).toStrictEqual(['acme/module-folder-layout', 'acme/multi-export']);
		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(
			expect.objectContaining({ attempted: 0, resolved: 0, declined: 0, untracked: 0, adviceApplied: 0, adviceDeclined: 0, reasons: [] }),
		);
	});

	test('a site the batch report shows gone is resolved; one still standing in a declined batch is declined', async () => {
		const cwd = setupRun({
			batches: [
				batch({
					id: 'batch-01',
					blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' }), finding({ rule: 'acme/multi-export', path: 'src/b.ts' })],
				}),
			],
			reports: {
				'batch-01': report({ outcome: 'declined', remainingSiteKeys: ['acme/multi-export:src/b.ts'], rationale: ['[plan] splitting would break the barrel'] }),
			},
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [rule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(
			expect.objectContaining({ attempted: 2, resolved: 1, declined: 1, untracked: 0, reasons: ['[plan] splitting would break the barrel'] }),
		);
	});

	test('a site left standing in a resolved batch is untracked — only a decline is a decline', async () => {
		const cwd = setupRun({
			batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })],
			reports: { 'batch-01': report({ outcome: 'resolved', remainingSiteKeys: ['acme/multi-export:src/a.ts'], rationale: [] }) },
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [rule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 1, resolved: 0, declined: 0, untracked: 1 }));
	});

	test('a batch with no parseable report is attempted only — a failed batch is not a decline', async () => {
		const cwd = setupRun({ batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })] });

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [rule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 1, resolved: 0, declined: 0, untracked: 1 }));
	});

	test('a batch’s rationale attaches to every rule it left a site standing for', async () => {
		const cwd = setupRun({
			batches: [
				batch({
					id: 'batch-01',
					blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' }), finding({ rule: 'acme/module-boundary', path: 'src/b.ts' })],
				}),
			],
			reports: {
				'batch-01': report({
					outcome: 'declined',
					remainingSiteKeys: ['acme/multi-export:src/a.ts', 'acme/module-boundary:src/b.ts'],
					rationale: ['[other] both are deliberate'],
				}),
			},
		});

		const health = await buildStandardsHealth({
			cwd,
			groups: groupsOf({ rules: [rule({ id: 'multi-export', deterministic: true }), rule({ id: 'module-boundary', deterministic: true })] }),
		});

		// the rationale is recorded per batch, so both rules carry it
		expect(rowFor({ rules: health.rules, id: 'multi-export' })?.reasons).toStrictEqual(['[other] both are deliberate']);
		expect(rowFor({ rules: health.rules, id: 'module-boundary' })?.reasons).toStrictEqual(['[other] both are deliberate']);
	});

	test('an implement run is not this report’s material', async () => {
		const cwd = setupRun({
			pipeline: 'implement',
			batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })],
			reports: { 'batch-01': report({ outcome: 'declined', remainingSiteKeys: ['acme/multi-export:src/a.ts'] }) },
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [rule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 0, declined: 0 }));
	});

	test('a manifest written before the pipeline field existed reads as an implement run, so it is skipped too', async () => {
		const cwd = setupRun({
			pipeline: null,
			batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })],
			reports: { 'batch-01': report({ outcome: 'declined', remainingSiteKeys: ['acme/multi-export:src/a.ts'] }) },
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [rule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 0, declined: 0, untracked: 0 }));
	});

	test('a rule the run recorded but no loaded pack names gets no row — the packs decide what the report has rows for', async () => {
		const cwd = setupRun({
			batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'retired-rule', path: 'src/a.ts' })] })],
			reports: {
				'batch-01': report({
					outcome: 'declined',
					remainingSiteKeys: ['retired-rule:src/a.ts'],
					advisoryOutcomes: [advice({ rule: 'never-shipped', siteKey: 'never-shipped:src/a.ts', outcome: 'applied' })],
				}),
			},
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [rule({ id: 'multi-export', deterministic: true })] }) });

		expect(health.rules.map((entry) => entry.rule)).toStrictEqual(['acme/multi-export']);
		expect(health.totals).toStrictEqual({ rules: 1, deterministic: 1, agent: 0 });
	});

	test('a run whose work-list will not parse is skipped, and the readable runs still count', async () => {
		const cwd = setupRuns({
			runs: [
				{
					runId: 'run-broken',
					batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })],
					worklistJson: '{ not json at all',
				},
				{
					runId: 'run-good',
					batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/b.ts' })] })],
					reports: { 'batch-01': report({ outcome: 'declined', remainingSiteKeys: ['acme/multi-export:src/b.ts'], rationale: ['[other] deliberate'] }) },
				},
			],
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [rule({ id: 'multi-export', deterministic: true })] }) });

		// one corrupt run directory must not take the whole account down with it
		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 1, declined: 1 }));
	});

	test('a run whose manifest will not parse is skipped, and the readable runs still count', async () => {
		const cwd = setupRuns({
			runs: [
				{
					runId: 'run-broken',
					batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })],
					manifestJson: '{ not json at all',
				},
				{
					runId: 'run-good',
					batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/b.ts' })] })],
					reports: { 'batch-01': report({ outcome: 'resolved', remainingSiteKeys: [] }) },
				},
			],
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [rule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 1, resolved: 1, declined: 0, untracked: 0 }));
	});

	test('a batch the manifest holds no step record for is untracked — a batch that never ran judged nothing', async () => {
		const cwd = setupRun({
			batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })],
			unrecordedBatchIds: ['batch-01'],
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [rule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 1, resolved: 0, declined: 0, untracked: 1 }));
	});

	test('one rule’s counts accumulate across every refactor run the repo has state for', async () => {
		const cwd = setupRuns({
			runs: [
				{
					runId: 'run-01',
					batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })],
					reports: { 'batch-01': report({ outcome: 'resolved', remainingSiteKeys: [] }) },
				},
				{
					runId: 'run-02',
					batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/b.ts' })] })],
					reports: {
						'batch-01': report({ outcome: 'declined', remainingSiteKeys: ['acme/multi-export:src/b.ts'], rationale: ['[other] deliberate'] }),
					},
				},
			],
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [rule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(
			expect.objectContaining({ attempted: 2, resolved: 1, declined: 1, untracked: 0, reasons: ['[other] deliberate'] }),
		);
	});

	test('every loaded pack contributes rows, sorted by id across the packs together', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'lightsout-health-packs-'));

		const health = await buildStandardsHealth({
			cwd,
			groups: [
				...groupsOf({ pack: 'zeta/house', rules: [rule({ id: 'module-folder-layout', name: 'zeta/module-folder-layout', library: 'zeta' })] }),
				...groupsOf({ pack: 'alpha/house', rules: [rule({ id: 'multi-export', name: 'alpha/multi-export', library: 'alpha', deterministic: true })] }),
			],
		});

		expect(health.rules.map((entry) => entry.rule)).toStrictEqual(['alpha/multi-export', 'zeta/module-folder-layout']);
		expect(health.totals).toStrictEqual({ rules: 2, deterministic: 1, agent: 1 });
	});

	test('each batch is answered by the step record carrying its own id, not by position', async () => {
		const cwd = setupRun({
			batches: [
				batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] }),
				batch({ id: 'batch-02', blocking: [finding({ rule: 'acme/module-boundary', path: 'src/b.ts' })] }),
			],
			reports: { 'batch-02': report({ outcome: 'resolved', remainingSiteKeys: [] }) },
			unrecordedBatchIds: ['batch-01'],
		});

		const health = await buildStandardsHealth({
			cwd,
			groups: groupsOf({ rules: [rule({ id: 'multi-export', deterministic: true }), rule({ id: 'module-boundary', deterministic: true })] }),
		});

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 1, resolved: 0, untracked: 1 }));
		expect(rowFor({ rules: health.rules, id: 'module-boundary' })).toEqual(expect.objectContaining({ attempted: 1, resolved: 1, untracked: 0 }));
	});

	test('health rows are keyed by full rule name and tally only full-name sites', async () => {
		const cwd = setupRun({
			batches: [
				batch({
					id: 'batch-01',
					blocking: [finding({ rule: 'lightsout/function-size', path: 'src/a.ts' }), finding({ rule: 'function-size', path: 'src/b.ts' })],
				}),
			],
			reports: { 'batch-01': report({ outcome: 'resolved', remainingSiteKeys: [] }) },
		});

		const health = await buildStandardsHealth({
			cwd,
			groups: groupsOf({
				pack: 'lightsout/standards',
				rules: [rule({ id: 'function-size', library: 'lightsout', name: 'lightsout/function-size', deterministic: true })],
			}),
		});

		// the short-named site matches no row, so only the full-name site is tallied
		expect(health.rules.map((entry) => ({ rule: entry.rule, attempted: entry.attempted, resolved: entry.resolved }))).toStrictEqual([
			{ rule: 'lightsout/function-size', attempted: 1, resolved: 1 },
		]);
	});

	test("buildStandardsHealth: rows follow the groups' packs, not the whole library", async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'lightsout-health-groups-'));
		const multiExport = rule({ id: 'multi-export', deterministic: true });
		const moduleFolderLayout = rule({ id: 'module-folder-layout' });
		const groups = [
			groupOf({ pack: 'acme/structure', rules: [multiExport], topicRuleIds: ['multi-export', 'left-out'] }),
			groupOf({ pack: 'acme/house', rules: [multiExport, moduleFolderLayout], topicRuleIds: ['multi-export', 'module-folder-layout', 'left-out'] }),
		];

		const health = await buildStandardsHealth({ cwd, groups });

		// a rule in both packs is one row; left-out sits in the topic, but neither pack brings it in, so it has none
		expect({ rules: health.rules.map((entry) => entry.rule), totals: health.totals }).toStrictEqual({
			rules: ['acme/module-folder-layout', 'acme/multi-export'],
			totals: { rules: 2, deterministic: 1, agent: 1 },
		});
	});
});
