<script lang="ts">
	import { BaseEdge, type EdgeProps, EdgeReconnectAnchor, getBezierPath } from '@xyflow/svelte';
	import { getContext } from 'svelte';
	import type { SvelteMap } from 'svelte/reactivity';

	type EdgeValidationStatus = {
		hasError: boolean;
		hasWarning: boolean;
	};

	let { id, sourceX, sourceY, targetX, targetY, selected }: EdgeProps = $props();

	const edgeValidationById =
		getContext<SvelteMap<string, EdgeValidationStatus>>('edgeValidationById');
	const validationStatus = $derived(edgeValidationById?.get(id) ?? null);

	const hasError = $derived(!!validationStatus?.hasError);
	const hasWarning = $derived(!hasError && !!validationStatus?.hasWarning);

	const edgeStyle = $derived(
		hasError
			? 'stroke: #ef4444; stroke-width: 2px;'
			: hasWarning
				? 'stroke: #f59e0b; stroke-width: 2px;'
				: undefined
	);

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
		hasError
			? 'background: rgba(239, 68, 68, 0.5); border-radius: 100%;'
			: hasWarning
				? 'background: rgba(245, 158, 11, 0.5); border-radius: 100%;'
				: reconnecting
					? undefined
					: 'background: rgba(255, 64, 250, 0.5); border-radius: 100%;'
	);
</script>

{#if !reconnecting}
	<BaseEdge path={edgePath} style={edgeStyle} />
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
