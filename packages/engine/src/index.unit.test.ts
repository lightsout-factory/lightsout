import { expect, test } from '@jest/globals';
import * as library from '#src/index.ts';

/**
 * The engine's library entry is a contract with its consumers, not an
 * implementation detail: a package importing `@lightsout/engine` gets exactly
 * this surface, and an export quietly dropped from the barrel is a break that
 * nothing else in this suite would notice until a consumer's build failed.
 *
 * This is the one barrel a dedicated test belongs on. What each of these things
 * DOES is proven by its own file's tests — nothing here reaches into one.
 */
test('the library entry exposes the readers, the run-state predicates, and the shapes their results are validated against', () => {
	expect(Object.keys(library).sort()).toStrictEqual([
		'AgentInvocation',
		'AgentUsage',
		'BatchReport',
		'CommandActor',
		'CommandCatalogEntry',
		'CommandFlag',
		'CommandGroup',
		'CommandInvocation',
		'CommandRecordKind',
		'CommandStep',
		'ConfigFieldView',
		'ConfigNotFoundError',
		'ConfigView',
		'FixtureSide',
		'FrictionArea',
		'FrictionRecord',
		'GateEvidence',
		'GateResult',
		'PhaseReport',
		'PlanDocument',
		'PlanDocumentKind',
		'PlanStage',
		'PlanWorkspaceFile',
		'PlanWorkspaceListing',
		'PlanWorkspaceNotFoundError',
		'PlanWorkspaceView',
		'RuleExample',
		'RuleExampleKind',
		'RunBurnDown',
		'RunBurnDownBatch',
		'RunBurnDownBatchOutcome',
		'RunListing',
		'RunManifest',
		'RunNotFoundError',
		'RunStatus',
		'RunStepView',
		'RunUsage',
		'RunView',
		'StandardsFinding',
		'StandardsPackBundle',
		'StandardsPackFixture',
		'StandardsPackListing',
		'StandardsPackRuleListing',
		'StandardsPackRuleNotFoundError',
		'StandardsPackRuleView',
		'StandardsPackView',
		'StandardsRuleView',
		'StandardsSeverity',
		'StandardsSnapshot',
		'StandardsTopicView',
		'StandardsTrendPoint',
		'StandardsView',
		'StepRecord',
		'WorkReport',
		'WritersReport',
		'commandCatalog',
		'getCommandCatalogEntry',
		'getConfigView',
		'getPlanDocument',
		'getPlanWorkspace',
		'getRunView',
		'getStandardsView',
		'isRunLive',
		'isRunResumable',
		'listPlanWorkspaces',
		'listRunIds',
		'listRuns',
		'listStandardsSnapshots',
		'readConfig',
		'readFriction',
		'readRunManifest',
		'spellFlag',
		'summarizeRun',
		'toStandardsPackRuleView',
		'toStandardsPackView',
	]);
});

test('every name arrived as the kind of value a consumer can use, rather than erasing to undefined', () => {
	// The failure this catches is a name that survives the list above and is
	// unusable anyway: a schema exported as a type erases at run time, and a
	// const object exported as a type takes its members with it. Each kind is
	// asked for the one thing that proves it crossed the boundary intact.
	const schemas = [
		library.AgentInvocation,
		library.AgentUsage,
		library.BatchReport,
		library.CommandCatalogEntry,
		library.CommandFlag,
		library.CommandInvocation,
		library.CommandStep,
		library.ConfigFieldView,
		library.ConfigView,
		library.FrictionRecord,
		library.GateEvidence,
		library.GateResult,
		library.PhaseReport,
		library.PlanDocument,
		library.PlanWorkspaceFile,
		library.PlanWorkspaceListing,
		library.PlanWorkspaceView,
		library.RunListing,
		library.RunManifest,
		library.RunStepView,
		library.RunUsage,
		library.RunView,
		library.StandardsFinding,
		library.StandardsPackBundle,
		library.StandardsPackFixture,
		library.StandardsPackListing,
		library.StandardsPackRuleListing,
		library.StandardsPackRuleView,
		library.StandardsPackView,
		library.StandardsRuleView,
		library.StandardsSnapshot,
		library.StandardsTopicView,
		library.StandardsTrendPoint,
		library.StandardsView,
		library.StepRecord,
		library.WorkReport,
		library.WritersReport,
	];
	const readers = [
		library.getCommandCatalogEntry,
		library.getConfigView,
		library.getPlanDocument,
		library.getPlanWorkspace,
		library.getRunView,
		library.getStandardsView,
		library.isRunLive,
		library.isRunResumable,
		library.listPlanWorkspaces,
		library.listRunIds,
		library.listRuns,
		library.listStandardsSnapshots,
		library.readConfig,
		library.readFriction,
		library.readRunManifest,
		library.spellFlag,
		library.summarizeRun,
		library.toStandardsPackRuleView,
		library.toStandardsPackView,
	];
	const constObjects = [
		library.CommandActor,
		library.CommandGroup,
		library.CommandRecordKind,
		library.FixtureSide,
		library.FrictionArea,
		library.PlanDocumentKind,
		library.PlanStage,
		library.RunStatus,
		library.StandardsSeverity,
	];

	expect({
		schemas: schemas.every((schema) => typeof schema?.safeParse === 'function'),
		readers: readers.every((reader) => typeof reader === 'function'),
		constObjects: constObjects.every((entry) => Object.values(entry ?? {}).length > 0),
		// the one export that is neither a schema nor a function: the catalog itself
		catalog: Array.isArray(library.commandCatalog) && library.commandCatalog.length > 0,
		// the errors a consumer catches by identity rather than by message
		errors: [
			new library.ConfigNotFoundError({ configPath: '/tmp/lightsout.config.json' }),
			new library.PlanWorkspaceNotFoundError({ name: 'add-search' }),
			new library.RunNotFoundError('x'),
			new library.StandardsPackRuleNotFoundError({ name: 'acme', rule: 'house-loose-file' }),
		].every((error) => error instanceof Error),
	}).toStrictEqual({ schemas: true, readers: true, constObjects: true, catalog: true, errors: true });
});

test('the library entry no longer exposes the standards readers that take pack groups', () => {
	// Both readers take StandardsGroup values, which no caller outside the engine
	// can build, so an export of either is a surface nobody can use.
	const exportedNames = Object.keys(library);

	expect({
		listStandardsRules: exportedNames.includes('listStandardsRules'),
		buildStandardsHealth: exportedNames.includes('buildStandardsHealth'),
	}).toStrictEqual({ listStandardsRules: false, buildStandardsHealth: false });
});
