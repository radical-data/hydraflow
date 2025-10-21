<script lang="ts">
	import { SvelteFlow, Background, Controls, MiniMap } from '@xyflow/svelte';
	import { getNodes, getEdges, setNodes, setEdges, addNode, addEdge } from '../stores/editor.svelte.js';
	import { getAllDefinitions } from '../nodes/registry.js';
	import NodeWrapper from './NodeWrapper.svelte';
	import type { NodeDefinition } from '../types.js';

	const nodeDefinitions = getAllDefinitions();

	const nodeTypes = {
		osc: NodeWrapper,
		out: NodeWrapper
	};
	function addNodeToFlow(definition: NodeDefinition) {
		const nodeId = addNode({
			type: definition.id,
			data: definition.inputs.reduce((acc, input) => {
				acc[input.id] = input.default;
				return acc;
			}, {} as Record<string, any>)
		});
		
		const nodes = getNodes();
		const node = nodes.find((n: any) => n.id === nodeId);
		if (node) {
			const x = Math.random() * 400 + 100;
			const y = Math.random() * 300 + 100;
			(node as any).position = { x, y };
			setNodes([...nodes]);
		}
	}
	function handleBeforeConnect(event: CustomEvent<{ source: string; target: string; sourceHandle?: string; targetHandle?: string }>) {
		const { source, target, sourceHandle, targetHandle } = event.detail;
		
		if (source === target) {
			return false;
		}
		
		addEdge({
			source,
			target,
			sourceHandle,
			targetHandle
		});
		
		return false;
	}
</script>

<div class="flow-editor">
	<div class="toolbar">
		<h2>Hydra Flow</h2>
		<div class="debug-info">
			Nodes: {getNodes().length} | Edges: {getEdges().length}
		</div>
		<div class="node-buttons">
			{#each nodeDefinitions as definition}
				<button 
					onclick={() => addNodeToFlow(definition as NodeDefinition)}
					class="add-node-btn"
				>
					+ {(definition as NodeDefinition).label}
				</button>
			{/each}
		</div>
	</div>
	<div class="flow-canvas">
		<SvelteFlow
			bind:nodes={getNodes, setNodes}
			bind:edges={getEdges, setEdges}
			{nodeTypes}
			on:beforeconnect={handleBeforeConnect}
			fitView
			class="flow-container"
		>
			<Background />
			<Controls />
			<MiniMap />
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
		background: #2196F3;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		transition: background 0.2s;
	}

	.add-node-btn:hover {
		background: #1976D2;
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
