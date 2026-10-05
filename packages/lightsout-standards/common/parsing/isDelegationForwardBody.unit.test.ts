import { describe, expect, test } from '@jest/globals';
import ts from 'typescript';
import { collectFunctionNodes } from './collectFunctionNodes/collectFunctionNodes.ts';
import { isDelegationForwardBody } from './isDelegationForwardBody.ts';

const setupBodies = ({ source }: { source: string }) => {
	const sourceFile = ts.createSourceFile('subject.ts', source, ts.ScriptTarget.Latest, true);

	return collectFunctionNodes({ sourceFile, compiler: ts }).map(({ name, body }) => ({ name, forward: isDelegationForwardBody({ body, compiler: ts }) }));
};

describe('isDelegationForwardBody', () => {
	test('a method whose whole body forwards one call to a this-held field is the mandated shape', () => {
		const bodies = setupBodies({
			source: ['class RefactorRun {', '\tupdate({ patch }: { patch: object }) {', '\t\treturn this.runState.update({ patch });', '\t}', '}'].join('\n'),
		});

		expect(bodies).toStrictEqual([{ name: 'update', forward: true }]);
	});

	test('a concise arrow forwarding through a this-held field counts too', () => {
		const bodies = setupBodies({
			source: ['class RefactorRun {', '\tstop = () => this.runState.stop({ reason: "halt" });', '}'].join('\n'),
		});

		expect(bodies.map(({ forward }) => forward)).toStrictEqual([true]);
	});

	test('a second statement makes it a body with logic, not a forward', () => {
		const bodies = setupBodies({
			source: [
				'class RefactorRun {',
				'\tupdate({ patch }: { patch: object }) {',
				'\t\tthis.count += 1;',
				'',
				'\t\treturn this.runState.update({ patch });',
				'\t}',
				'}',
			].join('\n'),
		});

		expect(bodies).toStrictEqual([{ name: 'update', forward: false }]);
	});

	test('a call on anything but a this-held field is not the shape', () => {
		const bodies = setupBodies({
			source: ['const update = ({ runState, patch }: { runState: RunState; patch: object }) => {', '\treturn runState.update({ patch });', '};'].join('\n'),
		});

		expect(bodies).toStrictEqual([{ name: 'update', forward: false }]);
	});

	test('a method that calls a this-held field without returning is the shape too', () => {
		const bodies = setupBodies({
			source: ['class RefactorRun {', '\tprogress(message: string): void {', '\t\tthis.runState.progress(message);', '\t}', '}'].join('\n'),
		});

		expect(bodies).toStrictEqual([{ name: 'progress', forward: true }]);
	});

	test('a body that only reads a field of a this-held field is the shape too', () => {
		const bodies = setupBodies({
			source: ['class RefactorRun {', '\tcwd = () => this.runState.cwd;', '}'].join('\n'),
		});

		expect(bodies.map(({ forward }) => forward)).toStrictEqual([true]);
	});

	test("a read of the object's own field is not a forward", () => {
		const bodies = setupBodies({
			source: ['class RefactorRun {', '\tcount = () => this.total;', '}'].join('\n'),
		});

		expect(bodies.map(({ forward }) => forward)).toStrictEqual([false]);
	});
});
