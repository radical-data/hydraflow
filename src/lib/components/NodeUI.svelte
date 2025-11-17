<script lang="ts">
	import type { NodeDefinition, InputSchema } from '../types.js';
	import { Handle, Position, useNodeConnections } from '@xyflow/svelte';

	let { nodeId, definition, data, updateNodeData } = $props<{
		nodeId: string;
		definition: NodeDefinition;
		data: Record<string, any>;
		updateNodeData: (nodeId: string, data: Record<string, any>) => void;
	}>();
	function handleChange(inputId: string, value: any) {
		updateNodeData(nodeId, { [inputId]: value });
	}
	function getHandleConfig() {
		switch (definition.category) {
			case 'source':
				return { inputs: 0, outputs: 1 };
			case 'modifier':
				return { inputs: 1, outputs: 1 };
			case 'mixer':
				return { inputs: 2, outputs: 1 };
			case 'output':
				return { inputs: 1, outputs: 0 };
			default:
				return { inputs: 0, outputs: 0 };
		}
	}

	const handleConfig = getHandleConfig();

	// derive per-handle connectable flags: a handle is connectable if it has 0 connections
	const inputHandleConnections = $derived(
		Array.from({ length: handleConfig.inputs }, (_, i) =>
			useNodeConnections({ handleType: 'target', handleId: `input-${i}` })
		)
	);
	const inputsConnectable = $derived(inputHandleConnections.map((c) => c.current.length === 0));

	const isEndNode = $derived(definition.inputs.some((input: InputSchema) => input.type === 'end'));
</script>

{#if isEndNode}
	<div>
		{#each Array(handleConfig.inputs) as _, i}
			<Handle
				type="target"
				position={Position.Top}
				id="input-{i}"
				style="top: -2px; left: 50%; transform: translateX(-50%); z-index: 10;"
				isConnectable={inputsConnectable[i]}
			/>
		{/each}
		<div class="node-container circular">
			<span class="circular-label">
				{definition.label}
			</span>
		</div>
	</div>
{:else}
	<div class="node-container">
		{#each Array(handleConfig.inputs) as _, i}
			{@const isMixer = definition.category === 'mixer'}
			{@const leftOffset = isMixer ? (i === 0 ? 30 : 150) : 90}
			{@const topOffset = isMixer ? 20 : 20 + i * 30}
			<Handle
				type="target"
				position={Position.Top}
				id="input-{i}"
				style="top: {topOffset}px; left: {leftOffset}px;"
				isConnectable={inputsConnectable[i]}
			/>
		{/each}

		<div class="node-header">
			{definition.label}
		</div>
		<div class="node-controls">
			{#each definition.inputs as input}
				<div class="control-group">
					<label for={input.id}>{input.label}</label>

					{#if input.type === 'number'}
						{@const currentValue = data[input.id] ?? input.default}
						<input
							id={input.id}
							type="range"
							min={input.min ?? 0}
							max={input.max ?? 1}
							step={input.step ?? 0.01}
							value={currentValue}
							oninput={(e) =>
								handleChange(input.id, parseFloat((e.target as HTMLInputElement).value))}
							class="nodrag nopan nowheel"
						/>
						<span class="value-display">
							{currentValue.toFixed?.(2) ?? currentValue}
						</span>
					{:else if input.type === 'select'}
						{@const currentValue = data[input.id] ?? input.default}
						<select
							disabled
							id={input.id}
							value={Number(currentValue)}
							onchange={(e) => handleChange(input.id, (e.target as HTMLSelectElement).value)}
							class="nodrag nopan nowheel"
						>
							{#each input.options ?? [] as option}
								<option value={Number(option.value)}>{option.label}</option>
							{/each}
						</select>
					{:else if input.type === 'boolean'}
						{@const currentValue = data[input.id] ?? input.default}
						<input
							id={input.id}
							type="checkbox"
							checked={currentValue}
							onchange={(e) => handleChange(input.id, (e.target as HTMLInputElement).checked)}
							class="nodrag nopan nowheel"
						/>
					{/if}
				</div>
			{/each}
		</div>

		{#each Array(handleConfig.outputs) as _, i}
			<Handle
				type="source"
				position={Position.Bottom}
				id="output-{i}"
				style="bottom: {10 + i * 30}px;"
			/>
		{/each}
	</div>
{/if}

<style>
	.node-container {
		background: white;
		border-radius: 6px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		overflow: hidden;
		min-width: 180px;
		max-width: 200px;
		position: relative;
	}

	.node-container.circular {
		width: 80px;
		height: 80px;
		min-width: 80px;
		max-width: 80px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #ec4899;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		padding: 0;
	}

	.circular-label {
		color: white;
		font-size: 11px;
		font-weight: 600;
		text-align: center;
		padding: 0 8px;
		line-height: 1.2;
	}

	.node-header {
		background: #ec4899;
		color: white;
		padding: 8px 12px;
		font-size: 12px;
		font-weight: 600;
		margin: 0;
	}

	.node-controls {
		padding: 0;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		padding: 8px 12px 4px 12px;
	}

	.control-group:last-child {
		padding-bottom: 12px;
	}

	.control-group label {
		font-size: 10px;
		font-weight: 700;
		color: #374151;
		margin-bottom: 4px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.control-group input[type='range'] {
		width: 100%;
		height: 4px;
		background: #e5e7eb;
		border-radius: 2px;
		outline: none;
		margin: 4px 0;
	}

	.control-group input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 12px;
		height: 12px;
		background: #ec4899;
		border-radius: 50%;
		cursor: pointer;
	}

	.control-group input[type='range']::-moz-range-thumb {
		width: 12px;
		height: 12px;
		background: #ec4899;
		border-radius: 50%;
		cursor: pointer;
		border: none;
	}

	.control-group select {
		width: 100%;
		padding: 4px 6px;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		background: white;
		font-size: 11px;
		color: #374151;
	}

	.control-group select:focus {
		outline: none;
		border-color: #ec4899;
	}

	.value-display {
		font-size: 10px;
		color: #6b7280;
		text-align: right;
		margin-top: 2px;
	}

	:global(.svelte-flow__handle) {
		width: 8px;
		height: 8px;
		background: #ec4899;
		border: 2px solid white;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	:global(.svelte-flow__handle-target) {
		background: #10b981;
	}

	:global(.svelte-flow__handle-source) {
		background: #3b82f6;
	}
</style>
