import { expect, test } from '@jest/globals';
import { buildFocusedPlanWriterInvocation } from '#src/agents/plan/buildFocusedPlanWriterInvocation/buildFocusedPlanWriterInvocation.ts';
import { BuildMode } from '#src/common/constants/BuildMode.ts';
import type { PhaseDeclaration } from '#src/common/types/PhaseDeclaration.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { planFacts } from '#tests/helpers/planWriterInputs.ts';

// The touched-file ceiling: where the configured number is substituted, and how
// the phase-authoring brief states it beside the build modes it exempts.

type FocusedParams = Parameters<typeof buildFocusedPlanWriterInvocation>[0];

/** A one-row decisions record keyed by a distinctive plan name, so the assembled prompt is a realistic one. */
const planDecisions = (): DecisionsRecord => ({
	planName: 'foo-endpoint',
	decisions: [{ source: 'Elicitation', question: 'Which route?', options: 'a / b', choice: 'a', rationale: 'shortest path', assumption: false }],
});

/** One overview declaration row, as `parsePhaseDeclarations` returns it. */
const declarationRow = (): PhaseDeclaration => ({
	number: 2,
	file: 'phase2-wiring.md',
	scope: 'wire it up',
	createdCount: 3,
	touchedCount: 9,
	creates: ['src/wiring.ts'],
	exports: ['wireItUp'],
	scripts: [],
});

/** One focused single-plan spawn's inputs, with whatever a case varies laid over them. */
const setupFocusedDraft = (overrides: Partial<FocusedParams> = {}): FocusedParams => ({
	facts: planFacts(),
	decisions: planDecisions(),
	outputs: [{ path: '/repo/.lightsout/work-orders/foo/plans/plan.md', variant: 'single' }],
	limits: { executorFileLimit: 50, createdFileCeiling: 30, touchedFileCeiling: 70 },
	...overrides,
});

/** The template's touched-files rule bullet, from its bold label up to the next rule bullet. */
const touchedFilesRule = ({ systemPrompt }: { systemPrompt: string }): string => {
	const start = systemPrompt.indexOf('- **Touched files counted and declared.**');

	return systemPrompt.slice(start, systemPrompt.indexOf('\n- **', start + 1));
};

/** The phase brief's own bullet lines, stopping before the inlined overview so its text cannot match. */
const phaseAuthoringBullets = ({ prompt }: { prompt: string }): string[] =>
	prompt
		.slice(prompt.indexOf('## Phase authoring'), prompt.indexOf('### The settled overview'))
		.split('\n')
		.filter((line) => line.startsWith('- '));

test('buildFocusedPlanWriterInvocation: the touched-file ceiling is substituted from limits', () => {
	const params = setupFocusedDraft({ limits: { executorFileLimit: 80, createdFileCeiling: 12, touchedFileCeiling: 45 } });

	const invocation = buildFocusedPlanWriterInvocation(params);

	// the configured number reaches the rule that refuses a plan touching more files
	expect(touchedFilesRule({ systemPrompt: invocation.systemPrompt })).toMatch(/\b45\b/);
	// and no token is left standing for a written plan to copy
	expect(invocation.systemPrompt.includes('{{')).toBeFalsy();
	expect(invocation.systemPrompt.includes('touchedFileCeiling')).toBeFalsy();
});

test('buildFocusedPlanWriterInvocation: a phase spawn is told the touched ceiling among its hard limits', () => {
	const params = setupFocusedDraft({
		outputs: [{ path: '/repo/.lightsout/work-orders/foo/plans/phase2-wiring.md', variant: 'phase' }],
		overviewText: '# Foo — Overview\n\nOVERVIEW-SENTINEL',
		declaration: declarationRow(),
		limits: { executorFileLimit: 80, createdFileCeiling: 12, touchedFileCeiling: 45 },
	});

	const invocation = buildFocusedPlanWriterInvocation(params);

	// the one brief bullet stating the number is the hard-limits one, and it names
	// the touched ceiling and the rename-only exemption beside that number
	const ceilingBullets = phaseAuthoringBullets({ prompt: invocation.prompt }).filter((line) => /\b45\b/.test(line));
	expect(ceilingBullets.length).toBe(1);
	expect(ceilingBullets[0]).toMatch(/hard limit/i);
	expect(ceilingBullets[0]).toMatch(/touched-file ceiling/i);
	expect(ceilingBullets[0]).toMatch(/rename-only/i);
});

/** One phase spawn per declared build mode — move-folders-and-files, renames-only and none — over a distinctive touched ceiling. */
const setupBuildModeSpawns = (): FocusedParams[] =>
	[{ buildMode: BuildMode.MoveFoldersAndFiles }, { buildMode: BuildMode.RenamesOnly }, {}].map((mode: Pick<PhaseDeclaration, 'buildMode'>) =>
		setupFocusedDraft({
			outputs: [{ path: '/repo/.lightsout/work-orders/foo/plans/phase2-wiring.md', variant: 'phase' }],
			overviewText: '# Foo — Overview\n\nOVERVIEW-SENTINEL',
			declaration: { ...declarationRow(), ...mode },
			limits: { executorFileLimit: 80, createdFileCeiling: 12, touchedFileCeiling: 45 },
		}),
	);

/** What one brief says of its build mode: the mode bullet's claims (a standard one names both sections to rule them out) and the ceiling bullet's exemptions. */
const buildModeClaims = ({ prompt }: { prompt: string }) => {
	const mode = phaseAuthoringBullets({ prompt })
		.filter((line) => !/\b45\b/.test(line) && /`## (Renames|Build Mode)`/.test(line))
		.join('\n');

	return {
		namesBuildModeSection: mode.includes('`## Build Mode`'),
		readsMoveMode: mode.includes('move-folders-and-files'),
		noRenamesSection: /\bno `## Renames`/.test(mode),
		renameOnly: mode.includes('**rename-only**'),
		ceilingExemptsBoth: phaseAuthoringBullets({ prompt }).some(
			(line) => /\b45\b/.test(line) && /rename-only/i.test(line) && /move-folders-and-files/i.test(line),
		),
	};
};

test('buildFocusedPlanWriterInvocation: the phase-authoring brief states the declared build mode and both modes exempt from the touched ceiling', () => {
	const spawns = setupBuildModeSpawns();

	const prompts = spawns.map((params) => buildFocusedPlanWriterInvocation(params).prompt);

	expect(prompts.map((prompt) => buildModeClaims({ prompt }))).toStrictEqual([
		{ namesBuildModeSection: true, readsMoveMode: true, noRenamesSection: true, renameOnly: false, ceilingExemptsBoth: true },
		{ namesBuildModeSection: false, readsMoveMode: false, noRenamesSection: false, renameOnly: true, ceilingExemptsBoth: true },
		{ namesBuildModeSection: true, readsMoveMode: false, noRenamesSection: true, renameOnly: false, ceilingExemptsBoth: true },
	]);
});
