import { getExample } from './examples.mjs';

export const MODEL_VERSION = 'emphasis-lab/1';
export const COEFFICIENTS = Object.freeze({ bold: 0.45, italic: 0.30, caps: 0.35, pitch: 0.45, energy: 0.35, duration: 0.40 });
export const neutralCue = () => ({ bold: false, italic: false, caps: false, pitch: 0, energy: 0, duration: 1, boundary: false, syllable: 0 });
const clamp = (value, min, max, fallback = min) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export const hasCase = text => text.toUpperCase() !== text.toLowerCase();
export const canCapitalize = text => text !== text.toUpperCase();

export function createState(exampleId = 'purchase', language = 'en') {
  const example = getExample(exampleId);
  language = language === 'ja' ? 'ja' : 'en';
  const tokens = example[language].tokens;
  return { version: MODEL_VERSION, exampleId: example.id, language, selected: 0, step: tokens.length, cues: tokens.map(neutralCue) };
}

// A bounded data decoder, not a capability or consent validator.
export function normalizeState(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  const state = createState(input.exampleId, input.language);
  const tokens = getExample(state.exampleId)[state.language].tokens;
  state.selected = Math.trunc(clamp(input.selected, 0, tokens.length - 1));
  state.step = Math.trunc(clamp(input.step, 0, tokens.length, tokens.length));
  state.cues = tokens.map((token, i) => {
    const cue = input.cues?.[i] ?? {};
    return { bold: cue.bold === true, italic: cue.italic === true, caps: canCapitalize(token.text) && cue.caps === true,
      pitch: clamp(cue.pitch, 0, 1), energy: clamp(cue.energy, 0, 1), duration: clamp(cue.duration, 1, 2, 1),
      boundary: cue.boundary === true, syllable: Math.trunc(clamp(cue.syllable, 0, token.syllables.length - 1)) };
  });
  return state;
}

export function cueEvidence(token, cue) {
  const c = COEFFICIENTS;
  const visual = c.bold * Number(cue.bold) + c.italic * Number(cue.italic) + c.caps * Number(cue.caps && canCapitalize(token.text));
  const acoustic = c.pitch * cue.pitch + c.energy * cue.energy + c.duration * (cue.duration - 1);
  return { visual, acoustic, total: visual + acoustic };
}

export function graphMetrics(vertexCount, edges) {
  const parent = Array.from({ length: vertexCount }, (_, i) => i);
  const root = i => parent[i] === i ? i : (parent[i] = root(parent[i]));
  for (const [a, b] of edges) { const x = root(a), y = root(b); if (x !== y) parent[x] = y; }
  const components = new Set(parent.map((_, i) => root(i))).size;
  const crossings = edges.reduce((count, [a, b], i) => count + edges.slice(i + 1).filter(([c, d]) => {
    const [l, r] = [a, b].sort((x, y) => x - y), [s, t] = [c, d].sort((x, y) => x - y);
    return l < s && s < r && r < t || s < l && l < t && t < r;
  }).length, 0);
  return { vertices: vertexCount, edges: edges.length, components, beta1: edges.length - vertexCount + components, crossings };
}

function operatorReading(sentence, focusRole) {
  if (sentence.operator === 'predicate-fixed') return '「だけ」はこの注釈では述語句に対応：紹介しただけ。他の語を強調しても限定の作用域は自動で移動しません。';
  if (!focusRole) return sentence.operator ? 'only の焦点は未指定。文脈と韻律によって解釈が決まります。' : '明示的な限定演算子はありません。強調だけから他の候補を否定しません。';
  if (sentence.operator === 'focus-sensitive') {
    if (!sentence.operatorDomain.includes(focusRole)) return 'この位置の only は主語 I を限定しません。「私だけ」には Only I … のような配置が必要です。';
    return ({ theme: '候補となる読み：Ken に紹介した人物は Maya だけ。', recipient: '候補となる読み：Maya を紹介した相手は Ken だけ。', action: '候補となる読み：紹介しただけで、別の行為まではしていない。' })[focusRole];
  }
  return '通常の命題は保ち、対比・問いへの答え・談話上の焦点が変わるモデルです。';
}

export function analyze(input) {
  const state = normalizeState(input), example = getExample(state.exampleId), sentence = example[state.language];
  const visible = sentence.tokens.slice(0, state.step);
  const evidence = sentence.tokens.map((token, i) => i < state.step ? cueEvidence(token, state.cues[i]) : { visual: 0, acoustic: 0, total: 0 });
  const roleEvidence = Object.fromEntries(Object.keys(example.roles).map(role => [role, 0]));
  visible.forEach((token, i) => { if (token.role) roleEvidence[token.role] += evidence[i].total; });
  // Uniform reference prior. These shares are illustrative scores, NOT probabilities of human interpretations.
  const denominator = Object.values(roleEvidence).reduce((sum, score) => sum + Math.exp(score), 0);
  const reference = 1 / Object.keys(roleEvidence).length;
  const focus = Object.entries(roleEvidence).map(([role, score]) => ({ role, score, share: Math.exp(score) / denominator, baseline: reference, ...example.roles[role] })).sort((a, b) => b.score - a.score);
  const active = focus.filter(item => item.score > 0);
  const leaders = active.filter(item => Math.abs(item.score - active[0].score) < 1e-9);
  const uniqueFocus = leaders.length === 1 ? leaders[0].role : null;
  const edges = visible.flatMap((token, i) => token.head !== null && token.head < state.step ? [[token.head, i]] : []);
  const chunks = [];
  visible.forEach((_, i) => { if (!chunks.length || i > 0 && state.cues[i - 1].boundary) chunks.push([]); chunks.at(-1).push(i); });
  const unresolved = visible.filter(token => token.head !== null && token.head >= state.step).length;
  const focusEdges = active.flatMap(item => item.alternatives.map(label => ({ role: item.role, label })));
  const unsupported = visible.some((token, i) => !token.role && evidence[i].total > 0);
  const complete = state.step === sentence.tokens.length;
  const operator = complete ? operatorReading(sentence, uniqueFocus) : '入力途中。文全体の解釈は保留。';
  return { state, example, sentence, evidence, focus, active, leaders, uniqueFocus, edges, metrics: graphMetrics(visible.length, edges), chunks, unresolved, focusEdges, unsupported,
    complete,
    reading: !active.length ? '焦点未指定。通常体は等しい参照スコアで表示します。' : uniqueFocus ? example.readings[uniqueFocus] : '複数の焦点が同点です。複合焦点・文脈による曖昧さを残します。',
    operator,
    operations: [
      { name: '入力を受け取る', detail: `${state.step} / ${sentence.tokens.length} 語。表記と韻律を独立に取得。` },
      { name: '統語関係を接続', detail: `入力済みの辺 ${edges.length} 本。未到着の主要部を待つ語 ${unresolved} 個。` },
      { name: '焦点を重みづけ', detail: `活性化した役割 ${active.length} 個。文字と韻律の寄与を加算。` },
      { name: '代替候補を展開', detail: `${focusEdges.length} 個の注釈済み候補。新しい事実を断定しない。` },
      { name: '意味を合成', detail: operator },
    ],
  };
}

export function exportExperiment(state) {
  const result = analyze(state);
  return { modelVersion: MODEL_VERSION, kind: 'illustrative-model-not-observed-data', coefficients: COEFFICIENTS, state: result.state,
    result: { focus: result.focus, metrics: result.metrics, chunks: result.chunks, unresolved: result.unresolved, complete: result.complete, reading: result.reading, operator: result.operator },
    annotations: 'Hand-annotated bilingual examples; no automatic parsing, acoustic recognition or empirical cognitive estimates.' };
}
