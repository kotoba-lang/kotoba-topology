import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES } from '../web/examples.mjs';
import { analyze, createState, normalizeState, graphMetrics, exportExperiment } from '../web/model.mjs';

test('all bilingual annotations form connected acyclic dependency trees', () => {
  for (const example of EXAMPLES) for (const language of ['ja', 'en']) {
    const result = analyze(createState(example.id, language));
    assert.equal(result.metrics.components, 1, `${example.id}/${language}`);
    assert.equal(result.metrics.beta1, 0);
    assert.equal(result.metrics.edges, result.sentence.tokens.length - 1);
    assert.equal(result.metrics.crossings, 0);
    assert.ok(result.focus.every(item => item.share === item.baseline));
  }
});
test('crossing edges are not cycles', () => assert.deepEqual(graphMetrics(4, [[0, 1], [0, 2], [1, 3]]), { vertices: 4, edges: 3, components: 1, beta1: 0, crossings: 1 }));
test('independent typography/acoustic controls change focus but preserve syntax', () => {
  for (const cue of [{ bold: true }, { italic: true }, { caps: true }, { pitch: 1 }, { energy: 1 }, { duration: 2 }]) {
    const state = createState(); Object.assign(state.cues[3], cue);
    const result = analyze(state);
    assert.equal(result.uniqueFocus, 'color');
    assert.ok(result.focus[0].share > result.focus[0].baseline);
    assert.deepEqual(result.metrics, analyze(createState()).metrics);
    assert.match(result.operator, /通常の命題/);
  }
});
test('English only alternatives move with focus; Japanese dake scope stays annotated', () => {
  const state = createState('introduction'); state.cues[3].bold = true;
  assert.match(analyze(state).operator, /人物は Maya だけ/);
  state.cues[3].bold = false; state.cues[5].italic = true;
  assert.match(analyze(state).operator, /相手は Ken だけ/);
  const ja = createState('introduction', 'ja'); ja.cues[2].bold = true;
  assert.equal(analyze(ja).uniqueFocus, 'theme');
  assert.match(analyze(ja).operator, /作用域は自動で移動しません/);
});
test('post-subject only does not restrict an emphasized subject outside its annotated domain', () => {
  const state = createState('introduction'); state.cues[0].bold = true;
  const result = analyze(state);
  assert.equal(result.uniqueFocus, 'agent');
  assert.doesNotMatch(result.operator, /紹介したのは私だけ/);
  assert.match(result.operator, /主語.*限定しません/);
  state.cues[0].bold = false; state.cues[2].bold = true;
  assert.match(analyze(state).operator, /紹介しただけ/);
});
test('capitalization contributes only when it changes the visible spelling', () => {
  const state = createState(); state.cues[0].caps = true;
  const result = analyze(state);
  assert.equal(result.state.cues[0].caps, false);
  assert.equal(result.evidence[0].visual, 0);
  assert.equal(result.uniqueFocus, null);
  state.cues[4].caps = true;
  assert.equal(analyze(state).uniqueFocus, 'theme');
});
test('incomplete input exports pending composition, never an interpretation using future arguments', () => {
  for (const language of ['en', 'ja']) {
    const state = createState('introduction', language);
    state.cues[language === 'en' ? 3 : 2].bold = true;
    for (let step = 0; step < state.cues.length; step++) {
      state.step = step;
      const result = exportExperiment(state).result;
      assert.equal(result.complete, false);
      assert.match(result.operator, /入力途中.*保留/);
    }
    state.step = state.cues.length;
    assert.doesNotMatch(exportExperiment(state).result.operator, /入力途中/);
  }
});
test('case has no artificial effect on uncased Japanese; function words remain unmodeled', () => {
  const state = createState('purchase', 'ja'); state.cues[2].caps = true;
  assert.equal(analyze(state).active.length, 0);
  state.cues[1].bold = true;
  assert.equal(analyze(state).active.length, 0);
  assert.equal(analyze(state).unsupported, true);
});
test('prefix does not leak future cues; chunk boundaries alter grouping not syntax', () => {
  const state = createState(); state.step = 2; state.cues[3].bold = true;
  assert.equal(analyze(state).active.length, 0);
  state.cues[0].boundary = true;
  assert.equal(analyze(state).chunks.length, 2);
  assert.equal(analyze(state).metrics.beta1, 0);
  state.step = 0;
  assert.equal(analyze(state).metrics.components, 0);
  assert.equal(analyze(state).unresolved, 0);
});
test('ties stay ambiguous; normalized shares sum to one', () => {
  const state = createState(); state.cues[0].bold = true; state.cues[3].bold = true;
  const result = analyze(state);
  assert.equal(result.uniqueFocus, null); assert.equal(result.leaders.length, 2);
  assert.ok(Math.abs(result.focus.reduce((sum, item) => sum + item.share, 0) - 1) < 1e-12);
});
test('state decoder clamps hostile or outdated state and export reproduces analysis', () => {
  for (const value of [null, 3, 'bad', { exampleId: '<script>', selected: Infinity, step: -20, cues: [{ duration: NaN, pitch: 100, bold: 'yes', syllable: 1000 }] }]) {
    const state = normalizeState(value), result = analyze(state);
    assert.ok(state.step >= 0); assert.ok(Number.isFinite(result.focus[0].share));
    assert.ok(state.cues[0].duration >= 1); assert.ok(state.cues[0].pitch <= 1);
  }
  const state = createState(); state.cues[3].italic = true;
  const exported = JSON.parse(JSON.stringify(exportExperiment(state)));
  assert.deepEqual(analyze(exported.state).focus, analyze(state).focus);
  assert.equal(exported.kind, 'illustrative-model-not-observed-data');
});
