import { clientRuntimeProblems, clientRuntimeConnectSrc, createClientConsentHost, createClientOperationBroker, applyOfflineClientPolicy } from './vendor/kotoba-client-runtime.js';
import { LAB_CLIENT_DESCRIPTOR, LAB_REQUESTED_CAPABILITIES } from './client-runtime-descriptor.mjs';
import { labDescriptorPolicy } from './client-runtime-policy.mjs';

export function labRuntimePolicy(descriptor = LAB_CLIENT_DESCRIPTOR, appOrigins = globalThis.location?.origin) {
  return labDescriptorPolicy({ clientRuntimeProblems, clientRuntimeConnectSrc }, descriptor, appOrigins);
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
