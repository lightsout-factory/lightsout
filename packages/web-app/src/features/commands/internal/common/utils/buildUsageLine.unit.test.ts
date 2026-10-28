import { describe, expect, test } from '@jest/globals';
import { buildUsageLine } from '#src/features/commands/internal/common/utils/buildUsageLine.ts';
import { buildCommandCatalogEntry } from '#tests/helpers/buildCommandCatalogEntry.ts';

describe('buildUsageLine', () => {
	test('spells the command word, the shape’s own words, then every flag that shape requires, leaving optional flags out', () => {
		const entry = buildCommandCatalogEntry({
			cli: 'lightsout resume',
			overrides: {
				flags: [
					{ name: 'run', value: '<id>', meaning: 'The run.', required: true },
					{ name: 'cwd', value: '<path>', meaning: 'The repo.', required: false },
				],
			},
		});

		const line = buildUsageLine({ entry, invocation: { id: 'resume', positional: 'now' } });

		expect(line).toBe('lightsout resume now --run <id>');
	});

	test('takes a shaped required flag only on its own shape', () => {
		const entry = buildCommandCatalogEntry({
			cli: 'lightsout implement',
			overrides: { flags: [{ name: 'plan', value: '<folder>', meaning: 'A folder.', shape: 'folder', required: true }] },
		});

		const lines = [{ id: 'single' }, { id: 'folder' }].map((invocation) => buildUsageLine({ entry, invocation }));

		expect(lines).toStrictEqual(['lightsout implement', 'lightsout implement --plan <folder>']);
	});

	test('starts from the slash form, then the bare id, for a command with no CLI form', () => {
		const lines = [
			buildCommandCatalogEntry({ id: 'voice', slash: '/lightsout:voice', overrides: { cli: undefined, flags: [] } }),
			buildCommandCatalogEntry({ id: 'voice', overrides: { cli: undefined, slash: undefined, flags: [] } }),
		].map((entry) => buildUsageLine({ entry, invocation: { id: 'toggle', positional: 'on|off' } }));

		expect(lines).toStrictEqual(['/lightsout:voice on|off', 'voice on|off']);
	});
});
