import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts';
import { listStandardsRules } from '#src/standardsCheck/listStandardsRules.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

/** Standards are opt-in, so the config a case starts from names the shipped standards pack; a case on another pack, or none, overrides it. */
const baseConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false as const }, 'standards-pack': 'lightsout/standards' };

interface LibrarySpec {
	/** Repo-relative folder the library is written under. */
	at: string;
	name: string;
	ruleId: string;
	severity?: typeof StandardsSeverity.Blocking | typeof StandardsSeverity.Advisory;
	options?: Record<string, number>;
	/** The topics its one pack, `<name>/<name>`, brings in; its own document alone when omitted. */
	topics?: string[];
}

/**
 * A agent-only standards library written under `at`, holding one rule that
 * declares whatever the caller passes and one pack named after the library.
 * Nothing here is shipped by the engine, so a row read back off it proves the
 * listing carries the library author's own words rather than the defaults.
 */
const writeLibrary = ({
	cwd,
	at,
	name,
	ruleId,
	severity = StandardsSeverity.Advisory,
	options = {},
	topics = [`${name}/code/demo`],
}: LibrarySpec & { cwd: string }) => {
	const libraryPath = join(cwd, at);
	const rulePath = `rules/code/demo/01-${ruleId}`;
	const optionLines = Object.entries(options).map(([key, value]) => `  ${key}: ${value}`);
	const optionsBlock = optionLines.length === 0 ? '' : `options:\n${optionLines.join('\n')}\n`;
	const files: Record<string, string> = {
		'lightsout-standards.json': `{ "name": "${name}", "formatVersion": 2 }\n`,
		[`packs/${name}.json`]: JSON.stringify({ description: `the ${name} pack`, include: { topics } }),
		'rules/code/demo/topic.md': '# Demo\n\nThe document the rule argues under.\n',
		[`${rulePath}/rule.md`]: `---\nsummary: what ${ruleId} catches\nchecks: agent\nseverity: ${severity}\n${optionsBlock}---\n\nThe rule prose.\n`,
		[`${rulePath}/fixtures/pass/src/example.ts`]: 'export const example = 1;\n',
		[`${rulePath}/fixtures/fail/src/example.ts`]: 'export const example = 2;\n',
	};

	for (const [path, content] of Object.entries(files)) {
		const absolutePath = join(libraryPath, path);

		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}
};

/** A temp consumer repo holding the given libraries — the listing reads exactly the pack its config names. */
const setupRepo = ({ libraries = [] }: { libraries?: LibrarySpec[] } = {}) => {
	const repoCwd = mkdtempSync(join(tmpdir(), 'lightsout-list-rules-'));

	for (const spec of libraries) {
		writeLibrary({ cwd: repoCwd, ...spec });
	}

	return { cwd: repoCwd };
};

/** The listing a repo gets: the groups its config resolves to, listed. The config names lightsout/standards and nothing else unless the case passes its own. */
const listFor = async ({ cwd, config = LightsoutConfig.parse(baseConfig) }: { cwd: string; config?: LightsoutConfig }) =>
	listStandardsRules({ groups: await resolveStandardsGroups({ cwd, config }) });

describe('listStandardsRules', () => {
	test('a row restates what the pack author declared, down to the numbers', async () => {
		const { cwd: repo } = setupRepo({
			libraries: [{ at: 'standards/house', name: 'house', ruleId: 'house-rule', severity: StandardsSeverity.Blocking, options: { maxLines: 40 } }],
		});

		const rules = await listFor({
			cwd: repo,
			config: LightsoutConfig.parse({ ...baseConfig, 'standards-libraries': { house: './standards/house' }, 'standards-pack': 'house/house' }),
		});

		// nothing in this pack ships with the engine, so the row can only have
		// come from the rule's own front matter — including that it has no deterministic check
		expect(rules).toStrictEqual([
			{
				rule: 'house/house-rule',
				doc: 'house: code/demo',
				summary: 'what house-rule catches',
				deterministic: false,
				agent: true,
				severity: StandardsSeverity.Blocking,
				fromConfig: false,
				options: { maxLines: 40 },
				packages: [''],
			},
		]);
	});

	test('rules from several packs are one ledger sorted by id, each row naming the pack it came from', async () => {
		const { cwd: repo } = setupRepo({
			libraries: [
				{ at: 'standards/house', name: 'house', ruleId: 'zebra-rule', topics: ['team/code/demo', 'house/code/demo'] },
				{ at: 'standards/team', name: 'team', ruleId: 'aardvark-rule' },
			],
		});

		const rules = await listFor({
			cwd: repo,
			config: LightsoutConfig.parse({
				...baseConfig,
				'standards-libraries': { team: './standards/team', house: './standards/house' },
				'standards-pack': 'house/house',
			}),
		});

		// a reader looking a rule up scans one alphabetical list, not one list per
		// library — and still sees which library to argue with about each rule
		expect(rules.map((rule) => `${rule.rule} → ${rule.doc}`)).toStrictEqual(['house/zebra-rule → house: code/demo', 'team/aardvark-rule → team: code/demo']);
	});

	test('a repo that turned standards packs off lists nothing rather than the defaults', async () => {
		const { cwd: repo } = setupRepo();

		const rules = await listFor({ cwd: repo, config: LightsoutConfig.parse({ ...baseConfig, 'standards-pack': false }) });

		// listing the shipped rules here would advertise a policy this repo opted out of
		expect(rules).toStrictEqual([]);
	});

	test('a declared pack that cannot load refuses the listing instead of printing a shorter one', async () => {
		const { cwd: repo } = setupRepo({ libraries: [{ at: 'standards/house', name: 'house', ruleId: 'house-rule' }] });

		const error = await getRejectionError({
			promise: listFor({
				cwd: repo,
				config: LightsoutConfig.parse({
					...baseConfig,
					'standards-libraries': { house: './standards/house', ghost: './standards/ghost' },
					'standards-pack': 'house/house',
				}),
			}),
		});

		// a ledger missing the half that failed to load reads as a repo that enforces less than it does
		expect(error.message).toContain('standards library ghost (./standards/ghost) will not load');
		expect(error.message).toContain(`${join(repo, 'standards/ghost')} holds no lightsout-standards.json`);
	});

	test('each listing names its rule by full name', async () => {
		const { cwd: repo } = setupRepo({
			libraries: [{ at: 'standards/acme', name: 'acme', ruleId: 'size', severity: StandardsSeverity.Blocking, options: { maxLines: 40 } }],
		});

		const rules = await listFor({
			cwd: repo,
			config: LightsoutConfig.parse({ ...baseConfig, 'standards-libraries': { acme: './standards/acme' }, 'standards-pack': 'acme/acme' }),
		});

		// the rule column is the name a finding carries, so it spells the library
		// as well as the rule — another library may hold its own `size`
		expect(rules).toStrictEqual([
			{
				rule: 'acme/size',
				doc: 'acme: code/demo',
				summary: 'what size catches',
				deterministic: false,
				agent: true,
				severity: StandardsSeverity.Blocking,
				fromConfig: false,
				options: { maxLines: 40 },
				packages: [''],
			},
		]);
	});
});
