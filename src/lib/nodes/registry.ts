import type { NodeDefinition } from '../types.js';
import { generateAllDefinitions, overrideDefinition } from './auto-definitions.js';
import { cameraDefinition } from './definitions/camera.js';
import { outDefinition } from './definitions/out.js';
let nodeDefinitions: Map<string, NodeDefinition> | null = null;
let initPromise: Promise<void> | null = null;

async function initializeRegistry(): Promise<void> {
	if (nodeDefinitions) return;

	const autoDefinitions = await generateAllDefinitions();
	nodeDefinitions = new Map<string, NodeDefinition>(autoDefinitions);

	nodeDefinitions.set('camera', cameraDefinition);
	// Override nodes with custom UX
	nodeDefinitions.set(
		'osc',
		overrideDefinition(autoDefinitions.get('osc')!, {
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

	nodeDefinitions.set(
		'rotate',
		overrideDefinition(autoDefinitions.get('rotate')!, {
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

	nodeDefinitions.set(
		'kaleid',
		overrideDefinition(autoDefinitions.get('kaleid')!, {
			label: 'Kaleidoscope'
		})
	);

	nodeDefinitions.set(
		'brightness',
		overrideDefinition(autoDefinitions.get('brightness')!, {
			inputs: [
				{ id: 'amount', label: 'Amount', type: 'number', default: 0.4, min: -1, max: 1, step: 0.01 }
			]
		})
	);

	nodeDefinitions.set(
		'contrast',
		overrideDefinition(autoDefinitions.get('contrast')!, {
			inputs: [
				{ id: 'amount', label: 'Amount', type: 'number', default: 1.6, min: 0, max: 5, step: 0.1 }
			]
		})
	);

	nodeDefinitions.set(
		'saturate',
		overrideDefinition(autoDefinitions.get('saturate')!, {
			inputs: [
				{ id: 'amount', label: 'Amount', type: 'number', default: 2.0, min: 0, max: 5, step: 0.1 }
			]
		})
	);

	nodeDefinitions.set('out', outDefinition);

	//TODO: Fix shift node definition
	nodeDefinitions.delete('shift');
}

async function ensureInitialized(): Promise<void> {
	if (!initPromise) {
		initPromise = initializeRegistry();
	}
	await initPromise;
}

export async function registerNodeDefinition(definition: NodeDefinition): Promise<void> {
	await ensureInitialized();
	nodeDefinitions!.set(definition.id, definition);
}

export async function getNodeDefinition(id: string): Promise<NodeDefinition | undefined> {
	await ensureInitialized();
	return nodeDefinitions!.get(id);
}

export async function getAllDefinitions(): Promise<NodeDefinition[]> {
	await ensureInitialized();
	return Array.from(nodeDefinitions!.values());
}

export async function getDefinitionsByCategory(
	category: NodeDefinition['category']
): Promise<NodeDefinition[]> {
	const all = await getAllDefinitions();
	return all.filter((def) => def.category === category);
}
