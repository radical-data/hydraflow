<script lang="ts">
	import { getContext } from 'svelte';

	import type { InputValue } from '../types.js';
	import NodeWrapper from './NodeWrapper.svelte';

	let { id, type, data } = $props<{
		id: string;
		type: string;
		data: Record<string, InputValue>;
	}>();

	const updateNodeData =
		getContext<(nodeId: string, data: Record<string, InputValue>) => void>('updateNodeData');
</script>

<NodeWrapper {id} {type} {data} {updateNodeData} />
