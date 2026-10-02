import { expect, test } from '@jest/globals';
import { buildDirectWorkerInvocation } from '#src/agents/buildDirectWorkerInvocation.ts';
import { buildFeatureExecutorInvocation } from '#src/agents/buildFeatureExecutorInvocation.ts';
import { buildLedgerTestWriterInvocation } from '#src/agents/buildLedgerTestWriterInvocation.ts';
import { buildRefactorExecutorInvocation } from '#src/agents/buildRefactorExecutorInvocation.ts';
import { buildUnitTestWriterInvocation } from '#src/agents/buildUnitTestWriterInvocation.ts';
import { RefactorScope } from '#src/common/constants/RefactorScope.ts';

const planContent = '# Plan: add the widget flag\n\nPLAN-SENTINEL';

/** The role prompt of every role that writes code or tests, by the name its section comparisons report. */
const setupRolePrompts = () => ({
	implement: buildFeatureExecutorInvocation({ planContent }).systemPrompt,
	unitTests: buildUnitTestWriterInvocation({ planContent, subjects: ['src/widget.ts'], mustExecute: ['src/widget.ts'] }).systemPrompt,
	ledgerTests: buildLedgerTestWriterInvocation({ planContent, testFile: 'src/widget.unit.test.ts', rows: [] }).systemPrompt,
	direct: buildDirectWorkerInvocation({ ticketRef: 'LO-70', ticketBody: 'Build the thing.' }).systemPrompt,
	refactorFeature: buildRefactorExecutorInvocation({ scope: RefactorScope.Feature, planContent, changedFiles: ['src/widget.ts'] }).systemPrompt,
	refactorStandalone: buildRefactorExecutorInvocation({ scope: RefactorScope.Standalone, planContent, changedFiles: ['src/widget.ts'] }).systemPrompt,
});

/** The text from a heading through the sentence that closes its section; empty when the prompt lacks either. */
const sectionOf = ({ prompt, heading, lastSentence }: { prompt: string; heading: string; lastSentence: string }) => {
	const start = prompt.indexOf(heading);
	const end = prompt.indexOf(lastSentence, start);

	return start === -1 || end === -1 ? '' : prompt.slice(start, end + lastSentence.length);
};

const frictionOf = ({ prompt }: { prompt: string }) =>
	sectionOf({ prompt, heading: '## Friction — help the pipeline improve itself', lastSentence: 'when the run was clean.' });

test('buildFeatureExecutorInvocation: the friction section says where a standards rule’s "report it" goes', () => {
	const { systemPrompt } = buildFeatureExecutorInvocation({ planContent });

	expect(systemPrompt).toContain('## Friction — help the pipeline improve itself');
	// a rule only says "report it"; the role prompt is what gives that a meaning
	expect(systemPrompt).toContain(
		'When a Standards rule tells you to report something, or leaves a decision to\nthe repo owner, this array is where you report it',
	);
	// a missing dependency or config is filed under the environment, not the standards
	expect(systemPrompt).toContain('`area: "environment"` when what is missing is configuration or a dependency');
});

test('buildFeatureExecutorInvocation: the friction section stands once, before the report shape, with no marker left behind', () => {
	const { systemPrompt } = buildFeatureExecutorInvocation({ planContent });
	const positions = ['## Friction — help the pipeline improve itself', '## Report — your entire final message'].map((heading) => ({
		first: systemPrompt.indexOf(heading),
		last: systemPrompt.lastIndexOf(heading),
	}));

	expect(positions.every(({ first, last }) => first !== -1 && first === last)).toBeTruthy();
	expect(positions.map(({ first }) => first)).toStrictEqual([...positions.map(({ first }) => first)].sort((left, right) => left - right));
	expect(systemPrompt.includes('{{')).toBeFalsy();
});

test('every role that writes code or tests reads one and the same friction section', () => {
	const prompts = setupRolePrompts();

	const sections = Object.values(prompts).map((prompt) => frictionOf({ prompt }));

	// a rule that says "report it" means the same thing whichever role reads it
	expect(new Set(sections).size).toBe(1);
	// and it is a real section, not six empty slices compared to each other
	expect(sections[0]).toContain('this array is where you report it');
});

test('no role prompt reaches an agent still carrying a marker', () => {
	const prompts = setupRolePrompts();

	const carryingMarkers = Object.entries(prompts)
		.filter(([, prompt]) => prompt.includes('{{'))
		.map(([role]) => role);

	expect(carryingMarkers).toStrictEqual([]);
});
