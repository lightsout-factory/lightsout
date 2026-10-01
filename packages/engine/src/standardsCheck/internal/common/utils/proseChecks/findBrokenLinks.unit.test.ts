import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { findBrokenLinks } from '#src/standardsCheck/internal/common/utils/proseChecks/findBrokenLinks.ts';

/** A rule folder beside a sibling rule that ships its own rule.md. */
const setupFolders = () => {
	const root = mkdtempSync(join(tmpdir(), 'lightsout-links-'));
	const fromFolder = join(root, '10-dead-export');

	mkdirSync(fromFolder, { recursive: true });
	mkdirSync(join(root, '20-folder-size'), { recursive: true });
	writeFileSync(join(root, '20-folder-size', 'rule.md'), '');

	return { fromFolder };
};

describe('findBrokenLinks', () => {
	test('names a relative link whose file does not exist', () => {
		const { fromFolder } = setupFolders();

		const broken = findBrokenLinks({ text: 'See [functions](../patterns/functions.md#private-helpers).', fromFolder });

		expect(broken).toEqual(['../patterns/functions.md#private-helpers']);
	});

	test('passes a relative link whose file exists, whatever its anchor', () => {
		const { fromFolder } = setupFolders();

		const broken = findBrokenLinks({ text: 'See [folder size](../20-folder-size/rule.md#gone-heading).', fromFolder });

		expect(broken).toEqual([]);
	});

	test('passes web links and links inside the page', () => {
		const { fromFolder } = setupFolders();

		const broken = findBrokenLinks({ text: '[docs](https://example.com/a.md), [mail](mailto:a@b.c) and [above](#heading)', fromFolder });

		expect(broken).toEqual([]);
	});

	test('reads no link inside fenced code', () => {
		const { fromFolder } = setupFolders();

		const broken = findBrokenLinks({ text: '```md\n[old](./missing.md)\n```\n\n~~~\n[old](./gone.md)\n~~~', fromFolder });

		expect(broken).toEqual([]);
	});
});
