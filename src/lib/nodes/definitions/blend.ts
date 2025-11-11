import type { HydraChain, NodeDefinition } from '../../types.js';

export const blendDefinition: NodeDefinition = {
	id: 'blend',
	label: 'Blend',
	category: 'mixer',
	inputs: [
		{
			id: 'amount',
			label: 'Amount',
			type: 'number',
			default: 0.5,
			min: 0,
			max: 1,
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
			type: 'blend',
			args: {
				amount: args.amount
			}
		} as HydraChain;
	}
};
