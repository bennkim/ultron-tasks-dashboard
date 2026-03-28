#!/usr/bin/env node
/**
 * TASKS.md + ads-data.json → Static Dashboard HTML (2-tab: Tasks / Ad Manager)
 * Zero dependencies — Node.js stdlib only
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// ─── Parse TASKS.md ───
const md = readFileSync('TASKS.md', 'utf-8');
const lines = md.split('\n');
const epics = [];
let currentEpic = null, currentStory = null, inTable = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const epicMatch = line.match(/^### \[(E-\d+)\]\s+(.+?)(?:\s+(🔴|🟠|🟡|⚪)\s*(P\d))?$/);
  if (epicMatch) {
    currentEpic = { id: epicMatch[1], title: epicMatch[2].trim(), priorityEmoji: epicMatch[3]||'', priority: epicMatch[4]||'', meta: {}, stories: [] };
    epics.push(currentEpic); currentStory = null; inTable = false;
    for (let j = i+1; j < lines.length && lines[j].startsWith('- **'); j++) {
      const m = lines[j].match(/^- \*\*(.+?):\*\*\s*(.+)/);
      if (m) currentEpic.meta[m[1]] = m[2];
    }
    continue;
  }
  const storyMatch = line.match(/^\*\*\[(S-\d+)\]\s+(.+?)\*\*\s*(✅|🔄|🚨|📋|🔲|🔍)?\s*(DONE|IN_PROGRESS|BLOCKED|BACKLOG|TODO|REVIEW)?/);
  if (storyMatch && currentEpic) {
    currentStory = { id: storyMatch[1], title: storyMatch[2].trim(), statusEmoji: storyMatch[3]||'', status: storyMatch[4]||'', meta: {}, tasks: [] };
    currentEpic.stories.push(currentStory); inTable = false;
    for (let j = i+1; j < lines.length && lines[j].startsWith('- '); j++) {
      const m = lines[j].match(/^- (.+?):\s*(.+)/);
      if (m) currentStory.meta[m[1].replace(/\*/g,'')] = m[2];
    }
    continue;
  }
  if (line.match(/^\|\s*Task\s*\|/) && currentStory) { inTable = true; i++; continue; }
  if (inTable && line.startsWith('|') && currentStory) {
    const cols = line.split('|').map(c=>c.trim()).filter(Boolean);
    if (cols.length >= 4) {
      const iceRaw = cols[4]||'';
      const m = iceRaw.match(/=\s*(\d+)/) || iceRaw.match(/(\d+)(?:\s*(🔴|🟠|🟡|⚪))/);
      currentStory.tasks.push({ id:cols[0], statusEmoji:cols[1], status:parseStatus(cols[1]), assignee:cols[2], desc:cols[3], iceScore:m?parseInt(m[1]):0 });
    }
    continue;
  }
  if (inTable && !line.startsWith('|')) inTable = false;
}

function parseStatus(e) {
  if(e.includes('✅'))return'DONE';if(e.includes('🔄'))return'IN_PROGRESS';if(e.includes('🚨'))return'BLOCKED';
  if(e.includes('📋'))return'BACKLOG';if(e.includes('🔲'))return'TODO';if(e.includes('🔍'))return'REVIEW';return'UNKNOWN';
}
function gradeFromScore(s){if(s>=700)return'🔴';if(s>=400)return'🟠';if(s>=200)return'🟡';return'⚪';}
function iceClass(s){if(s>=700)return'ice-critical';if(s>=400)return'ice-high';if(s>=200)return'ice-medium';return'ice-low';}
function statusClass(s){return{DONE:'done',IN_PROGRESS:'progress',BLOCKED:'blocked',TODO:'todo',BACKLOG:'backlog',REVIEW:'review'}[s]||'unknown';}

const allTasks = epics.flatMap(e=>e.stories.flatMap(s=>s.tasks));
const total=allTasks.length, done=allTasks.filter(t=>t.status==='DONE').length;
const inProgress=allTasks.filter(t=>t.status==='IN_PROGRESS').length;
const blocked=allTasks.filter(t=>t.status==='BLOCKED').length;
const todo=allTasks.filter(t=>t.status==='TODO').length+allTasks.filter(t=>t.status==='BACKLOG').length;
const pct=total>0?Math.round((done/total)*100):0;
const blockers=allTasks.filter(t=>t.status==='BLOCKED');
const iceRanking=allTasks.filter(t=>t.status!=='DONE'&&t.iceScore>0).sort((a,b)=>b.iceScore-a.iceScore).slice(0,10);

function renderTask(t){return`<tr class="task-row ${statusClass(t.status)}"><td class="task-id">${t.id}</td><td><span class="badge badge-${statusClass(t.status)}">${t.statusEmoji}</span></td><td class="task-assignee">${t.assignee}</td><td class="task-desc">${t.desc}</td><td><span class="ice ${iceClass(t.iceScore)}">${t.iceScore>0?t.iceScore:'—'}</span></td></tr>`;}
function renderStory(s){const d=s.tasks.filter(t=>t.status==='DONE').length,n=s.tasks.length,p=n>0?Math.round(d/n*100):0;return`<div class="story"><div class="story-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▼</span><span class="story-id">${s.id}</span><span class="story-title">${s.title}</span><span class="badge badge-${statusClass(s.status)}">${s.statusEmoji} ${s.status}</span><span class="story-progress">${d}/${n}</span><div class="mini-bar"><div class="mini-fill" style="width:${p}%"></div></div></div><div class="story-body"><table class="task-table"><thead><tr><th>Task</th><th>상태</th><th>담당</th><th>설명</th><th>ICE</th></tr></thead><tbody>${s.tasks.map(renderTask).join('')}</tbody></table></div></div>`;}
function renderEpic(e){const ts=e.stories.flatMap(s=>s.tasks),d=ts.filter(t=>t.status==='DONE').length,n=ts.length,p=n>0?Math.round(d/n*100):0;return`<div class="epic"><div class="epic-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="chevron">▼</span><span class="epic-id">${e.id}</span><span class="epic-title">${e.title}</span><span class="priority">${e.priorityEmoji} ${e.priority}</span><span class="epic-status">${e.meta['상태']||''}</span><div class="progress-bar"><div class="progress-fill" style="width:${p}%"></div></div><span class="progress-text">${p}%</span></div><div class="epic-body">${e.stories.map(renderStory).join('')}</div></div>`;}

// ─── Parse ads-data.json ───
const adsData = JSON.parse(readFileSync('ads-data.json', 'utf-8'));

function statusTag(s) {
  const cls = { live:'tag-active', active:'tag-active', draft:'tag-draft', paused:'tag-paused', ended:'tag-ended' }[s] || 'tag-draft';
  const label = { live:'🟢 라이브', active:'🟢 활성', draft:'📝 준비중', paused:'⏸️ 일시정지', ended:'⏹️ 종료' }[s] || s;
  return `<span class="tag ${cls}">${label}</span>`;
}
function fmt(n) { return n.toLocaleString('ko-KR'); }
function fmtWon(n) { return '₩' + fmt(n); }

function renderCreativeRow(c) {
  return `<tr>
    <td><strong>${c.name}</strong></td>
    <td>${statusTag(c.status)}</td>
    <td class="num">${fmt(c.impressions)}</td>
    <td class="num">${fmt(c.clicks)}</td>
    <td class="num">${c.ctr.toFixed(2)}%</td>
    <td class="num">${c.cpc > 0 ? fmtWon(c.cpc) : '—'}</td>
    <td class="num conv">${c.conversions}</td>
  </tr>`;
}

function renderCampaign(cam) {
  const roasColor = cam.roas >= 3 ? 'var(--green)' : cam.roas >= 1 ? 'var(--yellow)' : 'var(--red)';
  const spentPct = cam.budget > 0 ? Math.round((cam.spent / cam.budget) * 100) : 0;
  return `
<div class="campaign-card">
  <div class="campaign-header">
    <h4>${statusTag(cam.status)} ${cam.name}</h4>
    <span class="cam-id">${cam.id}</span>
  </div>
  <div class="cam-kpi-grid">
    <div class="cam-kpi"><div class="cam-kpi-label">예산</div><div class="cam-kpi-value">${fmtWon(cam.budget)}</div></div>
    <div class="cam-kpi"><div class="cam-kpi-label">소진액</div><div class="cam-kpi-value">${fmtWon(cam.spent)}<div class="cam-kpi-bar"><div class="cam-kpi-fill" style="width:${spentPct}%"></div></div></div></div>
    <div class="cam-kpi"><div class="cam-kpi-label">전환</div><div class="cam-kpi-value conv">${cam.conversions}건</div></div>
    <div class="cam-kpi"><div class="cam-kpi-label">매출</div><div class="cam-kpi-value">${fmtWon(cam.revenue)}</div></div>
    <div class="cam-kpi"><div class="cam-kpi-label">ROAS</div><div class="cam-kpi-value" style="color:${roasColor}">${cam.roas > 0 ? cam.roas.toFixed(2) + 'x' : '—'}</div></div>
    <div class="cam-kpi"><div class="cam-kpi-label">목표</div><div class="cam-kpi-value" style="font-size:.85rem">${cam.objective}</div></div>
  </div>
  <div class="creative-section">
    <h5>🎨 광고 소재 비교 (${cam.creatives.length}종)</h5>
    <table class="creative-table">
      <thead><tr><th>소재</th><th>상태</th><th>노출</th><th>클릭</th><th>CTR</th><th>CPC</th><th>전환</th></tr></thead>
      <tbody>${cam.creatives.map(renderCreativeRow).join('')}</tbody>
    </table>
  </div>
  <div class="cam-meta">
    <span>📍 ${cam.platform} · ${cam.account}</span>
    <span>📅 ${cam.startDate}${cam.endDate ? ' ~ ' + cam.endDate : ' ~'}</span>
  </div>
</div>`;
}

const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
const adsJson = JSON.stringify(adsData);

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ultron C-Suite Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0d1117;--card:#161b22;--border:#30363d;--text:#e6edf3;--muted:#8b949e;--green:#3fb950;--blue:#58a6ff;--red:#f85149;--yellow:#d29922;--orange:#db6d28;--purple:#bc8cff}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.5;padding:20px;max-width:1200px;margin:0 auto}
h1{font-size:1.5rem;font-weight:600;margin-bottom:4px}
.subtitle{color:var(--muted);font-size:.8rem;margin-bottom:20px}

/* Tabs */
.tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:24px}
.tab{background:none;border:none;color:var(--muted);padding:12px 24px;font-size:.9rem;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;font-weight:600;letter-spacing:.3px}
.tab:hover{color:var(--text);background:rgba(88,166,255,.05)}
.tab.active{color:var(--blue);border-bottom-color:var(--blue)}
.tab-content{display:none}.tab-content.active{display:block}

/* Stats */
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;margin-bottom:24px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center}
.stat-value{font-size:1.8rem;font-weight:700}.stat-label{font-size:.75rem;color:var(--muted);margin-top:2px}
.stat-done .stat-value{color:var(--green)}.stat-progress .stat-value{color:var(--blue)}
.stat-blocked .stat-value{color:var(--red)}.stat-todo .stat-value{color:var(--yellow)}

.progress-section{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:24px}
.progress-section h2{font-size:.9rem;margin-bottom:8px}
.big-bar{height:24px;background:var(--border);border-radius:12px;overflow:hidden}
.big-fill{height:100%;background:linear-gradient(90deg,var(--green),var(--blue));border-radius:12px}
.big-pct{text-align:right;font-size:.8rem;color:var(--muted);margin-top:4px}

.filters{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.filter-btn{background:var(--card);border:1px solid var(--border);color:var(--text);padding:6px 14px;border-radius:20px;font-size:.75rem;cursor:pointer;transition:all .15s}
.filter-btn:hover,.filter-btn.active{border-color:var(--blue);color:var(--blue)}

.section-title{font-size:1rem;font-weight:600;margin:20px 0 12px}
.epic{background:var(--card);border:1px solid var(--border);border-radius:12px;margin-bottom:12px;overflow:hidden}
.epic-header{display:flex;align-items:center;gap:8px;padding:14px 16px;cursor:pointer;user-select:none;flex-wrap:wrap}
.epic-header:hover{background:#1c2333}
.epic.collapsed .epic-body{display:none}.epic.collapsed .chevron{transform:rotate(-90deg)}
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
.story.collapsed .story-body{display:none}.story.collapsed .chevron{transform:rotate(-90deg)}
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
.badge-done{background:#1a3a2a;color:var(--green)}.badge-progress{background:#1a2a3a;color:var(--blue)}
.badge-blocked{background:#3a1a1a;color:var(--red)}.badge-todo{background:#2a2a1a;color:var(--yellow)}
.badge-backlog{background:#1a1a1a;color:var(--muted)}.badge-review{background:#2a1a3a;color:var(--purple)}
.ice{font-weight:700;font-size:.8rem;padding:2px 6px;border-radius:6px}
.ice-critical{color:#fff;background:rgba(248,81,73,.3)}.ice-high{color:var(--orange);background:rgba(219,109,40,.15)}
.ice-medium{color:var(--yellow);background:rgba(210,153,34,.15)}.ice-low{color:var(--muted)}
.panel{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}
.panel h3{font-size:.85rem;margin-bottom:10px}
.blocker-item,.rank-item{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #21262d;font-size:.85rem}
.blocker-item:last-child,.rank-item:last-child{border:none}
.rank-num{color:var(--muted);font-weight:600;width:20px;text-align:right}
.rank-id{color:var(--blue);font-weight:600}
.rank-score{margin-left:auto}
.panels{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}

/* ─── Ad Manager ─── */
.ad-sub-tabs{display:flex;gap:4px;margin-bottom:20px}
.ad-sub-tab{background:var(--card);border:1px solid var(--border);color:var(--muted);padding:8px 16px;border-radius:8px;font-size:.8rem;cursor:pointer;font-weight:500;transition:all .15s}
.ad-sub-tab:hover{color:var(--text);border-color:var(--text)}
.ad-sub-tab.active{background:var(--blue);color:#fff;border-color:var(--blue)}
.ad-sub-content{display:none}.ad-sub-content.active{display:block}

/* Campaign Cards */
.campaign-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px}
.campaign-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.campaign-header h4{font-size:.95rem;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cam-id{font-size:.7rem;color:var(--muted);font-family:monospace}
.cam-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:16px}
.cam-kpi{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px}
.cam-kpi-label{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.cam-kpi-value{font-size:1.1rem;font-weight:700}
.cam-kpi-value.conv{color:var(--green)}
.cam-kpi-bar{height:4px;background:var(--border);border-radius:2px;margin-top:4px;overflow:hidden}
.cam-kpi-fill{height:100%;background:var(--blue);border-radius:2px}
.cam-meta{display:flex;gap:16px;flex-wrap:wrap;font-size:.75rem;color:var(--muted);margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}

.creative-section{margin-top:12px}
.creative-section h5{font-size:.85rem;margin-bottom:10px;font-weight:600}
.creative-table{width:100%;border-collapse:collapse;font-size:.8rem}
.creative-table th{text-align:left;color:var(--muted);font-weight:500;padding:8px;border-bottom:1px solid var(--border);font-size:.7rem;text-transform:uppercase}
.creative-table td{padding:8px;border-bottom:1px solid #21262d}
.creative-table .num{text-align:right;font-variant-numeric:tabular-nums}
.creative-table .conv{color:var(--green);font-weight:700}

.tag{display:inline-block;font-size:.7rem;padding:2px 8px;border-radius:6px;font-weight:500}
.tag-active{background:rgba(63,185,80,.15);color:var(--green)}
.tag-draft{background:rgba(139,148,158,.15);color:var(--muted)}
.tag-paused{background:rgba(210,153,34,.15);color:var(--yellow)}
.tag-ended{background:rgba(248,81,73,.15);color:var(--red)}

/* UTM Builder */
.utm-form{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px}
.utm-form h3{font-size:.95rem;margin-bottom:16px}
.utm-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.utm-field label{display:block;font-size:.7rem;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px}
.utm-field input,.utm-field select{width:100%;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:.85rem;outline:none;transition:border-color .15s}
.utm-field input:focus,.utm-field select:focus{border-color:var(--blue)}
.utm-field.full{grid-column:1/-1}
.utm-result{margin-top:16px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;font-size:.8rem;word-break:break-all;color:var(--blue);min-height:40px;font-family:monospace}
.utm-actions{display:flex;gap:8px;margin-top:12px}
.utm-btn{padding:8px 20px;border-radius:8px;font-size:.8rem;font-weight:500;cursor:pointer;border:none;transition:all .15s}
.utm-btn-primary{background:var(--blue);color:#fff}.utm-btn-primary:hover{opacity:.85}
.utm-btn-secondary{background:var(--border);color:var(--text)}.utm-btn-secondary:hover{background:#3d444d}
.copy-toast{position:fixed;bottom:20px;right:20px;background:var(--green);color:#fff;padding:10px 20px;border-radius:8px;font-size:.85rem;opacity:0;transition:opacity .3s;pointer-events:none;z-index:99}
.copy-toast.show{opacity:1}

/* Ad Manager Summary */
.ad-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px}

@media(max-width:700px){.panels{grid-template-columns:1fr}.summary{grid-template-columns:repeat(3,1fr)}.utm-grid{grid-template-columns:1fr}.cam-kpi-grid{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<h1>📊 Ultron C-Suite Dashboard</h1>
<p class="subtitle">마지막 빌드: ${now}</p>

<div class="tabs">
  <button class="tab active" onclick="switchTab('tasks',this)">📋 Tasks</button>
  <button class="tab" onclick="switchTab('admanager',this)">📢 Ad Manager</button>
</div>

<!-- ══════════ TAB: Tasks ══════════ -->
<div id="tab-tasks" class="tab-content active">
<div class="summary">
  <div class="stat"><div class="stat-value">${total}</div><div class="stat-label">전체</div></div>
  <div class="stat stat-done"><div class="stat-value">${done}</div><div class="stat-label">✅ 완료</div></div>
  <div class="stat stat-progress"><div class="stat-value">${inProgress}</div><div class="stat-label">🔄 진행중</div></div>
  <div class="stat stat-blocked"><div class="stat-value">${blocked}</div><div class="stat-label">🚨 블로커</div></div>
  <div class="stat stat-todo"><div class="stat-value">${todo}</div><div class="stat-label">🔲 대기</div></div>
</div>
<div class="progress-section"><h2>전체 진행률</h2><div class="big-bar"><div class="big-fill" style="width:${pct}%"></div></div><div class="big-pct">${done}/${total} (${pct}%)</div></div>
<div class="panels">
  <div class="panel"><h3>🚨 블로커 (${blockers.length}건)</h3>${blockers.length===0?'<p style="color:var(--muted);font-size:.85rem">없음 🎉</p>':blockers.map(b=>`<div class="blocker-item"><span class="badge badge-blocked">🚨</span><span class="rank-id">${b.id}</span><span>${b.desc}</span><span style="color:var(--muted);margin-left:auto">${b.assignee}</span></div>`).join('')}</div>
  <div class="panel"><h3>🏆 ICE 랭킹 (미완료 Top 10)</h3>${iceRanking.map((t,i)=>`<div class="rank-item"><span class="rank-num">${i+1}</span><span class="rank-id">${t.id}</span><span>${t.desc.substring(0,30)}${t.desc.length>30?'…':''}</span><span class="rank-score"><span class="ice ${iceClass(t.iceScore)}">${t.iceScore}</span></span></div>`).join('')}</div>
</div>
<div class="filters">
  <button class="filter-btn active" onclick="filterBy('all',this)">전체</button>
  <button class="filter-btn" onclick="filterBy('CEO',this)">🤖 CEO</button>
  <button class="filter-btn" onclick="filterBy('CMO',this)">🎯 CMO</button>
  <button class="filter-btn" onclick="filterBy('CTO',this)">💻 CTO</button>
  <button class="filter-btn" onclick="filterBy('의장',this)">👑 의장</button>
</div>
<div class="section-title">에픽</div>
${epics.map(renderEpic).join('')}
</div>

<!-- ══════════ TAB: Ad Manager ══════════ -->
<div id="tab-admanager" class="tab-content">

<div class="ad-sub-tabs">
  <button class="ad-sub-tab active" onclick="switchAdSub('campaigns',this)">📊 캠페인 관리</button>
  <button class="ad-sub-tab" onclick="switchAdSub('creatives',this)">🎨 소재 비교</button>
  <button class="ad-sub-tab" onclick="switchAdSub('utm',this)">🔗 UTM 빌더</button>
</div>

<!-- Sub: Campaigns -->
<div id="ad-campaigns" class="ad-sub-content active">
<div class="ad-summary">
  <div class="stat"><div class="stat-value">${adsData.campaigns.length}</div><div class="stat-label">캠페인</div></div>
  <div class="stat stat-done"><div class="stat-value">${adsData.campaigns.filter(c=>c.status==='live').length}</div><div class="stat-label">🟢 라이브</div></div>
  <div class="stat"><div class="stat-value">${fmtWon(adsData.campaigns.reduce((s,c)=>s+c.spent,0))}</div><div class="stat-label">총 소진액</div></div>
  <div class="stat"><div class="stat-value">${fmtWon(adsData.campaigns.reduce((s,c)=>s+c.revenue,0))}</div><div class="stat-label">총 매출</div></div>
  <div class="stat stat-done"><div class="stat-value">${adsData.campaigns.reduce((s,c)=>s+c.conversions,0)}건</div><div class="stat-label">총 전환</div></div>
</div>
${adsData.campaigns.map(renderCampaign).join('')}
</div>

<!-- Sub: Creative Comparison -->
<div id="ad-creatives" class="ad-sub-content">
<div class="section-title">🎨 전체 소재 성과 비교</div>
<div class="panel">
<table class="creative-table">
  <thead><tr><th>캠페인</th><th>소재</th><th>상태</th><th>노출</th><th>클릭</th><th>CTR</th><th>CPC</th><th>전환</th></tr></thead>
  <tbody>
${adsData.campaigns.flatMap(cam => cam.creatives.map(c => `
    <tr>
      <td style="font-size:.75rem;color:var(--muted)">${cam.id}</td>
      <td><strong>${c.name}</strong><br><span style="font-size:.7rem;color:var(--muted)">${c.copy}</span></td>
      <td>${statusTag(c.status)}</td>
      <td class="num">${fmt(c.impressions)}</td>
      <td class="num">${fmt(c.clicks)}</td>
      <td class="num">${c.ctr.toFixed(2)}%</td>
      <td class="num">${c.cpc > 0 ? fmtWon(c.cpc) : '—'}</td>
      <td class="num conv">${c.conversions}</td>
    </tr>`)).join('')}
  </tbody>
</table>
</div>
</div>

<!-- Sub: UTM Builder -->
<div id="ad-utm" class="ad-sub-content">
<div class="utm-form">
  <h3>🔗 UTM 파라미터 빌더</h3>
  <div class="utm-grid">
    <div class="utm-field full">
      <label>Base URL *</label>
      <input type="text" id="utm-url" value="https://wakalab.io" placeholder="https://wakalab.io" oninput="buildUTM()">
    </div>
    <div class="utm-field">
      <label>utm_source *</label>
      <select id="utm-source" onchange="buildUTM()">
        <option value="meta">meta</option>
        <option value="google">google</option>
        <option value="naver">naver</option>
        <option value="tiktok">tiktok</option>
        <option value="instagram">instagram</option>
        <option value="youtube">youtube</option>
        <option value="direct">direct</option>
      </select>
    </div>
    <div class="utm-field">
      <label>utm_medium *</label>
      <select id="utm-medium" onchange="buildUTM()">
        <option value="paid_social">paid_social</option>
        <option value="cpc">cpc</option>
        <option value="display">display</option>
        <option value="email">email</option>
        <option value="organic">organic</option>
        <option value="referral">referral</option>
      </select>
    </div>
    <div class="utm-field">
      <label>utm_campaign *</label>
      <input type="text" id="utm-campaign" value="" placeholder="wakalab_ab_test_2503" oninput="buildUTM()">
    </div>
    <div class="utm-field">
      <label>utm_content</label>
      <input type="text" id="utm-content" placeholder="creative_a" oninput="buildUTM()">
    </div>
    <div class="utm-field">
      <label>utm_term</label>
      <input type="text" id="utm-term" placeholder="keyword" oninput="buildUTM()">
    </div>
  </div>
  <div class="utm-result" id="utm-result"></div>
  <div class="utm-actions">
    <button class="utm-btn utm-btn-primary" onclick="copyUTM()">📋 복사</button>
    <button class="utm-btn utm-btn-secondary" onclick="resetUTM()">🔄 초기화</button>
  </div>
</div>
<div class="panel">
  <h3>📌 최근 생성한 UTM 링크</h3>
  <div id="utm-history" style="font-size:.8rem;color:var(--muted)">
    <p>아직 생성된 링크가 없습니다.</p>
  </div>
</div>
</div>

</div>

<div class="copy-toast" id="copy-toast">✅ 클립보드에 복사됨!</div>

<script>
function switchTab(id, btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  btn.classList.add('active');
}
function switchAdSub(id, btn){
  document.querySelectorAll('.ad-sub-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.ad-sub-content').forEach(c=>c.classList.remove('active'));
  document.getElementById('ad-'+id).classList.add('active');
  btn.classList.add('active');
}
function filterBy(role, btn){
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.task-row').forEach(row=>{
    if(role==='all'){row.style.display='';return;}
    const a=row.querySelector('.task-assignee')?.textContent||'';
    row.style.display=a.includes(role)?'':'none';
  });
}
function buildUTM(){
  const base=document.getElementById('utm-url').value.trim();
  const src=document.getElementById('utm-source').value;
  const med=document.getElementById('utm-medium').value;
  const camp=document.getElementById('utm-campaign').value.trim();
  const term=document.getElementById('utm-term').value.trim();
  const content=document.getElementById('utm-content').value.trim();
  if(!base){document.getElementById('utm-result').textContent='';return;}
  const p=new URLSearchParams();
  if(src)p.set('utm_source',src);
  if(med)p.set('utm_medium',med);
  if(camp)p.set('utm_campaign',camp);
  if(term)p.set('utm_term',term);
  if(content)p.set('utm_content',content);
  document.getElementById('utm-result').textContent=base+(base.includes('?')?'&':'?')+p.toString();
}
function copyUTM(){
  const url=document.getElementById('utm-result').textContent;
  if(!url)return;
  navigator.clipboard.writeText(url).then(()=>{
    const toast=document.getElementById('copy-toast');
    toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2000);
    const hist=document.getElementById('utm-history');
    const first=hist.querySelector('p');
    if(first&&first.textContent.includes('아직'))hist.innerHTML='';
    const item=document.createElement('div');
    item.style.cssText='padding:6px 0;border-bottom:1px solid var(--border);word-break:break-all';
    item.innerHTML='<span style="color:var(--blue)">'+url+'</span> <span style="color:var(--muted);font-size:.7rem">'+new Date().toLocaleTimeString('ko-KR')+'</span>';
    hist.prepend(item);
  });
}
function resetUTM(){
  document.getElementById('utm-url').value='https://wakalab.io';
  document.getElementById('utm-source').value='meta';
  document.getElementById('utm-medium').value='paid_social';
  document.getElementById('utm-campaign').value='';
  document.getElementById('utm-term').value='';
  document.getElementById('utm-content').value='';
  document.getElementById('utm-result').textContent='';
}
buildUTM();
</script>
</body>
</html>`;

mkdirSync('docs', { recursive: true });
writeFileSync('docs/index.html', html, 'utf-8');
console.log(`✅ Built dashboard: ${epics.length} epics, ${allTasks.length} tasks, ${pct}% done | Ad Manager: ${adsData.campaigns.length} campaigns`);
