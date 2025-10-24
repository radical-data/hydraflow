import type { NodeDefinition } from '../../types.js';

export const outDefinition: NodeDefinition = {
	id: 'out',
	label: 'Output',
	category: 'output',
	inputs: [
		{
			id: 'outputIndex',
			label: 'Output',
			type: 'select',
			default: 0,
			options: [
				{ value: 0, label: 'Output 0' },
				{ value: 1, label: 'Output 1' },
				{ value: 2, label: 'Output 2' },
				{ value: 3, label: 'Output 3' }
			]
		}
	],
	outputs: [],
	build: (ctx, args) => {
		const { outputs } = ctx;
		const outputIndex = args.outputIndex || 0;
		return outputs[outputIndex];
	}
};
