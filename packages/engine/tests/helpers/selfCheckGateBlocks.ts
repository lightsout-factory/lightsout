import { gateLogCommand } from '#tests/helpers/gateLogCommand.ts';

/**
 * The root `gates` block and scoped `package-gates` block a self-check repo
 * configures by default. Each root gate logs "root <kind>" and each scoped
 * template logs "<package name> <kind>", so which gates ran, and at what
 * scope, is read off gates.log.
 */
export const selfCheckGateBlocks: { gates: Record<string, string | false>; packageGates: Record<string, string> } = {
	gates: {
		check: `${gateLogCommand({ kind: 'check' })} root`,
		test: `${gateLogCommand({ kind: 'test' })} root`,
		'test-coverage': `${gateLogCommand({ kind: 'coverage' })} root`,
		build: `${gateLogCommand({ kind: 'build' })} root`,
		'test-e2e': `${gateLogCommand({ kind: 'e2e' })} root`,
	},
	packageGates: {
		check: `${gateLogCommand({ kind: 'check' })} {package}`,
		test: `${gateLogCommand({ kind: 'test' })} {package}`,
		'test-coverage': `${gateLogCommand({ kind: 'coverage' })} {package}`,
		build: `${gateLogCommand({ kind: 'build' })} {package}`,
		'test-e2e': `${gateLogCommand({ kind: 'e2e' })} {package}`,
	},
};
