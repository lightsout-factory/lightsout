import type { Driver } from '#src/common/types/Driver.ts';
import { PiVariant } from '#src/drivers/getDriver/common/constants/PiVariant.ts';
import { createPiFamilyDriver } from '#src/drivers/getDriver/common/createPiFamilyDriver/createPiFamilyDriver.ts';

export const createOmpDriver = (): Driver => createPiFamilyDriver({ name: 'omp', variant: PiVariant.Omp, command: 'omp' });
