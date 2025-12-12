import type { HydraEngine } from '$lib/engine/HydraEngine.js';
import { bootstrapHydraIntegration } from '$lib/hydra/bootstrapHydraIntegration.js';
import type { NodeDefinition } from '$lib/types.js';

export interface ManglAppDeps {
	engine: HydraEngine;
	nodeDefinitions: NodeDefinition[];
}

export async function bootstrapManglApp(): Promise<ManglAppDeps> {
	return bootstrapHydraIntegration();
}
