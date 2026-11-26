/**
 * @jest-environment node
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from '@jest/globals';
import type { QueueView } from '@lightsout/engine';
import { isNotFound } from '@tanstack/react-router';
import { getQueueViewServerFn } from '#src/features/queue/server/getQueueViewServerFn.ts';

interface Outcome {
	view?: QueueView;
	notFound?: boolean;
}

/**
 * A repo whose queue never ran, named through LIGHTSOUT_REPO — the only seam a
 * test has on the repo root — and, for the public site, the deployment flag set.
 * Under Jest the Start stub hands `handler()` straight back, so this is the real handler.
 */
const setupQueueView = async ({ publicSite = false }: { publicSite?: boolean } = {}) => {
	const repoRoot = await mkdtemp(join(tmpdir(), 'lightsout-queue-view-'));

	process.env.LIGHTSOUT_REPO = repoRoot;

	if (publicSite) {
		process.env.LIGHTSOUT_PUBLIC = '1';
	}

	return { getQueueView: getQueueViewServerFn as unknown as () => Promise<QueueView> };
};

/** What the server function answered, or whether what it threw was the router's not-found signal. */
const settle = async (read: () => Promise<QueueView>): Promise<Outcome> => {
	try {
		return { view: await read() };
	} catch (refusal) {
		return { notFound: isNotFound(refusal) };
	}
};

afterEach(() => {
	delete process.env.LIGHTSOUT_REPO;
	delete process.env.LIGHTSOUT_PUBLIC;
});

/** The open repo answers its queue view; the public site answers the router's not-found. */
const queueViewCases: { publicSite: boolean; expected: Outcome }[] = [
	{ publicSite: false, expected: { view: { drain: undefined } } },
	{ publicSite: true, expected: { notFound: true } },
];

describe('getQueueViewServerFn', () => {
	test.each(queueViewCases)("answers the open repo's queue view, and refuses with not-found on the public site", async ({ publicSite, expected }) => {
		const { getQueueView } = await setupQueueView({ publicSite });

		const outcome = await settle(getQueueView);

		expect(outcome).toEqual(expected);
	});
});
