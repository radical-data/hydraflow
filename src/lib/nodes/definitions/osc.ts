import type { NodeDefinition } from '../../types.js';

export const oscDefinition: NodeDefinition = {
	id: 'osc',
	label: 'Oscillator',
	category: 'source',
	inputs: [
		{
			id: 'frequency',
			label: 'Frequency',
			type: 'number',
			default: 2.0,
			min: 0,
			max: 20,
			step: 0.1
		},
		{
			id: 'sync',
			label: 'Sync',
			type: 'number',
			default: 0.5,
			min: 0,
			max: 2,
			step: 0.01
		},
		{
			id: 'offset',
			label: 'Offset',
			type: 'number',
			default: 0,
			min: 0,
			max: 2,
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
		return generators.osc(args.frequency, args.sync, args.offset);
	}
};
