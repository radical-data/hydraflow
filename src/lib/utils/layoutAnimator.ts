import type { IRNode } from '../types.js';

export type LayoutAnimator = {
	/** Call when canonical nodes change; onFrame is called with display nodes (interpolated or final). */
	handleLayoutChange(nodes: IRNode[], onFrame: (displayNodes: IRNode[]) => void): void;
	/** Stop any running animation (e.g. on destroy). */
	stop(): void;
};

export function createLayoutAnimator(duration = 250): LayoutAnimator {
	let isAnimating = false;
	let animationFrameId: number | null = null;
	let previousPositions: Map<string, { x: number; y: number }> | null = null;

	function stop() {
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}
		isAnimating = false;
	}

	function startAnimation(
		fromById: Map<string, { x: number; y: number }>,
		toById: Map<string, { x: number; y: number }>,
		nodes: IRNode[],
		onFrame: (displayNodes: IRNode[]) => void
	) {
		stop();

		isAnimating = true;
		const start = performance.now();

		const step = (now: number) => {
			const elapsed = now - start;
			const tRaw = elapsed / duration;
			const t = tRaw >= 1 ? 1 : tRaw;

			const eased = t * (2 - t);

			const displayNodes = nodes.map((node) => {
				const from = fromById.get(node.id) ?? node.position;
				const to = toById.get(node.id) ?? node.position;

				const x = from.x + (to.x - from.x) * eased;
				const y = from.y + (to.y - from.y) * eased;

				return {
					...node,
					position: { x, y },
					sourcePosition: node.sourcePosition,
					targetPosition: node.targetPosition
				};
			});

			onFrame(displayNodes);

			if (t < 1 && isAnimating) {
				animationFrameId = requestAnimationFrame(step);
			} else {
				stop();
				onFrame(nodes);
			}
		};

		animationFrameId = requestAnimationFrame(step);
	}

	function handleLayoutChange(nodes: IRNode[], onFrame: (displayNodes: IRNode[]) => void) {
		if (nodes.length === 0) {
			previousPositions = null;
			onFrame([]);
			return;
		}

		const fromById =
			previousPositions ?? new Map(nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]));

		const toById = new Map(nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]));

		let needsAnimation = false;
		for (const node of nodes) {
			const from = fromById.get(node.id);
			const to = toById.get(node.id);
			if (!to) continue;

			if (!from || from.x !== to.x || from.y !== to.y) {
				needsAnimation = true;
				break;
			}
		}

		previousPositions = toById;

		if (!needsAnimation) {
			onFrame(nodes);
			return;
		}

		startAnimation(fromById, toById, nodes, onFrame);
	}

	return { handleLayoutChange, stop };
}
