import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const API = "http://localhost:8000";
const WS  = "ws://localhost:8000/ws/signals";

const MARKETS = [
  { id:"ALL",       label:"All Markets",    icon:"⊞", color:"#00d4ff" },
  { id:"NIFTY",     label:"NIFTY 50 F&O",  icon:"N", color:"#00ff9d",
    strategies:["S1 Calendar Spread","S2 Iron Condor","S3 Short Straddle","S4 0DTE Scalp","S5 PCR Contrarian"] },
  { id:"BANKNIFTY", label:"BANK NIFTY F&O",icon:"B", color:"#f5c518",
    strategies:["S1 Calendar Spread","S2 Iron Condor","S3 Short Straddle","S4 0DTE Scalp","S5 PCR Contrarian"] },
  { id:"FINNIFTY",  label:"FIN NIFTY F&O", icon:"F", color:"#ff6b35",
    strategies:["S1 Calendar Spread","S2 Iron Condor","S5 PCR Contrarian"] },
  { id:"EQUITY",    label:"NSE Equity",    icon:"E", color:"#a78bfa",
    strategies:["E1 EMA Crossover","E2 VWAP Reversion","E3 ORB Breakout","E4 Gap Fill"] },
];

const STRAT_INFO = {
  S1:{color:"#00d4ff",tag:"NEUTRAL"},  S2:{color:"#00ff9d",tag:"NEUTRAL"},
  S3:{color:"#f5c518",tag:"NEUTRAL"},  S4:{color:"#ff6b35",tag:"EXPIRY"},
  S5:{color:"#22c55e",tag:"CONTRARIAN"},S6:{color:"#ef4444",tag:"BEARISH"},
  E1:{color:"#a78bfa",tag:"MOMENTUM"}, E2:{color:"#fb923c",tag:"MEAN REV"},
  E3:{color:"#38bdf8",tag:"BREAKOUT"}, E4:{color:"#e879f9",tag:"GAP FILL"},
  E5:{color:"#facc15",tag:"MOMENTUM"},
};

const PCR_ZONE_COLOR = {
  OVERBOUGHT:    "#ff3d5a",
  OVERSOLD:      "#00ff9d",
  NEUTRAL:       "#5a7a9a",
  BEARISH_WATCH: "#ff6b35",
  BULLISH_WATCH: "#f5c518",
  UNKNOWN:       "#5a7a9a",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#050c18;--s1:#0b1628;--s2:#0f1e35;--s3:#152540;
  --br:#1b3050;--br2:#24406a;--text:#dde6f5;--muted:#5a7a9a;--dim:#3d5a7a;
  --acc:#00d4ff;--grn:#00ff9d;--yel:#f5c518;--red:#ff3d5a;--orn:#ff6b35;--pur:#a78bfa;
  --mono:'Space Mono',monospace;--body:'DM Sans',sans-serif;
}
body{background:var(--bg);color:var(--text);font-family:var(--body);min-height:100vh;overflow-x:hidden}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--br2);border-radius:2px}
.app{display:flex;height:100vh;overflow:hidden}
.sidebar{width:236px;min-width:236px;background:var(--s1);border-right:1px solid var(--br);display:flex;flex-direction:column;overflow-y:auto}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.ticker-bar{height:38px;background:var(--s1);border-bottom:1px solid var(--br);overflow:hidden;position:relative;flex-shrink:0}
.ticker-inner{display:flex;align-items:center;height:100%;white-space:nowrap;animation:ticker 40s linear infinite}
.ticker-inner:hover{animation-play-state:paused}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.tick-item{display:inline-flex;align-items:center;gap:8px;padding:0 20px;border-right:1px solid var(--br);height:100%;font-family:var(--mono);font-size:10px}
.tick-label{color:var(--muted);font-size:9px;letter-spacing:.5px}
.tick-val{font-weight:700;font-size:11px;transition:color .2s}
.tick-chg{font-size:9px;padding:1px 5px;border-radius:3px}
.tick-up{color:var(--grn)}.tick-dn{color:var(--red)}.tick-unch{color:var(--muted)}
.topbar{height:52px;background:var(--s1);border-bottom:1px solid var(--br);display:flex;align-items:center;padding:0 18px;gap:12px;flex-shrink:0}
.regime-pill{display:flex;align-items:center;gap:8px;background:var(--s2);border:1px solid var(--br);border-radius:20px;padding:5px 14px;font-size:11px;font-family:var(--mono);white-space:nowrap}
.pulse{width:7px;height:7px;border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.src-pill{display:flex;align-items:center;gap:6px;background:rgba(0,255,157,.06);border:1px solid rgba(0,255,157,.18);border-radius:20px;padding:4px 12px;font-size:10px;color:var(--grn);font-family:var(--mono)}
.badge{font-family:var(--mono);font-size:10px;padding:4px 10px;border-radius:6px;background:var(--s2);border:1px solid var(--br);white-space:nowrap}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:8px}
.sb-logo{padding:16px 14px 12px;border-bottom:1px solid var(--br)}
.logo-t{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--acc);letter-spacing:2.5px}
.logo-s{font-size:9px;color:var(--muted);letter-spacing:1px;margin-top:3px}
.sb-nav{padding:8px;flex:1}
.nav-sect{font-size:8px;color:var(--dim);letter-spacing:2px;padding:14px 8px 5px;text-transform:uppercase}
.nav-it{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:7px;cursor:pointer;font-size:12px;color:var(--muted);transition:all .12s;margin-bottom:1px;border:1px solid transparent}
.nav-it:hover{background:var(--s2);color:var(--text)}
.nav-it.act{background:rgba(0,212,255,.07);color:var(--acc);border-color:rgba(0,212,255,.12)}
.nav-ico{width:16px;text-align:center;font-size:11px}
/* Market button: name area filters signals, chevron area toggles dropdown */
.mkt-btn{display:flex;align-items:center;gap:9px;padding:4px 6px 4px 10px;border-radius:7px;font-size:12px;transition:all .12s;margin-bottom:1px;border:1px solid transparent}
.mkt-btn:hover{background:var(--s2)}
.mkt-btn.act{background:rgba(0,212,255,.07);border-color:rgba(0,212,255,.12)}
.mkt-label-area{display:flex;align-items:center;gap:9px;flex:1;cursor:pointer;padding:4px 0}
.mkt-badge{width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;font-family:var(--mono);flex-shrink:0}
.mkt-name{font-size:11px;font-weight:500;flex:1}
.mkt-chev-btn{cursor:pointer;padding:6px 8px;border-radius:5px;color:var(--dim);font-size:8px;transition:all .12s;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.mkt-chev-btn:hover{background:rgba(0,212,255,.12);color:var(--acc)}
.chev{transition:transform .18s;display:inline-block}
.chev.open{transform:rotate(180deg)}
.strat-list{padding:3px 6px 3px 30px;overflow:hidden}
.strat-it{display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:5px;cursor:pointer;font-size:10px;color:var(--muted);transition:all .12s;margin-bottom:1px}
.strat-it:hover{background:var(--s2);color:var(--text)}
.strat-it.act{color:var(--text);background:rgba(0,212,255,.05)}
.s-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.feed-row{display:flex;align-items:center;gap:6px;font-size:9px;font-family:var(--mono);padding:3px 8px;color:var(--muted)}
.feed-ok{color:var(--grn)}
.tabs{display:flex;gap:2px;background:var(--s1);border-bottom:1px solid var(--br);padding:0 18px;flex-shrink:0;overflow-x:auto}
.tab{padding:13px 14px;font-size:12px;font-weight:500;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;transition:all .12s;white-space:nowrap}
.tab.act{color:var(--acc);border-bottom-color:var(--acc)}
.tab:hover:not(.act){color:var(--text)}
.tab-right{margin-left:auto;display:flex;align-items:center;gap:12px;padding:0 4px;flex-shrink:0}
.count-pill{font-size:10px;font-family:var(--mono);padding:2px 8px;border-radius:10px}
.content{flex:1;overflow-y:auto;padding:18px}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.stat-card{background:var(--s1);border:1px solid var(--br);border-radius:10px;padding:14px 16px}
.stat-lbl{font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
.stat-val{font-family:var(--mono);font-size:20px;font-weight:700}
.stat-sub{font-size:10px;color:var(--muted);margin-top:3px}
.strat-seg{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:18px}
.strat-seg-card{background:var(--s1);border:1px solid var(--br);border-radius:8px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between}
.strat-seg-name{font-size:9px;color:var(--muted);letter-spacing:.5px;margin-bottom:3px;text-transform:uppercase}
.strat-seg-count{font-family:var(--mono);font-size:18px;font-weight:700}
.sigs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
.sig-card{background:var(--s1);border:1px solid var(--br);border-radius:11px;padding:15px;position:relative;overflow:hidden;transition:border-color .15s,transform .15s}
.sig-card:hover{border-color:rgba(0,212,255,.25);transform:translateY(-1px)}
.sig-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:11px 11px 0 0}
.bull::before{background:linear-gradient(90deg,var(--grn),transparent)}
.bear::before{background:linear-gradient(90deg,var(--red),transparent)}
.neut::before{background:linear-gradient(90deg,var(--acc),transparent)}
.sig-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.sig-strat{font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:.3px}
.sig-tags{display:flex;gap:5px;margin-top:4px;flex-wrap:wrap}
.sig-tag{font-size:8px;padding:2px 7px;border-radius:3px;font-family:var(--mono);font-weight:700;letter-spacing:.8px}
.sig-score-wrap{text-align:right}
.sig-score{font-family:var(--mono);font-size:24px;font-weight:700;line-height:1}
.sig-score-lbl{font-size:8px;color:var(--muted);margin-top:1px}
/* Active filter breadcrumb */
.filter-crumb{display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:7px 12px;background:var(--s2);border:1px solid var(--br2);border-radius:7px;font-size:10px;font-family:var(--mono)}
.filter-crumb-clear{cursor:pointer;color:var(--red);font-size:10px;margin-left:auto;padding:1px 6px;border-radius:4px;border:1px solid rgba(255,61,90,.2);background:rgba(255,61,90,.06)}
.filter-crumb-clear:hover{background:rgba(255,61,90,.14)}
/* PCR gauge */
.pcr-gauge{background:var(--s2);border-radius:8px;padding:10px 12px;margin-bottom:10px}
.pcr-gauge-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.pcr-val{font-family:var(--mono);font-size:22px;font-weight:700}
.pcr-zone{font-family:var(--mono);font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px}
.pcr-bar-track{height:6px;background:var(--br2);border-radius:3px;position:relative;overflow:hidden}
.pcr-bar-fill{height:100%;border-radius:3px;transition:width .3s}
.pcr-labels{display:flex;justify-content:space-between;font-size:8px;color:var(--dim);font-family:var(--mono);margin-top:3px}
.pcr-detail{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
.pcr-stat{background:var(--s3);border-radius:5px;padding:5px 7px}
.pcr-stat-k{font-size:7px;color:var(--muted);margin-bottom:2px}
.pcr-stat-v{font-family:var(--mono);font-size:10px;font-weight:700}
/* Paper trading */
.paper-bal-label{font-size:9px;color:var(--yel);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px}
.paper-trade-form{background:var(--s1);border:1px solid var(--br);border-radius:10px;padding:16px;margin-bottom:16px}
.paper-form-title{font-size:11px;font-weight:600;color:var(--acc);margin-bottom:12px;font-family:var(--mono);letter-spacing:.5px}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
.form-field{display:flex;flex-direction:column;gap:4px}
.form-lbl{font-size:9px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase}
.form-inp,.form-sel{background:var(--s2);border:1px solid var(--br);border-radius:6px;color:var(--text);font-family:var(--body);font-size:12px;padding:7px 10px;outline:none;transition:border .12s}
.form-inp:focus,.form-sel:focus{border-color:var(--acc)}
.btn{border:none;border-radius:7px;padding:9px 18px;font-family:var(--body);font-size:12px;font-weight:600;cursor:pointer;transition:opacity .12s}
.btn:hover{opacity:.85}.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-primary{background:var(--acc);color:#000}
.btn-danger{background:var(--red);color:#fff}
.btn-ghost{background:var(--s2);color:var(--text);border:1px solid var(--br)}
.paper-trade-row{display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;align-items:center;background:var(--s2);border-radius:7px;padding:10px 12px;margin-bottom:6px;font-size:11px}
.paper-status-open{color:var(--yel);font-family:var(--mono);font-size:9px;font-weight:700}
.paper-status-closed{color:var(--muted);font-family:var(--mono);font-size:9px}
/* Subscription */
.plans-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
.plan-card{background:var(--s1);border:1px solid var(--br);border-radius:12px;padding:20px;position:relative;transition:border-color .15s}
.plan-card.current{border-color:rgba(0,212,255,.35);background:rgba(0,212,255,.04)}
.plan-badge{font-size:8px;font-family:var(--mono);font-weight:700;padding:2px 8px;border-radius:3px;position:absolute;top:12px;right:12px;letter-spacing:.8px}
.plan-name{font-family:var(--mono);font-size:14px;font-weight:700;margin-bottom:6px}
.plan-price{font-family:var(--mono);font-size:24px;font-weight:700;color:var(--acc);margin-bottom:4px}
.plan-price span{font-size:10px;color:var(--muted)}
.plan-features{list-style:none;margin:12px 0 16px;display:flex;flex-direction:column;gap:6px}
.plan-features li{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px}
.plan-features li::before{content:'✓';color:var(--grn);font-size:10px;font-weight:700;flex-shrink:0}
.plan-features li.locked::before{content:'⊘';color:var(--dim)}
.plan-features li.locked{color:var(--dim)}
.eq-price-hero{background:var(--s2);border-radius:8px;padding:10px 12px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between}
.eq-sym{font-family:var(--mono);font-size:15px;font-weight:700;color:var(--acc)}
.eq-ltp{font-family:var(--mono);font-size:18px;font-weight:700}
.eq-chg{font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;margin-top:2px;display:inline-block}
.eq-chg-up{background:rgba(0,255,157,.12);color:var(--grn)}
.eq-chg-dn{background:rgba(255,61,90,.12);color:var(--red)}
.eq-ohlc{display:flex;gap:10px;margin-top:6px;font-size:9px;color:var(--muted);font-family:var(--mono)}
.sig-action{background:var(--s2);border:1px solid var(--br);border-radius:7px;padding:8px 10px;font-family:var(--mono);font-size:9px;color:var(--acc);margin-bottom:10px;word-break:break-all;line-height:1.6}
.sig-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:8px}
.meta-box{background:var(--s2);border-radius:6px;padding:6px 8px}
.meta-k{font-size:8px;color:var(--muted);margin-bottom:2px;letter-spacing:.5px}
.meta-v{font-family:var(--mono);font-size:10px;font-weight:700}
.sig-reason{font-size:9px;color:var(--muted);padding:7px 0 0;border-top:1px solid var(--br);line-height:1.6}
.sig-foot{display:flex;align-items:center;justify-content:space-between;margin-top:7px}
.sig-src{font-size:8px;color:var(--dim);font-family:var(--mono)}
.risk-badge{font-size:8px;font-weight:700;padding:2px 7px;border-radius:3px;font-family:var(--mono)}
.rL{background:rgba(0,255,157,.1);color:var(--grn);border:1px solid rgba(0,255,157,.2)}
.rM{background:rgba(245,197,24,.1);color:var(--yel);border:1px solid rgba(245,197,24,.2)}
.rH{background:rgba(255,61,90,.1);color:var(--red);border:1px solid rgba(255,61,90,.2)}
.fo-strikes{background:var(--s2);border-radius:8px;padding:10px 12px;margin-bottom:10px}
.fo-idx{font-family:var(--mono);font-size:14px;font-weight:700;color:var(--acc)}
.fo-spot{font-family:var(--mono);font-size:11px;color:var(--muted);margin-left:8px}
.fo-exp{font-size:9px;color:var(--dim);margin-top:4px;font-family:var(--mono)}
.idx-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px}
.idx-card{background:var(--s1);border:1px solid var(--br);border-radius:9px;padding:12px 14px;transition:border-color .12s}
.idx-card:hover{border-color:var(--br2)}
.idx-name{font-size:9px;color:var(--muted);letter-spacing:1px;margin-bottom:4px;text-transform:uppercase}
.idx-ltp{font-family:var(--mono);font-size:16px;font-weight:700;transition:color .2s}
.idx-chg{font-size:10px;margin-top:2px}
.idx-hl{font-size:8px;color:var(--dim);margin-top:3px;font-family:var(--mono)}
.movers-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}
.mover-table{background:var(--s1);border:1px solid var(--br);border-radius:10px;overflow:hidden}
.mover-hdr{padding:10px 14px;border-bottom:1px solid var(--br);font-size:10px;font-weight:600;letter-spacing:.5px}
.mover-row{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-bottom:1px solid rgba(27,48,80,.5);font-size:11px}
.mover-row:last-child{border-bottom:none}
.mover-sym{font-family:var(--mono);font-weight:700;font-size:12px}
.mover-ltp{font-family:var(--mono);font-size:11px;color:var(--muted)}
.mover-chg{font-family:var(--mono);font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px}
.chg-up{background:rgba(0,255,157,.1);color:var(--grn)}
.chg-dn{background:rgba(255,61,90,.1);color:var(--red)}
@keyframes flash-up{0%{background:rgba(0,255,157,.25)}100%{background:transparent}}
@keyframes flash-dn{0%{background:rgba(255,61,90,.25)}100%{background:transparent}}
.flash-up{animation:flash-up .4s ease-out}
.flash-dn{animation:flash-dn .4s ease-out}
.live-dot{width:6px;height:6px;border-radius:50%;background:var(--grn);display:inline-block;animation:pulse 1s infinite;margin-right:5px}
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg)}
.login-card{background:var(--s1);border:1px solid var(--br);border-radius:14px;padding:38px;width:370px}
.l-logo{font-family:var(--mono);font-size:16px;color:var(--acc);font-weight:700;letter-spacing:3px;margin-bottom:3px}
.l-sub{font-size:10px;color:var(--muted);margin-bottom:28px;letter-spacing:.5px}
.l-lbl{font-size:10px;color:var(--muted);margin-bottom:5px;display:block;letter-spacing:.5px}
.l-inp{width:100%;background:var(--s2);border:1px solid var(--br);border-radius:7px;color:var(--text);font-family:var(--body);font-size:13px;padding:9px 12px;outline:none;transition:border .12s;margin-bottom:14px}
.l-inp:focus{border-color:var(--acc)}
.l-btn{width:100%;background:var(--acc);color:#000;border:none;border-radius:7px;padding:10px;font-family:var(--body);font-size:13px;font-weight:700;cursor:pointer;transition:opacity .12s;margin-top:3px}
.l-btn:hover{opacity:.88}.l-btn:disabled{opacity:.5;cursor:not-allowed}
.l-demo{font-size:10px;color:var(--muted);text-align:center;margin-top:14px}
.err-box{background:rgba(255,61,90,.08);border:1px solid rgba(255,61,90,.25);color:var(--red);font-size:11px;padding:8px 12px;border-radius:7px;margin-bottom:14px}
.empty{text-align:center;padding:50px 20px;color:var(--muted)}
.empty-ico{font-size:36px;margin-bottom:10px}
.empty-t{font-size:14px;color:var(--text);margin-bottom:5px}
.empty-s{font-size:11px}
.card{background:var(--s1);border:1px solid var(--br);border-radius:10px;padding:16px}
.card-lbl{font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px}
@media(max-width:1200px){.stats-grid{grid-template-columns:repeat(2,1fr)}.idx-strip{grid-template-columns:repeat(2,1fr)}.plans-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:900px){.sigs-grid{grid-template-columns:1fr}}
@media(max-width:768px){.sidebar{display:none}}
`;

function api(path, opts={}) {
  const tok = localStorage.getItem("tok");
  return fetch(API+path, {
    headers:{"Content-Type":"application/json",...(tok?{Authorization:`Bearer ${tok}`}:{})},
    ...opts
  }).then(r=>r.json());
}

function skey(name){ const m=(name||"").match(/^([SE]\d)/i); return m?m[1].toUpperCase():"S1"; }
function scoreColor(s){ return s>=75?"var(--grn)":s>=60?"var(--yel)":"var(--orn)"; }
function sigClass(dir=""){
  const d=dir.toUpperCase();
  if(d.includes("BUY")||d.includes("BULL")||d.includes("LONG")) return "bull";
  if(d.includes("SELL")||d.includes("BEAR")||d.includes("SHORT")||d.includes("EXIT")) return "bear";
  return "neut";
}
function fmt(n,dec=2){ return n!=null&&n!==0?Number(n).toLocaleString("en-IN",{minimumFractionDigits:dec,maximumFractionDigits:dec}):"—"; }
function fmtINR(n){ return n!=null?`₹${Number(n).toLocaleString("en-IN")}`:"—"; }
function chgClass(c){ return c>0?"tick-up":c<0?"tick-dn":"tick-unch"; }

// ── FIXED market routing ──────────────────────────────────────────
// FO signals: market="FO", instrument=NIFTY|BANKNIFTY|FINNIFTY
// PCR signals: market="FO", strategy contains "PCR", instrument=NIFTY|BANKNIFTY|FINNIFTY
// Equity signals: market="EQUITY"
function matchesMarket(sig, market) {
  if (market === "ALL") return true;
  if (market === "EQUITY") return sig.market === "EQUITY";
  const inst = (sig.instrument || sig.symbol || "").toUpperCase();
  return inst === market && sig.market !== "EQUITY";
}

// ── FIXED strategy sub-filter ─────────────────────────────────────
// Compares skey of signal (e.g. "S5") against skey of selected strategy label (e.g. "S5 PCR Contrarian" -> "S5")
function matchesStrategy(sig, stratLabel) {
  if (!stratLabel) return true;
  const sigKey = skey(sig.strategy);      // "S5"
  const filterKey = skey(stratLabel);      // "S5" from "S5 PCR Contrarian"
  return sigKey === filterKey;
}

function Login({onLogin}){
  const [email,setEmail]=useState("demo@algotrade.in");
  const [pass,setPass]=useState("demo123");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const go=async()=>{
    setLoading(true);setErr("");
    try{
      const r=await api("/auth/login",{method:"POST",body:JSON.stringify({email,password:pass})});
      if(r.token){localStorage.setItem("tok",r.token);onLogin(r.user);}
      else setErr(r.detail||"Login failed");
    }catch{setErr("Backend not running — start python main.py on port 8000");}
    finally{setLoading(false);}
  };
  return(<><style>{CSS}</style>
    <div className="login-wrap"><div className="login-card">
      <div className="l-logo">ALGOTRADE</div>
      <div className="l-sub">NSE F&amp;O SIGNAL PLATFORM · NSE Direct + MultiTrade</div>
      {err&&<div className="err-box">{err}</div>}
      <label className="l-lbl">Email</label>
      <input className="l-inp" value={email} onChange={e=>setEmail(e.target.value)} type="email"/>
      <label className="l-lbl">Password</label>
      <input className="l-inp" value={pass} onChange={e=>setPass(e.target.value)} type="password"
        onKeyDown={e=>e.key==="Enter"&&go()}/>
      <button className="l-btn" onClick={go} disabled={loading}>{loading?"Signing in…":"Sign In"}</button>
      <div className="l-demo">Demo: demo@algotrade.in / demo123</div>
    </div></div>
  </>);
}

function IndexTicker({indices}){
  if(!indices||!indices.length) return null;
  const items=[...indices,...indices];
  return(
    <div className="ticker-bar"><div className="ticker-inner">
      {items.map((idx,i)=>(
        <div className={`tick-item ${idx._flash||""}`} key={`${i}-${idx._ts||0}`}>
          <span className="tick-label">{idx.label}</span>
          <span className={`tick-val ${chgClass(idx.change_pct)}`}>
            {idx.ltp?fmt(idx.ltp,idx.label==="VIX"?2:0):"—"}
          </span>
          {idx.change_pct!==0&&(
            <span className={`tick-chg ${chgClass(idx.change_pct)}`}
              style={{background:idx.change_pct>0?"rgba(0,255,157,.1)":"rgba(255,61,90,.1)"}}>
              {idx.change_pct>0?"+":""}{fmt(idx.change_pct,2)}%
            </span>
          )}
        </div>
      ))}
    </div></div>
  );
}

function IndexStrip({indices}){
  const main=["NIFTY","BANKNIFTY","FINNIFTY","VIX","MIDCAP"];
  const shown=(indices||[]).filter(i=>main.includes(i.label));
  if(!shown.length) return null;
  return(
    <div className="idx-strip">
      {shown.map((idx,i)=>{
        const up=idx.change_pct>0,dn=idx.change_pct<0;
        const col=up?"var(--grn)":dn?"var(--red)":"var(--muted)";
        return(
          <div className={`idx-card ${idx._flash||""}`} key={`${i}-${idx._ts||0}`}>
            <div className="idx-name">{idx.label}</div>
            <div className="idx-ltp" style={{color:idx.ltp?col:"var(--muted)"}}>
              {idx.ltp?fmt(idx.ltp,idx.label==="VIX"?2:0):"Loading…"}
            </div>
            <div className="idx-chg" style={{color:col}}>
              {idx.change_pct!==0?(idx.change_pct>0?"+":"")+fmt(idx.change_pct,2)+"%":"—"}
            </div>
            {(idx.high||idx.low)?<div className="idx-hl">H:{fmt(idx.high,0)} L:{fmt(idx.low,0)}</div>:null}
          </div>
        );
      })}
    </div>
  );
}

// ── PCR Card ──────────────────────────────────────────────────────
function PcrCard({sig}){
  const pcr = sig.pcr_oi;
  const zone = sig.zone || (pcr < 0.6 ? "OVERBOUGHT" : pcr > 1.3 ? "OVERSOLD" : "NEUTRAL");
  const zoneCol = PCR_ZONE_COLOR[zone] || "var(--muted)";
  const pcrClamped = Math.min(2, Math.max(0, pcr || 1));
  const barWidth = Math.round(pcrClamped / 2 * 100);
  const barColor = zone==="OVERSOLD"?"var(--grn)":zone==="OVERBOUGHT"?"var(--red)":"var(--yel)";
  return(
    <div className={`sig-card ${sigClass(sig.direction)}`}>
      <div className="sig-top">
        <div>
          <div className="sig-strat" style={{color:"#22c55e"}}>S5 PCR CONTRARIAN</div>
          <div className="sig-tags">
            <span className="sig-tag" style={{background:"rgba(34,197,94,.12)",color:"#22c55e",border:"1px solid rgba(34,197,94,.25)"}}>{sig.instrument||"F&O"}</span>
            <span className="sig-tag" style={{background:zoneCol+"20",color:zoneCol,border:`1px solid ${zoneCol}40`}}>{zone}</span>
            <span className="sig-tag" style={{background:"rgba(0,212,255,.1)",color:"var(--acc)",border:"1px solid rgba(0,212,255,.2)"}}>OI</span>
          </div>
        </div>
        <div className="sig-score-wrap">
          <div className="sig-score" style={{color:scoreColor(sig.score)}}>{sig.score}</div>
          <div className="sig-score-lbl">SCORE</div>
        </div>
      </div>
      <div className="pcr-gauge">
        <div className="pcr-gauge-header">
          <div>
            <div style={{fontSize:9,color:"var(--muted)",marginBottom:3}}>PUT/CALL RATIO (OI)</div>
            <div className="pcr-val" style={{color:zoneCol}}>{pcr!=null?Number(pcr).toFixed(3):"—"}</div>
          </div>
          <div className="pcr-zone" style={{background:zoneCol+"20",color:zoneCol,border:`1px solid ${zoneCol}40`}}>
            {sig.signal||zone}
          </div>
        </div>
        <div className="pcr-bar-track"><div className="pcr-bar-fill" style={{width:barWidth+"%",background:barColor}}/></div>
        <div className="pcr-labels">
          <span>0 GREED</span><span>0.60</span><span>0.85</span><span>1.15</span><span>1.30</span><span>2.0 FEAR</span>
        </div>
        <div className="pcr-detail">
          <div className="pcr-stat"><div className="pcr-stat-k">PUT OI</div>
            <div className="pcr-stat-v">{sig.total_put_oi?(sig.total_put_oi/1e5).toFixed(1)+"L":"—"}</div></div>
          <div className="pcr-stat"><div className="pcr-stat-k">CALL OI</div>
            <div className="pcr-stat-v">{sig.total_call_oi?(sig.total_call_oi/1e5).toFixed(1)+"L":"—"}</div></div>
          <div className="pcr-stat"><div className="pcr-stat-k">PCR VOL</div>
            <div className="pcr-stat-v">{sig.pcr_volume!=null?Number(sig.pcr_volume).toFixed(3):"—"}</div></div>
          <div className="pcr-stat"><div className="pcr-stat-k">VIX</div><div className="pcr-stat-v">{sig.vix||"—"}</div></div>
        </div>
      </div>
      <div className="sig-action">
        <span style={{color:sig.direction==="LONG"||sig.direction==="BUY"?"var(--grn)":"var(--red)",fontWeight:700}}>{sig.direction}</span>
        {" "}{sig.instrument} — PCR {pcr!=null?Number(pcr).toFixed(3):"—"}
        {zone==="OVERBOUGHT"?" — Heavy CALL buying, fade the greed":zone==="OVERSOLD"?" — Heavy PUT buying, fade the fear":""}
      </div>
      {sig.reason&&<div className="sig-reason">{sig.reason}</div>}
      <div className="sig-foot">
        <div className="sig-src">📊 {sig.source||"PCR Strategy"}</div>
        <span className={`risk-badge r${(sig.risk||"M")[0]}`}>{sig.risk||"MEDIUM"}</span>
      </div>
    </div>
  );
}

function EqCard({sig}){
  const info=STRAT_INFO[skey(sig.strategy)]||{color:"var(--pur)",tag:""};
  const ltp=sig.ltp||sig.spot||0; const chg=sig.change_pct||0;
  return(
    <div className={`sig-card ${sigClass(sig.direction)}`}>
      <div className="sig-top">
        <div>
          <div className="sig-strat" style={{color:info.color}}>{sig.strategy}</div>
          <div className="sig-tags">
            <span className="sig-tag" style={{background:"rgba(167,139,250,.12)",color:"var(--pur)",border:"1px solid rgba(167,139,250,.2)"}}>EQUITY</span>
            <span className="sig-tag" style={{background:info.color+"18",color:info.color,border:`1px solid ${info.color}30`}}>{info.tag}</span>
          </div>
        </div>
        <div className="sig-score-wrap">
          <div className="sig-score" style={{color:scoreColor(sig.score)}}>{sig.score}</div>
          <div className="sig-score-lbl">SCORE</div>
        </div>
      </div>
      <div className="eq-price-hero">
        <div><div className="eq-sym">{sig.symbol}</div></div>
        <div style={{textAlign:"right"}}>
          <div className="eq-ltp" style={{color:chg>=0?"var(--grn)":"var(--red)"}}>₹{ltp?fmt(ltp,2):"—"}</div>
          <div className={`eq-chg ${chg>=0?"eq-chg-up":"eq-chg-dn"}`}>{chg>=0?"+":""}{fmt(chg,2)}%</div>
        </div>
      </div>
      {(sig.high||sig.low)&&<div className="eq-ohlc">
        <span>H:₹{fmt(sig.high,2)}</span><span>L:₹{fmt(sig.low,2)}</span>
        {sig.prev_close?<span>PC:₹{fmt(sig.prev_close,2)}</span>:null}
      </div>}
      <div className="sig-action">
        <span style={{color:sig.direction==="BUY"?"var(--grn)":"var(--red)",fontWeight:700}}>{sig.direction}</span>
        {" "}{sig.symbol} @ ₹{ltp?fmt(ltp,2):"—"}
      </div>
      <div className="sig-meta">
        <div className="meta-box"><div className="meta-k">Entry</div><div className="meta-v">₹{sig.entry_at?fmt(sig.entry_at,2):"—"}</div></div>
        <div className="meta-box"><div className="meta-k">Target</div><div className="meta-v" style={{color:"var(--grn)"}}>₹{sig.target_at?fmt(sig.target_at,2):"—"}</div></div>
        <div className="meta-box"><div className="meta-k">SL</div><div className="meta-v" style={{color:"var(--red)"}}>₹{sig.sl_at?fmt(sig.sl_at,2):"—"}</div></div>
        <div className="meta-box"><div className="meta-k">Tgt pts</div><div className="meta-v" style={{color:"var(--grn)"}}>{sig.target_pts||"—"}</div></div>
        <div className="meta-box"><div className="meta-k">SL pts</div><div className="meta-v" style={{color:"var(--red)"}}>{sig.sl_pts||"—"}</div></div>
        <div className="meta-box"><div className="meta-k">VIX</div><div className="meta-v">{sig.vix||"—"}</div></div>
      </div>
      {sig.reason&&<div className="sig-reason">{sig.reason}</div>}
      <div className="sig-foot">
        <div className="sig-src">📡 {sig.source||"NSE"}</div>
        <span className={`risk-badge r${(sig.risk||"M")[0]}`}>{sig.risk||"MEDIUM"}</span>
      </div>
    </div>
  );
}

function FoCard({sig}){
  const k=skey(sig.strategy); const info=STRAT_INFO[k]||{color:"var(--acc)",tag:"NEUTRAL"};
  const spread=sig.spread??sig.entry_spread;
  const isCalendar=sig.strategy?.toUpperCase().includes("CALENDAR");
  return(
    <div className={`sig-card ${sigClass(sig.direction)}`}>
      <div className="sig-top">
        <div>
          <div className="sig-strat" style={{color:info.color}}>{sig.strategy}</div>
          <div className="sig-tags">
            <span className="sig-tag" style={{background:"rgba(0,212,255,.12)",color:"var(--acc)",border:"1px solid rgba(0,212,255,.2)"}}>
              {isCalendar?"CALENDAR":sig.instrument||sig.market||"FO"}
            </span>
            <span className="sig-tag" style={{background:info.color+"18",color:info.color,border:`1px solid ${info.color}30`}}>{info.tag}</span>
            {sig.event_type&&sig.event_type!=="signal"&&(
              <span className="sig-tag" style={{
                background:sig.event_type==="entry"?"rgba(0,255,157,.12)":sig.event_type==="exit"?"rgba(255,61,90,.12)":"rgba(245,197,24,.08)",
                color:sig.event_type==="entry"?"var(--grn)":sig.event_type==="exit"?"var(--red)":"var(--yel)",
                border:"1px solid transparent"}}>
                {sig.event_type?.toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <div className="sig-score-wrap">
          <div className="sig-score" style={{color:scoreColor(sig.score)}}>{sig.score}</div>
          <div className="sig-score-lbl">SCORE</div>
        </div>
      </div>
      <div className="fo-strikes">
        <div style={{display:"flex",alignItems:"baseline",gap:4}}>
          <span className="fo-idx">{sig.instrument||sig.symbol||"BANKNIFTY"}</span>
          {sig.near_strike&&<span className="fo-spot">ATM {sig.near_strike}</span>}
        </div>
        {spread!=null&&<div className="fo-exp">
          Spread: {fmt(spread,2)}pts
          {sig.fair_value!=null&&` | Fair: ${fmt(sig.fair_value,2)}pts`}
          {sig.deviation!=null&&` | Dev: ${fmt(sig.deviation,2)}pts`}
        </div>}
      </div>
      <div className="sig-action">{sig.action||sig.orders||"—"}</div>
      <div className="sig-meta">
        <div className="meta-box"><div className="meta-k">Spread</div><div className="meta-v">{spread!=null?fmt(spread,2)+"pts":"—"}</div></div>
        <div className="meta-box"><div className="meta-k">Target</div><div className="meta-v" style={{color:"var(--grn)"}}>{sig.target_pts?"+"+sig.target_pts+"pts":"—"}</div></div>
        <div className="meta-box"><div className="meta-k">SL</div><div className="meta-v" style={{color:"var(--red)"}}>{sig.sl_pts?"-"+sig.sl_pts+"pts":"—"}</div></div>
        <div className="meta-box"><div className="meta-k">Direction</div>
          <div className="meta-v" style={{color:sig.direction?.includes("LONG")||sig.direction==="BUY"?"var(--grn)":sig.direction?.includes("SHORT")||sig.direction?.includes("EXIT")?"var(--red)":"var(--muted)"}}>
            {sig.direction||"—"}
          </div>
        </div>
        <div className="meta-box"><div className="meta-k">Lots</div><div className="meta-v">{sig.lots_suggested||"—"}</div></div>
        <div className="meta-box"><div className="meta-k">VIX</div><div className="meta-v">{sig.vix||"—"}</div></div>
      </div>
      {sig.reason&&<div className="sig-reason">{sig.reason}</div>}
      <div className="sig-foot">
        <div className="sig-src">📡 {sig.source||"Calendar Algo"}</div>
        <span className={`risk-badge r${(sig.risk||"M")[0]}`}>{sig.risk||"MEDIUM"}</span>
      </div>
    </div>
  );
}

function SigCard({sig}){
  if(sig.market==="EQUITY") return <EqCard sig={sig}/>;
  // Route PCR by strategy name — covers both mock ("S5 PCR CONTRARIAN") and live pcr_strategy source
  if((sig.strategy||"").toUpperCase().includes("PCR")||sig.source==="pcr_strategy") return <PcrCard sig={sig}/>;
  return <FoCard sig={sig}/>;
}

function MoversPanel(){
  const [movers,setMovers]=useState({gainers:[],losers:[]});
  useEffect(()=>{ api("/movers").then(setMovers).catch(()=>{}); },[]);
  return(
    <div className="movers-grid">
      <div className="mover-table">
        <div className="mover-hdr" style={{color:"var(--grn)"}}>▲ Top Gainers</div>
        {movers.gainers.map((m,i)=>(
          <div className="mover-row" key={i}>
            <span className="mover-sym">{m.symbol}</span>
            <span className="mover-ltp">₹{fmt(m.ltp,2)}</span>
            <span className="mover-chg chg-up">+{fmt(m.change_pct,2)}%</span>
          </div>
        ))}
        {!movers.gainers.length&&<div style={{padding:"12px 14px",fontSize:11,color:"var(--muted)"}}>Loading…</div>}
      </div>
      <div className="mover-table">
        <div className="mover-hdr" style={{color:"var(--red)"}}>▼ Top Losers</div>
        {movers.losers.map((m,i)=>(
          <div className="mover-row" key={i}>
            <span className="mover-sym">{m.symbol}</span>
            <span className="mover-ltp">₹{fmt(m.ltp,2)}</span>
            <span className="mover-chg chg-dn">{fmt(m.change_pct,2)}%</span>
          </div>
        ))}
        {!movers.losers.length&&<div style={{padding:"12px 14px",fontSize:11,color:"var(--muted)"}}>Loading…</div>}
      </div>
    </div>
  );
}

function StratSegBanner({signals}){
  const groups=[
    {id:"S1",label:"Calendar",  color:"#00d4ff"},
    {id:"S2",label:"Iron Condor",color:"#00ff9d"},
    {id:"S3",label:"Straddle",  color:"#f5c518"},
    {id:"S4",label:"0DTE Scalp",color:"#ff6b35"},
    {id:"S5",label:"PCR",       color:"#22c55e"},
    {id:"EQ",label:"Equity",    color:"#a78bfa"},
  ];
  return(
    <div className="strat-seg">
      {groups.map(g=>{
        const count=g.id==="EQ"
          ?signals.filter(s=>s.market==="EQUITY").length
          :signals.filter(s=>skey(s.strategy)===g.id).length;
        return(
          <div key={g.id} className="strat-seg-card">
            <div>
              <div className="strat-seg-name">{g.label}</div>
              <div className="strat-seg-count" style={{color:count>0?g.color:"var(--dim)"}}>{count}</div>
            </div>
            <div style={{width:3,height:32,borderRadius:2,background:count>0?g.color:"var(--br)"}}/>
          </div>
        );
      })}
    </div>
  );
}

// ── FIXED SignalsTab: uses matchesStrategy helper, shows active filter crumb ──
function SignalsTab({signals,market,strategy,indices,onClearStrategy}){
  const filtered = signals
    .filter(s => matchesMarket(s, market))
    .filter(s => matchesStrategy(s, strategy));

  const mktObj = MARKETS.find(m=>m.id===market);

  return(
    <div>
      <IndexStrip indices={indices}/>
      {market==="ALL"&&<MoversPanel/>}
      {market==="ALL"&&<StratSegBanner signals={signals}/>}

      {/* Active filter breadcrumb */}
      {(market!=="ALL"||strategy)&&(
        <div className="filter-crumb">
          {market!=="ALL"&&(
            <span style={{color:mktObj?.color||"var(--acc)"}}>
              {mktObj?.label||market}
            </span>
          )}
          {market!=="ALL"&&strategy&&<span style={{color:"var(--dim)"}}>›</span>}
          {strategy&&(
            <span style={{color:STRAT_INFO[skey(strategy)]?.color||"var(--acc)"}}>
              {strategy}
            </span>
          )}
          <span style={{color:"var(--muted)",fontSize:9}}>
            &nbsp;— {filtered.length} signal{filtered.length!==1?"s":""}
          </span>
          {strategy&&(
            <span className="filter-crumb-clear" onClick={onClearStrategy}>× Clear</span>
          )}
        </div>
      )}

      {filtered.length>0?(
        <div className="sigs-grid">
          {filtered.map((s,i)=><SigCard key={s.id||`${s.timestamp}-${i}`} sig={s}/>)}
        </div>
      ):(
        <div className="empty">
          <div className="empty-ico">📊</div>
          <div className="empty-t">No signals for this filter</div>
          <div className="empty-s">
            {market!=="ALL"
              ?`${market}${strategy?" • "+strategy:""} signals appear during market hours 9:15–15:30`
              :"Waiting for NSE data — signals refresh every 5s"}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsTab(){
  const [pnl,setPnl]=useState(null);
  useEffect(()=>{api("/analytics/pnl").then(setPnl).catch(()=>{});},[]);
  const byS=pnl?.by_strategy||{};
  const chart=Object.entries(byS).map(([k,v])=>({
    name:k.replace(/^[SE]\d\s/,"").slice(0,12),pnl:Math.round(v.total_pnl||0),
  }));
  return(
    <div>
      <div className="stats-grid">
        {[
          {l:"Total P&L",v:fmtINR(pnl?.total_pnl||0),c:(pnl?.total_pnl||0)>=0?"var(--grn)":"var(--red)"},
          {l:"Total Trades",v:pnl?.total_trades||0,c:"var(--acc)"},
          {l:"Winners",v:pnl?.winning_trades||0,c:"var(--grn)"},
          {l:"Win Rate",v:pnl?.total_trades?Math.round((pnl.winning_trades/pnl.total_trades)*100)+"%":"—",c:"var(--yel)"},
        ].map((s,i)=>(
          <div key={i} className="stat-card">
            <div className="stat-lbl">{s.l}</div>
            <div className="stat-val" style={{color:s.c,fontSize:18}}>{s.v}</div>
          </div>
        ))}
      </div>
      {chart.length>0?(
        <div className="card" style={{marginBottom:16}}>
          <div className="card-lbl">P&amp;L by Strategy</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chart} margin={{top:8,right:16,bottom:8,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--br)"/>
              <XAxis dataKey="name" tick={{fontSize:8,fill:"var(--muted)"}}/>
              <YAxis tick={{fontSize:8,fill:"var(--muted)"}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
              <Tooltip contentStyle={{background:"var(--s2)",border:"1px solid var(--br)",borderRadius:7,fontSize:11}}
                formatter={v=>[`₹${Number(v).toLocaleString("en-IN")}`,"P&L"]}/>
              <Bar dataKey="pnl" fill="var(--acc)" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ):(
        <div className="empty"><div className="empty-ico">📈</div><div className="empty-t">No closed trades yet</div></div>
      )}
    </div>
  );
}

function TradesTab(){
  const [tr,setTr]=useState({trades:[],open_count:0,closed_count:0,total_pnl:0});
  useEffect(()=>{api("/trades").then(setTr).catch(()=>{});},[]);
  const open=(tr.trades||[]).filter(t=>t.status==="OPEN");
  const closed=(tr.trades||[]).filter(t=>t.status==="CLOSED").slice(-5);
  return(
    <div>
      <div className="stats-grid">
        {[
          {l:"Total P&L",v:fmtINR(tr.total_pnl||0),c:(tr.total_pnl||0)>=0?"var(--grn)":"var(--red)"},
          {l:"Open Trades",v:tr.open_count||open.length,c:"var(--yel)"},
          {l:"Closed",v:tr.closed_count||0,c:"var(--acc)"},
        ].map((s,i)=>(
          <div key={i} className="stat-card">
            <div className="stat-lbl">{s.l}</div>
            <div className="stat-val" style={{color:s.c,fontSize:18}}>{s.v}</div>
          </div>
        ))}
      </div>
      {open.length>0&&(
        <div className="card" style={{marginBottom:16}}>
          <div className="card-lbl">Open Positions</div>
          {open.map(t=>(
            <div className="paper-trade-row" key={t.id}>
              <span style={{fontFamily:"var(--mono)",fontSize:11}}>{t.id}</span>
              <span>{t.strategy?.slice(0,12)}</span>
              <span style={{fontFamily:"var(--mono)"}}>{t.instrument}</span>
              <span className="paper-status-open">OPEN</span>
            </div>
          ))}
        </div>
      )}
      {closed.length>0&&(
        <div className="card">
          <div className="card-lbl">Recent Closed</div>
          {closed.map(t=>(
            <div className="paper-trade-row" key={t.id}>
              <span style={{fontFamily:"var(--mono)",fontSize:11}}>{t.id}</span>
              <span>{t.instrument}</span>
              <span style={{fontFamily:"var(--mono)",color:(t.pnl_inr||0)>=0?"var(--grn)":"var(--red)"}}>{fmtINR(t.pnl_inr)}</span>
              <span className="paper-status-closed">CLOSED</span>
            </div>
          ))}
        </div>
      )}
      {!open.length&&!closed.length&&(
        <div className="empty"><div className="empty-ico">📋</div>
          <div className="empty-t">No trades logged yet</div>
          <div className="empty-s">Signals appear automatically — use Paper Trade to practice</div>
        </div>
      )}
    </div>
  );
}

function PaperTab(){
  const [acc,setAcc]=useState(null);
  const [form,setForm]=useState({strategy:"S1 CALENDAR",instrument:"BANKNIFTY",direction:"LONG",lots:1,entry_spread:0,notes:""});
  const [closing,setClosing]=useState(null);
  const [exitSpread,setExitSpread]=useState(0);
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState("");
  const load=()=>api("/paper/account").then(setAcc).catch(()=>{});
  useEffect(()=>{load();},[]);
  const enter=async()=>{
    setLoading(true);setMsg("");
    try{
      const r=await api("/paper/trade",{method:"POST",body:JSON.stringify(form)});
      if(r.paper_trade){setMsg("✓ Paper trade entered: "+r.paper_trade.id);load();}
      else setMsg(r.detail||"Error entering trade");
    }catch(e){setMsg("Error: "+e.message);}finally{setLoading(false);}
  };
  const close=async(tradeId)=>{
    setLoading(true);setMsg("");
    try{
      const r=await api("/paper/close",{method:"POST",body:JSON.stringify({trade_id:tradeId,exit_spread:parseFloat(exitSpread)||0})});
      if(r.pnl_inr!==undefined){setMsg(`✓ Closed | P&L: ₹${r.pnl_inr.toLocaleString("en-IN")}`);setClosing(null);load();}
      else setMsg(r.detail||"Error closing trade");
    }catch(e){setMsg("Error: "+e.message);}finally{setLoading(false);}
  };
  const open=(acc?.trades||[]).filter(t=>t.status==="OPEN");
  const closed=(acc?.trades||[]).filter(t=>t.status==="CLOSED");
  const pnlCol=(acc?.total_pnl||0)>=0?"var(--grn)":"var(--red)";
  return(
    <div>
      <div style={{marginBottom:16,padding:"14px 16px",background:"var(--s1)",border:"1px solid rgba(245,197,24,.2)",borderRadius:10}}>
        <div className="paper-bal-label">📄 PAPER TRADING — Virtual Capital</div>
        <div style={{display:"flex",alignItems:"baseline",gap:20,marginTop:6,flexWrap:"wrap"}}>
          <div><div style={{fontSize:9,color:"var(--muted)",marginBottom:3}}>BALANCE</div>
            <div style={{fontFamily:"var(--mono)",fontSize:22,fontWeight:700,color:"var(--yel)"}}>{acc?fmtINR(acc.balance):"Loading…"}</div></div>
          <div><div style={{fontSize:9,color:"var(--muted)",marginBottom:3}}>TOTAL P&L</div>
            <div style={{fontFamily:"var(--mono)",fontSize:18,fontWeight:700,color:pnlCol}}>{acc?fmtINR(acc.total_pnl):"—"}</div></div>
          <div><div style={{fontSize:9,color:"var(--muted)",marginBottom:3}}>TRADES</div>
            <div style={{fontFamily:"var(--mono)",fontSize:16,fontWeight:700,color:"var(--acc)"}}>{acc?`${acc.open_count} open / ${acc.closed_count} closed`:"—"}</div></div>
        </div>
      </div>
      <div className="paper-trade-form">
        <div className="paper-form-title">+ ENTER PAPER TRADE</div>
        {msg&&<div style={{fontSize:11,padding:"6px 10px",borderRadius:6,marginBottom:10,
          background:msg.startsWith("✓")?"rgba(0,255,157,.08)":"rgba(255,61,90,.08)",
          color:msg.startsWith("✓")?"var(--grn)":"var(--red)",
          border:`1px solid ${msg.startsWith("✓")?"rgba(0,255,157,.2)":"rgba(255,61,90,.2)"}`}}>{msg}</div>}
        <div className="form-row">
          <div className="form-field"><label className="form-lbl">Strategy</label>
            <select className="form-sel" value={form.strategy} onChange={e=>setForm({...form,strategy:e.target.value})}>
              <option>S1 CALENDAR</option><option>S2 IRON CONDOR</option>
              <option>S3 SHORT STRADDLE</option><option>S4 0DTE SCALP</option><option>S5 PCR CONTRARIAN</option>
            </select></div>
          <div className="form-field"><label className="form-lbl">Instrument</label>
            <select className="form-sel" value={form.instrument} onChange={e=>setForm({...form,instrument:e.target.value})}>
              <option>BANKNIFTY</option><option>NIFTY</option><option>FINNIFTY</option>
            </select></div>
        </div>
        <div className="form-row">
          <div className="form-field"><label className="form-lbl">Direction</label>
            <select className="form-sel" value={form.direction} onChange={e=>setForm({...form,direction:e.target.value})}>
              <option>LONG</option><option>SHORT</option>
            </select></div>
          <div className="form-field"><label className="form-lbl">Lots</label>
            <input className="form-inp" type="number" min={1} max={50} value={form.lots}
              onChange={e=>setForm({...form,lots:parseInt(e.target.value)||1})}/></div>
        </div>
        <div className="form-row">
          <div className="form-field"><label className="form-lbl">Entry Spread (pts)</label>
            <input className="form-inp" type="number" step="0.5" value={form.entry_spread}
              onChange={e=>setForm({...form,entry_spread:parseFloat(e.target.value)||0})}/></div>
          <div className="form-field"><label className="form-lbl">Notes</label>
            <input className="form-inp" value={form.notes}
              onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Optional…"/></div>
        </div>
        <button className="btn btn-primary" onClick={enter} disabled={loading}>{loading?"Entering…":"Enter Paper Trade"}</button>
      </div>
      {open.length>0&&(
        <div className="card" style={{marginBottom:14}}>
          <div className="card-lbl">Open Paper Positions</div>
          {open.map(t=>(
            <div key={t.id} style={{marginBottom:8}}>
              <div className="paper-trade-row">
                <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--acc)"}}>{t.id}</span>
                <span>{t.strategy?.slice(0,14)}</span>
                <span style={{fontFamily:"var(--mono)"}}>{t.instrument} ×{t.lots}</span>
                <span className="paper-status-open">📄 PAPER</span>
                <button className="btn btn-ghost" style={{fontSize:10,padding:"4px 10px"}}
                  onClick={()=>setClosing(closing===t.id?null:t.id)}>Close</button>
              </div>
              {closing===t.id&&(
                <div style={{display:"flex",gap:8,padding:"8px 0 4px",alignItems:"center"}}>
                  <input className="form-inp" type="number" step="0.5" placeholder="Exit spread"
                    style={{width:140}} value={exitSpread} onChange={e=>setExitSpread(e.target.value)}/>
                  <button className="btn btn-danger" style={{fontSize:11}} onClick={()=>close(t.id)} disabled={loading}>Confirm Close</button>
                  <button className="btn btn-ghost" style={{fontSize:11}} onClick={()=>setClosing(null)}>Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {closed.length>0&&(
        <div className="card">
          <div className="card-lbl">Closed Paper Trades</div>
          {closed.slice(-8).reverse().map(t=>(
            <div className="paper-trade-row" key={t.id}>
              <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--dim)"}}>{t.id}</span>
              <span>{t.instrument}</span>
              <span style={{fontFamily:"var(--mono)",fontWeight:700,color:(t.pnl_inr||0)>=0?"var(--grn)":"var(--red)"}}>{fmtINR(t.pnl_inr)}</span>
              <span style={{fontFamily:"var(--mono)",fontSize:9,color:(t.pnl_pts||0)>=0?"var(--grn)":"var(--red)"}}>{t.pnl_pts!=null?`${t.pnl_pts>0?"+":""}${t.pnl_pts}pts`:""}</span>
              <span className="paper-status-closed">CLOSED</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubscriptionTab({user}){
  const [plans,setPlans]=useState([]);
  const [status,setStatus]=useState(null);
  const [loading,setLoading]=useState("");
  const [msg,setMsg]=useState("");
  useEffect(()=>{
    api("/subscription/plans").then(d=>setPlans(d.plans||[])).catch(()=>{});
    api("/subscription/status").then(setStatus).catch(()=>{});
  },[]);
  const upgrade=async(planId)=>{
    setLoading(planId);setMsg("");
    try{
      const r=await api("/subscription/upgrade",{method:"POST",body:JSON.stringify({plan:planId})});
      if(r.plan){setMsg(`✓ Upgraded to ${r.plan}`);api("/subscription/status").then(setStatus);}
      else setMsg(r.detail||"Upgrade failed");
    }catch(e){setMsg("Error: "+e.message);}finally{setLoading("");}
  };
  const currentPlan=status?.plan||user?.plan||"free";
  const BADGE_COL={free:"#5a7a9a",starter:"#00ff9d",pro:"#00d4ff",elite:"#f5c518"};
  return(
    <div>
      <div style={{marginBottom:20,padding:"14px 16px",background:"var(--s1)",border:"1px solid var(--br)",borderRadius:10}}>
        <div style={{fontSize:9,color:"var(--muted)",letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:6}}>CURRENT PLAN</div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontFamily:"var(--mono)",fontSize:20,fontWeight:700,color:BADGE_COL[currentPlan]||"var(--acc)"}}>{currentPlan.toUpperCase()}</div>
          {status?.tier&&(
            <div style={{fontSize:10,color:"var(--muted)"}}>
              {status.tier.live?"✓ Live signals":"⚠ Delayed 15min"} &nbsp;·&nbsp;
              {status.tier.strategies} strategies &nbsp;·&nbsp; {status.tier.instruments} instruments
            </div>
          )}
        </div>
      </div>
      {msg&&<div style={{fontSize:11,padding:"8px 12px",borderRadius:7,marginBottom:14,
        background:msg.startsWith("✓")?"rgba(0,255,157,.08)":"rgba(255,61,90,.08)",
        color:msg.startsWith("✓")?"var(--grn)":"var(--red)",
        border:`1px solid ${msg.startsWith("✓")?"rgba(0,255,157,.2)":"rgba(255,61,90,.2)"}`}}>{msg}</div>}
      <div className="plans-grid">
        {plans.map(p=>{
          const isCurrent=p.id===currentPlan; const bc=BADGE_COL[p.id]||"var(--acc)";
          return(
            <div key={p.id} className={`plan-card ${isCurrent?"current":""}`}>
              <div className="plan-badge" style={{background:bc+"20",color:bc,border:`1px solid ${bc}30`}}>{isCurrent?"ACTIVE":p.badge}</div>
              <div className="plan-name" style={{color:bc}}>{p.name}</div>
              <div className="plan-price">{p.price===0?"FREE":`₹${p.price.toLocaleString("en-IN")}`}{p.price>0&&<span>/mo</span>}</div>
              <ul className="plan-features">
                {p.features.map((f,i)=>(<li key={i}>{f}</li>))}
              </ul>
              {!isCurrent&&(
                <button className="btn btn-primary" style={{width:"100%",fontSize:11}}
                  onClick={()=>upgrade(p.id)} disabled={loading===p.id}>{loading===p.id?"Upgrading…":"Upgrade"}</button>
              )}
              {isCurrent&&(
                <div style={{textAlign:"center",fontSize:10,color:bc,fontFamily:"var(--mono)",padding:"9px 0",fontWeight:700}}>CURRENT PLAN</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────
export default function App(){
  const [user,setUser]      =useState(()=>localStorage.getItem("tok")?{tok:true}:null);
  const [signals,setSigs]   =useState([]);
  const [regime,setRegime]  =useState(null);
  const [indices,setIdxs]   =useState([]);
  const [mkt,setMkt]        =useState("ALL");
  const [strat,setStrat]    =useState(null);
  // openMkt tracks which market's strategy dropdown is EXPANDED (independent of selected market)
  const [openMkt,setOpenMkt]=useState(null);
  const [tab,setTab]        =useState("signals");
  const [wsStatus,setWsSt]  =useState("connecting");
  const [clock,setClock]    =useState(new Date());
  const wsRef=useRef(null);

  useEffect(()=>{const t=setInterval(()=>setClock(new Date()),100);return()=>clearInterval(t);},[]);

  useEffect(()=>{
    if(!user) return;
    const conn=()=>{
      const ws=new WebSocket(WS); wsRef.current=ws;
      ws.onopen=()=>setWsSt("live");
      ws.onclose=()=>{setWsSt("reconnecting");setTimeout(conn,3000);};
      ws.onerror=()=>setWsSt("error");
      ws.onmessage=e=>{
        try{
          const d=JSON.parse(e.data);
          if(d.type==="signal"&&d.data){
            setSigs(prev=>[d.data,...prev].slice(0,300));
            if(d.data.regime) setRegime(r=>({...r,regime:d.data.regime,vix:d.data.vix}));
            return;
          }
          if(d.type==="equity_signals"&&d.signals?.length){
            setSigs(prev=>[...d.signals,...prev.filter(s=>s.market!=="EQUITY")].slice(0,300));
            return;
          }
          if(d.type==="indices_update"&&d.indices?.length){
            setIdxs(prev=>d.indices.map((idx,i)=>({
              ...idx,
              _flash:(prev[i]?.ltp||0)<idx.ltp?"flash-up":(prev[i]?.ltp||0)>idx.ltp?"flash-dn":"",
              _ts:Date.now(),
            })));
            return;
          }
          if(d.type==="regime"){ setRegime(r=>({...r,...d})); return; }
          if(d.signals?.length) setSigs(d.signals);
          if(d.regime)          setRegime(r=>({...r,...d.regime}));
        }catch{}
      };
    };
    conn();
    return()=>wsRef.current?.close();
  },[user]);

  useEffect(()=>{
    if(!user) return;
    api("/signals").then(d=>{ if(d.signals?.length) setSigs(d.signals); }).catch(()=>{});
    api("/indices").then(d=>{ if(d.indices?.length) setIdxs(d.indices); }).catch(()=>{});
    api("/signals/equity?top=15").then(d=>{
      if(d.signals?.length) setSigs(prev=>[...d.signals,...prev.filter(s=>s.market!=="EQUITY")].slice(0,300));
    }).catch(()=>{});
  },[user]);

  useEffect(()=>{
    if(!user) return;
    const iv=setInterval(()=>{
      api("/indices").then(d=>{
        if(d.indices?.length) setIdxs(prev=>d.indices.map((idx,i)=>({
          ...idx,_flash:(prev[i]?.ltp||0)<idx.ltp?"flash-up":(prev[i]?.ltp||0)>idx.ltp?"flash-dn":"",_ts:Date.now(),
        })));
      }).catch(()=>{});
    },15000);
    return()=>clearInterval(iv);
  },[user]);

  useEffect(()=>{
    if(!user) return;
    const iv=setInterval(()=>{
      api("/signals/equity?top=15").then(d=>{
        if(d.signals?.length) setSigs(prev=>[...d.signals,...prev.filter(s=>s.market!=="EQUITY")].slice(0,300));
      }).catch(()=>{});
    },45000);
    return()=>clearInterval(iv);
  },[user]);

  if(!user) return <Login onLogin={u=>setUser(u)}/>;

  const IST=clock.toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour12:false});
  const IST_MS=("00"+clock.getMilliseconds()).slice(-3).slice(0,1);
  const rCol=!regime?"var(--muted)":regime.vix<15?"var(--grn)":regime.vix<22?"var(--yel)":"var(--red)";
  const bull=signals.filter(s=>["BUY","BULL","LONG"].some(k=>s.direction?.toUpperCase().includes(k))).length;
  const bear=signals.filter(s=>["SELL","BEAR","SHORT","EXIT"].some(k=>s.direction?.toUpperCase().includes(k))).length;
  const neut=signals.length-bull-bear;
  const pcrCount=signals.filter(s=>(s.strategy||"").toUpperCase().includes("PCR")||s.source==="pcr_strategy").length;
  const foCount=signals.filter(s=>s.market==="FO"||(s.market&&s.market!=="EQUITY")).length;

  // FIX: SEPARATE market filter from dropdown toggle
  // Click on market label -> set filter (mkt), also open that market's dropdown if not already open
  // Click on chevron -> toggle dropdown only, don't change filter
  const selectMarket = m => {
    setMkt(m);
    setStrat(null);
    setTab("signals"); // always show signals when market is selected
    if (m !== "ALL") setOpenMkt(m); // auto-open dropdown for selected market
    else setOpenMkt(null);
  };
  const toggleDropdown = m => {
    setOpenMkt(prev => prev === m ? null : m);
  };
  const selectStrategy = s => {
    setStrat(prev => prev === s ? null : s);
    setTab("signals");
  };

  const TABS=[
    {id:"signals",lbl:`Signals (${signals.length})`},
    {id:"trades",lbl:"Trades"},
    {id:"paper",lbl:"Paper Trade"},
    {id:"analytics",lbl:"Analytics"},
    {id:"subscription",lbl:"Subscription"},
  ];

  return(
    <><style>{CSS}</style>
    <div className="app">
      <aside className="sidebar">
        <div className="sb-logo">
          <div className="logo-t">ALGOTRADE</div>
          <div className="logo-s">NSE SIGNAL PLATFORM v4</div>
        </div>
        <nav className="sb-nav">
          <div className="nav-sect">Navigate</div>
          {[
            {id:"signals",ico:"◈",lbl:"Live Signals"},
            {id:"trades",ico:"⊕",lbl:"My Trades"},
            {id:"paper",ico:"📄",lbl:"Paper Trade"},
            {id:"analytics",ico:"◇",lbl:"Analytics"},
            {id:"subscription",ico:"★",lbl:"Subscription"},
          ].map(n=>(
            <div key={n.id} className={`nav-it ${tab===n.id?"act":""}`} onClick={()=>setTab(n.id)}>
              <span className="nav-ico">{n.ico}</span>{n.lbl}
            </div>
          ))}

          <div className="nav-sect">Markets</div>
          {MARKETS.map(m=>(
            <div key={m.id}>
              <div className={`mkt-btn ${mkt===m.id?"act":""}`}>
                {/* Label area: click to SET FILTER */}
                <div className="mkt-label-area" onClick={()=>selectMarket(m.id)}>
                  <div className="mkt-badge" style={{background:m.color+"20",color:m.color}}>{m.icon}</div>
                  <span className="mkt-name" style={{color:mkt===m.id?m.color:undefined}}>
                    {m.label}
                    {/* signal count badge next to market name */}
                    {m.id!=="ALL"&&(
                      ()=>{
                        const cnt=signals.filter(s=>matchesMarket(s,m.id)).length;
                        return cnt>0?(
                          <span style={{marginLeft:4,fontSize:8,background:m.color+"20",color:m.color,padding:"1px 5px",borderRadius:3}}>{cnt}</span>
                        ):null;
                      }
                    )()}
                  </span>
                </div>
                {/* Chevron: click to TOGGLE DROPDOWN only */}
                {m.id!=="ALL"&&(
                  <div className="mkt-chev-btn" onClick={e=>{e.stopPropagation();toggleDropdown(m.id);}}>
                    <span className={`chev ${openMkt===m.id?"open":""}`}>▾</span>
                  </div>
                )}
              </div>

              {/* Strategy sub-list — visible when this market's dropdown is open */}
              {openMkt===m.id&&m.strategies&&(
                <div className="strat-list">
                  {m.strategies.map(s=>{
                    const k=skey(s); const info=STRAT_INFO[k]||{color:m.color};
                    const isActive=strat===s;
                    // count signals matching this market + strategy
                    const cnt=signals.filter(sg=>matchesMarket(sg,m.id)&&matchesStrategy(sg,s)).length;
                    return(
                      <div key={s} className={`strat-it ${isActive?"act":""}`} onClick={()=>selectStrategy(s)}>
                        <div className="s-dot" style={{background:isActive?info.color:"var(--br)"}}/>
                        <span style={{flex:1}}>{s}</span>
                        {cnt>0&&<span style={{fontSize:8,fontFamily:"var(--mono)",color:info.color,background:info.color+"18",padding:"1px 5px",borderRadius:3}}>{cnt}</span>}
                        <span style={{fontSize:7,color:info.color,fontFamily:"var(--mono)",marginLeft:2}}>{info.tag}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          <div className="nav-sect">Data Sources</div>
          <div className="feed-row feed-ok">◉ NSE Direct API</div>
          <div className="feed-row feed-ok">◉ MultiTrade Feed (.xls)</div>
          <div className="feed-row" style={{color:"#22c55e"}}>◉ NSE OI PCR Feed</div>
          <div style={{marginTop:"auto",padding:"12px 8px",borderTop:"1px solid var(--br)"}}>
            <div className="nav-it" onClick={()=>{localStorage.removeItem("tok");setUser(null);}}>
              <span className="nav-ico">↩</span>Logout
            </div>
          </div>
        </nav>
      </aside>

      <div className="main">
        <IndexTicker indices={indices}/>
        <header className="topbar">
          <div className="regime-pill">
            <div className="pulse" style={{background:rCol}}/>
            <span style={{color:rCol,fontWeight:700,fontSize:11}}>{regime?.regime||"LOADING REGIME…"}</span>
          </div>
          <div className="src-pill">
            <div className="pulse" style={{background:"var(--grn)",width:5,height:5}}/>
            NSE Direct + MultiTrade + PCR
          </div>
          <div className="topbar-right">
            {regime?.vix!=null&&<div className="badge" style={{color:rCol}}>VIX {regime.vix}</div>}
            {pcrCount>0&&<div className="badge" style={{color:"#22c55e",borderColor:"rgba(34,197,94,.2)"}}>PCR {pcrCount}</div>}
            <div className="badge" style={{display:"flex",alignItems:"center",gap:5,
              color:wsStatus==="live"?"var(--grn)":wsStatus==="connecting"?"var(--yel)":"var(--red)"}}>
              {wsStatus==="live"?<><span style={{width:6,height:6,borderRadius:"50%",background:"var(--grn)",display:"inline-block",animation:"pulse 1s infinite"}}/>LIVE</>
               :wsStatus==="connecting"?"◌ CONN…":"⚠ RECONN"}
            </div>
            <div className="badge" style={{color:"var(--muted)",fontVariantNumeric:"tabular-nums"}}>
              <span className="live-dot"/>
              {IST}<span style={{color:"var(--acc)",fontWeight:700}}>.{IST_MS}</span> IST
            </div>
          </div>
        </header>

        <div className="tabs">
          {TABS.map(t=>(
            <div key={t.id} className={`tab ${tab===t.id?"act":""}`} onClick={()=>setTab(t.id)}>{t.lbl}</div>
          ))}
          {tab==="signals"&&signals.length>0&&(
            <div className="tab-right">
              <span className="count-pill" style={{background:"rgba(0,255,157,.08)",color:"var(--grn)"}}>▲ {bull}</span>
              <span className="count-pill" style={{background:"rgba(255,61,90,.08)",color:"var(--red)"}}>▼ {bear}</span>
              <span className="count-pill" style={{background:"rgba(0,212,255,.08)",color:"var(--acc)"}}>◆ {neut}</span>
            </div>
          )}
        </div>

        <div className="content">
          {tab==="signals"&&(
            <>
              <div className="stats-grid" style={{marginBottom:16}}>
                {[
                  {l:"Total Signals",  v:signals.length,   c:"var(--acc)"},
                  {l:"F&O Signals",    v:foCount,          c:"var(--grn)"},
                  {l:"PCR Signals",    v:pcrCount,         c:"#22c55e"},
                  {l:"Equity Signals", v:signals.filter(s=>s.market==="EQUITY").length, c:"var(--pur)"},
                ].map((s,i)=>(
                  <div key={i} className="stat-card">
                    <div className="stat-lbl">{s.l}</div>
                    <div className="stat-val" style={{color:s.c,fontSize:20}}>{s.v}</div>
                    {i===0&&<div className="stat-sub">{mkt!=="ALL"?mkt:"All markets"}{strat?" · "+strat:""}</div>}
                  </div>
                ))}
              </div>
              <SignalsTab
                signals={signals} market={mkt} strategy={strat} indices={indices}
                onClearStrategy={()=>setStrat(null)}
              />
            </>
          )}
          {tab==="analytics"   &&<AnalyticsTab/>}
          {tab==="trades"      &&<TradesTab/>}
          {tab==="paper"       &&<PaperTab/>}
          {tab==="subscription"&&<SubscriptionTab user={user}/>}
        </div>
      </div>
    </div>
    </>
  );
}
