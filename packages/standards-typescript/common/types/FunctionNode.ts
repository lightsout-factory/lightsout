import type ts from 'typescript';

export interface FunctionNode {
	/** Its own name, the variable it is assigned to, or `(anonymous)` when neither exists. */
	name: string;
	/** 1-based line the function starts on. */
	startLine: number;
	/** 1-based line it ends on. */
	endLine: number;
	/** The body — a block, or the single expression an arrow function returns. */
	body: ts.Node;
}
