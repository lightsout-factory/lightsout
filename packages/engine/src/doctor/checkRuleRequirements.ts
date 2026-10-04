import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { describePackageSet } from '#src/common/workspace/describePackageSet.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { DoctorCheck } from '#src/doctor/internal/common/types/DoctorCheck.ts';
import { findMissingRequirements } from '#src/standards/findMissingRequirements.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig;
}

/**
 * Judged here and never during a run: the repo is who can fix a pack that
 * sends a rule without a rule it requires, and a run's log is not where it
 * would look. Each group is judged after `standards-rule-settings` apply.
 */
export const checkRuleRequirements = async ({ cwd, config }: Params): Promise<DoctorCheck | undefined> => {
	let groups: StandardsGroup[];

	try {
		groups = await resolveStandardsGroups({ cwd, config, packages: undefined });
	} catch (error) {
		return {
			id: 'rule-requirements',
			status: 'fail',
			detail: `the standards will not load: ${messageOf({ error })}`,
			fix: 'fix the standards config or library the error names — every run stops on it until the standards load',
		};
	}

	if (groups.length === 0) {
		return undefined;
	}

	const entries = groups.flatMap((group) =>
		findMissingRequirements({ rules: group.pack.rules, states: group.states }).map(
			({ rule, required }) =>
				`${describePackageSet({ packages: group.packages })} (${group.pack.name}): ${rule} requires ${required}, which does not reach agents`,
		),
	);

	return entries.length === 0
		? { id: 'rule-requirements', status: 'pass', detail: `every required rule reaches agents across ${groups.length} package group(s)` }
		: {
				id: 'rule-requirements',
				status: 'warn',
				detail: entries.join('; '),
				fix: 'add each required rule to that pack through its include.rules list, or turn it on in standards-rule-settings — until then agents read rules that point at one they never see',
			};
};
