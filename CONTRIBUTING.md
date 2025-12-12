# Contributing

Mangl is a node editor for Hydra. Keep the boundaries sharp: engine/validation define truth; UI renders it.

## Quickstart

```bash
pnpm install
pnpm dev
```

Before opening a PR:

```bash
pnpm lint
pnpm check
pnpm test
```

## Where to make changes

Use this to avoid cross-layer fixes.

- Transform registry (canonical transform facts: kind/arity/param ids/defaults + node catalogue derivation): src/lib/engine/transformRegistry.ts
- Hydra execution (what runs): src/lib/engine/HydraEngine.ts
- Graph validity + issues: src/lib/engine/graphValidation.ts
- Hydra integration + node catalogue wiring: src/lib/hydra/bootstrapHydraIntegration.ts (spec-level overrides live here)
- Editor behaviour (connections, feedback tagging, deletes): src/lib/components/FlowEditor.svelte
- Execution triggering (debounce, lifecycle in UI): src/lib/components/HydraCanvas.svelte
- Node/edge presentation only: src/lib/components/NodeUI.svelte, src/lib/components/CustomEdge.svelte
- Layout + animation: src/lib/utils/layout.ts, src/lib/utils/layoutAnimator.ts
- Dependency patch (Hydra contract — don't delete casually): patches/hydra-ts@1.0.0.patch

## Architecture in 60 seconds

- The app state is a canonical IR graph: IRNode[] + IREdge[] (src/lib/types.ts).
- The canvas calls engine.executeGraph(nodes, edges) (debounced).
- executeGraph(): 1. validates structure (graphValidation.ts) 2. if structurally valid, builds and executes Hydra chains (HydraEngine.ts)
- Feedback edges (edge.isFeedback === true) mean "read previous frame from the current output"; they break same-frame cycle detection.

## Hard rules

- No logic drift: validation and execution rules live in engine/validation, not UI.
- No param drift: UI and runtime must derive param ids/order/defaults from the registry/meta. No separate param-name lists.
- Overrides are strict: overrides may only adjust UI properties for existing param ids; unknown param ids must throw during bootstrap/spec build.
- Mixer stability: binary nodes depend on input-0 / input-1 handles; changing handle IDs affects validation + runtime.
- SSR safety: browser-only modules (hydra-ts, regl) must be imported dynamically (see HydraEngine.init()).
- Upgrading hydra-ts: re-evaluate the patch and update tests; treat it as architectural.

## PR guidelines

- Prefer small PRs with a clear intent.
- Add/adjust engine tests when changing validation or execution semantics (see src/lib/engine/\*.test.ts).
