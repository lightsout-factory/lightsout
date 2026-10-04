import { expect, test } from '@jest/globals';
import { buildFocusedPlanWriterInvocation } from '#src/agents/plan/buildFocusedPlanWriterInvocation/buildFocusedPlanWriterInvocation.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { PlanVariant } from '#src/contracts/plan/draft/PlanVariant.ts';
import { planTemplateOf } from '#tests/helpers/planTemplateOf.ts';
import { planFacts } from '#tests/helpers/planWriterInputs.ts';

// Which focused template a spawn is handed, what the focused role prompt asks
// for in place of the two instructions this role exists to remove, and which
// repeated sections the focused prose hands to the engine.

/** A one-row decisions record keyed by a distinctive plan name, so the assembled prompt is a realistic one. */
const focusedDecisions = (): DecisionsRecord => ({
	planName: 'foo-endpoint',
	decisions: [{ source: 'Elicitation', question: 'Which route?', options: 'a / b', choice: 'a', rationale: 'shortest path', assumption: false }],
});

/** One focused spawn assembled from the minimum inputs, with whatever a case varies laid over them. */
const setupFocusedInvocation = (
	overrides: Partial<Parameters<typeof buildFocusedPlanWriterInvocation>[0]> = {},
): ReturnType<typeof buildFocusedPlanWriterInvocation> =>
	buildFocusedPlanWriterInvocation({
		facts: planFacts(),
		decisions: focusedDecisions(),
		outputs: [{ path: '/repo/.lightsout/work-orders/foo/plans/plan.md', variant: PlanVariant.Single }],
		limits: { executorFileLimit: 50, createdFileCeiling: 30, touchedFileCeiling: 70 },
		...overrides,
	});

/** The role prompt alone, cut where the labelled template section begins. */
const rolePromptOf = (systemPrompt: string): string => systemPrompt.slice(0, systemPrompt.indexOf('\n\n---\n\n# Plan Template\n\n'));

/** Every `## Global Constraints` block a template carries, each cut at the next section heading. */
const globalConstraintsBlocks = (template: string): string[] =>
	template
		.split('\n## Global Constraints\n')
		.slice(1)
		.map((rest) => {
			const end = rest.indexOf('\n## ');

			return end === -1 ? rest : rest.slice(0, end);
		});

/** The rules-list bullet that speaks for `## Global Constraints`, cut out of the template's shared rules block. */
const globalConstraintsRule = (template: string): string => {
	const [rules] = template.split('\n\n---\n\n');

	return (
		rules
			.split('\n- **')
			.slice(1)
			.find((bullet) => bullet.includes('Global Constraints')) ?? ''
	);
};

/**
 * The assignment brief alone — everything the builder pushed between the output
 * lines and the decisions record. A spawn given no evidence, no collisions, no
 * declared docs, no ledger and no standards has that one brief in the span and
 * nothing else, so this reads the brief without depending on its heading.
 */
const assignmentBriefOf = (prompt: string): string =>
	prompt.slice(prompt.indexOf('\n\n## ', prompt.indexOf('## Output files')), prompt.indexOf('\n\n## Decisions record'));

test('the focused templates split on plan.contract, and the narrative one carries no ledger sections', () => {
	const contractSpawn = setupFocusedInvocation({ contract: true });
	const narrativeSpawn = setupFocusedInvocation();

	const contractTemplate = planTemplateOf(contractSpawn);
	const narrativeTemplate = planTemplateOf(narrativeSpawn);

	expect({
		// the two rules and the two skeletons only the contract shape carries
		contractCarriesTheLedgerRule: /Behaviour lives in the ledger/i.test(contractTemplate),
		contractCarriesTheCriterionRule: /A criterion is a testable sentence/i.test(contractTemplate),
		contractCarriesTheLedgerSkeleton: contractTemplate.includes('## Acceptance Tests'),
		contractCarriesProseFiles: contractTemplate.includes('## Prose Files'),
		// and the brief that tells the writer how to fill them
		contractPromptCarriesTheLedgerBrief: contractSpawn.prompt.includes('## Acceptance-test ledger'),
		// a narrative repository sees none of the four, and no ledger text at all
		narrativeCarriesTheLedgerSkeleton: narrativeTemplate.includes('## Acceptance Tests'),
		narrativeCarriesProseFiles: narrativeTemplate.includes('## Prose Files'),
		narrativeCarriesTheLedgerRule: /Behaviour lives in the ledger/i.test(narrativeTemplate),
		narrativePromptCarriesTheLedgerBrief: narrativeSpawn.prompt.includes('## Acceptance-test ledger'),
		// and neither template reaches a writer with a token still standing
		contractLeavesAStandingToken: contractTemplate.includes('{{'),
		narrativeLeavesAStandingToken: narrativeTemplate.includes('{{'),
	}).toEqual({
		contractCarriesTheLedgerRule: true,
		contractCarriesTheCriterionRule: true,
		contractCarriesTheLedgerSkeleton: true,
		contractCarriesProseFiles: true,
		contractPromptCarriesTheLedgerBrief: true,
		narrativeCarriesTheLedgerSkeleton: false,
		narrativeCarriesProseFiles: false,
		narrativeCarriesTheLedgerRule: false,
		narrativePromptCarriesTheLedgerBrief: false,
		contractLeavesAStandingToken: false,
		narrativeLeavesAStandingToken: false,
	});
});

test('both focused templates hand Global Constraints to the engine instead of the writer', () => {
	const narrativeTemplate = planTemplateOf(setupFocusedInvocation());
	const contractTemplate = planTemplateOf(setupFocusedInvocation({ contract: true }));

	const narrativeBlocks = globalConstraintsBlocks(narrativeTemplate);
	const contractBlocks = globalConstraintsBlocks(contractTemplate);

	const blocks = [...narrativeBlocks, ...contractBlocks];

	expect({
		// the section is still part of every plan variant that carries a skeleton
		narrativeKeepsTheSection: narrativeBlocks.length > 0,
		contractKeepsTheSection: contractBlocks.length > 0,
		// every block says the same thing its Decision Log neighbour says
		everyBlockNamesTheEngine: blocks.every((block) => /engine/i.test(block)),
		// and none of them still offers a placeholder bullet for a writer to fill
		aBlockAsksTheWriterForABullet: blocks.some((block) => block.includes('- <constraint')),
		// the shared rules list agrees with the skeletons
		narrativeRuleNamesTheEngine: /engine/i.test(globalConstraintsRule(narrativeTemplate)),
		contractRuleNamesTheEngine: /engine/i.test(globalConstraintsRule(contractTemplate)),
		// and neither template still sends the writer to the decision prefix that
		// selects the rows — the engine reads that record now, so a writer acting
		// on it would author a section the engine immediately replaces
		aTemplateNamesTheDecisionPrefix: narrativeTemplate.includes('Global constraint:') || contractTemplate.includes('Global constraint:'),
	}).toEqual({
		narrativeKeepsTheSection: true,
		contractKeepsTheSection: true,
		everyBlockNamesTheEngine: true,
		aBlockAsksTheWriterForABullet: false,
		narrativeRuleNamesTheEngine: true,
		contractRuleNamesTheEngine: true,
		aTemplateNamesTheDecisionPrefix: false,
	});
});

test('the focused role prompt replaces re-reading and per-symbol searching with the evidence contract', () => {
	const { systemPrompt } = setupFocusedInvocation();

	const role = rolePromptOf(systemPrompt);

	expect({
		// no order to read every recorded path again before writing
		ordersAReReadOfTheRecordedPaths: /read each `filesToModify` and `patternsToMirror` path/i.test(role),
		// no order to run one repository search per proposed new symbol
		ordersASearchPerProposedSymbol: /before proposing any newly-created exported symbol, search/i.test(role),
		// what stands in their place
		namesTheCollectedEvidence: /evidence/i.test(role),
		saysReReadingIsTheCostItRemoves: /re-read/i.test(role),
		namesTheCensus: /census/i.test(role),
		// the evidence contract's stopping rule, and the one check it keeps
		namesAnUnresolvedDiscrepancy: /discrepanc/i.test(role),
		stopsRatherThanGuessing: /terminate|stop the draft|stops the draft/i.test(role),
		stillConfirmsACreatedFileIsAbsent: /already exist/i.test(role),
	}).toEqual({
		ordersAReReadOfTheRecordedPaths: false,
		ordersASearchPerProposedSymbol: false,
		namesTheCollectedEvidence: true,
		saysReReadingIsTheCostItRemoves: true,
		namesTheCensus: true,
		namesAnUnresolvedDiscrepancy: true,
		stopsRatherThanGuessing: true,
		stillConfirmsACreatedFileIsAbsent: true,
	});
});

test('the focused overview brief hands the phase row and declaration pairing to the engine', () => {
	const { prompt } = setupFocusedInvocation({
		outputs: [{ path: '/repo/.lightsout/work-orders/foo/plans/overview.md', variant: PlanVariant.Overview }],
	});

	const brief = assignmentBriefOf(prompt);

	expect({
		// the brief still names both views of the phase record
		namesThePhasesTable: brief.includes('## Phases'),
		namesThePhaseDeclarations: /Phase Declarations|### Phase <N>/.test(brief),
		// and says the engine is what makes the two agree
		saysTheEngineNormalisesThePairing: /engine/i.test(brief) && /normalis|normaliz/i.test(brief),
		// so the writer is not asked to check one copy against the other by hand
		repeatsTheHandReconciliationRule: brief.includes('each filename agrees with its number'),
	}).toEqual({
		namesThePhasesTable: true,
		namesThePhaseDeclarations: true,
		saysTheEngineNormalisesThePairing: true,
		repeatsTheHandReconciliationRule: false,
	});
});

test('the focused contract template states the touched-file ceiling from limits', () => {
	const template = planTemplateOf(
		setupFocusedInvocation({ contract: true, limits: { executorFileLimit: 50, createdFileCeiling: 30, touchedFileCeiling: 45 } }),
	);

	const [rules = ''] = template.split('\n\n---\n\n');
	const touchedRule = rules.split('\n- **').find((bullet) => bullet.startsWith('Touched files counted')) ?? '';
	const fileBudgetSection = template.split('\n## File Budget\n')[1]?.split('\n## ')[0] ?? '';
	const declarationsNoteStart = template.indexOf('never raises the created-file ceiling');
	const declarationsNote = declarationsNoteStart === -1 ? '' : template.slice(declarationsNoteStart, template.indexOf('\n\n', declarationsNoteStart));

	expect({
		// the touched ceiling reaches the writer as the configured number in all three places it is stated
		touchedRuleStatesTheCeiling: /\b45\b/.test(touchedRule),
		fileBudgetSectionStatesTheCeiling: /\b45\b/.test(fileBudgetSection),
		declarationsNoteStatesTheCeiling: /\b45\b/.test(declarationsNote),
		// and no token survives into what the agent reads
		leavesAStandingToken: template.includes('{{'),
		leavesTheTokenName: template.includes('touchedFileCeiling'),
	}).toEqual({
		touchedRuleStatesTheCeiling: true,
		fileBudgetSectionStatesTheCeiling: true,
		declarationsNoteStatesTheCeiling: true,
		leavesAStandingToken: false,
		leavesTheTokenName: false,
	});
});

/** The template's shared rules list, one entry per `- **` bullet, each starting at its bold title. */
const rulesBulletsOf = (template: string): string[] => {
	const [rules = ''] = template.split('\n\n---\n\n');

	return rules.split('\n- **').slice(1);
};

/** The first skeleton section under `heading`, cut at the next `## ` heading. */
const skeletonSectionOf = (template: string, heading: string): string => template.split(`\n${heading}\n`)[1]?.split('\n## ')[0] ?? '';

/** The heading of the skeleton section that directly follows the first `heading` section. */
const headingAfter = (template: string, heading: string): string => {
	const rest = template.split(`\n${heading}\n`)[1] ?? '';
	const next = rest.indexOf('\n## ');

	return next === -1 ? '' : (rest.slice(next + 1).split('\n')[0] ?? '');
};

/** The overview's Phase Declarations note: the HTML comment that states the created-file ceiling is never raised. */
const declarationsNoteOf = (template: string): string => {
	const anchor = template.indexOf('never raises the created-file ceiling');

	return anchor === -1 ? '' : template.slice(template.lastIndexOf('<!--', anchor), template.indexOf('-->', anchor));
};

/** Which rename-only and move-folders-and-files passages one focused template carries. */
const buildModePassagesOf = (template: string) => {
	const bullets = rulesBulletsOf(template);
	const touchedRule = bullets.find((bullet) => bullet.startsWith('Touched files counted')) ?? '';
	const renameIndex = bullets.findIndex((bullet) => bullet.startsWith('Rename-only phases.'));
	const moveBullet = bullets[renameIndex + 1] ?? '';
	const earlierPhaseRule = bullets.find((bullet) => bullet.startsWith('Earlier-phase files have their own heading')) ?? '';
	const filesToMove = skeletonSectionOf(template, '## Files to Move');
	const fileBudget = skeletonSectionOf(template, '## File Budget');
	const buildModeSection = skeletonSectionOf(template, '## Build Mode');
	const declarationsNote = declarationsNoteOf(template);

	return {
		// the touched-files rule keeps the rename-only exemption and names the second one beside it
		touchedRuleNamesTheRenamesExemption: touchedRule.includes('## Renames') && touchedRule.includes('**Renames only:** yes'),
		touchedRuleNamesTheMoveExemption: touchedRule.includes('## Build Mode') && touchedRule.includes('move-folders-and-files'),
		touchedRuleCountsAFolderMove: /folder move/i.test(touchedRule),
		// a file a folder move carried is named by its new path under the earlier-phase heading
		earlierPhaseRuleNamesAFolderMove: /folder move/i.test(earlierPhaseRule),
		// the rename-only bullet stays, and the move-folders-and-files bullet follows it directly
		keepsTheRenameOnlyBullet: renameIndex !== -1,
		moveBulletFollowsTheRenameOnlyBullet: moveBullet.startsWith('Move-folders-and-files phases.'),
		moveBulletNamesTheBuildModeSection: moveBullet.includes('## Build Mode') && moveBullet.includes('move-folders-and-files'),
		// the Files to Move skeleton shows a folder heading beside the file one
		filesToMoveCarriesAFolderHeading: /^### `[^`]*\/` → `[^`]*\/`$/m.test(filesToMove),
		filesToMoveKeepsAFileHeading: /^### `[^`]*[^/`]` → `[^`]*[^/`]`$/m.test(filesToMove),
		// the File Budget note exempts both mechanical modes from the touched ceiling
		fileBudgetNamesBothModes: /rename-only/i.test(fileBudget) && fileBudget.includes('move-folders-and-files'),
		// a Build Mode skeleton section sits directly after Renames and names the mode
		carriesABuildModeSection: buildModeSection.includes('move-folders-and-files'),
		buildModeFollowsRenames: headingAfter(template, '## Renames') === '## Build Mode',
		// the declarations note names both overview bullets
		declarationsNoteNamesRenamesOnly: declarationsNote.includes('**Renames only:** yes'),
		declarationsNoteNamesMovesOnly: declarationsNote.includes('**Moves folders and files only:** yes'),
		// and no size token reaches the writer
		leavesAStandingToken: template.includes('{{'),
	};
};

test('both focused templates describe folder moves and the move-folders-and-files mode beside the rename-only rules', () => {
	const contractTemplate = planTemplateOf(setupFocusedInvocation({ contract: true }));
	const narrativeTemplate = planTemplateOf(setupFocusedInvocation());

	const acceptanceComment = skeletonSectionOf(contractTemplate, '## Acceptance Tests');

	const expectedPassages = {
		touchedRuleNamesTheRenamesExemption: true,
		touchedRuleNamesTheMoveExemption: true,
		touchedRuleCountsAFolderMove: true,
		earlierPhaseRuleNamesAFolderMove: true,
		keepsTheRenameOnlyBullet: true,
		moveBulletFollowsTheRenameOnlyBullet: true,
		moveBulletNamesTheBuildModeSection: true,
		filesToMoveCarriesAFolderHeading: true,
		filesToMoveKeepsAFileHeading: true,
		fileBudgetNamesBothModes: true,
		carriesABuildModeSection: true,
		buildModeFollowsRenames: true,
		declarationsNoteNamesRenamesOnly: true,
		declarationsNoteNamesMovesOnly: true,
		leavesAStandingToken: false,
	};

	expect({
		contract: buildModePassagesOf(contractTemplate),
		narrative: buildModePassagesOf(narrativeTemplate),
		// the contract skeleton's ledger comment asks no rows of either mechanical mode
		contractAcceptanceCommentNamesBothModes: /rename-only/i.test(acceptanceComment) && acceptanceComment.includes('move-folders-and-files'),
	}).toEqual({
		contract: expectedPassages,
		narrative: expectedPassages,
		contractAcceptanceCommentNamesBothModes: true,
	});
});
