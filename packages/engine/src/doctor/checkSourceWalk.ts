import { relative } from 'node:path';
import { runCommand } from '#src/common/processes/runCommand.ts';
import { listSourceFiles } from '#src/common/sourceFiles/listSourceFiles.ts';
import { probeTimeoutMs } from '#src/doctor/internal/common/constants/probeTimeoutMs.ts';
import type { DoctorCheck } from '#src/doctor/internal/common/types/DoctorCheck.ts';

interface Params {
	cwd: string;
	/** The config's `generated` list — paths the consumer declared as output. */
	generated?: string[];
}

const sourceExtension = /\.(m|c)?[jt]sx?$/;

/** `fixtures/` is only a reason inside a standards pack, so the pack roots decide it rather than the name alone. */
const skipReason = ({ path, generated, standardsLibraries }: { path: string; generated: string[]; standardsLibraries: string[] }) => {
	const segments = path.split('/');

	if (path.endsWith('.d.ts')) {
		return 'declaration file';
	}

	if (segments.some((segment) => segment.startsWith('.'))) {
		return 'dot directory';
	}

	if (segments.includes('node_modules')) {
		return 'dependency tree';
	}

	if (generated.some((prefix) => path.startsWith(prefix.replace(/\/$/, '')))) {
		return 'declared generated';
	}

	const insidePack = standardsLibraries.some((pack) => path.startsWith(`${pack}/`));

	if (insidePack && segments.includes('fixtures')) {
		return 'standards pack fixture';
	}

	// The walk skips these names only before `src`, so this does too.
	const beforeSrc = segments.slice(0, segments.indexOf('src') === -1 ? segments.length : segments.indexOf('src'));

	return beforeSrc.some((segment) => ['dist', 'build', 'coverage', 'out'].includes(segment)) ? 'build output' : undefined;
};

/**
 * A walk that lists too few files reports fewer findings rather than an error,
 * so git's index is the second opinion: every tracked source file must be walked
 * or skipped for a reason this can name.
 */
export const checkSourceWalk = async ({ cwd, generated = [] }: Params): Promise<DoctorCheck> => {
	const result = await runCommand({ command: 'git ls-files -z', cwd, timeoutMs: probeTimeoutMs }).catch(() => undefined);

	if (result === undefined || result.exitCode !== 0) {
		return { id: 'source-walk', status: 'warn', detail: 'not a git repository — the walk has no second opinion to check against' };
	}

	const tracked = (result.stdout ?? '')
		.split('\0')
		.filter((path) => path !== '' && sourceExtension.test(path))
		.map((path) => relative('.', path));

	const { files, standardsLibraries } = await listSourceFiles({ cwd, exclude: generated });
	const walked = new Set(files);
	const unexplained = tracked.filter((path) => !walked.has(path) && skipReason({ path, generated, standardsLibraries }) === undefined);

	if (unexplained.length === 0) {
		return { id: 'source-walk', status: 'pass', detail: `walk reads ${files.length} of ${tracked.length} tracked source file(s); every skip is accounted for` };
	}

	const shown = unexplained.slice(0, 5);

	return {
		id: 'source-walk',
		status: 'fail',
		detail: `${unexplained.length} tracked source file(s) the walk never reads: ${shown.join(', ')}${unexplained.length > shown.length ? ', …' : ''}`,
		fix: "no rule reads these — either the walk is skipping a directory it should not, or the path belongs in the config's `generated` list",
	};
};
