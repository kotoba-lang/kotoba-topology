// Product-specific scope only. Descriptor validity and CSP come from the supplied canonical module.
export function labDescriptorPolicy(canonical, descriptor, appOrigins) {
  const problems = canonical.clientRuntimeProblems(descriptor, [], appOrigins);
  if (problems.length) throw new Error(`invalid client runtime descriptor: ${JSON.stringify(problems)}`);
  if (descriptor.entry !== 'index.html' || descriptor.profile !== 'trusted-page-v1'
      || descriptor['local-state'].adapter !== 'memory' || descriptor['local-state'].schema !== 'kotoba-topology-emphasis'
      || descriptor['local-state'].version !== 1 || descriptor.operations.length || descriptor.workers?.length) {
    throw new Error('the emphasis lab requires its volatile, zero-operation runtime boundary');
  }
  return canonical.clientRuntimeConnectSrc(descriptor, [], [], appOrigins);
}
