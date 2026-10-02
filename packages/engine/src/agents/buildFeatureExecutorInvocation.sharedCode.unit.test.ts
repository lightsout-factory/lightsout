import { expect, test } from '@jest/globals';
import { buildFeatureExecutorInvocation } from '#src/agents/buildFeatureExecutorInvocation.ts';
import { buildRefactorExecutorInvocation } from '#src/agents/buildRefactorExecutorInvocation.ts';
import { RefactorScope } from '#src/common/constants/RefactorScope.ts';

const planContent = '# Plan: add the widget flag\n\nPLAN-SENTINEL';
const sharedCode = [
	{ path: 'src/billing/common', groups: [{ folder: 'utils', names: ['formatMoney', 'parseMoney'] }] },
	{
		path: 'src/common',
		groups: [
			{ folder: '', names: ['helpers'] },
			{ folder: 'constants', names: ['Action'] },
		],
	},
];

test('buildFeatureExecutorInvocation: the task message lists the shared code within reach, nearest folder first, one line per folder', () => {
	const { prompt } = buildFeatureExecutorInvocation({ planContent, sharedCode });

	expect(prompt.startsWith('# Shared code within reach\n\n')).toBeTruthy();
	expect(prompt).toContain(
		['`src/billing/common/`', '- utils/: formatMoney, parseMoney', '', '`src/common/`', '- (directly in the folder): helpers', '- constants/: Action'].join(
			'\n',
		),
	);
	// what the list is for, in the words the agent acts on
	expect(prompt).toContain('reuse or extend what exists rather than write a second copy');
});

test('buildFeatureExecutorInvocation: the listing never enters the cached system prompt, which a fix re-invocation must find unchanged', () => {
	const first = buildFeatureExecutorInvocation({ planContent });
	const fix = buildFeatureExecutorInvocation({ planContent, sharedCode, errorContext: 'tsc: 3 errors' });

	expect(fix.systemPrompt).toBe(first.systemPrompt);
	// and a fix still opens with it, ahead of the failure it is there to repair
	expect(fix.prompt.indexOf('# Shared code within reach')).toBeLessThan(fix.prompt.indexOf('# Verification failure'));
});

test.each([{ sharedCode: undefined }, { sharedCode: [] }])(
	'buildFeatureExecutorInvocation: no shared-code section when nothing shared is within reach',
	({ sharedCode: nothing }) => {
		const { prompt } = buildFeatureExecutorInvocation({ planContent, sharedCode: nothing });

		expect(prompt).toBe('Remember: your entire final message must be exactly one JSON report object — nothing else.');
	},
);

test('buildFeatureExecutorInvocation: a folder too large to name is counted instead, so one bloated folder cannot crowd out the rest', () => {
	const names = Array.from({ length: 61 }, (_, index) => `helper${index}`);

	const { prompt } = buildFeatureExecutorInvocation({
		planContent,
		sharedCode: [
			{
				path: 'src/common',
				groups: [
					{ folder: 'utils', names },
					{ folder: 'types', names: names.slice(0, 60) },
				],
			},
		],
	});

	expect(prompt).toContain('- utils/: 61 files, too many to list here — search the folder by name');
	// sixty is still named in full
	expect(prompt).toContain(`- types/: ${names.slice(0, 60).join(', ')}`);
});

test('buildRefactorExecutorInvocation: the refactor reads the same shared-code section, after its work-list', () => {
	const executor = buildFeatureExecutorInvocation({ planContent, sharedCode });
	const refactor = buildRefactorExecutorInvocation({ scope: RefactorScope.Feature, planContent, changedFiles: ['src/billing/getTotal.ts'], sharedCode });
	const reminder = '\n\nRemember: your entire final message';

	const sectionOf = ({ prompt }: { prompt: string }) => prompt.slice(prompt.indexOf('# Shared code within reach'), prompt.indexOf(reminder));

	// one text for both roles — where an extraction belongs is where the implementer was told to look
	expect(sectionOf(refactor)).toBe(sectionOf(executor));
	expect(refactor.prompt.startsWith('# Changed files to review\n\n- src/billing/getTotal.ts\n\n# Shared code within reach')).toBeTruthy();
});

test('buildRefactorExecutorInvocation: no shared-code section when none is given, and never in the cached system prompt', () => {
	const bare = buildRefactorExecutorInvocation({ scope: RefactorScope.Standalone, planContent, changedFiles: ['src/widget.ts'] });
	const listed = buildRefactorExecutorInvocation({ scope: RefactorScope.Standalone, planContent, changedFiles: ['src/widget.ts'], sharedCode });

	expect(bare.prompt).not.toContain('# Shared code within reach');
	expect(listed.systemPrompt).toBe(bare.systemPrompt);
});
