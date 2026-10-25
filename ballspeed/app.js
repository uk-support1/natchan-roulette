const $ = (id) => document.getElementById(id);
const video = $("video"), ov = $("ov"), g = ov.getContext("2d");
const S = { dt: 0.0333, n: 0, k: 0, mode: "size", sizeTaps: [], pts: [], ready: false, cal: null };

const GUIDE = {
  sizeCal: "保存した基準を使っているので、ここはタップ不要です。【② ボールの位置】に進んでください。",
  size: "長さの基準をタップします。ボールなら、ぶれていないコマ（投げる前など）で【左のはし】→【右のはし】の順に。ぶれて伸びて見えるときは【上のはし】→【下のはし】。小さいときは「画面の拡大」を使ってください。",
  track: "ボールの【中心】をタップ（ぶれて伸びているときは、伸びた全体の真ん中）。自動で数コマ先に進むので、ボールが画面から出るまで続けます（2か所以上、できれば5〜8か所）。",
};

const refM = () => parseFloat($("refCm").value) / 100;     // ①でタップする2点の実際の長さ（m）
const zoomN = () => parseFloat($("zoom").value) || 1;
const captureFps = () => parseFloat($("fps").value);
const unit = () => Math.max(0.5, ov.width / 360 / zoomN());   // 画面上で同じ太さに見える目印

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

// ---- 保存した基準（端末内のみ。localStorage）----
const CAL_KEY = "ballspeed:cals:v1";
function cals() { try { const v = JSON.parse(localStorage.getItem(CAL_KEY)); return Array.isArray(v) ? v : []; } catch { return []; } }
function storeCals(l) { try { localStorage.setItem(CAL_KEY, JSON.stringify(l)); } catch {} }
const calLabel = (c) => `${c.name}（1px=${(c.mPerPx * 1000).toFixed(2)}mm・${c.w}×${c.h}・${c.fps}コマ/秒）`;
function refreshCalSel(selectId = $("calSel").value) {
  const sel = $("calSel"); sel.length = 1;
  cals().forEach((c) => { const o = document.createElement("option"); o.value = c.id; o.textContent = calLabel(c); sel.append(o); });
  sel.value = cals().some((c) => c.id === selectId) ? selectId : "";
}
function calCheck(c) {
  if (!ov.width) return { ok: true, msg: "" };
  if (Math.abs((c.w / c.h) / (ov.width / ov.height) - 1) > 0.02) return { ok: false, msg: "動画の縦横の比率が、基準を撮った動画と違うので使えません。" };
  let msg = ov.width !== c.w ? `解像度が違います（基準 ${c.w}×${c.h}／この動画 ${ov.width}×${ov.height}）。縮尺は換算しますが、撮影の位置と撮影モードは同じにしてください。` : "";
  if (c.fps !== captureFps()) msg += `基準を撮ったときの撮影コマ数は${c.fps}でした。撮影モードが違うと写る範囲が変わることがあります。`;
  return { ok: true, msg };
}
function applyCal(setModeToo = true) {
  const c = cals().find((x) => x.id === $("calSel").value);
  const r = c ? calCheck(c) : { ok: true, msg: "" };
  S.cal = c && r.ok ? c : null;
  $("calInfo").textContent = c ? (r.ok ? `保存した基準を使います。${r.msg}` : r.msg) : "";
  $("calInfo").classList.toggle("warn", !!(c && (!r.ok || r.msg)));
  $("calDel").hidden = !c;
  if (setModeToo && S.ready) setMode(S.cal ? "track" : "size");
  compute();
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
    const guess = [240, 120, 60, 30].find((f) => Math.abs(r.dt * f - 1) < 0.12);
    if (guess) $("fps").value = String(guess);
    setStatus(`コマ間隔: ${(r.dt * 1000).toFixed(2)}ミリ秒（動画ファイル内）。` +
      (guess ? `→ ${guess}コマ/秒の動画と判断して、撮影コマ数を自動で合わせました。` + (guess <= 60 ? "スローモーションで撮ったのにこの表示なら、上の「撮影したコマ数」を選び直してください。" : "") : "撮影したコマ数は、上で手動で選んでください。") +
      (r.odd > 0.2 ? "コマ間隔がバラバラです。スローと通常が混ざっている可能性があります（下の「うまくいかないとき」を見てください）。" : ""), r.odd > 0.2 || (guess && guess <= 60));
  } else {
    S.dt = 1 / 30;
    setStatus("コマ間隔を自動で測れませんでした。1/30秒と仮定しています。下の「くわしい設定」で直してください。", true);
  }
  $("ms").value = (S.dt * 1000).toFixed(2);
  recount(); $("work").hidden = false; S.ready = true; setMode("size"); applyCal(); goto(0);
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
  $("guide").textContent = (m === "size" && S.cal) ? GUIDE.sizeCal : GUIDE[m];
}

ov.addEventListener("click", (e) => {
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

function warns(kmh, rel, d) {
  const w = [];
  if (kmh > 160) w.push("速すぎます。「撮影したコマ数」が動画と合っているか（普通の動画は30や60コマ/秒）と、①の長さの基準を確認してください。");
  if (rel > 0.3 && d) w.push(`基準にした2点が画面で小さく（約${d.toFixed(0)}ピクセル）、タップのずれが大きく響いています。「画面の拡大」で拡大して①をやり直すか、ボールがもっと大きく写る動画で測ってください。`);
  return w.map((t) => `<div class="warnbox">⚠️ ${t}</div>`).join("");
}

// 位置を時間の直線にあてはめて、速さと誤差の目安を出す
function compute() {
  const card = $("resultCard");
  $("saveRow").hidden = !(S.sizeTaps.length === 2 && !S.cal);
  const d = S.sizeTaps.length === 2 ? Math.hypot(S.sizeTaps[0].x - S.sizeTaps[1].x, S.sizeTaps[0].y - S.sizeTaps[1].y) : 0;
  const pts = S.pts;
  const need = [];
  if (!d && !S.cal) need.push("① 長さの基準（ボールの両はしなど）をタップ");
  if (pts.length < 2) need.push("② ボールの位置を2か所以上タップ");
  if (need.length) { card.hidden = pts.length === 0 && !d && !S.cal; $("result").innerHTML = `<p class="note">あと必要なこと:<br>${need.join("<br>")}</p>`; return; }
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
  const shownW = ov.getBoundingClientRect().width || 360;
  const tapErr = 2.5 * (ov.width / shownW);                    // 指のタップのずれ（動画のピクセル換算。画面で約2.5px）
  const sx = Math.max(fx.rms, tapErr), sy = Math.max(fy.rms, tapErr);
  const vpx = Math.hypot(fx.v, fy.v);
  const m = S.cal ? S.cal.mPerPx * (S.cal.w / ov.width) : refM() / d;                                // メートル / ピクセル
  const ms = vpx * m, kmh = ms * 3.6;
  const dv = Math.sqrt((fx.v * sx / Math.sqrt(sxx)) ** 2 + (fy.v * sy / Math.sqrt(sxx)) ** 2) / (vpx || 1);
  const relScale = S.cal ? Math.hypot(S.cal.rel, 0.05) : (tapErr * 1.5) / d;   // 保存基準は、通り道の奥行きのずれ(約5%)も見込む
  const rel = Math.sqrt((dv / (vpx || 1)) ** 2 + relScale ** 2);
  const span = (Math.max(...pts.map((p) => p.k)) - Math.min(...pts.map((p) => p.k)));
  $("result").innerHTML =
    `<div class="big">${kmh.toFixed(1)} <small>km/h</small></div>` +
    `<dl><dt>秒速</dt><dd>${ms.toFixed(2)} m/秒</dd>` +
    `<dt>ばらつきの目安</dt><dd>±${Math.max(1, rel * 100).toFixed(0)}%（約 ${(kmh * (1 - rel)).toFixed(0)}〜${(kmh * (1 + rel)).toFixed(0)} km/h）</dd>` +
    `<dt>撮影コマ数</dt><dd>${fps}コマ/秒</dd>` +
    `<dt>使った点</dt><dd>${n}か所（${span}コマぶん = ${(span / fps * 1000).toFixed(1)}ミリ秒）</dd>` +
    `<dt>基準</dt><dd>${S.cal ? "保存した「" + S.cal.name.replace(/[<>&]/g, "") + "」" : "この動画で測った長さ"}</dd>` +
    `<dt>画面の縮尺</dt><dd>1ピクセル = ${(m * 1000).toFixed(2)}mm</dd></dl>` +
    warns(kmh, rel, S.cal ? 0 : d) +
    `<p class="note">${S.cal ? "ボールが基準と同じ奥行き（同じ線の上）を通った前提です。通り道が基準よりカメラ寄り・奥側にずれると、その割合だけ速さがずれます。" : "ボールが通り道と同じ奥行きを真横に動いた前提の目安です。"}重力で曲がる分や、タップのずれは含まれません。</p>`;
}

$("file").addEventListener("change", (e) => e.target.files[0] && loadFile(e.target.files[0]));
$("ball").addEventListener("change", () => { $("refCm").value = $("ball").value; compute(); });
$("refCm").addEventListener("input", compute);
$("zoom").addEventListener("change", () => { $("stage").style.width = zoomN() * 100 + "%"; draw(); });
$("fps").addEventListener("change", () => { label(); applyCal(false); });
$("ms").addEventListener("change", () => { const v = parseFloat($("ms").value); if (v > 0) { S.dt = v / 1000; recount(); goto(S.k); } });
$("calSel").addEventListener("change", () => applyCal());
$("calDel").onclick = () => { storeCals(cals().filter((c) => c.id !== $("calSel").value)); refreshCalSel(""); applyCal(); };
$("calSave").onclick = () => {
  if (S.sizeTaps.length !== 2) return;
  const d = Math.hypot(S.sizeTaps[0].x - S.sizeTaps[1].x, S.sizeTaps[0].y - S.sizeTaps[1].y);
  const tapErr = 2.5 * (ov.width / (ov.getBoundingClientRect().width || 360));
  const c = { id: String(Date.now()), name: $("calName").value.trim() || `基準 ${new Date().toLocaleDateString("ja-JP")}`,
    mPerPx: refM() / d, w: ov.width, h: ov.height, fps: captureFps(), refCm: parseFloat($("refCm").value), rel: (tapErr * 1.5) / d, savedAt: Date.now() };
  storeCals([c, ...cals()].slice(0, 8));
  refreshCalSel(c.id); applyCal(); $("calName").value = "";
};
$("modeSize").onclick = () => setMode("size");
$("modeTrack").onclick = () => setMode("track");
const strideN = () => Math.max(1, parseInt($("stride").value) || 1);
$("bb").onclick = () => goto(S.k - strideN()); $("b1").onclick = () => goto(S.k - 1);
$("f1").onclick = () => goto(S.k + 1);          $("ff").onclick = () => goto(S.k + strideN());
$("undo").onclick = () => { if (S.mode === "size") S.sizeTaps.pop(); else S.pts.pop(); draw(); };
$("reset").onclick = () => { S.sizeTaps = []; S.pts = []; setMode(S.cal ? "track" : "size"); goto(0); };
refreshCalSel("");
