#!/usr/bin/env node
/**
 * TASKS.md → Static Dashboard HTML (multi-tab)
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

const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

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
.tabs{display:flex;gap:4px;margin-bottom:24px;border-bottom:1px solid var(--border);padding-bottom:0}
.tab{background:none;border:none;color:var(--muted);padding:10px 18px;font-size:.85rem;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;font-weight:500}
.tab:hover{color:var(--text)}
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

/* UTM Builder */
.utm-form{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px}
.utm-form h3{font-size:.95rem;margin-bottom:16px}
.utm-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.utm-field label{display:block;font-size:.75rem;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px}
.utm-field input,.utm-field select{width:100%;padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:.85rem;outline:none}
.utm-field input:focus,.utm-field select:focus{border-color:var(--blue)}
.utm-result{margin-top:16px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;font-size:.8rem;word-break:break-all;color:var(--blue);min-height:40px}
.utm-actions{display:flex;gap:8px;margin-top:12px}
.utm-btn{padding:8px 20px;border-radius:8px;font-size:.8rem;font-weight:500;cursor:pointer;border:none;transition:all .15s}
.utm-btn-primary{background:var(--blue);color:#fff}.utm-btn-primary:hover{opacity:.85}
.utm-btn-secondary{background:var(--border);color:var(--text)}.utm-btn-secondary:hover{background:#3d444d}
.copy-toast{position:fixed;bottom:20px;right:20px;background:var(--green);color:#fff;padding:10px 20px;border-radius:8px;font-size:.85rem;opacity:0;transition:opacity .3s;pointer-events:none;z-index:99}
.copy-toast.show{opacity:1}

/* Campaign View */
.campaign-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px}
.campaign-card h4{font-size:.9rem;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.campaign-meta{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;font-size:.8rem;color:var(--muted)}
.campaign-meta span{display:flex;align-items:center;gap:4px}
.creative-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.creative{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px}
.creative-name{font-size:.85rem;font-weight:600;margin-bottom:4px}
.creative-status{font-size:.75rem;color:var(--muted)}
.creative-copy{font-size:.75rem;color:var(--muted);margin-top:6px;line-height:1.4}
.tag{display:inline-block;font-size:.65rem;padding:2px 6px;border-radius:4px;margin-right:4px}
.tag-active{background:rgba(63,185,80,.15);color:var(--green)}
.tag-draft{background:rgba(139,148,158,.15);color:var(--muted)}
.tag-paused{background:rgba(210,153,34,.15);color:var(--yellow)}

@media(max-width:700px){.panels{grid-template-columns:1fr}.summary{grid-template-columns:repeat(3,1fr)}.utm-grid{grid-template-columns:1fr}.creative-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<h1>📊 Ultron C-Suite Dashboard</h1>
<p class="subtitle">마지막 빌드: ${now}</p>

<div class="tabs">
  <button class="tab active" onclick="switchTab('tasks')">📋 태스크</button>
  <button class="tab" onclick="switchTab('campaigns')">📢 캠페인</button>
  <button class="tab" onclick="switchTab('utm')">🔗 UTM 빌더</button>
</div>

<!-- TAB: Tasks -->
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
  <button class="filter-btn active" onclick="filterBy('all')">전체</button>
  <button class="filter-btn" onclick="filterBy('CEO')">🤖 CEO</button>
  <button class="filter-btn" onclick="filterBy('CMO')">🎯 CMO</button>
  <button class="filter-btn" onclick="filterBy('CTO')">💻 CTO</button>
  <button class="filter-btn" onclick="filterBy('의장')">👑 의장</button>
</div>
<div class="section-title">에픽</div>
${epics.map(renderEpic).join('')}
</div>

<!-- TAB: Campaigns -->
<div id="tab-campaigns" class="tab-content">
<div class="section-title">📢 진행 중인 캠페인</div>

<div class="campaign-card">
  <h4><span class="tag tag-active">ACTIVE</span> [WakaLab] 숏폼분석툴_AB테스트_2503</h4>
  <div class="campaign-meta">
    <span>📅 2026-03-27 ~</span>
    <span>💰 일 예산 ₩30,000</span>
    <span>🎯 전환 목표: CompleteRegistration</span>
    <span>📍 Wakawaka 광고 계정</span>
  </div>
  <div class="section-title" style="margin-top:8px;font-size:.85rem">광고 소재 (4종 A/B 테스트)</div>
  <div class="creative-grid">
    <div class="creative">
      <div class="creative-name">소재 A — 데이터 중심</div>
      <div class="creative-status"><span class="tag tag-active">검토중</span></div>
      <div class="creative-copy">📊 "경쟁사 숏폼, 왜 잘 되는지 데이터로 보여드립니다"<br>CTA: 무료 분석 시작하기</div>
    </div>
    <div class="creative">
      <div class="creative-name">소재 B — 고통 중심</div>
      <div class="creative-status"><span class="tag tag-active">검토중</span></div>
      <div class="creative-copy">😤 "숏폼 매번 감으로 만들고 계신가요?"<br>CTA: AI가 구조를 알려드립니다</div>
    </div>
    <div class="creative">
      <div class="creative-name">소재 C — 비교 중심</div>
      <div class="creative-status"><span class="tag tag-active">검토중</span></div>
      <div class="creative-copy">🔍 "잘 되는 영상 vs 내 영상, 뭐가 다를까?"<br>CTA: 지금 비교해보기</div>
    </div>
    <div class="creative">
      <div class="creative-name">소재 D — 결과 중심</div>
      <div class="creative-status"><span class="tag tag-active">검토중</span></div>
      <div class="creative-copy">🚀 "분석만 했는데 조회수 3배 올랐습니다"<br>CTA: 무료 체험 시작</div>
    </div>
  </div>
</div>

<div class="campaign-card">
  <h4><span class="tag tag-draft">DRAFT</span> [WakaLab] 리타겟팅_방문자_2504</h4>
  <div class="campaign-meta">
    <span>📅 예정: 2026-04</span>
    <span>🎯 전환 목표: Purchase</span>
    <span>📍 Wakawaka 광고 계정</span>
  </div>
  <div class="creative-grid">
    <div class="creative">
      <div class="creative-name">리타겟 A — 무료 체험 강조</div>
      <div class="creative-status"><span class="tag tag-draft">준비중</span></div>
      <div class="creative-copy">🎉 "아직 안 써보셨나요? 1개월 무료!"</div>
    </div>
  </div>
</div>
</div>

<!-- TAB: UTM Builder -->
<div id="tab-utm" class="tab-content">
<div class="utm-form">
  <h3>🔗 UTM 파라미터 빌더</h3>
  <div class="utm-grid">
    <div class="utm-field">
      <label>Base URL *</label>
      <input type="text" id="utm-url" value="https://wakalab.io" placeholder="https://wakalab.io" oninput="buildUTM()">
    </div>
    <div class="utm-field">
      <label>Campaign Source * (utm_source)</label>
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
      <label>Campaign Medium * (utm_medium)</label>
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
      <label>Campaign Name * (utm_campaign)</label>
      <input type="text" id="utm-campaign" value="wakalab_ab_test_2503" placeholder="campaign_name" oninput="buildUTM()">
    </div>
    <div class="utm-field">
      <label>Campaign Term (utm_term)</label>
      <input type="text" id="utm-term" placeholder="keyword" oninput="buildUTM()">
    </div>
    <div class="utm-field">
      <label>Campaign Content (utm_content)</label>
      <input type="text" id="utm-content" placeholder="ad_variant_a" oninput="buildUTM()">
    </div>
  </div>
  <div class="utm-result" id="utm-result"></div>
  <div class="utm-actions">
    <button class="utm-btn utm-btn-primary" onclick="copyUTM()">📋 클립보드 복사</button>
    <button class="utm-btn utm-btn-secondary" onclick="resetUTM()">🔄 초기화</button>
  </div>
</div>

<div class="panel">
  <h3>📌 최근 생성한 UTM 링크</h3>
  <div id="utm-history" style="font-size:.8rem;color:var(--muted)">
    <p>아직 생성된 링크가 없습니다. 위에서 URL을 생성해보세요.</p>
  </div>
</div>
</div>

<div class="copy-toast" id="copy-toast">✅ 클립보드에 복사됨!</div>

<script>
function switchTab(id){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  event.target.classList.add('active');
}
function filterBy(role){
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  event.target.classList.add('active');
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
  if(!base)return;
  const p=new URLSearchParams();
  if(src)p.set('utm_source',src);
  if(med)p.set('utm_medium',med);
  if(camp)p.set('utm_campaign',camp);
  if(term)p.set('utm_term',term);
  if(content)p.set('utm_content',content);
  const url=base+(base.includes('?')?'&':'?')+p.toString();
  document.getElementById('utm-result').textContent=url;
}
function copyUTM(){
  const url=document.getElementById('utm-result').textContent;
  if(!url)return;
  navigator.clipboard.writeText(url).then(()=>{
    const toast=document.getElementById('copy-toast');
    toast.classList.add('show');
    setTimeout(()=>toast.classList.remove('show'),2000);
    // Add to history
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
// Init UTM on load
buildUTM();
</script>
</body>
</html>`;

mkdirSync('docs', { recursive: true });
writeFileSync('docs/index.html', html, 'utf-8');
console.log(`✅ Built dashboard: ${epics.length} epics, ${allTasks.length} tasks, ${pct}% done`);
