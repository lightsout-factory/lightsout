import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test } from '@jest/globals';
import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { runStandardsCheck } from '#src/standardsCheck/runStandardsCheck.ts';

const bigBody = `
	let total = 0;
	for (const record of records) {
		if (record.active && record.amount > 0) {
			total += record.amount * record.multiplier + record.bonus;
		} else if (record.pending) {
			total += record.amount / 2 - record.fee;
		} else {
			total -= record.penalty ?? 0;
		}
	}
	return total * 100;
`;

/** A consumer repo with one planted defect per rule. */
const setupCheckRepo = () => {
	const dir = mkdtempSync(join(tmpdir(), 'lightsout-standards-test-'));

	mkdirSync(join(dir, 'src/a/utils'), { recursive: true });
	mkdirSync(join(dir, 'src/b'), { recursive: true });
	mkdirSync(join(dir, 'node_modules'), { recursive: true });
	// The AST tier borrows the consumer's TypeScript — hand the fixture ours.
	symlinkSync(join(process.cwd(), 'node_modules/typescript'), join(dir, 'node_modules/typescript'), 'dir');

	// tier 2 (+ tier 1): systematically renamed twins
	writeFileSync(join(dir, 'src/a/sumTotals.ts'), `export const sumTotals = ({ records }: { records: any[] }) => {${bigBody}};\n`);
	writeFileSync(
		join(dir, 'src/b/tallyItems.ts'),
		`export const tallyItems = ({ items }: { items: any[] }) => {\n${bigBody
			.replace(/records/g, 'items')
			.replace(/record\b/g, 'item')
			.replace(/record\./g, 'item.')}};\n`,
	);

	// tier 0: synonym pair + same-name pair
	writeFileSync(join(dir, 'src/a/getUserData.ts'), 'export const getUserData = () => 1;\n');
	writeFileSync(join(dir, 'src/b/fetchUserData.ts'), 'export const fetchUserData = () => 2;\n');
	writeFileSync(join(dir, 'src/a/normalizeRecord.ts'), 'export const normalizeRecord = () => 1;\n');
	writeFileSync(join(dir, 'src/b/normalizeRecord.ts'), 'export const normalizeRecord = () => 2;\n');

	// structure: multi-export violation, misnamed file, domain-folder candidates
	writeFileSync(join(dir, 'src/a/config.ts'), 'export const readConfig = () => 1;\nexport const saveConfig = () => 2;\n');
	writeFileSync(join(dir, 'src/a/helpers.ts'), 'export const buildLabel = () => 1;\n');
	writeFileSync(join(dir, 'src/a/utils/formatDate.ts'), 'export const formatDate = () => 1;\n');
	writeFileSync(join(dir, 'src/a/utils/formatCurrency.ts'), 'export const formatCurrency = () => 1;\n');

	// size: oversized .ts file; a 280-line .tsx rides the larger JSX cap (~300)
	writeFileSync(join(dir, 'src/b/huge.ts'), `export const huge = () => 1;\n${'// filler\n'.repeat(300)}`);
	writeFileSync(join(dir, 'src/b/BigView.tsx'), `export const BigView = () => 1;\n${'// filler\n'.repeat(278)}`);

	// dead export vs consumed export
	writeFileSync(join(dir, 'src/a/unusedThing.ts'), 'export const unusedThing = () => 1;\n');
	writeFileSync(join(dir, 'src/a/consumer.ts'), "import { buildLabel } from './helpers';\nexport const consumer = () => buildLabel();\n");

	// test file with a copy of the big body — must NOT produce duplicate-block findings
	writeFileSync(join(dir, 'src/a/sumTotals.unit.test.ts'), `const expected = ({ records }: { records: any[] }) => {${bigBody}};\nconsole.log(expected);\n`);

	return dir;
};

test('the standards check finds each planted defect and respects the exceptions', async () => {
	const dir = setupCheckRepo();
	const { findings, notes } = await runStandardsCheck({ cwd: dir, config: await readOptionalConfig({ cwd: dir }) });
	const byRule = (rule: string) => findings.filter((finding) => finding.rule === rule);

	// typescript resolved for the AST tier: ${notes.join('; ')}
	expect(notes.some((note) => note.includes('typescript'))).toBeFalsy();
	// without a baseline the accept-debt hint is offered
	expect(notes.some((note) => note.includes('--baseline'))).toBeTruthy();

	const astDups = byRule('lightsout/duplicate-function-body');

	expect(astDups.length).toBe(1);
	// renamed twins caught by normalization
	expect(astDups[0]?.files.map((file) => file.path).sort()).toStrictEqual(['src/a/sumTotals.ts', 'src/b/tallyItems.ts']);

	// the duplicated block is reported
	expect(byRule('lightsout/duplicate-code-block').length >= 1).toBeTruthy();
	// test files never appear in findings
	expect(findings.every((finding) => finding.files.every((file) => !file.path.includes('.test.')))).toBeTruthy();

	const names = [...byRule('lightsout/duplicate-export-name'), ...byRule('lightsout/synonym-export-name')];

	// same-name pair
	expect(names.some((finding) => finding.siteKey === 'lightsout/duplicate-export-name:src/a/normalizeRecord.ts|src/b/normalizeRecord.ts')).toBeTruthy();
	// synonym pair collapses to one concept
	expect(names.some((finding) => finding.detail.includes("'fetchUserData'") && finding.detail.includes("'getUserData'"))).toBeTruthy();
	const structure = [
		...byRule('lightsout/multi-export'),
		...byRule('lightsout/filename-mismatch'),
		...byRule('lightsout/ungrouped-domain-utils'),
		...byRule('lightsout/folder-size'),
	];

	// multi-export flagged
	expect(structure.some((finding) => finding.siteKey === 'lightsout/multi-export:src/a/config.ts')).toBeTruthy();
	// misnamed file flagged
	expect(structure.some((finding) => finding.siteKey === 'lightsout/filename-mismatch:src/a/helpers.ts')).toBeTruthy();
	const domainFolderSite = 'lightsout/ungrouped-domain-utils:src/a/utils/formatCurrency.ts|src/a/utils/formatDate.ts';

	// domain-folder candidate
	expect(structure.some((finding) => finding.siteKey === domainFolderSite)).toBeTruthy();

	// oversized file flagged
	expect(byRule('lightsout/file-size').some((finding) => finding.files[0]?.path === 'src/b/huge.ts')).toBeTruthy();
	// a cap is a layout opinion: the pack ships it advisory, and a repo that wants
	// it to block promotes it in standards-rule-settings (this one has none)
	expect(byRule('lightsout/file-size').find((finding) => finding.siteKey === 'lightsout/file-size:src/b/huge.ts')?.severity).toBe('advisory');
	// .tsx under its larger cap not flagged
	expect(byRule('lightsout/file-size').some((finding) => finding.files[0]?.path === 'src/b/BigView.tsx')).toBeFalsy();

	const dead = byRule('lightsout/dead-export');

	// dead export flagged
	expect(dead.some((finding) => finding.detail.includes("'unusedThing'"))).toBeTruthy();
	// consumed export not flagged
	expect(dead.some((finding) => finding.detail.includes("'buildLabel'"))).toBeFalsy();
});

test('baseline ratchet: --baseline accepts debt explicitly; later runs report only what is new', async () => {
	const dir = setupCheckRepo();
	const first = await runStandardsCheck({ cwd: dir, config: await readOptionalConfig({ cwd: dir }) });

	// a run without a baseline reports the full debt
	expect(first.findings.length > 0).toBeTruthy();
	// a plain run never writes the baseline
	expect(existsSync(join(dir, 'lightsout.standards-baseline.json'))).toBeFalsy();
	// the accept-debt hint is offered
	expect(first.notes.some((note) => note.includes('--baseline'))).toBeTruthy();

	const accepting = await runStandardsCheck({ cwd: dir, config: await readOptionalConfig({ cwd: dir }), writeBaseline: true });

	// the explicit flag writes the committed ledger at the repo root
	expect(existsSync(join(dir, 'lightsout.standards-baseline.json'))).toBeTruthy();
	// the accepting run still reports everything
	expect(accepting.findings.length).toBe(first.findings.length);

	const ledger = JSON.parse(readFileSync(join(dir, 'lightsout.standards-baseline.json'), 'utf8')) as { path: string; siteKeys: string[] };

	// the ledger records the scope it accepted debt for
	expect(ledger.path).toBe('.');
	// it holds one entry per distinct site — the identities later runs measure against
	expect([...ledger.siteKeys].sort()).toStrictEqual([...new Set(accepting.findings.map((finding) => finding.siteKey))].sort());
	// accepting debt says how much of it was accepted:\n${accepting.notes.join('\n')}
	expect(accepting.notes.some((note) => note.includes(`baseline written: ${ledger.siteKeys.length} site(s)`))).toBeTruthy();

	const second = await runStandardsCheck({ cwd: dir, config: await readOptionalConfig({ cwd: dir }) });

	// clean re-check is silent: ${second.findings.map((finding) =>
	// finding.siteKey).join(', ')}
	expect(second.findings.length).toBe(0);
	// suppression is stated, not silent
	expect(second.notes.some((note) => note.includes('suppressed'))).toBeTruthy();

	// a new defect lands after the baseline was accepted
	writeFileSync(join(dir, 'src/b/config.ts'), 'export const readConfig = () => 1;\nexport const writeConfig = () => 2;\n');

	const third = await runStandardsCheck({ cwd: dir, config: await readOptionalConfig({ cwd: dir }) });

	// the new finding is reported
	expect(third.findings.some((finding) => finding.siteKey === 'lightsout/multi-export:src/b/config.ts')).toBeTruthy();
	// the baselined site stays suppressed
	expect(third.findings.some((finding) => finding.siteKey === 'lightsout/multi-export:src/a/config.ts')).toBeFalsy();

	const everything = await runStandardsCheck({ cwd: dir, config: await readOptionalConfig({ cwd: dir }), all: true });

	// --all includes the baselined findings
	expect(everything.findings.length > third.findings.length).toBeTruthy();
});

/** The smallest repo that still yields one known, stable finding site. */
const setupLedgerRepo = ({ ledger }: { ledger?: string } = {}) => {
	const dir = mkdtempSync(join(tmpdir(), 'lightsout-standards-ledger-'));

	mkdirSync(join(dir, 'src/a'), { recursive: true });
	writeFileSync(join(dir, 'src/a/config.ts'), 'export const readConfig = () => 1;\nexport const saveConfig = () => 2;\n');

	if (ledger !== undefined) {
		writeFileSync(join(dir, 'lightsout.standards-baseline.json'), ledger);
	}

	return dir;
};

test('runStandardsCheck reports stage progress and leaves the evidence file alone when told not to persist', async () => {
	const dir = setupLedgerRepo();
	const messages: string[] = [];

	const { findings } = await runStandardsCheck({
		cwd: dir,
		config: await readOptionalConfig({ cwd: dir }),
		persist: false,
		onProgress: (message) => messages.push(message),
	});

	// the opening progress line counts the scope: ${messages[0]}
	expect(messages[0]?.includes('1 source file(s)')).toBeTruthy();
	// progress is reported per input kind, through the last one that had rules
	// to run:\n${messages.join('\n')}
	expect(messages).toContain('file-text: done');
	// the check still reports its findings
	expect(findings.length > 0).toBeTruthy();
	// persist: false never clobbers the standalone report
	expect(existsSync(join(dir, '.lightsout/standards-check.json'))).toBeFalsy();
	// nor does an in-pipeline run contribute a point to the standards trend
	expect(existsSync(join(dir, '.lightsout/standards-check'))).toBeFalsy();
});

test('a persisting run writes the typed evidence file it returns', async () => {
	const dir = setupLedgerRepo();

	const { findings, notes } = await runStandardsCheck({ cwd: dir, config: await readOptionalConfig({ cwd: dir }) });

	const raw = readFileSync(join(dir, '.lightsout/standards-check.json'), 'utf8');
	const report = JSON.parse(raw) as { at: string; path: string; findings: Array<{ siteKey: string }>; notes: string[] };
	// a whole-repo run records the root as its scope
	expect(report.path).toBe('.');
	// the file holds what the caller got
	expect(report.findings.map((finding) => finding.siteKey).sort()).toStrictEqual(findings.map((finding) => finding.siteKey).sort());
	// the notes travel with the findings
	expect(report.notes).toStrictEqual(notes);

	const dated = readdirSync(join(dir, '.lightsout/standards-check'));

	// the same writer leaves a dated copy beside it, byte for byte
	expect(dated.length).toBe(1);
	expect(readFileSync(join(dir, '.lightsout/standards-check', dated[0]), 'utf8')).toBe(raw);
	// named for the moment the check ran, with nothing a filesystem refuses
	expect(dated[0]).toBe(`${report.at.replaceAll(':', '-').replaceAll('.', '-')}.json`);
});

/** Write a set of repo-relative files under `dir`, creating the folders they need. */
const writeTree = ({ dir, files }: { dir: string; files: Record<string, string> }) => {
	for (const [rel, content] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, rel)), { recursive: true });
		writeFileSync(join(dir, rel), content);
	}
};

/**
 * A standards library of somebody's own: one document, one rule, one check that
 * flags every source file it is handed, and one pack, `acme/house`, bringing
 * that document in. The check is written the way a library author writes one —
 * a `check` export naming its input kind, and no engine import at run time.
 *
 * It sits outside the repo it checks, so the library's own files never show up
 * in that repo's file list.
 */
const writeOwnPack = () => {
	const packPath = mkdtempSync(join(tmpdir(), 'lightsout-house-standards-'));

	writeTree({
		dir: packPath,
		files: {
			'lightsout-standards.json': '{ "name": "acme", "formatVersion": 2 }\n',
			'rules/code/house/topic.md': '# House Style\n\nWhat this shop agrees on.\n',
			'rules/code/house/05-house-no-loose-files/rule.md':
				'---\nsummary: a source file outside a module\nchecked: true\nseverity: blocking\n---\n\nEvery file belongs to a module.\n',
			'rules/code/house/05-house-no-loose-files/check.ts':
				'export const check = {\n' +
				"\tinputKind: 'file-list',\n" +
				'\trun: ({ input }) => input.files.map((path) => ({ siteKey: `house-no-loose-files:${path}`, files: [{ path }], detail: `${path} sits outside a module` })),\n' +
				'};\n',
			'rules/code/house/05-house-no-loose-files/fixtures/pass/src/mod/index.ts': 'export const mod = 1;\n',
			'rules/code/house/05-house-no-loose-files/fixtures/fail/src/loose.ts': 'export const loose = 1;\n',
			'packs/house.json': JSON.stringify({ description: 'the house pack', include: { topics: ['acme/code/house'] } }),
		},
	});

	return packPath;
};

/** A repo whose config registers the house library and names its pack instead of the bundled defaults. */
const setupOwnPackRepo = () => {
	const dir = mkdtempSync(join(tmpdir(), 'lightsout-standards-own-'));

	writeTree({
		dir,
		files: {
			'src/alpha.ts': 'export const alpha = 1;\n',
			'src/beta.ts': 'export const beta = 2;\n',
			'lightsout.config.json': JSON.stringify({
				gates: { check: 'true', test: 'true', 'test-coverage': false },
				'standards-libraries': { acme: writeOwnPack() },
				'standards-pack': 'acme/house',
			}),
		},
	});

	return dir;
};

test("a repo's own standards pack supplies the rules, and the bundled defaults do not run beside them", async () => {
	const dir = setupOwnPackRepo();

	const { findings } = await runStandardsCheck({ cwd: dir, config: await readOptionalConfig({ cwd: dir }), persist: false });

	// the rule id comes from the folder the check was loaded from, and the
	// severity from that rule's own declaration
	expect(findings.map((finding) => `${finding.rule} ${finding.severity} ${finding.siteKey}`).sort()).toStrictEqual([
		'acme/house-no-loose-files blocking acme/house-no-loose-files:src/alpha.ts',
		'acme/house-no-loose-files blocking acme/house-no-loose-files:src/beta.ts',
	]);
});

/** A repo on the house pack whose source spans a nested folder, so a scope has something to bite on. */
const setupScopedRepo = () => {
	const dir = mkdtempSync(join(tmpdir(), 'lightsout-standards-scope-'));

	writeTree({
		dir,
		files: {
			'src/keep.ts': 'export const keep = 1;\n',
			'src/core/inner.ts': 'export const inner = 2;\n',
			'lightsout.config.json': JSON.stringify({
				gates: { check: 'true', test: 'true', 'test-coverage': false },
				'standards-libraries': { acme: writeOwnPack() },
				'standards-pack': 'acme/house',
			}),
		},
	});

	return dir;
};

test('--path checks the subpath it was given, and the evidence file records that scope', async () => {
	const dir = setupScopedRepo();

	const { findings } = await runStandardsCheck({ cwd: dir, config: await readOptionalConfig({ cwd: dir }), path: 'src/core' });

	const report = JSON.parse(readFileSync(join(dir, '.lightsout/standards-check.json'), 'utf8')) as { path: string };
	// the files outside the scope are never handed to a check
	expect(findings.map((finding) => finding.siteKey)).toStrictEqual(['acme/house-no-loose-files:src/core/inner.ts']);
	// a scoped report says what it covered, so nobody reads it as the whole repo
	expect(report.path).toBe('src/core');
});

/**
 * A repo on the house pack whose `lightsout.config.json` on disk was edited
 * after the run started into one the engine rejects, beside the config the run
 * started with.
 */
const setupRejectedConfigRepo = () => {
	const dir = mkdtempSync(join(tmpdir(), 'lightsout-standards-handed-'));
	const startingConfig = {
		gates: { check: 'true', test: 'true', 'test-coverage': false },
		'standards-libraries': { acme: writeOwnPack() },
		'standards-pack': 'acme/house',
	};

	writeTree({
		dir,
		files: {
			'src/alpha.ts': 'export const alpha = 1;\n',
			'src/beta.ts': 'export const beta = 2;\n',
			'lightsout.config.json': JSON.stringify({ ...startingConfig, 'standards-pak': 'acme/house' }),
		},
	});

	return { dir, config: LightsoutConfig.parse(startingConfig) };
};

test('checks with the config it is handed even when the lightsout.config.json on disk would be rejected', async () => {
	const { dir, config } = setupRejectedConfigRepo();

	const { findings } = await runStandardsCheck({ cwd: dir, config, persist: false });

	// the handed config's pack runs; the edited file on disk is never parsed
	expect(findings.map((finding) => finding.siteKey).sort()).toStrictEqual(['acme/house-no-loose-files:src/alpha.ts', 'acme/house-no-loose-files:src/beta.ts']);
});

test('handed no config, never falls back to the pack the lightsout.config.json on disk names', async () => {
	const dir = setupOwnPackRepo();

	const { findings } = await runStandardsCheck({ cwd: dir, config: undefined, persist: false });

	// the file on disk names acme/house, but only the handed config counts
	expect(findings.filter((finding) => finding.rule.startsWith('acme/house'))).toStrictEqual([]);
});
