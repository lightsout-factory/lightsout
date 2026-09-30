import { describe, expect, test } from '@jest/globals';
import { buildStandardsReviewInvocation } from '#src/agents/buildStandardsReviewInvocation.ts';

const rule = ({ name, documentPath = 'code/architecture/folder-structure', prose }: { name: string; documentPath?: string; prose: string }) => ({
	name,
	documentPath,
	prose,
});

describe('buildStandardsReviewInvocation', () => {
	test('a rule’s prose is inlined whole — the argument is what the reviewer generalises from', () => {
		const prose = '## Keep common close\n\nPromote a helper only when two modules need it.\n\n- first bullet\n- second bullet';

		const { systemPrompt } = buildStandardsReviewInvocation({ rules: [rule({ name: 'common-placement', prose })], files: ['src/a.ts'] });

		// every line of it, not a summary of it
		expect(systemPrompt).toContain(prose);
	});

	test('each rule is named by its id, so a finding can point back at one', () => {
		const { systemPrompt } = buildStandardsReviewInvocation({
			rules: [rule({ name: 'lightsout/common-placement', prose: 'the argument' })],
			files: ['src/a.ts'],
		});

		expect(systemPrompt).toContain('**Rule: `lightsout/common-placement`**');
	});

	test('each rule to review is introduced by its full name', () => {
		const { systemPrompt } = buildStandardsReviewInvocation({
			rules: [{ name: 'acme/judge', documentPath: 'code/architecture/folder-structure', prose: 'the argument' }],
			files: ['src/a.ts'],
		});

		const rules = systemPrompt.split('# Rules to review against')[1] ?? '';
		const introduction = rules.slice(0, rules.indexOf('the argument')).trim().split('\n').at(-1);

		// the line right above the prose names the rule by library and id, which the agent copies into its report
		expect(introduction).toContain('acme/judge');
	});

	test('rules are grouped under the document that states them', () => {
		const { systemPrompt } = buildStandardsReviewInvocation({
			rules: [
				rule({ name: 'first', documentPath: 'code/architecture/folder-structure', prose: 'one' }),
				rule({ name: 'second', documentPath: 'code/style-guide/patterns/functions', prose: 'two' }),
				rule({ name: 'third', documentPath: 'code/architecture/folder-structure', prose: 'three' }),
			],
			files: ['src/a.ts'],
		});

		const rules = systemPrompt.split('# Rules to review against')[1] ?? '';

		// two headings for three rules — the two folder-structure rules read together
		expect(rules.match(/^## .+$/gm)).toStrictEqual(['## code/architecture/folder-structure', '## code/style-guide/patterns/functions']);
		// including the one that arrived last, which joins its own document rather
		// than trailing off the end
		expect(rules.indexOf('**Rule: `third`**')).toBeLessThan(rules.indexOf('## code/style-guide/patterns/functions'));
	});

	test('rules keep the order they were handed over within their document', () => {
		const { systemPrompt } = buildStandardsReviewInvocation({
			rules: [rule({ name: 'first', prose: 'one' }), rule({ name: 'second', prose: 'two' }), rule({ name: 'third', prose: 'three' })],
			files: ['src/a.ts'],
		});

		// the caller decides what should be read first — the grouping must not reshuffle it
		expect(systemPrompt.match(/\*\*Rule: `(\w+)`\*\*/g)).toStrictEqual(['**Rule: `first`**', '**Rule: `second`**', '**Rule: `third`**']);
	});

	test('the role prompt leads the system prompt and the rules follow it behind a horizontal rule', () => {
		const { systemPrompt } = buildStandardsReviewInvocation({
			rules: [rule({ name: 'common-placement', prose: 'the argument' })],
			files: ['src/a.ts'],
		});

		const sections = systemPrompt.split('\n\n---\n\n');

		// exactly two sections: who the reviewer is, then what they review against
		expect(sections.length).toBe(2);
		expect(sections[0].startsWith('# Role: Standards Reviewer')).toBe(true);
		expect(sections[1]).toBe('# Rules to review against\n\n## code/architecture/folder-structure\n\n**Rule: `common-placement`**\n\nthe argument');
	});

	test('the system prompt is byte-identical across reviews that differ only in the files under review', () => {
		const rules = [rule({ name: 'common-placement', prose: 'the argument' })];

		const first = buildStandardsReviewInvocation({ rules, files: ['src/a.ts'] });
		const second = buildStandardsReviewInvocation({ rules, files: ['src/b.ts', 'src/c.ts'] });

		// the whole reason the rules ride the system prompt: the harness caches through it
		expect(first.systemPrompt).toBe(second.systemPrompt);
	});

	test('the files are listed in the task message, which is the only half that changes between reviews', () => {
		const { systemPrompt, prompt } = buildStandardsReviewInvocation({
			rules: [rule({ name: 'common-placement', prose: 'the argument' })],
			files: ['src/a.ts', 'src/b/c.ts'],
		});

		expect(prompt).toContain('# Files in scope for the standards review');
		expect(prompt).toContain('- src/a.ts');
		expect(prompt).toContain('- src/b/c.ts');
		// the rules ride the cached half instead
		expect(systemPrompt.includes('src/a.ts')).toBe(false);
	});

	test('the role prompt and the JSON-only reminder both ride along', () => {
		const { systemPrompt, prompt } = buildStandardsReviewInvocation({
			rules: [rule({ name: 'common-placement', prose: 'the argument' })],
			files: ['src/a.ts'],
		});

		expect(systemPrompt).toContain('# Role: Standards Reviewer');
		expect(prompt).toContain('your entire final message must be exactly one JSON report object');
	});

	test('buildStandardsReviewInvocation: the command ban names what is banned and leaves file access open — a harness whose only file access is a shell must not read it as "touch nothing"', () => {
		const { systemPrompt } = buildStandardsReviewInvocation({ rules: [rule({ name: 'common-placement', prose: 'the argument' })], files: ['src/a.ts'] });
		// the prompt wraps its lines; the sentences are what matter
		const prose = systemPrompt.replace(/\s+/g, ' ');

		// verification and environment changes stay the engine's alone
		expect(prose).toContain(
			'Do not run builds, tests, linters, formatters, package-manager commands, Git commands, network commands, or any other verification or environment-changing command',
		);
		// file inspection and editing are explicitly allowed, by whatever tooling the harness has
		expect(prose).toContain("Use the harness's file tools to read");
		expect(prose).toContain('If the harness exposes the filesystem only through a shell, use the shell solely to read files — never for repository commands.');
		// the old blanket ban is gone — on Codex it read as "you cannot read or edit files"
		expect(prose).not.toContain('Do not run shell commands');
	});
});
