import type { HydraChain, NodeDefinition } from '../../types.js';

export const rotateDefinition: NodeDefinition = {
	id: 'rotate',
	label: 'Rotate',
	category: 'modifier',
	inputs: [
		{
			id: 'angle',
			label: 'Angle',
			type: 'number',
			default: 0,
			min: -Math.PI * 2,
			max: Math.PI * 2,
			step: 0.01
		},
		{
			id: 'speed',
			label: 'Speed',
			type: 'number',
			default: 0,
			min: -5,
			max: 5,
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
		return {
			type: 'rotate',
			args: {
				angle: args.angle,
				speed: args.speed
			}
		} as HydraChain;
	}
};
