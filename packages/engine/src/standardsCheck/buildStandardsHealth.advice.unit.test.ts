// The advice half of the health report, split from buildStandardsHealth.unit.test.ts
// when that file passed the test-file line cap. Its fixtures are its own: the
// rule that forced the split says each half carries what it needs, and test
// files are exempt from the duplication rules for exactly this reason.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { BatchReport } from '#src/contracts/refactor/BatchReport.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { AdvisoryOutcome } from '#src/contracts/standardsCheck/AdvisoryOutcome.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { buildStandardsHealth } from '#src/standardsCheck/buildStandardsHealth.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
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

/** One group whose pack brings in exactly `rules`, each at its rule.md default. */
const groupOf = ({ rules }: { rules: LoadedStandardsRule[] }): StandardsGroup => ({
	packages: [''],
	pack: {
		name: 'acme/house',
		topics: [],
		rules: rules.map((entry) => ({ rule: entry, severity: entry.defaultSeverity, options: entry.defaultOptions })),
		conditionalPacks: [],
		inactiveRules: [],
	},
	states: new Map<string, ResolvedRuleState>(
		rules.map((entry) => [entry.name, { severity: entry.defaultSeverity, options: entry.defaultOptions, fromConfig: false, reachesAgents: true }]),
	),
});

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

describe('buildStandardsHealth advice counting', () => {
	test('advisory outcomes are counted apart from the blocking sites, with their decline reasons', async () => {
		const cwd = setupRun({
			batches: [batch({ id: 'batch-01', blocking: [finding({ rule: 'acme/multi-export', path: 'src/a.ts' })] })],
			reports: {
				'batch-01': report({
					outcome: 'resolved',
					advisoryOutcomes: [
						advice({ rule: 'acme/object-args', siteKey: 'acme/object-args:src/a.ts', outcome: 'declined', reason: 'a callback type fixes the signature' }),
						advice({ rule: 'acme/object-args', siteKey: 'acme/object-args:src/b.ts', outcome: 'applied' }),
					],
				}),
			},
		});

		const health = await buildStandardsHealth({
			cwd,
			groups: [groupOf({ rules: [rule({ id: 'multi-export', deterministic: true }), rule({ id: 'object-args' })] })],
		});

		expect(rowFor({ rules: health.rules, id: 'object-args' })).toEqual(
			expect.objectContaining({ attempted: 0, adviceApplied: 1, adviceDeclined: 1, reasons: ['a callback type fixes the signature'] }),
		);
		// and the blocking account is untouched by them
		expect(rowFor({ rules: health.rules, id: 'multi-export' })).toEqual(expect.objectContaining({ attempted: 1, adviceApplied: 0, adviceDeclined: 0 }));
	});

	test('advice the code already met is counted apart from both taking it and rejecting it', async () => {
		const cwd = setupRun({
			batches: [batch({ id: 'batch-01', blocking: [] })],
			reports: {
				'batch-01': report({
					outcome: 'resolved',
					advisoryOutcomes: [
						advice({ rule: 'acme/object-args', siteKey: 'acme/object-args:src/a.ts', outcome: 'already-met' }),
						advice({ rule: 'acme/object-args', siteKey: 'acme/object-args:src/b.ts', outcome: 'applied' }),
					],
				}),
			},
		});

		const health = await buildStandardsHealth({ cwd, groups: [groupOf({ rules: [rule({ id: 'object-args' })] })] });

		// counting it as applied would credit the rule with advice nobody acted
		// on; counting it as declined would blame it for a rejection nobody made
		expect(rowFor({ rules: health.rules, id: 'object-args' })).toEqual(
			expect.objectContaining({ adviceApplied: 1, adviceDeclined: 0, adviceAlreadyMet: 1, reasons: [] }),
		);
	});

	test('advice declined with no reason still counts, and adds no empty line to the reasons', async () => {
		const cwd = setupRun({
			batches: [batch({ id: 'batch-01', blocking: [] })],
			reports: {
				'batch-01': report({
					outcome: 'resolved',
					advisoryOutcomes: [advice({ rule: 'acme/object-args', siteKey: 'acme/object-args:src/a.ts', outcome: 'declined' })],
				}),
			},
		});

		const health = await buildStandardsHealth({ cwd, groups: [groupOf({ rules: [rule({ id: 'object-args' })] })] });

		expect(rowFor({ rules: health.rules, id: 'object-args' })).toEqual(expect.objectContaining({ adviceApplied: 0, adviceDeclined: 1, reasons: [] }));
	});
});
