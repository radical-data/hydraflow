<script lang="ts">
	import { getContext } from 'svelte';

	import type { InputValue, NodeDefinition } from '../types.js';
	import NodeUI from './NodeUI.svelte';

	let { id, type, data, updateNodeData } = $props<{
		id: string;
		type: string;
		data: Record<string, InputValue>;
		updateNodeData: (nodeId: string, data: Record<string, InputValue>) => void;
	}>();

	// Get node definitions from context (reactive)
	const getNodeDefinitions = getContext<() => NodeDefinition[]>('nodeDefinitions');
	const definition = $derived(getNodeDefinitions().find((d) => d.id === type));
</script>

{#if definition}
	<NodeUI nodeId={id} {definition} {data} {updateNodeData} />
{:else}
	<div class="error-node">
		<p>Unknown node type: {type}</p>
		<p>
			Available types: {getNodeDefinitions()
				.map((d) => d.id)
				.join(', ')}
		</p>
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
