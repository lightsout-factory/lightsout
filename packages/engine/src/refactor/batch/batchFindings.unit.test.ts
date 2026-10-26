import { expect, test } from '@jest/globals';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { batchFindings } from '#src/refactor/batch/batchFindings.ts';

/** A pack's rule order, as the standards check hands it over: batching follows it and knows nothing of what the rules are. */
const packOrder = [
	'lightsout/banned-folder-name',
	'lightsout/common-folder-layout',
	'lightsout/index-files',
	'lightsout/test-beside-subject',
	'lightsout/test-support-in-src',
	'lightsout/multi-export',
	'lightsout/filename-mismatch',
	'lightsout/test-mock-prefix',
	'lightsout/test-mock-untyped',
	'lightsout/no-test-state-in-hooks',
	'lightsout/test-manual-mock-cleanup',
	'lightsout/index-file-contents',
	'lightsout/dead-export',
	'lightsout/file-size',
	'lightsout/function-size',
	'lightsout/folder-size',
	'lightsout/duplicate-function-body',
	'lightsout/duplicate-code-block',
	'lightsout/duplicate-export-name',
];

const finding = ({ rule, path, siteKey }: { rule: StandardsFinding['rule']; path: string; siteKey: string }): StandardsFinding => ({
	rule,
	severity: 'blocking',
	siteKey,
	files: [{ path }],
	detail: 'stub',
});

test('batchFindings: groups by rule × area, in the pack rule order', () => {
	const batches = batchFindings({
		blocking: [
			finding({ rule: 'lightsout/duplicate-code-block', path: 'packages/api/src/a.ts', siteKey: 'duplicate-code-block:1' }),
			finding({ rule: 'lightsout/index-files', path: 'packages/api/src/b.ts', siteKey: 'boundary:b' }),
			finding({ rule: 'lightsout/index-files', path: 'packages/web/src/c.ts', siteKey: 'boundary:c' }),
			finding({ rule: 'lightsout/multi-export', path: 'src/d.ts', siteKey: 'multi-export:d' }),
			finding({ rule: 'lightsout/multi-export', path: 'loose.ts', siteKey: 'multi-export:loose' }),
		],
		advisories: [],
		packagesDir: 'packages',
		ruleOrder: packOrder,
	});

	// boundary before multi-export before duplicate-code-block; package dirs, top segments, and
	// (root) as areas
	expect(batches.map((batch) => `${batch.rule} ${batch.folder}`)).toStrictEqual([
		'lightsout/index-files packages/api',
		'lightsout/index-files packages/web',
		'lightsout/multi-export (root)',
		'lightsout/multi-export src',
		'lightsout/duplicate-code-block packages/api',
	]);
	// the ids an agent is handed: a running number in that same order
	expect(batches.map((batch) => batch.id)).toStrictEqual([
		'batch-01:lightsout/index-files:packages/api',
		'batch-02:lightsout/index-files:packages/web',
		'batch-03:lightsout/multi-export:(root)',
		'batch-04:lightsout/multi-export:src',
		'batch-05:lightsout/duplicate-code-block:packages/api',
	]);
});

test('batchFindings: every rule batches in the order its pack lists it', () => {
	const batches = batchFindings({
		// Fed alphabetically, which is NOT the pack order — so the result pins the
		// order handed in rather than the input order.
		blocking: [...packOrder].sort().map((rule) => finding({ rule, path: 'src/a.ts', siteKey: `${rule}:src/a.ts` })),
		advisories: [],
		packagesDir: 'packages',
		ruleOrder: packOrder,
	});

	// exactly the pack's order, whatever order the findings arrived in
	expect(batches.map((batch) => batch.rule)).toStrictEqual(packOrder);
	// one batch per rule, numbered in that order — the ids an agent is handed
	expect(batches.map((batch) => batch.id).slice(0, 2)).toStrictEqual([
		'batch-01:lightsout/banned-folder-name:src',
		'batch-02:lightsout/common-folder-layout:src',
	]);
});

test('batchFindings: a rule outside the pack order sorts after every listed one', () => {
	const batches = batchFindings({
		blocking: [
			// A rule id the pack order does not list — a finding left from a rule
			// the repo's selection no longer includes.
			finding({ rule: 'invented-rule', path: 'src/stale.ts', siteKey: 'invented:stale' }),
			finding({ rule: 'lightsout/duplicate-code-block', path: 'src/a.ts', siteKey: 'duplicate-code-block:a' }),
			finding({ rule: 'lightsout/index-files', path: 'src/b.ts', siteKey: 'boundary:b' }),
		],
		advisories: [],
		packagesDir: 'packages',
		ruleOrder: packOrder,
	});

	// an unlisted rule degrades to "after the listed ones" — never to an error,
	// and never ahead of the pack's own work
	expect(batches.map((batch) => batch.rule)).toStrictEqual(['lightsout/index-files', 'lightsout/duplicate-code-block', 'invented-rule']);
});

test('batchFindings: rules outside the pack order tie-break alphabetically, and their ids reach the batch id', () => {
	const batches = batchFindings({
		// Several unlisted rules share the last place at once, so only the id
		// breaks the tie.
		blocking: [
			finding({ rule: 'zeta-package-rule', path: 'src/z.ts', siteKey: 'zeta:z' }),
			finding({ rule: 'alpha-package-rule', path: 'src/a.ts', siteKey: 'alpha:a' }),
			finding({ rule: 'lightsout/duplicate-code-block', path: 'src/c.ts', siteKey: 'duplicate-code-block:c' }),
		],
		advisories: [],
		packagesDir: 'packages',
		ruleOrder: packOrder,
	});

	// every listed rule first, then the unlisted ones in id order
	expect(batches.map((batch) => batch.id)).toStrictEqual([
		'batch-01:lightsout/duplicate-code-block:src',
		'batch-02:alpha-package-rule:src',
		'batch-03:zeta-package-rule:src',
	]);
});

test('batchFindings: an oversized group splits into sorted chunks of 12', () => {
	const findings = Array.from({ length: 13 }, (_, index) =>
		finding({ rule: 'duplicate-code-block', path: `src/file${index}.ts`, siteKey: `duplicate-code-block:${String(index).padStart(2, '0')}` }),
	);
	const batches = batchFindings({ blocking: findings, advisories: [], packagesDir: 'packages', ruleOrder: packOrder });

	expect(batches.length).toBe(2);
	expect(batches[0]?.blocking.length).toBe(12);
	expect(batches[1]?.blocking.length).toBe(1);
	// chunks split in site-key order
	expect(batches[1]?.blocking[0]?.siteKey).toBe('duplicate-code-block:12');
});

test('batchFindings: each chunk of an oversized group takes its own batch number', () => {
	const findings = Array.from({ length: 25 }, (_, index) =>
		finding({ rule: 'duplicate-code-block', path: `src/file${index}.ts`, siteKey: `duplicate-code-block:${String(index).padStart(2, '0')}` }),
	);

	const batches = batchFindings({ blocking: findings, advisories: [], packagesDir: 'packages', ruleOrder: packOrder });

	// one group, three chunks — the numbering runs across chunks, not per group,
	// so no two jobs an agent is handed share an id
	expect(batches.map((batch) => batch.id)).toStrictEqual([
		'batch-01:duplicate-code-block:src',
		'batch-02:duplicate-code-block:src',
		'batch-03:duplicate-code-block:src',
	]);
});

test('batchFindings: an advisory attaches only to the chunk holding its file', () => {
	const findings = Array.from({ length: 13 }, (_, index) =>
		finding({ rule: 'duplicate-code-block', path: `src/file${index}.ts`, siteKey: `duplicate-code-block:${String(index).padStart(2, '0')}` }),
	);
	const advisory: StandardsFinding = { ...finding({ rule: 'file-size', path: 'src/file12.ts', siteKey: 'file-size:src/file12.ts' }), severity: 'advisory' };

	const batches = batchFindings({ blocking: findings, advisories: [advisory], packagesDir: 'packages', ruleOrder: packOrder });

	// the overlap is per chunk, not per group: file12 lands in the second chunk,
	// so the first chunk carries none of its advisories
	expect(batches.map((batch) => batch.advisories.map((entry) => entry.siteKey))).toStrictEqual([[], ['file-size:src/file12.ts']]);
});

test('batchFindings: paths that name no package folder fall back to their top segment, or (root)', () => {
	const batches = batchFindings({
		blocking: [
			// A file sitting directly in the packages dir names no package, so the
			// dir itself is the area.
			finding({ rule: 'duplicate-code-block', path: 'packages/loose.ts', siteKey: 'duplicate-code-block:loose' }),
			// An absolute path has an empty first segment — no area to name.
			finding({ rule: 'duplicate-code-block', path: '/abs/file.ts', siteKey: 'duplicate-code-block:abs' }),
		],
		advisories: [],
		packagesDir: 'packages',
		ruleOrder: packOrder,
	});

	expect(batches.map((batch) => batch.id)).toStrictEqual(['batch-01:duplicate-code-block:(root)', 'batch-02:duplicate-code-block:packages']);
});

test('batchFindings: advisories attach to batches whose files overlap, never form batches', () => {
	const advisory: StandardsFinding = { ...finding({ rule: 'function-size', path: 'src/a.ts', siteKey: 'function-size:src/a.ts' }), severity: 'advisory' };
	const batches = batchFindings({
		blocking: [
			finding({ rule: 'duplicate-code-block', path: 'src/a.ts', siteKey: 'duplicate-code-block:a' }),
			finding({ rule: 'duplicate-code-block', path: 'lib/b.ts', siteKey: 'duplicate-code-block:b' }),
		],
		advisories: [advisory],
		packagesDir: 'packages',
		ruleOrder: packOrder,
	});

	expect(batches.length).toBe(2);
	expect(batches.find((batch) => batch.folder === 'src')?.advisories.length).toBe(1);
	expect(batches.find((batch) => batch.folder === 'lib')?.advisories.length).toBe(0);
});

test('batchFindings: a finding spanning folders gets a dedicated cross batch with every side in scope', () => {
	const batches = batchFindings({
		blocking: [
			finding({ rule: 'duplicate-code-block', path: 'packages/api/src/a.ts', siteKey: 'duplicate-code-block:a' }),
			{
				...finding({ rule: 'duplicate-code-block', path: 'packages/api/src/b.ts', siteKey: 'duplicate-code-block:x' }),
				files: [{ path: 'packages/api/src/b.ts' }, { path: 'packages/web/src/c.ts' }],
			},
		],
		advisories: [],
		packagesDir: 'packages',
		ruleOrder: packOrder,
	});

	const cross = batches.find((batch) => batch.folder === '(cross)');

	// multi-folder finding forms its own (cross) batch
	expect(cross).toBeTruthy();
	expect(cross?.blocking.map((entry) => entry.siteKey)).toStrictEqual(['duplicate-code-block:x']);
	// cross batches run after single-folder batches of the same rule
	expect(batches.at(-1)?.folder).toBe('(cross)');
});

test('batchFindings: a finding naming no file still batches, under (root)', () => {
	const batches = batchFindings({
		blocking: [{ ...finding({ rule: 'folder-size', path: 'src/a.ts', siteKey: 'folder-size:src' }), files: [] }],
		advisories: [],
		packagesDir: 'packages',
		ruleOrder: packOrder,
	});

	// a file-less finding has no area to group by — it degrades to (root) rather
	// than an undefined folder in the batch id an agent is handed
	expect(batches.map((batch) => batch.id)).toStrictEqual(['batch-01:folder-size:(root)']);
});

test('a rule from any library takes the place its pack gives it, matched by full name', () => {
	const batches = batchFindings({
		// A pack that lists another library's rule between its own: the engine
		// treats every library alike, and only an exact full name matches.
		blocking: [
			finding({ rule: 'house/last', path: 'src/a.ts', siteKey: 'house/last:src/a.ts' }),
			finding({ rule: 'first', path: 'src/b.ts', siteKey: 'first:src/b.ts' }),
			finding({ rule: 'acme/middle', path: 'src/c.ts', siteKey: 'acme/middle:src/c.ts' }),
			finding({ rule: 'house/first', path: 'src/d.ts', siteKey: 'house/first:src/d.ts' }),
		],
		advisories: [],
		packagesDir: 'packages',
		ruleOrder: ['house/first', 'acme/middle', 'house/last'],
	});

	// the pack's order by full name, then the bare short id the order never lists
	expect(batches.map((batch) => batch.rule)).toStrictEqual(['house/first', 'acme/middle', 'house/last', 'first']);
});
