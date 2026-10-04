import { expect, test } from '@jest/globals';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

const base = { gates: { check: 'c', test: 't', 'test-coverage': false } };

// The block contracts — Gates, PackageGates, ConfigCommands,
// StandardsRuleSettings — each pin their own shape in their own test. What
// this file owns is the composed config: which blocks are required, which are
// optional, and the top-level fields. Each opt-in block's own round trip
// through the composition is pinned in `LightsoutConfig.optionalBlocks.unit.test.ts`.

test('LightsoutConfig: gates is required, and every other block is optional', () => {
	// with no gates block there is nothing to verify a run with
	expect(LightsoutConfig.safeParse({}).success).toBe(false);
	// a config carrying only gates parses — commands, packageGates, and
	// standardsChecks are all opt-in (decision 2: backward compatibility)
	expect(LightsoutConfig.safeParse(base).success).toBe(true);
});

test('LightsoutConfig: each block reaches its own contract, valid and invalid alike', () => {
	// a valid entry in each block parses at the config level…
	const parsed = LightsoutConfig.parse({
		...base,
		commands: { implement: { harness: 'codex' } },
		'package-gates': { check: 'c {package}', test: 't {package}' },
		'standards-rule-settings': { 'duplicate-code-block': 'off' },
	});

	expect(parsed.commands).toStrictEqual({ implement: { harness: 'codex' } });
	expect(parsed['package-gates']).toStrictEqual({ check: 'c {package}', test: 't {package}' });
	expect(parsed['standards-rule-settings']).toStrictEqual({ 'duplicate-code-block': 'off' });

	// …and each block's own refusals fire through the composition, so wiring a
	// block in optional never softened it
	expect(LightsoutConfig.safeParse({ ...base, commands: { implment: {} } }).success).toBe(false);
	expect(LightsoutConfig.safeParse({ ...base, 'package-gates': { check: 'pnpm check', test: 't {package}' } }).success).toBe(false);
	expect(LightsoutConfig.safeParse({ ...base, 'standards-rule-settings': { 'duplicate-code-block': 'warn' } }).success).toBe(false);

	// an absent block leaves no key on the parsed config
	expect('package-gates' in LightsoutConfig.parse(base)).toBe(false);
	expect('standards-rule-settings' in LightsoutConfig.parse(base)).toBe(false);
});

test('LightsoutConfig: effort parses at the top level for every level, and an out-of-enum effort fails', () => {
	for (const effort of ['low', 'medium', 'high', 'xhigh', 'max']) {
		// ${effort} is one of the five levels every harness shares
		expect(LightsoutConfig.parse({ ...base, effort }).effort).toBe(effort);
	}

	// a typo is caught when config is read, not after a run has burned a request
	expect(LightsoutConfig.safeParse({ ...base, effort: 'ultra' }).success).toBe(false);
	// effort stays optional — absence means each harness uses its own default
	expect(LightsoutConfig.safeParse(base).success).toBe(true);
});

test('LightsoutConfig: permissions accepts the two settable levels and rejects everything else', () => {
	expect(LightsoutConfig.parse({ ...base, permissions: 'write' }).permissions).toBe('write');
	expect(LightsoutConfig.parse({ ...base, permissions: 'full-access' }).permissions).toBe('full-access');

	// read-only is engine-selected for the supervisor — never a sane choice for a
	// writing role
	expect(LightsoutConfig.safeParse({ ...base, permissions: 'read-only' }).success).toBe(false);

	for (const claudeMode of ['acceptEdits', 'bypassPermissions', 'plan']) {
		// ${claudeMode} is Claude Code's own vocabulary — it used to parse as a free
		// string and now does not
		expect(LightsoutConfig.safeParse({ ...base, permissions: claudeMode }).success).toBe(false);
	}
});

test('LightsoutConfig: coverage-summary-path is optional and parses as the path the coverage tooling writes', () => {
	expect(LightsoutConfig.parse({ ...base, 'coverage-summary-path': 'reports/coverage-summary.json' })['coverage-summary-path']).toBe(
		'reports/coverage-summary.json',
	);
	// absent means the Istanbul default location — every existing config stays valid
	expect(LightsoutConfig.parse(base)['coverage-summary-path']).toBe(undefined);
	// a path is a path: anything else would be read as a file name at run time
	expect(LightsoutConfig.safeParse({ ...base, 'coverage-summary-path': 42 }).success).toBe(false);
});

test('LightsoutConfig: executor-file-limit is optional and parses as the file ceiling the feature executor refuses past', () => {
	// a repo that wants a tighter or looser bound than the shipped default of 50
	// states it here, and the planning checks and the executor then read one number
	expect(LightsoutConfig.parse({ ...base, 'executor-file-limit': 80 })['executor-file-limit']).toBe(80);
	// absent means the engine's own default — every existing config stays valid
	expect(LightsoutConfig.parse(base)['executor-file-limit']).toBe(undefined);
	// and absence leaves no key on the parsed config, unlike an explicit value
	expect('executor-file-limit' in LightsoutConfig.parse(base)).toBe(false);
});

test.each([
	{ label: 'an executor-file-limit of 0', value: 0 },
	{ label: 'a negative executor-file-limit', value: -1 },
	{ label: 'an executor-file-limit given as a string', value: '50' },
	{ label: 'a null executor-file-limit', value: null },
	{ label: 'an executor-file-limit object', value: { max: 50 } },
])('LightsoutConfig: $label fails parsing', ({ value }) => {
	// a non-positive ceiling would refuse every plan before it created a single
	// file, and a non-number would be compared against a file count as something
	// other than a number — both are caught when config is read, not mid-run
	expect(LightsoutConfig.safeParse({ ...base, 'executor-file-limit': value }).success).toBe(false);
});

test('LightsoutConfig accepts standards-libraries as a map of names to strings and rejects a non-string value', () => {
	const parsed = LightsoutConfig.parse({ ...base, 'standards-libraries': { house: './standards/house', acme: '@acme/standards' } });

	// a folder value and a package value are both plain strings — telling them
	// apart is the path resolver's job, so the map survives parsing as written
	expect(parsed['standards-libraries']).toStrictEqual({ house: './standards/house', acme: '@acme/standards' });
	// a value that is not a string names no folder and no package
	expect(LightsoutConfig.safeParse({ ...base, 'standards-libraries': { house: 42 } }).success).toBe(false);
});

test('LightsoutConfig: standards-pack takes a library/pack address or false', () => {
	const named = LightsoutConfig.parse({ ...base, 'standards-pack': 'lightsout/standards' });
	const off = LightsoutConfig.parse({ ...base, 'standards-pack': false });

	// a library/pack address and false both survive parsing as written
	expect({ named: named['standards-pack'], off: off['standards-pack'] }).toStrictEqual({ named: 'lightsout/standards', off: false });
	// a pack name with no library says nothing about where the pack lives
	expect(LightsoutConfig.safeParse({ ...base, 'standards-pack': 'node' }).success).toBe(false);
	// only false switches standards off — true selects no pack
	expect(LightsoutConfig.safeParse({ ...base, 'standards-pack': true }).success).toBe(false);
});

test.each([
	{ label: 'a second slash', address: 'lightsout/standards/extra' },
	{ label: 'no library before the slash', address: '/node' },
	{ label: 'no pack after the slash', address: 'lightsout/' },
])('LightsoutConfig: a standards-pack address with $label is refused, and the refusal names the <library>/<pack> form', ({ address }) => {
	const result = LightsoutConfig.safeParse({ ...base, 'standards-pack': address });

	const messages = (result.error?.issues ?? []).map((issue) => issue.message).join('\n');

	expect({ parsed: result.success, namesForm: /<library>\/<pack>/.test(messages) }).toStrictEqual({ parsed: false, namesForm: true });
});

test('accepts package-standards-packs as a map of package folder to pack address and refuses a value that is not a pack address', () => {
	const parsed = LightsoutConfig.parse({ ...base, 'package-standards-packs': { 'web-app': 'lightsout/fractal' } });

	// the map survives parsing as written: a package folder name to a pack address
	expect(parsed['package-standards-packs']).toStrictEqual({ 'web-app': 'lightsout/fractal' });

	// an empty value, false or a number is no pack address, and the issue sits at
	// the package's own key — only standards-pack takes false
	const issuePaths = ['', false, 42].map((value) =>
		(LightsoutConfig.safeParse({ ...base, 'package-standards-packs': { 'web-app': value } }).error?.issues ?? []).map((issue) => issue.path.join('.')),
	);
	expect(issuePaths).toStrictEqual([['package-standards-packs.web-app'], ['package-standards-packs.web-app'], ['package-standards-packs.web-app']]);

	// a value with no slash or with two slashes is refused with the very message
	// standards-pack gives for the same value — one address schema, one refusal
	const addressRefusalsOf = (result: ReturnType<typeof LightsoutConfig.safeParse>) =>
		(result.error?.issues ?? []).map((issue) => issue.message).filter((message) => /<library>\/<pack>/.test(message));
	const refusals = ['fractal', 'lightsout/code/fractal'].map((address) => {
		const packageRefusals = addressRefusalsOf(LightsoutConfig.safeParse({ ...base, 'package-standards-packs': { 'web-app': address } }));
		const repoRefusals = addressRefusalsOf(LightsoutConfig.safeParse({ ...base, 'standards-pack': address }));
		return { refused: packageRefusals.length > 0, sameAsStandardsPack: packageRefusals.join('\n') === repoRefusals.join('\n') };
	});
	expect(refusals).toStrictEqual([
		{ refused: true, sameAsStandardsPack: true },
		{ refused: true, sameAsStandardsPack: true },
	]);
});

test('LightsoutConfig: the deleted standards-packs and standards-channels keys are rejected as unknown', () => {
	const packs = LightsoutConfig.safeParse({ ...base, 'standards-packs': ['./house'] });
	const channels = LightsoutConfig.safeParse({ ...base, 'standards-channels': ['react'] });

	// no alias and no migration message: the strict schema refuses each old key
	// by name, the same way it refuses a typo
	const unknownKeys = [packs, channels].map((result) =>
		(result.error?.issues ?? []).flatMap((issue) => (issue.code === 'unrecognized_keys' ? issue.keys : [])),
	);
	expect(unknownKeys).toStrictEqual([['standards-packs'], ['standards-channels']]);
});

test('LightsoutConfig: a key the schema does not declare is refused, at the top level and inside timeouts', () => {
	// a typo that parsed would leave its setting at the default while the file
	// says otherwise
	expect(LightsoutConfig.safeParse({ ...base, harnes: 'codex' }).success).toBe(false);
	expect(LightsoutConfig.safeParse({ ...base, timeouts: { 'agent-minutse': 30 } }).success).toBe(false);
});
