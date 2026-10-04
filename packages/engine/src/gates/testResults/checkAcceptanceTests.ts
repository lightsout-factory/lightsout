import { join } from 'node:path';
import { matchesTestTitle } from '#src/common/sourceFiles/matchesTestTitle.ts';
import type { AcceptanceRow } from '#src/common/types/AcceptanceRow.ts';
import { packageOf } from '#src/common/workspace/packageOf.ts';
import type { GateResult } from '#src/contracts/gates/GateResult.ts';
import { TestCaseStatus } from '#src/contracts/gates/TestCaseStatus.ts';
import type { TestResultsFile } from '#src/contracts/gates/TestResultsFile.ts';
import { readTestResults } from '#src/gates/testResults/common/readTestResults.ts';
import { satisfiesGateKey } from '#src/gates/testResults/common/satisfiesGateKey.ts';

/**
 * Only a green gate counts, so a red gate reaches the fix role as gate output instead. Only
 * a covering package group counts, so a sibling package's green result is never read as
 * evidence about a file it never executed.
 */
const covers = ({ gate, row, packagesDir }: { gate: GateResult; row: AcceptanceRow; packagesDir: string }) =>
	gate.skipped !== true &&
	gate.exitCode === 0 &&
	gate.testResultsDir !== undefined &&
	satisfiesGateKey({ gate: row.gate, kind: gate.kind }) &&
	(gate.group === 'root' || gate.group === packageOf({ file: row.testFile, packagesDir }));

const createResultsReader = ({ cwd }: { cwd: string }) => {
	const readings = new Map<string, Promise<TestResultsFile['testResults']>>();

	return ({ dir }: { dir: string }) => {
		const started = readings.get(dir) ?? readTestResults({ cwd, dir: join(cwd, dir) });

		readings.set(dir, started);

		return started;
	};
};

type ReadResults = ReturnType<typeof createResultsReader>;

const statusesFor = async ({ row, dirs, read }: { row: AcceptanceRow; dirs: string[]; read: ReadResults }) => {
	const statuses: string[] = [];

	for (const dir of dirs) {
		for (const file of await read({ dir })) {
			if (file.testFilePath !== row.testFile) {
				continue;
			}

			statuses.push(
				...file.assertionResults
					.filter(
						(assertion) =>
							matchesTestTitle({ testName: row.testName, title: assertion.title }) || matchesTestTitle({ testName: row.testName, title: assertion.fullName }),
					)
					.map((assertion) => assertion.status),
			);
		}
	}

	return statuses;
};

/**
 * A name can match several cases, under a `describe.each` ancestor or as a template name;
 * every match must pass, which is exactly what the row claims, so there is no ambiguity rule.
 */
const judgeRow = async ({ row, dirs, read }: { row: AcceptanceRow; dirs: string[]; read: ReadResults }) => {
	const statuses = await statusesFor({ row, dirs, read });
	const notPassing = statuses.filter((status) => status !== TestCaseStatus.Passed);
	let reason: string | undefined;

	if (statuses.length === 0) {
		reason = 'no case of that name was reported by the gate that ran';
	} else if (notPassing.length > 0) {
		reason = `${notPassing.length} of ${statuses.length} matching case(s) did not pass (${[...new Set(notPassing)].join(', ')})`;
	}

	return reason;
};

const describeRow = ({ row, reason }: { row: AcceptanceRow; reason: string }) => `- \`${row.testName}\` in ${row.testFile} (gate \`${row.gate}\`): ${reason}`;

interface Params {
	cwd: string;
	rows: AcceptanceRow[];
	gates: GateResult[];
	/** True at the run's last verification, where an unproven row is a failure rather than a skip. */
	final: boolean;
	packagesDir: string;
	onProgress?: (message: string) => void;
}

/**
 * A green gate command does not prove a named case ran, so this reads the per-test results
 * the gate itself wrote. A row no observed gate could carry is skipped before the final
 * verification, because a checkpoint may run a narrower schedule; at the final one it fails.
 */
export const checkAcceptanceTests = async ({ cwd, rows, gates, final, packagesDir, onProgress }: Params): Promise<string | undefined> => {
	if (rows.length === 0) {
		return undefined;
	}

	const read = createResultsReader({ cwd });
	const unproven: string[] = [];

	for (const row of rows) {
		const dirs = [...new Set(gates.filter((gate) => covers({ gate, row, packagesDir })).flatMap((gate) => gate.testResultsDir ?? []))];

		if (dirs.length === 0) {
			if (final) {
				unproven.push(describeRow({ row, reason: 'its gate did not run at this checkpoint, so the test never executed against the finished tree' }));
			} else {
				onProgress?.(`acceptance test not judged here — gate \`${row.gate}\` did not run: \`${row.testName}\` in ${row.testFile}`);
			}

			continue;
		}

		const reason = await judgeRow({ row, dirs, read });

		if (reason !== undefined) {
			unproven.push(describeRow({ row, reason }));
		}
	}

	return unproven.length === 0
		? undefined
		: [
				`acceptance-tests: ${unproven.length} acceptance test(s) were not shown to have executed and passed:`,
				...unproven,
				'',
				'Each test above states an acceptance criterion of the plan and must run and pass under its gate. Fix the source so the named test executes and passes.',
			].join('\n');
};
