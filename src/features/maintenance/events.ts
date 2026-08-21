/**
 * The ⌘K row and the gate component have to agree on one string, and nothing
 * else. A window event rather than shared React state so the palette — which
 * lives in a different tree, mounted by the (app) layout — needs no handle on
 * a component mounted by the ROOT layout, and so commands.ts stays the pure
 * data module registry.test.ts insists on.
 */
export const OPEN_CONTROLS_EVENT = 'logpup:maintenance-controls'
