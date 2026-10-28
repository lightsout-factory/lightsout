import { describe, expect, test } from '@jest/globals';
import { setupSyntaxTreeInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

const inlineQuerySource = [
	"import { useQuery } from '@tanstack/react-query';",
	'',
	'export const IssuesScreen = () => {',
	"\tconst { data } = useQuery({ queryKey: ['issues'], queryFn: () => [] });",
	'',
	'\treturn data;',
	'};',
].join('\n');

describe('query-options-per-query check', () => {
	test('asks for parsed trees, since only the tree tells a key written from a key read', () => {
		expect(check.inputKinds).toStrictEqual(['syntax-tree']);
	});

	test('reports a key written outside a query options file, naming the line', async () => {
		const input = setupSyntaxTreeInput({ sources: [['src/issues/IssuesScreen/IssuesScreen.tsx', inlineQuerySource]] });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'query-options-per-query:src/issues/IssuesScreen/IssuesScreen.tsx',
				files: [{ path: 'src/issues/IssuesScreen/IssuesScreen.tsx' }],
				detail: 'a queryKey is written at line 4',
				guidance: 'Declare the query once in a file named with a QueryOptions suffix, give it its key there, and read that object here.',
			},
		]);
	});

	test('gathers every key one file writes into one job, a shorthand property included', async () => {
		const source = [
			"const queryKey = ['issues'];",
			'',
			'export const prefetchIssues = ({ client }: { client: { ensureQueryData: (options: object) => void } }): void => {',
			'\tclient.ensureQueryData({ queryKey, queryFn: () => [] });',
			"\tclient.ensureQueryData({ queryKey: ['issues', 'count'], queryFn: () => 0 });",
			'};',
		].join('\n');
		const input = setupSyntaxTreeInput({ sources: [['src/routes/issues.tsx', source]] });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings[0]?.detail).toBe('a queryKey is written at lines 4, 5');
	});

	test('leaves a query options file alone: that is where a key is written', async () => {
		const source = [
			"import { queryOptions } from '@tanstack/react-query';",
			'',
			"export const issuesQueryOptions = () => queryOptions({ queryKey: ['issues'], queryFn: () => [] });",
		].join('\n');
		const input = setupSyntaxTreeInput({ sources: [['src/issues/issuesQueryOptions.ts', source]] });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('leaves a key read off the options object alone, since that is a use of the one key', async () => {
		const source = [
			"import { issuesQueryOptions } from '../issuesQueryOptions.ts';",
			'',
			'export const invalidateIssues = ({ client }: { client: { invalidateQueries: (filters: object) => void } }): void => {',
			'\tclient.invalidateQueries({ queryKey: issuesQueryOptions().queryKey });',
			'};',
		].join('\n');
		const input = setupSyntaxTreeInput({ sources: [['src/issues/invalidateIssues.ts', source]] });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
