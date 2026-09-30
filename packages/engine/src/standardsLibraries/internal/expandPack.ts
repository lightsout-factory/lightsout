import type { StandardsRuleSettings } from '#src/contracts/StandardsRuleSettings.ts';
import type { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import type { LoadedStandardsTopic } from '#src/standardsLibraries/common/types/LoadedStandardsTopic.ts';
import type { PackExpansion } from '#src/standardsLibraries/internal/common/types/PackExpansion.ts';
import { resolveRuleName } from '#src/standardsLibraries/resolveRuleName.ts';

interface Params {
	/** `<library>/<file-stem>`. */
	address: string;
	/** Every library the repo registered. */
	libraries: LoadedStandardsLibrary[];
	/** The addresses being expanded above this one, outermost first; empty for the pack asked for. */
	chain: string[];
}

interface EntryParams {
	address: string;
	entry: string;
	expansion: PackExpansion;
	/** The libraries the pack can see. */
	libraries: LoadedStandardsLibrary[];
}

const splitAddress = ({ address }: { address: string }) => {
	const slash = address.indexOf('/');

	return slash === -1 ? undefined : { libraryName: address.slice(0, slash), path: address.slice(slash + 1) };
};

/** Every problem names the pack being expanded — or, for an included pack, the pack including it and the entry. */
const findPackFile = ({ address, libraries, chain }: { address: string; libraries: LoadedStandardsLibrary[]; chain: string[] }) => {
	const includedBy = chain.at(-1);
	const fail = ({ reason }: { reason: string }) =>
		new Error(includedBy === undefined ? `pack ${address}: ${reason}` : `pack ${includedBy}: include.packs entry "${address}" ${reason}`);
	const cycleStart = chain.indexOf(address);

	if (cycleStart !== -1) {
		throw fail({ reason: `closes an include cycle: ${[...chain.slice(cycleStart), address].join(' → ')}` });
	}

	const parts = splitAddress({ address });
	const library = libraries.find((candidate) => candidate.name === parts?.libraryName);

	if (parts === undefined || library === undefined) {
		throw fail({
			reason: parts === undefined ? 'is not an address of the form <library>/<name>' : `names library "${parts.libraryName}", which is not registered`,
		});
	}

	const packFile = library.packs.find((candidate) => candidate.name === parts.path);

	if (packFile === undefined) {
		throw fail({ reason: 'names no pack' });
	}

	return { library, packFile };
};

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
		const libraryName = splitAddress({ address: entry })?.libraryName;
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
};

const addWholeTopic = ({ address, entry, expansion, libraries }: EntryParams) => {
	const parts = splitAddress({ address: entry });
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

		if (!expansion.rules.has(resolved.rule.name)) {
			throw new Error(`pack ${address}: rule-settings entry "${key}" names ${resolved.rule.name}, which the pack does not include`);
		}

		const setting = typeof value === 'string' ? { severity: value, options: {} } : { severity: value.severity, options: value.options ?? {} };

		mergeSetting({ settings: expansion.settings, name: resolved.rule.name, setting });
	}
};

/**
 * Expands one pack into its explicit layer, never its final grades: included
 * packs merge in listed order, so the last listed wins only where it wrote a
 * value; topics and single rules add rules and carry no settings; the pack's
 * own `rule-settings` apply last. A pack reached twice by two branches is no
 * cycle — only one reached again inside itself is.
 *
 * @throws {Error} When the pack, or any include or rule-settings entry reachable from it, cannot be resolved, or packs include each other in a cycle.
 */
export const expandPack = ({ address, libraries, chain }: Params): PackExpansion => {
	const { library, packFile } = findPackFile({ address, libraries, chain });
	const visible = findVisibleLibraries({ address, library, include: packFile.include, libraries });
	const expansion: PackExpansion = { topics: new Map(), rules: new Map(), settings: new Map() };

	for (const entry of packFile.include.packs) {
		mergeExpansion({ into: expansion, from: expandPack({ address: entry, libraries, chain: [...chain, address] }) });
	}

	for (const entry of packFile.include.topics) {
		addWholeTopic({ address, entry, expansion, libraries: visible });
	}

	for (const entry of packFile.include.rules) {
		addSingleRule({ address, entry, expansion, libraries: visible });
	}

	applyRuleSettings({ address, expansion, ruleSettings: packFile.ruleSettings, libraries: visible });

	return expansion;
};
