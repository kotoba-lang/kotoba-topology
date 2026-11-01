import { EXAMPLES } from './examples.mjs';
import { analyze, createState, normalizeState, neutralCue, hasCase, canCapitalize, exportExperiment } from './model.mjs';

const $ = id => document.getElementById(id);
let state = createState(), timer = null, audio = null, soundEnd = null;
const svgNS = 'http://www.w3.org/2000/svg';
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function svgElement(tag, attributes, text) {
  const node = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
const rounded = n => n.toFixed(2);
function status(message) { $('status').textContent = message; }
function stopTimer() { if (timer) clearInterval(timer); timer = null; $('play').textContent = '▶'; $('play').setAttribute('aria-label', '逐次入力を再生'); }
function stopSound() {
  clearTimeout(soundEnd); const current = audio; audio = null;
  $('listen').textContent = '♪ 音高パターンを試聴';
  if (current && current.state !== 'closed') current.close().catch(() => {});
}

function readHash() {
  if (!location.hash.startsWith('#state=')) return;
  try {
    if (location.hash.length > 16000) throw new Error('large');
    const value = JSON.parse(decodeURIComponent(location.hash.slice(7)));
    if (value.version !== state.version) throw new Error('version');
    state = normalizeState(value); status('URLから実験状態を復元しました。');
  } catch { state = createState(); status('このURLの状態を読み取れませんでした。通常状態で開始します。'); }
}

function renderSentence(result) {
  const fragment = document.createDocumentFragment();
  result.sentence.tokens.forEach((token, i) => {
    const cue = state.cues[i];
    const button = element('button', ['word', cue.bold ? 'is-bold' : '', cue.italic ? 'is-italic' : '', result.evidence[i].total > 0 ? 'is-emphasized' : '', i >= state.step ? 'is-future' : '', cue.boundary ? 'has-boundary' : ''].join(' '));
    button.type = 'button'; button.dataset.token = i; button.lang = state.language;
    button.setAttribute('aria-pressed', String(i === state.selected));
    button.setAttribute('aria-label', `${token.text} を編集`);
    button.append(element('span', '', cue.caps ? token.text.toUpperCase() : token.text), element('span', 'word-index', String(i + 1).padStart(2, '0')));
    button.addEventListener('click', () => { state.selected = i; render(false); });
    fragment.append(button);
  });
  fragment.append(element('span', '', result.sentence.end));
  $('sentence').replaceChildren(fragment); $('sentence').classList.toggle('is-ja', state.language === 'ja');
}

function renderControls(result) {
  const cue = state.cues[state.selected], token = result.sentence.tokens[state.selected];
  $('selected-word').textContent = token.text;
  for (const key of ['bold', 'italic', 'caps']) $('' + key).setAttribute('aria-pressed', String(cue[key]));
  $('caps').disabled = !canCapitalize(token.text);
  $('case-note').textContent = !hasCase(token.text) ? 'この語には大文字・小文字の区別がありません。' : !canCapitalize(token.text) ? 'この語は既に全大文字のため、大文字化による追加の強調はありません。' : '書式はこの語だけに適用。別の語も独立に編集できます。';
  for (const key of ['pitch', 'energy', 'duration']) { $(key).value = cue[key]; $(`${key}-value`).value = key === 'duration' ? `${cue[key].toFixed(2)}×` : `${Math.round(cue[key] * 100)}%`; }
  $('syllable').replaceChildren(...token.syllables.map((text, i) => {
    const option = element('option', '', `${i + 1} · ${text}`); option.value = i; return option;
  }));
  $('syllable').value = cue.syllable; $('syllable').disabled = token.syllables.length < 2;
  $('boundary').checked = cue.boundary;
  $('step').max = result.sentence.tokens.length; $('step').value = state.step;
  $('step-value').value = `${state.step} / ${result.sentence.tokens.length}`;
}

function renderGraph(result) {
  const graph = $('graph'), nodes = [], n = result.sentence.tokens.length, x = i => 45 + i * (760 / Math.max(1, n - 1));
  const definitions = svgElement('defs', {}), arrow = svgElement('marker', { id: 'syntax-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
  arrow.append(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#778588' })); definitions.append(arrow); nodes.push(definitions);
  const visibleEdges = new Set(result.edges.map(edge => edge.join(',')));
  result.sentence.tokens.forEach((token, i) => {
    if (token.head === null) return;
    const start = x(token.head), end = x(i), height = 34 + Math.abs(token.head - i) * 16;
    const future = !visibleEdges.has([token.head, i].join(','));
    nodes.push(svgElement('path', { d: `M ${start} 165 Q ${(start + end) / 2} ${165 - height * 2} ${end} 165`, class: `syntax-edge${future ? ' future-edge' : ''}`, 'marker-end': 'url(#syntax-arrow)' }));
    nodes.push(svgElement('text', { x: (start + end) / 2, y: 155 - height, 'text-anchor': 'middle', class: `edge-label${future ? ' future-node' : ''}` }, token.relation));
  });
  result.sentence.tokens.forEach((token, i) => {
    const visible = i < state.step, evidence = result.evidence[i].total;
    const group = svgElement('g', { class: visible ? '' : 'future-node' });
    group.append(svgElement('circle', { cx: x(i), cy: 177, r: 9 + Math.min(evidence * 3, 7), class: `token-node${evidence > 0 ? ' focused' : ''}` }));
    if (i === state.selected) group.append(svgElement('circle', { cx: x(i), cy: 177, r: 20, class: 'selected-node' }));
    group.append(svgElement('text', { x: x(i), y: 213, 'text-anchor': 'middle', class: 'token-label' }, state.cues[i].caps ? token.text.toUpperCase() : token.text));
    nodes.push(group);
    if (visible && token.role && evidence > 0) {
      for (const offset of [-12, 0, 12]) {
        nodes.push(svgElement('path', { d: `M ${x(i)} 219 L ${x(i) + offset} 242`, class: 'focus-link' }));
        nodes.push(svgElement('circle', { cx: x(i) + offset, cy: 242, r: 3, class: 'focus-dot' }));
      }
      nodes.push(svgElement('text', { x: x(i), y: 262, 'text-anchor': 'middle', class: 'focus-label' }, `${result.example.roles[token.role].question} · 3候補`));
    }
  });
  graph.replaceChildren(...nodes);
  const m = result.metrics;
  const metrics = [['入力済み統語辺', m.edges], ['β₀', m.components], ['β₁', m.beta1], ['交差', m.crossings], ['句グループ', result.chunks.length], ['焦点候補', result.focusEdges.length]];
  $('graph-metrics').replaceChildren(...metrics.map(([label, value]) => { const node = element('span', 'metric', label); node.append(element('strong', '', String(value))); return node; }));
}

function renderProsody(result) {
  const nodes = [svgElement('line', { x1: 16, x2: 834, y1: 58, y2: 58, class: 'prosody-base' })];
  const durationSum = state.cues.reduce((sum, cue) => sum + cue.duration, 0);
  let cursor = 22;
  result.sentence.tokens.forEach((token, i) => {
    const cue = state.cues[i], width = 800 * cue.duration / durationSum, available = width - 12;
    const points = token.syllables.flatMap((syllable, s) => {
      const part = available / token.syllables.length, start = cursor + part * s;
      const peak = 52 - (s === cue.syllable ? cue.pitch * 32 : 0);
      nodes.push(svgElement('text', { x: start + part / 2, y: 82, 'text-anchor': 'middle', class: 'syllable-text' }, syllable));
      return [`${start},52`, `${start + part * .55},${peak}`, `${start + part},52`];
    });
    const contour = svgElement('polyline', { points: points.join(' '), class: `prosody-line${i >= state.step ? ' future-node' : ''}` });
    contour.style.strokeWidth = String(1.5 + cue.energy * 3); nodes.push(contour);
    if (cue.boundary) nodes.push(svgElement('line', { x1: cursor + width - 6, x2: cursor + width - 6, y1: 10, y2: 92, class: 'prosody-boundary' }));
    cursor += width;
  });
  $('prosody').replaceChildren(...nodes);
}

function renderMeaning(result) {
  $('ordinary').textContent = result.sentence.ordinary;
  $('focus-label').textContent = !result.complete ? 'INPUT IN PROGRESS / 入力途中' : result.uniqueFocus ? `${result.example.roles[result.uniqueFocus].label}の焦点` : result.leaders.length > 1 ? '複数の焦点 / 同点' : 'NEUTRAL / 焦点未指定';
  $('reading').textContent = result.reading;
  $('operator').textContent = result.operator;
  $('alternatives').replaceChildren(...result.focusEdges.map(({ role, label }) => element('span', 'alt-chip', `${result.example.roles[role].label}：${label}`)));
  $('unsupported').hidden = !result.unsupported;
  $('unsupported').textContent = '機能語にも表現上の強調があります。この例ではその意味候補を注釈していないため、意味スコアへは反映しません。';
  $('weights').replaceChildren(...result.focus.map(item => {
    const row = element('div', 'weight-row'); row.dataset.role = item.role;
    const track = element('div', 'weight-track'), fill = element('span', 'weight-fill'), reference = element('span', 'weight-reference');
    fill.style.width = `${item.share * 100}%`; reference.style.left = `${item.baseline * 100}%`; track.append(fill, reference);
    const delta = (item.share - item.baseline) * 100, number = element('span', 'weight-number', `${(item.share * 100).toFixed(1)}%`);
    number.append(element('span', 'weight-delta', `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pt`));
    row.append(element('span', '', item.label), track, number); return row;
  }));
  const evidence = result.evidence[state.selected];
  $('contribution').replaceChildren(...[['選択語の文字寄与', evidence.visual], ['韻律寄与', evidence.acoustic], ['合計', evidence.total]].map(([label, score]) => { const node = element('span', '', `${label} `); node.append(element('strong', '', rounded(score))); return node; }));
  $('operations').replaceChildren(...result.operations.map((operation, i) => {
    const row = element('div', 'operation'); row.append(element('span', 'operation-index', String(i + 1).padStart(2, '0')), element('span', '', operation.name), element('span', 'operation-detail', operation.detail)); return row;
  }));
}

function render(replaceSentence = true) {
  const result = analyze(state); state = result.state;
  $('scene').textContent = result.example.scene; $('context').textContent = result.example.context;
  $('example').value = state.exampleId;
  for (const language of ['en', 'ja']) $(`lang-${language}`).setAttribute('aria-pressed', String(state.language === language));
  // Preserve keyboard focus while replacing token buttons after an edit.
  const tokenFocus = document.activeElement?.dataset.token;
  renderSentence(result); renderControls(result); renderGraph(result); renderProsody(result); renderMeaning(result);
  if (!replaceSentence || tokenFocus !== undefined) $('sentence').querySelector(`[data-token="${state.selected}"]`)?.focus({ preventScroll: true });
}

function updateCue(patch) { stopSound(); Object.assign(state.cues[state.selected], patch); render(); }
function changeExample(exampleId, language) { stopTimer(); stopSound(); state = createState(exampleId, language); render(); status('通常状態から開始しました。語を選んで強調できます。'); }

for (const example of EXAMPLES) { const option = element('option', '', example.label); option.value = example.id; $('example').append(option); }
for (const language of ['en', 'ja']) $(`lang-${language}`).addEventListener('click', () => changeExample(state.exampleId, language));
$('example').addEventListener('change', event => changeExample(event.target.value, state.language));
for (const key of ['bold', 'italic', 'caps']) $(key).addEventListener('click', () => updateCue({ [key]: !state.cues[state.selected][key] }));
for (const key of ['pitch', 'energy', 'duration']) $(key).addEventListener('input', event => updateCue({ [key]: Number(event.target.value) }));
$('syllable').addEventListener('change', event => updateCue({ syllable: Number(event.target.value) }));
$('boundary').addEventListener('change', event => updateCue({ boundary: event.target.checked }));
$('clear-word').addEventListener('click', () => { stopSound(); state.cues[state.selected] = neutralCue(); render(); });
$('reset').addEventListener('click', () => { stopTimer(); stopSound(); state.cues = state.cues.map(neutralCue); state.step = state.cues.length; render(); status('文字・韻律・句境界をすべて通常状態に戻しました。'); });
$('demo').addEventListener('click', () => {
  stopTimer(); stopSound(); state.cues = state.cues.map(neutralCue); state.step = state.cues.length;
  const result = analyze(state); state.selected = Math.max(0, result.sentence.tokens.findIndex(token => token.role === 'color' || token.role === 'theme'));
  Object.assign(state.cues[state.selected], { bold: true, pitch: .7, energy: .5, duration: 1.4 }); render(); status('文字と韻律を組み合わせた例です。各設定を個別に変えて比較できます。');
});
$('step').addEventListener('input', event => { stopTimer(); stopSound(); state.step = Number(event.target.value); render(); });
$('play').addEventListener('click', () => {
  stopSound();
  if (timer) { stopTimer(); return; }
  if (state.step >= state.cues.length) state.step = 0;
  $('play').textContent = 'Ⅱ'; $('play').setAttribute('aria-label', '逐次入力を停止'); render();
  timer = setInterval(() => { state.step++; render(); if (state.step >= state.cues.length) stopTimer(); }, 750);
});
$('save-link').addEventListener('click', () => {
  try { history.replaceState(null, '', `#state=${encodeURIComponent(JSON.stringify(normalizeState(state)))}`); status('このURLに設定を保存しました。アドレスをコピーすると同じ状態を開けます。'); }
  catch { status('URLへ保存できませんでした。JSON書き出しで状態を保存できます。'); }
});
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(exportExperiment(state), null, 2)], { type: 'application/json' }));
  const link = element('a'); link.href = url; link.download = `kotoba-${state.exampleId}-${state.language}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); status('モデルの係数・設定・結果をJSONで書き出しました。');
});
$('listen').addEventListener('click', async () => {
  if (audio) { stopSound(); return; }
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('unavailable');
    const current = new Audio(); audio = current; await current.resume();
    if (audio !== current) return;
    const result = analyze(state); let cursor = current.currentTime + .05;
    result.sentence.tokens.slice(0, state.step).forEach((token, i) => {
      const cue = state.cues[i], total = .28 * cue.duration;
      token.syllables.forEach((_, s) => {
        const oscillator = current.createOscillator(), gain = current.createGain(), duration = total / token.syllables.length;
        const emphasized = s === cue.syllable;
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(180, cursor);
        oscillator.frequency.linearRampToValueAtTime(180 * 2 ** ((emphasized ? cue.pitch : 0) * .7), cursor + duration * .5);
        oscillator.frequency.linearRampToValueAtTime(180, cursor + duration);
        gain.gain.setValueAtTime(0, cursor); gain.gain.linearRampToValueAtTime(.04 + cue.energy * .04, cursor + .015);
        gain.gain.linearRampToValueAtTime(0, cursor + duration);
        oscillator.connect(gain); gain.connect(current.destination); oscillator.start(cursor); oscillator.stop(cursor + duration); cursor += duration;
      });
      cursor += cue.boundary ? .25 : .06;
    });
    $('listen').textContent = '■ 試聴を止める'; status('端末内の電子音で音高パターンを再生します。実際の発音や語強勢の再現ではありません。');
    soundEnd = setTimeout(async () => { if (audio === current) { audio = null; await current.close(); $('listen').textContent = '♪ 音高パターンを試聴'; } }, Math.max(50, (cursor - current.currentTime) * 1000));
  } catch { stopSound(); status('この環境では電子音の再生を開始できませんでした。模式図で比較できます。'); }
});
window.addEventListener('hashchange', () => { stopTimer(); stopSound(); readHash(); render(); });
window.addEventListener('pagehide', () => { stopTimer(); stopSound(); });
document.querySelectorAll('.graph-scroll').forEach(region => {
  region.tabIndex = 0; region.setAttribute('role', 'region');
  region.setAttribute('aria-label', `${region.querySelector('svg').getAttribute('aria-label')}。狭い画面では左右キーでスクロールできます。`);
});
readHash(); render();
