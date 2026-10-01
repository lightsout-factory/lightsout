import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { parsePhaseDeclarations } from '#src/plan/parsePhaseDeclarations.ts';
import { parsePlan } from '#src/plan/parsePlan.ts';
import { syncPlanPhases } from '#src/plan/sections/syncPlanPhases.ts';
import { declaredRecord } from '#tests/helpers/declaredRecord.ts';
import { expectStatus } from '#tests/helpers/expectStatus.ts';
import { minimalPlanBody } from '#tests/helpers/minimalPlanBody.ts';
import { type DeclarationSpec, overviewBody, type PhaseSpec, phaseBody } from '#tests/helpers/phasePlan.ts';
import { writePhasedPlanDeliverable } from '#tests/helpers/writePhasedPlanDeliverable.ts';
import { writePlanDeliverable } from '#tests/helpers/writePlanDeliverable.ts';

// The runner behind `lightsout plan sync-phases`: once a phased plan's breakdown
// changes after drafting, it restates the overview's `## Phases` table and
// `## Phase Declarations` from the phase files. Any phase file, row, block or
// number that does not line up is refused, naming it, before a byte is written —
// fixing those is the caller's own edit.

/** The plan address every fixture is written under. */
const planName = 'lo-7-sync/001-phases';

/** The same overview with one phase's `### Phase <N>` block removed, its row left standing. */
const withoutBlock =
	({ file }: { file: string }) =>
	({ text }: { text: string }) => {
		const lines = text.split('\n');
		const start = lines.findIndex((line) => line.startsWith('### Phase ') && line.includes(`\`${file}\``));
		const end = lines.findIndex((line, index) => index > start && line.startsWith('#'));

		return [...lines.slice(0, start), ...lines.slice(end)].join('\n');
	};

/** The same overview carrying one more declaration block, for a file the `## Phases` table does not list. */
const withOrphanBlock =
	({ number, file }: { number: number; file: string }) =>
	({ text }: { text: string }) =>
		text.replace(
			'## Cross-Phase Dependencies',
			`### Phase ${number} — \`${file}\`\n\n- **Creates:** none\n- **Exports:** none\n- **Scripts:** none\n\n## Cross-Phase Dependencies`,
		);

/** A phased plan on disk: an overview built from `rows` (optionally hand-edited) beside one phase file per `phases` entry. */
const setupPhasedPlan = ({
	rows,
	phases,
	edit,
}: {
	rows: DeclarationSpec[];
	phases: Record<string, PhaseSpec>;
	edit?: (params: { text: string }) => string;
}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-sync-phases-'));
	const text = overviewBody({ rows });
	const overview = edit ? edit({ text }) : text;
	const phaseFiles = Object.fromEntries(Object.entries(phases).map(([base, spec]) => [base, phaseBody(spec)]));
	const dir = writePhasedPlanDeliverable({ cwd, name: planName, files: { 'overview.md': overview, ...phaseFiles } });

	return { cwd, overview, readOverview: () => readFileSync(join(dir, 'overview.md'), 'utf8') };
};

/** A single-plan deliverable, or — when `written` is false — an address whose folder holds no plan at all. */
const setupUnphasedPlan = ({ written }: { written: boolean }) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-sync-phases-'));

	if (written) {
		writePlanDeliverable({ cwd, name: planName, body: minimalPlanBody({ title: 'One Plan', creates: ['src/one.ts'] }) });
	}

	return { cwd };
};

/** What the overview's own parse says each phase declares — the row and the block read back together. */
const declarationsOf = ({ text }: { text: string }) =>
	declaredRecord({ declarations: parsePhaseDeclarations({ plan: parsePlan({ content: text, base: 'overview.md' }) }) });

describe('syncPlanPhases', () => {
	test("restates a changed phase's counts and budget in the overview", async () => {
		const plan = setupPhasedPlan({
			rows: [
				{ number: 1, file: 'phase1-core.md', created: 1, touched: 1 },
				{ number: 2, file: 'phase2-wire.md', created: 1, touched: 1 },
			],
			phases: {
				'phase1-core.md': { create: ['src/core.ts'] },
				'phase2-wire.md': { create: ['src/wire.ts', 'src/hook.ts'], modify: ['src/main.ts'], fileBudget: 5 },
			},
		});

		const result = await syncPlanPhases({ cwd: plan.cwd, name: planName });

		expectStatus(result, 'complete');
		// the second phase gained two files and a budget after drafting; its row
		// and block now say so, and the untouched first phase reads as it did
		expect({
			file: basename(result.file.path),
			updated: result.file.updated,
			declarations: declarationsOf({ text: plan.readOverview() }),
		}).toStrictEqual({
			file: 'overview.md',
			updated: true,
			declarations: [
				{
					number: 1,
					file: 'phase1-core.md',
					scope: 'the work',
					createdCount: 1,
					touchedCount: 1,
					creates: [],
					exports: [],
					scripts: [],
					fileBudget: undefined,
				},
				{
					number: 2,
					file: 'phase2-wire.md',
					scope: 'the work',
					createdCount: 2,
					touchedCount: 3,
					creates: [],
					exports: [],
					scripts: [],
					fileBudget: 5,
				},
			],
		});
	});

	const missingRowOrBlock: { rows: DeclarationSpec[]; phases: Record<string, PhaseSpec>; edit?: (params: { text: string }) => string; named: string }[] = [
		{
			rows: [
				{ number: 1, file: 'phase1-core.md', created: 1, touched: 1 },
				{ number: 2, file: 'phase2-wire.md', created: 1, touched: 1 },
			],
			phases: {
				'phase1-core.md': { create: ['src/core.ts'] },
				'phase2-wire.md': { create: ['src/wire.ts'] },
				'phase3-extra.md': { create: ['src/extra.ts'] },
			},
			named: 'phase3-extra.md',
		},
		{
			rows: [
				{ number: 1, file: 'phase1-core.md', created: 1, touched: 1 },
				{ number: 2, file: 'phase2-wire.md', created: 1, touched: 1 },
			],
			phases: { 'phase1-core.md': { create: ['src/core.ts'] }, 'phase2-wire.md': { create: ['src/wire.ts'] } },
			edit: withoutBlock({ file: 'phase2-wire.md' }),
			named: 'phase2-wire.md',
		},
	];

	test.each(missingRowOrBlock)('refuses a phase file missing its row or its declaration block, naming it and writing nothing', async ({ named, ...spec }) => {
		const plan = setupPhasedPlan(spec);

		const result = await syncPlanPhases({ cwd: plan.cwd, name: planName });

		expectStatus(result, 'failed');
		expect({ error: result.error, overview: plan.readOverview() }).toEqual({ error: expect.stringContaining(named), overview: plan.overview });
	});

	test.each([
		{
			rows: [
				{ number: 1, file: 'phase1-core.md', created: 1, touched: 1 },
				{ number: 2, file: 'phase2-ghost.md', created: 1, touched: 1 },
			],
			edit: undefined,
		},
		{
			rows: [{ number: 1, file: 'phase1-core.md', created: 1, touched: 1 }],
			edit: withOrphanBlock({ number: 2, file: 'phase2-ghost.md' }),
		},
	])('refuses a row or block naming a phase file that does not exist, naming it and writing nothing', async ({ rows, edit }) => {
		const plan = setupPhasedPlan({ rows, phases: { 'phase1-core.md': { create: ['src/core.ts'] } }, edit });

		const result = await syncPlanPhases({ cwd: plan.cwd, name: planName });

		expectStatus(result, 'failed');
		expect({ error: result.error, overview: plan.readOverview() }).toEqual({
			error: expect.stringContaining('phase2-ghost.md'),
			overview: plan.overview,
		});
	});

	const numberingCases: { rows: DeclarationSpec[]; phases: Record<string, PhaseSpec>; numbers: string }[] = [
		{
			rows: [
				{ number: 1, file: 'phase1-core.md', created: 1, touched: 1 },
				{ number: 3, file: 'phase3-wire.md', created: 1, touched: 1 },
			],
			phases: { 'phase1-core.md': { create: ['src/core.ts'] }, 'phase3-wire.md': { create: ['src/wire.ts'] } },
			numbers: '1, 3',
		},
		{
			rows: [
				{ number: 1, file: 'phase1-core.md', created: 1, touched: 1 },
				{ number: 1, file: 'phase1-wire.md', created: 1, touched: 1 },
			],
			phases: { 'phase1-core.md': { create: ['src/core.ts'] }, 'phase1-wire.md': { create: ['src/wire.ts'] } },
			numbers: '1, 1',
		},
	];

	test.each(numberingCases)('refuses a gap or a repeat in the phase numbering, writing nothing', async ({ rows, phases, numbers }) => {
		const plan = setupPhasedPlan({ rows, phases });

		const result = await syncPlanPhases({ cwd: plan.cwd, name: planName });

		expectStatus(result, 'failed');
		expect({ error: result.error, overview: plan.readOverview() }).toEqual({
			error: expect.stringContaining(`the phase numbers are ${numbers}`),
			overview: plan.overview,
		});
	});

	test('refuses a row whose number disagrees with its phase filename, writing nothing', async () => {
		const plan = setupPhasedPlan({
			rows: [
				{ number: 1, file: 'phase1-core.md', created: 1, touched: 1 },
				{ number: 2, file: 'phase3-split.md', created: 1, touched: 1 },
			],
			phases: { 'phase1-core.md': { create: ['src/core.ts'] }, 'phase3-split.md': { create: ['src/split.ts'] } },
		});

		const result = await syncPlanPhases({ cwd: plan.cwd, name: planName });

		expectStatus(result, 'failed');
		// every row and block lines up and the numbers run 1 to 2, so the only
		// thing left to refuse is the second row's number against its filename
		expect({ error: result.error, overview: plan.readOverview() }).toEqual({
			error: expect.stringContaining("phase 2 is declared in 'phase3-split.md'"),
			overview: plan.overview,
		});
	});

	test.each([
		{ written: true, error: expect.stringMatching(/phase breakdown/) },
		{ written: false, error: expect.stringContaining(`no plan found for '${planName}'`) },
	])('refuses a single plan and an address with no plan', async ({ written, error }) => {
		const plan = setupUnphasedPlan({ written });

		const result = await syncPlanPhases({ cwd: plan.cwd, name: planName });

		expect(result).toEqual({ status: 'failed', error });
	});
});
