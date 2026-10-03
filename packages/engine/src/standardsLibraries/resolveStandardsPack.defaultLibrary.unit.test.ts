import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { ResolvedStandardsPack } from '#src/standardsLibraries/common/types/ResolvedStandardsPack.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack.ts';

/** The topics each of the four shipped topic packs lists, stated here as the contract the pack files must meet. */
const fractalTopics = [
	'code/fractal/modules',
	'code/fractal/shared-code',
	'code/fractal/size',
	'code/fractal/duplication',
	'code/fractal/imports',
	'tests/fractal',
];
const codeStyleTopics = [
	'code/code-style/functions',
	'code/code-style/classes',
	'code/code-style/named-constants',
	'code/code-style/type-safety',
	'tests/code-style',
];
const reactOwnTopics = ['code/frameworks/react', 'tests/frameworks/react'];
const tanstackStartOwnTopics = ['tests/frameworks/tanstack-start'];
const goalTopics = [...fractalTopics, ...codeStyleTopics];
const frameworkTopics = [...reactOwnTopics, ...tanstackStartOwnTopics];

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
		{ address: 'lightsout/react', topicPaths: reactOwnTopics },
		{ address: 'lightsout/tanstack-start', topicPaths: tanstackStartOwnTopics },
	])('$address holds only the topics written for its framework, at rule defaults', async ({ address, topicPaths }) => {
		const { library, libraries } = await setupDefaultLibrary();

		const pack = resolveStandardsPack({ addresses: [address], libraries, dependencies: new Set() });

		const expected = expectPackOf({ library, topicPaths });
		// an empty rule list would make "exactly these rules" hold vacuously
		expect(expected.rules.length).toBeGreaterThan(0);
		expect({ conditionalPacks: pack.conditionalPacks, ...summarizePack({ pack }) }).toStrictEqual({ conditionalPacks: [], ...expected });
	});

	test('lightsout/standards is the two goal packs, and holds no framework topic', async () => {
		const { library, libraries } = await setupDefaultLibrary();

		const standards = resolveStandardsPack({ addresses: ['lightsout/standards'], libraries, dependencies: undefined });

		const everyTopic = library.documents.map((topic) => topic.path);
		// the library's own topic list, read independently, is the two goal packs plus the two framework packs' own topics
		expect([...everyTopic].sort()).toStrictEqual([...goalTopics, ...frameworkTopics].sort());
		expect({ conditionalPacks: standards.conditionalPacks, ...summarizePack({ pack: standards }) }).toStrictEqual({
			conditionalPacks: [],
			...expectPackOf({ library, topicPaths: goalTopics }),
		});
	});

	test('the lightsout library ships five packs, and its four topic packs cover each topic once', async () => {
		const { library, libraries } = await setupDefaultLibrary();

		const resolved = library.packs.map((packFile) => resolveStandardsPack({ addresses: [`lightsout/${packFile.name}`], libraries, dependencies: undefined }));

		const topicsAcrossPacks = resolved
			.filter((pack) => pack.name !== 'lightsout/standards')
			.flatMap((pack) => pack.topics.map((topic) => topic.path))
			.sort();
		expect({
			packFiles: library.packs.map((packFile) => packFile.name),
			resolved: resolved.map((pack) => pack.name).sort(),
			topicsAcrossPacks,
		}).toStrictEqual({
			packFiles: ['code-style', 'fractal', 'react', 'standards', 'tanstack-start'],
			resolved: ['lightsout/code-style', 'lightsout/fractal', 'lightsout/react', 'lightsout/standards', 'lightsout/tanstack-start'],
			// every library topic exactly once: a topic missing, or listed by two topic packs, breaks the equality
			topicsAcrossPacks: library.documents.map((topic) => topic.path).sort(),
		});
	});
});
