import { SceneStatus } from '#src/home/HomeScreen/CleansAsItCodesSection/common/constants/SceneStatus.ts';
import { LoopingScene } from '#src/home/HomeScreen/CleansAsItCodesSection/common/LoopingScene/LoopingScene.tsx';
import type { CapSceneDefinition } from '#src/home/HomeScreen/CleansAsItCodesSection/common/types/CapSceneDefinition.ts';
import type { SceneProps } from '#src/home/HomeScreen/CleansAsItCodesSection/common/types/SceneProps.ts';

interface Props<TFrame extends { status: SceneStatus }> extends SceneProps {
	scene: CapSceneDefinition<TFrame>;
}

export const CapScene = <TFrame extends { status: SceneStatus }>({ scene, onFinish }: Props<TFrame>) => (
	<LoopingScene
		title={scene.title}
		frames={scene.frames}
		stepMs={900}
		renderFrame={(frame) => (frame.status === SceneStatus.Clean ? scene.renderClean() : scene.renderGrowing(frame))}
		onFinish={onFinish}
	/>
);
