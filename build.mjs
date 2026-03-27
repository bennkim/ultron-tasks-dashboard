#!/usr/bin/env node
/**
 * TASKS.md → Static Dashboard HTML
 * Zero dependencies — Node.js stdlib only
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const md = readFileSync('TASKS.md', 'utf-8');
const lines = md.split('\n');

// --- Parse ---
const epics = [];
let currentEpic = null;
let currentStory = null;
let inTable = false;
let tableHeaders = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Epic: ### [E-001] ...
  const epicMatch = line.match(/^### \[(E-\d+)\]\s+(.+?)(?:\s+(🔴|🟠|🟡|⚪)\s*(P\d))?$/);
  if (epicMatch) {
    currentEpic = {
      id: epicMatch[1],
      title: epicMatch[2].trim(),
      priorityEmoji: epicMatch[3] || '',
      priority: epicMatch[4] || '',
      meta: {},
      stories: [],
    };
    epics.push(currentEpic);
    currentStory = null;
    inTable = false;
    // Read meta lines
    for (let j = i + 1; j < lines.length && lines[j].startsWith('- **'); j++) {
      const metaMatch = lines[j].match(/^- \*\*(.+?):\*\*\s*(.+)/);
      if (metaMatch) currentEpic.meta[metaMatch[1]] = metaMatch[2];
    }
    continue;
  }

  // Story: **[S-001] ...**
  const storyMatch = line.match(/^\*\*\[(S-\d+)\]\s+(.+?)\*\*\s*(✅|🔄|🚨|📋|🔲|🔍)?\s*(DONE|IN_PROGRESS|BLOCKED|BACKLOG|TODO|REVIEW)?/);
  if (storyMatch && currentEpic) {
    currentStory = {
      id: storyMatch[1],
      title: storyMatch[2].trim(),
      statusEmoji: storyMatch[3] || '',
      status: storyMatch[4] || '',
      meta: {},
      tasks: [],
    };
    currentEpic.stories.push(currentStory);
    inTable = false;
    // Read meta
    for (let j = i + 1; j < lines.length && lines[j].startsWith('- '); j++) {
      const m = lines[j].match(/^- (.+?):\s*(.+)/);
      if (m) currentStory.meta[m[1].replace(/\*/g, '')] = m[2];
    }
    continue;
  }

  // Table header
  if (line.match(/^\|\s*Task\s*\|/) && currentStory) {
    inTable = true;
    tableHeaders = line.split('|').map(h => h.trim()).filter(Boolean);
    i++; // skip separator
    continue;
  }

  // Table row
  if (inTable && line.startsWith('|') && currentStory) {
    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length >= 4) {
      const iceRaw = cols[4] || '';
      const iceScoreMatch = iceRaw.match(/=\s*(\d+)/) || iceRaw.match(/(\d+)(?:\s*(🔴|🟠|🟡|⚪))/);
      currentStory.tasks.push({
        id: cols[0],
        statusEmoji: cols[1],
        status: parseStatus(cols[1]),
        assignee: cols[2],
        desc: cols[3],
        iceRaw: iceRaw,
        iceScore: iceScoreMatch ? parseInt(iceScoreMatch[1]) : 0,
        iceGrade: iceScoreMatch ? (iceScoreMatch[2] || gradeFromScore(parseInt(iceScoreMatch[1]))) : '',
      });
    }
    continue;
  }

  if (inTable && !line.startsWith('|')) inTable = false;
}

function parseStatus(emoji) {
  if (emoji.includes('✅')) return 'DONE';
  if (emoji.includes('🔄')) return 'IN_PROGRESS';
  if (emoji.includes('🚨')) return 'BLOCKED';
  if (emoji.includes('📋')) return 'BACKLOG';
  if (emoji.includes('🔲')) return 'TODO';
  if (emoji.includes('🔍')) return 'REVIEW';
  return 'UNKNOWN';
}

function gradeFromScore(s) {
  if (s >= 700) return '🔴';
  if (s >= 400) return '🟠';
  if (s >= 200) return '🟡';
  return '⚪';
}

// --- Stats ---
const allTasks = epics.flatMap(e => e.stories.flatMap(s => s.tasks));
const total = allTasks.length;
const done = allTasks.filter(t => t.status === 'DONE').length;
const inProgress = allTasks.filter(t => t.status === 'IN_PROGRESS').length;
const blocked = allTasks.filter(t => t.status === 'BLOCKED').length;
const todo = allTasks.filter(t => t.status === 'TODO').length;
const backlog = allTasks.filter(t => t.status === 'BACKLOG').length;
const review = allTasks.filter(t => t.status === 'REVIEW').length;
const pct = total > 0 ? Math.round((done / total) * 100) : 0;

const blockers = allTasks.filter(t => t.status === 'BLOCKED');
const iceRanking = allTasks
  .filter(t => t.status !== 'DONE' && t.iceScore > 0)
  .sort((a, b) => b.iceScore - a.iceScore)
  .slice(0, 10);

// --- HTML ---
function statusClass(status) {
  return {
    DONE: 'done', IN_PROGRESS: 'progress', BLOCKED: 'blocked',
    TODO: 'todo', BACKLOG: 'backlog', REVIEW: 'review',
  }[status] || 'unknown';
}

function iceClass(score) {
  if (score >= 700) return 'ice-critical';
  if (score >= 400) return 'ice-high';
  if (score >= 200) return 'ice-medium';
  return 'ice-low';
}

function renderTask(t) {
  return `<tr class="task-row ${statusClass(t.status)}">
    <td class="task-id">${t.id}</td>
    <td class="task-status"><span class="badge badge-${statusClass(t.status)}">${t.statusEmoji}</span></td>
    <td class="task-assignee">${t.assignee}</td>
    <td class="task-desc">${t.desc}</td>
    <td class="task-ice"><span class="ice ${iceClass(t.iceScore)}">${t.iceScore > 0 ? t.iceScore : '—'}</span></td>
  </tr>`;
}

function renderStory(s) {
  const sDone = s.tasks.filter(t => t.status === 'DONE').length;
  const sTotal = s.tasks.length;
  const sPct = sTotal > 0 ? Math.round((sDone / sTotal) * 100) : 0;
  return `<div class="story">
    <div class="story-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <span class="chevron">▼</span>
      <span class="story-id">${s.id}</span>
      <span class="story-title">${s.title}</span>
      <span class="badge badge-${statusClass(s.status)}">${s.statusEmoji} ${s.status}</span>
      <span class="story-progress">${sDone}/${sTotal}</span>
      <div class="mini-bar"><div class="mini-fill" style="width:${sPct}%"></div></div>
    </div>
    <div class="story-body">
      <table class="task-table">
        <thead><tr><th>Task</th><th>상태</th><th>담당</th><th>설명</th><th>ICE</th></tr></thead>
        <tbody>${s.tasks.map(renderTask).join('')}</tbody>
      </table>
    </div>
  </div>`;
}

function renderEpic(e) {
  const eTasks = e.stories.flatMap(s => s.tasks);
  const eDone = eTasks.filter(t => t.status === 'DONE').length;
  const eTotal = eTasks.length;
  const ePct = eTotal > 0 ? Math.round((eDone / eTotal) * 100) : 0;
  const epicStatus = e.meta['상태'] || '';
  return `<div class="epic">
    <div class="epic-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <span class="chevron">▼</span>
      <span class="epic-id">${e.id}</span>
      <span class="epic-title">${e.title}</span>
      <span class="priority">${e.priorityEmoji} ${e.priority}</span>
      <span class="epic-status">${epicStatus}</span>
      <div class="progress-bar"><div class="progress-fill" style="width:${ePct}%"></div></div>
      <span class="progress-text">${ePct}%</span>
    </div>
    <div class="epic-body">
      ${e.stories.map(renderStory).join('')}
    </div>
  </div>`;
}

const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ultron Task Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0d1117;--card:#161b22;--border:#30363d;--text:#e6edf3;--muted:#8b949e;--green:#3fb950;--blue:#58a6ff;--red:#f85149;--yellow:#d29922;--orange:#db6d28;--purple:#bc8cff}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.5;padding:20px;max-width:1200px;margin:0 auto}
h1{font-size:1.5rem;font-weight:600;margin-bottom:4px}
.subtitle{color:var(--muted);font-size:.8rem;margin-bottom:24px}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:24px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center}
.stat-value{font-size:1.8rem;font-weight:700}
.stat-label{font-size:.75rem;color:var(--muted);margin-top:2px}
.stat-done .stat-value{color:var(--green)}
.stat-progress .stat-value{color:var(--blue)}
.stat-blocked .stat-value{color:var(--red)}
.stat-todo .stat-value{color:var(--yellow)}
.progress-section{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:24px}
.progress-section h2{font-size:.9rem;margin-bottom:8px}
.big-bar{height:24px;background:var(--border);border-radius:12px;overflow:hidden}
.big-fill{height:100%;background:linear-gradient(90deg,var(--green),var(--blue));border-radius:12px;transition:width .5s}
.big-pct{text-align:right;font-size:.8rem;color:var(--muted);margin-top:4px}
.filters{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.filter-btn{background:var(--card);border:1px solid var(--border);color:var(--text);padding:6px 14px;border-radius:20px;font-size:.75rem;cursor:pointer;transition:all .15s}
.filter-btn:hover,.filter-btn.active{border-color:var(--blue);color:var(--blue)}
.section-title{font-size:1rem;font-weight:600;margin:24px 0 12px;display:flex;align-items:center;gap:8px}
.epic{background:var(--card);border:1px solid var(--border);border-radius:12px;margin-bottom:12px;overflow:hidden}
.epic-header{display:flex;align-items:center;gap:8px;padding:14px 16px;cursor:pointer;user-select:none;flex-wrap:wrap}
.epic-header:hover{background:#1c2333}
.epic.collapsed .epic-body{display:none}
.epic.collapsed .chevron{transform:rotate(-90deg)}
.chevron{font-size:.7rem;color:var(--muted);transition:transform .2s;width:14px}
.epic-id{font-size:.75rem;color:var(--blue);font-weight:600}
.epic-title{font-weight:600;flex:1;min-width:150px}
.priority{font-size:.75rem;padding:2px 8px;border-radius:10px;background:var(--border)}
.epic-status{font-size:.75rem;color:var(--muted)}
.progress-bar{width:80px;height:6px;background:var(--border);border-radius:3px;overflow:hidden}
.progress-fill{height:100%;background:var(--green);border-radius:3px}
.progress-text{font-size:.75rem;color:var(--muted);width:35px;text-align:right}
.story{border-top:1px solid var(--border)}
.story-header{display:flex;align-items:center;gap:8px;padding:10px 16px 10px 32px;cursor:pointer;user-select:none;flex-wrap:wrap}
.story-header:hover{background:#1c2333}
.story.collapsed .story-body{display:none}
.story.collapsed .chevron{transform:rotate(-90deg)}
.story-id{font-size:.7rem;color:var(--purple);font-weight:600}
.story-title{flex:1;font-size:.9rem;min-width:120px}
.story-progress{font-size:.75rem;color:var(--muted)}
.mini-bar{width:50px;height:4px;background:var(--border);border-radius:2px;overflow:hidden}
.mini-fill{height:100%;background:var(--green);border-radius:2px}
.story-body{padding:0 16px 12px 32px}
.task-table{width:100%;border-collapse:collapse;font-size:.8rem}
.task-table th{text-align:left;color:var(--muted);font-weight:500;padding:6px 8px;border-bottom:1px solid var(--border);font-size:.7rem;text-transform:uppercase}
.task-table td{padding:6px 8px;border-bottom:1px solid #21262d}
.task-id{font-weight:600;color:var(--blue);white-space:nowrap}
.task-desc{max-width:400px}
.badge{font-size:.7rem;padding:1px 8px;border-radius:10px;white-space:nowrap}
.badge-done{background:#1a3a2a;color:var(--green)}
.badge-progress{background:#1a2a3a;color:var(--blue)}
.badge-blocked{background:#3a1a1a;color:var(--red)}
.badge-todo{background:#2a2a1a;color:var(--yellow)}
.badge-backlog{background:#1a1a1a;color:var(--muted)}
.badge-review{background:#2a1a3a;color:var(--purple)}
.ice{font-weight:700;font-size:.8rem;padding:2px 6px;border-radius:6px}
.ice-critical{color:#fff;background:rgba(248,81,73,.3)}
.ice-high{color:var(--orange);background:rgba(219,109,40,.15)}
.ice-medium{color:var(--yellow);background:rgba(210,153,34,.15)}
.ice-low{color:var(--muted)}
.panel{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}
.panel h3{font-size:.85rem;margin-bottom:10px}
.blocker-item{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #21262d;font-size:.85rem}
.blocker-item:last-child{border:none}
.rank-item{display:flex;align-items:center;gap:10px;padding:5px 0;font-size:.85rem}
.rank-num{color:var(--muted);font-weight:600;width:20px;text-align:right}
.rank-id{color:var(--blue);font-weight:600}
.rank-score{margin-left:auto}
.panels{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
@media(max-width:700px){.panels{grid-template-columns:1fr}.summary{grid-template-columns:repeat(3,1fr)}.epic-header,.story-header{font-size:.85rem}}
</style>
</head>
<body>
<h1>📊 Ultron C-Suite Task Dashboard</h1>
<p class="subtitle">마지막 빌드: ${now}</p>

<div class="summary">
  <div class="stat"><div class="stat-value">${total}</div><div class="stat-label">전체</div></div>
  <div class="stat stat-done"><div class="stat-value">${done}</div><div class="stat-label">✅ 완료</div></div>
  <div class="stat stat-progress"><div class="stat-value">${inProgress}</div><div class="stat-label">🔄 진행중</div></div>
  <div class="stat stat-blocked"><div class="stat-value">${blocked}</div><div class="stat-label">🚨 블로커</div></div>
  <div class="stat stat-todo"><div class="stat-value">${todo + backlog}</div><div class="stat-label">🔲 대기</div></div>
</div>

<div class="progress-section">
  <h2>전체 진행률</h2>
  <div class="big-bar"><div class="big-fill" style="width:${pct}%"></div></div>
  <div class="big-pct">${done}/${total} (${pct}%)</div>
</div>

<div class="panels">
  <div class="panel">
    <h3>🚨 블로커 (${blockers.length}건)</h3>
    ${blockers.length === 0 ? '<p style="color:var(--muted);font-size:.85rem">없음 🎉</p>' :
      blockers.map(b => `<div class="blocker-item"><span class="badge badge-blocked">🚨</span><span class="rank-id">${b.id}</span><span>${b.desc}</span><span style="color:var(--muted);margin-left:auto">${b.assignee}</span></div>`).join('')}
  </div>
  <div class="panel">
    <h3>🏆 ICE 랭킹 (미완료 Top 10)</h3>
    ${iceRanking.map((t, i) => `<div class="rank-item"><span class="rank-num">${i + 1}</span><span class="rank-id">${t.id}</span><span>${t.desc.substring(0, 30)}${t.desc.length > 30 ? '…' : ''}</span><span class="rank-score"><span class="ice ${iceClass(t.iceScore)}">${t.iceScore}</span></span></div>`).join('')}
  </div>
</div>

<div class="filters">
  <button class="filter-btn active" onclick="filterBy('all')">전체</button>
  <button class="filter-btn" onclick="filterBy('CEO')">🤖 CEO</button>
  <button class="filter-btn" onclick="filterBy('CMO')">🎯 CMO</button>
  <button class="filter-btn" onclick="filterBy('CTO')">💻 CTO</button>
  <button class="filter-btn" onclick="filterBy('의장')">👑 의장</button>
</div>

<div class="section-title">에픽</div>
${epics.map(renderEpic).join('')}

<script>
function filterBy(role) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelectorAll('.task-row').forEach(row => {
    if (role === 'all') { row.style.display = ''; return; }
    const assignee = row.querySelector('.task-assignee')?.textContent || '';
    row.style.display = assignee.includes(role) ? '' : 'none';
  });
}
</script>
</body>
</html>`;

mkdirSync('docs', { recursive: true });
writeFileSync('docs/index.html', html, 'utf-8');
console.log(`✅ Built dashboard: ${epics.length} epics, ${allTasks.length} tasks, ${pct}% done`);
