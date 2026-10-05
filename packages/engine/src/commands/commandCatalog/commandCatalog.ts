import { doctorCatalogEntry } from '#src/commands/commandCatalog/doctorCatalogEntry.ts';
import { frictionCatalogEntry } from '#src/commands/commandCatalog/frictionCatalogEntry.ts';
import { implementCatalogEntry } from '#src/commands/commandCatalog/implementCatalogEntry/implementCatalogEntry.ts';
import { implementDirectCatalogEntry } from '#src/commands/commandCatalog/implementDirectCatalogEntry.ts';
import { improveCatalogEntry } from '#src/commands/commandCatalog/improveCatalogEntry.ts';
import { autoPlanCatalogEntry } from '#src/commands/commandCatalog/planning/autoPlanCatalogEntry.ts';
import { brainstormCatalogEntry } from '#src/commands/commandCatalog/planning/brainstormCatalogEntry.ts';
import { planCatalogEntry } from '#src/commands/commandCatalog/planning/planCatalogEntry/planCatalogEntry.ts';
import { queueCatalogEntry } from '#src/commands/commandCatalog/queueCatalogEntry.ts';
import { refactorCatalogEntry } from '#src/commands/commandCatalog/refactorCatalogEntry/refactorCatalogEntry.ts';
import { reportCatalogEntry } from '#src/commands/commandCatalog/reportCatalogEntry.ts';
import { resumeCatalogEntry } from '#src/commands/commandCatalog/resumeCatalogEntry.ts';
import { selfCheckCatalogEntry } from '#src/commands/commandCatalog/selfCheckCatalogEntry.ts';
import { shipCatalogEntry } from '#src/commands/commandCatalog/shipCatalogEntry.ts';
import { standardsCheckCatalogEntry } from '#src/commands/commandCatalog/standards/standardsCheckCatalogEntry.ts';
import { standardsHealthCatalogEntry } from '#src/commands/commandCatalog/standards/standardsHealthCatalogEntry.ts';
import { standardsValidateCatalogEntry } from '#src/commands/commandCatalog/standards/standardsValidateCatalogEntry.ts';
import { statusCatalogEntry } from '#src/commands/commandCatalog/statusCatalogEntry.ts';
import { stopCatalogEntry } from '#src/commands/commandCatalog/stopCatalogEntry.ts';
import { testCoverageToThresholdCatalogEntry } from '#src/commands/commandCatalog/testCoverageToThresholdCatalogEntry.ts';
import { ticketStateCatalogEntry } from '#src/commands/commandCatalog/ticketStateCatalogEntry.ts';
import { voiceCatalogEntry } from '#src/commands/commandCatalog/voiceCatalogEntry.ts';
import { workOrderCatalogEntry } from '#src/commands/commandCatalog/workOrderCatalogEntry.ts';
import type { CommandCatalogEntry } from '#src/contracts/commands/CommandCatalogEntry.ts';

/**
 * The CLI's usage text, the flag validator, the README infographics and the web
 * app's command pages all render from this array.
 *
 * In group order — build, burn down, standards, housekeeping — which is the
 * order the commands page reads them in.
 *
 * `related` is filled by rule: every other member of an entry's group, plus
 * these pairs — plan↔implement, implement↔resume, refactor↔standards-check,
 * test-coverage-to-threshold↔standards-check,
 * standards-validate↔standards-health, friction↔improve — each named from both
 * sides.
 *
 * Nothing in here imports a `.md` module, so scripts/buildWorkflowSpecs.mjs can
 * load this file under plain Node.
 */
export const commandCatalog: CommandCatalogEntry[] = [
	brainstormCatalogEntry,
	planCatalogEntry,
	autoPlanCatalogEntry,
	implementCatalogEntry,
	implementDirectCatalogEntry,
	resumeCatalogEntry,
	stopCatalogEntry,
	shipCatalogEntry,
	queueCatalogEntry,
	workOrderCatalogEntry,
	ticketStateCatalogEntry,
	selfCheckCatalogEntry,
	refactorCatalogEntry,
	testCoverageToThresholdCatalogEntry,
	standardsCheckCatalogEntry,
	standardsValidateCatalogEntry,
	standardsHealthCatalogEntry,
	statusCatalogEntry,
	reportCatalogEntry,
	doctorCatalogEntry,
	frictionCatalogEntry,
	improveCatalogEntry,
	voiceCatalogEntry,
];
