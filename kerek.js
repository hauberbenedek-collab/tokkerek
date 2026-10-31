const BIG_ALL = [
  "Újrakezdés",
  "Bekötött szem 1 percig",
  "Szünet 10 perc",
  "Chat irányít",
  "3 kis kerék",
  "Másik irányít egy lépést",
  "Lekapcsolod a villanyt 5 percig",
  "A másik ember chatje mondja meg mit faragj a tökbe"
];
const SMALL = [
  "Nagy kerék",
  "Minden mondat végére „miau”",
  "Újrapörgetés",
  "Vajazó kés",
  "Szünet 2 perc",
  "Szúrj bele random helyen",
  "Csak balkezes",
  "Suttogva kell beszélned 2 percig",
  "Csak két szóval válaszolhatsz bármire 2 percig"
];

const BIG_COLORS = ["#ff7a1a","#5b2a86","#e85d04","#7b2cbf","#ff9a3d","#3c1a5b","#d94f00","#9d4edd"];
const SMALL_COLORS = ["#2f7d32","#5b2a86","#4caf50","#3c1a5b","#6fbf4a","#7b2cbf","#2a6b3a","#9d4edd","#3d9a4a","#4a2270"];

const OWNER = window.KEREK_OWNER || "default";
const KEY = "tokkerek_big_left_" + OWNER;
let bigLeft = load();
let bigRot = 0, smallRot = 0, busy = false, resultTimer = null;
let active = null; /* az a kerék, amelyik éppen pörög vagy az eredményt mutatja */

const bigC = document.getElementById("bigC");
const smallC = document.getElementById("smallC");
const btns = ["reset"].map(id => document.getElementById(id));

function load(){
  try{
    const v = JSON.parse(localStorage.getItem(KEY));
    if(Array.isArray(v) && v.every(x => BIG_ALL.includes(x))) return v;
  }catch(e){}
  return BIG_ALL.slice();
}
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(bigLeft)); }catch(e){}
}

function wrap(ctx, text, maxW){
  const words = text.split(" "), lines = [];
  let cur = "";
  for(const w of words){
    const t = cur ? cur + " " + w : w;
    if(ctx.measureText(t).width > maxW && cur){ lines.push(cur); cur = w; }
    else cur = t;
  }
  if(cur) lines.push(cur);
  return lines;
}

const layoutCache = {};
function draw(canvas, items, colors, rot){
  const ctx = canvas.getContext("2d");
  const S = canvas.width, C = S/2, R = C - 12;
  ctx.clearRect(0,0,S,S);
  const n = items.length;
  if(!n){
    ctx.beginPath(); ctx.arc(C,C,R,0,Math.PI*2);
    ctx.fillStyle = "#2a1033"; ctx.fill();
    ctx.lineWidth = 10; ctx.strokeStyle = "#ff7a1a"; ctx.stroke();
    ctx.fillStyle = "#fff4e0"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "64px 'Lilita One','Arial Black',sans-serif";
    ctx.fillText("Elfogyott", C, C - 24);
    ctx.font = "34px 'Lilita One','Arial Black',sans-serif";
    ctx.fillText("Reset gomb", C, C + 34);
    return;
  }
  const a = Math.PI*2/n;
  for(let i=0;i<n;i++){
    const s = rot + i*a;
    ctx.beginPath(); ctx.moveTo(C,C); ctx.arc(C,C,R,s,s+a); ctx.closePath();
    ctx.fillStyle = colors[i % colors.length]; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = "#1d0a24"; ctx.stroke();
  }
  for(let i=0;i<n;i++){
    const mid = rot + (i+.5)*a;
    ctx.save();
    ctx.translate(C,C); ctx.rotate(mid);
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    const maxW = R*0.68;
    const arcH = n === 1 ? R*0.9 : 2*R*0.6*Math.sin(Math.min(a/2, Math.PI/2));
    const ck = n + "|" + items[i];
    let L = layoutCache[ck];
    if(!L){
      let sz = n <= 4 ? 52 : n <= 8 ? 40 : 34, ls;
      for(;;){
        ctx.font = sz + "px 'Lilita One','Arial Black',sans-serif";
        ls = wrap(ctx, items[i], maxW);
        const fits = ls.length*sz*1.08 <= arcH*0.92 && ls.every(l => ctx.measureText(l).width <= maxW + 1);
        if(fits || sz <= 14) break;
        sz--;
      }
      L = layoutCache[ck] = {size: sz, lines: ls};
    }
    const size = L.size, lines = L.lines;
    ctx.font = size + "px 'Lilita One','Arial Black',sans-serif";
    ctx.lineWidth = 6; ctx.strokeStyle = "rgba(29,10,36,.85)"; ctx.fillStyle = "#fff4e0";
    const lh = size*1.08, y0 = -((lines.length-1)*lh)/2;
    lines.forEach((l,k) => {
      ctx.strokeText(l, R-24, y0 + k*lh);
      ctx.fillText(l, R-24, y0 + k*lh);
    });
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(C,C,26,0,Math.PI*2);
  ctx.fillStyle = "#1d0a24"; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = "#ff7a1a"; ctx.stroke();
  ctx.beginPath(); ctx.arc(C,C,R,0,Math.PI*2);
  ctx.lineWidth = 10; ctx.strokeStyle = "#ff7a1a"; ctx.stroke();
}

function redraw(){
  draw(bigC, bigLeft, BIG_COLORS, bigRot);
  draw(smallC, SMALL, SMALL_COLORS, smallRot);
}

function winnerIndex(rot, n){
  const T = Math.PI*2, a = T/n;
  const p = (((-Math.PI/2 - rot) % T) + T) % T;
  return Math.floor(p/a) % n;
}

/* Az eredmény annak a keréknek a közepén jelenik meg, amelyiket pörgették */
function resEl(which){
  let r = document.getElementById("res-" + which);
  if(!r){ /* ha az HTML-ben nincs ilyen elem, létrehozzuk, hogy a pörgetés ettől ne akadjon el */
    r = document.createElement("div");
    r.className = "res"; r.id = "res-" + which; r.setAttribute("role","status");
    document.getElementById(which).appendChild(r);
  }
  return r;
}
function showResult(which, text){
  const r = resEl(which);
  r.textContent = text;
  r.classList.add("on");
}
function hideResult(which){
  (which ? [which] : ["big","small"]).forEach(w => resEl(w).classList.remove("on"));
}

function setBusy(v){
  busy = v;
  btns.forEach(b => b.disabled = v);
}

function spin(which){
  if(busy) return;
  const items = which === "big" ? bigLeft : SMALL;
  if(!items.length) return;
  clearTimeout(resultTimer);
  hideResult(which);
  setBusy(true);
  active = which;
  const start = which === "big" ? bigRot : smallRot;
  const target = start + (6 + Math.random()*3)*Math.PI*2 + Math.random()*Math.PI*2;
  const dur = 5500, t0 = performance.now();
  (function frame(now){
    const t = Math.min(1, (now - t0)/dur);
    const rot = start + (target - start)*(1 - Math.pow(1 - t, 3));
    if(which === "big") bigRot = rot; else smallRot = rot;
    if(t < 1){ requestAnimationFrame(frame); return; }
    finish(which, items[winnerIndex(rot, items.length)]);
  })(t0);
}

function finish(which, winner){
  if(which === "small"){
    showResult("small", winner);
    active = null;
    setBusy(false);
    return;
  }
  showResult("big", winner);
  resultTimer = setTimeout(() => {
    const i = bigLeft.indexOf(winner);
    if(i > -1) bigLeft.splice(i, 1);
    save();
    active = null;
    setBusy(false);
  }, 2800);
}

function reset(){
  clearTimeout(resultTimer);
  bigLeft = BIG_ALL.slice();
  save();
  bigRot = 0; smallRot = 0;
  active = null;
  hideResult();
  setBusy(false);
  redraw();
}

/* Rákattintasz a kerékre, akkor pörög */
document.getElementById("big").onclick = () => spin("big");
document.getElementById("small").onclick = () => spin("small");
document.getElementById("reset").onclick = reset;

/* Billentyűk (az OBS Interact ablakában): 1 nagy, 2 kis kerék, R reset, H reset gomb elrejtése */
addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if(k === "1") spin("big");
  else if(k === "2") spin("small");
  else if(k === "r") reset();
  else if(k === "h") document.getElementById("controls").classList.toggle("off");
});

/* Idle forgás: lassan forog, ha nem pörgeted. A kis kerék ellenkező irányba. */
const IDLE_BIG = 0.12, IDLE_SMALL = -0.16; /* radián / másodperc */
let lastT = performance.now();
function idle(now){
  const dt = Math.min(0.1, (now - lastT)/1000);
  lastT = now;
  if(active !== "big") bigRot += IDLE_BIG*dt;
  if(active !== "small") smallRot += IDLE_SMALL*dt;
  redraw();
  requestAnimationFrame(idle);
}
requestAnimationFrame(idle);
if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
  for(const k in layoutCache) delete layoutCache[k];
});
