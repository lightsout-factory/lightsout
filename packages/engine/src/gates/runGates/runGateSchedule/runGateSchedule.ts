import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { GateScheduleKind } from '#src/common/constants/GateScheduleKind.ts';
import type { GateRunResult } from '#src/common/types/GateRunResult.ts';
import type { GateSchedule } from '#src/common/types/GateSchedule.ts';
import type { GateResult } from '#src/contracts/gates/GateResult.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { buildGateEntries } from '#src/gates/common/buildGateEntries.ts';
import { buildGateStages } from '#src/gates/common/buildGateStages.ts';
import { resolveGates } from '#src/gates/common/resolveGates.ts';
import { rootGateCommands } from '#src/gates/common/rootGateCommands.ts';
import type { GateEntry } from '#src/gates/common/types/GateEntry.ts';
import { GateEnding } from '#src/gates/runGates/common/constants/GateEnding.ts';
import { stageCountOf } from '#src/gates/runGates/common/stageCountOf.ts';
import type { RunGate } from '#src/gates/runGates/common/types/RunGate.ts';
import { describeGateCrash } from '#src/gates/runGates/runGateSchedule/common/describeGateCrash.ts';
import { describeGateTimeout } from '#src/gates/runGates/runGateSchedule/common/describeGateTimeout.ts';
import { runGateSet } from '#src/gates/runGates/runGateSchedule/common/runGateSet.ts';
import { mergeGateRunResults } from '#src/gates/runGates/runGateSchedule/mergeGateRunResults.ts';
import { runPackageGates } from '#src/gates/runGates/runGateSchedule/runPackageGates.ts';

/**
 * Runs once, before any group fans out: generate mutates, and parallel
 * per-package gates must never race a generator. So it is a precondition of
 * running gates rather than a gate, and an override's list gets it too.
 */
const runGenerate = async ({ gate, command }: { gate: RunGate; command: string | undefined }) => {
	if (command === undefined) {
		return undefined;
	}

	const generated = await gate({ kind: 'generate', command, group: 'root' });

	if (generated.exitCode === 0) {
		return undefined;
	}

	return {
		error: `generate failed (exit ${generated.exitCode}):\n${generated.stdout}\n${generated.stderr}`,
		failedFamilies: generated.ending === GateEnding.Failed ? ['generate'] : [],
		crashes: generated.ending === GateEnding.Crashed ? [describeGateCrash({ label: 'generate' })] : [],
		timeouts: generated.ending === GateEnding.Timeout ? [describeGateTimeout({ label: 'generate', ceilingMinutes: generated.ceilingMinutes })] : [],
		coordination: undefined,
	};
};

/** Without this line, a held tier reads as a broken runner. */
const heldTierMessage = ({ stageResult }: { stageResult: GateRunResult }) => {
	const noVerdict = [...(stageResult.crashes.length > 0 ? ['crash'] : []), ...(stageResult.timeouts.length > 0 ? ['timeout'] : [])];
	const reds = stageResult.failedFamilies.length > 0 ? stageResult.failedFamilies : noVerdict;

	return `gate: expensive gates not started — a cheap gate is red (${reds.join(', ')})`;
};

/** Never a family a fix agent is handed: the checkpoint simply had no gates. */
const overrideMatchedNothing = ({ gates }: { gates: string[] }): GateRunResult => ({
	error: `gate-overrides named no gate this run could execute: ${gates.join(', ')} — every named gate is absent from the group(s) that ran at this checkpoint`,
	failedFamilies: [],
	crashes: [],
	timeouts: [],
	coordination: undefined,
});

/** `context` is absent in a repo with no scoped block, the only shape in which the root group runs. */
const runGateStage = async ({
	stage,
	rootStages,
	packages,
	gate,
	failFast,
	context,
}: {
	stage: number;
	rootStages: GateEntry[][];
	packages: string[];
	gate: RunGate;
	failFast?: boolean;
	context: Omit<Parameters<typeof runPackageGates>[0], 'packageDir' | 'stage' | 'gate' | 'failFast'> | undefined;
}) => {
	if (context === undefined || packages.length === 0) {
		return runGateSet({ entries: rootStages[stage] ?? [], gate, failFast });
	}

	const results = await Promise.all(packages.map((packageDir) => runPackageGates({ ...context, packageDir, stage, gate, failFast })));

	return mergeGateRunResults({ results });
};

interface Params {
	cwd: string;
	config: LightsoutConfig;
	coverage?: boolean;
	packages?: string[];
	includeRoot?: boolean;
	runId?: string;
	step?: string;
	failFast?: boolean;
	/** Already resolved by `runGates` — the one place the default is chosen. */
	schedule: GateSchedule;
	/** Already wired to the reservation's spawn and exit hooks. */
	gate: RunGate;
	onGateResult?: (result: GateResult) => void;
	onProgress?: (message: string) => void;
}

/**
 * Every group in scope finishes a stage before any group starts the next, so
 * the expensive tier never runs while a cheap gate is red anywhere. A red
 * stage, a crash or a timeout included, ends the run: the expensive tier would
 * buy nothing.
 */
export const runGateSchedule = async ({
	cwd,
	config,
	coverage,
	packages,
	includeRoot,
	runId,
	step,
	failFast,
	schedule,
	gate,
	onGateResult,
	onProgress,
}: Params): Promise<GateRunResult> => {
	// Counted, because an override that executed nothing must not report green:
	// a checkpoint claiming a verdict it never earned is worse than a red one.
	let executed = 0;
	const countedGate: RunGate = async (params) => {
		executed += 1;

		return gate(params);
	};
	const gates = resolveGates({ gates: config.gates });
	const stageCount = stageCountOf({ schedule });
	const generateFailure = stageCount === 0 ? undefined : await runGenerate({ gate: countedGate, command: gates.generate });
	const executedBeforeStages = executed;
	const scoped = config['package-gates'];
	const inScope = packages ?? [];
	const scopedPackages = scoped === undefined || includeRoot ? [] : inScope;
	const rootStages = buildGateStages({ entries: buildGateEntries({ commands: rootGateCommands({ gates }) }), schedule, coverage });
	const packagesDir = config['packages-dir'] ?? defaultPackagesDir;
	const context = scoped === undefined ? undefined : { cwd, packagesDir, scoped, coverage, schedule, runId, step, onGateResult, onProgress };
	const stageFailFast = schedule.kind === GateScheduleKind.Exact ? true : failFast;
	const stageResults: GateRunResult[] = [];

	for (let stage = 0; generateFailure === undefined && stage < stageCount; stage += 1) {
		const stageResult = await runGateStage({ stage, rootStages, packages: scopedPackages, gate: countedGate, failFast: stageFailFast, context });

		stageResults.push(stageResult);

		if (stageResult.error !== undefined) {
			if (stage + 1 < stageCount) {
				onProgress?.(heldTierMessage({ stageResult }));
			}

			break;
		}
	}

	let result = generateFailure ?? mergeGateRunResults({ results: stageResults });
	const named = schedule.kind === GateScheduleKind.Exact ? schedule.gates : [];

	// A partial match takes no branch: the gates that ran are evidence, and a
	// package that skipped one already narrated that skip.
	if (named.length > 0 && executed === executedBeforeStages && result.error === undefined) {
		result = overrideMatchedNothing({ gates: named });
	}

	return result;
};
