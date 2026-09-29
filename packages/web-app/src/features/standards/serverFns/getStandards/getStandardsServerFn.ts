import { createServerFn } from '@tanstack/react-start';
import { getReader } from '#src/lightsout/getReader.ts';

export const getStandardsServerFn = createServerFn({ method: 'GET' }).handler(async () => getReader().getStandards());
