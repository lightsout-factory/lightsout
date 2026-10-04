import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { BatchReport } from '#src/contracts/refactor/BatchReport.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { AdvisoryOutcome } from '#src/contracts/standardsCheck/AdvisoryOutcome.ts';
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

/** The row of the rule `acme/<id>`, the library every rule here is built in. */
const rowFor = ({ rules, id }: { rules: Awaited<ReturnType<typeof buildStandardsHealth>>['rules']; id: string }) =>
	rules.find((entry) => entry.rule === `acme/${id}`);

describe('buildStandardsHealth', () => {
	test('a rule with both kinds of check counts both as deterministic and as agent', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'lightsout-health-partial-'));

		const health = await buildStandardsHealth({
			cwd,
			groups: groupsOf({
				rules: [acmeStandardsRule({ id: 'shared-code', deterministic: true, agent: true }), acmeStandardsRule({ id: 'multi-export', deterministic: true })],
			}),
		});

		// code runs both; an agent still reads one — so the two counts pass the rule total
		expect(health.totals).toStrictEqual({ rules: 2, deterministic: 2, agent: 1 });
		expect(rowFor({ rules: health.rules, id: 'shared-code' })).toEqual(expect.objectContaining({ deterministic: true, agent: true }));
	});

	test('coverage is counted off the package folders, so it lands with no run history at all', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'lightsout-health-empty-'));

		const health = await buildStandardsHealth({
			cwd,
			groups: groupsOf({ rules: [acmeStandardsRule({ id: 'multi-export', deterministic: true }), acmeStandardsRule({ id: 'module-folder-layout' })] }),
		});

		expect(health.totals).toStrictEqual({ rules: 2, deterministic: 1, agent: 1 });
		// sorted by id, so the report diffs cleanly between runs
		expect(health.rules.map((entry) => entry.rule)).toStrictEqual(['acme/module-folder-layout', 'acme/multi-export']);
		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(
			expect.objectContaining({ attempted: 0, resolved: 0, declined: 0, untracked: 0, adviceApplied: 0, adviceDeclined: 0, reasons: [] }),
		);
	});

	test('a site the batch report shows gone is resolved; one still standing in a declined batch is declined', async () => {
		const cwd = setupRefactorRun({
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

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [acmeStandardsRule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(
			expect.objectContaining({ attempted: 2, resolved: 1, declined: 1, untracked: 0, reasons: ['[plan] splitting would break the barrel'] }),
		);
	});

	test('a site left standing in a resolved batch is untracked — only a decline is a decline', async () => {
		const cwd = setupRefactorRun({
			batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })],
			reports: { 'batch-01': report({ outcome: 'resolved', remainingSiteKeys: ['acme/multi-export:src/a.ts'], rationale: [] }) },
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [acmeStandardsRule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 1, resolved: 0, declined: 0, untracked: 1 }));
	});

	test('a batch with no parseable report is attempted only — a failed batch is not a decline', async () => {
		const cwd = setupRefactorRun({ batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })] });

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [acmeStandardsRule({ id: 'multi-export', deterministic: true })] }) });

		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 1, resolved: 0, declined: 0, untracked: 1 }));
	});

	test('a batch’s rationale attaches to every rule it left a site standing for', async () => {
		const cwd = setupRefactorRun({
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
			groups: groupsOf({
				rules: [acmeStandardsRule({ id: 'multi-export', deterministic: true }), acmeStandardsRule({ id: 'module-boundary', deterministic: true })],
			}),
		});

		// the rationale is recorded per batch, so both rules carry it
		expect(rowFor({ rules: health.rules, id: 'multi-export' })?.reasons).toStrictEqual(['[other] both are deliberate']);
		expect(rowFor({ rules: health.rules, id: 'module-boundary' })?.reasons).toStrictEqual(['[other] both are deliberate']);
	});

	test('a rule the run recorded but no loaded pack names gets no row — the packs decide what the report has rows for', async () => {
		const cwd = setupRefactorRun({
			batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'retired-rule', path: 'src/a.ts' })] })],
			reports: {
				'batch-01': report({
					outcome: 'declined',
					remainingSiteKeys: ['retired-rule:src/a.ts'],
					advisoryOutcomes: [advice({ rule: 'never-shipped', siteKey: 'never-shipped:src/a.ts', outcome: 'applied' })],
				}),
			},
		});

		const health = await buildStandardsHealth({ cwd, groups: groupsOf({ rules: [acmeStandardsRule({ id: 'multi-export', deterministic: true })] }) });

		expect(health.rules.map((entry) => entry.rule)).toStrictEqual(['acme/multi-export']);
		expect(health.totals).toStrictEqual({ rules: 1, deterministic: 1, agent: 0 });
	});

	test('every loaded pack contributes rows, sorted by id across the packs together', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'lightsout-health-packs-'));

		const health = await buildStandardsHealth({
			cwd,
			groups: [
				...groupsOf({ pack: 'zeta/house', rules: [acmeStandardsRule({ id: 'module-folder-layout', name: 'zeta/module-folder-layout', library: 'zeta' })] }),
				...groupsOf({
					pack: 'alpha/house',
					rules: [acmeStandardsRule({ id: 'multi-export', name: 'alpha/multi-export', library: 'alpha', deterministic: true })],
				}),
			],
		});

		expect(health.rules.map((entry) => entry.rule)).toStrictEqual(['alpha/multi-export', 'zeta/module-folder-layout']);
		expect(health.totals).toStrictEqual({ rules: 2, deterministic: 1, agent: 1 });
	});

	test('health rows are keyed by full rule name and tally only full-name sites', async () => {
		const cwd = setupRefactorRun({
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
				rules: [acmeStandardsRule({ id: 'function-size', library: 'lightsout', name: 'lightsout/function-size', deterministic: true })],
			}),
		});

		// the short-named site matches no row, so only the full-name site is tallied
		expect(health.rules.map((entry) => ({ rule: entry.rule, attempted: entry.attempted, resolved: entry.resolved }))).toStrictEqual([
			{ rule: 'lightsout/function-size', attempted: 1, resolved: 1 },
		]);
	});

	test("buildStandardsHealth: rows follow the groups' packs, not the whole library", async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'lightsout-health-groups-'));
		const multiExport = acmeStandardsRule({ id: 'multi-export', deterministic: true });
		const moduleFolderLayout = acmeStandardsRule({ id: 'module-folder-layout' });
		const groups = [
			packStandardsGroup({ pack: 'acme/structure', rules: [multiExport], topicRuleIds: ['multi-export', 'left-out'] }),
			packStandardsGroup({ pack: 'acme/house', rules: [multiExport, moduleFolderLayout], topicRuleIds: ['multi-export', 'module-folder-layout', 'left-out'] }),
		];

		const health = await buildStandardsHealth({ cwd, groups });

		// a rule in both packs is one row; left-out sits in the topic, but neither pack brings it in, so it has none
		expect({ rules: health.rules.map((entry) => entry.rule), totals: health.totals }).toStrictEqual({
			rules: ['acme/module-folder-layout', 'acme/multi-export'],
			totals: { rules: 2, deterministic: 1, agent: 1 },
		});
	});
});
