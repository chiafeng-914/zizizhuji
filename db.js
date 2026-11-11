// 字字珠璣｜資料庫連線（Firebase）
// 學生：匿名登入＋班級代碼＋座號＋4 位數密碼；老師：電子郵件／密碼。
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
export const TEACHER_EMAIL = "chiafeng@dssh.tyc.edu.tw";
let fb = null;

async function load() {
  if (fb) return fb;
  const [appM, A, F] = await Promise.all([
    import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js")
  ]);
  const app = appM.initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  let db;
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache() }); } // 離線時先存在手機，連線後補傳
  catch (e) { db = F.getFirestore(app); }
  await new Promise((res) => { const off = A.onAuthStateChanged(auth, () => { off(); res(); }); });
  fb = { auth, db, A, F };
  return fb;
}

async function anyUser() {
  const { auth, A } = await load();
  if (!auth.currentUser) await A.signInAnonymously(auth);
  return auth.currentUser;
}

export const normCode = (s) => String(s || "").trim().toUpperCase();
export const sidOf = (code, seat) => `${normCode(code)}_${Number(seat)}`;

async function hashPin(sid, pin) {
  const data = new TextEncoder().encode(`${sid}:${pin}:zizizhuji`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const ref = (F, db, ...path) => F.doc(db, ...path);

// ---------- 學生 ----------
export async function getClass(code) {
  await anyUser(); const { db, F } = fb;
  const s = await F.getDoc(ref(F, db, "classes", normCode(code)));
  return s.exists() ? { code: s.id, ...s.data() } : null;
}

export async function getStudent(sid) {
  await anyUser(); const { db, F } = fb;
  const s = await F.getDoc(ref(F, db, "students", sid));
  return s.exists() ? s.data() : null;
}

export async function register({ code, seat, nickname, pin }) {
  const u = await anyUser(); const { db, F } = fb;
  const sid = sidOf(code, seat), h = await hashPin(sid, pin);
  const b = F.writeBatch(db);
  b.set(ref(F, db, "secrets", sid), { pin: h });
  b.set(ref(F, db, "students", sid), { code: normCode(code), seat: Number(seat), nickname, createdAt: F.serverTimestamp() });
  b.set(ref(F, db, "students", sid, "devices", u.uid), { pin: h, at: F.serverTimestamp() });
  await b.commit();
  return sid;
}

// 密碼錯誤時，安全規則會拒絕寫入 → 回傳 false
export async function login({ code, seat, pin }) {
  const u = await anyUser(); const { db, F } = fb;
  const sid = sidOf(code, seat), h = await hashPin(sid, pin);
  try { await F.setDoc(ref(F, db, "students", sid, "devices", u.uid), { pin: h, at: F.serverTimestamp() }); return true; }
  catch (e) { if (String(e.code || e).includes("permission")) return false; throw e; }
}

export async function loadProgress(sid) {
  await anyUser(); const { db, F } = fb;
  const s = await F.getDoc(ref(F, db, "progress", sid));
  return s.exists() ? (s.data().boxes || {}) : {};
}

export async function saveProgress(sid, boxes) {
  await anyUser(); const { db, F } = fb;
  return F.setDoc(ref(F, db, "progress", sid), { boxes, updatedAt: F.serverTimestamp() });
}

export async function logAnswer({ code, sid, qid, ok, given }) {
  const u = await anyUser(); const { db, F } = fb;
  return F.addDoc(F.collection(db, "answers"), { code, sid, qid, ok, given: given || "", uid: u.uid, at: F.serverTimestamp() });
}

// ---------- 老師 ----------
export async function teacherState() {
  const { auth } = await load();
  const u = auth.currentUser;
  return u && u.email === TEACHER_EMAIL ? u : null;
}
export async function teacherSignIn(pw, create) {
  const { auth, A } = await load();
  if (create) await A.createUserWithEmailAndPassword(auth, TEACHER_EMAIL, pw);
  else await A.signInWithEmailAndPassword(auth, TEACHER_EMAIL, pw);
  return auth.currentUser;
}
export async function teacherSignOut() { const { auth, A } = await load(); await A.signOut(auth); }

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉容易混淆的 0 O 1 I
export async function createClass({ name, seatMin, seatMax }) {
  const { db, F } = await load();
  for (let t = 0; t < 5; t++) {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => ALPHA[x % ALPHA.length]).join("");
    const r = ref(F, db, "classes", code);
    if ((await F.getDoc(r)).exists()) continue;
    await F.setDoc(r, { name, seatMin: Number(seatMin), seatMax: Number(seatMax), teacher: TEACHER_EMAIL, createdAt: F.serverTimestamp() });
    return code;
  }
  throw new Error("代碼產生失敗，請再試一次");
}
export async function listClasses() {
  const { db, F } = await load();
  const s = await F.getDocs(F.query(F.collection(db, "classes"), F.where("teacher", "==", TEACHER_EMAIL)));
  return s.docs.map((d) => ({ code: d.id, ...d.data() }));
}
export async function listStudents(code) {
  const { db, F } = await load();
  const s = await F.getDocs(F.query(F.collection(db, "students"), F.where("code", "==", code)));
  return s.docs.map((d) => ({ sid: d.id, ...d.data() })).sort((a, b) => a.seat - b.seat);
}
export async function resetPin(sid, pin) {
  const { db, F } = await load();
  await F.setDoc(ref(F, db, "secrets", sid), { pin: await hashPin(sid, pin) });
}

// ---------- 老師：修改與刪除 ----------
export async function updateClass(code, { name, seatMin, seatMax }) {
  const { db, F } = await load();
  await F.updateDoc(ref(F, db, "classes", code), { name, seatMin: Number(seatMin), seatMax: Number(seatMax) });
}

// 分批刪除（Firestore 一次最多 500 筆）
async function deleteRefs(refs) {
  const { db, F } = await load();
  for (let i = 0; i < refs.length; i += 400) {
    const b = F.writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
}

// 刪除一位學生：基本資料、密碼、登入過的裝置、錯題本、作答紀錄，讓這個座號可以重新註冊
async function studentRefs(sid, withAnswers) {
  const { db, F } = await load();
  const devs = await F.getDocs(F.collection(db, "students", sid, "devices"));
  const refs = devs.docs.map((d) => d.ref);
  refs.push(ref(F, db, "progress", sid), ref(F, db, "secrets", sid), ref(F, db, "students", sid));
  if (withAnswers) {
    const ans = await F.getDocs(F.query(F.collection(db, "answers"), F.where("sid", "==", sid)));
    ans.docs.forEach((d) => refs.unshift(d.ref));
  }
  return refs;
}
export async function deleteStudent(sid) {
  await deleteRefs(await studentRefs(sid, true));
}

// 刪除整個班級：班上所有學生的資料、作答紀錄，最後刪班級本身
export async function deleteClass(code) {
  const { db, F } = await load();
  const students = await listStudents(code);
  let refs = [];
  for (const s of students) refs = refs.concat(await studentRefs(s.sid, false));
  const ans = await F.getDocs(F.query(F.collection(db, "answers"), F.where("code", "==", code)));
  refs = ans.docs.map((d) => d.ref).concat(refs);
  refs.push(ref(F, db, "classes", code));
  await deleteRefs(refs);
}

// ---------- 老師：學習統計 ----------
// 一個班的所有作答紀錄
export async function classAnswers(code) {
  const { db, F } = await load();
  const s = await F.getDocs(F.query(F.collection(db, "answers"), F.where("code", "==", code)));
  return s.docs.map((d) => {
    const x = d.data(), at = x.at && typeof x.at.toDate === "function" ? x.at.toDate() : x.at ? new Date(x.at) : null;
    return Object.assign({}, x, { at });
  });
}
// 每位學生的錯題本（還在盒子裡、尚未畢業的字數）
export async function progressOf(sid) {
  const { db, F } = await load();
  const s = await F.getDoc(ref(F, db, "progress", sid));
  return s.exists() ? (s.data().boxes || {}) : {};
}
