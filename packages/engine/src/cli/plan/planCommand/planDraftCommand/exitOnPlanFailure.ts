import { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import { exitCli } from '#src/common/exitCli.ts';

interface PlanRunFailure {
	status: 'failed' | 'paused-rate-limit';
	error: string;
}

// A type predicate because TypeScript subtracts nothing from a type parameter on
// a false branch; asking the positive question lets the caller narrow without asserting.
const survivesPlanFailure = <Result extends { status: string }>(result: Result): result is Exclude<Result, PlanRunFailure> =>
	result.status !== PlanRunStatus.Failed && result.status !== PlanRunStatus.PausedRateLimit;

// Any `{ status }` shape is accepted, so a failure variant may carry no `error`;
// the fallback prints instead of the word `undefined`.
const planFailureMessageOf = ({ result }: { result: { status: string } }) =>
	'error' in result && typeof result.error === 'string' ? result.error : `plan run ${result.status}`;

interface Params<Result extends { status: string }> {
	result: Result;
}

/**
 * Returns the narrowed result rather than asserting it, because the exit drains
 * the stdio pipes (see exitCli) and assertion signatures must be synchronous.
 */
export const exitOnPlanFailure = async <Result extends { status: string }>({ result }: Params<Result>): Promise<Exclude<Result, PlanRunFailure>> => {
	if (survivesPlanFailure(result)) {
		return result;
	}

	console.error(`\n${planFailureMessageOf({ result })}`);

	return exitCli({ code: 1 });
};
