import { describe, expect, test } from '@jest/globals';
import { setupSyntaxTreeInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

const guidance = "Put each server function in its feature's server/ folder, one per file named for what it does.";

const serverFunctionSource = ({ name }: { name: string }) => `export const ${name} = createServerFn({ method: 'GET' }).handler(async () => []);`;

const runOn = async ({ path, source }: { path: string; source: string }) => {
	const input = setupSyntaxTreeInput({ sources: [[path, source]] });

	return check.run({ inputs: { 'syntax-tree': input }, options: {} });
};

describe('server-function-boundary check', () => {
	test('asks for parsed trees, since only the tree tells the call from the word in a comment', () => {
		expect(check.inputKinds).toStrictEqual(['syntax-tree']);
	});

	test('reports a server function created outside a server/ folder, naming the file and line', async () => {
		const findings = await runOn({ path: 'src/issues/IssuesScreen/findIssues.ts', source: serverFunctionSource({ name: 'findIssues' }) });

		expect(findings).toStrictEqual([
			{
				siteKey: 'server-function-boundary:src/issues/IssuesScreen/findIssues.ts',
				files: [{ path: 'src/issues/IssuesScreen/findIssues.ts' }],
				detail: "'findIssues.ts' creates a server function outside a server/ folder, at line 1",
				guidance,
			},
		]);
	});

	test('reports a file in server/ that creates more than one', async () => {
		const findings = await runOn({
			path: 'src/issues/server/issueCommands.ts',
			source: [serverFunctionSource({ name: 'findOneIssue' }), '', serverFunctionSource({ name: 'closeIssue' })].join('\n'),
		});

		expect(findings.map(({ detail }) => detail)).toStrictEqual(["'issueCommands.ts' creates 2 server functions, at lines 1, 3"]);
	});

	test('names every line when a file outside server/ creates several', async () => {
		const findings = await runOn({
			path: 'src/issues/issueCommands.ts',
			source: [serverFunctionSource({ name: 'findOneIssue' }), serverFunctionSource({ name: 'closeIssue' })].join('\n'),
		});

		expect(findings.map(({ detail }) => detail)).toStrictEqual(["'issueCommands.ts' creates a server function outside a server/ folder, at lines 1, 2"]);
	});

	test('leaves one server function in a server/ folder alone, and a file that creates none', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				['src/issues/server/findIssues.ts', serverFunctionSource({ name: 'findIssues' })],
				['src/issues/IssuesScreen/IssuesScreen.tsx', '// createServerFn is only named here, in a comment.\nexport const IssuesScreen = () => null;'],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports nothing when handed no trees', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
