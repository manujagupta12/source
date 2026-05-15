import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ════════════════════════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════════════════════════
const API = "http://localhost:8000";
const WS  = "ws://localhost:8000/ws/signals";

const RISK_COLORS = { LOW:"#00ff9d", MEDIUM:"#f5c518", HIGH:"#ff6b35", EXTREME:"#ff1744" };
const STRAT_COLORS = ["#00d4ff","#00ff9d","#f5c518","#ff6b35","#b388ff","#ff4081","#69f0ae"];

const useApi = (token) => {
  const get  = useCallback((path) =>
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }}).then(r=>r.json()), [token]);
  const post = useCallback((path, body) =>
    fetch(`${API}${path}`, { method:"POST", headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` }, body: JSON.stringify(body) }).then(r=>r.json()), [token]);
  return { get, post };
};

// ════════════════════════════════════════════════════════════════
//  GLOBAL STYLES
// ════════════════════════════════════════════════════════════════
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:       #080c14;
      --bg2:      #0d1421;
      --bg3:      #111c2e;
      --border:   #1e3050;
      --text:     #c8d8f0;
      --muted:    #4a6080;
      --accent:   #00d4ff;
      --green:    #00ff9d;
      --yellow:   #f5c518;
      --orange:   #ff6b35;
      --red:      #ff1744;
      --purple:   #b388ff;
      --font-mono: 'Space Mono', monospace;
      --font-head: 'Syne', sans-serif;
    }

    html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font-mono); }

    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: var(--bg2); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

    .glow-accent { box-shadow: 0 0 20px rgba(0,212,255,0.15); }
    .glow-green  { box-shadow: 0 0 20px rgba(0,255,157,0.15); }

    @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
    @keyframes slide-in  { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fade-in   { from{opacity:0} to{opacity:1} }
    @keyframes shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

    .animate-in  { animation: slide-in .25s ease forwards; }
    .fade-in     { animation: fade-in .4s ease forwards; }

    .card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 20px;
    }

    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 20px; border-radius: 4px; border: none;
      font-family: var(--font-mono); font-size: 12px; font-weight: 700;
      cursor: pointer; transition: all .15s ease; letter-spacing: .05em;
      text-transform: uppercase;
    }
    .btn-primary { background: var(--accent); color: #000; }
    .btn-primary:hover { background: #00eeff; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0,212,255,.4); }
    .btn-ghost { background: transparent; color: var(--accent); border: 1px solid var(--border); }
    .btn-ghost:hover { border-color: var(--accent); background: rgba(0,212,255,.05); }
    .btn-green { background: var(--green); color: #000; }
    .btn-green:hover { background: #00ffb3; }
    .btn-red { background: var(--red); color: #fff; }
    .btn-red:hover { background: #ff4060; }
    .btn-sm { padding: 6px 12px; font-size: 11px; }

    input, select, textarea {
      background: var(--bg3); border: 1px solid var(--border);
      color: var(--text); padding: 10px 14px; border-radius: 4px;
      font-family: var(--font-mono); font-size: 13px; width: 100%;
      transition: border-color .15s;
    }
    input:focus, select:focus, textarea:focus {
      outline: none; border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(0,212,255,.1);
    }
    label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; display: block; margin-bottom: 6px; }

    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; color: var(--muted); padding: 10px 12px; border-bottom: 1px solid var(--border); text-transform: uppercase; font-size: 10px; letter-spacing: .1em; }
    td { padding: 10px 12px; border-bottom: 1px solid rgba(30,48,80,.5); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(0,212,255,.03); }

    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 3px;
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
    }
    .badge-low    { background: rgba(0,255,157,.15); color: var(--green); border: 1px solid rgba(0,255,157,.3); }
    .badge-medium { background: rgba(245,197,24,.15); color: var(--yellow); border: 1px solid rgba(245,197,24,.3); }
    .badge-high   { background: rgba(255,107,53,.15); color: var(--orange); border: 1px solid rgba(255,107,53,.3); }
    .badge-extreme{ background: rgba(255,23,68,.15); color: var(--red); border: 1px solid rgba(255,23,68,.3); }
    .badge-open   { background: rgba(0,212,255,.15); color: var(--accent); border: 1px solid rgba(0,212,255,.3); }
    .badge-closed { background: rgba(74,96,128,.15); color: var(--muted); border: 1px solid var(--border); }

    .mono { font-family: var(--font-mono); }
    .pnl-pos { color: var(--green); }
    .pnl-neg { color: var(--red); }

    .modal-bg {
      position: fixed; inset: 0; background: rgba(0,0,0,.8);
      backdrop-filter: blur(4px); display: flex; align-items: center;
      justify-content: center; z-index: 1000;
    }
    .modal {
      background: var(--bg2); border: 1px solid var(--border);
      border-radius: 8px; padding: 32px; width: 480px; max-width: 95vw;
      animation: slide-in .2s ease;
    }
  `}</style>
);

// ════════════════════════════════════════════════════════════════
//  LIVE DOT
// ════════════════════════════════════════════════════════════════
const LiveDot = ({ color = "#00ff9d", size = 8 }) => (
  <span style={{ display:"inline-block", width:size, height:size, borderRadius:"50%",
    background:color, animation:"pulse-dot 1.5s ease infinite" }} />
);

// ════════════════════════════════════════════════════════════════
//  REGIME WIDGET
// ════════════════════════════════════════════════════════════════
const REGIME_META = {
  "R1 DEAD MARKET":       { color:"#ff6b35", icon:"💀", advice:"Do NOT trade calendars. Wait or use Iron Fly." },
  "R2 SIDEWAYS LOW":      { color:"#00ff9d", icon:"✅", advice:"Ideal for Calendar + Iron Condor. Full size." },
  "R3 SIDEWAYS HIGH IV":  { color:"#f5c518", icon:"📊", advice:"Sell premium. Short Straddle + Iron Condor." },
  "R4 TRENDING BULL":     { color:"#00d4ff", icon:"📈", advice:"Buy CE / Bull Call Spread. Avoid IC." },
  "R5 TRENDING BEAR":     { color:"#b388ff", icon:"📉", advice:"Buy PE / Bear Put Spread. Avoid IC." },
  "R6 HIGH VOLATILITY":   { color:"#ff6b35", icon:"⚡", advice:"Buy vol. Delta hedge. 50% size only." },
  "R7 EXPIRY WEEK":       { color:"#f5c518", icon:"⏰", advice:"0DTE straddle. EXIT by 3:20 PM." },
  "R8 EXTREME PANIC":     { color:"#ff1744", icon:"🚨", advice:"STOP. Close all shorts. Wait for VIX < 20." },
};

const RegimeWidget = ({ regime, vix }) => {
  const meta = REGIME_META[regime] || { color:"#4a6080", icon:"❓", advice:"Detecting..." };
  return (
    <div className="card" style={{ borderColor: meta.color + "40", borderWidth:2 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <span style={{ fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em" }}>Market Regime</span>
        <LiveDot color={meta.color} size={10} />
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
        <span style={{ fontSize:28 }}>{meta.icon}</span>
        <div>
          <div style={{ fontFamily:"var(--font-head)", fontSize:16, fontWeight:700, color: meta.color }}>{regime || "DETECTING..."}</div>
          <div style={{ fontSize:11, color:"var(--muted)" }}>VIX: {vix?.toFixed(2) || "—"}</div>
        </div>
      </div>
      <div style={{ background:"rgba(255,255,255,.03)", borderRadius:4, padding:"10px 12px", fontSize:12, color:"var(--text)", borderLeft:`3px solid ${meta.color}` }}>
        {meta.advice}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
//  SIGNAL CARD
// ════════════════════════════════════════════════════════════════
const SignalCard = ({ signal, onLog }) => {
  const [expanded, setExpanded] = useState(false);
  const riskKey = signal.risk?.toLowerCase() || "medium";
  const scoreColor = signal.score >= 80 ? "#00ff9d" : signal.score >= 60 ? "#f5c518" : "#ff6b35";

  return (
    <div className="card animate-in" style={{ marginBottom:8, cursor:"pointer" }} onClick={() => setExpanded(e => !e)}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        {/* Score ring */}
        <div style={{ width:44, height:44, borderRadius:"50%", border:`2px solid ${scoreColor}`,
          display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <span style={{ fontSize:12, fontWeight:700, color:scoreColor }}>{signal.score}</span>
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <span style={{ fontFamily:"var(--font-head)", fontWeight:700, fontSize:13 }}>{signal.strategy}</span>
            <span className={`badge badge-${riskKey}`}>{signal.risk}</span>
            <span style={{ fontSize:11, color: signal.direction==="LONG" ? "var(--green)" : "var(--red)", fontWeight:700 }}>{signal.direction}</span>
          </div>
          <div style={{ fontSize:11, color:"var(--muted)" }}>
            Strike {signal.near_strike} / {signal.far_strike} · Spread: <span style={{ color:"var(--text)" }}>{signal.spread > 0 ? "+" : ""}{signal.spread}</span>
            · Fair: {signal.fair_value > 0 ? "+" : ""}{signal.fair_value}
          </div>
        </div>

        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:11, color:"var(--muted)" }}>{new Date(signal.timestamp).toLocaleTimeString()}</div>
          <span style={{ fontSize:10, color:"var(--accent)" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid var(--border)" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
            <div>
              <label>Near {signal.option_type || "CE"} {signal.near_strike}</label>
              <div style={{ display:"flex", gap:16, fontSize:13 }}>
                <span>Bid <span style={{ color:"var(--red)" }}>{signal.near_bid}</span></span>
                <span>Ask <span style={{ color:"var(--green)" }}>{signal.near_ask}</span></span>
              </div>
            </div>
            <div>
              <label>Far {signal.option_type || "CE"} {signal.far_strike}</label>
              <div style={{ display:"flex", gap:16, fontSize:13 }}>
                <span>Bid <span style={{ color:"var(--red)" }}>{signal.far_bid}</span></span>
                <span>Ask <span style={{ color:"var(--green)" }}>{signal.far_ask}</span></span>
              </div>
            </div>
          </div>

          <div style={{ background:"var(--bg3)", borderRadius:4, padding:"12px 16px", marginBottom:12, fontSize:12 }}>
            <div style={{ color:"var(--muted)", marginBottom:6 }}>ORDER INSTRUCTIONS ({signal.lots_suggested} lots)</div>
            <div style={{ color:"var(--green)" }}>LEG 1 → {signal.direction === "LONG" ? "BUY" : "SELL"} Far CE {signal.far_strike} @ <strong>{signal.buy_far_at || signal.far_bid}</strong></div>
            <div style={{ color:"var(--red)", marginTop:4 }}>LEG 2 → {signal.direction === "LONG" ? "SELL" : "BUY"} Near CE {signal.near_strike} @ <strong>{signal.sell_near_at || signal.near_ask}</strong></div>
          </div>

          <div style={{ display:"flex", gap:16, fontSize:11, marginBottom:12 }}>
            <span>TARGET: <strong style={{ color:"var(--green)" }}>+{signal.target_pts}pts</strong></span>
            <span>STOP: <strong style={{ color:"var(--red)" }}>-{signal.sl_pts}pts</strong></span>
            <span>R:R: <strong style={{ color:"var(--accent)" }}>{(signal.target_pts/signal.sl_pts).toFixed(1)}:1</strong></span>
          </div>

          <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); onLog(signal); }}>
            ✓ Log This Trade
          </button>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
//  P&L TRACKER BAR
// ════════════════════════════════════════════════════════════════
const PnlBar = ({ realised, target = 50000 }) => {
  const pct = Math.min(100, (realised / target) * 100);
  const color = realised >= target ? "#00ff9d" : realised >= 0 ? "#00d4ff" : "#ff1744";
  return (
    <div className="card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:12 }}>
        <span style={{ fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em" }}>Daily P&L Target</span>
        <span style={{ fontFamily:"var(--font-head)", fontSize:22, fontWeight:800, color }}>
          ₹{Math.abs(realised).toLocaleString("en-IN")}
          <span style={{ fontSize:13, color:"var(--muted)", marginLeft:4 }}>{realised >= 0 ? "earned" : "loss"}</span>
        </span>
      </div>
      <div style={{ height:8, background:"var(--bg3)", borderRadius:4, overflow:"hidden", marginBottom:8 }}>
        <div style={{ height:"100%", width:`${Math.abs(pct)}%`, background:color, borderRadius:4,
          transition:"width .6s cubic-bezier(.4,0,.2,1)", boxShadow:`0 0 12px ${color}60` }} />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--muted)" }}>
        <span>{pct.toFixed(1)}% of ₹{target.toLocaleString("en-IN")} target</span>
        <span>Remaining: <span style={{ color:"var(--text)" }}>₹{Math.max(0, target - realised).toLocaleString("en-IN")}</span></span>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
//  LOG TRADE MODAL
// ════════════════════════════════════════════════════════════════
const LogTradeModal = ({ signal, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    strategy:     signal?.strategy || "",
    instrument:   "NIFTY",
    option_type:  "CE",
    direction:    signal?.direction || "LONG",
    near_strike:  signal?.near_strike || "",
    far_strike:   signal?.far_strike || "",
    lots:         signal?.lots_suggested || 1,
    entry_spread: signal?.spread || "",
    notes:        "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily:"var(--font-head)", fontSize:20, fontWeight:800, marginBottom:24, color:"var(--accent)" }}>
          Log Trade Entry
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
          <div><label>Strategy</label><input value={form.strategy} onChange={e=>set("strategy",e.target.value)} /></div>
          <div><label>Instrument</label>
            <select value={form.instrument} onChange={e=>set("instrument",e.target.value)}>
              <option>NIFTY</option><option>BANKNIFTY</option><option>FINNIFTY</option>
            </select>
          </div>
          <div><label>Direction</label>
            <select value={form.direction} onChange={e=>set("direction",e.target.value)}>
              <option>LONG</option><option>SHORT</option><option>SELL BOTH</option><option>BUY BOTH</option>
            </select>
          </div>
          <div><label>Type</label>
            <select value={form.option_type} onChange={e=>set("option_type",e.target.value)}>
              <option value="CE">CE</option><option value="PE">PE</option>
              <option value="IC">Iron Condor</option><option value="STRADDLE">Straddle</option>
            </select>
          </div>
          <div><label>Near Strike</label><input type="number" value={form.near_strike} onChange={e=>set("near_strike",+e.target.value)} /></div>
          <div><label>Far Strike</label><input type="number" value={form.far_strike} onChange={e=>set("far_strike",+e.target.value)} /></div>
          <div><label>Lots</label><input type="number" value={form.lots} onChange={e=>set("lots",+e.target.value)} min={1} /></div>
          <div><label>Entry Spread</label><input type="number" step="0.05" value={form.entry_spread} onChange={e=>set("entry_spread",+e.target.value)} /></div>
        </div>
        <div style={{ marginBottom:20 }}>
          <label>Notes (optional)</label>
          <input value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="e.g. Based on rank #1 signal, high score..." />
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-primary" style={{ flex:1 }} onClick={() => onSubmit(form)}>✓ Enter Trade</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
//  CLOSE TRADE MODAL
// ════════════════════════════════════════════════════════════════
const CloseTradeModal = ({ trade, onClose, onSubmit }) => {
  const [exitSpread, setExit] = useState("");
  const [notes, setNotes]     = useState("TARGET HIT");
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{ fontFamily:"var(--font-head)", fontSize:20, fontWeight:800, marginBottom:8, color:"var(--red)" }}>
          Close Trade [{trade.id}]
        </div>
        <div style={{ fontSize:12, color:"var(--muted)", marginBottom:24 }}>
          {trade.strategy} · Entry: {trade.entry_spread} · {trade.direction}
        </div>
        <div style={{ marginBottom:14 }}>
          <label>Exit Spread (actual fill price)</label>
          <input type="number" step="0.05" value={exitSpread} onChange={e=>setExit(e.target.value)} placeholder="e.g. -1.20" autoFocus />
        </div>
        <div style={{ marginBottom:20 }}>
          <label>Close Reason</label>
          <select value={notes} onChange={e=>setNotes(e.target.value)}>
            <option>TARGET HIT</option><option>STOPLOSS HIT</option>
            <option>MANUAL CLOSE</option><option>REGIME CHANGE</option><option>EOD CLOSE</option>
          </select>
        </div>
        {exitSpread && (() => {
          const ls = {NIFTY:25,BANKNIFTY:15,FINNIFTY:40}[trade.instrument]||25;
          const pnl = (trade.direction==="LONG" ? (+exitSpread - trade.entry_spread) : (trade.entry_spread - +exitSpread)) * ls * trade.lots;
          return (
            <div style={{ background:"var(--bg3)", borderRadius:4, padding:"12px 16px", marginBottom:16, fontSize:13 }}>
              Estimated P&L: <strong style={{ color: pnl>=0?"var(--green)":"var(--red)" }}>₹{Math.round(pnl).toLocaleString("en-IN")}</strong>
            </div>
          );
        })()}
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-red" style={{ flex:1 }} onClick={() => onSubmit(trade.id, +exitSpread, notes)}>Close Position</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
//  DASHBOARD PAGE
// ════════════════════════════════════════════════════════════════
const DashboardPage = ({ token, user }) => {
  const { get, post } = useApi(token);
  const [signals,   setSignals]  = useState([]);
  const [regime,    setRegime]   = useState({});
  const [todayData, setToday]    = useState({ realised_pnl:0, trades:[], daily_target:50000 });
  const [logModal,  setLogModal] = useState(null);
  const [closeModal,setCloseModal]=useState(null);
  const [connected, setConn]     = useState(false);
  const wsRef = useRef(null);

  // Load initial data
  useEffect(() => {
    get("/signals/latest?limit=20").then(d => d.signals && setSignals(d.signals));
    get("/signals/regime").then(setRegime);
    get("/trades/today").then(setToday);
  }, [get]);

  // WebSocket
  useEffect(() => {
    const ws = new WebSocket(WS);
    wsRef.current = ws;
    ws.onopen  = () => setConn(true);
    ws.onclose = () => setConn(false);
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.type === "signal")
        setSignals(prev => [msg.data, ...prev].slice(0, 30));
      if (msg.type === "regime")
        setRegime(msg);
    };
    return () => ws.close();
  }, []);

  const handleLogTrade = async (form) => {
    const res = await post("/trades/enter", form);
    if (res.trade_id) {
      setLogModal(null);
      get("/trades/today").then(setToday);
    }
  };

  const handleCloseTrade = async (id, exit, notes) => {
    await post("/trades/close", { trade_id:id, exit_spread:exit, notes });
    setCloseModal(null);
    get("/trades/today").then(setToday);
  };

  return (
    <div style={{ padding:"24px 28px" }}>
      {/* Header bar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <div style={{ fontFamily:"var(--font-head)", fontSize:24, fontWeight:800 }}>Trading Dashboard</div>
          <div style={{ fontSize:11, color:"var(--muted)" }}>
            {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
          <LiveDot color={connected?"#00ff9d":"#ff1744"} />
          <span style={{ color:"var(--muted)" }}>{connected ? "LIVE FEED" : "RECONNECTING"}</span>
          <button className="btn btn-primary btn-sm" onClick={() => setLogModal({})}>+ Log Trade</button>
        </div>
      </div>

      {/* Top row */}
      <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:16, marginBottom:16 }}>
        <RegimeWidget regime={regime.regime} vix={regime.vix} />
        <PnlBar realised={todayData.realised_pnl} target={todayData.daily_target} />
      </div>

      {/* Main content */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:16 }}>

        {/* Signals feed */}
        <div>
          <div style={{ fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
            <LiveDot size={6} /> Live Signals ({signals.length})
          </div>
          {signals.length === 0 ? (
            <div className="card" style={{ textAlign:"center", color:"var(--muted)", padding:40 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📡</div>
              Waiting for signals...
            </div>
          ) : (
            signals.slice(0, 12).map((s, i) => (
              <SignalCard key={i} signal={s} onLog={sig => setLogModal(sig)} />
            ))
          )}
        </div>

        {/* Right panel */}
        <div>
          {/* Open positions */}
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:14 }}>
              Open Positions ({todayData.trades?.filter(t=>t.status==="OPEN").length || 0})
            </div>
            {(todayData.trades?.filter(t=>t.status==="OPEN")||[]).length === 0 ? (
              <div style={{ fontSize:12, color:"var(--muted)", textAlign:"center", padding:"16px 0" }}>No open positions</div>
            ) : (
              todayData.trades.filter(t=>t.status==="OPEN").map(t => (
                <div key={t.id} style={{ padding:"10px 0", borderBottom:"1px solid var(--border)", fontSize:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <span style={{ fontWeight:700 }}>[{t.id}]</span> {t.strategy}
                      <span style={{ color: t.direction==="LONG"?"var(--green)":"var(--red)", marginLeft:8 }}>{t.direction}</span>
                    </div>
                    <button className="btn btn-red btn-sm" onClick={() => setCloseModal(t)}>Close</button>
                  </div>
                  <div style={{ color:"var(--muted)", marginTop:4 }}>
                    {t.instrument} {t.near_strike} · Entry: {t.entry_spread} · {t.lots} lot{t.lots>1?"s":""}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Closed trades today */}
          <div className="card">
            <div style={{ fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:14 }}>
              Closed Today
            </div>
            {(todayData.trades?.filter(t=>t.status==="CLOSED")||[]).slice(-6).reverse().map(t => (
              <div key={t.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid rgba(30,48,80,.4)", fontSize:12 }}>
                <div>
                  <span className="mono">[{t.id}]</span> {t.strategy?.split(" ")[0]}
                </div>
                <span style={{ color: t.pnl_inr >= 0 ? "var(--green)" : "var(--red)", fontWeight:700 }}>
                  {t.pnl_inr >= 0 ? "+" : ""}₹{Math.abs(t.pnl_inr||0).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
            {(todayData.trades?.filter(t=>t.status==="CLOSED")||[]).length === 0 && (
              <div style={{ fontSize:12, color:"var(--muted)", textAlign:"center", padding:"16px 0" }}>No closed trades yet</div>
            )}
          </div>
        </div>
      </div>

      {logModal   !== null && <LogTradeModal  signal={logModal} onClose={() => setLogModal(null)} onSubmit={handleLogTrade} />}
      {closeModal !== null && <CloseTradeModal trade={closeModal} onClose={() => setCloseModal(null)} onSubmit={handleCloseTrade} />}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
//  ANALYTICS PAGE
// ════════════════════════════════════════════════════════════════
const AnalyticsPage = ({ token }) => {
  const { get } = useApi(token);
  const [summary, setSummary] = useState(null);
  const [daily,   setDaily]   = useState([]);

  useEffect(() => {
    get("/analytics/summary").then(setSummary);
    get("/analytics/daily?days=30").then(d => setDaily(d.daily || []));
  }, [get]);

  if (!summary || summary.message)
    return (
      <div style={{ padding:"24px 28px" }}>
        <div className="card" style={{ textAlign:"center", color:"var(--muted)", padding:60 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
          <div style={{ fontFamily:"var(--font-head)", fontSize:18, marginBottom:8 }}>No trade data yet</div>
          <div>Start logging trades from the Dashboard to see analytics here.</div>
        </div>
      </div>
    );

  const stratData = Object.entries(summary.by_strategy || {}).map(([name, stats]) => ({
    name: name.split(" ")[0], ...stats,
    win_rate: Math.round(stats.wins / stats.trades * 100),
  }));

  return (
    <div style={{ padding:"24px 28px" }}>
      <div style={{ fontFamily:"var(--font-head)", fontSize:24, fontWeight:800, marginBottom:24 }}>Analytics</div>

      {/* KPI cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[
          { label:"Total Trades", value: summary.total_trades },
          { label:"Win Rate",     value: `${summary.win_rate}%`,   color: summary.win_rate >= 50 ? "#00ff9d" : "#ff6b35" },
          { label:"Total P&L",    value: `₹${(summary.total_pnl||0).toLocaleString("en-IN")}`, color: (summary.total_pnl||0) >= 0 ? "#00ff9d" : "#ff1744" },
          { label:"Avg / Trade",  value: `₹${(summary.avg_pnl||0).toLocaleString("en-IN")}`,  color: (summary.avg_pnl||0)  >= 0 ? "#00ff9d" : "#ff1744" },
        ].map(k => (
          <div key={k.label} className="card">
            <div style={{ fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:8 }}>{k.label}</div>
            <div style={{ fontFamily:"var(--font-head)", fontSize:24, fontWeight:800, color: k.color || "var(--text)" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Daily P&L chart */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:16 }}>Daily P&L (30 days)</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={daily}>
            <defs>
              <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3050" />
            <XAxis dataKey="date" tick={{ fill:"#4a6080", fontSize:10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill:"#4a6080", fontSize:10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background:"#0d1421", border:"1px solid #1e3050", borderRadius:4, fontSize:12 }}
              formatter={v => [`₹${v.toLocaleString("en-IN")}`, "P&L"]} />
            <Area type="monotone" dataKey="pnl" stroke="#00d4ff" strokeWidth={2} fill="url(#pnlGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Strategy breakdown */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div className="card">
          <div style={{ fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:16 }}>P&L by Strategy</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stratData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3050" />
              <XAxis dataKey="name" tick={{ fill:"#4a6080", fontSize:10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill:"#4a6080", fontSize:10 }} tickLine={false} axisLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background:"#0d1421", border:"1px solid #1e3050", borderRadius:4, fontSize:12 }} />
              <Bar dataKey="total_pnl" fill="#00d4ff" radius={[3,3,0,0]}>
                {stratData.map((_, i) => <Cell key={i} fill={STRAT_COLORS[i % STRAT_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div style={{ fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:16 }}>Win Rate by Strategy</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stratData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3050" />
              <XAxis type="number" tick={{ fill:"#4a6080", fontSize:10 }} domain={[0,100]} tickFormatter={v=>`${v}%`} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill:"#4a6080", fontSize:10 }} tickLine={false} axisLine={false} width={60} />
              <Tooltip contentStyle={{ background:"#0d1421", border:"1px solid #1e3050", borderRadius:4, fontSize:12 }} />
              <Bar dataKey="win_rate" fill="#00ff9d" radius={[0,3,3,0]}>
                {stratData.map((_, i) => <Cell key={i} fill={STRAT_COLORS[i % STRAT_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
//  PAPER TRADING PAGE
// ════════════════════════════════════════════════════════════════
const PaperPage = ({ token }) => {
  const { get, post } = useApi(token);
  const [account,  setAccount]  = useState(null);
  const [board,    setBoard]    = useState([]);
  const [showModal,setModal]    = useState(false);

  useEffect(() => {
    get("/paper/account").then(setAccount);
    get("/paper/leaderboard").then(d => setBoard(d.leaderboard || []));
  }, [get]);

  const handlePaperTrade = async (form) => {
    await post("/paper/trade", form);
    get("/paper/account").then(setAccount);
    setModal(false);
  };

  if (!account) return <div style={{ padding:40, textAlign:"center", color:"var(--muted)" }}>Loading...</div>;

  const pnl = account.total_pnl || 0;
  return (
    <div style={{ padding:"24px 28px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <div style={{ fontFamily:"var(--font-head)", fontSize:24, fontWeight:800 }}>Paper Trading</div>
          <div style={{ fontSize:12, color:"var(--muted)" }}>Practice with ₹50 lakh virtual capital — zero real risk</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Simulate Trade</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
        {[
          { label:"Virtual Balance",  value:`₹${(account.balance||0).toLocaleString("en-IN")}`, color:"var(--accent)" },
          { label:"Total P&L",        value:`₹${pnl.toLocaleString("en-IN")}`,  color: pnl>=0?"#00ff9d":"#ff1744" },
          { label:"Return",           value:`${account.pnl_pct?.toFixed(2)||0}%`, color: pnl>=0?"#00ff9d":"#ff1744" },
        ].map(k => (
          <div key={k.label} className="card">
            <div style={{ fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:8 }}>{k.label}</div>
            <div style={{ fontFamily:"var(--font-head)", fontSize:26, fontWeight:800, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="card">
        <div style={{ fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:16 }}>
          🏆 Paper Trading Leaderboard
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>Trader</th><th>P&L</th><th>Return</th><th>Trades</th></tr>
          </thead>
          <tbody>
            {board.map((r, i) => (
              <tr key={i}>
                <td style={{ color: i===0?"#f5c518":i===1?"#c0c0c0":i===2?"#cd7f32":"var(--muted)", fontWeight:700 }}>
                  {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
                </td>
                <td style={{ fontWeight:600 }}>{r.name}</td>
                <td style={{ color: r.pnl>=0?"var(--green)":"var(--red)", fontWeight:700 }}>
                  {r.pnl>=0?"+":""}₹{Math.abs(r.pnl).toLocaleString("en-IN")}
                </td>
                <td style={{ color: r.pnl_pct>=0?"var(--green)":"var(--red)" }}>{r.pnl_pct?.toFixed(2)}%</td>
                <td style={{ color:"var(--muted)" }}>{r.trades}</td>
              </tr>
            ))}
            {board.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign:"center", color:"var(--muted)", padding:24 }}>Be the first on the leaderboard!</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && <LogTradeModal signal={{}} onClose={() => setModal(false)}
        onSubmit={handlePaperTrade} />}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
//  SUBSCRIPTION PAGE
// ════════════════════════════════════════════════════════════════
const PlansPage = ({ token, user }) => {
  const { get, post } = useApi(token);
  const [plans, setPlans] = useState([]);
  useEffect(() => { get("/subscription/plans").then(d => setPlans(d.plans || [])); }, [get]);

  const ICONS = { free:"🆓", starter:"🚀", pro:"⚡", elite:"💎" };
  return (
    <div style={{ padding:"24px 28px" }}>
      <div style={{ textAlign:"center", marginBottom:40 }}>
        <div style={{ fontFamily:"var(--font-head)", fontSize:32, fontWeight:800, marginBottom:8 }}>
          Choose Your Plan
        </div>
        <div style={{ color:"var(--muted)", fontSize:14 }}>
          Professional NIFTY/BANKNIFTY signal platform — built by traders, for traders
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, maxWidth:1100, margin:"0 auto" }}>
        {plans.map(p => {
          const isActive = user?.plan === p.id;
          return (
            <div key={p.id} className="card" style={{
              borderColor: isActive ? "var(--accent)" : p.id==="pro" ? "var(--yellow)40" : "var(--border)",
              borderWidth: isActive || p.id==="pro" ? 2 : 1,
              position:"relative",
              transform: p.id==="pro" ? "translateY(-8px)" : "none",
            }}>
              {p.id==="pro" && (
                <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)",
                  background:"var(--yellow)", color:"#000", padding:"2px 12px", borderRadius:10,
                  fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:".1em" }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ textAlign:"center", marginBottom:20 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>{ICONS[p.id]}</div>
                <div style={{ fontFamily:"var(--font-head)", fontSize:20, fontWeight:800 }}>{p.name}</div>
                <div style={{ fontSize:24, fontWeight:800, color:"var(--accent)", margin:"8px 0" }}>{p.price_str}</div>
              </div>
              <ul style={{ listStyle:"none", marginBottom:24 }}>
                {p.features.map((f, i) => (
                  <li key={i} style={{ fontSize:12, color:"var(--text)", padding:"6px 0",
                    borderBottom:"1px solid rgba(30,48,80,.4)", display:"flex", gap:8 }}>
                    <span style={{ color:"var(--green)" }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              {isActive ? (
                <div className="btn" style={{ width:"100%", justifyContent:"center",
                  background:"rgba(0,212,255,.1)", color:"var(--accent)", border:"1px solid var(--accent)" }}>
                  Current Plan
                </div>
              ) : (
                <button className={`btn ${p.id==="pro"?"btn-primary":"btn-ghost"}`}
                  style={{ width:"100%", justifyContent:"center" }}
                  onClick={() => post("/subscription/upgrade", null).then(()=>window.location.reload())}>
                  {p.price === 0 ? "Get Started" : "Subscribe"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
//  AUTH PAGE
// ════════════════════════════════════════════════════════════════
const AuthPage = ({ onLogin }) => {
  const [isReg, setReg] = useState(false);
  const [form, setForm]  = useState({ name:"", email:"", password:"" });
  const [err,  setErr]   = useState("");
  const [loading, setLoad] = useState(false);

  const submit = async () => {
    setLoad(true); setErr("");
    try {
      const path = isReg ? "/auth/register" : "/auth/login";
      const res  = await fetch(`${API}${path}`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(form),
      }).then(r=>r.json());
      if (res.token) onLogin(res.token, res.user);
      else setErr(res.detail || "Authentication failed");
    } catch {
      setErr("Could not connect to server. Make sure backend is running.");
    }
    setLoad(false);
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"var(--bg)", position:"relative", overflow:"hidden" }}>
      {/* Background grid */}
      <div style={{ position:"absolute", inset:0, backgroundImage:`
        linear-gradient(rgba(0,212,255,.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,212,255,.03) 1px, transparent 1px)`,
        backgroundSize:"60px 60px" }} />

      <div style={{ width:420, position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ fontFamily:"var(--font-head)", fontSize:40, fontWeight:800,
            background:"linear-gradient(135deg, #00d4ff, #00ff9d)", WebkitBackgroundClip:"text",
            WebkitTextFillColor:"transparent", marginBottom:8 }}>
            AlgoTrade
          </div>
          <div style={{ color:"var(--muted)", fontSize:13 }}>
            NIFTY · BANKNIFTY · Professional Signal Platform
          </div>
        </div>

        <div className="card" style={{ padding:32 }}>
          <div style={{ fontFamily:"var(--font-head)", fontSize:20, fontWeight:700, marginBottom:24 }}>
            {isReg ? "Create Account" : "Sign In"}
          </div>

          {isReg && (
            <div style={{ marginBottom:14 }}>
              <label>Full Name</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Rahul Sharma" />
            </div>
          )}
          <div style={{ marginBottom:14 }}>
            <label>Email</label>
            <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="you@example.com" />
          </div>
          <div style={{ marginBottom:20 }}>
            <label>Password</label>
            <input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submit()} />
          </div>

          {err && <div style={{ color:"var(--red)", fontSize:12, marginBottom:14, padding:"8px 12px", background:"rgba(255,23,68,.1)", borderRadius:4 }}>{err}</div>}

          <button className="btn btn-primary" style={{ width:"100%", justifyContent:"center", marginBottom:14 }}
            onClick={submit} disabled={loading}>
            {loading ? "..." : isReg ? "Create Account" : "Sign In"}
          </button>

          <div style={{ textAlign:"center", fontSize:12, color:"var(--muted)" }}>
            {isReg ? "Already have an account? " : "Don't have an account? "}
            <span style={{ color:"var(--accent)", cursor:"pointer" }} onClick={() => setReg(r=>!r)}>
              {isReg ? "Sign In" : "Register Free"}
            </span>
          </div>

          <div style={{ marginTop:16, padding:"10px 0", borderTop:"1px solid var(--border)",
            fontSize:11, color:"var(--muted)", textAlign:"center" }}>
            Demo: demo@algotrade.in / demo123
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════════════════════════════
const NAV = [
  { id:"dashboard", icon:"⚡", label:"Dashboard" },
  { id:"analytics", icon:"📊", label:"Analytics"  },
  { id:"paper",     icon:"🎯", label:"Paper Trade" },
  { id:"plans",     icon:"💎", label:"Plans"       },
];

const Sidebar = ({ page, setPage, user, onLogout }) => (
  <div style={{ width:200, background:"var(--bg2)", borderRight:"1px solid var(--border)",
    display:"flex", flexDirection:"column", height:"100vh", position:"fixed", left:0, top:0 }}>

    <div style={{ padding:"24px 20px 20px", borderBottom:"1px solid var(--border)" }}>
      <div style={{ fontFamily:"var(--font-head)", fontSize:18, fontWeight:800,
        background:"linear-gradient(135deg, #00d4ff, #00ff9d)", WebkitBackgroundClip:"text",
        WebkitTextFillColor:"transparent" }}>AlgoTrade</div>
      <div style={{ fontSize:9, color:"var(--muted)", marginTop:2, letterSpacing:".1em" }}>
        SIGNAL PLATFORM
      </div>
    </div>

    <nav style={{ flex:1, padding:"16px 0" }}>
      {NAV.map(n => (
        <div key={n.id}
          onClick={() => setPage(n.id)}
          style={{
            display:"flex", alignItems:"center", gap:10,
            padding:"11px 20px", cursor:"pointer", fontSize:13, fontWeight:600,
            color: page===n.id ? "var(--accent)" : "var(--muted)",
            background: page===n.id ? "rgba(0,212,255,.08)" : "transparent",
            borderLeft: page===n.id ? "2px solid var(--accent)" : "2px solid transparent",
            transition:"all .15s",
          }}>
          <span>{n.icon}</span> {n.label}
        </div>
      ))}
    </nav>

    <div style={{ padding:"16px 20px", borderTop:"1px solid var(--border)" }}>
      <div style={{ fontSize:12, fontWeight:600, marginBottom:4 }}>{user?.name}</div>
      <div style={{ fontSize:10, color:"var(--muted)", textTransform:"uppercase",
        letterSpacing:".08em", marginBottom:12 }}>
        <span style={{ color:"var(--yellow)" }}>◆</span> {user?.plan || "free"} plan
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onLogout} style={{ width:"100%", justifyContent:"center" }}>
        Sign Out
      </button>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════
//  ROOT APP
// ════════════════════════════════════════════════════════════════
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("at_token") || "");
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem("at_user") || "null"); } catch { return null; }
  });
  const [page, setPage] = useState("dashboard");

  const login = (t, u) => {
    localStorage.setItem("at_token", t);
    localStorage.setItem("at_user", JSON.stringify(u));
    setToken(t); setUser(u);
  };

  const logout = () => {
    localStorage.removeItem("at_token");
    localStorage.removeItem("at_user");
    setToken(""); setUser(null);
  };

  if (!token || !user)
    return (<><GlobalStyles /><AuthPage onLogin={login} /></>);

  const PAGES = {
    dashboard: <DashboardPage token={token} user={user} />,
    analytics: <AnalyticsPage token={token} />,
    paper:     <PaperPage token={token} />,
    plans:     <PlansPage token={token} user={user} />,
  };

  return (
    <>
      <GlobalStyles />
      <div style={{ display:"flex" }}>
        <Sidebar page={page} setPage={setPage} user={user} onLogout={logout} />
        <main style={{ marginLeft:200, flex:1, minHeight:"100vh", overflowY:"auto" }}>
          {PAGES[page]}
        </main>
      </div>
    </>
  );
}
