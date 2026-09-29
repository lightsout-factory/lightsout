import type { ReactNode } from 'react';
import type { SceneStatus } from '#src/features/home/screens/Home/internal/components/CleansAsItCodesSection/internal/common/constants/SceneStatus.ts';

export interface CapSceneDefinition<TFrame extends { status: SceneStatus }> {
	title: string;
	frames: TFrame[];
	renderGrowing: (frame: TFrame) => ReactNode;
	renderClean: () => ReactNode;
}
