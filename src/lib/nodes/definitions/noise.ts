import type { NodeDefinition } from '../../types.js';

export const noiseDefinition: NodeDefinition = {
	id: 'noise',
	label: 'Noise',
	category: 'source',
	inputs: [
		{
			id: 'scale',
			label: 'Scale',
			type: 'number',
			default: 4.0,
			min: 0.1,
			max: 20,
			step: 0.1
		},
		{
			id: 'offset',
			label: 'Offset',
			type: 'number',
			default: 0,
			min: 0,
			max: 10,
			step: 0.01
		}
	],
	outputs: [
		{
			id: 'color',
			type: 'color'
		}
	],
	build: (ctx, args) => {
		const { generators } = ctx;
		return generators.noise(args.scale, args.offset);
	}
};
