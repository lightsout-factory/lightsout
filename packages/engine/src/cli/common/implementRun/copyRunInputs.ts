import { cp, mkdir } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { messageOf } from '#src/common/messageOf.ts';
import { planNameFromPath } from '#src/plan/planNameFromPath.ts';

interface Params {
	/** The checkout the command was launched from. */
	sourceCwd: string;
	/** The workspace the run works in. Equal to `sourceCwd` when isolation is off, where nothing is copied. */
	workspace: string;
	/** `--plan` exactly as the user typed it. */
	planPath?: string;
	/** `--ticket` exactly as the user typed it. */
	ticketPath?: string;
}

/**
 * Always copied into the gitignored lightsout state directory, so a run ending
 * in `git add -A` cannot stage the user's own input into its commit.
 */
const copyLooseInput = async ({ sourceCwd, workspace, inputPath }: { sourceCwd: string; workspace: string; inputPath: string }) => {
	const source = resolve(sourceCwd, inputPath);
	const destination = join(workspace, '.lightsout', 'inputs', basename(source));

	await mkdir(dirname(destination), { recursive: true });
	await cp(source, destination);

	return relative(workspace, destination);
};

/**
 * A plan is not copied: a plan folder lives in the main checkout whichever
 * checkout a run works in, so copying it would copy a directory onto itself. It
 * is answered repo-relative, which is what the run manifest records.
 */
const copyOneInput = async ({ sourceCwd, workspace, inputPath }: { sourceCwd: string; workspace: string; inputPath: string }) => {
	const name = await planNameFromPath({ cwd: sourceCwd, planPath: inputPath });

	return name === undefined ? copyLooseInput({ sourceCwd, workspace, inputPath }) : relative(sourceCwd, resolve(sourceCwd, inputPath));
};

/**
 * A loose input is copied, so the run is independent of later edits to it.
 * Nothing under `sourceCwd` is written, moved or deleted, which leaves the
 * user's uncommitted edits beside the plan alone.
 */
export const copyRunInputs = async ({
	sourceCwd,
	workspace,
	planPath,
	ticketPath,
}: Params): Promise<{ planPath?: string; ticketPath?: string } | { error: string }> => {
	if (resolve(workspace) === resolve(sourceCwd)) {
		return { planPath, ticketPath };
	}

	let copied: { planPath?: string; ticketPath?: string } | { error: string };

	try {
		copied = {
			planPath: planPath === undefined ? undefined : await copyOneInput({ sourceCwd, workspace, inputPath: planPath }),
			ticketPath: ticketPath === undefined ? undefined : await copyOneInput({ sourceCwd, workspace, inputPath: ticketPath }),
		};
	} catch (error) {
		copied = { error: `the run's inputs could not be copied into ${workspace}: ${messageOf({ error })}` };
	}

	return copied;
};
