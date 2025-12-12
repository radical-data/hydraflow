import { vi } from 'vitest';

/**
 * Test fakes for Hydra + generator functions.
 * Two generator styles:
 * - recording (feedback tests)
 * - spies (special node call assertions)
 */

export type FakeChain = {
	kind: string;
	transforms: Array<{ op: string; otherChain?: FakeChain; args: unknown[] }>;
	outputIndex?: number;
	input?: FakeChain;
	input0?: FakeChain;
	input1?: FakeChain;
	rotate: (this: FakeChain, ...args: unknown[]) => FakeChain;
	blend: (this: FakeChain, other: FakeChain, ...args: unknown[]) => FakeChain;
	out?: (this: FakeChain, ...args: unknown[]) => FakeChain | void;
	[key: string]: unknown;
};

/**
 * Outputs have { index } property for feedback routing.
 */
export function createFakeHydraOutputsOnly(outputCount = 4) {
	const outputs = Array.from({ length: outputCount }, (_, i) => ({ index: i }));
	return {
		outputs,
		loop: {
			start: () => {},
			stop: () => {}
		},
		hush: () => {},
		setResolution: () => {}
	};
}

/**
 * Outputs are plain objects {}; sources include { initCam: vi.fn() } spy.
 */
export function createFakeHydraWithCamera(outputCount = 4) {
	const outputs = Array.from({ length: outputCount }, () => ({}));
	const sources = [{ initCam: vi.fn() }];
	return {
		outputs,
		sources,
		setResolution: vi.fn(),
		loop: {
			start: vi.fn(),
			stop: vi.fn()
		},
		hush: vi.fn()
	};
}

export function createFakeGeneratorsForFeedback() {
	const chains: FakeChain[] = [];

	const makeChain = (kind: string): FakeChain => {
		const chain: FakeChain = {
			kind,
			transforms: [],
			rotate: function (this: FakeChain, ...args: unknown[]) {
				this.transforms.push({ op: 'rotate', args });
				return this;
			},
			blend: function (this: FakeChain, other: FakeChain, ...args: unknown[]) {
				this.input0 = this;
				this.input1 = other;
				// store otherChain separately; args = user params only
				this.transforms.push({ op: 'blend', otherChain: other, args });
				return this;
			},
			out: function () {
				return this;
			}
		};
		chains.push(chain);
		return chain;
	};

	const generators = {
		osc: (...args: unknown[]) => {
			const chain = makeChain('osc');
			chain.transforms.push({ op: 'osc', args });
			return chain;
		},
		src: (output: { index?: number }) => {
			const chain = makeChain('src');
			chain.outputIndex = output.index ?? 0;
			chain.transforms.push({ op: 'src', args: [output] });
			return chain;
		}
	};

	return { generators, chains };
}

export function createFakeGeneratorsForSpecialNodes() {
	const srcChain = {
		out: vi.fn()
	};
	const solidChain = {
		out: vi.fn()
	};
	const oscChain = {
		out: vi.fn()
	};

	return {
		generators: {
			src: vi.fn(() => srcChain),
			solid: vi.fn(() => solidChain),
			osc: vi.fn(() => oscChain)
		},
		chains: { srcChain, solidChain, oscChain }
	};
}
