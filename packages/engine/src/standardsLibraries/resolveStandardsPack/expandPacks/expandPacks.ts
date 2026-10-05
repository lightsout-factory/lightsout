import type { LoadedStandardsLibrary } from '#src/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { LoadedStandardsTopic } from '#src/common/types/LoadedStandardsTopic.ts';
import type { StandardsRuleSettings } from '#src/contracts/StandardsRuleSettings.ts';
import type { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { resolveRuleName } from '#src/standardsLibraries/resolveRuleName.ts';
import { applyPackCondition } from '#src/standardsLibraries/resolveStandardsPack/expandPacks/applyPackCondition.ts';
import { splitPackAddress } from '#src/standardsLibraries/resolveStandardsPack/expandPacks/common/splitPackAddress.ts';
import type { PackExpansion } from '#src/standardsLibraries/resolveStandardsPack/expandPacks/common/types/PackExpansion.ts';
import { findPackFile } from '#src/standardsLibraries/resolveStandardsPack/expandPacks/findPackFile.ts';

interface Params {
	/** Pack addresses, `<library>/<file-stem>`, merged in listed order as a pack's own `include.packs` are. */
	addresses: string[];
	/** Every library the repo registered. */
	libraries: LoadedStandardsLibrary[];
	/** The dependencies the package declares, which decide each conditional pack; undefined = every conditional pack applies. */
	dependencies: ReadonlySet<string> | undefined;
}

interface OnePackParams extends Omit<Params, 'addresses'> {
	/** `<library>/<file-stem>`. */
	address: string;
	/** The addresses being expanded above this one, outermost first; empty for a pack asked for by name. */
	chain: string[];
}

interface EntryParams {
	address: string;
	entry: string;
	expansion: PackExpansion;
	/** The libraries the pack can see. */
	libraries: LoadedStandardsLibrary[];
}

/**
 * A short rule name resolves among the pack's own library and the libraries its
 * include entries name — never every registered library, so what a pack means
 * does not depend on which other libraries a repo happens to register.
 */
const findVisibleLibraries = ({
	address,
	library,
	include,
	libraries,
}: {
	address: string;
	library: LoadedStandardsLibrary;
	include: { packs: string[]; topics: string[]; rules: string[] };
	libraries: LoadedStandardsLibrary[];
}) => {
	const visible = [library];
	const entries = [
		...include.packs.map((entry) => ({ list: 'include.packs', entry })),
		...include.topics.map((entry) => ({ list: 'include.topics', entry })),
		...include.rules.filter((entry) => entry.includes('/')).map((entry) => ({ list: 'include.rules', entry })),
	];

	for (const { list, entry } of entries) {
		const libraryName = splitPackAddress({ address: entry })?.libraryName;
		const named = libraries.find((candidate) => candidate.name === libraryName);

		if (libraryName === undefined) {
			throw new Error(`pack ${address}: ${list} entry "${entry}" is not an address of the form <library>/<name>`);
		}

		if (named === undefined) {
			throw new Error(`pack ${address}: ${list} entry "${entry}" names library "${libraryName}", which the repo has not registered`);
		}

		if (!visible.includes(named)) {
			visible.push(named);
		}
	}

	return visible;
};

const mergeSetting = ({
	settings,
	name,
	setting,
}: {
	settings: PackExpansion['settings'];
	name: string;
	setting: { severity?: StandardsSeverity; options: Record<string, number> };
}) => {
	const current = settings.get(name);

	settings.set(name, { severity: setting.severity ?? current?.severity, options: { ...current?.options, ...setting.options } });
};

const addTopic = ({ expansion, topic }: { expansion: PackExpansion; topic: LoadedStandardsTopic }) => {
	const key = `${topic.library}/${topic.path}`;

	if (!expansion.topics.has(key)) {
		expansion.topics.set(key, topic);
	}
};

const addRule = ({ expansion, rule }: { expansion: PackExpansion; rule: LoadedStandardsRule }) => {
	if (!expansion.rules.has(rule.name)) {
		expansion.rules.set(rule.name, rule);
	}
};

const mergeExpansion = ({ into, from }: { into: PackExpansion; from: PackExpansion }) => {
	for (const topic of from.topics.values()) {
		addTopic({ expansion: into, topic });
	}

	for (const rule of from.rules.values()) {
		addRule({ expansion: into, rule });
	}

	for (const [name, setting] of from.settings) {
		mergeSetting({ settings: into.settings, name, setting });
	}

	for (const conditionalPack of from.conditionalPacks) {
		into.conditionalPacks.add(conditionalPack);
	}

	for (const [name, rule] of from.inactiveRules) {
		into.inactiveRules.set(name, rule);
	}
};

const addWholeTopic = ({ address, entry, expansion, libraries }: EntryParams) => {
	const parts = splitPackAddress({ address: entry });
	const library = libraries.find((candidate) => candidate.name === parts?.libraryName);
	const topic = library?.documents.find((candidate) => candidate.path === parts?.path);

	if (library === undefined || topic === undefined) {
		throw new Error(`pack ${address}: include.topics entry "${entry}" names no topic`);
	}

	addTopic({ expansion, topic });

	for (const ruleId of topic.ruleIds) {
		const rule = library.rules.find((candidate) => candidate.id === ruleId);

		if (rule !== undefined) {
			addRule({ expansion, rule });
		}
	}
};

/** A single rule brings the topic it argues under, but never that topic's other rules. */
const addSingleRule = ({ address, entry, expansion, libraries }: EntryParams) => {
	const resolved = resolveRuleName({ name: entry, rules: libraries.flatMap((library) => library.rules) });

	if ('problem' in resolved) {
		throw new Error(`pack ${address}: include.rules entry "${entry}" — ${resolved.problem}`);
	}

	const { rule } = resolved;
	const topic = libraries.find((library) => library.name === rule.library)?.documents.find((candidate) => candidate.path === rule.documentPath);

	if (topic !== undefined) {
		addTopic({ expansion, topic });
	}

	addRule({ expansion, rule });
};

const applyRuleSettings = ({ address, expansion, ruleSettings, libraries }: Omit<EntryParams, 'entry'> & { ruleSettings: StandardsRuleSettings }) => {
	const rules = libraries.flatMap((library) => library.rules);

	for (const [key, value] of Object.entries(ruleSettings)) {
		const resolved = resolveRuleName({ name: key, rules });

		if ('problem' in resolved) {
			throw new Error(`pack ${address}: rule-settings entry "${key}" — ${resolved.problem}`);
		}

		const { name } = resolved.rule;

		if (!expansion.rules.has(name) && !expansion.inactiveRules.has(name)) {
			throw new Error(`pack ${address}: rule-settings entry "${key}" names ${name}, which the pack does not include`);
		}

		// A rule only a conditional pack that did not apply would bring takes no setting for this package.
		if (expansion.rules.has(name)) {
			const setting = typeof value === 'string' ? { severity: value, options: {} } : { severity: value.severity, options: value.options ?? {} };

			mergeSetting({ settings: expansion.settings, name, setting });
		}
	}
};

const emptyExpansion = (): PackExpansion => ({
	topics: new Map(),
	rules: new Map(),
	settings: new Map(),
	conditionalPacks: new Set(),
	inactiveRules: new Map(),
});

/** A conditional pack is expanded like any other, then kept or emptied by `applyPackCondition`. */
const expandPack = ({ address, libraries, chain, dependencies }: OnePackParams): PackExpansion => {
	const { library, packFile } = findPackFile({ address, libraries, chain });
	const visible = findVisibleLibraries({ address, library, include: packFile.include, libraries });
	const expansion = emptyExpansion();

	for (const entry of packFile.include.packs) {
		mergeExpansion({ into: expansion, from: expandPack({ address: entry, libraries, chain: [...chain, address], dependencies }) });
	}

	for (const entry of packFile.include.topics) {
		addWholeTopic({ address, entry, expansion, libraries: visible });
	}

	for (const entry of packFile.include.rules) {
		addSingleRule({ address, entry, expansion, libraries: visible });
	}

	applyRuleSettings({ address, expansion, ruleSettings: packFile.ruleSettings, libraries: visible });

	return applyPackCondition({ address, packFile, expansion, dependencies });
};

/**
 * Expands packs into their explicit layer, never their final grades: packs
 * merge in listed order, so the last listed wins only where it wrote a value;
 * topics and single rules add rules and carry no settings; a pack's own
 * `rule-settings` apply after everything it includes. A pack reached twice by
 * two branches is no cycle — only one reached again inside itself is.
 *
 * @throws {Error} When a pack, or any include or rule-settings entry reachable from one, cannot be resolved, or packs include each other in a cycle.
 */
export const expandPacks = ({ addresses, libraries, dependencies }: Params): PackExpansion => {
	const expansion = emptyExpansion();

	for (const address of addresses) {
		mergeExpansion({ into: expansion, from: expandPack({ address, libraries, chain: [], dependencies }) });
	}

	return expansion;
};
