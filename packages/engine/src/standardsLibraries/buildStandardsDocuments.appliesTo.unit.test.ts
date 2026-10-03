import { describe, expect, test } from '@jest/globals';
import { StandardsSet } from '@lightsout/standards-contracts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import { buildStandardsDocuments } from '#src/standardsLibraries/buildStandardsDocuments.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import type { LoadedStandardsTopic } from '#src/standardsLibraries/common/types/LoadedStandardsTopic.ts';

/** A lightsout rule whose prose opens with a level-2 title, as a rule.md body does. */
const buildRule = ({ id, title, text, set = StandardsSet.Code }: { id: string; title: string; text: string; set?: StandardsSet }): LoadedStandardsRule => ({
	id,
	name: `lightsout/${id}`,
	library: 'lightsout',
	set,
	documentPath: `${set}/example`,
	summary: `${id} summary`,
	prose: `## ${title}\n\n${text}`,
	deterministic: false,
	agent: true,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	fixturesPath: `/pkg/${set}/example/${id}/fixtures`,
});

/** A lightsout topic whose intro opens with a level-1 title, as a topic.md body does. */
const buildTopic = ({
	path,
	title,
	ruleIds,
	set = StandardsSet.Code,
}: {
	path: string;
	title: string;
	ruleIds: string[];
	set?: StandardsSet;
}): LoadedStandardsTopic => ({
	set,
	library: 'lightsout',
	path,
	intro: `# ${title}\n\nBackground for ${title}.`,
	ruleIds,
});

const rules = {
	graduation: buildRule({ id: 'graduation', title: 'Graduation', text: 'A concept earns its folder.' }),
	functions: buildRule({ id: 'functions', title: 'Functions', text: 'Use arrow functions.' }),
	classes: buildRule({ id: 'classes', title: 'Classes', text: 'Default to functions.' }),
	mockPrefix: buildRule({ id: 'mock-prefix', title: 'Mock Prefix', text: 'Mocks carry a mock prefix.', set: StandardsSet.Tests }),
	hooksAtTop: buildRule({ id: 'hooks-at-top', title: 'Hooks At Top', text: 'Call hooks at the top level.' }),
};

const topics = {
	modules: buildTopic({ path: 'code/fractal/modules', title: 'Modules', ruleIds: ['graduation'] }),
	patterns: buildTopic({ path: 'code/style/patterns', title: 'Patterns', ruleIds: ['functions', 'classes'] }),
	testStyle: buildTopic({ path: 'tests/code-style', title: 'Test Style', ruleIds: ['mock-prefix'], set: StandardsSet.Tests }),
	react: buildTopic({ path: 'code/frameworks/react', title: 'React', ruleIds: ['hooks-at-top'] }),
};

interface PackContents {
	name: string;
	topics: LoadedStandardsTopic[];
	rules: LoadedStandardsRule[];
}

const fractalPack: PackContents = {
	name: 'lightsout/fractal',
	topics: [topics.modules, topics.patterns, topics.testStyle],
	rules: [rules.graduation, rules.functions, rules.classes, rules.mockPrefix],
};

const standardsPack: PackContents = {
	name: 'lightsout/standards',
	topics: [...fractalPack.topics, topics.react],
	rules: [...fractalPack.rules, rules.hooksAtTop],
};

/**
 * One group covering `packages` with `pack`. Every rule runs at advisory and reaches agents, except the full
 * names in `off`, which the pack's `rule-settings` turns off: they neither run nor reach agents.
 */
const buildGroup = ({ packages, pack, off = [] }: { packages: string[]; pack: PackContents; off?: string[] }): StandardsGroup => {
	const severityOf = (rule: LoadedStandardsRule) => (off.includes(rule.name) ? StandardsSeverity.Off : StandardsSeverity.Advisory);

	return {
		packages,
		pack: {
			name: pack.name,
			topics: pack.topics,
			rules: pack.rules.map((rule) => ({ rule, severity: severityOf(rule), options: {} })),
			conditionalPacks: [],
			inactiveRules: [],
		},
		states: new Map(
			pack.rules.map((rule) => [rule.name, { severity: severityOf(rule), options: {}, fromConfig: false, reachesAgents: !off.includes(rule.name) }]),
		),
	};
};

/** lightsout/fractal for every package, once as one group and once split into two groups. */
const setupSinglePack = () => {
	const oneGroup = [buildGroup({ packages: ['', 'engine', 'web-app'], pack: fractalPack })];
	const twoGroups = [buildGroup({ packages: ['', 'engine'], pack: fractalPack }), buildGroup({ packages: ['web-app'], pack: fractalPack })];

	return { oneGroup, twoGroups };
};

/** The root and engine on lightsout/fractal; web-app on lightsout/standards, whose rule-settings turn `webAppOff` off. */
const setupSplitPacks = ({ webAppOff = [] }: { webAppOff?: string[] } = {}) => {
	const groups = [buildGroup({ packages: ['', 'engine'], pack: fractalPack }), buildGroup({ packages: ['web-app'], pack: standardsPack, off: webAppOff })];

	return { groups };
};

/**
 * The root and engine on a pack holding only the tests topic; web-app on a pack
 * whose one code topic has a rule showing a document inside a four-backtick
 * fence. The fence holds a shorter backtick fence and a tilde fence, neither of
 * which closes it. So the code text holds only web-app's topic, under a heading.
 */
const setupFencedProse = () => {
	const docLayout = buildRule({
		id: 'doc-layout',
		title: 'Doc Layout',
		text: 'Write the doc like this:\n\n````md\n# Kept Title\n```\n## Kept Too\n~~~\n````\n\n## After The Fence\n\nBack in prose.',
	});
	const docsTopic = buildTopic({ path: 'code/docs', title: 'Docs', ruleIds: ['doc-layout'] });
	const groups = [
		buildGroup({
			packages: ['', 'engine'],
			pack: { name: 'lightsout/tests-only', topics: [topics.testStyle], rules: [rules.mockPrefix] },
		}),
		buildGroup({ packages: ['web-app'], pack: { name: 'lightsout/docs', topics: [docsTopic], rules: [docLayout] } }),
	];

	return { groups };
};

/**
 * Two groups of one package each, web-app's given first and its topic first by
 * path, so only the label order can put engine's heading first.
 */
const setupEqualSets = () => {
	const webTopic = buildTopic({ path: 'code/a-web', title: 'Web', ruleIds: [] });
	const engineTopic = buildTopic({ path: 'code/z-engine', title: 'Engine', ruleIds: [] });
	const groups = [
		buildGroup({ packages: ['web-app'], pack: { name: 'lightsout/web', topics: [webTopic], rules: [] } }),
		buildGroup({ packages: ['engine'], pack: { name: 'lightsout/engine', topics: [engineTopic], rules: [] } }),
	];

	return { groups };
};

/** The text's lines with the blank ones left out, so assertions pin content and order, not the blank-line joiner. */
const nonBlankLines = (text: string | undefined) => (text ?? '').split('\n').filter((line) => line.trim().length > 0);

describe('buildStandardsDocuments', () => {
	test('renders no Applies to heading when every topic and rule applies to every package, whether the packs come as one group or two', () => {
		const { oneGroup, twoGroups } = setupSinglePack();

		const single = buildStandardsDocuments({ groups: oneGroup });
		const split = buildStandardsDocuments({ groups: twoGroups });

		expect(split).toStrictEqual(single);
		expect(single).toStrictEqual({
			code: [
				'<!-- lightsout: code/fractal/modules -->\n# Modules\n\nBackground for Modules.\n\n## Graduation\n\nA concept earns its folder.',
				'<!-- lightsout: code/style/patterns -->\n# Patterns\n\nBackground for Patterns.\n\n## Functions\n\nUse arrow functions.\n\n## Classes\n\nDefault to functions.',
			].join('\n\n'),
			tests: '<!-- lightsout: tests/code-style -->\n# Test Style\n\nBackground for Test Style.\n\n## Mock Prefix\n\nMocks carry a mock prefix.',
		});
	});

	test('groups topics under level-2 Applies to headings by the exact package set, widest first, each topic once, with topic headings nested below', () => {
		const { groups } = setupSplitPacks();

		const { code } = buildStandardsDocuments({ groups });

		expect(nonBlankLines(code)).toStrictEqual([
			'## Applies to: repo root (outside packages), engine, web-app',
			'<!-- lightsout: code/fractal/modules -->',
			'### Modules',
			'Background for Modules.',
			'#### Graduation',
			'A concept earns its folder.',
			'<!-- lightsout: code/style/patterns -->',
			'### Patterns',
			'Background for Patterns.',
			'#### Functions',
			'Use arrow functions.',
			'#### Classes',
			'Default to functions.',
			'## Applies to: web-app',
			'<!-- lightsout: code/frameworks/react -->',
			'### React',
			'Background for React.',
			'#### Hooks At Top',
			'Call hooks at the top level.',
		]);
	});

	test('notes a rule that applies to fewer packages than its topic with one Applies only to line', () => {
		const { groups } = setupSplitPacks({ webAppOff: ['lightsout/classes'] });

		const { code } = buildStandardsDocuments({ groups });

		expect(nonBlankLines(code)).toStrictEqual([
			'## Applies to: repo root (outside packages), engine, web-app',
			'<!-- lightsout: code/fractal/modules -->',
			'### Modules',
			'Background for Modules.',
			'#### Graduation',
			'A concept earns its folder.',
			'<!-- lightsout: code/style/patterns -->',
			'### Patterns',
			'Background for Patterns.',
			'#### Functions',
			'Use arrow functions.',
			'Applies only to: repo root (outside packages), engine',
			'#### Classes',
			'Default to functions.',
			'## Applies to: web-app',
			'<!-- lightsout: code/frameworks/react -->',
			'### React',
			'Background for React.',
			'#### Hooks At Top',
			'Call hooks at the top level.',
		]);
	});

	test('leaves heading-like lines inside fenced code unchanged when it nests a topic under a heading', () => {
		const { groups } = setupFencedProse();

		const { code } = buildStandardsDocuments({ groups });

		expect(nonBlankLines(code)).toStrictEqual([
			'## Applies to: web-app',
			'<!-- lightsout: code/docs -->',
			'### Docs',
			'Background for Docs.',
			'#### Doc Layout',
			'Write the doc like this:',
			'````md',
			'# Kept Title',
			'```',
			'## Kept Too',
			'~~~',
			'````',
			'#### After The Fence',
			'Back in prose.',
		]);
	});

	test('orders package sets of the same size by their label', () => {
		const { groups } = setupEqualSets();

		const { code } = buildStandardsDocuments({ groups });

		expect(nonBlankLines(code).filter((line) => line.startsWith('## Applies to: '))).toStrictEqual(['## Applies to: engine', '## Applies to: web-app']);
	});

	test('groups the tests set independently of the code set', () => {
		const { groups } = setupSplitPacks();

		const { code, tests } = buildStandardsDocuments({ groups });

		expect({ tests, codeOpensWithHeading: (code ?? '').startsWith('## Applies to: ') }).toStrictEqual({
			tests: '<!-- lightsout: tests/code-style -->\n# Test Style\n\nBackground for Test Style.\n\n## Mock Prefix\n\nMocks carry a mock prefix.',
			codeOpensWithHeading: true,
		});
	});
});
