/** The identity git commits under, as the effective config in a checkout answers it. */
export interface GitIdentity {
	/** git's user.name; absent when unset or set to the empty string. */
	name?: string;
	/** git's user.email; absent when unset or set to the empty string. */
	email?: string;
}
