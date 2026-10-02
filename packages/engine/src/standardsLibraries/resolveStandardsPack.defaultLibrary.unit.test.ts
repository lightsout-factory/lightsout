import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { ResolvedStandardsPack } from '#src/standardsLibraries/common/types/ResolvedStandardsPack.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack.ts';

/** The topics each of the six shipped topic packs lists, stated here as the contract the pack files must meet. */
const typescriptTopics = [
	'code/style-guide/conventions/casing',
	'code/style-guide/conventions/file-naming',
	'code/style-guide/conventions/lint-and-formatting',
	'code/style-guide/conventions/naming',
	'code/style-guide/conventions/variable-declaration',
	'code/style-guide/patterns/classes',
	'code/style-guide/patterns/functions',
	'code/style-guide/patterns/named-constants',
	'code/style-guide/typescript/return-types',
	'code/style-guide/typescript/type-assertions',
	'code/documentation/ts-docs',
];
const structureTopics = [
	'code/architecture/architecture-decisions',
	'code/architecture/folder-structure',
	'code/style-guide/structure/import-paths',
	'code/style-guide/structure/module-api',
	'code/style-guide/structure/one-export-per-file',
	'code/style-guide/structure/type-placement',
];
const unitTestingTopics = ['tests/unit-testing'];
const reactTopics = ['code/architecture/react', 'tests/unit-testing-react-components'];
const tanstackStartTopics = ['code/architecture/tanstack-start'];
const nestjsTopics = ['code/architecture/nestjs'];
const nodeTopics = [...typescriptTopics, ...structureTopics, ...unitTestingTopics];

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
	test('lightsout/node is typescript, structure and unit-testing at rule defaults', async () => {
		const { library, libraries } = await setupDefaultLibrary();

		const pack = resolveStandardsPack({ address: 'lightsout/node', libraries });

		const expected = expectPackOf({ library, topicPaths: nodeTopics });
		// an empty rule list would make "exactly these rules" hold vacuously
		expect(expected.rules.length).toBeGreaterThan(0);
		expect({ name: pack.name, ...summarizePack({ pack }) }).toStrictEqual({ name: 'lightsout/node', ...expected });
	});

	test('lightsout/react-app is node plus react', async () => {
		const { library, libraries } = await setupDefaultLibrary();

		const pack = resolveStandardsPack({ address: 'lightsout/react-app', libraries });

		expect(summarizePack({ pack })).toStrictEqual(expectPackOf({ library, topicPaths: [...nodeTopics, ...reactTopics] }));
	});

	test('lightsout/tanstack-start-app is react-app plus tanstack-start', async () => {
		const { library, libraries } = await setupDefaultLibrary();

		const pack = resolveStandardsPack({ address: 'lightsout/tanstack-start-app', libraries });

		const everyTopicButNestjs = library.documents.map((topic) => topic.path).filter((path) => path !== 'code/architecture/nestjs');
		expect(summarizePack({ pack })).toStrictEqual(expectPackOf({ library, topicPaths: everyTopicButNestjs }));
		// the library's own topic list, read independently, is node + react + tanstack-start
		expect([...everyTopicButNestjs].sort()).toStrictEqual([...nodeTopics, ...reactTopics, ...tanstackStartTopics].sort());
	});

	test('lightsout/nestjs-app is node plus nestjs', async () => {
		const { library, libraries } = await setupDefaultLibrary();

		const pack = resolveStandardsPack({ address: 'lightsout/nestjs-app', libraries });

		const summary = summarizePack({ pack });
		expect(summary).toStrictEqual(expectPackOf({ library, topicPaths: [...nodeTopics, ...nestjsTopics] }));
		expect(summary.topics.filter((path) => [...reactTopics, ...tanstackStartTopics].includes(path))).toStrictEqual([]);
	});

	test('the lightsout library ships ten packs and its six topic packs cover each topic once', async () => {
		const { library, libraries } = await setupDefaultLibrary();

		const resolved = library.packs.map((packFile) => resolveStandardsPack({ address: `lightsout/${packFile.name}`, libraries }));

		const topicPackNames = [
			'lightsout/nestjs',
			'lightsout/react',
			'lightsout/structure',
			'lightsout/tanstack-start',
			'lightsout/typescript',
			'lightsout/unit-testing',
		];
		const topicsAcrossTopicPacks = resolved
			.filter((pack) => topicPackNames.includes(pack.name))
			.flatMap((pack) => pack.topics.map((topic) => topic.path))
			.sort();
		expect({
			packFiles: library.packs.map((packFile) => packFile.name),
			resolved: resolved.map((pack) => pack.name).sort(),
			topicsAcrossTopicPacks,
		}).toStrictEqual({
			packFiles: ['nestjs', 'nestjs-app', 'node', 'react', 'react-app', 'structure', 'tanstack-start', 'tanstack-start-app', 'typescript', 'unit-testing'],
			resolved: [
				'lightsout/nestjs',
				'lightsout/nestjs-app',
				'lightsout/node',
				'lightsout/react',
				'lightsout/react-app',
				'lightsout/structure',
				'lightsout/tanstack-start',
				'lightsout/tanstack-start-app',
				'lightsout/typescript',
				'lightsout/unit-testing',
			],
			// every library topic exactly once: a topic missing, or listed by two topic packs, breaks the equality
			topicsAcrossTopicPacks: library.documents.map((topic) => topic.path).sort(),
		});
	});
});
