// 字字珠璣｜老師專用頁：建立班級、查看學生、重設密碼
import * as D from "./db.js";

const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ERR = {
  "auth/invalid-credential": "密碼不對，請再試一次。",
  "auth/wrong-password": "密碼不對，請再試一次。",
  "auth/user-not-found": "這個信箱還沒建立帳號，請按「第一次使用」。",
  "auth/email-already-in-use": "這個信箱已經建立過帳號，請直接登入。",
  "auth/weak-password": "密碼至少要 6 個字元。",
  "auth/too-many-requests": "嘗試太多次，請稍後再試。"
};
// 頁面內的對話框：取代瀏覽器的 prompt／confirm／alert（有些瀏覽器會擋掉這些彈出視窗）
function ask({ title, text = "", input = null, ok = "確定", cancel = "取消", danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "dlg";
    wrap.innerHTML = `<div class="dlg-box" role="dialog" aria-modal="true">
      <h3>${esc(title)}</h3>${text ? `<p>${esc(text).replace(/\n/g, "<br>")}</p>` : ""}
      ${input ? `<input class="dlg-in" ${input.type ? `type="${input.type}"` : ""} ${input.inputmode ? `inputmode="${input.inputmode}"` : ""} maxlength="${input.max || 40}" placeholder="${esc(input.placeholder || "")}" autocomplete="off">` : ""}
      <div class="row">${cancel ? `<button class="mini" data-x>${esc(cancel)}</button>` : ""}<button class="mini ${danger ? "danger" : ""}" data-ok>${esc(ok)}</button></div>
    </div>`;
    document.body.appendChild(wrap);
    const inp = wrap.querySelector(".dlg-in");
    const done = (v) => { wrap.remove(); resolve(v); };
    wrap.querySelector("[data-ok]").addEventListener("click", () => done(input ? inp.value : true));
    const x = wrap.querySelector("[data-x]"); if (x) x.addEventListener("click", () => done(input ? null : false));
    if (inp) { inp.focus(); inp.addEventListener("keydown", (e) => { if (e.key === "Enter") done(inp.value); }); }
    else wrap.querySelector("[data-ok]").focus();
  });
}
const say = (title, text) => ask({ title, text, ok: "知道了", cancel: "" });

const msgOf = (e) => ERR[e && e.code] || `發生錯誤：${(e && (e.code || e.message)) || e}`;

function renderSignIn(msg) {
  app.innerHTML = `
    <h1 class="page-title" style="margin-top:28px">老師專用</h1>
    <form class="section form" id="f">
      <p class="who">${esc(D.TEACHER_EMAIL)}</p>
      <label>密碼<input name="pw" type="password" autocomplete="current-password" required minlength="6"></label>
      <p class="err" role="alert">${msg ? esc(msg) : ""}</p>
      <button class="primary" type="submit" name="go"><span class="dot"></span>登入</button>
      <button class="ghost" type="button" id="create">第一次使用：用這個密碼建立帳號</button>
    </form>
    <p class="hint"><a href="./" style="color:inherit">回到學生練習頁</a></p>`;
  const f = document.getElementById("f");
  const go = async (create) => {
    if (!f.reportValidity()) return;
    try { await D.teacherSignIn(f.pw.value, create); renderMain(); }
    catch (e) { renderSignIn(msgOf(e)); }
  };
  f.addEventListener("submit", (e) => { e.preventDefault(); go(false); });
  document.getElementById("create").addEventListener("click", () => go(true));
}

async function renderMain(note) {
  app.innerHTML = `<p class="hint">讀取班級中…</p>`;
  let classes = [];
  try { classes = await D.listClasses(); } catch (e) { app.innerHTML = `<p class="err">${esc(msgOf(e))}</p><p class="hint">若是剛設定好，請確認 Firebase 已貼上安全規則。</p>`; return; }
  classes.sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-Hant"));
  app.innerHTML = `
    <div class="userbar"><span>老師：${esc(D.TEACHER_EMAIL)}</span><button id="out">登出</button></div>
    <h1 class="page-title">我的班級</h1>
    ${note ? `<p class="msg">${esc(note)}</p>` : ""}
    ${classes.length ? classes.map((c) => `
      <section class="cls">
        <h3>${esc(c.name)}</h3>
        <div class="code">${esc(c.code)}</div>
        <div class="meta">座號 ${c.seatMin}～${c.seatMax} 號・請把上面這組代碼給學生</div>
        <div class="row">
          <button class="mini" data-stu="${esc(c.code)}">查看學生</button>
          <button class="mini" data-edit="${esc(c.code)}">修改</button>
          <button class="mini danger" data-del="${esc(c.code)}">刪除班級</button>
        </div>
        <form class="form edit" id="e-${esc(c.code)}" hidden>
          <label>班級名稱<input name="name" required maxlength="20" value="${esc(c.name)}"></label>
          <div class="two">
            <label>座號從<input name="a" type="number" inputmode="numeric" min="1" max="99" value="${c.seatMin}" required></label>
            <label>到<input name="b" type="number" inputmode="numeric" min="1" max="99" value="${c.seatMax}" required></label>
          </div>
          <p class="err"></p>
          <div class="row"><button class="mini" type="submit">儲存</button><button class="mini" type="button" data-cancel>取消</button></div>
        </form>
        <div id="s-${esc(c.code)}"></div>
      </section>`).join("") : `<p class="msg" style="margin-top:20px">還沒有班級，先在下面建立一個。</p>`}
    <form class="section form" id="nc">
      <h2>建立新班級</h2>
      <label>班級名稱<input name="name" required maxlength="20" placeholder="例：301"></label>
      <div class="two">
        <label>座號從<input name="a" type="number" inputmode="numeric" min="1" max="99" value="1" required></label>
        <label>到<input name="b" type="number" inputmode="numeric" min="1" max="99" value="36" required></label>
      </div>
      <p class="err" id="ncerr"></p>
      <button class="primary" type="submit"><span class="dot"></span>建立並產生代碼</button>
    </form>`;
  document.getElementById("out").addEventListener("click", async () => { await D.teacherSignOut(); renderSignIn(); });
  app.querySelectorAll("[data-stu]").forEach((b) => b.addEventListener("click", () => showStudents(b.dataset.stu)));
  const byCode = Object.fromEntries(classes.map((c) => [c.code, c]));

  // 修改班級名稱、座號範圍
  app.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
    const f = document.getElementById(`e-${b.dataset.edit}`); f.hidden = !f.hidden;
  }));
  app.querySelectorAll("form.edit").forEach((f) => {
    const code = f.id.slice(2);
    f.querySelector("[data-cancel]").addEventListener("click", () => { f.hidden = true; });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = f.name.value.trim(), a = Number(f.a.value), b = Number(f.b.value), err = f.querySelector(".err");
      if (!name) { err.textContent = "請填班級名稱。"; return; }
      if (a > b) { err.textContent = "座號範圍不對。"; return; }
      try {
        const out = (await D.listStudents(code)).filter((s) => s.seat < a || s.seat > b);
        if (out.length && !(await ask({ title: "有學生不在新的座號範圍內", text: `${out.map((s) => s.seat + " 號").join("、")}不在 ${a}～${b} 號之間。\n他們的紀錄會保留，但之後無法再登入。`, ok: "仍要儲存" }))) return;
        await D.updateClass(code, { name, seatMin: a, seatMax: b });
        renderMain(`已更新「${name}」：座號 ${a}～${b} 號`);
      } catch (x) { err.textContent = msgOf(x); }
    });
  });

  // 刪除整個班級：要輸入班級名稱確認，避免按錯
  app.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
    const c = byCode[b.dataset.del];
    b.disabled = true; b.textContent = "讀取中…";
    let n = 0; try { n = (await D.listStudents(c.code)).length; } catch (x) {}
    b.disabled = false; b.textContent = "刪除班級";
    const typed = await ask({
      title: `刪除「${c.name}」？`,
      text: `班上 ${n} 位學生的帳號、錯題本與作答紀錄都會一起刪除，無法復原。\n請輸入班級名稱「${c.name}」確認：`,
      input: { placeholder: String(c.name) }, ok: "確定刪除", danger: true
    });
    if (typed === null) return;
    if (typed.trim() !== String(c.name)) { await say("沒有刪除", "輸入的名稱和班級名稱不同。"); return; }
    b.disabled = true; b.textContent = "刪除中…";
    try { await D.deleteClass(c.code); renderMain(`已刪除「${c.name}」`); }
    catch (x) { await say("刪除失敗", msgOf(x)); b.disabled = false; b.textContent = "刪除班級"; }
  }));
  document.getElementById("nc").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target, a = Number(f.a.value), b = Number(f.b.value);
    if (a > b) { document.getElementById("ncerr").textContent = "座號範圍不對。"; return; }
    try { const code = await D.createClass({ name: f.name.value.trim(), seatMin: a, seatMax: b }); renderMain(`已建立「${f.name.value.trim()}」，代碼是 ${code}`); }
    catch (err) { document.getElementById("ncerr").textContent = msgOf(err); }
  });
}

async function showStudents(code) {
  const box = document.getElementById(`s-${code}`);
  box.innerHTML = `<p class="hint">讀取中…</p>`;
  try {
    const list = await D.listStudents(code);
    box.innerHTML = list.length ? `<table><tr><th>座號</th><th>暱稱</th><th></th></tr>${list.map((s) =>
      `<tr><td>${s.seat}</td><td>${esc(s.nickname)}</td><td style="text-align:right;white-space:nowrap"><button class="mini" data-reset="${esc(s.sid)}" data-name="${esc(s.seat)} 號 ${esc(s.nickname)}">重設密碼</button> <button class="mini danger" data-rm="${esc(s.sid)}" data-name="${esc(s.seat)} 號 ${esc(s.nickname)}">刪除</button></td></tr>`).join("")}</table>`
      : `<p class="hint">還沒有學生登入過。</p>`;
    box.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", async () => {
      const pin = await ask({ title: `重設 ${b.dataset.name} 的密碼`, text: "請輸入新的 4 位數密碼：", input: { inputmode: "numeric", max: 4 } });
      if (pin === null) return;
      if (!/^\d{4}$/.test(pin)) { await say("沒有重設", "密碼要是 4 個數字。"); return; }
      try { await D.resetPin(b.dataset.reset, pin); await say("已重設", `請告訴學生新密碼：${pin}`); }
      catch (e) { await say("重設失敗", msgOf(e)); }
    }));
    // 刪除單一學生：座號可以重新註冊
    box.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", async () => {
      if (!(await ask({ title: `刪除 ${b.dataset.name}？`, text: "這位學生的帳號、錯題本與作答紀錄都會刪除，這個座號可以重新註冊。", ok: "確定刪除", danger: true }))) return;
      b.disabled = true;
      try { await D.deleteStudent(b.dataset.rm); showStudents(code); }
      catch (e) { await say("刪除失敗", msgOf(e)); b.disabled = false; }
    }));
  } catch (e) { box.innerHTML = `<p class="err">${esc(msgOf(e))}</p>`; }
}

(async () => {
  try { (await D.teacherState()) ? renderMain() : renderSignIn(); }
  catch (e) { app.innerHTML = `<p class="err">連不上 Firebase：${esc(msgOf(e))}</p>`; }
})();
