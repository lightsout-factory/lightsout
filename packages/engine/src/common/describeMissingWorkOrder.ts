interface Params {
	name: string;
}

/**
 * It lives here rather than in the work order module because `lightsout
 * work-order show` cannot reach it through the change operations, and two
 * spellings of one refusal would soon name different commands.
 */
export const describeMissingWorkOrder = ({ name }: Params): string =>
	`there is no work order called '${name}' — start one with \`lightsout work-order add-plan --name ${name} --slug <slug>\``;
