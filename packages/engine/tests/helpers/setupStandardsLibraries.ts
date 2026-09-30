import type { StandardsRuleSettings } from '#src/contracts/StandardsRuleSettings.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsPackFile } from '#src/standardsLibraries/common/types/LoadedStandardsPackFile.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import type { LoadedStandardsTopic } from '#src/standardsLibraries/common/types/LoadedStandardsTopic.ts';

interface RuleSpec {
	id: string;
	/** The rule.md default; blocking when omitted. */
	severity?: StandardsSeverity;
	/** The rule.md default options; none when omitted. */
	options?: Record<string, number>;
}

interface TopicSpec {
	/** Library-relative topic path, e.g. 'code/demo'. */
	path: string;
	rules?: RuleSpec[];
}

interface PackSpec {
	/** File stem — the pack's address is `<library>/<name>`. */
	name: string;
	packs?: string[];
	topics?: string[];
	rules?: string[];
	ruleSettings?: StandardsRuleSettings;
}

interface LibrarySpec {
	name: string;
	topics?: TopicSpec[];
	packs?: PackSpec[];
}

interface Params {
	libraries: LibrarySpec[];
}

const buildRule = ({ library, path, spec }: { library: string; path: string; spec: RuleSpec }): LoadedStandardsRule => ({
	id: spec.id,
	name: `${library}/${spec.id}`,
	library,
	set: 'code',
	documentPath: path,
	summary: 'a rule',
	prose: 'the argument for the rule',
	channel: 'base',
	checked: false,
	defaultSeverity: spec.severity ?? StandardsSeverity.Blocking,
	defaultOptions: spec.options ?? {},
	requires: [],
	fixturesPath: `/libraries/${library}/${path}/${spec.id}/fixtures`,
});

const buildTopic = ({ library, spec }: { library: string; spec: TopicSpec }): LoadedStandardsTopic => ({
	set: 'code',
	library,
	path: spec.path,
	channel: 'base',
	intro: `# ${spec.path}`,
	ruleIds: (spec.rules ?? []).map((rule) => rule.id),
});

const buildPack = ({ name, packs = [], topics = [], rules = [], ruleSettings = {} }: PackSpec): LoadedStandardsPackFile => ({
	name,
	filePath: `packs/${name}.json`,
	description: `the ${name} pack`,
	include: { packs, topics, rules },
	ruleSettings,
});

const buildLibrary = ({ name, topics = [], packs = [] }: LibrarySpec): LoadedStandardsLibrary => ({
	name,
	formatVersion: 1,
	rootPath: `/libraries/${name}`,
	documents: topics.map((spec) => buildTopic({ library: name, spec })),
	rules: topics.flatMap((topic) => (topic.rules ?? []).map((spec) => buildRule({ library: name, path: topic.path, spec }))),
	packs: packs.map(buildPack),
});

/** Every library the repo registered, each written as its topics, rules and pack files — loaded in memory, never read from disk. */
export const setupStandardsLibraries = ({ libraries }: Params): { libraries: LoadedStandardsLibrary[] } => ({ libraries: libraries.map(buildLibrary) });
