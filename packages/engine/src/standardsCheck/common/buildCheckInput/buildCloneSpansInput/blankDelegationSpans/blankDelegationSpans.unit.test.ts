import { describe, expect, test } from '@jest/globals';
import { resolveConsumerTypescript } from '#src/common/workspace/resolveConsumerTypescript.ts';
import { blankDelegationSpans } from '#src/standardsCheck/common/buildCheckInput/buildCloneSpansInput/blankDelegationSpans/blankDelegationSpans.ts';
import { expectDefined } from '#tests/helpers/expectDefined.ts';

const compiler = resolveConsumerTypescript({ cwd: process.cwd() });

const delegatingClass = [
	'export class RefactorRun {',
	'\tprivate readonly runState: RunState;',
	'',
	'\tconstructor({ runState }: { runState: RunState }) {',
	'\t\tthis.runState = runState;',
	'\t}',
	'',
	'\tget cwd(): string {',
	'\t\treturn this.runState.cwd;',
	'\t}',
	'',
	'\tget label(): string {',
	'\t\treturn `run in ${this.runState.cwd}`;',
	'\t}',
	'',
	'\tprogress(message: string): void {',
	'\t\tthis.runState.progress(message);',
	'\t}',
	'',
	'\tupdate({ patch }: { patch: Partial<RunManifest> }): Promise<void> {',
	'\t\treturn this.runState.update({ patch });',
	'\t}',
	'',
	'\tsummarize(): string {',
	'\t\tconst summary = this.runState.read();',
	'',
	'\t\treturn `run: ${summary}`;',
	'\t}',
	'}',
].join('\n');

describe('blankDelegationSpans', () => {
	test('blanks the assigning constructor and the one-line forward, keeping every newline', () => {
		expectDefined(compiler);

		const blanked = blankDelegationSpans({ path: 'src/RefactorRun.ts', text: delegatingClass, compiler });

		const lines = blanked.split('\n');

		expect(lines).toHaveLength(delegatingClass.split('\n').length);
		expect(blanked).not.toContain('this.runState = runState');
		expect(blanked).not.toContain('return this.runState.update');
	});

	test('blanks a getter that reads a field of the held value, and a method that calls it without returning', () => {
		expectDefined(compiler);

		const blanked = blankDelegationSpans({ path: 'src/RefactorRun.ts', text: delegatingClass, compiler });

		expect(blanked).not.toContain('get cwd()');
		expect(blanked).not.toContain('this.runState.progress(message)');
	});

	test('keeps a getter that computes from the held value', () => {
		expectDefined(compiler);

		const blanked = blankDelegationSpans({ path: 'src/RefactorRun.ts', text: delegatingClass, compiler });

		expect(blanked).toContain('get label()');
	});

	test('keeps a method that does more than forward', () => {
		expectDefined(compiler);

		const blanked = blankDelegationSpans({ path: 'src/RefactorRun.ts', text: delegatingClass, compiler });

		expect(blanked).toContain('const summary = this.runState.read();');
	});

	test('leaves a file with no classes untouched', () => {
		expectDefined(compiler);
		const text = 'export const totalCharges = ({ fees }: { fees: number[] }) => fees.reduce((sum, fee) => sum + fee, 0);\n';

		expect(blankDelegationSpans({ path: 'src/totalCharges.ts', text, compiler })).toBe(text);
	});
});
