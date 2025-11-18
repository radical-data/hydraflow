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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		getContext<(nodeId: string, data: Record<string, any>) => void>('updateNodeData');
</script>

<NodeWrapper {id} {type} {data} {updateNodeData} />
