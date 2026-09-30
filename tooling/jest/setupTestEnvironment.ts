import { join } from 'node:path';
import { afterEach, jest } from '@jest/globals';

// The authored standards package rather than the committed build copy under
// plugin/, which the engine's own walk would find: otherwise tests pass or fail
// on whether someone last ran `pnpm bundle`. Set on process.env because the e2e
// suites reach the engine as a subprocess, which inherits only the environment.
process.env.LIGHTSOUT_DEFAULT_STANDARDS = join(__dirname, '..', '..', 'packages', 'lightsout-standards');

// A queue worker exports LIGHTSOUT_NO_SHIP=1 to every gate command it runs,
// and it silently beats both --ship and the config, so a test expecting a ship
// would fail inside the queue only.
delete process.env.LIGHTSOUT_NO_SHIP;

// Captured before any test file loads (setupFilesAfterEnv runs first), so these
// are the pristine process values.
const realIsTty = process.stdout.isTTY;
const realPath = process.env.PATH;

// clearMocks/restoreMocks put every spy back, but these four are not mock state,
// so they are restored here rather than in per-test hooks.
//
// jest.replaceProperty is not an option for isTTY: it is not an own property of
// process.stdout when stdout is piped, which is every Jest worker.
afterEach(() => {
	jest.useRealTimers();
	process.stdout.isTTY = realIsTty;
	process.env.PATH = realPath;
	delete process.env.LIGHTSOUT_NO_SHIP;
});
