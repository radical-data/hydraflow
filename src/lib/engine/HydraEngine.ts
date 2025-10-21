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

		const connectedEdges = edges.filter(edge => edge.target === outputNode.id);
		if (connectedEdges.length === 0) {
			console.warn('No source connected to output node');
			return;
		}

		const sourceEdge = connectedEdges[0];
		const sourceNode = nodes.find(node => node.id === sourceEdge.source);
		
		if (!sourceNode) {
			console.warn('Source node not found');
			return;
		}

		const sourceDefinition = getNodeDefinition(sourceNode.type);
		if (!sourceDefinition) {
			console.warn(`No definition found for source node type: ${sourceNode.type}`);
			return;
		}

		const ctx = {
			generators,
			outputs: this.hydra.outputs
		};

		try {
			const sourceChain = sourceDefinition.build(ctx, sourceNode.data);
			
			const outputIndex = outputNode.data.outputIndex || 0;
			const targetOutput = this.hydra.outputs[outputIndex];
			
			if (!targetOutput) {
				console.warn(`Output ${outputIndex} not available`);
				return;
			}

			sourceChain.out(targetOutput);
			
		} catch (error) {
			console.error('Error executing graph:', error);
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
