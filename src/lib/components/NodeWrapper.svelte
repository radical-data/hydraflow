<script lang="ts">
	import NodeUI from './NodeUI.svelte';
	import { getAllDefinitions } from '../nodes/registry.js';
	import type { NodeDefinition } from '../types.js';

	let { 
		id, 
		type, 
		data, 
		selected = false, 
		dragging = false,
		updateNodeData
	} = $props<{
		id: string;
		type: string;
		data: Record<string, any>;
		selected?: boolean;
		dragging?: boolean;
		updateNodeData: (nodeId: string, data: Record<string, any>) => void;
	}>();

	const nodeDefinitions = getAllDefinitions();
	const definition = $derived(nodeDefinitions.find(d => d.id === type));

</script>

{#if definition}
	<NodeUI nodeId={id} {definition} {data} {updateNodeData} />
{:else}
	<div class="error-node">
		<p>Unknown node type: {type}</p>
		<p>Available types: {nodeDefinitions.map(d => d.id).join(', ')}</p>
	</div>
{/if}

<style>
	.error-node {
		background: #fee;
		border: 2px solid #f00;
		border-radius: 6px;
		padding: 8px;
		color: #c00;
		font-size: 12px;
	}
</style>
