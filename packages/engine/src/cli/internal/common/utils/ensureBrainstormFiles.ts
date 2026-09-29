import { restoreBrainstormFiles } from '#src/brainstorm/restore/restoreBrainstormFiles.ts';
import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import { readPlanWorkOrderRef } from '#src/plan/readPlanWorkOrderRef.ts';
import { resolveTrackerSettings } from '#src/ticketTracker/resolveTrackerSettings.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the folder the fetched files land in. */
	name: string;
	/** Where the "fetched from the ticket" line goes — stdout by default, so a test reads what was printed. */
	write?: (line: string) => void;
}

const report = ({
	restored,
	skipped,
	identifier,
	dir,
	write,
}: {
	restored: string[];
	skipped: string[];
	identifier: string;
	dir: string;
	write: (line: string) => void;
}) => {
	if (restored.length > 0) {
		write(`lightsout: fetched ${restored.length} brainstorm file(s) from ticket ${identifier} into ${dir}`);
	}

	if (skipped.length > 0) {
		write(`lightsout: kept the local ${skipped.join(', ')} — ticket ${identifier} also carries ${skipped.length > 1 ? 'them' : 'it'}`);
	}
};

/**
 * Never blocks, unlike `ensurePlanWorkspace`: planning must still run in a repo
 * with no `lightsout.config.json`, and a ticket with no published brainstorm is
 * the ordinary case rather than a failure.
 */
export const ensureBrainstormFiles = async ({ cwd, name, write = console.log }: Params): Promise<void> => {
	// Unguarded: a config the engine cannot parse must fail loudly here, exactly
	// as it does in `ensurePlanWorkspace`.
	const config = await readOptionalConfig({ cwd });

	if (config === undefined) {
		return;
	}

	const trackerSettings = resolveTrackerSettings({ config, env: process.env });

	if ('error' in trackerSettings) {
		return;
	}

	const address = parsePlanAddress({ name });
	const identifier = address === undefined ? undefined : await readPlanWorkOrderRef({ cwd, name });

	if (address === undefined || identifier === undefined) {
		return;
	}

	const dir = await planWorkspaceDir({ cwd, name });
	const taken = await restoreBrainstormFiles({ cwd, name, identifier, settings: trackerSettings, titlePrefix: address.planId });

	if (taken.error !== undefined) {
		write(`lightsout: could not fetch the brainstorm from ticket ${identifier}: ${taken.error}`);
	} else {
		report({ restored: taken.restored, skipped: taken.skipped, identifier, dir, write });
	}
};
