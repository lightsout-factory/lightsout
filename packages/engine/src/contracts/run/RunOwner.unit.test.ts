import { describe, expect, test } from '@jest/globals';
import { RunOwner } from '#src/contracts/run/RunOwner.ts';

/** The process form an engine writes for itself as a family root's owner. */
const setupProcessOwner = () => {
	const recordedAt = '2026-09-28T10:00:05.000Z';
	const withStartTime = { pid: 42, processStartTime: 'Mon Sep 28 10:00:00 2026', recordedAt };
	const withoutStartTime = { pid: 42, recordedAt };
	const fractionalPid = { pid: 4.5, processStartTime: 'Mon Sep 28 10:00:00 2026', recordedAt };

	return { withStartTime, withoutStartTime, fractionalPid };
};

/** The pointer form a queue worker's run carries, beside records that are neither form. */
const setupPointerOwner = () => {
	const pointer = { queueRunId: 'q-1' };
	const empty = {};
	const recordedAtOnly = { recordedAt: '2026-09-28T10:00:05.000Z' };

	return { pointer, empty, recordedAtOnly };
};

describe('RunOwner', () => {
	test('parses the process form with or without a start time and rejects a fractional pid', () => {
		const { withStartTime, withoutStartTime, fractionalPid } = setupProcessOwner();

		const parsed = {
			withStartTime: RunOwner.safeParse(withStartTime),
			withoutStartTime: RunOwner.safeParse(withoutStartTime),
			fractionalPid: RunOwner.safeParse(fractionalPid),
		};

		// an unreadable start time leaves the key off, and the pid is held to the
		// whole number the OS issues or the liveness check is meaningless
		expect({
			withStartTime: parsed.withStartTime.data,
			withoutStartTime: parsed.withoutStartTime.data,
			fractionalPidAccepted: parsed.fractionalPid.success,
		}).toStrictEqual({
			withStartTime: { pid: 42, processStartTime: 'Mon Sep 28 10:00:00 2026', recordedAt: '2026-09-28T10:00:05.000Z' },
			withoutStartTime: { pid: 42, recordedAt: '2026-09-28T10:00:05.000Z' },
			fractionalPidAccepted: false,
		});
	});

	test('parses the queue-worker pointer form and rejects a record that is neither form', () => {
		const { pointer, empty, recordedAtOnly } = setupPointerOwner();

		const parsed = {
			pointer: RunOwner.safeParse(pointer),
			empty: RunOwner.safeParse(empty),
			recordedAtOnly: RunOwner.safeParse(recordedAtOnly),
		};

		// a worker's run names the queue run whose own owner answers for it; a record
		// with neither a pid nor a queue run id names no owner at all
		expect({
			pointer: parsed.pointer.data,
			emptyAccepted: parsed.empty.success,
			recordedAtOnlyAccepted: parsed.recordedAtOnly.success,
		}).toStrictEqual({
			pointer: { queueRunId: 'q-1' },
			emptyAccepted: false,
			recordedAtOnlyAccepted: false,
		});
	});
});
