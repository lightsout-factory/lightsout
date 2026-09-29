import type { LedgerRow } from '#src/contracts/plan/ledger/LedgerRow.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';

interface Params {
	rows: LedgerRow[];
}

/** Carries none of the plan-file bookkeeping, so the mapping a later disposition rewrites holds nothing stale. */
export const seedAcceptanceTests = ({ rows }: Params): AcceptanceTestRecord[] =>
	rows.map(({ criterion, testFile, testName, gate }) => ({ criterion, testFile, testName, gate }));
