import { resolve } from 'node:path';
import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { dim } from '#src/cli/internal/common/terminal/dim.ts';
import { green } from '#src/cli/internal/common/terminal/green.ts';
import { red } from '#src/cli/internal/common/terminal/red.ts';
import { yellow } from '#src/cli/internal/common/terminal/yellow.ts';
import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { builtInStandardsLibraryName } from '#src/contracts/standards/builtInStandardsLibraryName.ts';
import { validateStandardsLibrary } from '#src/standardsCheck/validateStandardsLibrary.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { resolveDefaultStandardsLibrary } from '#src/standardsLibraries/resolveDefaultStandardsLibrary.ts';
import { resolveStandardsLibraries } from '#src/standardsLibraries/resolveStandardsLibraries.ts';

/**
 * The validated library takes the place of the library sharing its name, and
 * is never a second copy beside it: named lightsout, it stands in for the
 * built-in library, whose folder is then never read.
 */
const readLibraries = async ({ requested, cwd }: { requested?: string; cwd: string }) => {
	const library = await readStandardsLibrary({ packPath: requested === undefined ? resolveDefaultStandardsLibrary() : resolve(cwd, requested) });
	const config = await readOptionalConfig({ cwd });
	let libraries: LoadedStandardsLibrary[];

	if (library.name === builtInStandardsLibraryName) {
		libraries = await resolveStandardsLibraries({ cwd, config, builtIn: library });
	} else {
		const registered = await resolveStandardsLibraries({ cwd, config });
		const hasNamesake = registered.some((candidate) => candidate.name === library.name);

		libraries = hasNamesake ? registered.map((candidate) => (candidate.name === library.name ? library : candidate)) : [...registered, library];
	}

	return { library, libraries };
};

export const standardsValidateCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const requested = getStringFlag({ flags, name: 'library' });
	const { library, libraries } = await readLibraries({ requested, cwd }).catch((error: unknown) => {
		console.error(messageOf({ error }));
		return exitCli({ code: 1 });
	});
	const { problems, notes, warnings } = await validateStandardsLibrary({ library, libraries });

	for (const note of notes) {
		console.log(`${dim('ℹ')} ${dim(note)}`);
	}

	// Never counted toward the exit code: a pack may leave a requirement out on purpose.
	for (const warning of warnings) {
		console.log(`${yellow('⚠')} ${warning}`);
	}

	for (const problem of problems) {
		console.log(`${red('✗')} ${problem}`);
	}

	const checked = library.rules.filter((rule) => rule.checked).length;
	const judgment = library.rules.length - checked;
	const packFiles = library.packs.length;

	console.log('');

	if (problems.length > 0) {
		console.log(`${library.name} — ${problems.length} problem(s) across ${checked} checked rule(s) and ${packFiles} pack file(s)`);
		return exitCli({ code: 1 });
	}

	console.log(green(`${library.name} — ${checked} checked rule(s) validated, ${judgment} judgment-only rule(s), ${packFiles} pack file(s)`));
	return exitCli({ code: 0 });
};
