/* 字字珠璣｜第一階段：核心練習（尚未連線資料庫） */
(function () {
  "use strict";

  const ROUND = 10;
  const TYPE_NAME = { read: "選出正確讀音", typo: "找出錯別字", form: "同音形近字", poly: "多音字判讀" };
  const PUNCT = /[，。、；：？！「」『』（）《》—…\s]/;
  const app = document.getElementById("app");

  const state = {
    level: "全部",   // 全部｜國中｜高中
    type: "全部",    // 全部｜read｜typo｜form｜poly
    round: [], i: 0, results: [],
    answered: false, typoStep: 1, picked: -1, order: []
  };

  // ---------- 小工具 ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pool = () => window.QUESTIONS.filter((q) =>
    (state.level === "全部" || q.level === state.level || (state.level === "古文十五篇" && q.classic)) &&
    (state.type === "全部" || q.type === state.type));
  const chip = (group, value, label, current) =>
    `<button class="tab" data-group="${group}" data-value="${value}" aria-pressed="${value === current}">${label}</button>`;
  const cells = (text, hl) => `<div class="grid-row" style="--n:${[...text].length}">${[...text].map((c) =>
    c === "＿" ? `<span class="cell empty"></span>` : `<span class="cell${c === hl ? " hl" : ""}">${esc(c)}</span>`).join("")}</div>`;

  // 民國日期（中文數字）與每日一句
  const CN = "〇一二三四五六七八九";
  const cnNum = (n) => n < 10 ? CN[n] : n < 20 ? "十" + (n % 10 ? CN[n % 10] : "") : CN[Math.floor(n / 10)] + "十" + (n % 10 ? CN[n % 10] : "");
  const VERSES = [
    ["學而時習之，不亦說乎", "論語"],
    ["溫故而知新，可以為師矣", "論語"],
    ["讀書百遍，而義自見", "魏略"],
    ["業精於勤，荒於嬉", "韓愈〈進學解〉"],
    ["不積跬步，無以至千里", "荀子〈勸學〉"]
  ];

  // ---------- 首頁 ----------
  function renderHome() {
    const n = pool().length;
    const d = new Date();
    const v = VERSES[(d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()) % VERSES.length];
    app.innerHTML = `
      <header class="hero">
        <div class="hero-side">
          <p class="date"><b>${cnNum(d.getDate())}</b>民國${[...String(d.getFullYear() - 1911)].map((x) => CN[x]).join("")}年・${cnNum(d.getMonth() + 1)}月</p>
          <p class="verse">${esc(v[0])}<cite>——${esc(v[1])}</cite></p>
        </div>
        <div class="vtitle">
          <span class="sub">一字一珠・日拾十顆</span>
          <div style="display:flex;flex-direction:column;align-items:center;gap:14px"><h1>字字珠璣</h1><span class="seal" aria-hidden="true">練字</span></div>
        </div>
      </header>
      <section class="section">
        <h2>程度</h2>
        <div class="tabs">${["全部", "國中", "高中", "古文十五篇"].map((x) => chip("level", x, x, state.level)).join("")}</div>
      </section>
      <section class="section">
        <h2>題型</h2>
        <div class="tabs">${chip("type", "全部", "四種都練", state.type)}${Object.keys(TYPE_NAME).map((k) => chip("type", k, TYPE_NAME[k], state.type)).join("")}</div>
      </section>
      <button class="primary" id="start" ${n ? "" : "disabled"}><span class="dot"></span>開始練習</button>
      <p class="hint">共 ${n} 題・每回合隨機抽 ${Math.min(ROUND, n)} 題・試用版</p>`;
    app.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
      state[b.dataset.group] = b.dataset.value; renderHome();
    }));
    document.getElementById("start").addEventListener("click", startRound);
  }

  function startRound() {
    state.round = shuffle(pool()).slice(0, ROUND);
    state.i = 0; state.results = [];
    renderQuestion();
  }

  // ---------- 作答 ----------
  function renderQuestion() {
    const q = state.round[state.i];
    state.answered = false; state.typoStep = 1; state.picked = -1;
    state.order = q.options ? shuffle(q.options) : [];
    const pct = (state.i / state.round.length) * 100;
    app.innerHTML = `
      <div class="top">
        <button class="back" id="quit" aria-label="回首頁">← 首頁</button>
        <div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
        <span class="count">${state.i + 1} / ${state.round.length}</span>
      </div>
      <article class="card">
        <span class="tag">${q.src ? `〈${esc(q.src)}〉` : `${TYPE_NAME[q.type]}・${q.level}`}</span>
        <div id="qbody">${body(q)}</div>
      </article>
      <div id="fb"></div>`;
    document.getElementById("quit").addEventListener("click", () => {
      if (state.i === 0 || confirmLeave()) renderHome();
    });
    bind(q);
    window.scrollTo({ top: 0 });
  }
  const confirmLeave = () => window.confirm("這一回合還沒做完，確定回首頁嗎？");

  function body(q) {
    if (q.type === "read") {
      return `<p class="ask">「${esc(q.target)}」怎麼念？</p>${cells(q.word, q.target)}${q.quote && q.quote !== q.word && q.quote !== q.src ? `<p class="quote">「${esc(q.quote)}」</p>` : ""}
        <div class="opts">${state.order.map((o) => `<button class="opt zhuyin" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
    }
    if (q.type === "form") {
      return `<p class="ask">空格裡應該填哪個字？</p>${cells(q.phrase.replace("（　）", "＿"))}
        <div class="opts">${state.order.map((o) => `<button class="opt serif" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
    }
    if (q.type === "poly") {
      const mark = (s) => [...s].map((c) => (c === q.char ? `<em>${esc(c)}</em>` : esc(c))).join("");
      return `<p class="ask">哪一組「${esc(q.char)}」的讀音<b>相同</b>？</p>${cells(q.char, q.char)}
        <div class="opts wide">${state.order.map((o) => `<button class="opt pair" data-v="${esc(o)}">${mark(o)}</button>`).join("")}</div>`;
    }
    // typo
    const chars = [...q.sentence].map((c, i) =>
      PUNCT.test(c) ? `<span class="ch punct">${esc(c)}</span>` : `<button class="ch" data-i="${i}">${esc(c)}</button>`).join("");
    return `<p class="step" id="step">第一步：點出寫錯的字</p>
      <div class="sentence">${chars}</div>
      <button class="allright" id="allright">這句沒有錯字</button>
      <div id="fix"></div>`;
  }

  function bind(q) {
    if (q.type !== "typo") {
      app.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => answerChoice(q, b.dataset.v)));
      return;
    }
    app.querySelectorAll(".ch[data-i]").forEach((b) => b.addEventListener("click", () => pickChar(q, Number(b.dataset.i))));
    document.getElementById("allright").addEventListener("click", () => {
      if (state.answered || state.typoStep !== 1) return;
      finish(q, q.wrong === -1, "這句沒有錯字");
    });
  }

  function answerChoice(q, v) {
    if (state.answered) return;
    app.querySelectorAll(".opt").forEach((b) => {
      b.disabled = true;
      if (b.dataset.v === q.answer) b.classList.add("right");
      else if (b.dataset.v === v) b.classList.add("wrong");
    });
    finish(q, v === q.answer, v);
  }

  function pickChar(q, i) {
    if (state.answered || state.typoStep !== 1) return;
    state.picked = i;
    app.querySelectorAll(".ch[data-i]").forEach((b) => b.classList.toggle("picked", Number(b.dataset.i) === i));
    if (i !== q.wrong) { markTruth(q); finish(q, false, [...q.sentence][i]); return; }
    state.typoStep = 2;
    document.getElementById("step").textContent = "找到了！第二步：應該改成哪個字？";
    document.getElementById("allright").remove();
    document.getElementById("fix").innerHTML =
      `<div class="opts">${state.order.map((o) => `<button class="opt serif" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
    app.querySelectorAll("#fix .opt").forEach((b) => b.addEventListener("click", () => {
      if (state.answered) return;
      app.querySelectorAll("#fix .opt").forEach((x) => {
        x.disabled = true;
        if (x.dataset.v === q.answer) x.classList.add("right");
        else if (x.dataset.v === b.dataset.v) x.classList.add("wrong");
      });
      markTruth(q);
      finish(q, b.dataset.v === q.answer, b.dataset.v, true);
    }));
  }

  function markTruth(q) {
    if (q.wrong < 0) return;
    const t = app.querySelector(`.ch[data-i="${q.wrong}"]`);
    if (t) { t.classList.remove("picked"); t.classList.add("truth"); }
  }

  // ---------- 回饋 ----------
  function rightAnswer(q) {
    if (q.type === "read") return `「${q.word}」的「${q.target}」念 ${q.answer}`;
    if (q.type === "form") return q.phrase.replace("（　）", q.answer);
    if (q.type === "poly") return q.answer;
    return q.wrong < 0 ? "這句沒有錯字" : `「${[...q.sentence][q.wrong]}」應改為「${q.answer}」`;
  }

  // 注音不斷行
  const answerHTML = (q) => q.type === "read"
    ? `「${esc(q.word)}」的「${esc(q.target)}」念 <span style="white-space:nowrap">${esc(q.answer)}</span>`
    : esc(rightAnswer(q));

  function finish(q, ok, given, foundPosition) {
    state.answered = true;
    const al = document.getElementById("allright"); if (al) al.disabled = true;
    app.querySelectorAll(".ch[data-i]").forEach((b) => (b.disabled = true));
    state.results.push({ q, ok, given });
    const half = !ok && foundPosition;
    const title = ok ? "答對了" : half ? "找到錯字了，但改法不對" : "再想想";
    const last = state.i === state.round.length - 1;
    document.getElementById("fb").innerHTML = `
      <section class="feedback ${ok ? "ok" : "no"}">
        <span class="stamp" aria-hidden="true">${ok ? "好" : "誤"}</span>
        <p class="verdict">${title}</p>
        <p class="answer">${answerHTML(q)}</p>
        <p class="note">${esc(q.note)}</p>
        ${q.story ? `<details class="story" ${ok ? "" : "open"}><summary>記憶小故事</summary><p>${esc(q.story)}</p></details>` : ""}
        <button class="primary" id="next">${last ? "看結果" : "下一題"}</button>
      </section>`;
    document.getElementById("next").addEventListener("click", () => {
      if (last) renderSummary(); else { state.i++; renderQuestion(); }
    });
    document.getElementById("fb").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ---------- 結算 ----------
  function renderSummary() {
    const total = state.results.length;
    const right = state.results.filter((r) => r.ok).length;
    const wrong = state.results.filter((r) => !r.ok);
    const msg = right === total ? "全對！字字珠璣，名副其實。" : right >= total * 0.8 ? "很穩！把錯的幾個字再看一眼。" : "錯的字都整理在下面，明天再來挑戰。";
    app.innerHTML = `
      <div class="score"><div class="num">${right}<small> / ${total}</small></div><span class="seal" aria-hidden="true">${right === total ? "滿分" : "已閱"}</span></div>
      <p class="msg">${msg}</p>
      ${wrong.length ? `<section class="section"><h2>這回合答錯的字</h2><ul class="review">
        ${wrong.map((r) => `<li><div class="q">${answerHTML(r.q)}</div><div class="a">${esc(r.q.note)}</div></li>`).join("")}
      </ul></section>` : ""}
      <button class="primary" id="again">再練一回合</button>
      <button class="ghost" id="home">回首頁</button>`;
    document.getElementById("again").addEventListener("click", startRound);
    document.getElementById("home").addEventListener("click", renderHome);
    window.scrollTo({ top: 0 });
  }

  renderHome();
})();
