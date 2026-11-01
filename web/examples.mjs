// Hand-annotated teaching examples, not parser output or a measured corpus.
const token = (text, role, head, relation, syllables = [text]) => ({ text, role, head, relation, syllables });
const roles = {
  agent: { label: '行為者', question: '誰が？', alternatives: ['私', '他の人', 'その場の別の人物'] },
  action: { label: '行為・変化', question: '何をした／何が起きた？', alternatives: ['この行為', '別の行為', '文脈で対比される行為'] },
  theme: { label: '対象', question: '何を／誰を？', alternatives: ['この対象', '別の対象', '文脈で対比される対象'] },
  color: { label: '性質・色', question: 'どんな色？', alternatives: ['赤', '青', '別の色'] },
  recipient: { label: '相手', question: '誰に？', alternatives: ['ケン', 'ユイ', '別の相手'] },
};
const buyMeaning = {
  agent: '「私が」で対比する。他の人が買った可能性と区別する。',
  action: '「買った」を対比する。借りた・見ただけ等が候補になる。',
  theme: '「車」を対比する。別の購入物が候補になる。',
  color: '「赤い」を対比する。他の色が候補になる。',
};
const introMeaning = {
  agent: '紹介した行為者を対比する。',
  action: '紹介という行為を、別の関わり方と対比する。',
  theme: '紹介された人物を、他の人物と対比する。',
  recipient: '紹介先を、他の相手と対比する。',
};
export const EXAMPLES = [
  { id: 'purchase', label: '赤い車 / a red car', scene: '色・対象・行為者の対比',
    context: '青い車や自転車も候補にある場面。誰が、何を、どんな色で買ったのかを対比します。',
    roles: { agent: roles.agent, action: roles.action, color: roles.color,
      theme: { ...roles.theme, alternatives: ['車', '自転車', '別の購入物'] } },
    readings: buyMeaning,
    en: { tokens: [token('I', 'agent', 1, 'nsubj'), token('bought', 'action', null, 'root'), token('a', null, 4, 'det'), token('red', 'color', 4, 'amod'), token('car', 'theme', 1, 'obj')], end: '.', ordinary: '私は赤い車を買った。', operator: null },
    ja: { tokens: [token('私', 'agent', 5, 'nsubj'), token('は', null, 0, 'case'), token('赤い', 'color', 3, 'amod'), token('車', 'theme', 5, 'obj'), token('を', null, 3, 'case'), token('買った', 'action', null, 'root')], end: '。', ordinary: '私は赤い車を買った。', operator: null },
  },
  { id: 'introduction', label: '紹介 / introduction', scene: 'only と「だけ」の作用域',
    context: 'マヤ・ケン以外の人物や、紹介以外の行為も話題になっている場面。英語 only は焦点と対応づけ、日本語は述語句に付く「だけ」を固定した注釈で比較します。',
    roles: { agent: roles.agent, action: roles.action,
      theme: { ...roles.theme, alternatives: ['マヤ', 'リナ', '別の人物'] }, recipient: roles.recipient },
    readings: introMeaning,
    en: { tokens: [token('I', 'agent', 2, 'nsubj'), token('only', null, 2, 'advmod', ['on', 'ly']), token('introduced', 'action', null, 'root', ['in', 'tro', 'duced']), token('Maya', 'theme', 2, 'obj', ['Ma', 'ya']), token('to', null, 5, 'case'), token('Ken', 'recipient', 2, 'obl')], end: '.', ordinary: '私はマヤをケンに紹介した。', operator: 'focus-sensitive', operatorDomain: ['action', 'theme', 'recipient'] },
    ja: { tokens: [token('私', 'agent', 6, 'nsubj'), token('は', null, 0, 'case'), token('マヤ', 'theme', 6, 'obj'), token('を', null, 2, 'case'), token('ケン', 'recipient', 6, 'obl'), token('に', null, 4, 'case'), token('紹介した', 'action', null, 'root'), token('だけ', null, 6, 'advmod'), token('だ', null, 6, 'aux')], end: '。', ordinary: '私はマヤをケンに紹介しただけだ。', operator: 'predicate-fixed' },
  },
  { id: 'agency', label: '窓を割る / break a window', scene: '行為者を明示する事態把握',
    context: '同じ窓の破損を、行為者の行為として語る例。「窓が割れる」と比較できます。',
    roles: { agent: roles.agent, action: roles.action,
      theme: { ...roles.theme, alternatives: ['窓', 'グラス', '別の物'] } },
    readings: { agent: '破損を起こした人物を対比する。', action: '割ったことを、開けた・触った等と対比する。', theme: '割れた対象を対比する。' },
    en: { tokens: [token('I', 'agent', 1, 'nsubj'), token('broke', 'action', null, 'root'), token('the', null, 3, 'det'), token('window', 'theme', 1, 'obj', ['win', 'dow'])], end: '.', ordinary: '私は窓を割った。', operator: null },
    ja: { tokens: [token('私', 'agent', 4, 'nsubj'), token('は', null, 0, 'case'), token('窓', 'theme', 4, 'obj'), token('を', null, 2, 'case'), token('割った', 'action', null, 'root')], end: '。', ordinary: '私は窓を割った。', operator: null },
  },
  { id: 'event', label: '窓が割れる / a window breaks', scene: '変化を中心にする事態把握',
    context: '窓の破損を変化として語る例。行為者が存在しないという主張ではなく、この文では明示されていません。',
    roles: { theme: { ...roles.theme, alternatives: ['窓', 'グラス', '別の物'] }, action: roles.action },
    readings: { theme: '何が割れたかを対比する。', action: '起きた変化を、開いた・揺れた等と対比する。' },
    en: { tokens: [token('The', null, 1, 'det'), token('window', 'theme', 2, 'nsubj', ['win', 'dow']), token('broke', 'action', null, 'root')], end: '.', ordinary: '窓が割れた。行為者は明示されない。', operator: null },
    ja: { tokens: [token('窓', 'theme', 2, 'nsubj'), token('が', null, 0, 'case'), token('割れた', 'action', null, 'root')], end: '。', ordinary: '窓が割れた。行為者は明示されない。', operator: null },
  },
];
export const getExample = id => EXAMPLES.find(example => example.id === id) ?? EXAMPLES[0];
