import type { NodeDefinition } from '../../types.js';

export const cameraDefinition: NodeDefinition = {
	id: 'camera',
	label: 'Camera',
	category: 'source',
	inputs: [],
	outputs: [
		{
			id: 'color',
			type: 'color'
		}
	],
	build: (ctx) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const gens = ctx.generators as any;
		return gens.src?.(0) ?? null;
	}
};
