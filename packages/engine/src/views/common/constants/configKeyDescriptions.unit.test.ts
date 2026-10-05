import { describe, expect, test } from '@jest/globals';
import { touchedFileCeiling } from '#src/common/constants/touchedFileCeiling.ts';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { defaultRefactorMaxRounds } from '#src/pipeline/steps/buildSteps/buildRefactorSteps/refactorStep/defaultRefactorMaxRounds.ts';
import { configKeyDescriptions } from '#src/views/common/constants/configKeyDescriptions.ts';

/** The rows the page splits the `timeouts` block into; each has its own default, so each needs its own sentence. */
const timeoutLeafKeys = ['timeouts.agent-minutes', 'timeouts.supervisor-minutes', 'timeouts.gate-minutes'];

describe('configKeyDescriptions', () => {
	test('explains every key a config may write, so a new key cannot ship without a sentence', () => {
		const uncovered = Object.keys(LightsoutConfig.shape).filter((key) => (configKeyDescriptions[key] ?? '').trim() === '');

		expect(uncovered).toStrictEqual([]);
	});

	test('describes nothing the schema does not declare, apart from the timeout leaves the page gives their own rows', () => {
		const declared = new Set([...Object.keys(LightsoutConfig.shape), ...timeoutLeafKeys]);

		expect(Object.keys(configKeyDescriptions).filter((key) => !declared.has(key))).toStrictEqual([]);
	});

	test('gives each timeout leaf its own sentence rather than repeating the block’s', () => {
		expect(new Set(timeoutLeafKeys.map((key) => configKeyDescriptions[key])).size).toBe(timeoutLeafKeys.length);
	});

	test('names the round budget the engine really spends, so the page and the generated table cannot promise a number nothing enforces', () => {
		// the block is shown as the file wrote it, so this sentence is the only
		// place the page states what an unconfigured repo gets — a sentence naming
		// a different number than the engine's own default would be a lie the
		// generated table in the documentation repeats
		expect(configKeyDescriptions.implement).toMatch(new RegExp(`\\b${defaultRefactorMaxRounds}\\b`));
	});

	test('names the worktree switch in the implement sentence, so the table describes every key of the block', () => {
		expect(configKeyDescriptions.implement).toMatch(/worktree/i);
	});

	test('describes package-standards-packs', () => {
		const described = {
			declared: Object.hasOwn(LightsoutConfig.shape, 'package-standards-packs'),
			description: (configKeyDescriptions['package-standards-packs'] ?? '').trim() !== '',
		};

		expect(described).toStrictEqual({ declared: true, description: true });
	});

	test('names the fixed touched-file ceiling a File Budget cannot lift, so the page cannot promise an unbounded budget', () => {
		// a sentence presenting `## File Budget` as the only limit on touched files
		// is what let a 77-file phase through; the number is read from the lint's own
		// constant so the page and the check cannot drift apart
		const description = configKeyDescriptions['executor-file-limit'];

		expect(description).toMatch(new RegExp(`\\b${touchedFileCeiling}\\b`));
		expect(description).toMatch(/touched/i);
		expect(description).toMatch(/`## File Budget`/);
		expect(description).toMatch(/renames? ?-?only/i);
	});

	test('the commands sentence says resume follows the configuration the run recorded rather than the current file', () => {
		// a run follows one configuration from start to finish, so the page must not
		// let a reader think a resume picks its model or effort up from the file as
		// it reads now; the clause runs from `resume` to the end of its sentence,
		// where a dot inside a file name such as lightsout.config.json is no stop
		const resumeClause = /`resume`.*?(?:\.\s|\.$|$)/s.exec(configKeyDescriptions.commands)?.[0] ?? '';

		expect(resumeClause).toMatch(/recorded harness/i);
		expect(resumeClause).toMatch(/\bmodel\b/i);
		expect(resumeClause).toMatch(/\beffort\b/i);
		expect(resumeClause).toMatch(/\bconfig(?:uration)?\b[^.]*\brecorded\b|\brecorded\b[^.]*\bconfig(?:uration)?\b/i);
		expect(resumeClause).toMatch(/\b(?:never|not|rather than)\b.*?(?:\bfile\b|lightsout\.config\.json)/i);
	});

	test('names the move-folders-and-files exemption beside the rename-only one in the executor-file-limit sentence', () => {
		// a sentence naming rename-only as the single exemption tells an author a
		// large relocation cannot fit in one phase, which the move-folders-and-files
		// mode now allows
		const description = configKeyDescriptions['executor-file-limit'];

		const named = {
			ceiling: new RegExp(`\\b${touchedFileCeiling}\\b`).test(description),
			touched: /touched/i.test(description),
			fileBudget: /`## File Budget`/.test(description),
			renameOnly: /renames? ?-?only/i.test(description),
			moveFoldersAndFiles: /move-folders-and-files/i.test(description),
		};

		expect(named).toStrictEqual({ ceiling: true, touched: true, fileBudget: true, renameOnly: true, moveFoldersAndFiles: true });
	});
});
