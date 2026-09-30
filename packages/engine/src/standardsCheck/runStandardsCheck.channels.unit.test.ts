import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test } from '@jest/globals';
import { runStandardsCheck } from '#src/standardsCheck/runStandardsCheck.ts';

/** Write a set of repo-relative files under `dir`, creating the folders they need. */
const writeTree = ({ dir, files }: { dir: string; files: Record<string, string> }) => {
	for (const [rel, content] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, rel)), { recursive: true });
		writeFileSync(join(dir, rel), content);
	}
};

/** The check a house rule ships: one finding per source file, so which rules actually ran is readable straight off the report. */
const houseCheckSource = ({ ruleId }: { ruleId: string }) =>
	'export const check = {\n' +
	"\tinputKind: 'file-list',\n" +
	`\trun: ({ input }) => input.files.map((path) => ({ siteKey: \`${ruleId}:\${path}\`, files: [{ path }], detail: 'every file belongs to a module' })),\n` +
	'};\n';

/** One rule folder's files: its declaration, its check, and the fixture pair every rule ships. */
const houseRuleFiles = ({ documentPath, ruleId }: { documentPath: string; ruleId: string }) => ({
	[`${documentPath}/05-${ruleId}/rule.md`]: '---\nsummary: a source file outside a module\nchecked: true\n---\n\nEvery file belongs to a module.\n',
	[`${documentPath}/05-${ruleId}/check.ts`]: houseCheckSource({ ruleId }),
	[`${documentPath}/05-${ruleId}/fixtures/pass/src/mod/index.ts`]: 'export const mod = 1;\n',
	[`${documentPath}/05-${ruleId}/fixtures/fail/src/loose.ts`]: 'export const loose = 1;\n',
});

/** A pack whose second document is framework-scoped — the channel gate needs a rule on each side of it. */
const writeChannelPack = () => {
	const packPath = mkdtempSync(join(tmpdir(), 'lightsout-channel-standards-'));

	writeTree({
		dir: packPath,
		files: {
			'lightsout-standards.json': '{ "name": "acme-channels", "formatVersion": 1 }\n',
			'code/house/topic.md': '# House Style\n\nWhat this shop agrees on everywhere.\n',
			...houseRuleFiles({ documentPath: 'code/house', ruleId: 'house-any-file' }),
			'code/react/topic.md': '---\nchannel: react\n---\n\n# React Style\n\nWhat this shop agrees on in React.\n',
			...houseRuleFiles({ documentPath: 'code/react', ruleId: 'house-react-file' }),
		},
	});

	return packPath;
};

/** A repo with one source file, whose root manifest and config between them decide which framework channels are in play. */
const setupChannelRepo = ({ dependencies = {}, standardsChannels }: { dependencies?: Record<string, string>; standardsChannels?: string[] }) => {
	const dir = mkdtempSync(join(tmpdir(), 'lightsout-standards-channel-'));

	writeTree({
		dir,
		files: {
			'package.json': JSON.stringify({ name: 'channel-fixture', dependencies }),
			'src/alpha.ts': 'export const alpha = 1;\n',
			'lightsout.config.json': JSON.stringify({
				gates: { check: 'true', test: 'true', 'test-coverage': false },
				'standards-packs': [writeChannelPack()],
				...(standardsChannels ? { 'standards-channels': standardsChannels } : {}),
			}),
		},
	});

	return dir;
};

test("a framework rule runs when the repo's own manifest shows it is in that framework", async () => {
	const dir = setupChannelRepo({ dependencies: { react: '^19.0.0' } });

	const { findings } = await runStandardsCheck({ cwd: dir, persist: false });

	// channels are detected from the root package.json, so no config is needed
	// to put a React repo's React rules in play
	expect(findings.map((finding) => finding.rule).sort()).toStrictEqual(['acme-channels/house-any-file', 'acme-channels/house-react-file']);
});

test('a configured channel list is the whole answer, overriding what the manifest would have detected', async () => {
	const dir = setupChannelRepo({ dependencies: { react: '^19.0.0' }, standardsChannels: [] });

	const { findings } = await runStandardsCheck({ cwd: dir, persist: false });

	// an explicit list wins even where detection would have said otherwise —
	// prose and checks read the same answer
	expect(findings.map((finding) => finding.rule)).toStrictEqual(['acme-channels/house-any-file']);
});
