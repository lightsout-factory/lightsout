import type { StandardsCheckModule } from '@lightsout/standards-contracts';
import { buildFunctionSizeCheck } from '#common/checks/buildFunctionSizeCheck.ts';

export const check: StandardsCheckModule = buildFunctionSizeCheck({
	rule: 'function-size',
	getSizeCap: ({ options }) => ({ cap: options.function, kind: 'function' }),
});
