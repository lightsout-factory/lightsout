// `stderr` is empty when the process said nothing, and the caller then appends
// nothing rather than a bare colon.
export interface ShipStepFailure {
	stderr: string;
	/**
	 * Set only by `mergePullRequest`, and only when the forge's own structured
	 * state proved a newer base is the whole problem. Unset means the failure is
	 * final — an absent flag can never be read as "worth another attempt".
	 */
	staleBase?: boolean;
}
