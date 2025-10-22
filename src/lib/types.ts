export interface InputSchema {
	id: string;
	label: string;
	type: 'number' | 'select' | 'boolean' | 'vec2' | 'vec3' | 'vec4' | 'texture';
	default: any;
	min?: number;
	max?: number;
	step?: number;
	options?: Array<{ value: any; label: string }>;
}

export interface OutputSchema {
	id: string;
	type: 'color';
}

export interface NodeDefinition {
	id: string;
	label: string;
	category: 'source' | 'modifier' | 'mixer' | 'output';
	inputs: InputSchema[];
	outputs: OutputSchema[];
	build: (ctx: HydraBuildCtx, args: Record<string, any>) => HydraChain;
}

export interface HydraBuildCtx {
	generators: typeof import('hydra-ts').generators;
	outputs: import('hydra-ts').Output[];
}

export type HydraChain = import('hydra-ts').Glsl;
export interface IRNode {
	id: string;
	type: string;
	data: Record<string, any>;
	position: { x: number; y: number };
}

export interface IREdge {
	id: string;
	source: string;
	target: string;
	sourceHandle?: string;
	targetHandle?: string;
}

export interface PatchDocument {
	meta: { version: '1'; created: string; modified: string };
	graph: { nodes: IRNode[]; edges: IREdge[] };
	ui?: {
		positions: Record<string, { x: number; y: number }>;
		sizes?: Record<string, { width: number; height: number }>;
		handles?: Record<string, Array<{ type: 'source' | 'target'; x: number; y: number }>>;
		viewport?: { x: number; y: number; zoom: number };
	};
}
