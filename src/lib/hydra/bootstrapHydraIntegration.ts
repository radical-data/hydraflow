import { HydraEngine } from '$lib/engine/HydraEngine.js';
import { buildTransformSpecs } from '$lib/engine/transformsCatalog.js';
import { buildTransformMetaFromSpecs } from '$lib/engine/transformSpec.js';
import { autoDefineFromHydra, overrideDefinition } from '$lib/nodes/auto-definitions.js';
import { makeCameraDefinition } from '$lib/nodes/definitions/camera.js';
import { outDefinition } from '$lib/nodes/definitions/out.js';
import type { NodeDefinition } from '$lib/types.js';

export interface HydraIntegrationDeps {
	engine: HydraEngine;
	nodeDefinitions: NodeDefinition[];
}

export async function bootstrapHydraIntegration(): Promise<HydraIntegrationDeps> {
	const hydraModule = await import('hydra-ts');
	const { generators, defaultGenerators, defaultModifiers } = hydraModule;

	const hydraTransforms = [...defaultGenerators, ...defaultModifiers];

	// Specs are now built from the same transform list we pass to the engine
	const specs = buildTransformSpecs(hydraTransforms);
	const meta = buildTransformMetaFromSpecs(specs);
	const engine = new HydraEngine(meta, generators);

	const nodeDefs: NodeDefinition[] = [];

	for (const spec of specs) {
		if (spec.id === 'camera') {
			nodeDefs.push(makeCameraDefinition(spec));
			continue;
		}

		const transform = hydraTransforms.find((t) => t.name === spec.id);
		if (!transform) continue;

		nodeDefs.push(autoDefineFromHydra(transform, spec));
	}

	// Apply overrides (osc, rotate, brightness, etc.)
	const nodeDefsMap = new Map(nodeDefs.map((d) => [d.id, d]));

	// Override osc
	const oscDef = nodeDefsMap.get('osc');
	if (oscDef) {
		nodeDefsMap.set(
			'osc',
			overrideDefinition(oscDef, {
				label: 'Oscillator',
				inputs: [
					{
						id: 'frequency',
						label: 'Frequency',
						type: 'number',
						default: 2,
						min: 0,
						max: 20,
						step: 0.1
					},
					{ id: 'sync', label: 'Sync', type: 'number', default: 0.5, min: 0, max: 2, step: 0.01 },
					{ id: 'offset', label: 'Offset', type: 'number', default: 0, min: 0, max: 2, step: 0.01 }
				]
			})
		);
	}

	// Override rotate
	const rotateDef = nodeDefsMap.get('rotate');
	if (rotateDef) {
		nodeDefsMap.set(
			'rotate',
			overrideDefinition(rotateDef, {
				label: 'Rotate',
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
					{ id: 'speed', label: 'Speed', type: 'number', default: 0, min: -5, max: 5, step: 0.01 }
				]
			})
		);
	}

	// Override kaleid
	const kaleidDef = nodeDefsMap.get('kaleid');
	if (kaleidDef) {
		nodeDefsMap.set(
			'kaleid',
			overrideDefinition(kaleidDef, {
				label: 'Kaleidoscope'
			})
		);
	}

	// Override brightness
	const brightnessDef = nodeDefsMap.get('brightness');
	if (brightnessDef) {
		nodeDefsMap.set(
			'brightness',
			overrideDefinition(brightnessDef, {
				inputs: [
					{
						id: 'amount',
						label: 'Amount',
						type: 'number',
						default: 0.4,
						min: -1,
						max: 1,
						step: 0.01
					}
				]
			})
		);
	}

	// Override contrast
	const contrastDef = nodeDefsMap.get('contrast');
	if (contrastDef) {
		nodeDefsMap.set(
			'contrast',
			overrideDefinition(contrastDef, {
				inputs: [
					{ id: 'amount', label: 'Amount', type: 'number', default: 1.6, min: 0, max: 5, step: 0.1 }
				]
			})
		);
	}

	// Override saturate
	const saturateDef = nodeDefsMap.get('saturate');
	if (saturateDef) {
		nodeDefsMap.set(
			'saturate',
			overrideDefinition(saturateDef, {
				inputs: [
					{ id: 'amount', label: 'Amount', type: 'number', default: 2.0, min: 0, max: 5, step: 0.1 }
				]
			})
		);
	}

	// Add out definition
	nodeDefsMap.set('out', outDefinition);

	return {
		engine,
		nodeDefinitions: Array.from(nodeDefsMap.values())
	};
}
