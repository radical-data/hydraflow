import { nanoid } from 'nanoid';
import type { IRNode, IREdge } from '../types.js';

// Svelte 5 way: Export reactive state directly
export let nodes = $state.raw<IRNode[]>([]);
export let edges = $state.raw<IREdge[]>([]);

export function addNode(node: Omit<IRNode, 'id'>): string {
	const id = nanoid();
	const newNode: IRNode = { 
		...node, 
		id,
		position: node.position || { x: 0, y: 0 }
	};
	nodes.push(newNode);
	return id;
}

export function updateNodeData(nodeId: string, data: Record<string, any>): void {
	const nodeIndex = nodes.findIndex(node => node.id === nodeId);
	if (nodeIndex !== -1) {
		nodes[nodeIndex] = { ...nodes[nodeIndex], data: { ...nodes[nodeIndex].data, ...data } };
	}
}

export function removeNode(nodeId: string): void {
	const nodeIndex = nodes.findIndex(node => node.id === nodeId);
	if (nodeIndex !== -1) {
		nodes.splice(nodeIndex, 1);
	}
	// Also remove connected edges
	for (let i = edges.length - 1; i >= 0; i--) {
		if (edges[i].source === nodeId || edges[i].target === nodeId) {
			edges.splice(i, 1);
		}
	}
}

export function addEdge(edge: Omit<IREdge, 'id'>): string {
	const id = nanoid();
	const newEdge: IREdge = { ...edge, id };
	edges.push(newEdge);
	return id;
}

export function removeEdge(edgeId: string): void {
	const edgeIndex = edges.findIndex(edge => edge.id === edgeId);
	if (edgeIndex !== -1) {
		edges.splice(edgeIndex, 1);
	}
}

export function getConnectedEdges(nodeId: string): IREdge[] {
	return edges.filter(edge => 
		edge.source === nodeId || edge.target === nodeId
	);
}

export function getNodeConnections(nodeId: string): {
	inputs: IREdge[];
	outputs: IREdge[];
} {
	return {
		inputs: edges.filter(edge => edge.target === nodeId),
		outputs: edges.filter(edge => edge.source === nodeId)
	};
}

export function clearGraph(): void {
	nodes.length = 0;
	edges.length = 0;
}
