import { clientRuntimeProblems, clientRuntimeConnectSrc, createClientConsentHost, createClientOperationBroker, applyOfflineClientPolicy } from './vendor/kotoba-client-runtime.js';
import { LAB_CLIENT_DESCRIPTOR, LAB_REQUESTED_CAPABILITIES } from './client-runtime-descriptor.mjs';

export function labRuntimePolicy(descriptor = LAB_CLIENT_DESCRIPTOR, appOrigins = globalThis.location?.origin) {
  const problems = clientRuntimeProblems(descriptor, LAB_REQUESTED_CAPABILITIES, appOrigins);
  if (problems.length) throw new Error(`invalid client runtime descriptor: ${JSON.stringify(problems)}`);
  // Product bounds, not a second shared descriptor validator or consent protocol.
  if (descriptor.entry !== 'index.html' || descriptor.profile !== 'trusted-page-v1'
      || descriptor['local-state'].adapter !== 'memory' || descriptor['local-state'].schema !== 'kotoba-topology-emphasis'
      || descriptor['local-state'].version !== 1 || descriptor.operations.length || descriptor.workers?.length) {
    throw new Error('the emphasis lab requires its volatile, zero-operation runtime boundary');
  }
  return clientRuntimeConnectSrc(descriptor, LAB_REQUESTED_CAPABILITIES, [], appOrigins);
}

export function createLabClientRuntime(descriptor = LAB_CLIENT_DESCRIPTOR) {
  const connectSrc = labRuntimePolicy(descriptor);
  applyOfflineClientPolicy();
  const consentHost = createClientConsentHost();
  try {
    const broker = createClientOperationBroker({ runtime: descriptor, requestedCapabilities: LAB_REQUESTED_CAPABILITIES,
      approvedOperations: [], hostSupportedOperations: [], consentHost });
    return Object.freeze({ schema: descriptor.schema, profile: descriptor.profile, connectSrc,
      operations: broker.operations, invoke: broker.invoke, destroy: () => consentHost.destroy() });
  } catch (error) { consentHost.destroy(); throw error; }
}
