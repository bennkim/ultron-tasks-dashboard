#!/usr/bin/env node
/**
 * TASKS.md + ads-data.json → Static Dashboard HTML
 * 2 tabs: Tasks / Ad Manager (with xlsx export)
 * Zero build dependencies — Node.js stdlib only
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// ═══════════════════════════════════════════
// TASKS.MD PARSER
// ═══════════════════════════════════════════
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

// ═══════════════════════════════════════════
// ADS DATA
// ═══════════════════════════════════════════
const adsData = JSON.parse(readFileSync('ads-data.json', 'utf-8'));
const adsDaily = adsData.daily || [];
const adsMeta = adsData.meta || {};
const adsCreatives = adsData.creatives || {};
const creativeKeys = Object.keys(adsCreatives);
const adsDates = [...new Set(adsDaily.map(d => d.date))].sort();
const funnelStages = ['ViewContent','CompleteRegistration','InitiateCheckout','Purchase'];
const funnelLabels = { ViewContent:'페이지 조회', CompleteRegistration:'회원가입', InitiateCheckout:'결제 시작', Purchase:'결제 완료' };

// Per-creative aggregates
const creativeTotals = {};
for (const key of creativeKeys) {
  const rows = adsDaily.filter(d => d.creative === key);
  const t = {
    label: adsCreatives[key].label, key,
    impressions: rows.reduce((s,r)=>s+r.impressions,0),
    reach: rows.reduce((s,r)=>s+r.reach,0),
    clicks: rows.reduce((s,r)=>s+r.clicks,0),
    link_clicks: rows.reduce((s,r)=>s+r.link_clicks,0),
    spend: rows.reduce((s,r)=>s+r.spend,0),
    conversions: rows.reduce((s,r)=>s+r.conversions,0),
    landing_page_views: rows.reduce((s,r)=>s+r.landing_page_views,0),
  };
  t.ctr = t.impressions>0?(t.clicks/t.impressions*100):0;
  t.cpc = t.clicks>0?Math.round(t.spend/t.clicks):0;
  t.cpm = t.impressions>0?Math.round(t.spend/t.impressions*1000):0;
  t.cvr = t.clicks>0?(t.conversions/t.clicks*100):0;
  t.cpa = t.conversions>0?Math.round(t.spend/t.conversions):0;
  t.revenue = rows.reduce((s,r)=>s+(r.funnel?.Purchase?.revenue||0),0);
  t.roas = t.spend>0?(t.revenue/t.spend):0;
  creativeTotals[key] = t;
}

// Daily aggregates
const dailyTotals = adsDates.map(date => {
  const rows = adsDaily.filter(d=>d.date===date);
  const t = { date,
    impressions:rows.reduce((s,r)=>s+r.impressions,0), reach:rows.reduce((s,r)=>s+r.reach,0),
    clicks:rows.reduce((s,r)=>s+r.clicks,0), link_clicks:rows.reduce((s,r)=>s+r.link_clicks,0),
    spend:rows.reduce((s,r)=>s+r.spend,0), conversions:rows.reduce((s,r)=>s+r.conversions,0),
    landing_page_views:rows.reduce((s,r)=>s+r.landing_page_views,0),
  };
  t.ctr=t.impressions>0?(t.clicks/t.impressions*100):0;
  t.cpc=t.clicks>0?Math.round(t.spend/t.clicks):0;
  t.revenue=rows.reduce((s,r)=>s+(r.funnel?.Purchase?.revenue||0),0);
  t.roas=t.spend>0?(t.revenue/t.spend):0;
  return t;
});

// Grand totals
const gt = {
  spend:adsDaily.reduce((s,r)=>s+r.spend,0), impressions:adsDaily.reduce((s,r)=>s+r.impressions,0),
  clicks:adsDaily.reduce((s,r)=>s+r.clicks,0), conversions:adsDaily.reduce((s,r)=>s+r.conversions,0),
  revenue:adsDaily.reduce((s,r)=>s+(r.funnel?.Purchase?.revenue||0),0),
};
gt.ctr=gt.impressions>0?(gt.clicks/gt.impressions*100):0;
gt.roas=gt.spend>0?(gt.revenue/gt.spend):0;

function fmt(n){return typeof n==='number'?n.toLocaleString('ko-KR'):String(n);}
function fmtWon(n){return'₩'+fmt(n);}
function rankBadge(r){if(!r)return'—';if(r.includes('ABOVE'))return'<span class="tag tag-active">상위</span>';if(r.includes('BELOW_AVERAGE_35'))return'<span class="tag tag-ended">하위35%</span>';if(r.includes('BELOW'))return'<span class="tag tag-paused">하위20%</span>';return'<span class="tag tag-draft">평균</span>';}
const roasColor = v => v>=3?'var(--green)':v>=1?'var(--yellow)':'var(--red)';

const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

// ═══════════════════════════════════════════
// HTML TEMPLATE
// ═══════════════════════════════════════════
const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ultron C-Suite Dashboard</title>
<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0d1117;--card:#161b22;--border:#30363d;--text:#e6edf3;--muted:#8b949e;--green:#3fb950;--blue:#58a6ff;--red:#f85149;--yellow:#d29922;--orange:#db6d28;--purple:#bc8cff}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.5;padding:20px;max-width:1200px;margin:0 auto}
h1{font-size:1.5rem;font-weight:600;margin-bottom:4px}
.subtitle{color:var(--muted);font-size:.8rem;margin-bottom:20px}
.tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:24px}
.tab{background:none;border:none;color:var(--muted);padding:12px 24px;font-size:.9rem;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;font-weight:600}
.tab:hover{color:var(--text);background:rgba(88,166,255,.05)}
.tab.active{color:var(--blue);border-bottom-color:var(--blue)}
.tab-content{display:none}.tab-content.active{display:block}
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
.task-table,.data-table{width:100%;border-collapse:collapse;font-size:.8rem}
.task-table th,.data-table th{text-align:left;color:var(--muted);font-weight:500;padding:6px 8px;border-bottom:1px solid var(--border);font-size:.7rem;text-transform:uppercase}
.task-table td,.data-table td{padding:6px 8px;border-bottom:1px solid #21262d}
.data-table .num{text-align:right;font-variant-numeric:tabular-nums}
.data-table .conv{color:var(--green);font-weight:700}
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
.ad-sub-tabs{display:flex;gap:4px;margin-bottom:20px;flex-wrap:wrap}
.ad-sub-tab{background:var(--card);border:1px solid var(--border);color:var(--muted);padding:8px 16px;border-radius:8px;font-size:.8rem;cursor:pointer;font-weight:500;transition:all .15s}
.ad-sub-tab:hover{color:var(--text);border-color:var(--text)}
.ad-sub-tab.active{background:var(--blue);color:#fff;border-color:var(--blue)}
.ad-sub-content{display:none}.ad-sub-content.active{display:block}
.tag{display:inline-block;font-size:.7rem;padding:2px 8px;border-radius:6px;font-weight:500}
.tag-active{background:rgba(63,185,80,.15);color:var(--green)}
.tag-draft{background:rgba(139,148,158,.15);color:var(--muted)}
.tag-paused{background:rgba(210,153,34,.15);color:var(--yellow)}
.tag-ended{background:rgba(248,81,73,.15);color:var(--red)}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px}
.kpi{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center}
.kpi-value{font-size:1.6rem;font-weight:700}.kpi-label{font-size:.7rem;color:var(--muted);margin-top:2px;text-transform:uppercase}
.export-bar{display:flex;gap:8px;margin-bottom:20px;align-items:center}
.export-btn{padding:10px 24px;border-radius:8px;font-size:.85rem;font-weight:600;cursor:pointer;border:none;transition:all .15s;display:flex;align-items:center;gap:6px}
.export-btn-primary{background:var(--green);color:#fff}.export-btn-primary:hover{opacity:.85}
.export-btn-secondary{background:var(--border);color:var(--text)}.export-btn-secondary:hover{background:#3d444d}
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
.funnel-bar{display:flex;align-items:center;gap:8px;margin:4px 0}
.funnel-fill{height:22px;border-radius:4px;min-width:2px;transition:width .3s}
.funnel-label{font-size:.75rem;width:80px;text-align:right;color:var(--muted)}
.funnel-value{font-size:.75rem;font-weight:600}
/* Media Upload */
.media-section{margin-top:24px}
.creative-media-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}
.creative-media-card h4{font-size:.9rem;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:10px}
.media-item{position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--border);background:var(--bg);aspect-ratio:16/9}
.media-item img,.media-item video{width:100%;height:100%;object-fit:cover;cursor:pointer}
.media-item .media-delete{position:absolute;top:4px;right:4px;background:rgba(248,81,73,.85);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:.7rem;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s}
.media-item:hover .media-delete{opacity:1}
.media-upload-zone{border:2px dashed var(--border);border-radius:8px;padding:20px;text-align:center;cursor:pointer;transition:all .15s;color:var(--muted);font-size:.8rem;aspect-ratio:16/9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.media-upload-zone:hover{border-color:var(--blue);color:var(--blue);background:rgba(88,166,255,.05)}
.media-upload-zone .upload-icon{font-size:1.5rem}
.media-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:100;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s}
.media-lightbox.active{opacity:1;pointer-events:auto}
.media-lightbox img,.media-lightbox video{max-width:90vw;max-height:90vh;border-radius:8px;object-fit:contain}
.media-lightbox .lb-close{position:absolute;top:16px;right:16px;background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:1.2rem;cursor:pointer}
.media-count{font-size:.7rem;color:var(--muted);font-weight:400}
@media(max-width:700px){.panels{grid-template-columns:1fr}.summary{grid-template-columns:repeat(3,1fr)}.utm-grid{grid-template-columns:1fr}.kpi-grid{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<h1>📊 Ultron C-Suite Dashboard</h1>
<p class="subtitle">마지막 빌드: ${now} · 캠페인: ${adsMeta.campaignName || '—'} · 광고계정: ${adsMeta.adAccount || '—'}</p>

<div class="tabs">
  <button class="tab active" onclick="switchTab('tasks',this)">📋 Tasks</button>
  <button class="tab" onclick="switchTab('admanager',this)">📢 Ad Manager</button>
</div>

<!-- ══════ TASKS TAB ══════ -->
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
  <div class="panel"><h3>🏆 ICE 랭킹 Top 10</h3>${iceRanking.map((t,i)=>`<div class="rank-item"><span class="rank-num">${i+1}</span><span class="rank-id">${t.id}</span><span>${t.desc.substring(0,30)}${t.desc.length>30?'…':''}</span><span class="rank-score"><span class="ice ${iceClass(t.iceScore)}">${t.iceScore}</span></span></div>`).join('')}</div>
</div>
<div class="filters">
  <button class="filter-btn active" onclick="filterBy('all',this)">전체</button>
  <button class="filter-btn" onclick="filterBy('CEO',this)">🤖 CEO</button>
  <button class="filter-btn" onclick="filterBy('CMO',this)">🎯 CMO</button>
  <button class="filter-btn" onclick="filterBy('CTO',this)">💻 CTO</button>
  <button class="filter-btn" onclick="filterBy('의장',this)">👑 의장</button>
</div>
${epics.map(renderEpic).join('')}
</div>

<!-- ══════ AD MANAGER TAB ══════ -->
<div id="tab-admanager" class="tab-content">

<div class="export-bar">
  <button class="export-btn export-btn-primary" onclick="exportXLSX()">📥 엑셀 다운로드 (.xlsx)</button>
  <span style="color:var(--muted);font-size:.8rem">4시트: Daily Overview / Creative Breakdown / Funnel Analysis / Raw Data</span>
</div>

<div class="ad-sub-tabs">
  <button class="ad-sub-tab active" onclick="switchAdSub('overview',this)">📊 일별 개요</button>
  <button class="ad-sub-tab" onclick="switchAdSub('creatives',this)">🎨 소재 비교</button>
  <button class="ad-sub-tab" onclick="switchAdSub('funnel',this)">🔻 퍼널 분석</button>
  <button class="ad-sub-tab" onclick="switchAdSub('utm',this)">🔗 UTM 빌더</button>
</div>

<!-- Sub: Daily Overview -->
<div id="ad-overview" class="ad-sub-content active">
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-value">${fmtWon(gt.spend)}</div><div class="kpi-label">총 소진액</div></div>
  <div class="kpi"><div class="kpi-value">${fmt(gt.impressions)}</div><div class="kpi-label">총 노출</div></div>
  <div class="kpi"><div class="kpi-value">${fmt(gt.clicks)}</div><div class="kpi-label">총 클릭</div></div>
  <div class="kpi"><div class="kpi-value">${gt.ctr.toFixed(2)}%</div><div class="kpi-label">평균 CTR</div></div>
  <div class="kpi"><div class="kpi-value" style="color:var(--green)">${gt.conversions}건</div><div class="kpi-label">총 전환</div></div>
  <div class="kpi"><div class="kpi-value">${fmtWon(gt.revenue)}</div><div class="kpi-label">총 매출</div></div>
  <div class="kpi"><div class="kpi-value" style="color:${roasColor(gt.roas)}">${gt.roas.toFixed(2)}x</div><div class="kpi-label">ROAS</div></div>
</div>
<div class="panel"><h3>📅 일별 캠페인 합산</h3>
<div style="overflow-x:auto">
<table class="data-table">
<thead><tr><th>날짜</th><th>노출</th><th>도달</th><th>클릭</th><th>링크클릭</th><th>CTR</th><th>CPC</th><th>소진액</th><th>LPV</th><th>전환</th><th>매출</th><th>ROAS</th></tr></thead>
<tbody>
${dailyTotals.map(d=>`<tr><td>${d.date}</td><td class="num">${fmt(d.impressions)}</td><td class="num">${fmt(d.reach)}</td><td class="num">${fmt(d.clicks)}</td><td class="num">${fmt(d.link_clicks)}</td><td class="num">${d.ctr.toFixed(2)}%</td><td class="num">${fmtWon(d.cpc)}</td><td class="num">${fmtWon(d.spend)}</td><td class="num">${fmt(d.landing_page_views)}</td><td class="num conv">${d.conversions}</td><td class="num">${fmtWon(d.revenue)}</td><td class="num" style="color:${roasColor(d.roas)}">${d.roas.toFixed(2)}x</td></tr>`).join('')}
</tbody>
</table>
</div></div>
</div>

<!-- Sub: Creative Breakdown -->
<div id="ad-creatives" class="ad-sub-content">
<div class="section-title">🎨 소재별 누적 성과 (${adsMeta.campaignName || ''})</div>
<div class="panel"><div style="overflow-x:auto">
<table class="data-table">
<thead><tr><th>소재</th><th>utm_content</th><th>노출</th><th>도달</th><th>클릭</th><th>CTR</th><th>CPC</th><th>CPM</th><th>소진액</th><th>전환</th><th>CVR</th><th>CPA</th><th>매출</th><th>ROAS</th></tr></thead>
<tbody>
${creativeKeys.map(k=>{const t=creativeTotals[k];return`<tr><td><strong>${t.label}</strong></td><td style="font-size:.75rem;color:var(--muted)">${k}</td><td class="num">${fmt(t.impressions)}</td><td class="num">${fmt(t.reach)}</td><td class="num">${fmt(t.clicks)}</td><td class="num">${t.ctr.toFixed(2)}%</td><td class="num">${fmtWon(t.cpc)}</td><td class="num">${fmtWon(t.cpm)}</td><td class="num">${fmtWon(t.spend)}</td><td class="num conv">${t.conversions}</td><td class="num">${t.cvr.toFixed(2)}%</td><td class="num">${t.cpa>0?fmtWon(t.cpa):'—'}</td><td class="num">${fmtWon(t.revenue)}</td><td class="num" style="color:${roasColor(t.roas)}">${t.roas.toFixed(2)}x</td></tr>`;}).join('')}
</tbody>
</table>
</div></div>

<div class="section-title">📅 소재별 일별 비교</div>
<div class="panel"><div style="overflow-x:auto">
<table class="data-table">
<thead><tr><th>날짜</th><th>소재</th><th>노출</th><th>클릭</th><th>CTR</th><th>CPC</th><th>소진액</th><th>전환</th><th>ROAS</th><th>품질</th><th>참여도</th><th>전환율</th></tr></thead>
<tbody>
${adsDaily.map(d=>`<tr><td>${d.date}</td><td><strong>${adsCreatives[d.creative]?.label||d.creative}</strong></td><td class="num">${fmt(d.impressions)}</td><td class="num">${fmt(d.clicks)}</td><td class="num">${d.ctr.toFixed(2)}%</td><td class="num">${fmtWon(d.cpc)}</td><td class="num">${fmtWon(d.spend)}</td><td class="num conv">${d.conversions}</td><td class="num" style="color:${roasColor(d.roas)}">${d.roas.toFixed(2)}x</td><td>${rankBadge(d.quality_ranking)}</td><td>${rankBadge(d.engagement_rate_ranking)}</td><td>${rankBadge(d.conversion_rate_ranking)}</td></tr>`).join('')}
</tbody>
</table>
</div></div>
</div>

<div class="media-section">
<div class="section-title">📁 소재별 콘텐츠 미디어</div>
${creativeKeys.map(k => `
<div class="creative-media-card">
  <h4>🎨 ${adsCreatives[k].label} <span class="media-count" id="count-${k}"></span></h4>
  <p style="font-size:.75rem;color:var(--muted);margin-bottom:8px">utm_content: ${k} · "${adsCreatives[k].copy}"</p>
  <div class="media-grid" id="media-${k}">
    <div class="media-upload-zone" onclick="triggerUpload('${k}')">
      <span class="upload-icon">📤</span>
      <span>클릭하여 업로드</span>
      <span style="font-size:.7rem">이미지/동영상</span>
    </div>
  </div>
  <input type="file" id="input-${k}" multiple accept="image/*,video/*" style="display:none" onchange="handleUpload('${k}',this)">
</div>`).join('')}
</div>
</div>

<div class="media-lightbox" id="lightbox" onclick="closeLightbox(event)">
  <button class="lb-close" onclick="closeLightbox(event)">✕</button>
  <div id="lb-content"></div>
</div>

<!-- Sub: Funnel Analysis -->
<div id="ad-funnel" class="ad-sub-content">
<div class="section-title">🔻 퍼널 분석 — 전체 캠페인 합산</div>
${(() => {
  // Build funnel totals
  const ft = {};
  for (const stage of funnelStages) {
    ft[stage] = { count:0, cost:0, revenue:0 };
    for (const d of adsDaily) {
      if(d.funnel&&d.funnel[stage]){
        ft[stage].count+=d.funnel[stage].count||0;
        ft[stage].cost+=d.funnel[stage].cost||0;
        ft[stage].revenue+=d.funnel[stage].revenue||0;
      }
    }
  }
  const maxCount = Math.max(...funnelStages.map(s=>ft[s].count),1);
  const colors = ['var(--blue)','var(--purple)','var(--orange)','var(--green)'];
  let funnelHTML = '<div class="panel">';
  funnelStages.forEach((stage,i) => {
    const pct = Math.round(ft[stage].count/maxCount*100);
    const cvr = i>0&&ft[funnelStages[i-1]].count>0 ? (ft[stage].count/ft[funnelStages[i-1]].count*100).toFixed(1)+'%' : '—';
    funnelHTML += `<div class="funnel-bar"><span class="funnel-label">${funnelLabels[stage]}</span><div class="funnel-fill" style="width:${pct}%;background:${colors[i]}">&nbsp;</div><span class="funnel-value">${ft[stage].count}건 (CPA: ${ft[stage].cost>0&&ft[stage].count>0?fmtWon(Math.round(ft[stage].cost/ft[stage].count)):'—'}) ${i>0?'전환율: '+cvr:''}</span></div>`;
  });
  funnelHTML += '</div>';

  // Per-creative funnel table
  funnelHTML += '<div class="section-title">소재별 퍼널 비교</div><div class="panel"><div style="overflow-x:auto"><table class="data-table"><thead><tr><th>소재</th>';
  for (const stage of funnelStages) funnelHTML += `<th>${funnelLabels[stage]} 건수</th><th>비용</th>`;
  funnelHTML += '<th>Purchase 매출</th><th>ROAS</th></tr></thead><tbody>';
  for (const k of creativeKeys) {
    const rows = adsDaily.filter(d=>d.creative===k);
    const cf = {};
    for (const stage of funnelStages) {
      cf[stage]={count:0,cost:0,revenue:0};
      for(const r of rows){if(r.funnel&&r.funnel[stage]){cf[stage].count+=r.funnel[stage].count||0;cf[stage].cost+=r.funnel[stage].cost||0;cf[stage].revenue+=r.funnel[stage].revenue||0;}}
    }
    const rev = cf.Purchase.revenue;
    const spend = creativeTotals[k].spend;
    funnelHTML += `<tr><td><strong>${adsCreatives[k].label}</strong></td>`;
    for (const stage of funnelStages) funnelHTML += `<td class="num">${cf[stage].count}</td><td class="num">${fmtWon(cf[stage].cost)}</td>`;
    funnelHTML += `<td class="num conv">${fmtWon(rev)}</td><td class="num" style="color:${roasColor(spend>0?rev/spend:0)}">${spend>0?(rev/spend).toFixed(2)+'x':'—'}</td></tr>`;
  }
  funnelHTML += '</tbody></table></div></div>';
  return funnelHTML;
})()}
</div>

<!-- Sub: UTM Builder -->
<div id="ad-utm" class="ad-sub-content">
<div class="utm-form">
  <h3>🔗 UTM 파라미터 빌더</h3>
  <div class="utm-grid">
    <div class="utm-field full"><label>Base URL *</label><input type="text" id="utm-url" value="https://wakalab.io" oninput="buildUTM()"></div>
    <div class="utm-field"><label>utm_source *</label><select id="utm-source" onchange="buildUTM()"><option value="meta">meta</option><option value="google">google</option><option value="naver">naver</option><option value="tiktok">tiktok</option><option value="instagram">instagram</option><option value="youtube">youtube</option></select></div>
    <div class="utm-field"><label>utm_medium *</label><select id="utm-medium" onchange="buildUTM()"><option value="paid_social">paid_social</option><option value="cpc">cpc</option><option value="display">display</option><option value="email">email</option><option value="organic">organic</option></select></div>
    <div class="utm-field"><label>utm_campaign *</label><input type="text" id="utm-campaign" value="${adsMeta.campaignName||''}" oninput="buildUTM()"></div>
    <div class="utm-field"><label>utm_content</label><select id="utm-content" onchange="buildUTM()"><option value="">선택...</option>${creativeKeys.map(k=>`<option value="${k}">${k}</option>`).join('')}</select></div>
    <div class="utm-field"><label>utm_term</label><input type="text" id="utm-term" placeholder="keyword" oninput="buildUTM()"></div>
  </div>
  <div class="utm-result" id="utm-result"></div>
  <div class="utm-actions">
    <button class="utm-btn utm-btn-primary" onclick="copyUTM()">📋 복사</button>
    <button class="utm-btn utm-btn-secondary" onclick="resetUTM()">🔄 초기화</button>
  </div>
</div>
<div class="panel"><h3>📌 최근 생성한 UTM 링크</h3><div id="utm-history" style="font-size:.8rem;color:var(--muted)"><p>아직 생성된 링크가 없습니다.</p></div></div>
</div>

</div><!-- /tab-admanager -->

<div class="copy-toast" id="copy-toast">✅ 복사됨!</div>

<script>
// ── Embedded ads data for xlsx export ──
const ADS_RAW = ${JSON.stringify(adsDaily)};
const ADS_META = ${JSON.stringify(adsMeta)};
const ADS_CREATIVES = ${JSON.stringify(adsCreatives)};
const CREATIVE_KEYS = ${JSON.stringify(creativeKeys)};
const FUNNEL_STAGES = ['ViewContent','CompleteRegistration','InitiateCheckout','Purchase'];
const FUNNEL_KO = {ViewContent:'페이지 조회',CompleteRegistration:'회원가입',InitiateCheckout:'결제 시작',Purchase:'결제 완료'};

// ── Tab switching ──
function switchTab(id,btn){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));document.getElementById('tab-'+id).classList.add('active');btn.classList.add('active');}
function switchAdSub(id,btn){document.querySelectorAll('.ad-sub-tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.ad-sub-content').forEach(c=>c.classList.remove('active'));document.getElementById('ad-'+id).classList.add('active');btn.classList.add('active');}
function filterBy(role,btn){document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.task-row').forEach(row=>{if(role==='all'){row.style.display='';return;}const a=row.querySelector('.task-assignee')?.textContent||'';row.style.display=a.includes(role)?'':'none';});}

// ── UTM Builder ──
function buildUTM(){const base=document.getElementById('utm-url').value.trim();if(!base){document.getElementById('utm-result').textContent='';return;}const p=new URLSearchParams();['source','medium','campaign','content','term'].forEach(k=>{const v=document.getElementById('utm-'+k).value.trim();if(v)p.set('utm_'+k,v);});document.getElementById('utm-result').textContent=base+(base.includes('?')?'&':'?')+p.toString();}
function copyUTM(){const url=document.getElementById('utm-result').textContent;if(!url)return;navigator.clipboard.writeText(url).then(()=>{showToast();const hist=document.getElementById('utm-history');const f=hist.querySelector('p');if(f)hist.innerHTML='';const d=document.createElement('div');d.style.cssText='padding:6px 0;border-bottom:1px solid var(--border);word-break:break-all';d.innerHTML='<span style="color:var(--blue)">'+url+'</span> <span style="color:var(--muted);font-size:.7rem">'+new Date().toLocaleTimeString('ko-KR')+'</span>';hist.prepend(d);});}
function resetUTM(){document.getElementById('utm-url').value='https://wakalab.io';document.getElementById('utm-source').value='meta';document.getElementById('utm-medium').value='paid_social';document.getElementById('utm-campaign').value=ADS_META.campaignName||'';document.getElementById('utm-content').value='';document.getElementById('utm-term').value='';buildUTM();}
function showToast(){const t=document.getElementById('copy-toast');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2000);}
buildUTM();

// ═══ XLSX EXPORT (SheetJS) ═══
function exportXLSX(){
  if(typeof XLSX==='undefined'){alert('SheetJS 로딩 실패. 새로고침 후 다시 시도해주세요.');return;}
  const wb=XLSX.utils.book_new();
  const campaign=ADS_META.campaignName||'campaign';

  // Sheet1: Daily Overview
  const dates=[...new Set(ADS_RAW.map(d=>d.date))].sort();
  const s1=dates.map(date=>{
    const rows=ADS_RAW.filter(d=>d.date===date);
    const o={날짜:date};
    o.노출=rows.reduce((s,r)=>s+r.impressions,0);
    o.도달=rows.reduce((s,r)=>s+r.reach,0);
    o.빈도=+(rows.reduce((s,r)=>s+r.frequency,0)/rows.length).toFixed(2);
    o.클릭=rows.reduce((s,r)=>s+r.clicks,0);
    o.링크클릭=rows.reduce((s,r)=>s+r.link_clicks,0);
    o.CTR=+(o.노출>0?(o.클릭/o.노출*100):0).toFixed(2);
    o.CPC=o.클릭>0?Math.round(rows.reduce((s,r)=>s+r.spend,0)/o.클릭):0;
    o.CPM=o.노출>0?Math.round(rows.reduce((s,r)=>s+r.spend,0)/o.노출*1000):0;
    o.소진액=rows.reduce((s,r)=>s+r.spend,0);
    o.LPV=rows.reduce((s,r)=>s+r.landing_page_views,0);
    o.전환=rows.reduce((s,r)=>s+r.conversions,0);
    o.CVR=+(o.클릭>0?(o.전환/o.클릭*100):0).toFixed(2);
    o.CPA=o.전환>0?Math.round(o.소진액/o.전환):0;
    const rev=rows.reduce((s,r)=>s+(r.funnel?.Purchase?.revenue||0),0);
    o.매출=rev;
    o.ROAS=+(o.소진액>0?(rev/o.소진액):0).toFixed(2);
    return o;
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(s1),'Daily Overview');

  // Sheet2: Creative Breakdown
  const s2=ADS_RAW.map(d=>({
    날짜:d.date,캠페인:campaign,소재:ADS_CREATIVES[d.creative]?.label||d.creative,utm_content:d.creative,
    노출:d.impressions,도달:d.reach,빈도:d.frequency,클릭:d.clicks,링크클릭:d.link_clicks,
    CTR:d.ctr,CPC:d.cpc,CPM:d.cpm,소진액:d.spend,LPV:d.landing_page_views,
    전환:d.conversions,CVR:d.cvr,CPA:d.cpa,ROAS:d.roas,
    품질순위:d.quality_ranking,참여도순위:d.engagement_rate_ranking,전환율순위:d.conversion_rate_ranking
  }));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(s2),'Creative Breakdown');

  // Sheet3: Funnel Analysis
  const s3=[];
  for(const k of CREATIVE_KEYS){
    const rows=ADS_RAW.filter(d=>d.creative===k);
    for(const stage of FUNNEL_STAGES){
      const f={소재:ADS_CREATIVES[k]?.label||k,utm_content:k,퍼널단계:FUNNEL_KO[stage],이벤트:stage};
      f.건수=rows.reduce((s,r)=>s+(r.funnel?.[stage]?.count||0),0);
      f.비용=rows.reduce((s,r)=>s+(r.funnel?.[stage]?.cost||0),0);
      if(stage==='Purchase'){f.매출=rows.reduce((s,r)=>s+(r.funnel?.[stage]?.revenue||0),0);f.ROAS=f.비용>0?+(f.매출/f.비용).toFixed(2):0;}
      s3.push(f);
    }
  }
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(s3),'Funnel Analysis');

  // Sheet4: Raw Data
  const s4=ADS_RAW.map(d=>{
    const o={date:d.date,campaign:campaign,creative:d.creative,utm_content:d.creative,
      impressions:d.impressions,reach:d.reach,frequency:d.frequency,clicks:d.clicks,link_clicks:d.link_clicks,
      ctr:d.ctr,cpc:d.cpc,cpm:d.cpm,spend:d.spend,landing_page_views:d.landing_page_views,
      conversions:d.conversions,cvr:d.cvr,cpa:d.cpa,roas:d.roas,
      quality_ranking:d.quality_ranking,engagement_rate_ranking:d.engagement_rate_ranking,conversion_rate_ranking:d.conversion_rate_ranking};
    for(const stage of FUNNEL_STAGES){
      o[stage+'_count']=d.funnel?.[stage]?.count||0;
      o[stage+'_cost']=d.funnel?.[stage]?.cost||0;
      if(stage==='Purchase')o[stage+'_revenue']=d.funnel?.[stage]?.revenue||0;
    }
    return o;
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(s4),'Raw Data');

  XLSX.writeFile(wb,campaign+'_report.xlsx');
  showToast();
}

// ═══ MEDIA UPLOAD (localStorage) ═══
const MEDIA_KEY='ultron_ad_media_';
function getMedia(key){try{return JSON.parse(localStorage.getItem(MEDIA_KEY+key)||'[]');}catch{return[];}}
function saveMedia(key,arr){try{localStorage.setItem(MEDIA_KEY+key,JSON.stringify(arr));}catch(e){alert('저장 용량 초과! 파일 크기를 줄여주세요.');}}
function triggerUpload(key){document.getElementById('input-'+key).click();}
function handleUpload(key,input){
  const files=Array.from(input.files);
  if(!files.length)return;
  const media=getMedia(key);
  let loaded=0;
  files.forEach(file=>{
    if(file.size>5*1024*1024){alert(file.name+': 5MB 초과. 스킵합니다.');loaded++;return;}
    const reader=new FileReader();
    reader.onload=e=>{
      media.push({name:file.name,type:file.type,data:e.target.result,date:new Date().toISOString()});
      loaded++;
      if(loaded===files.length){saveMedia(key,media);renderMedia(key);}
    };
    reader.readAsDataURL(file);
  });
  input.value='';
}
function deleteMedia(key,idx){
  const media=getMedia(key);
  media.splice(idx,1);
  saveMedia(key,media);
  renderMedia(key);
}
function renderMedia(key){
  const media=getMedia(key);
  const grid=document.getElementById('media-'+key);
  const countEl=document.getElementById('count-'+key);
  countEl.textContent=media.length>0?media.length+'개 파일':'';
  // Keep upload zone, clear rest
  const zone=grid.querySelector('.media-upload-zone');
  grid.innerHTML='';
  media.forEach((m,i)=>{
    const item=document.createElement('div');
    item.className='media-item';
    if(m.type&&m.type.startsWith('video')){
      item.innerHTML='<video src="'+m.data+'" onclick="openLightbox(\\''+key+'\\','+i+')" muted></video><button class="media-delete" onclick="event.stopPropagation();deleteMedia(\\''+key+'\\','+i+')">✕</button>';
    } else {
      item.innerHTML='<img src="'+m.data+'" alt="'+m.name+'" onclick="openLightbox(\\''+key+'\\','+i+')"><button class="media-delete" onclick="event.stopPropagation();deleteMedia(\\''+key+'\\','+i+')">✕</button>';
    }
    grid.appendChild(item);
  });
  grid.appendChild(zone);
}
function openLightbox(key,idx){
  const media=getMedia(key);
  const m=media[idx];
  if(!m)return;
  const lb=document.getElementById('lightbox');
  const content=document.getElementById('lb-content');
  if(m.type&&m.type.startsWith('video')){
    content.innerHTML='<video src="'+m.data+'" controls autoplay style="max-width:90vw;max-height:90vh;border-radius:8px"></video>';
  } else {
    content.innerHTML='<img src="'+m.data+'" style="max-width:90vw;max-height:90vh;border-radius:8px">';
  }
  lb.classList.add('active');
}
function closeLightbox(e){
  if(e.target.id==='lightbox'||e.target.classList.contains('lb-close')){
    document.getElementById('lightbox').classList.remove('active');
    document.getElementById('lb-content').innerHTML='';
  }
}
// Init: render saved media on load
CREATIVE_KEYS.forEach(k=>renderMedia(k));
<\/script>
</body>
</html>`;

mkdirSync('docs', { recursive: true });
writeFileSync('docs/index.html', html, 'utf-8');
console.log(`✅ Built: ${epics.length} epics, ${allTasks.length} tasks (${pct}%) | Ads: ${adsDaily.length} daily rows, ${creativeKeys.length} creatives`);
