import { describe, expect, test } from '@jest/globals';
import { setupSyntaxTreeInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

const guidance = 'Call the query where it is used, on the options object the loader prefetches, and keep hooks for logic of their own.';

const runOn = async ({ path, source }: { path: string; source: string }) => {
	const input = setupSyntaxTreeInput({ sources: [[path, source]] });

	return check.run({ inputs: { 'syntax-tree': input }, options: {} });
};

describe('loader-owns-first-paint check', () => {
	test('asks for parsed trees, since only the tree says what a function body holds', () => {
		expect(check.inputKinds).toStrictEqual(['syntax-tree']);
	});

	test('reports an exported arrow whose expression body is one query hook call', async () => {
		const findings = await runOn({
			path: 'src/issues/useIssues.ts',
			source: ["import { useQuery } from '@tanstack/react-query';", '', 'export const useIssues = () => useQuery(issuesQueryOptions());'].join('\n'),
		});

		expect(findings).toStrictEqual([
			{
				siteKey: 'loader-owns-first-paint:src/issues/useIssues.ts',
				files: [{ path: 'src/issues/useIssues.ts' }],
				detail: "'useIssues' only calls useQuery",
				guidance,
			},
		]);
	});

	test('reports a block body holding one return of the call, and a function declaration the same way', async () => {
		const findings = await runOn({
			path: 'src/issues/useIssueDetail.ts',
			source: [
				'export const useIssueDetail = ({ issueId }: { issueId: number }) => {',
				'\treturn useSuspenseQuery(issueDetailQueryOptions({ issueId }));',
				'};',
				'',
				'export function useIssueCount() {',
				'\treturn useInfiniteQuery(issueCountQueryOptions());',
				'}',
			].join('\n'),
		});

		expect(findings.map(({ detail }) => detail)).toStrictEqual(["'useIssueDetail' only calls useSuspenseQuery; 'useIssueCount' only calls useInfiniteQuery"]);
	});

	test('leaves a hook with logic of its own alone, since a second statement is what the rule asks for', async () => {
		const findings = await runOn({
			path: 'src/issues/useOpenIssues.ts',
			source: [
				'export const useOpenIssues = () => {',
				'\tconst { data } = useSuspenseQuery(issuesQueryOptions());',
				'',
				"\treturn data.filter((issue) => issue.status === 'open');",
				'};',
			].join('\n'),
		});

		expect(findings).toStrictEqual([]);
	});

	test('leaves a function that returns something other than a query hook call alone', async () => {
		const findings = await runOn({
			path: 'src/issues/useIssueTitle.ts',
			source: [
				'export const useIssueTitle = ({ title }: { title: string }) => title.trim();',
				'',
				'export const useIssueCountLabel = () => {',
				'\treturn formatCount(3);',
				'};',
				'',
				'export const useNothing = () => {',
				'\treturn;',
				'};',
				'',
				'export const issueCount = 3;',
				'',
				'const useHidden = () => useQuery(issuesQueryOptions());',
				'',
				'export function declared(): void {}',
			].join('\n'),
		});

		expect(findings).toStrictEqual([]);
	});

	test('reports nothing when handed no trees', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
