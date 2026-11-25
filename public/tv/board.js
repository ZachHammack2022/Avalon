// TV record board: the quest shields plus the whole vote record (players down the side, every proposal across,
// grouped by quest), kept on screen beside the campfire so the table can argue from it. Data comes from
// shared/record.js. boardTree() is pure (unit-tested in Node); toDom() turns the tree into elements in the browser.
import { recordFor } from '../../shared/record.js';
import { ROLE_INFO } from '../../shared/roles-info.js';
import { MAX_REJECTS } from '../../shared/avalon.js';

/** A tiny element description: {tag, cls, kids, attrs}. Strings in kids become text. */
const el = (tag, cls, kids = [], attrs) => {
  const out = { tag, cls: cls || '', kids: [].concat(kids).filter((k) => k != null && k !== false && k !== '') };
  if (attrs) out.attrs = attrs;
  return out;
};
const GLYPH = { yes: '✔', no: '✘', in: '?' };
export const FLIP_START = 0.25; // seconds; matches the 3D vote tokens popping over heads (campfire-view.js)
export const FLIP_STEP = 0.22;

/**
 * @param {object} pub public state
 * @param {{flip?: string|null}} o  flip: key of a freshly revealed column whose cells turn over one by one
 * @returns {object|null} element tree for #board's children, or null before the game
 */
export function boardTree(pub, { flip = null } = {}) {
  const rec = recordFor(pub);
  if (!rec) return null;
  const shields = el('div', 'bd-quests', rec.quests.map((q) => el('div', `bq ${q.outcome || (q.current ? 'current' : 'pending')}`, [
    el('div', 'q', el('b', '', q.outcome === 'success' ? '✔' : q.outcome === 'fail' ? '✘' : String(q.index + 1))),
    el('small', '', q.size ? `${q.size} go` : ''),
    q.fails > 1 && !q.outcome ? el('small', 'two', '2 fails') : null,
    // Classic mode makes the number of Fail cards public: it stays under the shield for the rest of the game
    q.outcome && q.failCount != null ? el('small', `fc${q.failCount ? ' some' : ''}`, `${q.failCount} Fail${q.failCount === 1 ? '' : 's'}`) : null,
  ])));
  const rejects = el('div', 'bd-rej', [el('span', '', `Rejected ${rec.rejectCount}/${MAX_REJECTS}`), el('div', 'pips', Array.from({ length: MAX_REJECTS }, (_, i) => el('i', i < rec.rejectCount ? 'on' : '')))]);
  const top = el('div', 'bd-top', [shields, rejects]);
  if (rec.empty) return [top, el('p', 'bd-empty', 'Every proposal and vote will be recorded here.')];

  const cols = rec.columns;
  const groups = rec.quests.filter((q) => q.cols.length);
  const firstOfQuest = new Set(groups.map((q) => q.cols[0]));
  const questOf = (c) => rec.quests[c.questIndex];
  const head = el('tr', '', [
    el('th', 'nm', ''),
    ...groups.map((q) => el('th', `qh qs ${q.outcome || (q.current ? 'current' : '')}`, `Q${q.index + 1}`, { colspan: String(q.cols.length) })),
  ]);
  const marks = { hero: false, blamed: false, auto: false };
  const body = rec.rows.map((r, ri) => {
    const role = r.role ? ROLE_INFO[r.role] : null;
    return el('tr', [role ? `team-${role.team}` : '', r.away ? 'away' : ''].filter(Boolean).join(' '), [
      el('th', 'nm', [el('i', 'dot', [], { style: `background:${r.color || '#888'}` }), el('span', 'n', r.name),
        role ? el('span', 'role', role.name) : r.away ? el('span', 'aw', 'away') : null]),
      ...cols.map((c, ci) => {
        const cell = r.cells[ci];
        const q = questOf(c);
        const sent = c.approved === true;
        const cls = ['c', cell.vote || 'none',
          cell.onTeam ? 'team' : '', cell.leader ? 'lead' : '',
          c.live ? 'live' : '', c.approved === false ? 'rej' : '',
          sent && cell.onTeam ? `went ${c.outcome || 'pending'}` : '',
          firstOfQuest.has(c.key) ? 'qs' : '',
          cell.standIn ? 'auto' : '',
          flip === c.key ? 'flip' : ''].filter(Boolean).join(' ');
        if (cell.standIn) marks.auto = true;
        const mark = sent && c.outcome === 'fail' && q.culprit === r.id ? el('sub', 'mk blamed', '☠') : sent && c.outcome === 'success' && q.hero === r.id ? el('sub', 'mk hero', '★') : null;
        if (mark) marks[mark.cls.split(' ')[1]] = true;
        return el('td', cls, [GLYPH[cell.vote] || '', cell.leader ? el('sup', 'crown', '♛') : null, mark],
          flip === c.key ? { style: `animation-delay:${(FLIP_START + ri * FLIP_STEP).toFixed(2)}s` } : undefined);
      }),
    ]);
  });
  const grid = el('table', 'bd-grid', [el('thead', '', head), el('tbody', '', body)], { style: `--cols:${cols.length}` });
  const legend = el('div', 'bd-legend', [
    el('span', '', [el('b', 'lg yes', '✔'), 'approve']), el('span', '', [el('b', 'lg no', '✘'), 'reject']),
    el('span', '', [el('b', 'lg team', ''), 'on the team']), el('span', '', [el('b', 'lg crown', '♛'), 'leader']),
    el('span', '', [el('b', 'lg fail', ''), 'quest failed']),
    // the story's marks, explained once they are on the board
    marks.hero ? el('span', '', [el('b', 'lg hero', '★'), 'hero']) : null,
    marks.blamed ? el('span', '', [el('b', 'lg blamed', '☠'), 'blamed']) : null,
    marks.auto ? el('span', '', [el('b', 'lg auto', ''), 'stand-in vote']) : null,
  ]);
  return [top, grid, legend];
}

/** Key of the column to flip: the newest one, if it was revealed since `prevRevealed` columns were known. */
export function flipKeyFor(pub, prevRevealed) {
  const n = pub && pub.game && pub.game.history ? pub.game.history.length : 0;
  return pub && pub.phase === 'voteReveal' && prevRevealed != null && n > prevRevealed ? `c${n - 1}` : null;
}

/** Browser only: element tree -> DOM nodes. */
export function toDom(node, doc = document) {
  if (typeof node === 'string') return doc.createTextNode(node);
  const e = doc.createElement(node.tag);
  if (node.cls) e.className = node.cls;
  for (const [k, v] of Object.entries(node.attrs || {})) e.setAttribute(k, v);
  for (const k of node.kids) e.append(toDom(k, doc));
  return e;
}
