<script lang="ts">
	import { getContext } from 'svelte';

	import NodeWrapper from './NodeWrapper.svelte';

	let {
		id,
		type,
		data,
		selected = false,
		dragging = false
	} = $props<{
		id: string;
		type: string;
		data: Record<string, any>;
		selected?: boolean;
		dragging?: boolean;
	}>();

	const updateNodeData =
		getContext<(nodeId: string, data: Record<string, any>) => void>('updateNodeData');
</script>

<NodeWrapper {id} {type} {data} {selected} {dragging} {updateNodeData} />
