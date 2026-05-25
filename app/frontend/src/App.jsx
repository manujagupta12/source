import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const API = "http://localhost:8000";
const WS  = "ws://localhost:8000/ws/signals";

const MARKETS = [
  { id:"ALL",       label:"All Markets",    icon:"\u229e", color:"#00d4ff" },
  { id:"NIFTY",     label:"NIFTY 50 F&O",  icon:"N", color:"#00ff9d",
    strategies:["S1 Calendar Spread","S2 Iron Condor","S3 Short Straddle","S4 0DTE Scalp"] },
  { id:"BANKNIFTY", label:"BANK NIFTY F&O",icon:"B", color:"#f5c518",
    strategies:["S1 Calendar Spread","S2 Iron Condor","S3 Short Straddle","S4 0DTE Scalp"] },
  { id:"FINNIFTY",  label:"FIN NIFTY F&O", icon:"F", color:"#ff6b35",
    strategies:["S1 Calendar Spread","S2 Iron Condor"] },
  // FIX: added FO market so calendar signals are filterable
  { id:"EQUITY",    label:"NSE Equity",    icon:"E", color:"#a78bfa",
    strategies:["E1 EMA Crossover","E2 VWAP Reversion","E3 ORB Breakout","E4 Gap Fill"] },
];

const STRAT_INFO = {
  S1:{color:"#00d4ff",tag:"NEUTRAL"}, S2:{color:"#00ff9d",tag:"NEUTRAL"},
  S3:{color:"#f5c518",tag:"NEUTRAL"}, S4:{color:"#ff6b35",tag:"EXPIRY"},
  S5:{color:"#22c55e",tag:"BULLISH"}, S6:{color:"#ef4444",tag:"BEARISH"},
  E1:{color:"#a78bfa",tag:"MOMENTUM"},E2:{color:"#fb923c",tag:"MEAN REV"},
  E3:{color:"#38bdf8",tag:"BREAKOUT"},E4:{color:"#e879f9",tag:"GAP FILL"},
  E5:{color:"#facc15",tag:"MOMENTUM"},
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
.sidebar{width:228px;min-width:228px;background:var(--s1);border-right:1px solid var(--br);display:flex;flex-direction:column;overflow-y:auto}
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
.mkt-btn{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:7px;cursor:pointer;font-size:12px;transition:all .12s;margin-bottom:1px;border:1px solid transparent}
.mkt-btn:hover{background:var(--s2)}
.mkt-btn.act{background:rgba(0,212,255,.07);border-color:rgba(0,212,255,.12)}
.mkt-badge{width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;font-family:var(--mono);flex-shrink:0}
.mkt-name{font-size:11px;font-weight:500;flex:1}
.chev{font-size:7px;color:var(--dim);transition:transform .18s}
.chev.open{transform:rotate(180deg)}
.strat-list{padding:3px 6px 3px 30px}
.strat-it{display:flex;align-items:center;gap:7px;padding:4px 8px;border-radius:5px;cursor:pointer;font-size:10px;color:var(--muted);transition:all .12s}
.strat-it:hover{background:var(--s2);color:var(--text)}
.strat-it.act{color:var(--text)}
.s-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.feed-row{display:flex;align-items:center;gap:6px;font-size:9px;font-family:var(--mono);padding:3px 8px;color:var(--muted)}
.feed-ok{color:var(--grn)}
.tabs{display:flex;gap:2px;background:var(--s1);border-bottom:1px solid var(--br);padding:0 18px;flex-shrink:0}
.tab{padding:13px 16px;font-size:12px;font-weight:500;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;transition:all .12s;white-space:nowrap}
.tab.act{color:var(--acc);border-bottom-color:var(--acc)}
.tab:hover:not(.act){color:var(--text)}
.tab-right{margin-left:auto;display:flex;align-items:center;gap:12px;padding:0 4px}
.count-pill{font-size:10px;font-family:var(--mono);padding:2px 8px;border-radius:10px}
.content{flex:1;overflow-y:auto;padding:18px}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.stat-card{background:var(--s1);border:1px solid var(--br);border-radius:10px;padding:14px 16px}
.stat-lbl{font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px}
.stat-val{font-family:var(--mono);font-size:20px;font-weight:700}
.stat-sub{font-size:10px;color:var(--muted);margin-top:3px}
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
@media(max-width:1200px){.stats-grid{grid-template-columns:repeat(2,1fr)}.idx-strip{grid-template-columns:repeat(2,1fr)}}
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
function chgColor(c){ return c>0?"var(--grn)":c<0?"var(--red)":"var(--muted)"; }
function chgClass(c){ return c>0?"tick-up":c<0?"tick-dn":"tick-unch"; }
function matchesMarket(sig, market) {
  if (market === "ALL") return true;
  if (market === "EQUITY") return sig.market === "EQUITY";
  // NIFTY/BANKNIFTY/FINNIFTY: match by instrument field, not market field
  const inst = (sig.instrument || sig.symbol || "").toUpperCase();
  return inst === market;
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
        <div className="meta-box"><div className="meta-k">Target pts</div><div className="meta-v" style={{color:"var(--grn)"}}>{sig.target_pts||"—"}</div></div>
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

// FIX: updated FoCard to render calendar algo signals (market="FO")
function FoCard({sig}){
  const k    = skey(sig.strategy);
  const info = STRAT_INFO[k]||{color:"var(--acc)",tag:"NEUTRAL"};
  const spread = sig.spread??sig.entry_spread;
  const isCalendar = sig.strategy?.toUpperCase().includes("CALENDAR");
  return(
    <div className={`sig-card ${sigClass(sig.direction)}`}>
      <div className="sig-top">
        <div>
          <div className="sig-strat" style={{color:info.color}}>{sig.strategy}</div>
          <div className="sig-tags">
            <span className="sig-tag" style={{background:"rgba(0,212,255,.12)",color:"var(--acc)",border:"1px solid rgba(0,212,255,.2)"}}>
              {isCalendar?"CALENDAR":sig.market||"FO"}
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

// FIX: SignalsTab now correctly routes FO/calendar signals
function SignalsTab({signals,market,strategy,indices}){
const filtered = signals
  .filter(s => matchesMarket(s, market))
  .filter(s => {
    if(!strategy) return true;
    return s.strategy?.toUpperCase().includes(strategy.split(" ")[0].toUpperCase());
  });

  const foCount=signals.filter(s=>s.market==="FO"||(!s.market&&s.strategy?.toUpperCase().includes("CALENDAR"))).length;

  return(
    <div>
      <IndexStrip indices={indices}/>
      {market==="ALL"&&<MoversPanel/>}
      {market==="FO"&&foCount===0&&(
        <div className="empty">
          <div className="empty-ico">📅</div>
          <div className="empty-t">No F&amp;O Calendar signals yet</div>
          <div className="empty-s">Start Calendaralgofinal.py — signals will appear here in real time</div>
        </div>
      )}
      {filtered.length>0?(
        <div className="sigs-grid">
          {filtered.map((s,i)=><SigCard key={s.id||`${s.timestamp}-${i}`} sig={s}/>)}
        </div>
      ):(market!=="FO"||foCount>0)?(
        <div className="empty">
          <div className="empty-ico">📊</div>
          <div className="empty-t">No signals for this filter</div>
          <div className="empty-s">{market!=="ALL"?`${market} signals appear during market hours (9:15–15:30)`:"Waiting for NSE data — signals refresh every 30s"}</div>
        </div>
      ):null}
    </div>
  );
}

function AnalyticsTab(){
  const [pnl,setPnl]=useState(null);
  useEffect(()=>{api("/analytics/pnl").then(setPnl).catch(()=>{});},[]);
  const byS=pnl?.by_strategy||{};
  const chart=Object.entries(byS).map(([k,v])=>({
    name:k.replace(/^[SE]\d\s/,"").slice(0,12),
    pnl:Math.round(v.total_pnl||0),
  }));
  return(
    <div>
      <div className="stats-grid">
        {[
          {l:"Total P&L",    v:`₹${fmt(pnl?.total_pnl||0,0)}`,    c:(pnl?.total_pnl||0)>=0?"var(--grn)":"var(--red)"},
          {l:"Total Trades", v:pnl?.total_trades||0,                c:"var(--acc)"},
          {l:"Winners",      v:pnl?.winning_trades||0,              c:"var(--grn)"},
          {l:"Win Rate",     v:pnl?.total_trades?Math.round((pnl.winning_trades/pnl.total_trades)*100)+"%":"—",c:"var(--yel)"},
        ].map((s,i)=>(
          <div key={i} className="stat-card">
            <div className="stat-lbl">{s.l}</div>
            <div className="stat-val" style={{color:s.c,fontSize:18}}>{s.v}</div>
          </div>
        ))}
      </div>
      {chart.length>0&&(
        <div className="card" style={{marginBottom:16}}>
          <div className="card-lbl">P&amp;L by Strategy</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chart} margin={{top:8,right:16,bottom:8,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--br)"/>
              <XAxis dataKey="name" tick={{fontSize:8,fill:"var(--muted)"}}/>
              <YAxis tick={{fontSize:8,fill:"var(--muted)"}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
              <Tooltip contentStyle={{background:"var(--s2)",border:"1px solid var(--br)",borderRadius:7,fontSize:11}}
                formatter={v=>[`₹${Number(v).toLocaleString("en-IN")}`, "P&L"]}/>
              <Bar dataKey="pnl" fill="var(--acc)" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {!chart.length&&(
        <div className="empty"><div className="empty-ico">📈</div>
          <div className="empty-t">No closed trades yet</div>
        </div>
      )}
    </div>
  );
}

function TradesTab(){
  const [tr,setTr]=useState({open_trades:[],closed_trades:[],total_pnl:0});
  useEffect(()=>{api("/trades").then(setTr).catch(()=>{});},[]);
  const open=tr.open_trades||[];
  return(
    <div>
      <div className="stats-grid">
        {[
          {l:"Total P&L",   v:`₹${fmt(tr.total_pnl||0,0)}`, c:(tr.total_pnl||0)>=0?"var(--grn)":"var(--red)"},
          {l:"Open Trades", v:tr.open_count||open.length,    c:"var(--yel)"},
          {l:"Closed",      v:tr.closed_count||0,            c:"var(--acc)"},
        ].map((s,i)=>(
          <div key={i} className="stat-card">
            <div className="stat-lbl">{s.l}</div>
            <div className="stat-val" style={{color:s.c,fontSize:18}}>{s.v}</div>
          </div>
        ))}
      </div>
      {!open.length&&(
        <div className="empty"><div className="empty-ico">📋</div>
          <div className="empty-t">No trades logged yet</div>
          <div className="empty-s">Signals tab → copy action → log trade</div>
        </div>
      )}
    </div>
  );
}

export default function App(){
  const [user,setUser]      =useState(()=>localStorage.getItem("tok")?{tok:true}:null);
  const [signals,setSigs]   =useState([]);
  const [regime,setRegime]  =useState(null);
  const [indices,setIdxs]   =useState([]);
  const [mkt,setMkt]        =useState("ALL");
  const [strat,setStrat]    =useState(null);
  const [openMkt,setOpenMkt]=useState(null);
  const [tab,setTab]        =useState("signals");
  const [wsStatus,setWsSt]  =useState("connecting");
  const [clock,setClock]    =useState(new Date());
  const wsRef=useRef(null);

  useEffect(()=>{const t=setInterval(()=>setClock(new Date()),100);return()=>clearInterval(t);},[]);

  // WebSocket
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

          // F&O + calendar signals (single)
          if(d.type==="signal"&&d.data){
            setSigs(prev=>[d.data,...prev].slice(0,300));
            if(d.data.regime) setRegime(r=>({...r,regime:d.data.regime,vix:d.data.vix}));
            return;
          }

          // Equity signals batch
          if(d.type==="equity_signals"&&d.signals?.length){
            setSigs(prev=>[...d.signals,...prev.filter(s=>s.market!=="EQUITY")].slice(0,300));
            return;
          }

          // FIX: live index push from signal_loop every 10s
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

  // Initial REST fetch
  useEffect(()=>{
    if(!user) return;
    api("/signals").then(d=>{ if(d.signals?.length) setSigs(d.signals); }).catch(()=>{});
    api("/indices").then(d=>{ if(d.indices?.length) setIdxs(d.indices); }).catch(()=>{});
    api("/signals/equity?top=15").then(d=>{
      if(d.signals?.length) setSigs(prev=>[...d.signals,...prev.filter(s=>s.market!=="EQUITY")].slice(0,300));
    }).catch(()=>{});
  },[user]);

  // FIX: Index REST polling every 15s (fallback when WS not pushing)
  useEffect(()=>{
    if(!user) return;
    const iv=setInterval(()=>{
      api("/indices").then(d=>{
        if(d.indices?.length) setIdxs(prev=>d.indices.map((idx,i)=>({
          ...idx,
          _flash:(prev[i]?.ltp||0)<idx.ltp?"flash-up":(prev[i]?.ltp||0)>idx.ltp?"flash-dn":"",
          _ts:Date.now(),
        })));
      }).catch(()=>{});
    },15000);
    return()=>clearInterval(iv);
  },[user]);

  // Equity refresh every 45s
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
  const foCount=signals.filter(s=>s.market==="FO"||(!s.market&&s.strategy?.toUpperCase().includes("CALENDAR"))).length;

  const selMkt=m=>{setMkt(m);setStrat(null);setOpenMkt(openMkt===m?null:m);};
  const selStrat=s=>{setStrat(strat===s?null:s);};

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
          {[{id:"signals",ico:"◈",lbl:"Live Signals"},{id:"trades",ico:"⊕",lbl:"My Trades"},{id:"analytics",ico:"◇",lbl:"Analytics"}].map(n=>(
            <div key={n.id} className={`nav-it ${tab===n.id?"act":""}`} onClick={()=>setTab(n.id)}>
              <span className="nav-ico">{n.ico}</span>{n.lbl}
            </div>
          ))}
          <div className="nav-sect">Markets</div>
          {MARKETS.map(m=>(
            <div key={m.id}>
              <div className={`mkt-btn ${mkt===m.id?"act":""}`} onClick={()=>selMkt(m.id)}>
                <div className="mkt-badge" style={{background:m.color+"20",color:m.color}}>{m.icon}</div>
                <span className="mkt-name" style={{color:mkt===m.id?m.color:undefined}}>
                  {m.label}
                  {m.id==="FO"&&foCount>0&&(
                    <span style={{marginLeft:5,fontSize:8,background:"rgba(0,212,255,.15)",color:"var(--acc)",padding:"1px 5px",borderRadius:3}}>{foCount}</span>
                  )}
                </span>
                {m.id!=="ALL"&&<span className={`chev ${openMkt===m.id?"open":""}`}>▾</span>}
              </div>
              {openMkt===m.id&&m.strategies&&(
                <div className="strat-list">
                  {m.strategies.map(s=>{
                    const k=skey(s); const info=STRAT_INFO[k]||{color:m.color};
                    return(
                      <div key={s} className={`strat-it ${strat===s?"act":""}`} onClick={()=>selStrat(s)}>
                        <div className="s-dot" style={{background:strat===s?info.color:"var(--br)"}}/>
                        <span style={{flex:1}}>{s}</span>
                        <span style={{fontSize:7,color:info.color,fontFamily:"var(--mono)"}}>{info.tag}</span>
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
            NSE Direct + MultiTrade
          </div>
          <div className="topbar-right">
            {regime?.vix!=null&&<div className="badge" style={{color:rCol}}>VIX {regime.vix}</div>}
            <div className={`badge`} style={{display:"flex",alignItems:"center",gap:5,color:wsStatus==="live"?"var(--grn)":wsStatus==="connecting"?"var(--yel)":"var(--red)"}}>
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
          {[{id:"signals",lbl:`Signals (${signals.length})`},{id:"trades",lbl:"Trades"},{id:"analytics",lbl:"Analytics"}].map(t=>(
            <div key={t.id} className={`tab ${tab===t.id?"act":""}`} onClick={()=>setTab(t.id)}>{t.lbl}</div>
          ))}
          {tab==="signals"&&signals.length>0&&(
            <div className="tab-right">
              <span className="count-pill" style={{background:"rgba(0,255,157,.08)",color:"var(--grn)"}}>▲ {bull}</span>
              <span className="count-pill" style={{background:"rgba(255,61,90,.08)", color:"var(--red)"}}>▼ {bear}</span>
              <span className="count-pill" style={{background:"rgba(0,212,255,.08)", color:"var(--acc)"}}>◆ {neut}</span>
            </div>
          )}
        </div>

        <div className="content">
          {tab==="signals"&&(
            <>
              <div className="stats-grid" style={{marginBottom:16}}>
                {[
                  {l:"Total Signals",    v:signals.length,                                    c:"var(--acc)"},
                  {l:"F&O Signals",      v:signals.filter(s=>s.market!=="EQUITY").length,     c:"var(--grn)"},
                  {l:"Calendar Signals", v:foCount,                                            c:"var(--acc)"},
                  {l:"Equity Signals",   v:signals.filter(s=>s.market==="EQUITY").length,     c:"var(--pur)"},
                ].map((s,i)=>(
                  <div key={i} className="stat-card">
                    <div className="stat-lbl">{s.l}</div>
                    <div className="stat-val" style={{color:s.c,fontSize:20}}>{s.v}</div>
                    {i===0&&<div className="stat-sub">{mkt!=="ALL"?mkt:"All markets"}</div>}
                  </div>
                ))}
              </div>
              <SignalsTab signals={signals} market={mkt} strategy={strat} indices={indices}/>
            </>
          )}
          {tab==="analytics"&&<AnalyticsTab/>}
          {tab==="trades"   &&<TradesTab/>}
        </div>
      </div>
    </div>
    </>
  );
}