import { describe, expect, test } from '@jest/globals';
import { findComponentFolders } from './findComponentFolders.ts';

describe('findComponentFolders', () => {
	test('names each folder that holds a file of its own name, and no group', () => {
		const folders = findComponentFolders({
			files: ['src/components/ui/IssueCard/IssueCard.tsx', 'src/components/ui/IssueCard/IssueCardHeader.tsx', 'src/components/ui/Button.tsx'],
		});

		expect([...folders]).toStrictEqual(['src/components/ui/IssueCard']);
	});
});
