import { GateTier } from '#src/gates/common/constants/GateTier.ts';

const cheapFamilies = new Set(['check', 'test', 'testCoverage']);

interface Params {
	family: string;
}

export const gateTierOf = ({ family }: Params): GateTier => (cheapFamilies.has(family) ? GateTier.Cheap : GateTier.Expensive);
