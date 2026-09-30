interface Params {
	runId: string;
}

/**
 * The first eight characters of a run id: the form every lightsout report and
 * screen prints, and the prefix `resume --run` accepts.
 */
export const formatShortRunId = ({ runId }: Params): string => runId.slice(0, 8);
