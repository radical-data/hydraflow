import type { IREdge, IRNode } from '../types.js';

type Issue = { severity: 'error' | 'warning'; message: string; nodeId?: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BuildResult = { ok: true; chain: any } | { ok: false; issues: Issue[] };

type TransformType = 'src' | 'coord' | 'color' | 'combine' | 'combineCoord';
interface HydraMeta {
	typeOf(name: string): TransformType | undefined;
	arityOf(name: string): 0 | 1 | 2 | undefined;
	orderedInputNames(name: string): string[];
}

// Helper to trim trailing undefined args to preserve positional holes
const trimUndefTail = (xs: unknown[]) => {
	const a = [...xs];
	while (a.length && a[a.length - 1] === undefined) a.pop();
	return a;
};

export class HydraEngine {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private hydra: any | null = null;
	private canvas: HTMLCanvasElement | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private regl: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private generators: any | null = null;
	private meta!: HydraMeta;
	private isInitialized = false;

	async init(canvas: HTMLCanvasElement): Promise<void> {
		this.canvas = canvas;

		try {
			// Dynamic imports to avoid SSR issues
			const [{ Hydra, generators }, createREGL, metaMod] = await Promise.all([
				import('hydra-ts'),
				import('regl'),
				import('../nodes/hydra-meta')
			]);

			if (!generators || !metaMod) {
				throw new Error('hydra-ts meta not loaded');
			}

			this.generators = generators;
			this.meta = metaMod as unknown as HydraMeta;

			this.regl = createREGL.default({
				canvas,
				attributes: {
					antialias: true,
					preserveDrawingBuffer: true
				}
			});

			this.hydra = new Hydra({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				regl: this.regl as any,
				width: canvas.width,
				height: canvas.height,
				numOutputs: 4,
				numSources: 4
			});

			this.isInitialized = true;
		} catch (error) {
			console.error('Failed to initialize HydraEngine:', error);
			throw error;
		}
	}

	private buildChainValidated(
		nodes: IRNode[],
		edges: IREdge[],
		nodeId: string,
		stack = new Set<string>(),
		memo = new Map<string, BuildResult>()
	): BuildResult {
		// Check for cycles
		if (stack.has(nodeId)) {
			return {
				ok: false,
				issues: [{ severity: 'error', message: 'Cycle detected', nodeId }]
			} as BuildResult;
		}

		// Check memo cache
		if (memo.has(nodeId)) {
			return memo.get(nodeId)!;
		}

		// Memoize node lookup
		const byId = new Map(nodes.map((n) => [n.id, n]));
		const node = byId.get(nodeId);
		if (!node) {
			const result = {
				ok: false,
				issues: [{ severity: 'error', message: `Node ${nodeId} not found` }]
			} as BuildResult;
			memo.set(nodeId, result);
			return result;
		}

		// Special case for output nodes
		if (node.type === 'out') {
			const inputEdges = edges.filter((e) => e.target === nodeId);
			if (inputEdges.length !== 1) {
				const result = {
					ok: false,
					issues: [
						{
							severity: 'error',
							message: `Output expects exactly 1 input, found ${inputEdges.length}`,
							nodeId
						}
					]
				} as BuildResult;
				memo.set(nodeId, result);
				return result;
			}

			const outputIndex = Number(node.data?.outputIndex ?? 0);
			if (
				!Number.isInteger(outputIndex) ||
				outputIndex < 0 ||
				outputIndex >= this.hydra!.outputs.length
			) {
				const result = {
					ok: false,
					issues: [
						{
							severity: 'error',
							message: `Output index ${outputIndex} out of range (0…${this.hydra!.outputs.length - 1})`,
							nodeId
						}
					]
				} as BuildResult;
				memo.set(nodeId, result);
				return result;
			}

			// Build the input chain and return it (don't call .out() here)
			const inputResult = this.buildChainValidated(
				nodes,
				edges,
				inputEdges[0].source,
				new Set([...stack, nodeId]),
				memo
			);
			memo.set(nodeId, inputResult);
			return inputResult;
		}

		// Validate transform exists
		const tType = this.meta.typeOf(node.type);
		if (!tType) {
			const result = {
				ok: false,
				issues: [{ severity: 'error', message: `Unknown transform "${node.type}"`, nodeId }]
			} as BuildResult;
			memo.set(nodeId, result);
			return result;
		}

		// Validate arity
		const inputEdges = edges.filter((e) => e.target === nodeId);
		const want = this.meta.arityOf(node.type);
		const have = inputEdges.length;

		const issues: Issue[] = [];
		if (want != null && have !== want) {
			issues.push({
				severity: have < want ? 'error' : 'warning',
				message: `${node.type} expects ${want} input(s), found ${have}`,
				nodeId
			});
		}

		// If we don't have enough inputs, stop here
		if (want != null && have < want) {
			const result = { ok: false, issues } as BuildResult;
			memo.set(nodeId, result);
			return result;
		}

		// Gather arguments
		const allNames = this.meta.orderedInputNames(node.type);
		const paramNames =
			tType === 'combine' || tType === 'combineCoord'
				? allNames.slice(1) // drop the implicit 'color' (the second chain)
				: allNames;

		const rawArgs = paramNames.map((k: string) => (node.data ?? {})[k]);

		// Build chain based on type
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let chain: any = null;

		if (tType === 'src') {
			// Start a new chain
			const callArgs = trimUndefTail(rawArgs);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			chain = (this.generators as any)[node.type](...callArgs);
		} else if (tType === 'coord' || tType === 'color') {
			// Unary operation
			if (inputEdges.length === 0) {
				const result = {
					ok: false,
					issues: [...issues, { severity: 'error', message: `No input for ${node.type}`, nodeId }]
				} as BuildResult;
				memo.set(nodeId, result);
				return result;
			}

			const inputResult = this.buildChainValidated(
				nodes,
				edges,
				inputEdges[0].source,
				new Set([...stack, nodeId]),
				memo
			);
			if (!inputResult.ok) {
				const result = { ok: false, issues: [...issues, ...inputResult.issues] } as BuildResult;
				memo.set(nodeId, result);
				return result;
			}

			const callArgs = trimUndefTail(rawArgs);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			chain = (inputResult.chain as any)[node.type](...callArgs);
		} else if (tType === 'combine' || tType === 'combineCoord') {
			// Binary operation
			if (inputEdges.length < 2) {
				const result = {
					ok: false,
					issues: [
						...issues,
						{ severity: 'error', message: `Need 2 inputs for ${node.type}`, nodeId }
					]
				} as BuildResult;
				memo.set(nodeId, result);
				return result;
			}

			const sorted = inputEdges.sort((a, b) =>
				(a.targetHandle ?? 'input-0').localeCompare(b.targetHandle ?? 'input-0')
			);

			const aResult = this.buildChainValidated(
				nodes,
				edges,
				sorted[0].source,
				new Set([...stack, nodeId]),
				memo
			);
			const bResult = this.buildChainValidated(
				nodes,
				edges,
				sorted[1].source,
				new Set([...stack, nodeId]),
				memo
			);

			if (!aResult.ok || !bResult.ok) {
				const result = {
					ok: false,
					issues: [
						...issues,
						...(aResult.ok ? [] : aResult.issues),
						...(bResult.ok ? [] : bResult.issues)
					]
				} as BuildResult;
				memo.set(nodeId, result);
				return result;
			}

			const callArgs = trimUndefTail(rawArgs);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			chain = (aResult.chain as any)[node.type](bResult.chain, ...callArgs);
		}

		const result = { ok: true, chain } as BuildResult;
		memo.set(nodeId, result);
		return result;
	}

	executeGraph(nodes: IRNode[], edges: IREdge[]): void {
		if (!this.hydra || !this.isInitialized) {
			console.warn('HydraEngine not initialized');
			return;
		}

		const outputNodes = nodes.filter((node) => node.type === 'out');
		const allIssues: Issue[] = [];

		for (const outputNode of outputNodes) {
			const outputIndex = Number(outputNode.data?.outputIndex ?? 0);

			// Validate output index range
			if (
				!Number.isInteger(outputIndex) ||
				outputIndex < 0 ||
				outputIndex >= this.hydra.outputs.length
			) {
				allIssues.push({
					severity: 'error',
					message: `Output index ${outputIndex} out of range (0…${this.hydra.outputs.length - 1})`,
					nodeId: outputNode.id
				});
				continue;
			}

			// Validate exactly one input edge
			const inEdges = edges.filter((e) => e.target === outputNode.id);
			if (inEdges.length !== 1) {
				allIssues.push({
					severity: 'error',
					message: `Output expects 1 input, found ${inEdges.length}`,
					nodeId: outputNode.id
				});
				continue;
			}
			const inputEdge = inEdges[0];

			// Build the chain
			const result = this.buildChainValidated(nodes, edges, inputEdge.source);
			if (!result.ok) {
				allIssues.push(...result.issues);
				continue;
			}

			// Execute the chain
			try {
				result.chain.out(this.hydra.outputs[outputIndex]);
			} catch (err) {
				console.error(`Error executing output ${outputIndex}:`, err);
			}
		}

		// Log any issues
		if (allIssues.length > 0) {
			console.error('Graph issues:', allIssues);
		}
	}

	start(): void {
		if (this.hydra) {
			this.hydra.loop.start();
		}
	}

	stop(): void {
		if (this.hydra) {
			this.hydra.loop.stop();
		}
	}

	reset(): void {
		if (this.hydra) {
			this.hydra.hush();
		}
	}

	destroy(): void {
		if (this.hydra) {
			this.hydra.loop.stop();
			this.hydra = null;
		}
		if (this.regl) {
			this.regl.destroy();
			this.regl = null;
		}
		this.isInitialized = false;
	}

	setResolution(width: number, height: number): void {
		if (this.hydra) {
			this.hydra.setResolution(width, height);
		}
	}
}
