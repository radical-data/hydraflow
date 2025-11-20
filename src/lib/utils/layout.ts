import Dagre from '@dagrejs/dagre';

import type { IREdge, IRNode } from '../types.js';

const nodeWidth = 180;
const nodeHeight = 120;

export function getLayoutedElements(
	nodes: IRNode[],
	edges: IREdge[],
	direction: 'TB' = 'TB'
): { nodes: IRNode[]; edges: IREdge[] } {
	const dagreGraph = new Dagre.graphlib.Graph();
	dagreGraph.setDefaultEdgeLabel(() => ({}));

	dagreGraph.setGraph({
		rankdir: direction,
		nodesep: 80,
		ranksep: 120,
		marginx: 50,
		marginy: 50,
		align: 'UL',
		edgesep: 10
	});

	nodes.forEach((node) => {
		dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
	});

	edges.forEach((edge) => {
		dagreGraph.setEdge(edge.source, edge.target);
	});

	Dagre.layout(dagreGraph);

	const layoutedNodes: IRNode[] = nodes.map((node) => {
		const nodeWithPosition = dagreGraph.node(node.id);

		return {
			...node,
			position: {
				x: nodeWithPosition.x - nodeWidth / 2,
				y: nodeWithPosition.y - nodeHeight / 2
			},
			sourcePosition: 'bottom' as const,
			targetPosition: 'top' as const
		};
	});

	return { nodes: layoutedNodes, edges };
}
