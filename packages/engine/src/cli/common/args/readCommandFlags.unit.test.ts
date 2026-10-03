import { expect, test } from '@jest/globals';
import { readCommandFlags } from '#src/cli/common/args/readCommandFlags.ts';

test('readCommandFlags: reads a command flags from the usage text, unioned across the lines that describe it', () => {
	const flags = readCommandFlags({ command: 'refactor' });

	expect([...flags].sort()).toStrictEqual(['all', 'allow-dirty', 'cwd', 'deterministic-checks', 'max-batches', 'path', 'run']);
});

test('readCommandFlags: allows --cwd everywhere, since the dispatcher reads it before it knows the command', () => {
	expect(readCommandFlags({ command: 'ship' })).toStrictEqual(new Set(['cwd', 'hand-built']));
	expect(readCommandFlags({ command: 'friction' })).toStrictEqual(new Set(['cwd']));
});

test('readCommandFlags: status accepts the detail view flags alongside --cwd, unioned across both of its shapes', () => {
	expect([...readCommandFlags({ command: 'status' })].sort()).toStrictEqual(['cwd', 'now', 'planning', 'queue', 'run', 'shipping', 'wait', 'watch']);
});

test('readCommandFlags: keeps one command flags out of another', () => {
	expect(readCommandFlags({ command: 'doctor' }).has('plan')).toBe(false);
	expect(readCommandFlags({ command: 'implement' }).has('plan')).toBe(true);
});

test('readCommandFlags: gathers every subcommand flags under the command that dispatches them', () => {
	const flags = readCommandFlags({ command: 'plan' });

	expect([...flags].sort()).toStrictEqual(['cwd', 'name', 'no-worktree', 'notes', 'phase', 'scope', 'worktree']);
});

test('readCommandFlags: a name the usage text never mentions accepts nothing beyond --cwd', () => {
	expect(readCommandFlags({ command: 'nonesuch' })).toStrictEqual(new Set(['cwd']));
});

test('readCommandFlags: standards-validate takes --library and no longer takes --pack', () => {
	const flags = readCommandFlags({ command: 'standards-validate' });

	expect([...flags].sort()).toStrictEqual(['cwd', 'library']);
});

test('does not accept the removed from flag on the work-order command', () => {
	const flags = readCommandFlags({ command: 'work-order' });

	expect({
		name: flags.has('name'),
		slug: flags.has('slug'),
		title: flags.has('title'),
		cwd: flags.has('cwd'),
		from: flags.has('from'),
	}).toStrictEqual({ name: true, slug: true, title: true, cwd: true, from: false });
});
