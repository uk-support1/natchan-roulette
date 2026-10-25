const DEFAULTS = ["マッサージ","かくれんぼ","うで立てふせ10回","ぐるぐる","ジェットコースター","ラッキーおやつ","ボールポンポン","パンチパンチ","のっかり","自てん車でおさんぽ","もう一回まわす","休けい"];
const AGAIN = "もう一回まわす";
const EMOJI = {"マッサージ":"💆","かくれんぼ":"🙈","うで立てふせ10回":"💪","ぐるぐる":"🌀","ジェットコースター":"🎢","ラッキーおやつ":"🍬","ボールポンポン":"⚽","パンチパンチ":"🥊","のっかり":"🐴","自てん車でおさんぽ":"🚲","もう一回まわす":"🔁","休けい":"☕"};
const COLORS = ["#ff7eb6","#ffc83d","#5be37d","#4fc3ff","#b983ff","#ff9b5e","#ff6b6b","#3fe0c5","#ffd1ef","#a6e22e","#ffe08a","#9ad0ff"];
const KEY = "natchan-roulette:items:v4";

const $ = (id) => document.getElementById(id);
const canvas = $("wheel"), ctx = canvas.getContext("2d");
const chara = $("chara"), bubble = $("bubble");
const POSE = { idle: "waving", spinning: "pointing", oops: "surprised", trip: "surprised", happy: "jumping" };
Object.values(POSE).forEach((p) => { new Image().src = `buhio/${p}.webp`; });

let items = load();
let angle = 0;
let busy = false;

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(v) && v.length >= 2) return v;
  } catch {}
  return [...DEFAULTS];
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} }
const emojiOf = (t) => EMOJI[t] || "⭐";

const LINES = {"うで立てふせ10回":["うで立て","ふせ10回"],"自てん車でおさんぽ":["自てん車で","おさんぽ"],"もう一回まわす":["もう一回","まわす"],"ジェットコースター":["ジェット","コースター"],"ラッキーおやつ":["ラッキー","おやつ"],"ボールポンポン":["ボール","ポンポン"],"パンチパンチ":["パンチ","パンチ"]};
function splitLabel(t) {
  if (LINES[t]) return LINES[t];
  if (t.length <= 6) return [t];
  const h = Math.ceil(t.length / 2);
  return [t.slice(0, h), t.slice(h)];
}

function draw(now = 0) {
  const n = items.length, seg = (Math.PI * 2) / n, R = canvas.width / 2, r = R - 34;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 金のふち
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, "#fff3b0"); g.addColorStop(.5, "#ffb62e"); g.addColorStop(1, "#fff3b0");
  ctx.beginPath(); ctx.arc(R, R, R - 4, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();

  ctx.save(); ctx.translate(R, R); ctx.rotate(angle);
  items.forEach((label, i) => {
    const a0 = -Math.PI / 2 + i * seg;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a0 + seg); ctx.closePath();
    const rg = ctx.createRadialGradient(0, 0, 30, 0, 0, r);
    rg.addColorStop(0, "#ffffffcc"); rg.addColorStop(.35, COLORS[i % COLORS.length]); rg.addColorStop(1, COLORS[i % COLORS.length]);
    ctx.fillStyle = rg; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.stroke();

    ctx.save(); ctx.rotate(a0 + seg / 2);
    ctx.textBaseline = "middle"; ctx.textAlign = "center";
    ctx.font = (n > 10 ? 38 : 44) + "px sans-serif"; ctx.fillText(emojiOf(label), r - 48, 0);   // 絵文字は外側
    const lines = splitLabel(label), fs = n > 10 ? 21 : 30;
    ctx.font = `900 ${fs}px "Hiragino Maru Gothic ProN","Yu Gothic",sans-serif`;
    ctx.lineJoin = "round"; ctx.lineWidth = 7; ctx.strokeStyle = "#fffffff0"; ctx.fillStyle = "#4a2a55";
    const cx = r - (n > 10 ? 150 : 165), lh = fs * 1.15, y0 = -((lines.length - 1) * lh) / 2;
    lines.forEach((ln, k) => { ctx.strokeText(ln, cx, y0 + k * lh, n > 10 ? 130 : 175); ctx.fillText(ln, cx, y0 + k * lh, n > 10 ? 130 : 175); });
    ctx.restore();
  });
  ctx.restore();

  // まわりのライト（交互にまたたく）
  const L = 20;
  for (let k = 0; k < L; k++) {
    const a = (k / L) * Math.PI * 2, on = (Math.floor(now / 350) + k) % 2 === 0;
    ctx.beginPath(); ctx.arc(R + Math.cos(a) * (R - 17), R + Math.sin(a) * (R - 17), 8, 0, Math.PI * 2);
    ctx.fillStyle = on ? "#fffbe0" : "#ff7a45"; ctx.shadowColor = on ? "#fff3a0" : "transparent"; ctx.shadowBlur = on ? 14 : 0;
    ctx.fill(); ctx.shadowBlur = 0;
  }

  // 中心のハブ
  const hg = ctx.createRadialGradient(R - 6, R - 6, 4, R, R, 34);
  hg.addColorStop(0, "#fff"); hg.addColorStop(1, "#ffb62e");
  ctx.beginPath(); ctx.arc(R, R, 32, 0, Math.PI * 2); ctx.fillStyle = hg; ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.stroke();
  ctx.font = "30px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⭐", R, R + 2);
}
(function loop(now) { draw(now); requestAnimationFrame(loop); })(0);

const say = (t) => { bubble.textContent = t; };
function setState(s) {
  chara.className = "chara " + s.split(" ")[0] + (s.includes(" ") ? " " + s.split(" ")[1] : "");
  chara.src = `buhio/${POSE[s.split(" ")[0]]}.webp`;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => 1 - Math.pow(1 - t, 3);

function animateTo(target, ms) {
  const from = angle, delta = target - from;
  return new Promise((res) => {
    const t0 = performance.now();
    (function step(now) {
      const t = Math.min(1, (now - t0) / ms);
      angle = from + delta * ease(t);
      t < 1 ? requestAnimationFrame(step) : res();
    })(t0);
  });
}

// 紙吹雪
const cv = $("confetti"), cx2 = cv.getContext("2d");
let bits = [], confettiOn = false;
function burst() {
  cv.width = innerWidth; cv.height = innerHeight;
  const cols = ["#ff5d8f", "#ffc83d", "#5be37d", "#2db8ff", "#c14dff", "#ff9b3d"];
  for (let i = 0; i < 140; i++) bits.push({
    x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .45,
    vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, s: 6 + Math.random() * 7,
    c: cols[i % cols.length], r: Math.random() * 6, vr: (Math.random() - .5) * .4, life: 140 + Math.random() * 60 });
  if (!confettiOn) { confettiOn = true; requestAnimationFrame(fall); }
}
function fall() {
  cx2.clearRect(0, 0, cv.width, cv.height);
  bits = bits.filter((b) => b.life-- > 0 && b.y < cv.height + 20);
  bits.forEach((b) => {
    b.vy += .35; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
    cx2.save(); cx2.translate(b.x, b.y); cx2.rotate(b.r); cx2.fillStyle = b.c; cx2.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); cx2.restore();
  });
  bits.length ? requestAnimationFrame(fall) : (confettiOn = false, cx2.clearRect(0, 0, cv.width, cv.height));
}

async function spin(chain = 0) {
  if (busy && chain === 0) return;
  busy = true; $("spin").disabled = true; $("result").textContent = "";
  const n = items.length, seg = (Math.PI * 2) / n, TAU = Math.PI * 2;
  let win = Math.floor(Math.random() * n);                   // 結果は最初に公平に決める
  while (chain >= 2 && items[win] === AGAIN && n > 1) win = Math.floor(Math.random() * n);  // 連続しすぎない
  const jitter = (Math.random() - 0.5) * seg * 0.6;
  const rest = (((-(win + 0.5) * seg - jitter) % TAU) + TAU) % TAU;
  const base = angle - (((angle % TAU) + TAU) % TAU);
  const final = base + TAU * (4 + Math.floor(Math.random() * 3)) + rest;

  const clumsy = Math.random();
  setState("spinning");
  say(clumsy < 0.3 ? "えいっ！…あれ、かたい…" : "えいっ！");
  if (clumsy < 0.3) {                                        // ぶきっちょ①: 空まわり
    await animateTo(angle + 0.25, 500); await wait(300);
    say("もういっかい…！");
  }
  const overshoot = clumsy > 0.6 && clumsy < 0.85;           // ぶきっちょ②: 行きすぎ
  await animateTo(overshoot ? final + seg * 0.9 : final, 4200);
  if (overshoot) {
    setState("oops"); say("あっ！いきすぎた〜");
    await wait(600); await animateTo(final, 700);
  }
  if (clumsy >= 0.85) {                                      // ぶきっちょ③: ころぶ
    setState("trip"); say("わわっ…ころんだ！"); await wait(1200);
  }

  if (items[win] === AGAIN) {                                // もう一回まわす → 自動でもう一度
    setState("happy"); say("もう一回まわせる！やったね！");
    const c = document.createElement("div"); c.className = "card";
    c.textContent = `${emojiOf(AGAIN)} ${AGAIN} ${emojiOf(AGAIN)}`; $("result").replaceChildren(c);
    await wait(2200);
    return spin(chain + 1);
  }
  setState("happy");
  say(items[win] === "休けい" ? "ちょっとひとやすみしよう〜！" : `${items[win]}、だって！やったね！`);
  const card = document.createElement("div"); card.className = "card";
  card.textContent = `${emojiOf(items[win])} ${items[win]} ${emojiOf(items[win])}`;
  $("result").replaceChildren(card);
  burst();
  try { navigator.vibrate && navigator.vibrate([80, 40, 80]); } catch {}
  await wait(2200);
  setState("idle"); busy = false; $("spin").disabled = false;
}

function renderList() {
  const ul = $("list"); ul.textContent = "";
  items.forEach((t, i) => {
    const li = document.createElement("li");
    const s = document.createElement("span"); s.textContent = `${emojiOf(t)} ${t}`;
    const b = document.createElement("button"); b.textContent = "✕"; b.setAttribute("aria-label", t + "をけす");
    b.disabled = items.length <= 2;
    b.onclick = () => { items.splice(i, 1); persist(); };
    li.append(s, b); ul.append(li);
  });
}
function persist() { save(); renderList(); }

$("spin").onclick = () => spin();
$("add").onsubmit = (e) => {
  e.preventDefault();
  const v = $("newItem").value.trim();
  if (v && items.length < 12) { items.push(v); $("newItem").value = ""; persist(); }
};
$("reset").onclick = () => { items = [...DEFAULTS]; persist(); };

setState("idle"); renderList();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
