import { describe, expect, test } from '@jest/globals';
import { renderRunProgress } from '#src/cli/statusCommand/common/loadRunProgressBlock/renderRunProgress.ts';
import type { RunProgressRow } from '#src/common/types/RunProgressRow.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { sampleRunProgress } from '#tests/helpers/sampleRunProgress.ts';

/** The escape byte every ANSI sequence opens with, built rather than written, so no control character sits in this source. */
const escapeByte = String.fromCharCode(27);

/** The same line without its paint, so a painted block can be measured the way a terminal measures it. */
const plain = ({ text }: { text: string }) =>
	text
		.split(escapeByte)
		.map((part) => part.replace(/^\[[0-9;]*m/, ''))
		.join('');

const rowOf = (overrides: Partial<RunProgressRow> = {}): RunProgressRow => ({
	id: 'implement',
	status: RunStatus.Passed,
	attempts: 1,
	durationMs: 1_000,
	verification: undefined,
	cleanup: undefined,
	...overrides,
});

describe('renderRunProgress', () => {
	test('a failed verification summary renders compact ordered diagnostics', () => {
		const verification = {
			failedFamilies: ['check', 'test'],
			repairAttempts: { check: 2, test: 1 },
			failures: [
				{ kind: 'check', group: 'root', command: 'pnpm check', exitCode: 1, outputTail: 'type error' },
				{ kind: 'test', group: 'api', command: 'pnpm test', exitCode: 1, outputTail: 'earlier\n final\tline ' },
			],
			needsFormatting: false,
			guidedRepairAttempted: true,
			supervisorDiagnosis: 'stale\n dependency\tgraph',
		};
		const lines = renderRunProgress({ progress: sampleRunProgress({ rows: [rowOf({ status: RunStatus.Escalated, verification })] }) });

		expect(lines).toContain(' verification  check, test · groups root, api · repairs check=2, test=1 · guided yes');
		expect(lines).toContain(' diagnosis     stale dependency graph');
		expect(lines).toContain(' last output   final line');
	});

	test('a long diagnosis wraps instead of stretching the rules the block is drawn inside', () => {
		// The rules span the widest line, so an unwrapped diagnosis drags them out
		// with it — and a supervisor's runs to several hundred characters, which is
		// exactly when a reader needs the block to still be readable.
		const verification = {
			failedFamilies: ['test'],
			repairAttempts: { test: 2 },
			failures: [{ kind: 'test', group: 'root', command: 'pnpm test', exitCode: 1, outputTail: 'red' }],
			needsFormatting: false,
			guidedRepairAttempted: true,
			supervisorDiagnosis: `the assertion names a key the success path never sets ${'and so it can never match '.repeat(12)}`,
		};
		const lines = renderRunProgress({ progress: sampleRunProgress({ rows: [rowOf({ status: RunStatus.Escalated, verification })] }) });
		const widest = Math.max(...lines.map((line) => plain({ text: line }).length));

		expect(widest).toBeLessThanOrEqual(96);
		expect(lines.filter((line) => plain({ text: line }).startsWith(' diagnosis'))).toHaveLength(1);
		// every wrapped line hangs under the first one's text rather than restating the label
		expect(lines.some((line) => /^ {15}\S/.test(plain({ text: line })))).toBe(true);
	});

	test('an in-process changed-file failure reports unavailable groups and no repairs', () => {
		const lines = renderRunProgress({
			progress: sampleRunProgress({
				rows: [
					rowOf({
						verification: {
							failedFamilies: ['changed-files-executed'],
							repairAttempts: {},
							failures: [],
							needsFormatting: false,
							guidedRepairAttempted: false,
						},
					}),
				],
			}),
		});

		expect(lines).toContain(' verification  changed-files-executed · groups unavailable · repairs none · guided no');
	});

	test('a recovered verification summary with no current families renders no diagnostics', () => {
		const lines = renderRunProgress({
			progress: sampleRunProgress({
				rows: [
					rowOf({
						verification: {
							failedFamilies: [],
							repairAttempts: { check: 1 },
							failures: [],
							needsFormatting: false,
							guidedRepairAttempted: false,
						},
					}),
				],
			}),
		});

		expect(lines.some((line) => line.startsWith(' verification'))).toBe(false);
	});

	test('diagnostic widths set both rules and ANSI paint preserves terminal geometry', () => {
		const wasTty = process.stdout.isTTY;

		try {
			process.stdout.isTTY = true;
			const lines = renderRunProgress({
				progress: sampleRunProgress({
					rows: [
						rowOf({
							verification: {
								failedFamilies: ['changed-files-executed'],
								repairAttempts: {},
								failures: [],
								needsFormatting: false,
								guidedRepairAttempted: false,
							},
						}),
					],
				}),
			});
			const plainLines = lines.map((line) => plain({ text: line }));
			const diagnostic = plainLines.find((line) => line.startsWith(' verification')) ?? '';
			const rules = plainLines.filter((line) => /^─+$/.test(line));

			expect(rules).toHaveLength(2);
			expect(rules.every((rule) => rule.length === diagnostic.length)).toBe(true);
			expect(plainLines[2]).toHaveLength(49);
		} finally {
			process.stdout.isTTY = wasTty;
		}
	});
});
