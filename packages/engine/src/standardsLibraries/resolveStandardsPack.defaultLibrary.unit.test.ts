import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { ResolvedStandardsPack } from '#src/standardsLibraries/common/types/ResolvedStandardsPack.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack.ts';

/** The topics each of the six shipped topic packs lists, stated here as the contract the pack files must meet. */
const fractalTopics = [
	'code/fractal/modules',
	'code/fractal/shared-code',
	'code/fractal/size',
	'code/fractal/duplication',
	'code/fractal/imports',
	'tests/fractal',
];
const agentCorrectionsTopics = [
	'code/agent-corrections/design',
	'code/agent-corrections/type-safety',
	'code/agent-corrections/comments',
	'tests/agent-corrections',
];
const codeStyleTopics = ['code/code-style/functions', 'code/code-style/classes', 'code/code-style/named-constants', 'tests/code-style'];
const reactTopics = ['code/frameworks/react', 'tests/frameworks/react'];
const tanstackStartTopics = ['code/frameworks/tanstack-start'];
const nestjsTopics = ['code/frameworks/nestjs'];
const goalTopics = [...fractalTopics, ...agentCorrectionsTopics, ...codeStyleTopics];
const frameworkTopics = [...reactTopics, ...tanstackStartTopics, ...nestjsTopics];
const frameworkPackNames = ['lightsout/react', 'lightsout/tanstack-start', 'lightsout/nestjs'];

/**
 * The shipped built-in library, loaded from its authored folder — not the copy
 * under plugin/, which would pass or fail on whether someone had regenerated it.
 * Anchored on this file rather than on process.cwd().
 */
const setupDefaultLibrary = async () => {
	const library = await readStandardsLibrary({ packPath: join(__dirname, '..', '..', '..', 'lightsout-standards') });

	return { library, libraries: [library] };
};

/** What a pack brings in, in an order that does not depend on include order. */
const summarizePack = ({ pack }: { pack: ResolvedStandardsPack }) => ({
	topics: pack.topics.map((topic) => topic.path).sort(),
	rules: pack.rules.map(({ rule, severity, options }) => ({ name: rule.name, severity, options })).sort((left, right) => left.name.localeCompare(right.name)),
});

/** Every rule of the named topics at its rule.md default severity and options. */
const expectPackOf = ({ library, topicPaths }: { library: LoadedStandardsLibrary; topicPaths: string[] }) => ({
	topics: [...topicPaths].sort(),
	rules: library.rules
		.filter((rule) => topicPaths.includes(rule.documentPath))
		.map((rule) => ({ name: rule.name, severity: rule.defaultSeverity, options: rule.defaultOptions }))
		.sort((left, right) => left.name.localeCompare(right.name)),
});

describe('resolveStandardsPack on the shipped lightsout library', () => {
	test.each([
		{ address: 'lightsout/fractal', topicPaths: fractalTopics },
		{ address: 'lightsout/agent-corrections', topicPaths: agentCorrectionsTopics },
		{ address: 'lightsout/code-style', topicPaths: codeStyleTopics },
	])('$address is its own topics at rule defaults, whatever the package declares', async ({ address, topicPaths }) => {
		const { library, libraries } = await setupDefaultLibrary();

		const pack = resolveStandardsPack({ addresses: [address], libraries, dependencies: new Set() });

		const expected = expectPackOf({ library, topicPaths });
		// an empty rule list would make "exactly these rules" hold vacuously
		expect(expected.rules.length).toBeGreaterThan(0);
		expect({ name: pack.name, conditionalPacks: pack.conditionalPacks, ...summarizePack({ pack }) }).toStrictEqual({
			name: address,
			conditionalPacks: [],
			...expected,
		});
	});

	test.each([
		{ address: 'lightsout/react', topicPaths: reactTopics, dependencies: ['react', 'preact', 'react-dom'] },
		{ address: 'lightsout/tanstack-start', topicPaths: tanstackStartTopics, dependencies: ['@tanstack/react-start', '@tanstack/start'] },
		{ address: 'lightsout/nestjs', topicPaths: nestjsTopics, dependencies: ['@nestjs/core'] },
	])('$address is its own topics at rule defaults, for a package declaring one of its dependencies', async ({ address, topicPaths, dependencies }) => {
		const { library, libraries } = await setupDefaultLibrary();

		const applied = dependencies.map((dependency) => resolveStandardsPack({ addresses: [address], libraries, dependencies: new Set([dependency]) }));
		const skipped = resolveStandardsPack({ addresses: [address], libraries, dependencies: new Set() });

		const expected = { conditionalPacks: [address], ...expectPackOf({ library, topicPaths }) };
		expect(applied.map((pack) => ({ conditionalPacks: pack.conditionalPacks, ...summarizePack({ pack }) }))).toStrictEqual(dependencies.map(() => expected));
		// a package declaring none of them gets nothing from the pack
		expect({ conditionalPacks: skipped.conditionalPacks, ...summarizePack({ pack: skipped }) }).toStrictEqual({ conditionalPacks: [], topics: [], rules: [] });
	});

	test('lightsout/standards is every topic, with each framework pack reaching only a package that declares its framework', async () => {
		const { library, libraries } = await setupDefaultLibrary();

		const whole = resolveStandardsPack({ addresses: ['lightsout/standards'], libraries, dependencies: undefined });
		const frameworkFree = resolveStandardsPack({ addresses: ['lightsout/standards'], libraries, dependencies: new Set() });
		const reactPackage = resolveStandardsPack({ addresses: ['lightsout/standards'], libraries, dependencies: new Set(['react']) });

		const everyTopic = library.documents.map((topic) => topic.path);
		expect({ conditionalPacks: whole.conditionalPacks, ...summarizePack({ pack: whole }) }).toStrictEqual({
			conditionalPacks: frameworkPackNames,
			...expectPackOf({ library, topicPaths: everyTopic }),
		});
		// the library's own topic list, read independently, is the three goal packs plus the three framework packs
		expect([...everyTopic].sort()).toStrictEqual([...goalTopics, ...frameworkTopics].sort());
		expect({ conditionalPacks: frameworkFree.conditionalPacks, ...summarizePack({ pack: frameworkFree }) }).toStrictEqual({
			conditionalPacks: [],
			...expectPackOf({ library, topicPaths: goalTopics }),
		});
		expect({ conditionalPacks: reactPackage.conditionalPacks, ...summarizePack({ pack: reactPackage }) }).toStrictEqual({
			conditionalPacks: ['lightsout/react'],
			...expectPackOf({ library, topicPaths: [...goalTopics, ...reactTopics] }),
		});
	});

	test('the lightsout library ships seven packs and its six topic packs cover each topic once', async () => {
		const { library, libraries } = await setupDefaultLibrary();

		const resolved = library.packs.map((packFile) => resolveStandardsPack({ addresses: [`lightsout/${packFile.name}`], libraries, dependencies: undefined }));

		const topicPackNames = ['lightsout/agent-corrections', 'lightsout/code-style', 'lightsout/fractal', ...frameworkPackNames];
		const topicsAcrossTopicPacks = resolved
			.filter((pack) => topicPackNames.includes(pack.name))
			.flatMap((pack) => pack.topics.map((topic) => topic.path))
			.sort();
		expect({
			packFiles: library.packs.map((packFile) => packFile.name),
			resolved: resolved.map((pack) => pack.name).sort(),
			topicsAcrossTopicPacks,
		}).toStrictEqual({
			packFiles: ['agent-corrections', 'code-style', 'fractal', 'nestjs', 'react', 'standards', 'tanstack-start'],
			resolved: [
				'lightsout/agent-corrections',
				'lightsout/code-style',
				'lightsout/fractal',
				'lightsout/nestjs',
				'lightsout/react',
				'lightsout/standards',
				'lightsout/tanstack-start',
			],
			// every library topic exactly once: a topic missing, or listed by two topic packs, breaks the equality
			topicsAcrossTopicPacks: library.documents.map((topic) => topic.path).sort(),
		});
	});
});
