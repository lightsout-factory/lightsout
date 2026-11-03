import type { CapSceneDefinition } from '#src/features/home/components/CleansAsItCodesSection/CapSceneDefinition.ts';
import type { SceneProps } from '#src/features/home/components/CleansAsItCodesSection/SceneProps.ts';
import { SceneStatus } from '#src/features/home/components/CleansAsItCodesSection/SceneStatus.ts';
import { LoopingScene } from '#src/features/home/components/LoopingScene/LoopingScene.tsx';

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
