/**
 * The members are inline because every caller narrows with
 * `'coordination' in outcome`, so a name for each would be an export with no
 * reader.
 */
export type GateLockOutcome<Result> =
	| {
			held: Result;
	  }
	| {
			/** The sentence a caller reports instead of a red gate. */
			coordination: string;
	  };
