/* 字字珠璣｜第二階段：登入、錯題本、五盒複習（訪客模式不連資料庫） */
(function () {
  "use strict";

  const ROUND = 10;
  const TYPE_NAME = { read: "選出正確讀音", typo: "找出錯別字", form: "同音形近字", poly: "多音字判讀", idiom: "成語應用" };
  const KIND = { ctx: "情境選用", usage: "用法正誤", meaning: "成語釋義", trap: "望文生義" };
  const PUNCT = /[，。、；：？！「」『』（）《》—…\s]/;
  const app = document.getElementById("app");

  const state = {
    level: "全部",   // 全部｜國中｜高中
    type: "全部",    // 全部｜read｜typo｜form｜poly
    round: [], i: 0, results: [],
    answered: false, typoStep: 1, picked: -1, order: [],
    user: null, boxes: {}, reviewIds: new Set(), screen: ""
  };

  // ---------- 小工具 ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pool = () => window.QUESTIONS.filter((q) =>
    (state.level === "全部" || q.level === state.level || (state.level === "古文十五篇" && q.classic) ||
      (q.level === "通用" && state.level !== "古文十五篇")) &&
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

  // ---------- 帳號、錯題本與五盒複習 ----------
  const SKEY = "zz-session";
  const session = {
    get() { try { return JSON.parse(localStorage.getItem(SKEY) || "null"); } catch (e) { return null; } },
    set(v) { try { v ? localStorage.setItem(SKEY, JSON.stringify(v)) : localStorage.removeItem(SKEY); } catch (e) {} }
  };
  let DBM = null;
  const db = async () => DBM || (DBM = await import("./db.js"));
  const INTERVAL = [1, 3, 7, 14];                 // 第 1～4 盒：隔天、3 天、7 天、14 天後再考
  const BOX_NAME = ["", "第一盒・隔天複習", "第二盒・三天後", "第三盒・七天後", "第四盒・十四天後"];
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => ymd(new Date());
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
  const byId = Object.fromEntries(window.QUESTIONS.map((q) => [q.id, q]));
  const active = () => Object.entries(state.boxes).filter(([id, b]) => b.box < 5 && byId[id]);
  const dueList = () => active().filter(([, b]) => b.due <= today()).map(([id]) => byId[id]);
  const shortDate = (s) => s ? `${Number(s.slice(5, 7))}/${Number(s.slice(8))}` : "";

  async function syncProgress() {
    try {
      const m = await db();
      state.boxes = await m.loadProgress(state.user.sid);
      if (state.screen === "home") renderHome();
    } catch (e) { /* 離線時先用手機裡的紀錄 */ }
  }

  function record(q, ok) {
    if (!state.user) return "";
    const b = state.boxes[q.id];
    let status = "";
    if (!ok) { state.boxes[q.id] = { box: 1, due: addDays(INTERVAL[0]) }; status = "in"; }
    else if (b && b.box < 5 && state.reviewIds.has(q.id)) {
      const nb = b.box + 1;
      state.boxes[q.id] = nb >= 5 ? { box: 5, due: "" } : { box: nb, due: addDays(INTERVAL[nb - 1]) };
      status = nb >= 5 ? "grad" : "up";
    }
    const u = state.user;
    db().then((m) => {
      if (status) m.saveProgress(u.sid, state.boxes).catch(() => {});
      m.logAnswer({ code: u.code, sid: u.sid, qid: q.id, ok }).catch(() => {});
    }).catch(() => {});
    return status;
  }

  // ---------- 登入 ----------
  function hero() {
    const d = new Date();
    const v = VERSES[(d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()) % VERSES.length];
    return `
      <header class="hero">
        <div class="hero-side">
          <p class="date"><b>${cnNum(d.getDate())}</b>民國${[...String(d.getFullYear() - 1911)].map((x) => CN[x]).join("")}年・${cnNum(d.getMonth() + 1)}月</p>
          <p class="verse">${esc(v[0])}<cite>——${esc(v[1])}</cite></p>
        </div>
        <div class="vtitle">
          <span class="sub">一字一珠・日拾十顆</span>
          <div style="display:flex;flex-direction:column;align-items:center;gap:14px"><h1>字字珠璣</h1><span class="seal" aria-hidden="true">練字</span></div>
        </div>
      </header>`;
  }

  function busy(form, text) { const b = form.querySelector("button[type=submit]"); b.disabled = true; b.lastChild.textContent = text; }

  function renderLogin(msg, code, seat) {
    state.screen = "login";
    app.innerHTML = `${hero()}
      <form class="section form" id="f">
        <h2>登入</h2>
        <label>班級代碼<input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="6" required placeholder="老師給的六碼" value="${esc(code || "")}"></label>
        <label>座號<input name="seat" type="number" inputmode="numeric" min="1" max="99" required value="${esc(seat || "")}"></label>
        <p class="err" role="alert">${msg ? esc(msg) : ""}</p>
        <button class="primary" type="submit"><span class="dot"></span>下一步</button>
      </form>
      <button class="ghost" id="guest">先不登入，訪客練習</button>
      <p class="hint">訪客練習不會保存紀錄，也沒有錯題本</p>`;
    document.getElementById("guest").addEventListener("click", () => { state.user = null; renderHome(); });
    document.getElementById("f").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, c = f.code.value.trim().toUpperCase(), st = Number(f.seat.value);
      busy(f, "查詢中…");
      try {
        const m = await db();
        const cls = await m.getClass(c);
        if (!cls) return renderLogin("找不到這個班級代碼，請再確認一次。", c, st);
        if (st < cls.seatMin || st > cls.seatMax) return renderLogin(`這個班的座號是 ${cls.seatMin}～${cls.seatMax} 號。`, c, st);
        const sid = m.sidOf(c, st), stu = await m.getStudent(sid);
        stu ? renderPin(cls, st, stu) : renderRegister(cls, st);
      } catch (err) { renderLogin("連不上資料庫，請檢查網路，或先用訪客練習。", c, st); }
    });
  }

  function who(cls, seat) { return `<p class="who">${esc(cls.name)}・${seat} 號</p>`; }
  const pinInput = (name, label) => `<label>${label}<input name="${name}" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required></label>`;

  function finishLogin(cls, seat, nickname, m) {
    state.user = { code: cls.code, seat, sid: m.sidOf(cls.code, seat), nickname, className: cls.name };
    session.set(state.user);
    state.boxes = {};
    renderHome();
    syncProgress();
  }

  function renderPin(cls, seat, stu, msg) {
    state.screen = "login";
    app.innerHTML = `${hero()}
      <form class="section form" id="f">
        ${who(cls, seat)}<h2>${esc(stu.nickname)}，歡迎回來</h2>
        ${pinInput("pin", "請輸入你的 4 位數密碼")}
        <p class="err" role="alert">${msg ? esc(msg) : ""}</p>
        <button class="primary" type="submit"><span class="dot"></span>登入</button>
      </form>
      <button class="ghost" id="back">不是我，重新輸入</button>`;
    document.getElementById("back").addEventListener("click", () => renderLogin("", cls.code));
    document.getElementById("f").addEventListener("submit", async (e) => {
      e.preventDefault(); const f = e.target; busy(f, "確認中…");
      try {
        const m = await db();
        if (await m.login({ code: cls.code, seat, pin: f.pin.value })) finishLogin(cls, seat, stu.nickname, m);
        else renderPin(cls, seat, stu, "密碼不對。忘記密碼的話，請找老師重設。");
      } catch (err) { renderPin(cls, seat, stu, "連不上資料庫，請檢查網路後再試。"); }
    });
  }

  function renderRegister(cls, seat, msg) {
    state.screen = "login";
    app.innerHTML = `${hero()}
      <form class="section form" id="f">
        ${who(cls, seat)}<h2>第一次登入</h2>
        <label>暱稱（老師看得到）<input name="nick" maxlength="12" required autocomplete="off"></label>
        ${pinInput("pin", "自訂 4 位數密碼")}
        ${pinInput("pin2", "再輸入一次密碼")}
        <p class="err" role="alert">${msg ? esc(msg) : ""}</p>
        <button class="primary" type="submit"><span class="dot"></span>完成</button>
      </form>
      <button class="ghost" id="back">座號打錯了，重新輸入</button>
      <p class="hint">密碼請記好；換手機登入時會用到</p>`;
    document.getElementById("back").addEventListener("click", () => renderLogin("", cls.code));
    document.getElementById("f").addEventListener("submit", async (e) => {
      e.preventDefault(); const f = e.target;
      const nick = f.nick.value.trim(), pin = f.pin.value;
      if (!/^\d{4}$/.test(pin)) return renderRegister(cls, seat, "密碼要是 4 個數字。");
      if (pin !== f.pin2.value) return renderRegister(cls, seat, "兩次輸入的密碼不一樣。");
      busy(f, "建立中…");
      try { const m = await db(); await m.register({ code: cls.code, seat, nickname: nick, pin }); finishLogin(cls, seat, nick, m); }
      catch (err) { renderRegister(cls, seat, "建立失敗：可能這個座號剛被別人用了，請找老師確認。"); }
    });
  }

  // ---------- 錯題本 ----------
  function renderBook() {
    state.screen = "book";
    const list = active();
    const grad = Object.values(state.boxes).filter((b) => b.box >= 5).length;
    const due = dueList().length;
    const groups = [1, 2, 3, 4].map((n) => {
      const items = list.filter(([, b]) => b.box === n).sort((a, b) => a[1].due.localeCompare(b[1].due));
      if (!items.length) return "";
      return `<section class="section"><h2>${BOX_NAME[n]}</h2><ul class="review">${items.map(([id, b]) =>
        `<li><div class="q">${answerHTML(byId[id])}</div><div class="a">${b.due <= today() ? "今天要複習" : `下次複習：${shortDate(b.due)}`}</div></li>`).join("")}</ul></section>`;
    }).join("");
    app.innerHTML = `
      <div class="top"><button class="back" id="home">← 首頁</button></div>
      <h1 class="page-title">錯題本</h1>
      <p class="msg">答錯的字會從第一盒開始，答對一次往後移一盒，連對四次就畢業。</p>
      ${groups || `<p class="msg" style="margin-top:32px">目前沒有錯題，繼續保持。</p>`}
      ${grad ? `<p class="hint">已經畢業 ${grad} 個字</p>` : ""}
      ${due ? `<button class="primary" id="rev"><span class="dot"></span>開始複習（${Math.min(due, ROUND)} 題）</button>` : ""}`;
    document.getElementById("home").addEventListener("click", renderHome);
    const r = document.getElementById("rev");
    if (r) r.addEventListener("click", () => startRound(true));
    window.scrollTo({ top: 0 });
  }

  // ---------- 首頁 ----------
  function renderHome() {
    state.screen = "home";
    const n = pool().length;
    const u = state.user, due = u ? dueList().length : 0, words = u ? active().length : 0;
    app.innerHTML = `
      <div class="userbar">${u ? `<span>${esc(u.className)}・${u.seat} 號・${esc(u.nickname)}</span><button id="logout">登出</button>`
        : `<span>訪客練習</span><button id="login">登入</button>`}</div>
      ${hero()}
      ${u ? `<button class="book" id="book"><span><b>錯題本</b><small>${words ? `收著 ${words} 個字` : "目前沒有錯題"}</small></span>
        <span class="due">${due ? `今日待複習 <b>${due}</b> 題` : "今日已複習完"}</span></button>` : ""}
      <section class="section">
        <h2>程度</h2>
        <div class="tabs">${["全部", "國中", "高中", "古文十五篇"].map((x) => chip("level", x, x, state.level)).join("")}</div>
      </section>
      <section class="section">
        <h2>題型</h2>
        <div class="tabs">${chip("type", "全部", "四種都練", state.type)}${Object.keys(TYPE_NAME).map((k) => chip("type", k, TYPE_NAME[k], state.type)).join("")}</div>
      </section>
      <button class="primary" id="start" ${n || due ? "" : "disabled"}><span class="dot"></span>開始練習</button>
      <p class="hint">${u ? `每回合 ${ROUND} 題，會先放入到期的錯題（最多 5 題）` : `共 ${n} 題・每回合隨機抽 ${Math.min(ROUND, n)} 題・訪客不保存紀錄`}</p>`;
    app.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
      state[b.dataset.group] = b.dataset.value; renderHome();
    }));
    document.getElementById("start").addEventListener("click", () => startRound(false));
    if (u) {
      document.getElementById("book").addEventListener("click", renderBook);
      document.getElementById("logout").addEventListener("click", () => {
        if (!window.confirm("確定要登出嗎？")) return;
        state.user = null; state.boxes = {}; session.set(null); renderLogin();
      });
    } else document.getElementById("login").addEventListener("click", () => renderLogin());
  }

  // reviewOnly：從錯題本按「開始複習」，只考到期的錯題
  function startRound(reviewOnly) {
    const due = state.user ? shuffle(dueList()) : [];
    const pick = reviewOnly ? due.slice(0, ROUND) : due.slice(0, 5);
    const boxed = new Set(active().map(([id]) => id));
    const fresh = reviewOnly ? [] : shuffle(pool().filter((q) => !boxed.has(q.id)));
    state.reviewIds = new Set(pick.map((q) => q.id));
    state.round = shuffle(pick.concat(fresh.slice(0, ROUND - pick.length)));
    if (!state.round.length) return;
    state.i = 0; state.results = [];
    renderQuestion();
  }

  // ---------- 作答 ----------
  function renderQuestion() {
    state.screen = "quiz";
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
        <span class="tag">${state.reviewIds.has(q.id) ? "複習・" : ""}${q.src ? `〈${esc(q.src)}〉` : q.type === "idiom" ? `成語・${KIND[q.kind]}` : `${TYPE_NAME[q.type]}・${q.level}`}</span>
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
    if (q.type === "idiom") {
      const opt = (cls) => state.order.map((o) => `<button class="opt ${cls}" data-v="${esc(o)}">${esc(o)}</button>`).join("");
      if (q.kind === "ctx") return `<p class="ask">空格裡最適合填入哪一個成語？</p>
        <p class="stem">${esc(q.stem).replace("（　）", '<span class="gap">　　　　</span>')}</p><div class="opts">${opt("idiom4")}</div>`;
      if (q.kind === "usage") return `<p class="ask">${esc(q.stem).replace(/「(正確|錯誤)」/, "<b class=\"key\">$1</b>")}</p><div class="opts wide">${opt("sent")}</div>`;
      return `<p class="ask">「${esc(q.idiom)}」是什麼意思？</p>${cells(q.idiom)}<div class="opts wide">${opt("sent")}</div>`;
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
    if (q.type === "idiom") return q.kind === "ctx" ? q.stem.replace("（　）", `「${q.answer}」`) : q.kind === "usage" ? q.answer : `「${q.idiom}」：${q.answer}`;
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
    state.results.push({ q, ok, given, status: record(q, ok) });
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
    state.screen = "summary";
    const grad = state.results.filter((r) => r.status === "grad").length;
    const total = state.results.length;
    const right = state.results.filter((r) => r.ok).length;
    const wrong = state.results.filter((r) => !r.ok);
    const msg = right === total ? "全對！字字珠璣，名副其實。" : right >= total * 0.8 ? "很穩！把錯的幾個字再看一眼。" : "錯的字都整理在下面，明天再來挑戰。";
    app.innerHTML = `
      <div class="score"><div class="num">${right}<small> / ${total}</small></div><span class="seal" aria-hidden="true">${right === total ? "滿分" : "已閱"}</span></div>
      <p class="msg">${msg}</p>
      ${state.user && wrong.length ? `<p class="hint">答錯的 ${wrong.length} 個字已收進錯題本，明天會回來考你。</p>` : ""}
      ${grad ? `<p class="hint">有 ${grad} 個字從錯題本畢業了！</p>` : ""}
      ${wrong.length ? `<section class="section"><h2>這回合答錯的字</h2><ul class="review">
        ${wrong.map((r) => `<li><div class="q">${answerHTML(r.q)}</div><div class="a">${esc(r.q.note)}</div></li>`).join("")}
      </ul></section>` : ""}
      <button class="primary" id="again">再練一回合</button>
      <button class="ghost" id="home">回首頁</button>`;
    document.getElementById("again").addEventListener("click", () => startRound(false));
    document.getElementById("home").addEventListener("click", renderHome);
    window.scrollTo({ top: 0 });
  }

  state.user = session.get();
  if (state.user) { renderHome(); syncProgress(); } else renderLogin();
})();
