<script lang="ts">
	import { Background, Controls, MiniMap, Panel, SvelteFlow } from '@xyflow/svelte';
	import { setContext } from 'svelte';

	import { getAllDefinitions } from '../nodes/registry.js';
	import type { InputValue, IREdge, IRNode, NodeDefinition } from '../types.js';
	import { getLayoutedElements } from '../utils/layout.js';
	import CustomNode from './CustomNode.svelte';

	let {
		nodes = $bindable(),
		edges = $bindable(),
		addNode,
		updateNodeData
	} = $props<{
		nodes: IRNode[];
		edges: IREdge[];
		addNode: (node: Omit<IRNode, 'id'>) => string;
		updateNodeData: (nodeId: string, data: Record<string, InputValue>) => void;
	}>();

	const nodeDefinitions = getAllDefinitions();

	setContext('updateNodeData', updateNodeData);

	const nodeTypes = {
		osc: CustomNode,
		out: CustomNode,
		rotate: CustomNode,
		blend: CustomNode,
		noise: CustomNode
	};
	function addNodeToFlow(definition: NodeDefinition) {
		const x = Math.random() * 400 + 100;
		const y = Math.random() * 300 + 100;

		addNode({
			type: definition.id,
			data: definition.inputs.reduce(
				(acc, input) => {
					acc[input.id] = input.default;
					return acc;
				},
				{} as Record<string, InputValue>
			),
			position: { x, y }
		});
	}

	function onLayout(direction: 'TB' | 'LR') {
		const layouted = getLayoutedElements(nodes, edges, direction);
		nodes = [...layouted.nodes];
		edges = [...layouted.edges];
	}
</script>

<div class="flow-editor">
	<div class="toolbar">
		<h2>Hydra Flow</h2>
		<div class="debug-info">
			Nodes: {nodes.length} | Edges: {edges.length}
		</div>
		<div class="node-buttons">
			{#each nodeDefinitions as definition (definition.id)}
				<button onclick={() => addNodeToFlow(definition as NodeDefinition)} class="add-node-btn">
					+ {(definition as NodeDefinition).label}
				</button>
			{/each}
		</div>
	</div>
	<div class="flow-canvas">
		<SvelteFlow bind:nodes bind:edges {nodeTypes} fitView class="flow-container">
			<Background />
			<Controls />
			<MiniMap />
			<Panel position="top-right">
				<div class="layout-buttons">
					<button onclick={() => onLayout('TB')} class="layout-btn"> Vertical </button>
					<button onclick={() => onLayout('LR')} class="layout-btn"> Horizontal </button>
				</div>
			</Panel>
		</SvelteFlow>
	</div>
</div>

<style>
	.flow-editor {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.1);
		backdrop-filter: blur(2px);
		display: flex;
		flex-direction: column;
	}

	.toolbar {
		background: rgba(255, 255, 255, 0.9);
		padding: 12px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		display: flex;
		align-items: center;
		gap: 16px;
		backdrop-filter: blur(4px);
	}

	.toolbar h2 {
		margin: 0;
		font-size: 18px;
		color: #333;
	}

	.debug-info {
		font-size: 12px;
		color: #666;
		margin: 4px 0;
	}

	.node-buttons {
		display: flex;
		gap: 8px;
	}

	.add-node-btn {
		padding: 6px 12px;
		background: #2196f3;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		transition: background 0.2s;
	}

	.add-node-btn:hover {
		background: #1976d2;
	}

	.layout-buttons {
		display: flex;
		gap: 8px;
		background: rgba(255, 255, 255, 0.95);
		padding: 12px;
		border-radius: 8px;
		backdrop-filter: blur(4px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.layout-btn {
		padding: 8px 12px;
		background: #4caf50;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
		transition: all 0.2s;
	}

	.layout-btn:hover {
		background: #45a049;
		transform: translateY(-1px);
	}

	.flow-canvas {
		flex: 1;
		position: relative;
	}

	/* SvelteFlow overrides for transparency and smaller nodes */
	:global(.svelte-flow) {
		background: transparent !important;
	}

	:global(.svelte-flow__background) {
		opacity: 0.3;
	}

	:global(.svelte-flow__controls) {
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(4px);
	}

	:global(.svelte-flow__minimap) {
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(4px);
	}
</style>
