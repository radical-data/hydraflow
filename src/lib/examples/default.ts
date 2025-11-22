import type { ExamplePatch } from './types.js';

export const defaultExample: ExamplePatch = {
	id: 'default-blend-rotate',
	title: 'Blend + Rotate',
	description: 'Two sources blended, then rotated into Output 0.',
	nodes: [
		{
			id: 'osc-1',
			type: 'osc',
			data: { frequency: 5.0, sync: 0.5, offset: 0.5 },
			position: { x: 100, y: 50 }
		},
		{
			id: 'noise-1',
			type: 'noise',
			data: { scale: 4.0, offset: 0 },
			position: { x: 100, y: 150 }
		},
		{
			id: 'blend-1',
			type: 'blend',
			data: { amount: 0.5 },
			position: { x: 250, y: 100 }
		},
		{
			id: 'rotate-1',
			type: 'rotate',
			data: { angle: 0.5, speed: 0.1 },
			position: { x: 400, y: 100 }
		},
		{
			id: 'out-1',
			type: 'out',
			data: { outputIndex: 0 },
			position: { x: 550, y: 100 }
		}
	],
	edges: [
		{
			id: 'edge-1',
			source: 'osc-1',
			target: 'blend-1',
			sourceHandle: 'output-0',
			targetHandle: 'input-0'
		},
		{
			id: 'edge-2',
			source: 'noise-1',
			target: 'blend-1',
			sourceHandle: 'output-0',
			targetHandle: 'input-1'
		},
		{
			id: 'edge-3',
			source: 'blend-1',
			target: 'rotate-1',
			sourceHandle: 'output-0',
			targetHandle: 'input-0'
		},
		{
			id: 'edge-4',
			source: 'rotate-1',
			target: 'out-1',
			sourceHandle: 'output-0',
			targetHandle: 'input-0'
		}
	]
};
