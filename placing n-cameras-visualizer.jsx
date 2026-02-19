import { useState, useEffect, useCallback } from "react";

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg:         "#1c1c1c",
  surface:    "#2a2a2a",
  surface2:   "#333333",
  border:     "#444444",
  text:       "#f0f0f0",
  textMuted:  "#999999",
  textDim:    "#666666",
  cellEmpty:    "#3d3d3d",
  cellBorder:   "#555",
  cellBlocked:  "#1a1a1a",
  cellActiveRow:"#4a3e20",
  cellTry:      "#1e3a5f",
  cellConflict: "#6a1f1f",
  cellPlaced:   "#1a5c3a",
  cellCulprit:  "#6a4000",
  cellSolved:   "#2a6a1a",
  green:   "#22dd88",
  red:     "#ff5555",
  orange:  "#ffaa33",
  blue:    "#5599ff",
  yellow:  "#ffdd44",
  teal:    "#33ccaa",
};

const SPEED_MAP = { slow: 1000, medium: 350, fast: 80 };

function createGrid(n) {
  return Array.from({ length: n }, () => Array(n).fill(0));
}

function getConflict(placed, row, col) {
  for (const [r, c] of placed) {
    if (c === col) return { culprit: [r, c], reason: "column" };
    if (Math.abs(r - row) === Math.abs(c - col)) return { culprit: [r, c], reason: "diagonal" };
  }
  return null;
}

function* solveGen(n, row, placed, blocked) {
  if (placed.length === n) { yield { type: "SOLVED", placed: [...placed] }; return true; }
  if (row >= n)            { yield { type: "FAIL",   row, placed: [...placed] }; return false; }

  for (let col = 0; col < n; col++) {
    if (blocked[row][col]) { yield { type: "BLOCKED", row, col, placed: [...placed] }; continue; }
    yield { type: "TRY", row, col, placed: [...placed] };

    const conflict = getConflict(placed, row, col);
    if (!conflict) {
      placed.push([row, col]);
      yield { type: "PLACE", row, col, placed: [...placed] };
      const sub = solveGen(n, row + 1, placed, blocked);
      let r;
      while (!(r = sub.next()).done) yield r.value;
      if (r.value) return true;
      placed.pop();
      yield { type: "REMOVE", row, col, placed: [...placed] };
    } else {
      yield { type: "CONFLICT", row, col, placed: [...placed], culprit: conflict.culprit, reason: conflict.reason };
    }
  }
  return false;
}

export default function App() {
  const [n, setN] = useState(4);
  const [blocked, setBlocked] = useState(() => createGrid(4));
  const [vis, setVis] = useState({ placed: [], tryCell: null, conflictCell: null, culprit: null, reason: null, currentRow: null, status: "idle", step: null });
  const [history, setHistory] = useState([]);
  const [speed, setSpeed] = useState("slow");
  const [running, setRunning] = useState(false);
  const [gen, setGen] = useState(null);
  const [timer, setTimer] = useState(null);

  const resetVis = useCallback(() => {
    if (timer) clearInterval(timer);
    setTimer(null); setRunning(false); setGen(null); setHistory([]);
    setVis({ placed: [], tryCell: null, conflictCell: null, culprit: null, reason: null, currentRow: null, status: "idle", step: null });
  }, [timer]);

  const changeN = (newN) => { resetVis(); setN(newN); setBlocked(createGrid(newN)); };

  const toggleCell = (r, c) => {
    if (running) return;
    setBlocked(prev => { const g = prev.map(row => [...row]); g[r][c] ^= 1; return g; });
    resetVis();
  };

  const startSolve = () => {
    resetVis();
    setGen(solveGen(n, 0, [], blocked.map(r=>[...r])));
    setRunning(true);
  };

  useEffect(() => {
    if (!running || !gen) return;
    const id = setInterval(() => {
      const res = gen.next();
      if (res.done) {
        clearInterval(id); setRunning(false);
        if (!res.value) setVis(s => ({ ...s, status: "failed" }));
        return;
      }
      const ev = res.value;
      setHistory(h => [ev, ...h.slice(0, 24)]);
      if      (ev.type === "TRY")      setVis({ placed: ev.placed, tryCell: [ev.row,ev.col], conflictCell: null, culprit: null, reason: null, currentRow: ev.row, status: "trying",   step: ev });
      else if (ev.type === "PLACE")    setVis({ placed: ev.placed, tryCell: null, conflictCell: null, culprit: null, reason: null, currentRow: ev.row, status: "placed",   step: ev });
      else if (ev.type === "CONFLICT") setVis({ placed: ev.placed, tryCell: null, conflictCell: [ev.row,ev.col], culprit: ev.culprit, reason: ev.reason, currentRow: ev.row, status: "conflict", step: ev });
      else if (ev.type === "REMOVE")   setVis({ placed: ev.placed, tryCell: null, conflictCell: null, culprit: null, reason: null, currentRow: ev.row, status: "backtrack", step: ev });
      else if (ev.type === "BLOCKED")  setVis(s => ({ ...s, tryCell: [ev.row,ev.col], currentRow: ev.row, status: "blocked", step: ev }));
      else if (ev.type === "SOLVED")   { setVis({ placed: ev.placed, tryCell: null, conflictCell: null, culprit: null, reason: null, currentRow: null, status: "solved", step: ev }); clearInterval(id); setRunning(false); }
    }, SPEED_MAP[speed]);
    setTimer(id);
    return () => clearInterval(id);
  }, [running, gen, speed]);

  const cellSize = Math.min(64, Math.floor(380 / n));

  function cellStyle(r, c) {
    const isBlocked   = blocked[r][c] === 1;
    const isPlaced    = vis.placed.some(([pr,pc]) => pr===r && pc===c);
    const isTry       = vis.tryCell      && vis.tryCell[0]===r      && vis.tryCell[1]===c;
    const isConflict  = vis.conflictCell && vis.conflictCell[0]===r  && vis.conflictCell[1]===c;
    const isCulprit   = vis.culprit      && vis.culprit[0]===r       && vis.culprit[1]===c;
    const isActiveRow = vis.currentRow===r && !isPlaced;
    const isSolved    = vis.status==="solved";

    let bg = T.cellEmpty, border = `1px solid ${T.cellBorder}`, shadow = "none";

    if      (isBlocked)   { bg = T.cellBlocked;  border = `1px solid #2a2a2a`; }
    else if (isConflict)  { bg = T.cellConflict; border = `2px solid ${T.red}`;    shadow = `0 0 18px ${T.red}99`; }
    else if (isCulprit)   { bg = T.cellCulprit;  border = `2px solid ${T.orange}`; shadow = `0 0 18px ${T.orange}99`; }
    else if (isTry)       { bg = T.cellTry;       border = `2px solid ${T.blue}`;   shadow = `0 0 14px ${T.blue}77`; }
    else if (isPlaced)    { bg = isSolved ? T.cellSolved : T.cellPlaced; border = `2px solid ${isSolved ? T.yellow : T.green}`; shadow = `0 0 14px ${isSolved?T.yellow:T.green}77`; }
    else if (isActiveRow) { bg = T.cellActiveRow; border = `1px solid ${T.orange}55`; }

    return { width:cellSize, height:cellSize, background:bg, border, boxShadow:shadow, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", cursor:running?"default":"pointer", transition:"background 0.15s, border 0.15s, box-shadow 0.15s", userSelect:"none", fontSize:cellSize*0.48 };
  }

  const step = vis.step;
  const conflictMsg = vis.reason === "column"
    ? `✗ Col ${step?.col} BLOCKED — camera at [${vis.culprit}] shares same COLUMN  →  skip, try next col`
    : vis.reason === "diagonal"
    ? `✗ Col ${step?.col} BLOCKED — camera at [${vis.culprit}] is on same DIAGONAL  →  skip, try next col`
    : `✗ Conflict at [${step?.row}, ${step?.col}]`;

  const STATUS = {
    idle:      { color: T.textMuted, bg:"#252525", text:"Press ▶ START — click any cell to block/unblock it first" },
    trying:    { color: T.blue,      bg:"#18243a", text:`→ Scanning Row ${step?.row}  |  Now checking Col ${step?.col} ...` },
    placed:    { color: T.green,     bg:"#0f2a1a", text:`✓ Col ${step?.col} is safe!  Camera placed at [${step?.row}, ${step?.col}]  →  recursing to Row ${(step?.row??0)+1}` },
    conflict:  { color: T.red,       bg:"#2a0f0f", text: conflictMsg },
    backtrack: { color: T.orange,    bg:"#2a1800", text:`↩ Row ${step?.row} exhausted all columns  →  remove camera, backtrack to Row ${(step?.row??1)-1}` },
    blocked:   { color: T.textMuted, bg:"#252525", text:`⊘ Cell [${step?.row}, ${step?.col}] is a skylight (blocked)  →  skip to next col` },
    solved:    { color: T.yellow,    bg:"#1e2800", text:`★  SOLVED!  All ${n} cameras placed — no row, column, or diagonal conflicts` },
    failed:    { color: T.red,       bg:"#2a0f0f", text:"✗  No valid placement exists for this configuration" },
  };
  const s = STATUS[vis.status] || STATUS.idle;

  const LEGEND = [
    { bg: T.cellActiveRow, border: T.orange+"66", label: "Current row being scanned →" },
    { bg: T.cellTry,       border: T.blue,        label: "Cell currently being checked" },
    { bg: T.cellPlaced,    border: T.green,        label: "Camera placed ✓" },
    { bg: T.cellConflict,  border: T.red,          label: "Conflict cell — cannot place ✗" },
    { bg: T.cellCulprit,   border: T.orange,       label: "Culprit camera causing block 🔶" },
    { bg: T.cellBlocked,   border: "#333",         label: "Blocked skylight cell" },
    { bg: T.cellSolved,    border: T.yellow,       label: "Final solved placement ★" },
  ];

  const EVT_COLOR = { TRY:T.blue, PLACE:T.green, CONFLICT:T.red, REMOVE:T.orange, BLOCKED:"#777", SOLVED:T.yellow, FAIL:T.red };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Segoe UI',Tahoma,sans-serif", display:"flex", flexDirection:"column", alignItems:"center", padding:"24px 16px", gap:18 }}>

      <div style={{ textAlign:"center" }}>
        <h1 style={{ margin:0, fontSize:23, fontWeight:700, color:T.green, letterSpacing:0.5 }}>N-Camera Placement Visualizer</h1>
        <p style={{ margin:"4px 0 0", color:T.textMuted, fontSize:13 }}>Backtracking — row by row, column by column</p>
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center", alignItems:"center" }}>
        <label style={{ color:T.textMuted, fontSize:13 }}>
          N:&nbsp;
          <select value={n} onChange={e=>changeN(+e.target.value)} disabled={running}
            style={{ background:T.surface2, color:T.text, border:`1px solid ${T.border}`, padding:"5px 8px", borderRadius:5, fontFamily:"inherit", fontSize:13 }}>
            {[1,2,3,4,5,6,7,8].map(v=><option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label style={{ color:T.textMuted, fontSize:13 }}>
          Speed:&nbsp;
          <select value={speed} onChange={e=>setSpeed(e.target.value)}
            style={{ background:T.surface2, color:T.text, border:`1px solid ${T.border}`, padding:"5px 8px", borderRadius:5, fontFamily:"inherit", fontSize:13 }}>
            <option value="slow">Slow (1s)</option>
            <option value="medium">Medium</option>
            <option value="fast">Fast</option>
          </select>
        </label>
        <button onClick={running ? resetVis : startSolve} style={{ padding:"7px 22px", fontWeight:700, fontSize:13, fontFamily:"inherit", cursor:"pointer", borderRadius:5,
          background: running ? "#3a1010" : "#0f3020", color: running ? T.red : T.green, border:`2px solid ${running?T.red:T.green}` }}>
          {running ? "■ STOP" : "▶ START"}
        </button>
        {!running && <button onClick={resetVis} style={{ padding:"7px 14px", fontSize:13, fontFamily:"inherit", cursor:"pointer", borderRadius:5, background:T.surface2, color:T.textMuted, border:`1px solid ${T.border}` }}>RESET</button>}
      </div>

      {!running && <div style={{ fontSize:12, color:T.textDim }}>Click cells to toggle blocked (skylight) before starting</div>}

      {/* Status bar */}
      <div style={{ padding:"12px 24px", borderRadius:8, border:`1px solid ${s.color}55`, background:s.bg, color:s.color, fontWeight:600, fontSize:14, maxWidth:700, width:"100%", textAlign:"center", boxShadow:`0 0 20px ${s.color}22`, transition:"all 0.2s", lineHeight:1.5 }}>
        {s.text}
      </div>

      {/* Main body */}
      <div style={{ display:"flex", gap:20, flexWrap:"wrap", justifyContent:"center", alignItems:"flex-start" }}>

        {/* Grid */}
        <div>
          <div style={{ display:"flex", marginLeft:50 }}>
            {Array.from({length:n},(_,i)=>(
              <div key={i} style={{ width:cellSize+4, textAlign:"center", fontSize:11, color:T.textDim }}>col {i}</div>
            ))}
          </div>
          <div style={{ display:"flex" }}>
            <div style={{ display:"flex", flexDirection:"column" }}>
              {Array.from({length:n},(_,i)=>(
                <div key={i} style={{ height:cellSize+4, display:"flex", alignItems:"center", paddingRight:6, fontSize:11, minWidth:48, justifyContent:"flex-end",
                  color: vis.currentRow===i ? T.orange : T.textDim,
                  fontWeight: vis.currentRow===i ? 700 : 400,
                  transition:"color 0.2s" }}>
                  {vis.currentRow===i ? "▶ " : ""}row {i}
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:`repeat(${n},${cellSize+4}px)`, gap:3, padding:10, background:T.surface, borderRadius:10,
              border:`2px solid ${vis.status==="solved"?T.yellow:T.border}`,
              boxShadow: vis.status==="solved" ? `0 0 30px ${T.yellow}44` : "none", transition:"border 0.3s, box-shadow 0.3s" }}>
              {Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>{
                const isPlaced     = vis.placed.some(([pr,pc])=>pr===r&&pc===c);
                const isBlockedCell= blocked[r][c]===1;
                const isCulprit    = vis.culprit && vis.culprit[0]===r && vis.culprit[1]===c;
                return (
                  <div key={`${r}${c}`} onClick={()=>toggleCell(r,c)} style={cellStyle(r,c)}>
                    {isBlockedCell && <span style={{fontSize:cellSize*0.32,color:"#555"}}>✕</span>}
                    {isPlaced && !isCulprit && <span>📷</span>}
                    {isCulprit && <span>🔶</span>}
                  </div>
                );
              }))}
            </div>
          </div>
          <div style={{ textAlign:"center", marginTop:8, fontSize:13, color:T.textMuted }}>
            Cameras: <b style={{color: vis.placed.length===n&&n>0 ? T.yellow : T.green}}>{vis.placed.length}</b> / {n}
          </div>
        </div>

        {/* Right panels */}
        <div style={{ display:"flex", flexDirection:"column", gap:14, minWidth:230, maxWidth:270 }}>
          {/* Legend */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:14 }}>
            <div style={{ fontSize:11, color:T.textDim, marginBottom:10, textTransform:"uppercase", letterSpacing:1 }}>Legend</div>
            {LEGEND.map(({bg,border,label})=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:9,marginBottom:7}}>
                <div style={{width:18,height:18,background:bg,border:`2px solid ${border}`,borderRadius:3,flexShrink:0}}/>
                <span style={{fontSize:12,color:"#ccc"}}>{label}</span>
              </div>
            ))}
          </div>

          {/* Event log */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:14 }}>
            <div style={{ fontSize:11, color:T.textDim, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>Event Log</div>
            {history.length===0 && <div style={{fontSize:11,color:T.textDim}}>Events appear here once started...</div>}
            {history.map((ev,i)=>(
              <div key={i} style={{fontSize:11,color:EVT_COLOR[ev.type]||"#aaa",marginBottom:4,opacity:Math.max(0.2,1-i*0.04),fontFamily:"monospace",lineHeight:1.5}}>
                {ev.type==="TRY"      && `→ Try     [${ev.row},${ev.col}]`}
                {ev.type==="PLACE"    && `✓ Place   [${ev.row},${ev.col}] → row ${ev.row+1}`}
                {ev.type==="CONFLICT" && `✗ Conflict[${ev.row},${ev.col}] ${ev.reason==="column"?"same col ":"diagonal"}← [${ev.culprit}]`}
                {ev.type==="REMOVE"   && `↩ Remove  [${ev.row},${ev.col}] backtrack`}
                {ev.type==="BLOCKED"  && `⊘ Blocked [${ev.row},${ev.col}]`}
                {ev.type==="SOLVED"   && `★ SOLVED!`}
                {ev.type==="FAIL"     && `✗ Failed  row ${ev.row}`}
              </div>
            ))}
          </div>

          {/* Placed cameras */}
          {vis.placed.length>0 && (
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:14 }}>
              <div style={{ fontSize:11, color:T.textDim, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>Placed Cameras</div>
              {vis.placed.map(([r,c],i)=>(
                <div key={i} style={{fontSize:12,color:T.green,marginBottom:4}}>📷 Row {r} → Col {c}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomPanel n={n} />
    </div>
  );
}

function BottomPanel({ n }) {
  const [tab, setTab] = useState("pseudo");
  const TABS = [{id:"pseudo",label:"Pseudocode"},{id:"time",label:"Time Complexity"},{id:"space",label:"Space Complexity"}];
  return (
    <div style={{ maxWidth:760, width:"100%" }}>
      <div style={{ display:"flex", gap:3 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"8px 18px", fontFamily:"inherit", fontSize:12.5, cursor:"pointer", borderRadius:"6px 6px 0 0", border:"none",
            background: tab===t.id ? "#2a2a2a" : "#222",
            color:      tab===t.id ? T.green : T.textDim,
            borderTop:  tab===t.id ? `2px solid ${T.green}` : "2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ background:"#2a2a2a", border:`1px solid ${T.border}`, borderRadius:"0 8px 8px 8px", padding:22, minHeight:240 }}>
        {tab==="pseudo" && <PseudoTab />}
        {tab==="time"   && <TimeTab n={n} />}
        {tab==="space"  && <SpaceTab n={n} />}
      </div>
    </div>
  );
}

const CODE_LINES = [
  { t:"function solve(grid, n, row, placed):",                              c:T.green },
  { t:"",c:"" },
  { t:"  // ── BASE CASES ─────────────────────────────────────────",        c:"#555" },
  { t:"  if len(placed) == n  →  return TRUE    ✓ all N cameras placed",    c:T.blue },
  { t:"  if row >= n          →  return FALSE   ✗ ran out of rows",         c:T.blue },
  { t:"",c:"" },
  { t:"  for col in 0 .. n-1:   ← scan columns left to right",             c:T.text },
  { t:"",c:"" },
  { t:"    ① SKIP if cell is a skylight (blocked)",                         c:"#888" },
  { t:"       if grid[row][col] == 1  →  continue",                         c:"#888" },
  { t:"",c:"" },
  { t:"    ② CHECK conflict with every already-placed camera [r, c]:",      c:T.red },
  { t:"       if c == col              →  COLUMN conflict    ✗  skip",       c:T.red },
  { t:"       if |row-r| == |col-c|   →  DIAGONAL conflict  ✗  skip",       c:T.red },
  { t:"",c:"" },
  { t:"    ③ SAFE — no conflict found, place camera here",                  c:T.green },
  { t:"       placed.append([row, col])",                                    c:T.green },
  { t:"       result = solve(grid, n, row+1, placed)  ← recurse next row", c:T.green },
  { t:"",c:"" },
  { t:"       if result == TRUE  →  return TRUE   (bubble success up)",     c:T.teal },
  { t:"",c:"" },
  { t:"    ④ BACKTRACK — undo placement, try next column",                  c:T.orange },
  { t:"       placed.pop()",                                                 c:T.orange },
  { t:"",c:"" },
  { t:"  return FALSE  ← all columns failed in this row",                   c:T.red },
];

function PseudoTab() {
  return (
    <div>
      <div style={{color:T.green,fontWeight:700,marginBottom:12,fontSize:13,letterSpacing:1}}>PSEUDOCODE — N-Camera Backtracking</div>
      <div style={{background:"#1c1c1c",border:`1px solid #3a3a3a`,borderRadius:7,padding:"14px 18px",overflowX:"auto"}}>
        {CODE_LINES.map((l,i)=>(
          <div key={i} style={{fontFamily:"'Courier New',monospace",fontSize:12.5,color:l.c||"#666",whiteSpace:"pre",lineHeight:1.8}}>{l.t||" "}</div>
        ))}
      </div>
      <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[
          {color:T.blue,  text:"Base cases — stop recursion early"},
          {color:T.red,   text:"Conflict check — prune this branch"},
          {color:T.green, text:"Place camera & recurse to next row"},
          {color:T.orange,text:"Backtrack — undo & try next column"},
        ].map(({color,text})=>(
          <div key={text} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
            <div style={{width:12,height:12,background:color,borderRadius:2,flexShrink:0}}/>
            <span style={{color:"#bbb"}}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeTab({ n }) {
  return (
    <div>
      <div style={{color:T.green,fontWeight:700,marginBottom:14,fontSize:13,letterSpacing:1}}>TIME COMPLEXITY</div>
      <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        {[
          {label:"Worst Case",   value:"O(N!)",   color:T.red,    desc:"Empty grid — explores full backtracking tree"},
          {label:"With isSafe()",value:"O(N·N!)", color:T.orange, desc:"Each node costs O(N) to check conflicts"},
          {label:"Best Case",    value:"O(N)",    color:T.green,  desc:"First column works every row, no backtrack"},
        ].map(({label,value,color,desc})=>(
          <div key={label} style={{flex:1,minWidth:160,background:"#222",border:`1px solid ${color}55`,borderRadius:7,padding:"12px 14px"}}>
            <div style={{color,fontSize:22,fontWeight:700,fontFamily:"monospace"}}>{value}</div>
            <div style={{color:"#ccc",fontSize:11,marginTop:3}}>{label}</div>
            <div style={{color:T.textDim,fontSize:11,marginTop:4}}>{desc}</div>
          </div>
        ))}
      </div>
      <div style={{color:"#bbb",fontSize:12,marginBottom:8}}>Why O(N!) — decisions per row:</div>
      <div style={{background:"#1c1c1c",border:`1px solid #3a3a3a`,borderRadius:7,padding:"12px 16px",fontFamily:"monospace",fontSize:12}}>
        {Array.from({length:n},(_,i)=>(
          <div key={i} style={{lineHeight:2,display:"flex",gap:16}}>
            <span style={{color:T.blue,minWidth:60}}>Row {i}</span>
            <span style={{color:T.orange,minWidth:100}}>≤ {n-i} choice{n-i!==1?"s":""}</span>
            <span style={{color:"#555"}}>{i===0?"all columns available":`${i} col${i>1?"s":""} + diagonals already used`}</span>
          </div>
        ))}
        <div style={{marginTop:10,color:"#888"}}>
          Total ≤ {Array.from({length:n},(_,i)=>n-i).join(" × ")} = <span style={{color:T.orange}}>{n}! = {factorial(n).toLocaleString()}</span> nodes max
        </div>
        <div style={{color:"#444",marginTop:4,fontSize:11}}>Pruning eliminates most branches — real runtime is significantly better.</div>
      </div>
      <div style={{marginTop:12,background:"#222",border:`1px solid #3a3a3a`,borderRadius:7,padding:"12px 14px"}}>
        <div style={{color:T.yellow,fontWeight:700,marginBottom:6,fontSize:12}}>getConflict() cost per node</div>
        <div style={{fontSize:12,color:"#aaa",lineHeight:1.8}}>
          Scans all placed cameras → <span style={{color:T.orange,fontFamily:"monospace"}}>O(N)</span> per call<br/>
          Multiplied across all nodes → <span style={{color:T.red,fontFamily:"monospace"}}>O(N · N!)</span> absolute worst case
        </div>
      </div>
    </div>
  );
}

function SpaceTab({ n }) {
  return (
    <div>
      <div style={{color:T.green,fontWeight:700,marginBottom:14,fontSize:13,letterSpacing:1}}>SPACE COMPLEXITY</div>
      <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        {[
          {label:"Grid storage",   value:"O(N²)", color:T.green,  desc:`${n}×${n} = ${n*n} cells`},
          {label:"Call stack",     value:"O(N)",  color:T.blue,   desc:`max depth = ${n} rows`},
          {label:"placed[] array", value:"O(N)",  color:T.orange, desc:`holds at most ${n} cameras`},
        ].map(({label,value,color,desc})=>(
          <div key={label} style={{flex:1,minWidth:150,background:"#222",border:`1px solid ${color}55`,borderRadius:7,padding:"12px 14px"}}>
            <div style={{color,fontSize:22,fontWeight:700,fontFamily:"monospace"}}>{value}</div>
            <div style={{color:"#ccc",fontSize:11,marginTop:3}}>{label}</div>
            <div style={{color:T.textDim,fontSize:11,marginTop:4}}>{desc}</div>
          </div>
        ))}
      </div>
      <div style={{color:"#bbb",fontSize:12,marginBottom:8}}>Recursion call stack at max depth ({n} frames):</div>
      <div style={{background:"#1c1c1c",border:`1px solid #3a3a3a`,borderRadius:7,padding:"14px 16px"}}>
        {Array.from({length:Math.min(n,6)},(_,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}>
            <div style={{width:Math.max(60,220-i*28),height:26,background:`hsl(${145-i*15},38%,${20+i*4}%)`,border:`1px solid hsl(${145-i*15},38%,38%)`,borderRadius:4,display:"flex",alignItems:"center",paddingLeft:10,fontSize:11,color:`hsl(${145-i*15},55%,65%)`,fontFamily:"monospace",flexShrink:0}}>
              solve(row={i}, cameras=[{i}])
            </div>
            <span style={{fontSize:11,color:"#555"}}>← frame {i}</span>
          </div>
        ))}
        {n>6 && <div style={{color:"#444",fontSize:11,marginTop:4}}>  … {n-6} more frames …</div>}
        <div style={{marginTop:10,color:"#555",fontSize:11}}>Max stack depth = N = {n}  →  <span style={{color:T.blue,fontFamily:"monospace"}}>O(N)</span></div>
      </div>
      <div style={{marginTop:12,background:"#222",border:`1px solid #3a3a3a`,borderRadius:7,padding:"12px 14px"}}>
        <div style={{color:T.yellow,fontWeight:700,marginBottom:8,fontSize:12}}>Full breakdown</div>
        {[
          {item:"Grid (input)",           size:"O(N²)", color:T.green,    why:`${n}×${n} = ${n*n} cells`},
          {item:"placed[] camera list",   size:"O(N)",  color:T.orange,   why:`grows to at most ${n} entries`},
          {item:"Recursion call stack",   size:"O(N)",  color:T.blue,     why:`${n} nested frames at deepest`},
          {item:"Loop vars (row, col…)",  size:"O(1)",  color:"#aabb44",  why:"constant extras per frame"},
        ].map(({item,size,color,why})=>(
          <div key={item} style={{display:"flex",gap:12,marginBottom:7,fontSize:12,alignItems:"center"}}>
            <span style={{color,fontFamily:"monospace",fontWeight:700,minWidth:56}}>{size}</span>
            <span style={{color:"#aaa",minWidth:185}}>{item}</span>
            <span style={{color:"#555"}}>← {why}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function factorial(n) { let r=1; for(let i=2;i<=n;i++) r*=i; return r; }
