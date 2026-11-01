# Interactive emphasis lab

Implemented for JUN-750, following the conceptual audit in JUN-749. This is a local, static research demonstrator with a Japanese interface and four English/Japanese annotated sentence pairs. It is not an automatic language analyzer, an empirical result, or a release of the older paper's claims.

## Run and compare

Use Node.js 22+ to run `node scripts/build-demo.mjs` from the repository. Open `dist/index.html` directly in a browser. The build has no dependencies: it combines the three ES modules and CSS into one HTML file, with hashes for the inline script and style in its Content Security Policy. Alternatively, serve `web/` using the README's loopback-only static server. No SSR, API, remote fonts, model downloads, speech service, analytics, or user-data upload is used.

1. In **赤い車**, select `red` / `赤い`. Toggle bold or italics, then independently move the pitch, intensity, and duration sliders. Observe that the dependency edges stay the same while color alternatives activate and the relative focus share changes.
2. In English **紹介**, emphasize `Maya`, clear it, then emphasize `Ken`. Observe how the context-dependent candidate reading of `only` changes from the introduced person to the recipient. In Japanese, emphasize `マヤ` and `ケン`: the illustration of `だけ` remains associated with the predicate phrase. This is an annotation decision for this sentence, not a general theorem about Japanese focus.
3. Combine emphasis on multiple words. Equal scores remain ambiguous, rather than selecting the first word. Function words may be visually/acoustically emphasized, but their semantic effects are unannotated and explicitly excluded from the role model.
4. Add a phrase boundary and move the input slider backward and forward. Only arrived tokens contribute evidence or dependency edges; future annotations appear faint/dashed. Incomplete semantic composition is held pending. Compare **窓を割る** and **窓が割れる** to explore explicitly represented versus unexpressed agency. These are different descriptions, not asserted semantic equivalents.
5. Save settings to the URL fragment or export JSON. The export records the version, coefficients, input state, output scores, and graph metrics. Reloading a saved URL reproduces the state. Saving is explicit; later edits do not silently rewrite that saved URL. Source references open only when clicked.

## Representation and calculation

`web/examples.mjs` contains manual tokens, token-to-head indices, dependency labels, semantic roles, ordinary propositions, comparison context, alternative candidates, and operator annotations. These are simplified teaching annotations; they are not automatically generated UD parses. English syllable labels are schematic, not IPA or a pronunciation lexicon; Japanese uses whole-word units. There is no lexical-stress recognition or noun/verb disambiguator.

`web/model.mjs` computes independent visual and acoustic contributions per arrived token:

```text
visual = 0.45 * bold + 0.30 * italic + 0.35 * effectiveCapitals
acoustic = 0.45 * pitch + 0.35 * intensity + 0.40 * (duration - 1)
roleEvidence = sum(visual + acoustic for tokens bearing that role)
relativeShare(role) = exp(roleEvidence) / sum(exp(all roleEvidence))
```

Booleans are 0 or 1, pitch/intensity range from 0 to 1, and duration ranges from 1 to 2. Capitals have no effect on uncased text. Shares use an explicitly **uniform reference**, not a learned distribution. The coefficients are explanatory choices, not measured effects. Combined cues add; no claim is made that typography and speech have equivalent or additive human effects. These shares are not neural attention weights or probabilities of correct interpretation.

Only annotated roles contribute to meaning scores. Each activated role exposes three manually provided alternatives. The dominant role determines an illustrative focus reading; tied leaders remain ambiguous. `only` candidate readings depend on focus, while the Japanese example fixes the `だけ` annotation to the predicate phrase. Without an explicit restrictive operator, alternatives are not asserted false. Context and alternative candidates are fixed by the selected example; arbitrary text editing and automatic interpretation are intentionally not implemented.

Syllable selection changes where the pitch peak is drawn and previewed. It does not change the meaning score, because a lexical/semantic effect has not been calibrated. Phrase boundaries change chunk membership and preview pauses, without silently reparenting the annotated syntax. Duration and intensity change both the schematic realization and their explicit score terms. The Web Audio preview uses a low-volume oscillator entirely inside the browser: it is neither text-to-speech nor a phonetic simulation. It runs only when requested.

The computation trace is a sequence of model operations (input, edge attachment, cue aggregation, candidate activation, operator composition), not a measurement of human processing time or complexity. The unresolved-head counter is an annotation-based count, not a cognitive-load estimate.

## Graphs and topology

The display aligns tokens, typography, prosodic syllable/word segments, phrase chunks, and role alternatives. Dependency arrows point from head to dependent. Faint dashed syntax denotes future words, not a prediction. Green branches show the three alternatives for an activated role; their labels are in the meaning panel.

Metrics apply **only to the arrived, undirected dependency graph**: vertices, edges, connected components β₀, cycle rank β₁ = E − V + β₀, and crossings in token order. At partial input it can be a forest. Every complete teaching example is a connected tree. A crossing in an ordered tree is not a cycle; the test suite includes this negative control. Changing node/edge weights alone is not called a topological change. Phrase grouping and activated focus-candidate counts are reported separately from syntax.

## Checks

```sh
node --test tests/model.test.mjs
node scripts/build-demo.mjs
```

For browser checks, install `playwright-core` into a scratch directory, outside the repository, and use an existing Google Chrome installation. Set `PLAYWRIGHT_MODULE` to the absolute path of that package's `index.mjs` if it is not otherwise importable. Set `TEST_ARTIFACTS` to a scratch output directory, then run `node tests/browser-smoke.mjs` from this repository. The script tests direct-file standalone execution, typography, independent acoustic controls, bilingual operator scope, prefix replay, syllable position, tone preview, hash round-trip, JSON download, malformed state, keyboard controls, mobile overflow, console/CSP errors, and absence of HTTP requests. It writes desktop/mobile screenshots for visual inspection. No CI workflow or JVM/nbb fallback is added.

## Integration and qualification limits

The workspace architecture requires the canonical `kotoba-lang/wasm-webcomponent/src/kotoba-client-runtime.js` broker for shared end-user app integration. That source was absent during implementation on 2026-11-01. Integration is therefore **blocked**, and the demo is not claimed to be shared-runtime integrated. No product-local broker, descriptor validator, approval semantics, or substitute capability system is implemented. Its CSP denies network connections; the static demo needs no external operations.

Existing `main.tex`, PDF, and `src/generate_figures.py` predate this demo. The JUN-749 audit found that the earlier figures used fixed metrics and simulated distances while prose described corpus averages, and that non-projectivity was conflated with nonzero β₁. This implementation does not modify or substantiate those claims. Reproducible corpus analysis, formal derivation models, fitted cognitive parameters, audio recording/recognition, arbitrary sentences, and production hosting remain outside its qualification.

## Sources

- Ikegami (2011), [Subjective construal](https://doi.org/10.11517/jjsai.26.4_317): comparison of preferred construals.
- Rooth (1992), [A theory of focus interpretation](https://doi.org/10.1007/BF02342617): ordinary meaning and focus alternatives.
- Beckman & Elam, [ToBI guidelines](https://www.ling.ohio-state.edu/research/phonetics/E_ToBI/): pitch accents and boundaries; the demo is not a ToBI transcription.
- Fraundorf, Benjamin & Watson (2013), [What happened (and what didn't)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3763865/): experiments on font emphasis and discourse alternatives. These results motivate comparison, not this demo's coefficient values.
