import type { NodeDefinition } from '../../types.js';

export function makeCameraDefinition(): NodeDefinition {
	return {
		id: 'camera',
		label: 'Camera',
		category: 'source',
		inputs: [],
		outputs: [{ id: 'color', type: 'color' }]
	};
}
