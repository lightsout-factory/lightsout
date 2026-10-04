import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { FixtureSide } from '#src/contracts/views/FixtureSide.ts';
import type { StandardsPackBundle } from '#src/contracts/views/StandardsPackBundle.ts';
import type { StandardsPackRuleView } from '#src/contracts/views/StandardsPackRuleView.ts';
import type { LoadedStandardsPackFile } from '#src/standardsLibraries/common/types/LoadedStandardsPackFile.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import type { ResolvedStandardsPack } from '#src/standardsLibraries/common/types/ResolvedStandardsPack.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { resolveAuthoredStandardsLibrary } from '#src/standardsLibraries/resolveAuthoredStandardsLibrary.ts';
import { resolveDefaultStandardsLibrary } from '#src/standardsLibraries/resolveDefaultStandardsLibrary.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack.ts';
import { estimateTokens } from '#src/views/internal/common/utils/estimateTokens.ts';
import { readPackFixtures } from '#src/views/internal/common/utils/readPackFixtures.ts';
import { resolveRuleExample } from '#src/views/internal/common/utils/resolveRuleExample.ts';
import { toStandardsPackRuleListing } from '#src/views/internal/common/utils/toStandardsPackRuleListing.ts';

/** Pass before fail, the order a rule's proof reads in — never the alphabet, which would put the counter-example first. */
const fixtureSideOrder = [FixtureSide.Pass, FixtureSide.Fail];

const toRuleView = async ({ rule }: { rule: LoadedStandardsRule }) => {
	// `run` and `inputKinds` are deliberately dropped: a function cannot cross the
	// wire, and no page shows a check's source code.
	const fixtures = await readPackFixtures({ fixturesPath: rule.fixturesPath });
	const fixtureCounts = {
		pass: fixtures.filter((fixture) => fixture.side === FixtureSide.Pass).length,
		fail: fixtures.filter((fixture) => fixture.side === FixtureSide.Fail).length,
	};

	return {
		...toStandardsPackRuleListing({ rule, fixtureCounts }),
		prose: rule.prose,
		fixtures,
		example: resolveRuleExample({ declared: rule.example, fixtures }),
	};
};

/** The pack file says what it includes; the resolved pack says what that brings in, at the grades the pack settles on. */
const toPackListing = ({ packFile, resolved }: { packFile: LoadedStandardsPackFile; resolved: ResolvedStandardsPack }) => {
	const deterministic = resolved.rules.filter((entry) => entry.rule.deterministic).length;
	const agent = resolved.rules.filter((entry) => entry.rule.agent).length;
	// A rule that is off sends no prose to an agent, so it costs nothing to read.
	const readByAgents = [
		...resolved.topics.map((topic) => topic.intro),
		...resolved.rules.filter((entry) => entry.severity !== StandardsSeverity.Off).map((entry) => entry.rule.prose),
	];

	return {
		name: packFile.name,
		address: resolved.name,
		description: packFile.description,
		...(packFile.appliesWhen === undefined ? {} : { appliesWhen: packFile.appliesWhen }),
		include: packFile.include,
		topics: resolved.topics.map((topic) => `${topic.library}/${topic.path}`),
		rules: resolved.rules.map((entry) => ({ name: entry.rule.name, severity: entry.severity, options: entry.options })),
		totals: {
			rules: resolved.rules.length,
			deterministic,
			agent,
			topics: resolved.topics.length,
			tokens: estimateTokens({ text: readByAgents.join('\n\n') }),
		},
	};
};

/**
 * `assets/default-pack.json` is committed and compared byte for byte in CI, so
 * its order must be decided where the bundle is produced, not left to the filesystem.
 */
const sortBundle = ({ bundle }: { bundle: StandardsPackBundle }) => ({
	...bundle,
	packs: [...bundle.packs]
		.sort((left, right) => left.name.localeCompare(right.name))
		.map((pack) => ({
			...pack,
			topics: [...pack.topics].sort((left, right) => left.localeCompare(right)),
			rules: [...pack.rules].sort((left, right) => left.name.localeCompare(right.name)),
		})),
	topics: [...bundle.topics].sort((left, right) => left.path.localeCompare(right.path)),
	rules: [...bundle.rules]
		.sort((left, right) => left.id.localeCompare(right.id))
		.map((rule) => ({
			...rule,
			fixtures: [...rule.fixtures].sort(
				(left, right) => fixtureSideOrder.indexOf(left.side) - fixtureSideOrder.indexOf(right.side) || left.path.localeCompare(right.path),
			),
		})),
});

interface Params {
	cwd: string;
}

/**
 * The built-in library read off disk and folded whole — every rule with its
 * fixtures, and every pack file with what it resolves to — so nothing
 * downstream ever holds a `LoadedStandardsLibrary`. An authored copy beside
 * `cwd` wins over the shipped one, which carries no fixtures.
 *
 * @param cwd - the repo the build runs in, where an authored copy of the built-in library is looked for
 * @throws {Error} When the library fails to load, or one of its pack files fails to resolve.
 */
export const getStandardsPackBundle = async ({ cwd }: Params): Promise<StandardsPackBundle> => {
	const library = await readStandardsLibrary({ packPath: resolveAuthoredStandardsLibrary({ cwd }) ?? resolveDefaultStandardsLibrary() });
	const rules: StandardsPackRuleView[] = [];

	for (const rule of library.rules) {
		rules.push(await toRuleView({ rule }));
	}

	// Resolved against this library alone: the built-in library's packs name no
	// other, so a pack that does fails here rather than being dropped.
	const packs = library.packs.map((packFile) =>
		toPackListing({
			packFile,
			resolved: resolveStandardsPack({ addresses: [`${library.name}/${packFile.name}`], libraries: [library], dependencies: undefined }),
		}),
	);
	const deterministic = rules.filter((rule) => rule.deterministic).length;

	return sortBundle({
		bundle: {
			name: library.name,
			...(library.description === undefined ? {} : { description: library.description }),
			...(library.homepage === undefined ? {} : { homepage: library.homepage }),
			rootPath: library.rootPath,
			built: library.built === true,
			totals: {
				rules: rules.length,
				deterministic,
				agent: rules.filter((rule) => rule.agent).length,
				topics: library.documents.length,
				packs: packs.length,
				withFixtures: rules.filter((rule) => rule.fixtureCounts.pass > 0 && rule.fixtureCounts.fail > 0).length,
			},
			packs,
			topics: library.documents.map((topic) => ({ set: topic.set, path: topic.path, intro: topic.intro, ruleIds: topic.ruleIds })),
			rules,
		},
	});
};
