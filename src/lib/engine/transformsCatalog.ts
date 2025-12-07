import type { TransformDefinition } from 'hydra-ts';

import type { TransformSpec } from './transformSpec.js';

function arityForType(type: TransformDefinition['type']): 0 | 1 | 2 {
	if (type === 'src') return 0;
	if (type === 'coord' || type === 'color') return 1;
	return 2; // 'combine' | 'combineCoord'
}

// Pure helper: builds TransformSpec[] from TransformDefinition[]
export function buildTransformSpecs(hydraTransforms: TransformDefinition[]): TransformSpec[] {
	const specs: TransformSpec[] = hydraTransforms
		// Skip special ones; keep this list in *this* file only
		// TODO: Fix shift node definition
		.filter((t) => !['src', 'out', 'render', 'shift'].includes(t.name))
		.map((t) => ({
			id: t.name,
			type: t.type,
			arity: arityForType(t.type),
			inputNames: t.inputs.map((i) => i.name)
		}));

	// Custom camera transform
	specs.push({
		id: 'camera',
		type: 'src',
		arity: 0,
		inputNames: []
	});

	return specs;
}
