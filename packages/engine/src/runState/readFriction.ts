import { readJsonlRecords } from '#src/common/readJsonlRecords.ts';
import { FrictionRecord } from '#src/contracts/friction/FrictionRecord.ts';
import { getFrictionPath } from '#src/runState/common/getFrictionPath.ts';

interface Params {
	cwd: string;
}

export const readFriction = async ({ cwd }: Params): Promise<FrictionRecord[]> =>
	readJsonlRecords({ path: await getFrictionPath({ cwd }), schema: FrictionRecord });
