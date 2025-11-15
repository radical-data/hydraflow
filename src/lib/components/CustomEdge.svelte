<script lang="ts">
	import { BaseEdge, EdgeReconnectAnchor, getBezierPath, type EdgeProps } from '@xyflow/svelte';

	let { sourceX, sourceY, targetX, targetY, selected, data }: EdgeProps = $props();

	const [edgePath] = $derived(
		getBezierPath({
			sourceX,
			sourceY,
			targetX,
			targetY
		})
	);

	let reconnecting = $state(false);
	let reconnectAnchorStyle = $derived(
		!reconnecting && 'background: rgba(255, 64, 250, 0.5); border-radius: 100%;'
	);
</script>

{#if !reconnecting}
	<BaseEdge path={edgePath} />
{/if}

{#if selected}
	<EdgeReconnectAnchor
		bind:reconnecting
		type="source"
		position={{ x: sourceX, y: sourceY - 5 }}
		style={reconnectAnchorStyle}
	/>
	<EdgeReconnectAnchor
		bind:reconnecting
		type="target"
		position={{ x: targetX, y: targetY + 5 }}
		style={reconnectAnchorStyle}
	/>
{/if}
