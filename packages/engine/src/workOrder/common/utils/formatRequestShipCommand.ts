interface Params {
	/** The work order's label. */
	name: string;
	planIds: string[];
}

/** The command that asks for a multiple-plan work order to ship with exactly these plans, so the merge refusal and the `show` line name the same one. */
export const formatRequestShipCommand = ({ name, planIds }: Params): string => `lightsout work-order request-ship --name ${name} --plans ${planIds.join(',')}`;
