import { describe, expect, test } from '@jest/globals';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import { checkBuildMode } from '#src/plan/lint/internal/checkBuildMode.ts';
import { parsePlan } from '#src/plan/parsePlan.ts';
import { type PhaseSpec, phaseBody } from '#tests/helpers/phasePlan.ts';

/** The phase file every case labels its findings with. */
const phase = 'phase1-demo.md';

/** One well-formed Acceptance Tests row, appended when a case wants the plan to state one. */
const ledgerSection = `
## Acceptance Tests

| Criterion | Test file | Test name | Gate |
|---|---|---|---|
| the parser reads a row | \`src/parse.unit.test.ts\` | reads a row | test |
`;

/** A `## Build Mode` section whose body is `body`, appended after the rest of the phase file. */
const buildModeSection = ({ body }: { body: string }) => `
## Build Mode

${body}
`;

/** The section that marks a phase file move-folders-and-files. */
const moveModeSection = buildModeSection({ body: 'move-folders-and-files' });

/** One file move, the only work a move-folders-and-files file lists. */
const move = [{ from: 'src/alpha/parse.ts', to: 'src/omega/parse.ts' }];

/**
 * Each phase file built from its `spec`, with any raw sections appended after
 * it — the way a case writes a Build Mode section or a ledger row the helper
 * does not render — parsed as the lint parses it.
 */
const setupPlans = ({ files }: { files: { spec?: PhaseSpec; appended?: string }[] }) => {
	const plans = files.map(({ spec = {}, appended = '' }) => parsePlan({ content: `${phaseBody(spec)}${appended}`, base: phase }));

	return { plans };
};

/** Each finding as the fields the cases assert on; the issue and fix wording is human-facing and left free. */
const reported = ({ plan }: { plan: ReturnType<typeof parsePlan> }) =>
	checkBuildMode({ plan, phase }).map(({ check, severity, phase: label, location }) => ({ check, severity, phase: label, location }));

/** The one finding shape every build-mode defect takes: blocking, at this phase's Build Mode section. */
const buildModeFinding = {
	check: StructuralCheck.BuildModeWellFormed,
	severity: FindingSeverity.Blocking,
	phase,
	location: `${phase} → Build Mode`,
};

describe('checkBuildMode', () => {
	test('checkBuildMode: a move-only file, a rename-only file and a standard file are all silent', () => {
		const { plans } = setupPlans({
			files: [
				{ spec: { move }, appended: moveModeSection },
				{ spec: { modify: ['src/alpha.ts'], renames: [{ from: 'alpha', to: 'omega' }] } },
				{ spec: { create: ['src/parse.ts'], modify: ['src/alpha.ts'] }, appended: ledgerSection },
			],
		});

		const findings = plans.map((plan) => reported({ plan }));

		expect(findings).toStrictEqual([[], [], []]);
	});

	test('checkBuildMode: a Build Mode section naming no known mode is one blocking finding at the section', () => {
		const { plans } = setupPlans({
			files: [
				{
					spec: { create: ['src/parse.ts'], modify: ['src/alpha.ts'] },
					appended: `${ledgerSection}${buildModeSection({ body: 'teleport-everything' })}`,
				},
			],
		});

		const findings = plans.map((plan) => reported({ plan }));

		expect(findings).toStrictEqual([[buildModeFinding]]);
	});

	test('checkBuildMode: a move-folders-and-files file earns one blocking finding per kind of work it may not list', () => {
		const { plans } = setupPlans({
			files: [
				{
					spec: {
						move,
						create: ['src/parse.ts', 'src/format.ts'],
						modify: ['src/alpha.ts'],
						earlierModify: ['src/beta.ts'],
						remove: ['src/gamma.ts'],
						renames: [{ from: 'alpha', to: 'omega' }],
					},
					appended: `${ledgerSection}${moveModeSection}`,
				},
				{ spec: { move, earlierModify: ['src/beta.ts'] }, appended: moveModeSection },
				{ spec: { move, create: ['src/parse.ts', 'src/format.ts'] }, appended: moveModeSection },
			],
		});

		const findings = plans.map((plan) => reported({ plan }));

		expect(findings).toStrictEqual([
			[buildModeFinding, buildModeFinding, buildModeFinding, buildModeFinding, buildModeFinding],
			[buildModeFinding],
			[buildModeFinding],
		]);
	});
});
