import { Hydra, generators, Output } from 'hydra-ts';
import createREGL from 'regl';
import type { IRNode, IREdge } from '../types.js';
import { getNodeDefinition } from '../nodes/registry.js';

export class HydraEngine {
	private hydra: Hydra | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private regl: any = null;
	private isInitialized = false;

	async init(canvas: HTMLCanvasElement): Promise<void> {
		this.canvas = canvas;
		
		try {
			this.regl = createREGL({
				canvas,
				attributes: {
					antialias: true,
					preserveDrawingBuffer: true
				}
			});

			this.hydra = new Hydra({
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

	executeGraph(nodes: IRNode[], edges: IREdge[]): void {
		if (!this.hydra || !this.isInitialized) {
			console.warn('HydraEngine not initialized');
			return;
		}

		this.hydra.hush();

		const outputNodes = nodes.filter(node => {
			const definition = getNodeDefinition(node.type);
			return definition?.category === 'output';
		});

		if (outputNodes.length === 0) {
			console.warn('No output nodes found');
			return;
		}

		const outputNode = outputNodes[0];
		const outputDefinition = getNodeDefinition(outputNode.type);
		
		if (!outputDefinition) {
			console.warn(`No definition found for node type: ${outputNode.type}`);
			return;
		}

		try {
			const chain = this.buildChain(nodes, edges, outputNode.id);
			
			if (!chain) {
				console.warn('Failed to build chain');
				return;
			}

			const outputIndex = outputNode.data.outputIndex || 0;
			const targetOutput = this.hydra.outputs[outputIndex];
			
			if (!targetOutput) {
				console.warn(`Output ${outputIndex} not available`);
				return;
			}

			chain.out(targetOutput);
			
		} catch (error) {
			console.error('Error executing graph:', error);
		}
	}

	private buildChain(nodes: IRNode[], edges: IREdge[], nodeId: string): any {
		const node = nodes.find(n => n.id === nodeId);
		if (!node) return null;

		const definition = getNodeDefinition(node.type);
		if (!definition) return null;

		const ctx = {
			generators,
			outputs: this.hydra!.outputs
		};

		const inputEdges = edges.filter(edge => edge.target === nodeId);
		
		if (definition.category === 'source') {
			return definition.build(ctx, node.data);
		} else if (definition.category === 'modifier') {
			if (inputEdges.length === 0) {
				console.warn(`Modifier node ${nodeId} has no input`);
				return null;
			}
			
			const inputEdge = inputEdges[0];
			const inputChain = this.buildChain(nodes, edges, inputEdge.source);
			
			if (!inputChain) {
				console.warn(`Failed to build input chain for ${nodeId}`);
				return null;
			}

			if (node.type === 'rotate') {
				return inputChain.rotate(node.data.angle, node.data.speed);
			}
			
			return inputChain;
		} else if (definition.category === 'mixer') {
			if (inputEdges.length < 2) {
				console.warn(`Mixer node ${nodeId} needs 2 inputs, got ${inputEdges.length}`);
				return null;
			}
			
			// Sort edges by target handle to ensure correct order (A, B)
			const sortedEdges = inputEdges.sort((a, b) => {
				const aHandle = a.targetHandle || 'input-0';
				const bHandle = b.targetHandle || 'input-0';
				return aHandle.localeCompare(bHandle);
			});
			
			const inputAChain = this.buildChain(nodes, edges, sortedEdges[0].source);
			const inputBChain = this.buildChain(nodes, edges, sortedEdges[1].source);
			
			if (!inputAChain || !inputBChain) {
				console.warn(`Failed to build input chains for mixer ${nodeId}`);
				return null;
			}

			if (node.type === 'blend') {
				return inputAChain.blend(inputBChain, node.data.amount);
			}
			
			return inputAChain;
		} else if (definition.category === 'output') {
			if (inputEdges.length === 0) {
				console.warn(`Output node ${nodeId} has no input`);
				return null;
			}
			
			const inputEdge = inputEdges[0];
			return this.buildChain(nodes, edges, inputEdge.source);
		}

		return null;
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
