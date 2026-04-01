#!/usr/bin/env node
/**
 * TASKS.md + ads-data.json → Static Dashboard HTML
 * 2 tabs: Tasks / Ad Manager (with xlsx export)
 * Zero build dependencies — Node.js stdlib only
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// ═══════════════════════════════════════════
// TASK HISTORY PARSER
// ═══════════════════════════════════════════
let taskHistory = {};
try {
  const histFile = JSON.parse(readFileSync('task-history.json', 'utf-8'));
  taskHistory = histFile.history || {};
} catch(e) {
  console.warn('task-history.json not found, skipping history');
}

// ═══════════════════════════════════════════
// TASKS.MD PARSER
// ═══════════════════════════════════════════
// TASKS.md 파싱 제거 — D1 API에서 런타임 fetch로 대체
const epics = []; // 빈 배열 (클라이언트 사이드에서 로드)

// 통계 변수 초기화 (클라이언트 사이드에서 계산)
const allTasks = [];
const total = 0, done = 0, inProgress = 0, blocked = 0, todo = 0, pct = 0;
const blockers = [];
const iceRanking = [];

// No more build-time ads data — fetched from D1 API at runtime

// No more build-time ads data — fetched from D1 API at runtime

const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

// ═══════════════════════════════════════════
// HTML TEMPLATE — F-Layout Dashboard
// ═══════════════════════════════════════════
const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ultron C-Suite Dashboard</title>
<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"><\/script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#f8fafc;--card:#ffffff;--border:#e2e8f0;--text:#1e293b;--muted:#64748b;--green:#10b981;--blue:#3b82f6;--blue-dark:#1d4ed8;--blue-light:#dbeafe;--red:#ef4444;--yellow:#f59e0b;--orange:#f97316;--purple:#8b5cf6;--shadow:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);--shadow-md:0 4px 6px rgba(0,0,0,.05),0 2px 4px rgba(0,0,0,.03);--shadow-lg:0 10px 15px rgba(0,0,0,.06),0 4px 6px rgba(0,0,0,.03);--sidebar-w:200px}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;margin:0}

/* ═══ F-LAYOUT ═══ */
.app{display:flex;min-height:100vh}

/* Sidebar */
.sidebar{width:var(--sidebar-w);background:var(--card);border-right:1px solid var(--border);position:fixed;top:0;left:0;bottom:0;display:flex;flex-direction:column;z-index:50;overflow-y:auto;box-shadow:var(--shadow)}
.sidebar-logo{padding:20px 16px 12px;border-bottom:1px solid var(--border)}
.sidebar-logo h1{font-size:1rem;font-weight:700;color:var(--blue-dark);letter-spacing:-.02em}
.sidebar-logo .subtitle{font-size:.65rem;color:var(--muted);margin-top:2px}
.sidebar-nav{flex:1;padding:12px 8px}
.nav-item{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;font-size:.82rem;font-weight:600;color:var(--muted);cursor:pointer;transition:all .15s;user-select:none;margin-bottom:2px}
.nav-item:hover{color:var(--text);background:var(--blue-light)}
.nav-item.active{color:var(--blue-dark);background:var(--blue-light)}
.nav-icon{font-size:1rem;width:20px;text-align:center}
.sidebar-footer{padding:12px 16px;border-top:1px solid var(--border);font-size:.7rem;color:var(--muted)}
.sidebar-footer .progress-mini{height:6px;background:var(--blue-light);border-radius:3px;overflow:hidden;margin-top:6px}
.sidebar-footer .progress-mini-fill{height:100%;background:var(--blue);border-radius:3px;transition:width .8s}

/* Main */
.main{margin-left:var(--sidebar-w);flex:1;padding:24px 28px;max-width:1100px}
.main-section{display:none;animation:fadeIn .25s ease}.main-section.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes countUp{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}

/* Mobile hamburger */
.hamburger{display:none;position:fixed;top:12px;left:12px;z-index:60;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:8px 10px;cursor:pointer;box-shadow:var(--shadow);font-size:1.1rem;line-height:1}
.sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:40;backdrop-filter:blur(2px)}

/* Stats */
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:14px;margin-bottom:24px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;text-align:center;box-shadow:var(--shadow);transition:all .2s;cursor:default}
.stat:hover{box-shadow:var(--shadow-md);transform:translateY(-2px)}
.stat-value{font-size:1.8rem;font-weight:700;animation:countUp .5s ease}.stat-label{font-size:.72rem;color:var(--muted);margin-top:4px;font-weight:500;text-transform:uppercase;letter-spacing:.5px}
.stat-done .stat-value{color:var(--green)}.stat-progress .stat-value{color:var(--blue)}
.stat-blocked .stat-value{color:var(--red)}.stat-todo .stat-value{color:var(--yellow)}

/* Progress */
.progress-section{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:24px;box-shadow:var(--shadow)}
.progress-section h2{font-size:.9rem;margin-bottom:10px;color:var(--blue-dark)}
.big-bar{height:26px;background:var(--blue-light);border-radius:13px;overflow:hidden}
.big-fill{height:100%;background:linear-gradient(90deg,var(--blue),var(--blue-dark));border-radius:13px;transition:width 1s ease}
.big-pct{text-align:right;font-size:.8rem;color:var(--muted);margin-top:6px;font-weight:500}

/* Filters */
.filters{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.filter-btn{background:var(--card);border:1px solid var(--border);color:var(--muted);padding:6px 16px;border-radius:20px;font-size:.75rem;cursor:pointer;transition:all .2s;font-weight:500;box-shadow:var(--shadow)}
.filter-btn:hover{border-color:var(--blue);color:var(--blue);box-shadow:0 0 0 3px rgba(59,130,246,.1)}
.filter-btn.active{background:var(--blue);color:#fff;border-color:var(--blue);box-shadow:0 2px 8px rgba(59,130,246,.25)}
.section-title{font-size:1.05rem;font-weight:700;margin:24px 0 14px;color:var(--blue-dark)}

/* Home sections */
.home-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.home-link{display:inline-flex;align-items:center;gap:4px;font-size:.8rem;color:var(--blue);font-weight:600;cursor:pointer;margin-top:12px;transition:opacity .15s}.home-link:hover{opacity:.7}

/* Epics & Stories */
.epic{background:var(--card);border:1px solid var(--border);border-radius:14px;margin-bottom:14px;overflow:hidden;box-shadow:var(--shadow);transition:box-shadow .2s}
.epic:hover{box-shadow:var(--shadow-md)}
.epic-header{display:flex;align-items:center;gap:8px;padding:16px 18px;cursor:pointer;user-select:none;flex-wrap:wrap;transition:background .15s}
.epic-header:hover{background:var(--blue-light)}
.epic.collapsed .epic-body{display:none}.epic.collapsed .chevron{transform:rotate(-90deg)}
.chevron{font-size:.7rem;color:var(--muted);transition:transform .25s ease;width:14px}
.epic-id{font-size:.75rem;color:var(--blue);font-weight:700;background:var(--blue-light);padding:2px 8px;border-radius:6px}
.epic-title{font-weight:600;flex:1;min-width:150px}
.priority{font-size:.72rem;padding:3px 10px;border-radius:10px;background:var(--blue-light);color:var(--blue-dark);font-weight:600}
.epic-status{font-size:.75rem;color:var(--muted)}
.progress-bar{width:80px;height:6px;background:var(--blue-light);border-radius:3px;overflow:hidden}
.progress-fill{height:100%;background:var(--blue);border-radius:3px;transition:width .8s ease}
.progress-text{font-size:.75rem;color:var(--muted);width:35px;text-align:right;font-weight:600}

.story{border-top:1px solid var(--border)}
.story-header{display:flex;align-items:center;gap:8px;padding:12px 18px 12px 36px;cursor:pointer;user-select:none;flex-wrap:wrap;transition:background .15s}
.story-header:hover{background:rgba(59,130,246,.04)}
.story.collapsed .story-body{display:none}.story.collapsed .chevron{transform:rotate(-90deg)}
.story-id{font-size:.7rem;color:var(--purple);font-weight:700;background:rgba(139,92,246,.08);padding:2px 8px;border-radius:6px}
.story-title{flex:1;font-size:.9rem;min-width:120px}
.story-progress{font-size:.75rem;color:var(--muted);font-weight:500}
.mini-bar{width:50px;height:4px;background:var(--blue-light);border-radius:2px;overflow:hidden}
.mini-fill{height:100%;background:var(--blue);border-radius:2px;transition:width .6s ease}
.story-body{padding:0 18px 14px 36px;overflow-x:auto}

/* Tables */
.task-table,.data-table{width:100%;border-collapse:separate;border-spacing:0;font-size:.8rem}
.task-table th,.data-table th{text-align:left;color:var(--muted);font-weight:600;padding:8px 10px;border-bottom:2px solid var(--border);font-size:.7rem;text-transform:uppercase;letter-spacing:.5px;position:sticky;top:0;background:var(--card)}
.task-table td,.data-table td{padding:8px 10px;border-bottom:1px solid var(--border);transition:background .1s}
.task-table tr:hover td,.data-table tr:hover td{background:rgba(59,130,246,.03)}
.data-table .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:500}
.data-table .conv{color:var(--green);font-weight:700}
.task-table{table-layout:fixed}
.task-table th:nth-child(1),.task-table td:nth-child(1){width:70px}
.task-table th:nth-child(2),.task-table td:nth-child(2){width:50px;text-align:center}
.task-table th:nth-child(3),.task-table td:nth-child(3){width:60px}
.task-table th:nth-child(4),.task-table td:nth-child(4){width:auto}
.task-table th:nth-child(5),.task-table td:nth-child(5){width:90px;white-space:nowrap;font-size:.75rem;color:var(--muted)}
.task-table th:nth-child(6),.task-table td:nth-child(6){width:70px;text-align:right}
.task-id{font-weight:700;color:var(--blue);white-space:nowrap}
.task-desc{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* Badges */
.badge{font-size:.68rem;padding:2px 10px;border-radius:10px;white-space:nowrap;font-weight:600}
.badge-done{background:rgba(16,185,129,.1);color:var(--green)}.badge-progress{background:var(--blue-light);color:var(--blue)}
.badge-blocked{background:rgba(239,68,68,.08);color:var(--red)}.badge-todo{background:rgba(245,158,11,.08);color:var(--yellow)}
.badge-backlog{background:rgba(100,116,139,.08);color:var(--muted)}.badge-review{background:rgba(139,92,246,.08);color:var(--purple)}

/* ICE */
.ice{font-weight:700;font-size:.78rem;padding:2px 8px;border-radius:6px;display:inline-block}
.ice-critical{color:#fff;background:var(--red)}.ice-high{color:#fff;background:var(--orange)}
.ice-medium{color:#fff;background:var(--yellow)}.ice-low{color:var(--muted);background:rgba(100,116,139,.08)}

/* Panels */
.panel{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:16px;box-shadow:var(--shadow)}
.panel h3{font-size:.88rem;margin-bottom:12px;color:var(--blue-dark);font-weight:700}
.home-tab-bar{display:flex;gap:0;margin-bottom:12px;border-bottom:2px solid var(--border)}
.home-tab{background:none;border:none;padding:8px 16px;cursor:pointer;font-size:.82rem;font-weight:600;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .2s}
.home-tab.active{color:var(--blue);border-bottom-color:var(--blue)}
.home-tab:hover{color:var(--blue-dark)}
.home-tab-content{display:none}.home-tab-content.active{display:block}
.task-link{cursor:pointer;transition:color .15s}.task-link:hover{color:var(--blue);text-decoration:underline}
.task-owner{color:var(--blue);font-size:.75rem;font-weight:600;margin-left:auto;white-space:nowrap}
.task-date-sm{color:var(--muted);font-size:.72rem;margin-left:8px;white-space:nowrap}
.blocker-item,.rank-item{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:.85rem}
.blocker-item:last-child,.rank-item:last-child{border:none}
.rank-num{color:var(--blue);font-weight:700;width:22px;text-align:right;font-size:.9rem}
.rank-id{color:var(--blue);font-weight:700}
.rank-score{margin-left:auto}
.panels{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}

/* Ad Manager Sub-tabs */
.ad-sub-tabs{display:flex;gap:6px;margin-bottom:22px;flex-wrap:wrap}
.ad-sub-tab{background:var(--card);border:1px solid var(--border);color:var(--muted);padding:8px 18px;border-radius:10px;font-size:.8rem;cursor:pointer;font-weight:600;transition:all .2s;box-shadow:var(--shadow)}
.ad-sub-tab:hover{color:var(--blue);border-color:var(--blue);box-shadow:0 0 0 3px rgba(59,130,246,.08)}
.ad-sub-tab.active{background:var(--blue);color:#fff;border-color:var(--blue);box-shadow:0 2px 8px rgba(59,130,246,.3)}
.ad-sub-content{display:none;animation:slideUp .3s ease}.ad-sub-content.active{display:block}

/* Tags */
.tag{display:inline-block;font-size:.68rem;padding:2px 8px;border-radius:6px;font-weight:600}
.tag-active{background:rgba(16,185,129,.1);color:var(--green)}
.tag-draft{background:rgba(100,116,139,.08);color:var(--muted)}
.tag-paused{background:rgba(245,158,11,.08);color:var(--yellow)}
.tag-ended{background:rgba(239,68,68,.08);color:var(--red)}

/* KPI Grid */
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:24px}
.kpi{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;text-align:center;box-shadow:var(--shadow);transition:all .2s}
.kpi:hover{box-shadow:var(--shadow-md);transform:translateY(-2px)}
.kpi-value{font-size:1.5rem;font-weight:700;animation:countUp .5s ease}.kpi-label{font-size:.68rem;color:var(--muted);margin-top:4px;text-transform:uppercase;font-weight:600;letter-spacing:.5px}
/* Home KPI (smaller) */
.kpi-sm .kpi-value{font-size:1.1rem}.kpi-sm{padding:14px}

/* Export */
.export-bar{display:flex;gap:8px;margin-bottom:22px;align-items:center}
.export-btn{padding:10px 24px;border-radius:10px;font-size:.85rem;font-weight:600;cursor:pointer;border:none;transition:all .2s;display:flex;align-items:center;gap:6px;box-shadow:var(--shadow)}
.export-btn-primary{background:var(--blue);color:#fff}.export-btn-primary:hover{background:var(--blue-dark);box-shadow:0 4px 12px rgba(59,130,246,.3)}

/* UTM */
.utm-form{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:22px;margin-bottom:20px;box-shadow:var(--shadow)}
.utm-form h3{font-size:.95rem;margin-bottom:16px;color:var(--blue-dark);font-weight:700}
.utm-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.utm-field label{display:block;font-size:.7rem;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.utm-field input,.utm-field select{width:100%;padding:9px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:.85rem;outline:none;transition:all .2s}
.utm-field input:focus,.utm-field select:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(59,130,246,.1)}
.utm-field.full{grid-column:1/-1}
.utm-result{margin-top:16px;padding:14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;font-size:.8rem;word-break:break-all;color:var(--blue);min-height:42px;font-family:'SF Mono',Menlo,monospace}
.utm-actions{display:flex;gap:8px;margin-top:14px}
.utm-btn{padding:9px 22px;border-radius:10px;font-size:.8rem;font-weight:600;cursor:pointer;border:none;transition:all .2s}
.utm-btn-primary{background:var(--blue);color:#fff;box-shadow:0 2px 6px rgba(59,130,246,.2)}.utm-btn-primary:hover{background:var(--blue-dark)}
.utm-btn-secondary{background:var(--bg);border:1px solid var(--border);color:var(--text)}.utm-btn-secondary:hover{border-color:var(--blue);color:var(--blue)}
.copy-toast{position:fixed;bottom:20px;right:20px;background:var(--blue);color:#fff;padding:12px 22px;border-radius:10px;font-size:.85rem;opacity:0;transition:all .3s;pointer-events:none;z-index:99;box-shadow:0 4px 12px rgba(59,130,246,.3);transform:translateY(8px)}
.copy-toast.show{opacity:1;transform:translateY(0)}

/* Funnel */
.funnel-bar{display:flex;align-items:center;gap:8px;margin:6px 0}
.funnel-fill{height:26px;border-radius:6px;min-width:2px;transition:width .6s ease}
.funnel-label{font-size:.75rem;width:80px;text-align:right;color:var(--muted);font-weight:500}
.funnel-value{font-size:.75rem;font-weight:600}

/* Row Media Upload */
.media-cell{min-width:80px}
.row-media{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px}
.row-media-thumb{position:relative;width:36px;height:36px;border-radius:6px;overflow:hidden;border:1px solid var(--border);cursor:pointer;transition:transform .15s;box-shadow:var(--shadow)}
.row-media-thumb:hover{transform:scale(1.1)}
.row-media-thumb img,.row-media-thumb video{width:100%;height:100%;object-fit:cover}
.row-media-thumb .thumb-del{position:absolute;inset:0;background:rgba(239,68,68,.8);color:#fff;border:none;font-size:.6rem;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s;border-radius:6px}
.row-media-thumb:hover .thumb-del{opacity:1}
.row-upload-btn{background:var(--bg);border:1px solid var(--border);color:var(--muted);width:36px;height:36px;border-radius:6px;cursor:pointer;font-size:.9rem;display:flex;align-items:center;justify-content:center;transition:all .2s;box-shadow:var(--shadow)}
.row-upload-btn:hover{border-color:var(--blue);color:var(--blue);background:var(--blue-light)}
.kw-tag{display:inline-block;font-size:.6rem;padding:2px 7px;border-radius:4px;background:var(--blue-light);color:var(--blue-dark);margin:1px 2px;white-space:nowrap;font-weight:600}

/* Lightbox */
.media-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:200;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .25s;backdrop-filter:blur(8px)}
.media-lightbox.active{opacity:1;pointer-events:auto}
.media-lightbox img,.media-lightbox video{max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.media-lightbox .lb-close{position:absolute;top:20px;right:20px;background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:50%;width:40px;height:40px;font-size:1.2rem;cursor:pointer;backdrop-filter:blur(4px);transition:background .15s}
.media-lightbox .lb-close:hover{background:rgba(255,255,255,.25)}
.red-dot{display:inline-block;width:8px;height:8px;background:#ef4444;border-radius:50%;margin-left:4px;vertical-align:middle;animation:dot-pulse 1.5s ease-in-out infinite}
@keyframes dot-pulse{0%,100%{opacity:1}50%{opacity:.4}}
.nav-badge{background:#ef4444;color:#fff;font-size:.65rem;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:auto;min-width:18px;text-align:center;line-height:1.3}

/* ID Links */
.id-link{cursor:pointer;transition:opacity .15s}.id-link:hover{opacity:.7;text-decoration:underline}

/* History Modal */
.history-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:150;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .25s;backdrop-filter:blur(4px)}.history-modal-overlay.active{opacity:1;pointer-events:auto}
.history-modal{background:var(--card);border-radius:16px;padding:24px;max-width:520px;width:90vw;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.15);position:relative}
.history-modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:12px}
.history-modal-title{font-size:1rem;font-weight:700;color:var(--blue-dark);flex:1}
.history-modal-close{background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--muted);padding:4px 8px;border-radius:8px;transition:background .15s;flex-shrink:0}.history-modal-close:hover{background:var(--blue-light);color:var(--blue)}
.timeline{display:flex;flex-direction:column;gap:12px}
.timeline-item{display:flex;gap:12px;align-items:flex-start}
.timeline-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0;margin-top:2px}
.tl-created{background:rgba(59,130,246,.12);color:var(--blue)}.tl-progress{background:rgba(245,158,11,.12);color:var(--yellow)}.tl-done{background:rgba(16,185,129,.12);color:var(--green)}.tl-blocked{background:rgba(239,68,68,.1);color:var(--red)}
.timeline-content{flex:1}.tl-meta{font-size:.72rem;color:var(--muted);margin-bottom:3px;font-weight:500}.tl-note{font-size:.85rem;color:var(--text);line-height:1.5}
.no-history{color:var(--muted);font-size:.85rem;padding:8px 0}

/* Creative Detail Modal */
.creative-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:150;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .25s;backdrop-filter:blur(4px)}.creative-modal-overlay.active{opacity:1;pointer-events:auto}
.creative-modal{background:var(--card);border-radius:16px;padding:24px;max-width:600px;width:90vw;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.15);position:relative}
.creative-modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.creative-modal-title{font-size:1rem;font-weight:700;color:var(--blue-dark)}
.creative-modal-close{background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--muted);padding:4px 8px;border-radius:8px}.creative-modal-close:hover{background:var(--blue-light);color:var(--blue)}
.cm-section{margin-bottom:18px}
.cm-section h4{font-size:.85rem;font-weight:700;color:var(--blue-dark);margin-bottom:8px}
.cm-utm{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px;font-size:.8rem;word-break:break-all;color:var(--blue);font-family:'SF Mono',Menlo,monospace;display:flex;align-items:center;gap:8px}
.cm-utm-url{flex:1}.cm-utm-copy{background:var(--blue);color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:.75rem;cursor:pointer;font-weight:600;white-space:nowrap}.cm-utm-copy:hover{background:var(--blue-dark)}
.cm-media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.cm-media-item{border-radius:10px;overflow:hidden;border:1px solid var(--border);cursor:pointer;aspect-ratio:1;transition:transform .15s}.cm-media-item:hover{transform:scale(1.03)}
.cm-media-item img,.cm-media-item video{width:100%;height:100%;object-fit:contain;background:#f8f9fa}
.cm-empty{color:var(--muted);font-size:.8rem;font-style:italic}

/* Leads */
.lead-email{color:var(--blue);font-weight:500;font-size:.8rem}
.lead-domain a{color:var(--blue);text-decoration:none;font-size:.8rem}.lead-domain a:hover{text-decoration:underline}
.lead-no-email{color:var(--muted);font-size:.75rem;font-style:italic}

/* ═══ RESPONSIVE ═══ */
/* Tablet (768–1023px): sidebar collapsed to icons */
@media(max-width:1023px) and (min-width:768px){
  :root{--sidebar-w:56px}
  .sidebar-logo h1{font-size:0;overflow:hidden;width:0;height:0}.sidebar-logo h1::before{content:'🤖';font-size:1.2rem;display:block;text-align:center}
  .sidebar-logo .subtitle{display:none}
  .nav-item{justify-content:center;padding:12px 8px;font-size:0}.nav-item .nav-icon{font-size:1.2rem;width:auto}
  .sidebar-footer{font-size:0;padding:8px}.sidebar-footer .progress-mini{margin-top:0}
  .main{padding:20px 22px}
  .summary{grid-template-columns:repeat(3,1fr)}
  .panels,.home-grid{grid-template-columns:1fr}
  .kpi-grid{grid-template-columns:repeat(3,1fr)}
}
/* Mobile (≤767px): sidebar hidden + hamburger */
@media(max-width:767px){
  .sidebar{transform:translateX(-100%);transition:transform .25s ease;box-shadow:var(--shadow-lg);width:200px}
  .sidebar.open{transform:translateX(0)}
  .sidebar-overlay.open{display:block}
  .hamburger{display:block}
  .main{margin-left:0;padding:56px 14px 24px}
  .panels,.home-grid{grid-template-columns:1fr}
  .summary{grid-template-columns:repeat(2,1fr)}
  .summary .stat{padding:14px}
  .summary .stat-value{font-size:1.4rem}
  .utm-grid{grid-template-columns:1fr}
  .kpi-grid{grid-template-columns:repeat(2,1fr)}
  .kpi{padding:14px}.kpi-value{font-size:1.2rem}
  .history-modal{max-height:90vh;padding:18px}
  .epic-header{padding:14px 14px}
  .story-header{padding:12px 14px 12px 28px}
  .story-body{padding:0 10px 14px 20px}
  .nav-item{min-height:44px}
  .filter-btn{min-height:44px;padding:8px 16px}
  .ad-sub-tab{min-height:44px;padding:10px 16px}
  body{font-size:.9rem}
  h2{font-size:1.05rem}
}
</style>
</head>
<body>

<!-- Hamburger (mobile only) -->
<button class="hamburger" onclick="toggleSidebar()">☰</button>
<div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>

<div class="app">
<!-- ═══ SIDEBAR ═══ -->
<nav class="sidebar" id="sidebar">
  <div class="sidebar-logo">
    <h1>🤖 Ultron</h1>
    <div class="subtitle">C-Suite Dashboard</div>
  </div>
  <div class="sidebar-nav">
    <div class="nav-item active" onclick="navigate('home',this)"><span class="nav-icon">🏠</span>Home</div>
    <div class="nav-item" data-nav="tasks" onclick="navigate('tasks',this)"><span class="nav-icon">📋</span>Tasks</div>
    <div class="nav-item" onclick="navigate('ads',this)"><span class="nav-icon">📢</span>Ad Manager</div>
    <div class="nav-item" onclick="navigate('leads',this)"><span class="nav-icon">📧</span>Leads</div>
  </div>
  <div class="sidebar-footer">
    <div>빌드: ${now}</div>
    <div style="margin-top:4px" id="sidebar-progress">진행률 0% (0/0)</div>
    <div class="progress-mini"><div class="progress-mini-fill" id="sidebar-bar" style="width:0%"></div></div>
  </div>
</nav>

<!-- ═══ MAIN CONTENT ═══ -->
<div class="main">

<!-- 🏠 HOME -->
<div id="section-home" class="main-section active">
<h2 style="font-size:1.2rem;font-weight:700;color:var(--blue-dark);margin-bottom:20px">📊 대시보드 홈</h2>

<div class="summary">
  <div class="stat"><div class="stat-value" id="home-total">0</div><div class="stat-label">전체</div></div>
  <div class="stat stat-done"><div class="stat-value" id="home-done">0</div><div class="stat-label">✅ 완료</div></div>
  <div class="stat stat-progress"><div class="stat-value" id="home-progress">-</div><div class="stat-label">🔄 진행중</div></div>
  <div class="stat stat-blocked"><div class="stat-value" id="home-blocked">-</div><div class="stat-label">🚨 블로커</div></div>
  <div class="stat stat-todo"><div class="stat-value" id="home-todo">-</div><div class="stat-label">🔲 대기</div></div>
</div>

<div class="progress-section"><h2>전체 진행률</h2><div class="big-bar"><div class="big-fill" id="home-bar-fill" style="width:0%"></div></div><div class="big-pct" id="home-bar-text">-/- (-%)</div></div>

<div class="home-grid">
  <div class="panel">
    <div class="home-tab-bar">
      <button class="home-tab active" onclick="switchHomeTab('completed',this)">✅ 최근 완료</button>
      <button class="home-tab" onclick="switchHomeTab('blockers',this)">🚨 블로커 (<span id="home-blocker-count">0</span>)</button>
    </div>
    <div id="home-tab-completed" class="home-tab-content active"><div style="color:var(--muted);font-size:.85rem">로딩 중...</div></div>
    <div id="home-tab-blockers" class="home-tab-content"><div style="color:var(--muted);font-size:.85rem">로딩 중...</div></div>
  </div>
  <div class="panel"><h3>🏆 ICE 랭킹 Top 10</h3><div id="home-ice-ranking" style="color:var(--muted);font-size:.85rem">로딩 중...</div></div>
</div>

<div class="panel">
  <h3>📢 Ad Manager 요약</h3>
  <div id="home-ad-kpi" class="kpi-grid kpi-sm" style="grid-template-columns:repeat(auto-fit,minmax(100px,1fr))">
    <div style="text-align:center;color:var(--muted);font-size:.8rem;grid-column:1/-1">로딩 중...</div>
  </div>
  <div class="home-link" onclick="navigate('ads',document.querySelectorAll('.nav-item')[2])">자세히 보기 →</div>
</div>
</div>

<!-- 📋 TASKS -->
<div id="section-tasks" class="main-section">
<h2 style="font-size:1.2rem;font-weight:700;color:var(--blue-dark);margin-bottom:20px">📋 Tasks</h2>
<div class="filters">
  <button class="filter-btn active" onclick="filterBy('all',this)">전체</button>
  <button class="filter-btn" onclick="filterBy('CEO',this)">🤖 CEO</button>
  <button class="filter-btn" onclick="filterBy('CMO',this)">🎯 CMO</button>
  <button class="filter-btn" onclick="filterBy('CTO',this)">💻 CTO</button>
  <button class="filter-btn" onclick="filterBy('의장',this)">👑 의장</button>
</div>
<div id="tasks-container" style="padding:40px 0;text-align:center;color:var(--muted);font-size:.9rem">📦 로딩 중...</div>
</div>

<!-- 📢 AD MANAGER -->
<div id="section-ads" class="main-section">
<h2 style="font-size:1.2rem;font-weight:700;color:var(--blue-dark);margin-bottom:20px">📢 Ad Manager</h2>
<div id="ad-loading" style="text-align:center;padding:60px;color:var(--muted)">
  <div style="font-size:2rem;margin-bottom:8px">⏳</div>
  <p>데이터 로딩 중...</p>
</div>
<div id="ad-content" style="display:none">

<div class="export-bar">
  <button class="export-btn export-btn-primary" onclick="exportXLSX()">📥 엑셀 다운로드 (.xlsx)</button>
  <span style="color:var(--muted);font-size:.8rem">4시트: Daily Overview / Creative Breakdown / Funnel Analysis / Raw Data</span>
</div>

<div class="ad-sub-tabs">
  <button class="ad-sub-tab active" onclick="switchAdSub('overview',this)">📊 일별 개요</button>
  <button class="ad-sub-tab" onclick="switchAdSub('creatives',this)">🎨 소재 비교</button>
  <button class="ad-sub-tab" onclick="switchAdSub('funnel',this)">🔻 퍼널 분석</button>
  <button class="ad-sub-tab" onclick="switchAdSub('utm',this)">🔗 UTM 빌더</button>
  <button class="ad-sub-tab" onclick="switchAdSub('references',this)">🔖 레퍼런스</button>
</div>

<div id="ad-overview" class="ad-sub-content active">
  <div id="kpi-container" class="kpi-grid"></div>
  <div class="panel"><h3>📅 일별 캠페인 합산</h3><div style="overflow-x:auto"><table class="data-table"><thead><tr><th>날짜</th><th>노출</th><th>도달</th><th>클릭</th><th>링크클릭</th><th>CTR</th><th>CPC</th><th>소진액</th><th>LPV</th><th>전환</th><th>매출</th><th>ROAS</th></tr></thead><tbody id="daily-body"></tbody></table></div></div>
</div>

<div id="ad-creatives" class="ad-sub-content">
  <div class="section-title">🎨 소재별 누적 성과</div>
  <div class="panel"><div style="overflow-x:auto"><table class="data-table"><thead><tr><th>소재</th><th>키워드</th><th>utm_content</th><th>노출</th><th>도달</th><th>클릭</th><th>CTR</th><th>CPC</th><th>CPM</th><th>소진액</th><th>전환</th><th>CVR</th><th>CPA</th><th>매출</th><th>ROAS</th></tr></thead><tbody id="creative-totals-body"></tbody></table></div></div>
  <div class="section-title">📅 소재별 일별 비교</div>
  <div class="panel"><div style="overflow-x:auto"><table class="data-table"><thead><tr><th>날짜</th><th>소재</th><th>소재 미디어</th><th>노출</th><th>클릭</th><th>CTR</th><th>CPC</th><th>소진액</th><th>전환</th><th>CVR</th><th>CPA</th><th>ROAS</th><th>품질</th><th>참여도</th><th>전환율</th></tr></thead><tbody id="creative-daily-body"></tbody></table></div></div>
</div>

<div id="ad-funnel" class="ad-sub-content">
  <div class="section-title">🔻 퍼널 분석</div>
  <div id="funnel-bars" class="panel"></div>
  <div class="section-title">소재별 퍼널 비교</div>
  <div class="panel"><div style="overflow-x:auto"><table class="data-table"><thead><tr><th>소재</th><th>페이지조회</th><th>비용</th><th>회원가입</th><th>비용</th><th>결제시작</th><th>비용</th><th>결제완료</th><th>비용</th><th>매출</th><th>ROAS</th></tr></thead><tbody id="funnel-table-body"></tbody></table></div></div>
</div>

<div id="ad-utm" class="ad-sub-content">
<div class="utm-form">
  <h3>🔗 UTM 파라미터 빌더</h3>
  <div class="utm-grid">
    <div class="utm-field full"><label>Base URL *</label><input type="text" id="utm-url" value="https://wakalab.io" oninput="buildUTM()"></div>
    <div class="utm-field"><label>utm_source *</label><select id="utm-source" onchange="buildUTM()"><option value="meta">meta</option><option value="google">google</option><option value="naver">naver</option><option value="tiktok">tiktok</option><option value="instagram">instagram</option><option value="youtube">youtube</option></select></div>
    <div class="utm-field"><label>utm_medium *</label><select id="utm-medium" onchange="buildUTM()"><option value="paid_social">paid_social</option><option value="cpc">cpc</option><option value="display">display</option><option value="email">email</option><option value="organic">organic</option></select></div>
    <div class="utm-field"><label>utm_campaign *</label><input type="text" id="utm-campaign" value="" oninput="buildUTM()"></div>
    <div class="utm-field"><label>utm_content</label><select id="utm-content" onchange="buildUTM()"><option value="">선택...</option></select></div>
    <div class="utm-field"><label>utm_term</label><input type="text" id="utm-term" placeholder="keyword" oninput="buildUTM()"></div>
  </div>
  <div class="utm-result" id="utm-result"></div>
  <div class="utm-actions">
    <button class="utm-btn utm-btn-primary" onclick="copyUTM()">📋 복사</button>
    <button class="utm-btn utm-btn-secondary" onclick="resetUTM()">🔄 초기화</button>
  </div>
</div>
<div class="panel"><h3>📌 최근 생성한 UTM 링크</h3><div id="utm-history" style="font-size:.8rem;color:var(--muted)"><p>로딩 중...</p></div></div>
</div>

<div id="ad-references" class="ad-sub-content">
<div class="panel">
  <h3>🔖 광고 레퍼런스 (Meta Ad Library 크롤링)</h3>
  <div style="margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap">
    <div>
      <label style="font-size:.85rem;color:var(--muted);display:block;margin-bottom:4px">날짜</label>
      <input type="date" id="ref-date" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px" onchange="loadReferences()">
    </div>
    <div>
      <label style="font-size:.85rem;color:var(--muted);display:block;margin-bottom:4px">키워드</label>
      <select id="ref-keyword" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px" onchange="loadReferences()">
        <option value="">전체</option>
        <option value="마케팅 자동화">마케팅 자동화</option>
        <option value="AI 마케팅">AI 마케팅</option>
        <option value="광고 자동화">광고 자동화</option>
        <option value="디지털 마케팅">디지털 마케팅</option>
        <option value="성과 마케팅">성과 마케팅</option>
      </select>
    </div>
    <div style="display:flex;align-items:flex-end">
      <button onclick="loadReferences()" style="padding:6px 16px;background:var(--blue);color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600">🔄 새로고침</button>
    </div>
  </div>
  <div id="references-container" style="font-size:.85rem">
    <p style="color:var(--muted)">로딩 중...</p>
  </div>
</div>
</div>

</div><!-- /ad-content -->
</div><!-- /section-ads -->

<!-- 📧 LEADS -->
<div id="section-leads" class="main-section">
<h2 style="font-size:1.2rem;font-weight:700;color:var(--blue-dark);margin-bottom:20px">📧 Leads Pipeline</h2>
<div id="leads-loading" style="text-align:center;padding:60px;color:var(--muted)">
  <div style="font-size:2rem;margin-bottom:8px">⏳</div>
  <p>리드 데이터 로딩 중...</p>
</div>
<div id="leads-content" style="display:none">
<div id="leads-kpi" class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));margin-bottom:20px"></div>
<div class="filters" id="leads-filters">
  <button class="filter-btn active" onclick="filterLeads('all',this)">전체</button>
  <button class="filter-btn" onclick="filterLeads('has-email',this)">📧 이메일 있음</button>
  <button class="filter-btn" onclick="filterLeads('no-email',this)">❌ 이메일 없음</button>
</div>
<div class="panel"><div style="overflow-x:auto"><table class="data-table" id="leads-table">
<thead><tr><th>#</th><th>에이전시</th><th>도메인</th><th>이메일</th><th>지역</th><th>규모</th><th>Clutch</th></tr></thead>
<tbody id="leads-body"></tbody>
</table></div></div>
</div>
</div><!-- /section-leads -->

</div><!-- /main -->
</div><!-- /app -->

<!-- Modals & overlays -->
<div class="creative-modal-overlay" id="creativeOverlay" onclick="if(event.target===this)closeCreativeModal()">
  <div class="creative-modal">
    <div class="creative-modal-header"><span class="creative-modal-title" id="cmTitle"></span><button class="creative-modal-close" onclick="closeCreativeModal()">✕</button></div>
    <div id="cmBody"></div>
  </div>
</div>
<div class="media-lightbox" id="lightbox" onclick="closeLightbox(event)">
  <button class="lb-close" onclick="closeLightbox(event)">✕</button>
  <div id="lb-content"></div>
</div>
<div class="copy-toast" id="copy-toast">✅ 복사됨!</div>
<div class="history-modal-overlay" id="historyOverlay" onclick="if(event.target===this)closeHistoryModal()">
  <div class="history-modal">
    <div class="history-modal-header"><span class="history-modal-title" id="historyTitle"></span><button class="history-modal-close" onclick="closeHistoryModal()">✕</button></div>
    <div id="historyBody"></div>
  </div>
</div>

<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"><\/script>
<script>
// ═══ NAVIGATION ═══
function navigate(id,el){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.main-section').forEach(s=>s.classList.remove('active'));
  if(el)el.classList.add('active');
  document.getElementById('section-'+id).classList.add('active');
  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}
function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

// ═══ TASK MANAGEMENT (D1 API) ═══
const API='https://wakalab-media-worker.kimbang0105.workers.dev';
let TASKS_DATA=null;

function statusEmoji(status){const m={DONE:'✅',IN_PROGRESS:'🔄',BLOCKED:'🚨',TODO:'🔲',BACKLOG:'📋',REVIEW:'🔍'};return m[status]||'⚪';}
function statusClass(status){const m={DONE:'done',IN_PROGRESS:'progress',BLOCKED:'blocked',TODO:'todo',BACKLOG:'backlog',REVIEW:'review'};return m[status]||'unknown';}
function iceClass(score){if(score>=700)return'ice-critical';if(score>=400)return'ice-high';if(score>=200)return'ice-medium';return'ice-low';}
function priorityEmoji(p){const m={P0:'🔴',P1:'🟠',P2:'🟡',P3:'⚪'};return m[p]||'';}

function taskDate(taskId){
  const entries=TASK_HISTORY[taskId]||[];
  if(!entries.length)return'—';
  const latest=entries.reduce((m,e)=>e.date>m?e.date:m,'');
  return latest.slice(5);
}

function renderTask(t,storyTitle){
  const desc=t.title||t.description||'';
  return\`<tr id="task-\${t.id}" class="task-row \${statusClass(t.status)}">
    <td class="task-id"><span class="id-link" data-id="\${t.id}" onclick="openHistoryModal('\${t.id}','\${desc.replace(/'/g,"&#39;")}');event.stopPropagation()">\${t.id}<span class="red-dot" data-dot="\${t.id}" style="display:none"></span></span></td>
    <td><span class="badge badge-\${statusClass(t.status)}">\${statusEmoji(t.status)}</span></td>
    <td class="task-assignee">\${t.owner||'—'}</td>
    <td class="task-desc">\${desc}</td>
    <td class="task-date">\${taskDate(t.id)}</td>
    <td><span class="ice \${iceClass(t.ice_score)}">\${t.ice_score>0?t.ice_score:'—'}</span></td>
  </tr>\`;
}

function renderStory(s){
  const doneTasks=s.tasks.filter(t=>t.status==='DONE').length;
  const totalTasks=s.tasks.length;
  const pct=totalTasks>0?Math.round((doneTasks/totalTasks)*100):0;
  return\`<div class="story">
    <div class="story-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <span class="chevron">▼</span>
      <span class="story-id id-link" data-id="\${s.id}" onclick="openHistoryModal('\${s.id}','\${s.title.replace(/'/g,"&#39;")}');event.stopPropagation()">\${s.id}<span class="red-dot" data-dot="\${s.id}" style="display:none"></span></span>
      <span class="story-title">\${s.title}</span>
      <span class="badge badge-\${statusClass(s.status)}">\${statusEmoji(s.status)} \${s.status}</span>
      <span class="story-progress">\${doneTasks}/\${totalTasks}</span>
      <div class="mini-bar"><div class="mini-fill" style="width:\${pct}%"></div></div>
    </div>
    <div class="story-body">
      <table class="task-table">
        <thead><tr><th>Task</th><th>상태</th><th>담당</th><th>설명</th><th>등록일</th><th>ICE</th></tr></thead>
        <tbody>\${s.tasks.map(t=>renderTask(t,s.title)).join('')}</tbody>
      </table>
    </div>
  </div>\`;
}

function renderEpic(e){
  const allTasks=e.stories.flatMap(s=>s.tasks);
  const doneTasks=allTasks.filter(t=>t.status==='DONE').length;
  const totalTasks=allTasks.length;
  const pct=totalTasks>0?Math.round((doneTasks/totalTasks)*100):0;
  const statusText=e.status||'';
  return\`<div class="epic">
    <div class="epic-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <span class="chevron">▼</span>
      <span class="epic-id id-link" data-id="\${e.id}" onclick="openHistoryModal('\${e.id}','\${e.title.replace(/'/g,"&#39;")}');event.stopPropagation()">\${e.id}<span class="red-dot" data-dot="\${e.id}" style="display:none"></span></span>
      <span class="epic-title">\${e.title}</span>
      <span class="priority">\${priorityEmoji(e.priority)} \${e.priority||''}</span>
      <span class="epic-status">\${statusText}</span>
      <div class="progress-bar"><div class="progress-fill" style="width:\${pct}%"></div></div>
      <span class="progress-text">\${pct}%</span>
    </div>
    <div class="epic-body">\${e.stories.map(renderStory).join('')}</div>
  </div>\`;
}

async function loadTasks(){
  try{
    const[epicsRes,storiesRes,tasksRes]=await Promise.all([
      fetch(API+'/api/epics'),
      fetch(API+'/api/stories'),
      fetch(API+'/api/tasks')
    ]);
    const epicsData=await epicsRes.json();
    const storiesData=await storiesRes.json();
    const tasksData=await tasksRes.json();
    
    const epics=epicsData.epics||[];
    const stories=storiesData.stories||[];
    const tasks=tasksData.tasks||[];
    
    // Build hierarchy
    epics.forEach(e=>{e.stories=stories.filter(s=>s.epic_id===e.id);});
    stories.forEach(s=>{s.tasks=tasks.filter(t=>t.story_id===s.id);});
    
    TASKS_DATA={epics,stories,tasks};
    
    // Render Tasks tab
    const container=document.getElementById('tasks-container');
    if(epics.length===0){container.innerHTML='<p style="text-align:center;color:var(--muted);padding:40px 0">태스크가 없습니다.</p>';
    }else{container.innerHTML=epics.map(renderEpic).join('');}
    
    // Update Home stats
    updateHomeStats(tasks);
    updateRedDots();
    
  }catch(e){
    console.error('Failed to load tasks:',e);
    document.getElementById('tasks-container').innerHTML='<p style="text-align:center;color:var(--red);padding:40px 0">❌ 로딩 실패: '+e.message+'</p>';
  }
}

function updateHomeStats(tasks){
  const done=tasks.filter(t=>t.status==='DONE').length;
  const inProgress=tasks.filter(t=>t.status==='IN_PROGRESS').length;
  const blocked=tasks.filter(t=>t.status==='BLOCKED').length;
  const todo=tasks.filter(t=>t.status==='TODO'||t.status==='BACKLOG').length;
  const total=tasks.length;
  const pct=total>0?Math.round((done/total)*100):0;
  
  document.getElementById('home-total').textContent=total;
  document.getElementById('home-done').textContent=done;
  document.getElementById('home-progress').textContent=inProgress;
  document.getElementById('home-blocked').textContent=blocked;
  document.getElementById('home-todo').textContent=todo;
  document.getElementById('home-bar-fill').style.width=pct+'%';
  document.getElementById('home-bar-text').textContent=done+'/'+total+' ('+pct+'%)';
  const sp=document.getElementById('sidebar-progress');if(sp)sp.textContent='진행률 '+pct+'% ('+done+'/'+total+')';
  const sb=document.getElementById('sidebar-bar');if(sb)sb.style.width=pct+'%';
  
  // Recently completed tab (sorted by completed_date/updated_at desc)
  const completedTasks=tasks.filter(t=>t.status==='DONE').sort((a,b)=>(b.completed_date||b.updated_at||'').localeCompare(a.completed_date||a.updated_at||'')).slice(0,15);
  const compHtml=completedTasks.length===0?'<p style="color:var(--muted);font-size:.85rem">없음</p>':completedTasks.map(t=>{
    const d=t.completed_date||t.updated_at||'';
    const dateStr=d?d.substring(0,10):'';
    return\`<div class="blocker-item"><span class="badge badge-done">✅</span><span class="rank-id task-link" onclick="goToTask('\${t.id}')">\${t.id}</span><span class="task-link" onclick="goToTask('\${t.id}')">\${(t.title||t.description||'').substring(0,35)}\${(t.title||t.description||'').length>35?'…':''}</span><span class="task-owner">\${t.owner||'—'}</span><span class="task-date-sm">\${dateStr}</span></div>\`;
  }).join('');
  document.getElementById('home-tab-completed').innerHTML=compHtml;
  
  // Blockers tab (sorted by updated_at desc)
  const blockers=tasks.filter(t=>t.status==='BLOCKED').sort((a,b)=>(b.updated_at||'').localeCompare(a.updated_at||''));
  document.getElementById('home-blocker-count').textContent=blockers.length;
  const blockersHtml=blockers.length===0?'<p style="color:var(--muted);font-size:.85rem">없음 🎉</p>':blockers.map(b=>\`<div class="blocker-item"><span class="badge badge-blocked">🚨</span><span class="rank-id task-link" onclick="goToTask('\${b.id}')">\${b.id}</span><span class="task-link" onclick="goToTask('\${b.id}')">\${(b.title||b.description||'').substring(0,40)}\${(b.title||b.description||'').length>40?'…':''}</span><span style="color:var(--muted);margin-left:auto">\${b.owner||'—'}</span></div>\`).join('');
  document.getElementById('home-tab-blockers').innerHTML=blockersHtml;
  
  // ICE Ranking
  const iceRanking=tasks.filter(t=>t.status!=='DONE'&&t.ice_score>0).sort((a,b)=>b.ice_score-a.ice_score).slice(0,10);
  const iceHtml=iceRanking.map((t,i)=>\`<div class="rank-item"><span class="rank-num">\${i+1}</span><span class="rank-id task-link" onclick="goToTask('\${t.id}')">\${t.id}</span><span class="task-link" onclick="goToTask('\${t.id}')">\${(t.title||t.description||'').substring(0,30)}\${(t.title||t.description||'').length>30?'…':''}</span><span class="rank-score"><span class="ice \${iceClass(t.ice_score)}">\${t.ice_score}</span></span></div>\`).join('');
  document.getElementById('home-ice-ranking').innerHTML=iceHtml;
}

function switchHomeTab(tab,btn){
  document.querySelectorAll('.home-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.home-tab-content').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('home-tab-'+tab).classList.add('active');
}

function goToTask(taskId){
  // Switch to Tasks section
  navigate('tasks',document.querySelectorAll('.nav-item')[1]);
  // Wait for DOM to update, then scroll to task
  setTimeout(()=>{
    const el=document.getElementById('task-'+taskId);
    if(el){
      el.scrollIntoView({behavior:'smooth',block:'center'});
      el.style.background='var(--blue-light)';
      setTimeout(()=>el.style.background='',2000);
    }
  },100);
}

// loadTasks() called in Init section at bottom

// ═══ HISTORY MODAL ═══
const TASK_HISTORY=${JSON.stringify(taskHistory)};
const typeEmoji={created:'🆕',progress:'🔄',done:'✅',blocked:'🚨'};
const typeTlClass={created:'tl-created',progress:'tl-progress',done:'tl-done',blocked:'tl-blocked'};
// ═══ RED DOT NOTIFICATIONS ═══
const TASK_LATEST=${JSON.stringify(Object.fromEntries(Object.entries(taskHistory).map(([id,entries])=>[id,entries.reduce((m,e)=>e.date>m?e.date:m,'')])))};
function getReadMap(){try{return JSON.parse(localStorage.getItem('taskReadMap')||'{}');}catch(e){return {};}}
function saveReadMap(m){localStorage.setItem('taskReadMap',JSON.stringify(m));}
function updateRedDots(){
  const readMap=getReadMap();
  let count=0;
  document.querySelectorAll('[data-dot]').forEach(dot=>{
    const id=dot.dataset.dot;
    const latest=TASK_LATEST[id];
    if(latest&&(!readMap[id]||readMap[id]<latest)){dot.style.display='inline-block';count++;}
    else{dot.style.display='none';}
  });
  const tasksNav=document.querySelector('[data-nav="tasks"]');
  const existingDot=tasksNav?.querySelector('.nav-badge');
  if(count>0){
    if(!existingDot){const b=document.createElement('span');b.className='nav-badge';b.textContent=count;tasksNav.appendChild(b);}
    else{existingDot.textContent=count;}
  }else if(existingDot){existingDot.remove();}
  return count;
}
updateRedDots();
function markItemRead(id){const m=getReadMap();m[id]=new Date().toISOString().slice(0,10);saveReadMap(m);updateRedDots();}

function openHistoryModal(id,title){
  markItemRead(id);
  document.getElementById('historyTitle').textContent=id+(title?' — '+title:'');
  const entries=TASK_HISTORY[id]||[];
  const body=document.getElementById('historyBody');
  if(!entries.length){body.innerHTML='<p class="no-history">📝 기록 없음</p>';
  }else{body.innerHTML='<div class="timeline">'+entries.map(e=>'<div class="timeline-item"><div class="timeline-dot '+(typeTlClass[e.type]||'tl-progress')+'">'+(typeEmoji[e.type]||'📝')+'</div><div class="timeline-content"><div class="tl-meta">'+e.date+' · '+e.author+'</div><div class="tl-note">'+e.note+'</div></div></div>').join('')+'</div>';}
  document.getElementById('historyOverlay').classList.add('active');
  document.body.style.overflow='hidden';
}
function closeHistoryModal(){document.getElementById('historyOverlay').classList.remove('active');document.body.style.overflow='';}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeHistoryModal();closeCreativeModal();}});

// ═══ FILTERS ═══
function filterBy(role,btn){document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.task-row').forEach(row=>{if(role==='all'){row.style.display='';return;}const a=row.querySelector('.task-assignee')?.textContent||'';row.style.display=a.includes(role)?'':'none';});}

// ═══ AD MANAGER ═══
function switchAdSub(id,btn){document.querySelectorAll('.ad-sub-tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.ad-sub-content').forEach(c=>c.classList.remove('active'));document.getElementById('ad-'+id).classList.add('active');btn.classList.add('active');if(id==='references'&&REFERENCES.length===0)loadReferences();}

// const API already declared in Task Management section
const FUNNEL_STAGES=['ViewContent','CompleteRegistration','InitiateCheckout','Purchase'];
const FUNNEL_KO={ViewContent:'페이지 조회',CompleteRegistration:'회원가입',InitiateCheckout:'결제 시작',Purchase:'결제 완료'};
const FUNNEL_COLORS=['var(--blue)','var(--purple)','var(--orange)','var(--green)'];
let STATE={creatives:[],metrics:[],funnel:[],campaigns:[],utm:[]};
const fmt=n=>typeof n==='number'?n.toLocaleString('ko-KR'):String(n);
const fmtWon=n=>'₩'+fmt(n);
const roasColor=v=>v>=3?'var(--green)':v>=1?'var(--yellow)':'var(--red)';
function rankBadge(r){if(!r)return'—';if(r.includes('ABOVE'))return'<span class="tag tag-active">상위</span>';if(r.includes('BELOW_AVERAGE_35'))return'<span class="tag tag-ended">하위35%</span>';if(r.includes('BELOW'))return'<span class="tag tag-paused">하위20%</span>';return'<span class="tag tag-draft">평균</span>';}

async function loadAdData(){
  try{
    const [camRes,crRes,metRes,funRes,utmRes]=await Promise.all([
      fetch(API+'/api/campaigns').then(r=>r.json()),
      fetch(API+'/api/creatives').then(r=>r.json()),
      fetch(API+'/api/metrics').then(r=>r.json()),
      fetch(API+'/api/funnel').then(r=>r.json()),
      fetch(API+'/api/utm').then(r=>r.json()),
    ]);
    STATE.campaigns=camRes.campaigns||[];STATE.creatives=crRes.creatives||[];STATE.metrics=metRes.metrics||[];STATE.funnel=funRes.funnel||[];STATE.utm=utmRes.links||[];
    renderHomeAdKPI();renderKPIs();renderDailyOverview();renderCreativeTotals();renderCreativeDaily();renderFunnel();renderUTM();
    document.getElementById('ad-loading').style.display='none';
    document.getElementById('ad-content').style.display='block';
  }catch(e){
    document.getElementById('ad-loading').innerHTML='<div style="color:var(--red)">❌ API 연결 실패: '+e.message+'</div>';
    document.getElementById('home-ad-kpi').innerHTML='<div style="color:var(--red);font-size:.8rem;grid-column:1/-1">API 연결 실패</div>';
  }
}

function renderHomeAdKPI(){
  const m=STATE.metrics,spend=m.reduce((s,r)=>s+r.spend,0),imp=m.reduce((s,r)=>s+r.impressions,0),clicks=m.reduce((s,r)=>s+r.clicks,0);
  const ctr=imp>0?(clicks/imp*100):0,rev=STATE.funnel.filter(f=>f.stage==='Purchase').reduce((s,f)=>s+f.revenue,0),roas=spend>0?(rev/spend):0;
  const el=document.getElementById('home-ad-kpi');
  if(!m.length){el.innerHTML='<div style="color:var(--muted);font-size:.8rem;grid-column:1/-1">데이터 없음</div>';return;}
  el.innerHTML=
    '<div class="kpi kpi-sm"><div class="kpi-value">'+fmtWon(spend)+'</div><div class="kpi-label">소진액</div></div>'+
    '<div class="kpi kpi-sm"><div class="kpi-value">'+fmt(imp)+'</div><div class="kpi-label">노출</div></div>'+
    '<div class="kpi kpi-sm"><div class="kpi-value">'+fmt(clicks)+'</div><div class="kpi-label">클릭</div></div>'+
    '<div class="kpi kpi-sm"><div class="kpi-value">'+ctr.toFixed(2)+'%</div><div class="kpi-label">CTR</div></div>'+
    '<div class="kpi kpi-sm"><div class="kpi-value" style="color:'+roasColor(roas)+'">'+roas.toFixed(2)+'x</div><div class="kpi-label">ROAS</div></div>';
}

function renderKPIs(){
  const m=STATE.metrics,spend=m.reduce((s,r)=>s+r.spend,0),imp=m.reduce((s,r)=>s+r.impressions,0),clicks=m.reduce((s,r)=>s+r.clicks,0),conv=m.reduce((s,r)=>s+r.conversions,0);
  const ctr=imp>0?(clicks/imp*100):0,rev=STATE.funnel.filter(f=>f.stage==='Purchase').reduce((s,f)=>s+f.revenue,0),roas=spend>0?(rev/spend):0;
  document.getElementById('kpi-container').innerHTML=
    '<div class="kpi"><div class="kpi-value">'+fmtWon(spend)+'</div><div class="kpi-label">총 소진액</div></div>'+
    '<div class="kpi"><div class="kpi-value">'+fmt(imp)+'</div><div class="kpi-label">총 노출</div></div>'+
    '<div class="kpi"><div class="kpi-value">'+fmt(clicks)+'</div><div class="kpi-label">총 클릭</div></div>'+
    '<div class="kpi"><div class="kpi-value">'+ctr.toFixed(2)+'%</div><div class="kpi-label">평균 CTR</div></div>'+
    '<div class="kpi"><div class="kpi-value" style="color:var(--green)">'+conv+'건</div><div class="kpi-label">총 전환</div></div>'+
    '<div class="kpi"><div class="kpi-value">'+fmtWon(rev)+'</div><div class="kpi-label">총 매출</div></div>'+
    '<div class="kpi"><div class="kpi-value" style="color:'+roasColor(roas)+'">'+roas.toFixed(2)+'x</div><div class="kpi-label">ROAS</div></div>';
}
function renderDailyOverview(){
  const dates=[...new Set(STATE.metrics.map(d=>d.date))].sort();
  document.getElementById('daily-body').innerHTML=dates.map(date=>{
    const rows=STATE.metrics.filter(d=>d.date===date);
    const imp=rows.reduce((s,r)=>s+r.impressions,0),reach=rows.reduce((s,r)=>s+r.reach,0),clicks=rows.reduce((s,r)=>s+r.clicks,0),lc=rows.reduce((s,r)=>s+r.link_clicks,0),spend=rows.reduce((s,r)=>s+r.spend,0),conv=rows.reduce((s,r)=>s+r.conversions,0),lpv=rows.reduce((s,r)=>s+r.landing_page_views,0);
    const ctr=imp>0?(clicks/imp*100):0,cpc=clicks>0?Math.round(spend/clicks):0;
    const metricIds=rows.map(r=>r.id),rev=STATE.funnel.filter(f=>f.stage==='Purchase'&&metricIds.includes(f.daily_metric_id)).reduce((s,f)=>s+f.revenue,0),roas=spend>0?(rev/spend):0;
    return '<tr><td>'+date+'</td><td class="num">'+fmt(imp)+'</td><td class="num">'+fmt(reach)+'</td><td class="num">'+fmt(clicks)+'</td><td class="num">'+fmt(lc)+'</td><td class="num">'+ctr.toFixed(2)+'%</td><td class="num">'+fmtWon(cpc)+'</td><td class="num">'+fmtWon(spend)+'</td><td class="num">'+fmt(lpv)+'</td><td class="num conv">'+conv+'</td><td class="num">'+fmtWon(rev)+'</td><td class="num" style="color:'+roasColor(roas)+'">'+roas.toFixed(2)+'x</td></tr>';
  }).join('');
}
function renderCreativeTotals(){
  document.getElementById('creative-totals-body').innerHTML=STATE.creatives.map(c=>{
    const rows=STATE.metrics.filter(m=>m.creative_id===c.key),imp=rows.reduce((s,r)=>s+r.impressions,0),reach=rows.reduce((s,r)=>s+r.reach,0),clicks=rows.reduce((s,r)=>s+r.clicks,0),spend=rows.reduce((s,r)=>s+r.spend,0),conv=rows.reduce((s,r)=>s+r.conversions,0);
    const ctr=imp>0?(clicks/imp*100):0,cpc=clicks>0?Math.round(spend/clicks):0,cpm=imp>0?Math.round(spend/imp*1000):0,cvr=clicks>0?(conv/clicks*100):0,cpa=conv>0?Math.round(spend/conv):0;
    const metricIds=rows.map(r=>r.id),rev=STATE.funnel.filter(f=>f.stage==='Purchase'&&metricIds.includes(f.daily_metric_id)).reduce((s,f)=>s+f.revenue,0),roas=spend>0?(rev/spend):0;
    const tags=JSON.parse(c.tags||'[]').map(t=>'<span class="kw-tag">'+t+'</span>').join('');
    return '<tr style="cursor:pointer" onclick="openCreativeModal(&quot;'+c.key+'&quot;,&quot;'+c.label.replace(/"/g,'')+'&quot;)"><td><strong>'+c.label+'</strong></td><td>'+tags+'</td><td style="font-size:.75rem;color:var(--muted)">'+c.key+'</td><td class="num">'+fmt(imp)+'</td><td class="num">'+fmt(reach)+'</td><td class="num">'+fmt(clicks)+'</td><td class="num">'+ctr.toFixed(2)+'%</td><td class="num">'+fmtWon(cpc)+'</td><td class="num">'+fmtWon(cpm)+'</td><td class="num">'+fmtWon(spend)+'</td><td class="num conv">'+conv+'</td><td class="num">'+cvr.toFixed(2)+'%</td><td class="num">'+(cpa>0?fmtWon(cpa):'—')+'</td><td class="num">'+fmtWon(rev)+'</td><td class="num" style="color:'+roasColor(roas)+'">'+roas.toFixed(2)+'x</td></tr>';
  }).join('');
}
function renderCreativeDaily(){
  const sorted=[...STATE.metrics].sort((a,b)=>a.date.localeCompare(b.date)||a.creative_id.localeCompare(b.creative_id));
  const creativeMap=Object.fromEntries(STATE.creatives.map(c=>[c.key,c]));
  document.getElementById('creative-daily-body').innerHTML=sorted.map((d,i)=>{
    const c=creativeMap[d.creative_id]||{},tags=JSON.parse(c.tags||'[]').map(t=>'<span class="kw-tag">'+t+'</span>').join('');
    return '<tr><td>'+d.date+'</td><td><strong>'+(c.label||d.creative_id)+'</strong><div style="margin-top:2px">'+tags+'</div></td>'+
      '<td class="media-cell"><div class="row-media" id="rowmedia-'+i+'"></div><button class="row-upload-btn" onclick="triggerRowUpload(&quot;'+d.creative_id+'&quot;,'+i+')">📤</button><input type="file" id="rowinput-'+i+'" multiple accept="image/*,video/*" style="display:none" onchange="handleRowUpload(&quot;'+d.creative_id+'&quot;,'+i+',this)"></td>'+
      '<td class="num">'+fmt(d.impressions)+'</td><td class="num">'+fmt(d.clicks)+'</td><td class="num">'+d.ctr.toFixed(2)+'%</td><td class="num">'+fmtWon(d.cpc)+'</td><td class="num">'+fmtWon(d.spend)+'</td><td class="num conv">'+d.conversions+'</td><td class="num">'+d.cvr.toFixed(2)+'%</td><td class="num">'+(d.cpa>0?fmtWon(d.cpa):'—')+'</td><td class="num" style="color:'+roasColor(d.roas)+'">'+d.roas.toFixed(2)+'x</td>'+
      '<td>'+rankBadge(d.quality_ranking)+'</td><td>'+rankBadge(d.engagement_ranking)+'</td><td>'+rankBadge(d.conversion_ranking)+'</td></tr>';
  }).join('');
  STATE.creatives.forEach(c=>fetchMedia(c.key));
}
function renderFunnel(){
  const ft={};FUNNEL_STAGES.forEach(s=>{ft[s]={count:0,cost:0,revenue:0};});
  STATE.funnel.forEach(f=>{if(ft[f.stage]){ft[f.stage].count+=f.count;ft[f.stage].cost+=f.cost;ft[f.stage].revenue+=f.revenue;}});
  const maxCount=Math.max(...FUNNEL_STAGES.map(s=>ft[s].count),1);
  let barsHTML='';
  FUNNEL_STAGES.forEach((stage,i)=>{
    const pct=Math.round(ft[stage].count/maxCount*100),cvr=i>0&&ft[FUNNEL_STAGES[i-1]].count>0?(ft[stage].count/ft[FUNNEL_STAGES[i-1]].count*100).toFixed(1)+'%':'—';
    barsHTML+='<div class="funnel-bar"><span class="funnel-label">'+FUNNEL_KO[stage]+'</span><div class="funnel-fill" style="width:'+pct+'%;background:'+FUNNEL_COLORS[i]+'">&nbsp;</div><span class="funnel-value">'+ft[stage].count+'건 (CPA: '+(ft[stage].cost>0&&ft[stage].count>0?fmtWon(Math.round(ft[stage].cost/ft[stage].count)):'—')+') '+(i>0?'전환율: '+cvr:'')+'</span></div>';
  });
  document.getElementById('funnel-bars').innerHTML=barsHTML;
  let tableHTML='';
  STATE.creatives.forEach(c=>{
    const metricIds=STATE.metrics.filter(m=>m.creative_id===c.key).map(m=>m.id),cf={};
    FUNNEL_STAGES.forEach(s=>{cf[s]={count:0,cost:0,revenue:0};});
    STATE.funnel.filter(f=>metricIds.includes(f.daily_metric_id)).forEach(f=>{if(cf[f.stage]){cf[f.stage].count+=f.count;cf[f.stage].cost+=f.cost;cf[f.stage].revenue+=f.revenue;}});
    const rev=cf.Purchase.revenue,spend=STATE.metrics.filter(m=>m.creative_id===c.key).reduce((s,m)=>s+m.spend,0);
    tableHTML+='<tr><td><strong>'+c.label+'</strong></td>';
    FUNNEL_STAGES.forEach(s=>{tableHTML+='<td class="num">'+cf[s].count+'</td><td class="num">'+fmtWon(cf[s].cost)+'</td>';});
    tableHTML+='<td class="num conv">'+fmtWon(rev)+'</td><td class="num" style="color:'+roasColor(spend>0?rev/spend:0)+'">'+(spend>0?(rev/spend).toFixed(2)+'x':'—')+'</td></tr>';
  });
  document.getElementById('funnel-table-body').innerHTML=tableHTML;
}
function renderUTM(){
  const sel=document.getElementById('utm-content');
  STATE.creatives.forEach(c=>{const o=document.createElement('option');o.value=c.key;o.textContent=c.key;sel.appendChild(o);});
  if(STATE.campaigns.length>0)document.getElementById('utm-campaign').value=STATE.campaigns[0].name||'';
  buildUTM();
  const hist=document.getElementById('utm-history');
  if(STATE.utm.length>0){hist.innerHTML=STATE.utm.map(u=>'<div style="padding:6px 0;border-bottom:1px solid var(--border);word-break:break-all"><span style="color:var(--blue)">'+u.full_url+'</span> <span style="color:var(--muted);font-size:.7rem">'+u.created_at+'</span></div>').join('');
  }else{hist.innerHTML='<p>아직 생성된 링크가 없습니다.</p>';}
}
function buildUTM(){const base=document.getElementById('utm-url').value.trim();if(!base){document.getElementById('utm-result').textContent='';return;}const p=new URLSearchParams();['source','medium','campaign','content','term'].forEach(k=>{const v=document.getElementById('utm-'+k).value.trim();if(v)p.set('utm_'+k,v);});document.getElementById('utm-result').textContent=base+(base.includes('?')?'&':'?')+p.toString();}
function copyUTM(){
  const url=document.getElementById('utm-result').textContent;if(!url)return;
  const p=new URLSearchParams(url.split('?')[1]||'');
  fetch(API+'/api/utm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({full_url:url,base_url:url.split('?')[0],source:p.get('utm_source'),medium:p.get('utm_medium'),campaign:p.get('utm_campaign'),content:p.get('utm_content'),term:p.get('utm_term'),creative_id:p.get('utm_content')})}).catch(()=>{});
  navigator.clipboard.writeText(url).then(()=>{showToast();const hist=document.getElementById('utm-history');const f=hist.querySelector('p');if(f)hist.innerHTML='';const d=document.createElement('div');d.style.cssText='padding:6px 0;border-bottom:1px solid var(--border);word-break:break-all';d.innerHTML='<span style="color:var(--blue)">'+url+'</span> <span style="color:var(--muted);font-size:.7rem">'+new Date().toLocaleTimeString('ko-KR')+'</span>';hist.prepend(d);});
}
function resetUTM(){document.getElementById('utm-url').value='https://wakalab.io';document.getElementById('utm-source').value='meta';document.getElementById('utm-medium').value='paid_social';document.getElementById('utm-campaign').value=STATE.campaigns[0]?.name||'';document.getElementById('utm-content').value='';document.getElementById('utm-term').value='';buildUTM();}
function showToast(){const t=document.getElementById('copy-toast');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2000);}

// ═══ XLSX EXPORT ═══
function exportXLSX(){
  if(typeof XLSX==='undefined'){alert('SheetJS 로딩 실패');return;}
  const wb=XLSX.utils.book_new(),campaign=STATE.campaigns[0]?.name||'campaign',dates=[...new Set(STATE.metrics.map(d=>d.date))].sort();
  const s1=dates.map(date=>{const rows=STATE.metrics.filter(d=>d.date===date);const o={날짜:date};o.노출=rows.reduce((s,r)=>s+r.impressions,0);o.도달=rows.reduce((s,r)=>s+r.reach,0);o.클릭=rows.reduce((s,r)=>s+r.clicks,0);o.소진액=rows.reduce((s,r)=>s+r.spend,0);o.전환=rows.reduce((s,r)=>s+r.conversions,0);o.CTR=+(o.노출>0?(o.클릭/o.노출*100):0).toFixed(2);o.CPC=o.클릭>0?Math.round(o.소진액/o.클릭):0;return o;});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(s1),'Daily Overview');
  const s2=STATE.metrics.map(d=>{const c=STATE.creatives.find(c=>c.key===d.creative_id);return{날짜:d.date,소재:c?.label||d.creative_id,utm_content:d.creative_id,노출:d.impressions,도달:d.reach,클릭:d.clicks,CTR:d.ctr,CPC:d.cpc,CPM:d.cpm,소진액:d.spend,전환:d.conversions,CVR:d.cvr,CPA:d.cpa,ROAS:d.roas,품질:d.quality_ranking,참여도:d.engagement_ranking,전환율:d.conversion_ranking};});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(s2),'Creative Breakdown');
  const s3=[];STATE.creatives.forEach(c=>{const metricIds=STATE.metrics.filter(m=>m.creative_id===c.key).map(m=>m.id);FUNNEL_STAGES.forEach(stage=>{const f={소재:c.label,utm_content:c.key,단계:FUNNEL_KO[stage],이벤트:stage};const events=STATE.funnel.filter(e=>e.stage===stage&&metricIds.includes(e.daily_metric_id));f.건수=events.reduce((s,e)=>s+e.count,0);f.비용=events.reduce((s,e)=>s+e.cost,0);if(stage==='Purchase')f.매출=events.reduce((s,e)=>s+e.revenue,0);s3.push(f);});});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(s3),'Funnel Analysis');
  const s4=STATE.metrics.map(d=>({date:d.date,creative:d.creative_id,impressions:d.impressions,reach:d.reach,clicks:d.clicks,ctr:d.ctr,cpc:d.cpc,spend:d.spend,conversions:d.conversions,cvr:d.cvr,cpa:d.cpa,roas:d.roas,quality:d.quality_ranking,engagement:d.engagement_ranking,conversion:d.conversion_ranking}));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(s4),'Raw Data');
  XLSX.writeFile(wb,campaign+'_report.xlsx');showToast();
}

// ═══ R2 MEDIA ═══
const WORKER_URL=API;const mediaCache={};
async function fetchMedia(creative){try{const res=await fetch(WORKER_URL+'/list/'+creative);const data=await res.json();mediaCache[creative]=data.files||[];}catch(e){mediaCache[creative]=[];}renderAllRowMedia();}
function triggerRowUpload(creative,rowIdx){document.getElementById('rowinput-'+rowIdx).click();}
async function handleRowUpload(creative,rowIdx,input){
  const files=Array.from(input.files);if(!files.length)return;const btn=input.previousElementSibling;btn.textContent='⏳';btn.disabled=true;
  for(const file of files){if(file.size>25*1024*1024){alert(file.name+': 25MB 초과');continue;}try{await fetch(WORKER_URL+'/upload/'+creative+'/'+encodeURIComponent(file.name),{method:'PUT',body:file,headers:{'Content-Type':file.type}});}catch(e){alert('업로드 실패');}}
  input.value='';btn.textContent='📤';btn.disabled=false;await fetchMedia(creative);
}
async function deleteRowMedia(creative,fileKey){if(!confirm('삭제?'))return;try{await fetch(WORKER_URL+'/delete/'+fileKey,{method:'DELETE'});}catch(e){}await fetchMedia(creative);}
function renderAllRowMedia(){
  document.querySelectorAll('[id^=rowmedia-]').forEach(el=>{
    const idx=parseInt(el.id.replace('rowmedia-',''));const sorted=[...STATE.metrics].sort((a,b)=>a.date.localeCompare(b.date)||a.creative_id.localeCompare(b.creative_id));const d=sorted[idx];if(!d)return;
    const media=mediaCache[d.creative_id]||[];el.innerHTML='';
    media.forEach(m=>{const thumb=document.createElement('div');thumb.className='row-media-thumb';const isVideo=m.name.match(/\\.(mp4|mov|webm)$/i);
      thumb.innerHTML=isVideo?'<video src="'+m.url+'" muted></video>':'<img src="'+m.url+'" alt="'+m.name+'">';thumb.onclick=()=>openLightbox(m.url,isVideo);
      const del=document.createElement('button');del.className='thumb-del';del.textContent='✕';del.onclick=e=>{e.stopPropagation();deleteRowMedia(d.creative_id,m.key);};thumb.appendChild(del);el.appendChild(thumb);});
  });
}
function openLightbox(url,isVideo){const lb=document.getElementById('lightbox'),content=document.getElementById('lb-content');content.innerHTML=isVideo?'<video src="'+url+'" controls autoplay style="max-width:90vw;max-height:90vh;border-radius:12px"></video>':'<img src="'+url+'" style="max-width:90vw;max-height:90vh;border-radius:12px">';lb.classList.add('active');}
function closeLightbox(e){if(e.target.id==='lightbox'||e.target.classList.contains('lb-close')){document.getElementById('lightbox').classList.remove('active');document.getElementById('lb-content').innerHTML='';}}

// ═══ CREATIVE DETAIL MODAL ═══
async function openCreativeModal(creativeKey,label){
  document.getElementById('cmTitle').textContent=label+' ('+creativeKey+')';
  let html='<div style="text-align:center;color:var(--muted)">로딩 중...</div>';
  document.getElementById('cmBody').innerHTML=html;
  document.getElementById('creativeOverlay').classList.add('active');
  document.body.style.overflow='hidden';

  // Fetch UTM + Media
  const [utmData,mediaData]=await Promise.all([
    fetch(API+'/api/utm').then(r=>r.json()).catch(()=>({links:[]})),
    fetch(WORKER_URL+'/list/'+creativeKey).then(r=>r.json()).catch(()=>({files:[]}))
  ]);
  const utmLinks=(utmData.links||[]).filter(u=>u.creative_id===creativeKey||u.content===creativeKey);
  const mediaFiles=mediaData.files||[];

  html='<div class="cm-section"><h4>🔗 UTM 링크</h4>';
  if(utmLinks.length>0){
    html+=utmLinks.map(u=>'<div class="cm-utm" style="margin-bottom:6px"><span class="cm-utm-url">'+u.full_url+'</span><button class="cm-utm-copy" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent);showToast()">복사</button></div>').join('');
  }else{html+='<p class="cm-empty">등록된 UTM 링크가 없습니다</p>';}
  html+='</div>';

  html+='<div class="cm-section"><h4>📸 소재 미디어</h4>';
  if(mediaFiles.length>0){
    html+='<div class="cm-media-grid">';
    html+=mediaFiles.map(m=>{
      const isVideo=m.name.match(/\\.(mp4|mov|webm)$/i);
      return '<div class="cm-media-item" onclick="openLightbox(&quot;'+m.url+'&quot;,'+(isVideo?'true':'false')+')">'+(isVideo?'<video src="'+m.url+'" muted></video>':'<img src="'+m.url+'" alt="'+m.name+'">')+'</div>';
    }).join('');
    html+='</div>';
  }else{html+='<p class="cm-empty">등록된 미디어가 없습니다</p>';}
  html+='</div>';

  document.getElementById('cmBody').innerHTML=html;
}
function closeCreativeModal(){document.getElementById('creativeOverlay').classList.remove('active');document.body.style.overflow='';}

// ═══ REFERENCES ═══
let REFERENCES=[];
async function loadReferences(){
  const date=document.getElementById('ref-date')?.value||'';
  const keyword=document.getElementById('ref-keyword')?.value||'';
  const container=document.getElementById('references-container');
  if(!container)return;
  
  container.innerHTML='<p style="color:var(--muted)">로딩 중...</p>';
  
  try{
    let url=API+'/api/references?limit=50';
    if(date)url+='&date='+date;
    if(keyword)url+='&keyword='+encodeURIComponent(keyword);
    
    const res=await fetch(url);
    const data=await res.json();
    REFERENCES=data.references||[];
    
    if(REFERENCES.length===0){
      container.innerHTML='<p style="color:var(--muted)">레퍼런스가 없습니다.</p>';
      return;
    }
    
    const byDate={};
    REFERENCES.forEach(ref=>{
      if(!byDate[ref.collected_date])byDate[ref.collected_date]=[];
      byDate[ref.collected_date].push(ref);
    });
    
    let html='';
    Object.keys(byDate).sort().reverse().forEach(date=>{
      const refs=byDate[date];
      html+='<div style="margin-bottom:24px"><h4 style="font-size:.95rem;color:var(--blue-dark);margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid var(--border)">📅 '+date+' ('+refs.length+'건)</h4>';
      html+='<div style="display:grid;gap:12px">';
      refs.forEach(ref=>{
        const points=(ref.appeal_points?JSON.parse(ref.appeal_points):[]).map(p=>'<span style="display:inline-block;padding:2px 6px;background:var(--blue-light);color:var(--blue-dark);border-radius:4px;font-size:.7rem;margin-right:4px">'+p+'</span>').join('');
        const imageThumb=ref.image_url?'<img src="'+ref.image_url+'" alt="Ad Preview" style="width:100px;height:100px;object-fit:cover;border-radius:6px;cursor:pointer;flex-shrink:0" onclick="openLightbox(\\''+ref.image_url+'\\')">':'';
        html+='<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px;transition:box-shadow .2s;display:flex;gap:12px" onmouseover="this.style.boxShadow=\\'var(--shadow-md)\\'" onmouseout="this.style.boxShadow=\\'\\'">'+
          imageThumb+
          '<div style="flex:1">'+
          '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">'+
          '<div style="font-weight:600;color:var(--text);font-size:.85rem">'+(ref.link_title||'(제목 없음)')+'</div>'+
          '<span style="font-size:.7rem;color:var(--muted);white-space:nowrap">'+ref.keyword+'</span>'+
          '</div>'+
          (ref.creative_body?'<p style="font-size:.8rem;color:var(--muted);margin-bottom:8px;line-height:1.5">'+ref.creative_body.slice(0,200)+(ref.creative_body.length>200?'...':'')+'</p>':'')+
          (points?'<div style="margin-bottom:8px">'+points+'</div>':'')+
          '<div style="display:flex;gap:8px;align-items:center">'+
          (ref.cta_text?'<span style="font-size:.75rem;color:var(--blue);background:var(--blue-light);padding:4px 8px;border-radius:4px">'+ref.cta_text+'</span>':'')+
          '<a href="'+ref.snapshot_url+'" target="_blank" style="margin-left:auto;font-size:.75rem;color:var(--blue);text-decoration:none">광고 보기 →</a>'+
          '</div>'+
          '</div>'+
          '</div>';
      });
      html+='</div></div>';
    });
    
    container.innerHTML=html;
  }catch(e){
    container.innerHTML='<p style="color:var(--red)">❌ 로딩 실패: '+e.message+'</p>';
  }
}

// ═══ LEADS ═══
let LEADS=[];
async function loadLeads(){
  try{
    const res=await fetch('./leads.json');
    LEADS=await res.json();
    renderLeads();
    document.getElementById('leads-loading').style.display='none';
    document.getElementById('leads-content').style.display='block';
  }catch(e){
    document.getElementById('leads-loading').innerHTML='<div style="color:var(--red)">❌ 리드 데이터 로딩 실패</div>';
  }
}
function renderLeads(filter='all'){
  let data=LEADS;
  if(filter==='has-email')data=LEADS.filter(l=>l.primary_email);
  if(filter==='no-email')data=LEADS.filter(l=>!l.primary_email);
  const withEmail=LEADS.filter(l=>l.primary_email).length;
  document.getElementById('leads-kpi').innerHTML=
    '<div class="kpi kpi-sm"><div class="kpi-value">'+LEADS.length+'</div><div class="kpi-label">전체 리드</div></div>'+
    '<div class="kpi kpi-sm"><div class="kpi-value" style="color:var(--green)">'+withEmail+'</div><div class="kpi-label">이메일 확보</div></div>'+
    '<div class="kpi kpi-sm"><div class="kpi-value" style="color:var(--red)">'+(LEADS.length-withEmail)+'</div><div class="kpi-label">이메일 미확보</div></div>'+
    '<div class="kpi kpi-sm"><div class="kpi-value" style="color:var(--blue)">'+Math.round(withEmail/LEADS.length*100)+'%</div><div class="kpi-label">확보율</div></div>';
  document.getElementById('leads-body').innerHTML=data.map((l,i)=>
    '<tr><td>'+l.id+'</td><td><strong>'+l.name+'</strong></td>'+
    '<td class="lead-domain"><a href="'+l.website+'" target="_blank">'+l.domain+'</a></td>'+
    '<td>'+(l.primary_email?'<span class="lead-email">'+l.primary_email+(l.emails&&l.emails.length>1?' <span style="color:var(--muted);font-size:.7rem">(+' +(l.emails.length-1)+')</span>':'')+'</span>':'<span class="lead-no-email">미확보</span>')+'</td>'+
    '<td style="font-size:.8rem">'+l.location+'</td>'+
    '<td style="font-size:.8rem">'+(l.size||'—')+'</td>'+
    '<td><a href="'+l.profile+'" target="_blank" style="font-size:.75rem;color:var(--blue)">프로필</a></td></tr>'
  ).join('');
}
function filterLeads(f,btn){document.querySelectorAll('#leads-filters .filter-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderLeads(f);}

// ── Init ──
loadTasks();loadAdData();loadLeads();
<\/script>
</body>
</html>`;

mkdirSync('docs', { recursive: true });
writeFileSync('docs/index.html', html, 'utf-8');
console.log(`✅ Built: ${epics.length} epics, ${allTasks.length} tasks (${pct}%) | F-Layout Dashboard`);
