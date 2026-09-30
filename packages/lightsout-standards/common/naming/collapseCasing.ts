interface Params {
	name: string;
}

/**
 * Two names identical once casing and separators are dropped (`GetStarted` vs
 * `get-started`) are one concept spelled for two conventions, not two names in
 * conflict.
 *
 * @mirrors packages/engine/src/plan/internal/common/naming/collapseCasing.ts
 */
export const collapseCasing = ({ name }: Params): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');
