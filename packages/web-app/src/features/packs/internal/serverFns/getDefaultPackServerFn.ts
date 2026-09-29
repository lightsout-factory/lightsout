import { toStandardsPackView } from '@lightsout/engine';
import { createServerFn } from '@tanstack/react-start';
import { getDefaultPackBundle } from '#src/lightsout/common/utils/getDefaultPackBundle.ts';

/**
 * Read from the copy bundled into the app, never from a repo: these are public
 * pages documenting what every repo gets out of the box.
 */
export const getDefaultPackServerFn = createServerFn({ method: 'GET' }).handler(async () => toStandardsPackView({ bundle: getDefaultPackBundle() }));
