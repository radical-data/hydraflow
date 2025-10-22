import type { NodeDefinition } from '../types.js';
import { oscDefinition } from './definitions/osc.js';
import { outDefinition } from './definitions/out.js';
import { rotateDefinition } from './definitions/rotate.js';

const nodeDefinitions = new Map<string, NodeDefinition>();

export function registerNodeDefinition(definition: NodeDefinition): void {
	nodeDefinitions.set(definition.id, definition);
}

export function getNodeDefinition(id: string): NodeDefinition | undefined {
	return nodeDefinitions.get(id);
}

export function getAllDefinitions(): NodeDefinition[] {
	return Array.from(nodeDefinitions.values());
}

export function getDefinitionsByCategory(category: NodeDefinition['category']): NodeDefinition[] {
	return getAllDefinitions().filter(def => def.category === category);
}

registerNodeDefinition(oscDefinition);
registerNodeDefinition(outDefinition);
registerNodeDefinition(rotateDefinition);
