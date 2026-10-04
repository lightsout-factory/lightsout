import { workOrderStateFileName } from '#src/common/constants/workOrderStateFileName.ts';

/**
 * `sync` names the bytes last published or restored; `published` is surfaced
 * when both copies have moved; `lock` guards every write to the record.
 */
export const workOrderFileNames = {
	record: workOrderStateFileName,
	sync: 'state-sync.json',
	published: 'state.published.json',
	lock: 'state.lock',
} as const;
