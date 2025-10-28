import { nanoid } from 'nanoid';

import type { InputValue, IREdge, IRNode } from '../types.js';

export let nodes = $state.raw<IRNode[]>([]);
export let edges = $state.raw<IREdge[]>([]);

export function addNode(node: Omit<IRNode, 'id'>): string {
	const id = nanoid();
	const newNode: IRNode = {
		...node,
		id,
		position: node.position || { x: 0, y: 0 }
	};
	nodes = [...nodes, newNode];
	return id;
}

export function updateNodeData(nodeId: string, data: Record<string, InputValue>): void {
	nodes = nodes.map((node) =>
		node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
	);
}

export function removeNode(nodeId: string): void {
	nodes = nodes.filter((node) => node.id !== nodeId);
	edges = edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
}

export function addEdge(edge: Omit<IREdge, 'id'>): string {
	const id = nanoid();
	const newEdge: IREdge = { ...edge, id };
	edges = [...edges, newEdge];
	return id;
}

export function removeEdge(edgeId: string): void {
	edges = edges.filter((edge) => edge.id !== edgeId);
}

export function getConnectedEdges(nodeId: string): IREdge[] {
	return edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
}

export function getNodeConnections(nodeId: string): {
	inputs: IREdge[];
	outputs: IREdge[];
} {
	return {
		inputs: edges.filter((edge) => edge.target === nodeId),
		outputs: edges.filter((edge) => edge.source === nodeId)
	};
}

export function clearGraph(): void {
	nodes = [];
	edges = [];
}
