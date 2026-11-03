import { describe, expect, test } from '@jest/globals';
import { parseRunsSearch } from '#src/features/runs/utils/parseRunsSearch.ts';

describe('parseRunsSearch', () => {
	test('keeps every query value its vocabularies know', () => {
		const search = parseRunsSearch({ commands: ['refactor'], statuses: ['failed'], text: 'coverage', sortKey: 'cost', sortDirection: 'asc' });

		expect(search).toStrictEqual({ commands: ['refactor'], statuses: ['failed'], text: 'coverage', sortKey: 'cost', sortDirection: 'asc' });
	});

	test('reads a lone query value as the one-value set it means', () => {
		const search = parseRunsSearch({ commands: 'implement · phased' });

		expect(search).toStrictEqual({ commands: ['implement · phased'], statuses: undefined, text: undefined, sortKey: undefined, sortDirection: undefined });
	});

	test('ignores a filter value outside those vocabularies, rather than narrowing to no run at all', () => {
		const search = parseRunsSearch({ commands: ['vibes'], statuses: ['sideways'], text: '' });

		expect(search).toStrictEqual({ commands: undefined, statuses: undefined, text: undefined, sortKey: undefined, sortDirection: undefined });
	});

	test('drops a sort key naming a column the table cannot order by', () => {
		const search = parseRunsSearch({ sortKey: 'packages', sortDirection: 'desc' });

		expect(search).toStrictEqual({ commands: undefined, statuses: undefined, text: undefined, sortKey: undefined, sortDirection: 'desc' });
	});

	test('drops a sort direction that names neither way a column can run', () => {
		const search = parseRunsSearch({ sortKey: 'updatedAt', sortDirection: 'sideways' });

		expect(search).toStrictEqual({ commands: undefined, statuses: undefined, text: undefined, sortKey: 'updatedAt', sortDirection: undefined });
	});
});
