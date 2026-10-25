const $ = (id) => document.getElementById(id);
const video = $("video"), ov = $("ov"), g = ov.getContext("2d");
const S = { dt: 0.0333, n: 0, k: 0, mode: "size", sizeTaps: [], pts: [], ready: false };

const GUIDE = {
  size: "ボールがはっきり見えるコマで、ボールの【左のはし】→【右のはし】の順にタップ（直径を測ります）。",
  track: "ボールの【中心】をタップ。自動で数コマ先に進みます。ボールが見えるコマで、2か所以上タップしてください。",
};

function ballDiameterM() {
  const v = $("ball").value;
  return (v === "custom" ? parseFloat($("custom").value) : parseFloat(v)) / 100;
}
const captureFps = () => parseFloat($("fps").value);
const unit = () => Math.max(1, ov.width / 360);   // 画面の大きさにあわせた目印の太さ

function setStatus(t, warn = false) { $("status").textContent = t; $("status").classList.toggle("warn", warn); }

// 動画ファイル内の「1コマの時間」を、ゆっくり再生してコマの時刻から測る（速いとコマ飛びするため）
function detectInterval() {
  return new Promise((resolve) => {
    if (!("requestVideoFrameCallback" in video)) return resolve(null);
    const times = []; let done = false;
    const finish = () => {
      if (done) return; done = true;
      video.pause(); video.playbackRate = 1;
      const u = [...new Set(times.map((t) => +t.toFixed(6)))].sort((a, b) => a - b);
      const d = u.slice(1).map((t, i) => t - u[i]).filter((x) => x > 1e-4);
      if (d.length < 3) return resolve(null);
      const med = [...d].sort((a, b) => a - b)[Math.floor(d.length / 2)];
      const ok = d.filter((x) => x < med * 1.5);                  // 飛んだコマ（倍の間隔）を除く
      const dt = ok.reduce((a, b) => a + b, 0) / ok.length;      // 平均でミリ秒の丸めを均す
      const odd = d.filter((x) => x < med * 0.7 || x > med * 1.5).length / d.length;
      resolve({ dt, odd });
    };
    video.currentTime = 0; video.playbackRate = 0.1;
    video.play().then(() => {
      const cb = (_, meta) => {
        times.push(meta.mediaTime);
        (times.length < 12 && !video.ended) ? video.requestVideoFrameCallback(cb) : finish();
      };
      video.requestVideoFrameCallback(cb);
    }).catch(finish);
    setTimeout(finish, 6000);
  });
}

async function loadFile(file) {
  S.ready = false; S.sizeTaps = []; S.pts = []; S.k = 0;
  $("work").hidden = true; $("resultCard").hidden = true;
  video.src = URL.createObjectURL(file);
  setStatus("動画を読み込んでいます…");
  await new Promise((r, j) => { video.onloadedmetadata = r; video.onerror = () => j(new Error("読み込めません")); }).catch((e) => setStatus(e.message, true));
  if (!video.videoWidth) return;
  ov.width = video.videoWidth; ov.height = video.videoHeight;
  setStatus("コマの間隔を調べています…");
  const r = await detectInterval();
  if (r) {
    S.dt = r.dt;
    setStatus(`コマ間隔: ${(r.dt * 1000).toFixed(2)}ミリ秒（動画ファイル内）。` + (r.odd > 0.2 ? "コマ間隔がバラバラです。スローと通常が混ざっている可能性があります（下の「うまくいかないとき」を見てください）。" : ""), r.odd > 0.2);
  } else {
    S.dt = 1 / 30;
    setStatus("コマ間隔を自動で測れませんでした。1/30秒と仮定しています。下の「くわしい設定」で直してください。", true);
  }
  $("ms").value = (S.dt * 1000).toFixed(2);
  recount(); $("work").hidden = false; S.ready = true; setMode("size"); goto(0);
}
function recount() { S.n = Math.max(1, Math.floor(video.duration / S.dt)); }

function goto(k) {
  S.k = Math.min(Math.max(0, k), S.n - 1);
  video.pause();
  video.currentTime = Math.min((S.k + 0.5) * S.dt, Math.max(0, video.duration - 1e-3));
  label(); draw();
}
const label = () => { $("frameLabel").textContent = `コマ ${S.k + 1} / ${S.n}　（撮影時刻 ${(S.k / captureFps() * 1000).toFixed(1)} ミリ秒）`; };
video.addEventListener("seeked", draw);

function dot(p, color, r, text) {
  g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2);
  g.lineWidth = unit() * 1.6; g.strokeStyle = color; g.stroke();
  g.beginPath(); g.arc(p.x, p.y, unit() * 1.4, 0, Math.PI * 2); g.fillStyle = color; g.fill();
  if (text) { g.font = `bold ${unit() * 11}px sans-serif`; g.fillStyle = color; g.fillText(text, p.x + r + unit() * 3, p.y - r); }
}
function draw() {
  g.clearRect(0, 0, ov.width, ov.height);
  const u = unit();
  if (S.sizeTaps.length) {
    g.strokeStyle = "#00e5ff"; g.lineWidth = u * 1.6;
    if (S.sizeTaps.length === 2) { g.beginPath(); g.moveTo(S.sizeTaps[0].x, S.sizeTaps[0].y); g.lineTo(S.sizeTaps[1].x, S.sizeTaps[1].y); g.stroke(); }
    S.sizeTaps.forEach((p) => dot(p, "#00e5ff", u * 4));
  }
  const pts = [...S.pts].sort((a, b) => a.k - b.k);
  if (pts.length > 1) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.strokeStyle = "#ffeb3b88"; g.lineWidth = u; g.stroke(); }
  pts.forEach((p) => dot(p, p.k === S.k ? "#ff3d71" : "#ffeb3b", u * (p.k === S.k ? 9 : 6), String(p.k + 1)));
  compute();
}

function setMode(m) {
  S.mode = m; $("modeSize").classList.toggle("on", m === "size"); $("modeTrack").classList.toggle("on", m === "track");
  $("guide").textContent = GUIDE[m];
}

ov.addEventListener("pointerdown", (e) => {
  if (!S.ready) return;
  e.preventDefault();
  const r = ov.getBoundingClientRect();
  const p = { x: ((e.clientX - r.left) / r.width) * ov.width, y: ((e.clientY - r.top) / r.height) * ov.height };
  if (S.mode === "size") {
    if (S.sizeTaps.length >= 2) S.sizeTaps = [];
    S.sizeTaps.push(p);
    if (S.sizeTaps.length === 2) { setMode("track"); }
    draw();
  } else {
    S.pts = S.pts.filter((q) => q.k !== S.k); S.pts.push({ k: S.k, ...p });
    const st = Math.max(1, parseInt($("stride").value) || 1);
    goto(S.k + st);
  }
});

// 位置を時間の直線にあてはめて、速さと誤差の目安を出す
function compute() {
  const card = $("resultCard");
  const d = S.sizeTaps.length === 2 ? Math.hypot(S.sizeTaps[0].x - S.sizeTaps[1].x, S.sizeTaps[0].y - S.sizeTaps[1].y) : 0;
  const pts = S.pts;
  const need = [];
  if (!d) need.push("① ボールの大きさ（左右のはし）をタップ");
  if (pts.length < 2) need.push("② ボールの位置を2か所以上タップ");
  if (need.length) { card.hidden = pts.length === 0 && !d; $("result").innerHTML = `<p class="note">あと必要なこと:<br>${need.join("<br>")}</p>`; return; }
  card.hidden = false;
  const fps = captureFps(), n = pts.length;
  const t = pts.map((p) => p.k / fps);
  const mt = t.reduce((a, b) => a + b, 0) / n;
  const sxx = t.reduce((a, b) => a + (b - mt) ** 2, 0);
  if (sxx === 0) { $("result").innerHTML = '<p class="note">ちがうコマで2か所以上タップしてください。</p>'; return; }
  const fit = (key) => {
    const my = pts.reduce((a, p) => a + p[key], 0) / n;
    const v = pts.reduce((a, p, i) => a + (t[i] - mt) * (p[key] - my), 0) / sxx;
    const res = pts.map((p, i) => p[key] - (my + v * (t[i] - mt)));
    const sig = n > 2 ? Math.sqrt(res.reduce((a, b) => a + b * b, 0) / (n - 2)) : 0;
    return { v, rms: sig };
  };
  const fx = fit("x"), fy = fit("y");
  const tapErr = 3 * (ov.width / 1280 || 1);                   // 指でのタップのずれ（ピクセル）
  const sx = Math.max(fx.rms, tapErr), sy = Math.max(fy.rms, tapErr);
  const vpx = Math.hypot(fx.v, fy.v);
  const m = ballDiameterM() / d;                                // メートル / ピクセル
  const ms = vpx * m, kmh = ms * 3.6;
  const dv = Math.sqrt((fx.v * sx / Math.sqrt(sxx)) ** 2 + (fy.v * sy / Math.sqrt(sxx)) ** 2) / (vpx || 1);
  const rel = Math.sqrt((dv / (vpx || 1)) ** 2 + ((tapErr * 1.5) / d) ** 2);
  const span = (Math.max(...pts.map((p) => p.k)) - Math.min(...pts.map((p) => p.k)));
  $("result").innerHTML =
    `<div class="big">${kmh.toFixed(1)} <small>km/h</small></div>` +
    `<dl><dt>秒速</dt><dd>${ms.toFixed(2)} m/秒</dd>` +
    `<dt>ばらつきの目安</dt><dd>±${Math.max(1, rel * 100).toFixed(0)}%（約 ${(kmh * (1 - rel)).toFixed(0)}〜${(kmh * (1 + rel)).toFixed(0)} km/h）</dd>` +
    `<dt>使った点</dt><dd>${n}か所（${span}コマぶん = ${(span / fps * 1000).toFixed(1)}ミリ秒）</dd>` +
    `<dt>画面の縮尺</dt><dd>1ピクセル = ${(m * 1000).toFixed(2)}mm</dd></dl>` +
    `<p class="note">ボールが通り道と同じ奥行きを真横に動いた前提の目安です。重力で曲がる分や、タップのずれは含まれません。</p>`;
}

$("file").addEventListener("change", (e) => e.target.files[0] && loadFile(e.target.files[0]));
$("ball").addEventListener("change", () => { $("customWrap").hidden = $("ball").value !== "custom"; compute(); });
$("custom").addEventListener("input", compute);
$("fps").addEventListener("change", () => { label(); compute(); });
$("ms").addEventListener("change", () => { const v = parseFloat($("ms").value); if (v > 0) { S.dt = v / 1000; recount(); goto(S.k); } });
$("modeSize").onclick = () => setMode("size");
$("modeTrack").onclick = () => setMode("track");
const strideN = () => Math.max(1, parseInt($("stride").value) || 1);
$("bb").onclick = () => goto(S.k - strideN()); $("b1").onclick = () => goto(S.k - 1);
$("f1").onclick = () => goto(S.k + 1);          $("ff").onclick = () => goto(S.k + strideN());
$("undo").onclick = () => { if (S.mode === "size") S.sizeTaps.pop(); else S.pts.pop(); draw(); };
$("reset").onclick = () => { S.sizeTaps = []; S.pts = []; setMode("size"); goto(0); };
