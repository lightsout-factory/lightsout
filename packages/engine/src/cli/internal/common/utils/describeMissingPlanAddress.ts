interface Params {
	/** The `--name` value exactly as the user gave it. */
	name: string;
	/** What the address would have named, completing 'so there is no …' — e.g. 'plan to act on'. */
	missing: string;
}

/** Shared so the two commands that refuse a bare name cannot drift into stating two different address shapes. */
export const describeMissingPlanAddress = ({ name, missing }: Params): string =>
	`'${name}' is not a plan address, so there is no ${missing} — a plan of a work order is addressed as '<work-order-name>/<plan-id>', and \`lightsout work-order show --name ${name}\` lists the plans that work order holds`;
