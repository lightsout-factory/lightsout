import { expect, test } from '@jest/globals';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

const base = { gates: { check: 'c', test: 't', 'test-coverage': false } };

// The opt-in blocks of the composed config: each one survives parsing as the
// file wrote it, stays strict through the composition, and leaves no key on
// the parsed config when absent.

test('LightsoutConfig: the ship block is optional, keeps its own kebab-case spelling, and stays strict through the composition', () => {
	const parsed = LightsoutConfig.parse({
		...base,
		ship: { 'ticket-pattern': '^(?<ticket>lo-(?<number>\\d+))', 'pr-body': 'Closes LO-{number}', 'merge-method': 'squash', 'after-implement': true },
	});

	// the block survives parsing as the file wrote it — nothing renames a key on
	// the way through
	expect(parsed.ship).toStrictEqual({
		'ticket-pattern': '^(?<ticket>lo-(?<number>\\d+))',
		'pr-body': 'Closes LO-{number}',
		'merge-method': 'squash',
		'after-implement': true,
	});

	// the block's own strictness fires through the composition: a typoed key here
	// would silently disable a setting the file believes is on
	expect(LightsoutConfig.safeParse({ ...base, ship: { 'ticket-patern': '^(?<ticket>lo-\\d+)' } }).success).toBe(false);
	// and a merge method no forge offers is refused before it reaches a command line
	expect(LightsoutConfig.safeParse({ ...base, ship: { 'merge-method': 'fast-forward' } }).success).toBe(false);

	// ship is opt-in: an absent block leaves no key on the parsed config, and the
	// engine's own defaults stand in
	expect('ship' in LightsoutConfig.parse(base)).toBe(false);
});

test('LightsoutConfig: the auto-plan block is optional, keeps its own kebab-case spelling, and stays strict through the composition', () => {
	const parsed = LightsoutConfig.parse({
		...base,
		'auto-plan': { 'propose-before-draft': true, 'implement-on-approval': true, 'auto-approve-plan': false },
	});

	// the block survives parsing as the file wrote it — nothing renames a key on
	// the way through
	expect(parsed['auto-plan']).toStrictEqual({ 'propose-before-draft': true, 'implement-on-approval': true, 'auto-approve-plan': false });

	// the block's own strictness fires through the composition: a typoed key here
	// would silently disable a checkpoint the file believes is removed
	expect(LightsoutConfig.safeParse({ ...base, 'auto-plan': { 'auto-aprove': true } }).success).toBe(false);

	// auto-plan is opt-in: an absent block leaves no key on the parsed config, and
	// the skill's own documented defaults stand in
	expect('auto-plan' in LightsoutConfig.parse(base)).toBe(false);
});

test('LightsoutConfig: the queue block is optional, keeps its own kebab-case spelling, and stays strict through the composition', () => {
	const queue = {
		'planning-status-labels': { 'planning-complete': 'shaped' },
		'max-parallel': 3,
	};

	const parsed = LightsoutConfig.parse({ ...base, queue });

	// the block survives parsing as the file wrote it — every queue convention
	// reaches the drain exactly as the repo spelled it, because the engine spells
	// none of them in source
	expect(parsed.queue).toStrictEqual(queue);

	// the block's own strictness fires through the composition: a typoed key here
	// would silently disable a setting the file believes is on
	expect(LightsoutConfig.safeParse({ ...base, queue: { ...queue, 'max-parralel': 2 } }).success).toBe(false);

	// queue is opt-in: an absent block leaves no key on the parsed config, and a
	// repo that never runs the queue needs none of it
	expect('queue' in LightsoutConfig.parse(base)).toBe(false);
});

test('LightsoutConfig: the ticket-tracker block is optional, keeps its own kebab-case spelling, and stays strict through the composition', () => {
	const tracker = { provider: 'linear', team: 'LO', 'api-key-env': 'LINEAR_API_KEY' };

	const parsed = LightsoutConfig.parse({ ...base, 'ticket-tracker': tracker });

	// the block survives parsing as the file wrote it — tracker identity is one
	// fact, spelled once, and nothing renames a key on the way through
	expect(parsed['ticket-tracker']).toStrictEqual(tracker);

	// the block's own strictness fires through the composition: a typoed key here
	// would silently disable a setting the file believes is on
	expect(LightsoutConfig.safeParse({ ...base, 'ticket-tracker': { ...tracker, 'api-key-nev': 'X' } }).success).toBe(false);
	// and the provider discriminator reaches the Jira branch rather than letting
	// the two providers' connection fields mix
	expect(
		LightsoutConfig.safeParse({
			...base,
			'ticket-tracker': {
				provider: 'jira',
				'site-url': 'https://example.atlassian.net',
				project: 'LO',
				'api-key-env': 'JIRA_API_TOKEN',
				'api-user-email-env': 'JIRA_ACCOUNT_EMAIL',
			},
		}).success,
	).toBe(true);
	expect(LightsoutConfig.safeParse({ ...base, 'ticket-tracker': { ...tracker, provider: 'github' } }).success).toBe(false);

	// ticket-tracker is opt-in: an absent block leaves no key on the parsed
	// config, and the engine runs with no tracker at all
	expect('ticket-tracker' in LightsoutConfig.parse(base)).toBe(false);
});

test('LightsoutConfig: the docs block is optional, survives the composition entry for entry, and stays strict', () => {
	const docs = [
		{ path: 'README.md', covers: 'The product tour and the index of every other document.' },
		{ path: 'docs/configuration.md', covers: 'Every lightsout.config.json key.' },
	];

	const parsed = LightsoutConfig.parse({ ...base, docs });

	// the block survives parsing as the file wrote it — every declared surface
	// reaches the plan's writer brief and the grade's checker in the order the
	// config listed them, because the engine names none of them in source
	expect(parsed.docs).toStrictEqual(docs);

	// the block's own strictness fires through the composition: a misspelled key
	// here would silently declare a surface with no description
	expect(LightsoutConfig.safeParse({ ...base, docs: [{ path: 'README.md', cover: 'the tour' }] }).success).toBe(false);
	// and its refusal of an empty array fires too — "declared, but nothing" opts
	// into a check that can never fire
	expect(LightsoutConfig.safeParse({ ...base, docs: [] }).success).toBe(false);

	// docs is opt-in: an absent block leaves no key on the parsed config, which is
	// what a repo declaring nothing relies on for no section, no prompt text and
	// no checker spawn
	expect('docs' in LightsoutConfig.parse(base)).toBe(false);
	expect(LightsoutConfig.parse(base).docs).toBe(undefined);
});

test('LightsoutConfig: the plan block is optional, keeps its own kebab-case spelling, and stays strict through the composition', () => {
	const parsed = LightsoutConfig.parse({
		...base,
		plan: { contract: true, 'weight-thresholds': { 'created-files': 5, packages: 2 } },
	});

	// the block survives parsing as the file wrote it — nothing renames a key on
	// the way through, so the grade reads the thresholds the repo spelled
	expect(parsed.plan).toStrictEqual({ contract: true, 'weight-thresholds': { 'created-files': 5, packages: 2 } });

	// the block's own strictness fires through the composition, at both levels: a
	// typoed key here would silently leave the contract shape off while the file
	// believes it is on
	expect(LightsoutConfig.safeParse({ ...base, plan: { contracts: true } }).success).toBe(false);
	expect(LightsoutConfig.safeParse({ ...base, plan: { 'weight-thresholds': { 'created-file': 3 } } }).success).toBe(false);
	// and its numeric refusals fire too — a threshold below one would make every
	// plan file heavy
	expect(LightsoutConfig.safeParse({ ...base, plan: { 'weight-thresholds': { packages: 0 } } }).success).toBe(false);

	// plan is opt-in: an absent block leaves no key on the parsed config, which is
	// what a repo relies on for today's template, today's required sections and
	// the reader fleet on every plan file
	expect('plan' in LightsoutConfig.parse(base)).toBe(false);
	expect(LightsoutConfig.parse(base).plan).toBe(undefined);
});

test('LightsoutConfig: the implement block is optional, keeps its own kebab-case spelling, and stays strict through the composition', () => {
	const parsed = LightsoutConfig.parse({ ...base, implement: { refactor: { 'max-rounds': 5 } } });

	// the block survives parsing as the file wrote it — nothing renames a key on
	// the way through, so the cleanup loop reads the budget the repo spelled and a
	// manifest's config snapshot still round-trips
	expect(parsed.implement).toStrictEqual({ refactor: { 'max-rounds': 5 } });
	// a block declared with nothing in it parses too — the budget has a documented
	// default behind it
	expect(LightsoutConfig.parse({ ...base, implement: { refactor: {} } }).implement).toStrictEqual({ refactor: {} });

	// the block's own strictness fires through the composition, at both levels: a
	// stripped typo would leave the default budget in force while the file
	// believes it raised it
	expect(LightsoutConfig.safeParse({ ...base, implement: { refactors: { 'max-rounds': 5 } } }).success).toBe(false);
	expect(LightsoutConfig.safeParse({ ...base, implement: { refactor: { 'max-round': 3 } } }).success).toBe(false);
	// and its numeric refusal fires too — a round is a whole executor invocation,
	// and zero is not how cleanup is turned off
	expect(LightsoutConfig.safeParse({ ...base, implement: { refactor: { 'max-rounds': 0 } } }).success).toBe(false);

	// the key inside commands is a different block: a harness choice for the
	// implement command never reads as the command's own settings
	expect(LightsoutConfig.parse({ ...base, commands: { implement: { harness: 'codex' } } }).implement).toBe(undefined);

	// implement is opt-in: an absent block leaves no key on the parsed config,
	// which is what tells cleanup "unset" rather than "declared empty"
	expect('implement' in LightsoutConfig.parse(base)).toBe(false);
	expect(LightsoutConfig.parse(base).implement).toBe(undefined);
});

test('accepts the top-level worktree block and keeps its setup command on the parsed config', () => {
	const parsed = LightsoutConfig.parse({ ...base, worktree: { setup: 'pnpm install' } });

	// the block is registered on the composed schema rather than stripped as an
	// unknown key, so the one command that prepares a fresh worktree reaches both
	// the queue and an isolated implementation run exactly as the file spelled it
	expect(parsed.worktree).toStrictEqual({ setup: 'pnpm install' });

	// worktree is opt-in: an absent block leaves no key on the parsed config, and
	// a repo needing no preparation command declares none
	expect('worktree' in LightsoutConfig.parse(base)).toBe(false);
	expect(LightsoutConfig.parse(base).worktree).toBe(undefined);
});

test('LightsoutConfig: the pricing block is optional, keeps its own kebab-case spelling, and stays strict through the composition', () => {
	const rates = { input: 15, output: 75, 'cache-read': 1.5, 'cache-write': 18.75 };
	const haiku = { input: 1, output: 5, 'cache-read': 0.1, 'cache-write': 1.25 };

	const parsed = LightsoutConfig.parse({ ...base, pricing: { 'claude-opus-5': rates, 'claude-haiku-4-5': haiku } });

	// the block survives parsing as the file wrote it — the model keys are the
	// identifiers a harness was invoked with, and the four rate names keep the
	// spelling the report matches each recorded token count against
	expect(parsed.pricing).toStrictEqual({
		'claude-opus-5': { input: 15, output: 75, 'cache-read': 1.5, 'cache-write': 18.75 },
		'claude-haiku-4-5': { input: 1, output: 5, 'cache-read': 0.1, 'cache-write': 1.25 },
	});

	// the block's own strictness fires through the composition: a stripped typo
	// would leave that token count unpriced while the estimate still printed a
	// total the reader would take as complete
	expect(LightsoutConfig.safeParse({ ...base, pricing: { 'claude-opus-5': { ...rates, cache_read: 1.5 } } }).success).toBe(false);
	// and its numeric refusal fires too — there is no negative price
	expect(LightsoutConfig.safeParse({ ...base, pricing: { 'claude-opus-5': { ...rates, output: -75 } } }).success).toBe(false);

	// pricing is opt-in: an absent block leaves no key on the parsed config, which
	// is what tells the report to print every other figure and drop the one
	// estimated-cost column rather than guess a rate nobody stated
	expect('pricing' in LightsoutConfig.parse(base)).toBe(false);
	expect(LightsoutConfig.parse(base).pricing).toBe(undefined);
});
