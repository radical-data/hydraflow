import type { IREdge, IRNode } from '$lib/types.js';

export type ExamplePatch = {
	id: string;
	title: string;
	description?: string;
	nodes: IRNode[];
	edges: IREdge[];
};
