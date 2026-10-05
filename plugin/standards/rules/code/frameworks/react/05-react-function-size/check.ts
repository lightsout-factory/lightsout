import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import { buildFunctionSizeCheck } from '#common/checks/buildFunctionSizeCheck.ts';
import type { FunctionSizeCap } from '#common/types/FunctionSizeCap.ts';

/** The name decides before the file does: a `use`-prefixed function in a `.tsx` file is a hook, not a component. */
const getSizeCap = ({ name, path, options }: { name: string; path: string; options: Record<string, number> }): FunctionSizeCap => {
	let sized = { cap: options.function, kind: 'function' };

	if (/^use[A-Z]/.test(name)) {
		sized = { cap: options.hook, kind: 'hook' };
	} else if (path.endsWith('.tsx') && /^[A-Z]/.test(name)) {
		sized = { cap: options.component, kind: 'component' };
	}

	return sized;
};

export const check: StandardsCheckModule = buildFunctionSizeCheck({ rule: 'react-function-size', getSizeCap });
