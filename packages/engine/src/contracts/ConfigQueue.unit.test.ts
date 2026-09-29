import { describe, expect, test } from '@jest/globals';
import { ConfigQueue } from '#src/contracts/ConfigQueue.ts';

const minimal = { 'max-parallel': 3 };

describe('ConfigQueue', () => {
	test('accepts the block a repo actually writes, keeping the file’s own kebab-case spelling', () => {
		const parsed = ConfigQueue.parse({
			...minimal,
			'planning-status-labels': { 'planning-not-needed': 'shaped-none' },
			'eligible-statuses': ['Backlog'],
			'ready-status': 'Waiting',
			'in-progress-status': 'Building',
			'done-status': 'Shipped',
			'branch-template': 'feature/{ticket}-{slug}',
			'decisions-heading': '## Settled',
			'worker-timeout': '90m',
			'question-timeout': '30m',
			'parked-label': 'queue-parked',
		});

		expect(parsed['branch-template']).toBe('feature/{ticket}-{slug}');
		expect(parsed['eligible-statuses']).toStrictEqual(['Backlog']);
		expect(parsed['worker-timeout']).toBe('90m');
		expect(parsed['question-timeout']).toBe('30m');
		expect(parsed['parked-label']).toBe('queue-parked');
		expect(parsed['planning-status-labels']).toStrictEqual({ 'planning-not-needed': 'shaped-none' });
		expect(parsed['ready-status']).toBe('Waiting');
		expect(parsed['in-progress-status']).toBe('Building');
		expect(parsed['done-status']).toBe('Shipped');
		expect(parsed['decisions-heading']).toBe('## Settled');
	});

	test.each([
		{ key: 'worker-timeout', value: 240 },
		{ key: 'question-timeout', value: 60 },
		{ key: 'parked-label', value: true },
	])('refuses a non-string $key, because the value has to carry its own unit or name', ({ key, value }) => {
		expect(ConfigQueue.safeParse({ ...minimal, [key]: value }).success).toBe(false);
	});

	test('accepts max-parallel alone, because every other key has an engine default behind it', () => {
		const parsed = ConfigQueue.parse(minimal);

		expect(parsed).toStrictEqual(minimal);
	});

	test('accepts a planning-status-labels block naming only the one label this repo spells differently', () => {
		const parsed = ConfigQueue.parse({ ...minimal, 'planning-status-labels': { 'planning-complete': 'shaped' } });

		expect(parsed['planning-status-labels']).toStrictEqual({ 'planning-complete': 'shaped' });
	});

	test('accepts a planning-status-labels block naming all five, so a repo may respell its whole vocabulary at once', () => {
		const parsed = ConfigQueue.parse({
			...minimal,
			'planning-status-labels': {
				'planning-needs-brainstorm': 'shaping-brainstorm',
				'planning-needs-plan': 'shaping-plan',
				'planning-ready-auto-plan': 'shaping-auto',
				'planning-complete': 'shaped',
				'planning-not-needed': 'unshaped',
			},
		});

		expect(parsed['planning-status-labels']).toStrictEqual({
			'planning-needs-brainstorm': 'shaping-brainstorm',
			'planning-needs-plan': 'shaping-plan',
			'planning-ready-auto-plan': 'shaping-auto',
			'planning-complete': 'shaped',
			'planning-not-needed': 'unshaped',
		});
	});

	test('refuses a non-string planning status label, because the value is handed to the tracker as a label name verbatim', () => {
		expect(ConfigQueue.safeParse({ ...minimal, 'planning-status-labels': { 'planning-complete': 42 } }).success).toBe(false);
	});

	test.each([
		{ key: 'ready-status', value: 12 },
		{ key: 'in-progress-status', value: false },
		{ key: 'done-status', value: ['Done'] },
	])('refuses a non-string $key, because the engine hands the value to the tracker as a status name', ({ key, value }) => {
		expect(ConfigQueue.safeParse({ ...minimal, [key]: value }).success).toBe(false);
	});

	test('refuses eligible-statuses that is not a list of status names', () => {
		expect(ConfigQueue.safeParse({ ...minimal, 'eligible-statuses': 'Backlog' }).success).toBe(false);
		expect(ConfigQueue.safeParse({ ...minimal, 'eligible-statuses': ['Backlog', 7] }).success).toBe(false);
	});

	test('refuses a block naming no max-parallel, the block’s one key with no engine default behind it', () => {
		expect(ConfigQueue.safeParse({ 'ready-status': 'Waiting' }).success).toBe(false);
	});

	test('refuses a parallelism that is not a whole number of tickets', () => {
		expect(ConfigQueue.safeParse({ ...minimal, 'max-parallel': 0 }).success).toBe(false);
		expect(ConfigQueue.safeParse({ ...minimal, 'max-parallel': 1.5 }).success).toBe(false);
	});

	test('refuses a planning-status-labels block naming a planning status the engine has no meaning for', () => {
		expect(ConfigQueue.safeParse({ ...minimal, 'planning-status-labels': { 'planning-needs-review': 'shaped-review' } }).success).toBe(false);
	});

	test('refuses a key it does not know — a typo here would silently disable a setting the file believes is on', () => {
		expect(ConfigQueue.safeParse({ ...minimal, 'max-parralel': 2 }).success).toBe(false);
	});
});
