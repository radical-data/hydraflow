<script lang="ts">
	import NodeUI from './NodeUI.svelte';
	import { getAllDefinitions } from '../nodes/registry.js';
	import type { NodeDefinition } from '../types.js';

	export let id: string;
	export let type: string;
	export let data: Record<string, any>;
	export let selected: boolean = false;
	export let dragging: boolean = false;

	const nodeDefinitions = getAllDefinitions();
	$: definition = nodeDefinitions.find(d => d.id === type);

</script>

{#if definition}
	<NodeUI nodeId={id} {definition} {data} />
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
