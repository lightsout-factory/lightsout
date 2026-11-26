/**
 * @jest-environment node
 */
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { isNotFound } from '@tanstack/react-router';
import { getReader } from '#src/server/getReader.ts';
import type { LightsoutReader } from '#src/server/LightsoutReader.ts';

/**
 * An empty repo pointed at through LIGHTSOUT_REPO — the only seam a test has on
 * the repo root.
 */
const setupReader = async (): Promise<{ reader: LightsoutReader }> => {
	const repoRoot = await mkdtemp(join(tmpdir(), 'lightsout-reader-'));

	process.env.LIGHTSOUT_REPO = repoRoot;

	return { reader: getReader() };
};

/** No repo named and none above the working directory — a local server started in the wrong folder. */
const setupNoRepo = () => {
	jest.spyOn(process, 'cwd').mockReturnValue(tmpdir());
};

/** What `getReader` threw, so a test can assert on a refusal that is not always an `Error`. */
const catchRefusal = (): unknown => {
	try {
		getReader();
	} catch (error) {
		return error;
	}

	throw new Error('getReader returned a reader where it should have refused');
};

afterEach(() => {
	delete process.env.LIGHTSOUT_REPO;
	delete process.env.LIGHTSOUT_PUBLIC;
});

describe('getReader where no repo may be read', () => {
	test("refuses on the public site with the router's not-found signal, even inside a checkout", async () => {
		await setupReader();
		process.env.LIGHTSOUT_PUBLIC = '1';

		const refusal = catchRefusal();

		expect(isNotFound(refusal)).toBe(true);
	});

	test('names the fix when a local server was started outside any lightsout repo', () => {
		setupNoRepo();

		const refusal = catchRefusal();

		expect(refusal).toStrictEqual(expect.objectContaining({ message: expect.stringMatching(/No lightsout\.config\.json was found in .* set LIGHTSOUT_REPO/) }));
	});
});
