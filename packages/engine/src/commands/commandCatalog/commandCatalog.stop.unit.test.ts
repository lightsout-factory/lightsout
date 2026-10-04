import { describe, expect, test } from '@jest/globals';
import { getUnknownFlagsMessage } from '#src/cli/common/getUnknownFlagsMessage/getUnknownFlagsMessage.ts';
import { commandCatalog } from '#src/commands/commandCatalog/commandCatalog.ts';

const setupCatalog = () => {
	const ids = commandCatalog.map((entry) => entry.id);
	const byId = new Map(commandCatalog.map((entry) => [entry.id, entry]));
	const buildNeighbours = commandCatalog.filter((entry) => entry.group === 'build' && entry.id !== 'stop').map((entry) => entry.id);

	return { ids, byId, buildNeighbours };
};

describe('commandCatalog stop', () => {
	test('gives stop its own Build-group entry with no skill and no infographic', () => {
		const { byId } = setupCatalog();

		const stop = byId.get('stop');

		expect(stop).toEqual(
			expect.objectContaining({
				id: 'stop',
				cli: 'lightsout stop',
				group: 'build',
				invocations: [{ id: 'stop' }],
				steps: [],
				records: 'nothing',
			}),
		);
		expect({ slash: stop?.slash, graphic: stop?.graphic }).toStrictEqual({ slash: undefined, graphic: undefined });
	});

	test('accepts only --run and --cwd on stop', () => {
		const { byId } = setupCatalog();

		const flags = byId.get('stop')?.flags.map((flag) => [flag.name, flag.value, flag.required]);
		const forceMessage = getUnknownFlagsMessage({ command: 'stop', flags: new Map([['force', true as const]]) });

		expect(flags).toStrictEqual([
			['run', '<id>', true],
			['cwd', '<path>', false],
		]);
		expect(forceMessage).toEqual(expect.stringContaining('--force'));
	});

	test('names stop from every other Build entry and every Build entry from stop', () => {
		const { byId, buildNeighbours } = setupCatalog();

		const named = [...(byId.get('stop')?.related ?? [])].sort();
		const silentBack = buildNeighbours.filter((id) => byId.get(id)?.related.includes('stop') !== true);

		expect(named).toStrictEqual(
			['auto-plan', 'brainstorm', 'implement', 'implement-direct', 'plan', 'queue', 'resume', 'self-check', 'ship', 'ticket-state', 'work-order'].sort(),
		);
		expect(named).toStrictEqual([...buildNeighbours].sort());
		expect(silentBack).toStrictEqual([]);
	});

	test('places stop directly after resume on the commands page', () => {
		const { ids } = setupCatalog();

		const afterResume = ids[ids.indexOf('resume') + 1];

		expect(afterResume).toBe('stop');
	});
});
