import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { readStandardsLedger } from '#src/cli/readStandardsLedger.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { StandardsRuleListing } from '#src/common/types/StandardsRuleListing.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// Mocked Imports
// -------------------------
// The groups and the listing are their own modules' to build and test; what
// this loader owns is the pairing — which config the groups are resolved from,
// that the listing is built from those groups, and how a missing or unloadable
// half is treated.

interface ResolveStandardsGroupsParams {
	cwd: string;
	config: LightsoutConfig | undefined;
	packages?: string[];
}

interface ListStandardsRulesParams {
	groups: StandardsGroup[];
}

const mockResolveStandardsGroups = jest.fn<(params: ResolveStandardsGroupsParams) => Promise<StandardsGroup[]>>();
const mockListStandardsRules = jest.fn<(params: ListStandardsRulesParams) => StandardsRuleListing[]>();

jest.mock('#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts', () => ({
	resolveStandardsGroups: (params: ResolveStandardsGroupsParams) => mockResolveStandardsGroups(params),
}));
jest.mock('#src/standardsCheck/listStandardsRules.ts', () => ({
	listStandardsRules: (params: ListStandardsRulesParams) => mockListStandardsRules(params),
}));
// -------------------------

const resolveParams = () => mockResolveStandardsGroups.mock.calls[0]?.[0];
const listParams = () => mockListStandardsRules.mock.calls[0]?.[0];

/** One root group holding the standards pack — its contents are the listing's business, not this loader's. */
const nodeGroup = (): StandardsGroup => ({
	packages: [''],
	pack: { name: 'lightsout/standards', topics: [], rules: [], conditionalPacks: [], inactiveRules: [] },
	states: new Map(),
});

// A case that states nothing about the groups resolves them for real, from the repo's own config.
beforeEach(() => {
	mockResolveStandardsGroups.mockImplementation(
		jest.requireActual<typeof import('#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts')>(
			'#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts',
		).resolveStandardsGroups,
	);
});

describe('readStandardsLedger', () => {
	test("the repo's own config and path reach the listing, so the ledger is this repo's policy", async () => {
		const cwd = setupConsumerRepo({ git: false, config: { 'standards-rule-settings': { 'duplicate-code-block': 'off' } } });

		const groups = [nodeGroup()];

		mockResolveStandardsGroups.mockResolvedValue(groups);
		mockListStandardsRules.mockReturnValue([]);

		const { config } = await readStandardsLedger({ cwd });

		expect(resolveParams()?.config).toEqual(expect.objectContaining({ 'standards-rule-settings': expect.objectContaining({ 'duplicate-code-block': 'off' }) }));
		// the repo path travels too: the pack a listing is built from is the one
		// this repo asked for, resolved against it
		expect(resolveParams()?.cwd).toBe(cwd);
		// and the listing is built from exactly the groups resolved for this repo
		expect(listParams()?.groups).toBe(groups);
		// and the caller gets the same config back, so both halves read one answer
		expect(config).toEqual(expect.objectContaining({ 'standards-rule-settings': expect.objectContaining({ 'duplicate-code-block': 'off' }) }));
	});

	test('a repo with no config still gets an answer — every rule at its default', async () => {
		const rules = [{ rule: 'multi-export' } as StandardsRuleListing];

		mockResolveStandardsGroups.mockResolvedValue([nodeGroup()]);
		mockListStandardsRules.mockReturnValue(rules);

		const ledger = await readStandardsLedger({ cwd: mkdtempSync(join(tmpdir(), 'lightsout-ledger-')) });

		expect(resolveParams()?.config).toBeUndefined();
		expect(ledger).toStrictEqual({ config: undefined, rules });
	});

	test('a config that will not parse refuses, rather than listing the default pack as if it were the configured one', async () => {
		const cwd = mkdtempSync(join(tmpdir(), 'lightsout-ledger-'));

		writeFileSync(join(cwd, 'lightsout.config.json'), '{ "gates":');
		mockListStandardsRules.mockReturnValue([]);

		// The config selects which standards pack is read. Answering from the
		// defaults when it cannot be parsed means listing one repo's rules and
		// calling them another's, with nothing in the output saying so.
		await expect(readStandardsLedger({ cwd })).rejects.toThrow(/is not valid JSON/);
	});

	test('a ledger that cannot be built refuses, carrying the loader’s own message', async () => {
		mockResolveStandardsGroups.mockRejectedValue(new Error('pack acme/house: names library "acme", which is not registered'));

		await expect(readStandardsLedger({ cwd: '/repo' })).rejects.toThrow('pack acme/house: names library "acme", which is not registered');
	});

	test('readStandardsLedger: standards-pack false lists no rules', async () => {
		const cwd = setupConsumerRepo({ git: false, config: { 'standards-pack': false } });

		// the real listing runs here: with standards switched off there is no
		// group to list, so an empty ledger proves the built-in library was not read
		mockListStandardsRules.mockImplementation(
			jest.requireActual<typeof import('#src/standardsCheck/listStandardsRules.ts')>('#src/standardsCheck/listStandardsRules.ts').listStandardsRules,
		);

		const ledger = await readStandardsLedger({ cwd });

		expect(ledger.rules).toStrictEqual([]);
	});
});
