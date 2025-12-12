import { HydraEngine } from '$lib/engine/HydraEngine.js';
import {
	addCustomSpecsForMeta,
	assertSpecsValid,
	buildHydraTransformSpecs,
	buildMetaFromSpecs,
	buildNodeDefinitionsFromSpecs,
	type Overrides
} from '$lib/engine/transformRegistry.js';
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

	// Define overrides at spec level
	const overrides: Overrides = {
		osc: {
			label: 'Oscillator',
			params: {
				frequency: { label: 'Frequency', default: 2, min: 0, max: 20, step: 0.1 },
				sync: { label: 'Sync', default: 0.5, min: 0, max: 2, step: 0.01 },
				offset: { label: 'Offset', default: 0, min: 0, max: 2, step: 0.01 }
			}
		},
		rotate: {
			label: 'Rotate',
			params: {
				angle: { label: 'Angle', default: 0, min: -Math.PI * 2, max: Math.PI * 2, step: 0.01 },
				speed: { label: 'Speed', default: 0, min: -5, max: 5, step: 0.01 }
			}
		},
		kaleid: {
			label: 'Kaleidoscope'
		},
		brightness: {
			params: {
				amount: { label: 'Amount', default: 0.4, min: -1, max: 1, step: 0.01 }
			}
		},
		contrast: {
			params: {
				amount: { label: 'Amount', default: 1.6, min: 0, max: 5, step: 0.1 }
			}
		},
		saturate: {
			params: {
				amount: { label: 'Amount', default: 2.0, min: 0, max: 5, step: 0.1 }
			}
		}
	};

	// Build specs from Hydra transforms with overrides applied
	// (override validation happens inside buildHydraTransformSpecs)
	const hydraSpecs = buildHydraTransformSpecs(hydraTransforms, overrides);

	// Add custom transform specs (camera, out) for meta/validation only
	// Note: These populate meta; UI definitions come from makeCameraDefinition/outDefinition
	const metaSpecs = addCustomSpecsForMeta(hydraSpecs);

	// Assert specs are valid
	assertSpecsValid(metaSpecs, hydraTransforms);

	// Build meta from metaSpecs (includes camera/out for validation/runtime)
	const meta = buildMetaFromSpecs(metaSpecs);

	// Create engine
	const engine = new HydraEngine(meta, generators);

	// Build node definitions from hydraSpecs only (excludes meta-only specs)
	const nodeDefs = buildNodeDefinitionsFromSpecs(hydraSpecs);

	// Add special node definitions (hand-authored, not generated from specs)
	nodeDefs.push(makeCameraDefinition());
	nodeDefs.push(outDefinition);

	return {
		engine,
		nodeDefinitions: nodeDefs
	};
}
