// The run-history half of the health report: which persisted runs count as its
// material, and how a run that cannot be read, or a batch that never ran, is
// tallied. Split from buildStandardsHealth.unit.test.ts at the test-file line cap.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { BatchReport } from '#src/contracts/refactor/BatchReport.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { buildStandardsHealth } from '#src/standardsCheck/buildStandardsHealth.ts';
import { acmeStandardsRule } from '#tests/helpers/acmeStandardsRule.ts';
import { packStandardsGroup } from '#tests/helpers/packStandardsGroup.ts';
import { setupRefactorRun } from '#tests/helpers/setupRefactorRun.ts';

/** The groups of a repo on one pack, `pack`, that brings in exactly `rules`, each listed in its topic. */
const groupsOf = ({ pack = 'acme/house', rules }: { pack?: string; rules: LoadedStandardsRule[] }) => [
	packStandardsGroup({ pack, rules, topicRuleIds: rules.map((entry) => entry.id) }),
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

/** A repo holding several persisted runs, written in the order given. */
const setupRuns = ({ runs }: { runs: Parameters<typeof setupRefactorRun>[0][] }) =>
	runs.reduce((cwd, run) => setupRefactorRun({ ...run, cwd }), mkdtempSync(join(tmpdir(), 'lightsout-health-')));

const report = (overrides: Partial<BatchReport> = {}): BatchReport => ({
	outcome: 'declined',
	remainingSiteKeys: [],
	rationale: [],
	...overrides,
});

/** The row of the rule `acme/<id>`, the library every rule here is built in. */
const rowFor = ({ rules, id }: { rules: Awaited<ReturnType<typeof buildStandardsHealth>>['rules']; id: string }) =>
	rules.find((entry) => entry.rule === `acme/${id}`);

describe('buildStandardsHealth', () => {
	test('an implement run is not this report’s material', async () => {
		const cwd = setupRefactorRun({
			pipeline: 'implement',
			batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })],
			reports: { 'batch-01': report({ outcome: 'declined', remainingSiteKeys: ['acme/multi-export:src/a.ts'] }) },
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [acmeStandardsRule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 0, declined: 0 }));
	});

	test('a manifest written before the pipeline field existed reads as an implement run, so it is skipped too', async () => {
		const cwd = setupRefactorRun({
			pipeline: null,
			batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })],
			reports: { 'batch-01': report({ outcome: 'declined', remainingSiteKeys: ['acme/multi-export:src/a.ts'] }) },
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [acmeStandardsRule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 0, declined: 0, untracked: 0 }));
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

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [acmeStandardsRule({ id: 'multi-export', deterministic: true })] }) });

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

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [acmeStandardsRule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 1, resolved: 1, declined: 0, untracked: 0 }));
	});

	test('a batch the manifest holds no step record for is untracked — a batch that never ran judged nothing', async () => {
		const cwd = setupRefactorRun({
			batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })],
			unrecordedBatchIds: ['batch-01'],
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [acmeStandardsRule({ id: 'multi-export', deterministic: true })] }) });

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

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [acmeStandardsRule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(
			expect.objectContaining({ attempted: 2, resolved: 1, declined: 1, untracked: 0, reasons: ['[other] deliberate'] }),
		);
	});

	test('each batch is answered by the step record carrying its own id, not by position', async () => {
		const cwd = setupRefactorRun({
			batches: [
				batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] }),
				batch({ id: 'batch-02', blocking: [finding({ rule: 'acme/module-boundary', path: 'src/b.ts' })] }),
			],
			reports: { 'batch-02': report({ outcome: 'resolved', remainingSiteKeys: [] }) },
			unrecordedBatchIds: ['batch-01'],
		});

		const health = await buildStandardsHealth({
			cwd,
			groups: groupsOf({
				rules: [acmeStandardsRule({ id: 'multi-export', deterministic: true }), acmeStandardsRule({ id: 'module-boundary', deterministic: true })],
			}),
		});

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 1, resolved: 0, untracked: 1 }));
		expect(rowFor({ rules: health.rules, id: 'module-boundary' })).toEqual(expect.objectContaining({ attempted: 1, resolved: 1, untracked: 0 }));
	});
});
