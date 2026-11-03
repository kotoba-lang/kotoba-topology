# Shared client runtime integration — JUN-751

## Actual source and correction of the earlier blocker

The old `kotoba-lang/wasm-webcomponent` repository is archived. Its local shared checkout was stale and dirty; it was not changed. The canonical module is maintained in **kotoba-lang/kotoba**, at `lib/kotoba.wasmWebcomponent/src/kotoba-client-runtime.js`. Workspace `github/AGENTS.md:72–73` still names the earlier location; that discrepancy has been reported in Linear JUN-751 without rewriting the workspace contract.

The existing independent review record is [KOTOBA-159](https://linear.app/kotobalabs/issue/KOTOBA-159). The reviewed baseline is `6f74fe21760a1c752a05340ffb52e69a38877874`, SHA-256 `4e6ef6eea88641b20c490692d271ce57891e53e01fcc5c303135a325b2f5b693`. The module in the current owner main was byte-identical to that revision when checked.

This integration pins the candidate `4b6f2c13f4ade9b8c8978f57faed2717aafd1f38`, SHA-256 `91df9207480ddc8bc4d4f38825b7fa905a7dddf482070fc9f42e7073d357214f` (46,491 bytes). [kotoba#1161](https://github.com/kotoba-lang/kotoba/pull/1161) adds **only `memory` to the local-state adapter enum** in executable shared code, plus documentation, a regression fixture and source hashes. It does not change consent or endpoint matching. This is a pinned proposed revision, not a claim that the shared PR has merged or that a new independent security review has occurred.

## Product boundary

`web/client-runtime-descriptor.mjs` declares `kotoba.app.client-runtime.v1`, browser entry `index.html`, profile `trusted-page-v1`, volatile `memory` state schema `kotoba-topology-emphasis` version 1, zero Workers and zero external operations. The model's in-memory state and explicit URL/JSON exports match that declaration. No persistent store or inference service is implied.

The host uses the canonical `clientRuntimeProblems`, `clientRuntimeConnectSrc`, `applyOfflineClientPolicy`, `createClientConsentHost` and `createClientOperationBroker`. Requested capabilities, host eligibility and supported selectors all start empty and remain empty. The real broker rejects any invocation before opening consent or sending anything. The canonical consent dialog is constructed but is never shown for this descriptor. The app installs no experiment handlers if runtime validation fails. Bfcache restoration keeps its existing host; final page teardown destroys it.

Product policy code only fixes this app's boundary: the actual entry, profile, state declaration, and no operations or Workers. It delegates general validation and consent to the shared source. It does not fork shared approval semantics. The built CSP uses the canonical derived `connect-src 'none'`; network connections, Workers, frames, objects and form submissions are denied by static policy. Reference links remain user-initiated navigation to source material, not app API requests.

The `trusted-page-v1` profile is **not a sandbox for hostile JavaScript in the same document**. KOTOBA-159's open findings, including that profile's general consent-enforcement limitation, remain open. This implementation qualifies our verified browser-local, zero-operation candidate; it does not qualify a remote-service app, an arbitrary guest, general browser API isolation or production distribution.

## Immutable staging and build

`runtime-source.json` records the actual owning repository, full source commit, file path, independently expected SHA-256/length, source license pins and reviewed baseline. `web/vendor/kotoba-client-runtime.js` and `web/vendor/LICENSE` are byte-exact copies. To re-stage the pinned bytes from a local owner repository, run:

```sh
node scripts/vendor-runtime.mjs /path/to/kotoba
```

Staging uses `git show` at the full pinned commit and checks both files before writing. It does not use the owner's dirty working files, moving branch names, a compatibility link, or an automatic download. The source revision and expected digests must be deliberately reviewed when updating the lock.

```sh
node scripts/build-demo.mjs
```

The builder verifies source/license pins **before importing canonical code** and imports the captured verified bytes. Descriptor and CSP checks use that canonical module, with no product-local substitute. It preserves the complete original canonical source text in the standalone inline module, including exports and replacement-string metacharacters. CSP hashes bind the actual final inline bytes. The multi-file output copies the exact same verified module. No artifact is written before validation succeeds; if a previous good output exists, a failed build leaves that earlier output in place.

Outputs:

- `dist/index.html`: self-contained file that opens directly without a server.
- `dist/site/`: verified static multi-file output, including `_headers` with the derived CSP. Serve this directory for HTTP testing. Raw `web/` is development source and bypasses the build's source-pin checks.
- `dist/client-runtime-receipt.json`: source identity, descriptor/hash, empty authority sets, derived connect policy and qualification scope. This is a build receipt, not a publisher signature or production release attestation.

## Verification

`node --test tests/*.test.mjs` covers the existing model, source/license identity, malformed or widened descriptors, tampered pins, moving revision refusal, no artifacts from a refused build, exact canonical preservation, inline CSP hash and byte-identical multi-file staging. The adapter fixture at the owning source fails against the prior module and passes with `memory`; the prior consent-host and broker-review fixtures still pass. Node is used locally; no hosted-runtime CI or fallback is added.

`tests/browser-smoke.mjs` checks canonical startup with the single-file output and all eight annotated language examples, prior controls and regressions, state/JSON, keyboard/mobile behavior, console/CSP errors and zero HTTP requests. `tests/runtime-browser.mjs` checks the built HTTP entry, canonical empty broker, undeclared and forged approval-like invocations, malformed descriptor refusal before app handlers, and a deliberate direct app-origin fetch blocked by CSP with **zero requests received** at the test endpoint. The latter's expected CSP console refusal is recorded separately from normal application errors. These browser tests do not approve or send a real external operation.

## Delivery

Shared source PR: [kotoba#1161](https://github.com/kotoba-lang/kotoba/pull/1161). Product integration PR: [kotoba-topology#2](https://github.com/kotoba-lang/kotoba-topology/pull/2). Merge/review the shared change first, then the product integration. No source PR is merged, no static site is published, and no production route is changed by this task. Unrelated shared-checkout changes are preserved.
