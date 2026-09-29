interface ConstructorParams {
	name: string;
}

/** The name itself is the mistake, which is why a server function turns this into a 404 rather than a 500. */
export class PlanWorkspaceNotFoundError extends Error {
	constructor({ name }: ConstructorParams) {
		super(`no plan workspace named "${name}"`);
		this.name = 'PlanWorkspaceNotFoundError';
	}
}
