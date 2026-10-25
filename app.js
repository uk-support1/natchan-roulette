const DEFAULTS = ["おえかき","おままごと","おにごっこ","すなあそび","ブロック","パズル","おうたをうたう","かくれんぼ"];
const COLORS = ["#ff8fa3","#ffc971","#fff07a","#a8e6a1","#8fd3ff","#c3a6ff","#ffb08f","#9ee7d7"];
const KEY = "natchan-roulette:items";

const $ = (id) => document.getElementById(id);
const canvas = $("wheel"), ctx = canvas.getContext("2d");
const chara = $("chara"), bubble = $("bubble");

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

function draw() {
  const n = items.length, seg = (Math.PI * 2) / n, r = canvas.width / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(r, r);
  ctx.rotate(angle);
  items.forEach((label, i) => {
    const a0 = -Math.PI / 2 + i * seg;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r - 6, a0, a0 + seg); ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.stroke();
    ctx.save();
    ctx.rotate(a0 + seg / 2);
    ctx.fillStyle = "#4a3320"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.font = `bold ${n > 10 ? 28 : 34}px "Hiragino Maru Gothic ProN","Yu Gothic",sans-serif`;
    ctx.fillText(label, r - 34, 0, r - 90);
    ctx.restore();
  });
  ctx.restore();
  ctx.beginPath(); ctx.arc(r, r, 22, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
  ctx.strokeStyle = "#4a3320"; ctx.lineWidth = 4; ctx.stroke();
}

const say = (t) => { bubble.textContent = t; };
const setState = (...cls) => { chara.setAttribute("class", "chara " + cls.join(" ")); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => 1 - Math.pow(1 - t, 3);

function animateTo(target, ms) {
  const from = angle, delta = target - from;
  return new Promise((res) => {
    const t0 = performance.now();
    (function step(now) {
      const t = Math.min(1, (now - t0) / ms);
      angle = from + delta * ease(t);
      draw();
      t < 1 ? requestAnimationFrame(step) : res();
    })(t0);
  });
}

async function spin() {
  if (busy) return;
  busy = true; $("spin").disabled = true; $("result").textContent = "";
  const n = items.length, seg = (Math.PI * 2) / n, TAU = Math.PI * 2;
  const win = Math.floor(Math.random() * n);                 // 結果は最初に公平に決める
  const jitter = (Math.random() - 0.5) * seg * 0.6;
  const rest = (((-(win + 0.5) * seg - jitter) % TAU) + TAU) % TAU;
  const base = angle - (((angle % TAU) + TAU) % TAU);        // 現在の整数周回位置
  const final = base + TAU * (4 + Math.floor(Math.random() * 3)) + rest;

  const clumsy = Math.random();
  setState("spinning");
  say(clumsy < 0.3 ? "えいっ！…あれ、かたい…" : "えいっ！");
  if (clumsy < 0.3) {                                        // ぶきっちょ①: 空まわりしてから本番
    await animateTo(angle + 0.25, 500); await wait(300);
    say("もういっかい…！");
  }
  const overshoot = clumsy > 0.6 && clumsy < 0.85;           // ぶきっちょ②: 行きすぎて戻る
  await animateTo(overshoot ? final + seg * 0.9 : final, 4200);
  if (overshoot) {
    setState("oops"); say("あっ！いきすぎた〜");
    await wait(600); await animateTo(final, 700);
  }
  const trip = clumsy >= 0.85;                               // ぶきっちょ③: ころぶ
  if (trip) { setState("trip", "oops"); say("わわっ…ころんだ！"); await wait(1200); }

  setState("happy");
  say(`${items[win]}、だって！`);
  $("result").textContent = `🎉 ${items[win]} 🎉`;
  await wait(1500);
  setState("idle"); busy = false; $("spin").disabled = false;
}

function renderList() {
  const ul = $("list"); ul.textContent = "";
  items.forEach((t, i) => {
    const li = document.createElement("li");
    const s = document.createElement("span"); s.textContent = t;
    const b = document.createElement("button"); b.textContent = "✕"; b.setAttribute("aria-label", t + "をけす");
    b.disabled = items.length <= 2;
    b.onclick = () => { items.splice(i, 1); persist(); };
    li.append(s, b); ul.append(li);
  });
}
function persist() { save(); renderList(); draw(); }

$("spin").onclick = spin;
$("add").onsubmit = (e) => {
  e.preventDefault();
  const v = $("newItem").value.trim();
  if (v && items.length < 12) { items.push(v); $("newItem").value = ""; persist(); }
};
$("reset").onclick = () => { items = [...DEFAULTS]; persist(); };

setState("idle"); renderList(); draw();
