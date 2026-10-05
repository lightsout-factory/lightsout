import { expect, test } from '@jest/globals';
import { buildFeatureExecutorInvocation } from '#src/agents/buildFeatureExecutorInvocation/buildFeatureExecutorInvocation.ts';
import { BuildMode } from '#src/common/constants/BuildMode.ts';

const planContent = '# Plan: add the widget flag\n\nPLAN-SENTINEL';
const standards = '## Tabs only\n\nSTANDARDS-SENTINEL';

const renameOnlySectionOf = (systemPrompt: string) => systemPrompt.split('\n\n---\n\n').find((section) => section.startsWith('# Rename-only phase')) ?? '';

test('buildFeatureExecutorInvocation: a rename-only plan gets a section listing its renames in order, and any other plan gets none', () => {
	const renames = [
		{ from: 'widgetFlag', to: 'featureFlag', line: 12 },
		{ from: 'src/widget.ts', to: 'src/feature.ts', line: 13 },
	];
	const renamed = buildFeatureExecutorInvocation({ planContent, planBuildMode: { buildMode: BuildMode.RenamesOnly, renames } });
	const absent = buildFeatureExecutorInvocation({ planContent });
	const empty = buildFeatureExecutorInvocation({ planContent, planBuildMode: { buildMode: BuildMode.Standard } });
	const section = renameOnlySectionOf(renamed.systemPrompt);
	const lines = section.split('\n');
	// the prompt wraps its lines; the sentences are what matter
	const prose = section.replace(/\s+/g, ' ');

	// the section rides the cached system prompt, after the plan it narrows
	expect(section).not.toBe('');
	expect(renamed.systemPrompt.indexOf(`# Plan\n\n${planContent}`)).toBeLessThan(renamed.systemPrompt.indexOf('# Rename-only phase'));
	// each rename is one bullet carrying both texts in backtick spans
	expect(lines.some((line) => line.startsWith('- ') && line.includes('`widgetFlag`') && line.includes('`featureFlag`'))).toBeTruthy();
	expect(lines.some((line) => line.startsWith('- ') && line.includes('`src/widget.ts`') && line.includes('`src/feature.ts`'))).toBeTruthy();
	// the renames are listed in the order they are applied
	expect(section.indexOf('`widgetFlag`')).toBeLessThan(section.indexOf('`src/widget.ts`'));
	// the phase writes no tests
	expect(prose).toMatch(/write no tests/i);
	// any other change is refused before a gate runs
	expect(prose).toMatch(/refuse/i);
	expect(prose).toMatch(/before any gate/i);
	// a plan that is not rename-only is told nothing about renames
	expect(absent.systemPrompt).not.toContain('# Rename-only phase');
	expect(empty.systemPrompt).not.toContain('# Rename-only phase');
	expect(empty.systemPrompt).toBe(absent.systemPrompt);
});

const moveOnlySectionOf = (systemPrompt: string) =>
	systemPrompt.split('\n\n---\n\n').find((section) => section.startsWith('# Move-folders-and-files phase')) ?? '';

test('buildFeatureExecutorInvocation: a move-folders-and-files plan gets a section listing its moves and lifting the file limit, and any other plan gets none', () => {
	const fileMoves = [{ from: 'src/flag.ts', to: 'src/featureFlag.ts' }];
	const folderMoves = [{ from: 'src/widgets', to: 'lib/widgets' }];
	const moved = buildFeatureExecutorInvocation({
		planContent,
		standards,
		planBuildMode: { buildMode: BuildMode.MoveFoldersAndFiles, fileMoves, folderMoves },
	});
	const standard = buildFeatureExecutorInvocation({ planContent, standards, planBuildMode: { buildMode: BuildMode.Standard } });
	const absent = buildFeatureExecutorInvocation({ planContent, standards });
	const renamed = buildFeatureExecutorInvocation({
		planContent,
		standards,
		planBuildMode: { buildMode: BuildMode.RenamesOnly, renames: [{ from: 'widgetFlag', to: 'featureFlag', line: 12 }] },
	});
	const section = moveOnlySectionOf(moved.systemPrompt);
	const lines = section.split('\n');
	// the prompt wraps its lines; the sentences are what matter
	const prose = section.replace(/\s+/g, ' ');

	// the section rides the cached system prompt, after the plan it narrows and before the standards
	expect(section).not.toBe('');
	expect(moved.systemPrompt.indexOf(`# Plan\n\n${planContent}`)).toBeLessThan(moved.systemPrompt.indexOf('# Move-folders-and-files phase'));
	expect(moved.systemPrompt.indexOf('# Move-folders-and-files phase')).toBeLessThan(moved.systemPrompt.indexOf('# Standards\n\n'));
	// a folder move is one bullet whose two paths carry their trailing slash restored
	expect(lines.some((line) => line.startsWith('- ') && line.includes('`src/widgets/`') && line.includes('`lib/widgets/`'))).toBeTruthy();
	// a file move is one bullet carrying both paths in backtick spans
	expect(lines.some((line) => line.startsWith('- ') && line.includes('`src/flag.ts`') && line.includes('`src/featureFlag.ts`'))).toBeTruthy();
	// the standing brief's source-file stop is lifted for this phase
	expect(prose).toMatch(/source files?[^.]*(does not|doesn't|no longer) apply/i);
	// a file left at its old path is refused
	expect(prose).toMatch(/left[^.]*old path/i);
	// a file that is not text may only be moved unchanged
	expect(prose).toMatch(/(not text|non-text|binary)[^.]*unchanged/i);
	// the phase writes no tests
	expect(prose).toMatch(/no tests/i);
	// a moved folder is reported once, not file by file
	expect(prose).toContain('changedFiles');
	expect(prose).toMatch(/one entry per moved folder/i);
	// any other change is refused before a gate runs
	expect(prose).toMatch(/refuse/i);
	expect(prose).toMatch(/before any gate/i);
	// a standard plan reads exactly like a plan that names no mode, with neither mode section
	expect(standard.systemPrompt).toBe(absent.systemPrompt);
	expect(absent.systemPrompt).not.toContain('# Move-folders-and-files phase');
	expect(absent.systemPrompt).not.toContain('# Rename-only phase');
	// a rename-only plan still gets only the rename section
	expect(renamed.systemPrompt).toContain('# Rename-only phase');
	expect(renamed.systemPrompt).not.toContain('# Move-folders-and-files phase');
});
