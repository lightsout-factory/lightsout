import type { Framework } from '#src/common/constants/Framework.ts';

export interface ChannelFace {
	name: string;
	framework?: Framework;
	activation: string;
}
