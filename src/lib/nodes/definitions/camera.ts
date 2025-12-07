import type { TransformSpec } from '../../engine/transformSpec.js';
import type { NodeDefinition } from '../../types.js';

export function makeCameraDefinition(spec: TransformSpec): NodeDefinition {
	return {
		id: spec.id,
		label: 'Camera',
		category: 'source',
		inputs: [],
		outputs: [{ id: 'color', type: 'color' }],
		spec,
		build: (ctx) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const gens = ctx.generators as any;
			return gens.src?.(0) ?? null;
		}
	};
}
