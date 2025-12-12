import type { TransformMeta } from '../graphValidation.js';

export function createTestMeta(): TransformMeta {
	const arityByName = new Map<string, 0 | 1 | 2>();
	const kindByName = new Map<string, 'src' | 'coord' | 'color' | 'combine' | 'combineCoord'>();
	const paramIdsByName = new Map<string, string[]>();
	const paramDefaultsByName = new Map<string, unknown[]>();

	// src: arity 0, kind 'src', no params/defaults
	arityByName.set('src', 0);
	kindByName.set('src', 'src');
	paramIdsByName.set('src', []);
	paramDefaultsByName.set('src', []);

	// osc: arity 0, kind 'src', params frequency,sync,offset, defaults 2,0.5,0
	arityByName.set('osc', 0);
	kindByName.set('osc', 'src');
	paramIdsByName.set('osc', ['frequency', 'sync', 'offset']);
	paramDefaultsByName.set('osc', [2, 0.5, 0]);

	// rotate: arity 1, kind 'coord', params angle,speed, defaults 0,0
	arityByName.set('rotate', 1);
	kindByName.set('rotate', 'coord');
	paramIdsByName.set('rotate', ['angle', 'speed']);
	paramDefaultsByName.set('rotate', [0, 0]);

	// blend: arity 2, kind 'combine', params amount, defaults 0.5
	arityByName.set('blend', 2);
	kindByName.set('blend', 'combine');
	paramIdsByName.set('blend', ['amount']);
	paramDefaultsByName.set('blend', [0.5]);

	// out: arity 1, kind 'color', no params/defaults
	arityByName.set('out', 1);
	kindByName.set('out', 'color');
	paramIdsByName.set('out', []);
	paramDefaultsByName.set('out', []);

	return { arityByName, kindByName, paramIdsByName, paramDefaultsByName };
}
