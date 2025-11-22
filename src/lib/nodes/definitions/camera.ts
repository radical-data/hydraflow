import type { NodeDefinition } from '../../types.js';

export const cameraDefinition: NodeDefinition = {
	id: 'camera',
	label: 'Camera',
	category: 'source',
	inputs: [
		{
			id: 'enabled',
			label: 'Enabled',
			type: 'boolean',
			default: true
		}
	],
	outputs: [
		{
			id: 'color',
			type: 'color'
		}
	],
	build: (ctx, args) => {
		const enabled = args.enabled !== false;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const gens = ctx.generators as any;

		if (!enabled) {
			return gens.solid?.(0, 0, 0, 1) ?? null;
		}

		return gens.src?.(0) ?? null;
	}
};
