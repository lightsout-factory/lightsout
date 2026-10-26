import { expect, test } from '@jest/globals';
import { readRepoFileGlobs } from '#src/common/config/readRepoFileGlobs.ts';
import { defaultSourceFileGlobs } from '#src/common/constants/defaultSourceFileGlobs.ts';
import { defaultTestFileGlobs } from '#src/common/constants/defaultTestFileGlobs.ts';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

const gates = { check: 'c', test: 't', 'test-coverage': false };

test('readRepoFileGlobs: a config that sets neither list reads the JS/TS defaults, and so does no config at all', () => {
	const unset = readRepoFileGlobs({ config: LightsoutConfig.parse({ gates }) });

	expect({ unset, absent: readRepoFileGlobs({ config: undefined }) }).toStrictEqual({
		unset: { source: defaultSourceFileGlobs, tests: defaultTestFileGlobs },
		absent: { source: defaultSourceFileGlobs, tests: defaultTestFileGlobs },
	});
});

test('readRepoFileGlobs: a list the config sets replaces its default whole, and the other keeps its own', () => {
	const config = LightsoutConfig.parse({ gates, 'source-files': ['app/**/*.py'] });

	expect(readRepoFileGlobs({ config })).toStrictEqual({ source: ['app/**/*.py'], tests: defaultTestFileGlobs });
});
