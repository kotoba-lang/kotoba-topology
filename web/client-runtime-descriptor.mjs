// Actual product boundary: volatile state, no Workers, and no external operations.
export const LAB_CLIENT_DESCRIPTOR = Object.freeze({
  schema: 'kotoba.app.client-runtime.v1', target: 'browser', profile: 'trusted-page-v1', entry: 'index.html',
  'local-state': Object.freeze({ adapter: 'memory', schema: 'kotoba-topology-emphasis', version: 1 }),
  workers: Object.freeze([]), operations: Object.freeze([]),
});
export const LAB_REQUESTED_CAPABILITIES = Object.freeze([]);
