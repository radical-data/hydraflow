<script lang="ts">
	import { examples } from '$lib/examples/index.js';
	import type { ExamplePatch } from '$lib/examples/types.js';

	let { onSelect } = $props<{
		onSelect: (ex: ExamplePatch) => void;
	}>();

	let open = $state(false);
	let activeId = $state<string | null>(examples[0]?.id ?? null);

	function pick(ex: ExamplePatch) {
		activeId = ex.id;
		open = false;
		onSelect(ex);
	}
</script>

<div class="examples-bar">
	<div class="left">
		<button class="dropdown-btn" onclick={() => (open = !open)}> Examples ▾ </button>
		{#if open}
			<div class="dropdown">
				{#each examples as ex (ex.id)}
					<button class="dropdown-item" class:active={ex.id === activeId} onclick={() => pick(ex)}>
						<div class="title">{ex.title}</div>
						{#if ex.description}
							<div class="desc">{ex.description}</div>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.examples-bar {
		display: flex;
		gap: 8px;
		margin-right: 8px;
	}

	.dropdown-btn {
		background: rgba(255, 255, 255, 0.9);
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 6px 10px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		backdrop-filter: blur(4px);
	}

	.dropdown {
		margin-top: 6px;
		width: 240px;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid #e5e7eb;
		border-radius: 10px;
		overflow: hidden;
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15);
	}

	.dropdown-item {
		width: 100%;
		text-align: left;
		padding: 8px 10px;
		border: none;
		background: transparent;
		cursor: pointer;
	}

	.dropdown-item:hover {
		background: #f3f4f6;
	}

	.dropdown-item.active {
		background: #ec4899;
		color: white;
	}

	.title {
		font-size: 12px;
		font-weight: 700;
	}

	.desc {
		font-size: 10px;
		opacity: 0.8;
		margin-top: 2px;
	}
</style>
