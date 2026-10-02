import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BuildMode } from '#src/common/constants/BuildMode.ts';
import { holdsTestTitle } from '#src/common/sourceFiles/holdsTestTitle.ts';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { getPlanWrittenPaths } from '#src/plan/internal/common/paths/getPlanWrittenPaths.ts';
import { isPlanSourceFile } from '#src/plan/internal/common/paths/isPlanSourceFile.ts';
import type { ParsedPlan } from '#src/plan/internal/common/types/ParsedPlan.ts';
import { checkLedgerCoverage } from '#src/plan/lint/internal/checkLedgerCoverage.ts';
import { checkMovedAwayLedgerFiles } from '#src/plan/lint/internal/checkMovedAwayLedgerFiles.ts';

interface Params {
	plan: ParsedPlan;
	cwd: string;
	/** The finding label: this file's basename. */
	phase: string;
	/** Whether `plan.contract` is on; decides only whether an absent section is a finding. */
	required: boolean;
	/** So a row cannot name a gate nothing runs. */
	gateKeys: Set<string>;
}

/**
 * `getPlanWrittenPaths` rather than the whole heading set: a deleted file and a
 * move's source are named by a heading but written by nobody. A rename-only or
 * move-folders-and-files file has none, because a mechanical rename or move adds
 * no behaviour a new test could state.
 */
const getCoverablePaths = ({ plan }: { plan: ParsedPlan }) => {
	if (plan.buildMode !== BuildMode.Standard) {
		return [];
	}

	const excused = new Set(plan.proseFiles.map((file) => file.path));

	return [...new Set(getPlanWrittenPaths({ plan }))].filter((path) => isPlanSourceFile({ path }) && !excused.has(path));
};

/**
 * Read from test-call heads: a quoted-string search would also match the name in
 * a comment, a `describe` block or a variable, none of which is an existing test.
 */
const statesTest = async ({ cwd, testFile, testName }: { cwd: string; testFile: string; testName: string }) => {
	const content = await readFile(join(cwd, testFile), 'utf8').catch(() => undefined);

	return content !== undefined && holdsTestTitle({ content, testName });
};

/**
 * A row may name a move's destination, which does not exist at plan time. The
 * source is read instead, or an old test could verify a new criterion just by
 * moving its file.
 */
const resolveReadPath = ({ plan, testFile }: { plan: ParsedPlan; testFile: string }) => plan.movePaths.find((move) => move.to === testFile)?.from ?? testFile;

const isTestGate = ({ gate }: { gate: string }) => gate === 'test' || gate.startsWith('test-');

const finding = ({ phase, issue, location, fix }: { phase: string; issue: string; location: string; fix: string }) => ({
	check: StructuralCheck.LedgerWellFormed,
	severity: FindingSeverity.Blocking,
	phase,
	issue,
	location,
	fix,
});

const checkShape = ({ plan, phase, required, coverable }: { plan: ParsedPlan; phase: string; required: boolean; coverable: string[] }) => {
	const findings: StructuralFinding[] = [];

	if (!plan.sections.has('Acceptance Tests') && required && coverable.length > 0) {
		findings.push(
			finding({
				phase,
				issue: 'no `## Acceptance Tests` section, and this plan writes source files no prose-files entry excuses',
				location: `${phase} → Acceptance Tests`,
				fix: 'add a `## Acceptance Tests` section with one row per acceptance criterion',
			}),
		);
	}

	for (const line of plan.malformedLedgerLines) {
		findings.push(
			finding({
				phase,
				issue: 'an Acceptance Tests row does not carry a criterion, a backticked test file and a test name',
				location: `${phase}:${line}`,
				fix: 'write the row as `| criterion | `test file` | test name | gate |`',
			}),
		);
	}

	for (const line of plan.malformedProseLines) {
		findings.push(
			finding({
				phase,
				issue: 'a Prose Files bullet names a path but states no reason',
				location: `${phase}:${line}`,
				fix: 'add ` — ` and the reason no test can state this file’s behaviour',
			}),
		);
	}

	return findings;
};

const checkRows = async ({ plan, cwd, phase, gateKeys }: { plan: ParsedPlan; cwd: string; phase: string; gateKeys: Set<string> }) => {
	const findings: StructuralFinding[] = [];
	const seen = new Set<string>();

	for (const row of plan.ledger) {
		const location = `${phase}:${row.line}`;

		if (!isTestFile({ path: row.testFile })) {
			findings.push(
				finding({
					phase,
					issue: `ledger row names '${row.testFile}', which is not a test file`,
					location,
					fix: 'name a test file',
				}),
			);
		}

		// An empty set is evidence the caller passed no config, never that the
		// repository runs no gates — judging against it would report every row.
		if (gateKeys.size > 0 && !gateKeys.has(row.gate)) {
			findings.push(
				finding({
					phase,
					issue: `ledger row names gate '${row.gate}', which no configured gate runs`,
					location,
					fix: 'name a configured gate',
				}),
			);
		} else if (!isTestGate({ gate: row.gate })) {
			// Only for a gate the repository does run: a key nothing runs is one
			// mistake, and saying it twice buries the findings beside it.
			findings.push(
				finding({
					phase,
					issue: `ledger row names gate '${row.gate}', which runs no tests — no execution of it can carry a test result, so the row could never be proven`,
					location,
					fix: 'name a test gate: `test`, `test-coverage`, or a custom `test-*` suite',
				}),
			);
		}

		const key = `${row.testFile}|${row.testName}`;

		if (seen.has(key)) {
			findings.push(
				finding({
					phase,
					issue: `two ledger rows name the same test: '${row.testName}' in ${row.testFile}`,
					location,
					fix: 'give each criterion its own test, or state them as one row',
				}),
			);
		}

		seen.add(key);

		const readPath = resolveReadPath({ plan, testFile: row.testFile });

		if (await statesTest({ cwd, testFile: readPath, testName: row.testName })) {
			findings.push(
				finding({
					phase,
					issue:
						readPath === row.testFile
							? `'${row.testName}' is already a test in ${row.testFile}`
							: `'${row.testName}' is already a test in ${readPath}, which this plan moves to ${row.testFile}`,
					location,
					fix: 'name a new test, or re-point the row at one this plan adds',
				}),
			);
		}
	}

	return findings;
};

/**
 * Runs whenever the section is present, whatever the config says: a plan written
 * with `plan.contract` on and graded with it off must not quietly lose its checks.
 * A row may name an existing test file but not a test it already holds, so a test
 * written for older behaviour is never locked in as a new criterion's verifier.
 */
export const checkAcceptanceLedger = async ({ plan, cwd, phase, required, gateKeys }: Params): Promise<StructuralFinding[]> => {
	const coverable = getCoverablePaths({ plan });

	return [
		...checkShape({ plan, phase, required, coverable }),
		...(await checkRows({ plan, cwd, phase, gateKeys })),
		...checkMovedAwayLedgerFiles({ plan, phase }),
		...checkLedgerCoverage({ plan, phase, coverable }),
	];
};
