// Mô phỏng nhân viên + học viên: mỗi người chạy một "kế hoạch" gồm các bước (đi, chờ, ngồi, nói chuyện...).
// Sự kiện thật từ backend thay kế hoạch; khi rảnh nhân viên tự đi giải lao.
// Chạy theo bước thời gian cố định 60 Hz nên tốc độ không phụ thuộc tần số màn hình.
//
// Bàn: mỗi nhân viên có "bàn mặc định" (ngồi thường ngày) và "bàn làm việc" (khi bật chế độ làm việc
// hoặc khi đang tham gia nhiệm vụ). Hai người muốn cùng một bàn thì người đứng trước trong danh sách được ưu tiên.

import { ISO, project } from "./iso.js";
import { CATALOG, chatPoints, localPoint, rot, runtime, seatPoint, sofaSeats, toWorld, usePoint } from "./furniture.js";
import { findPath, isWalkable, nearestWalkable, reachable, reachableByPlan } from "./pathfinding.js";
import { FLOOR, ROOMS, WINDOWS, entranceInfo, roomAt, segmentHitsWall, windowSpot } from "./floorplan.js";
import { activityLine, classLine, handoffLine, pickConversation, studentLine, teachLine } from "./dialogue.js";
import { studentLook } from "./characters.js";
import { ROLE_COLOR } from "./roles.js";
import { t } from "./i18n.js";

export const TICK_HZ = 60;
const sec = s => Math.round(s * TICK_HZ);
const BUSY = new Set(["working", "thinking", "reviewing"]);
export const isBusyStatus = s => BUSY.has(s);

// Lối vào (mũi tên đỏ) của tầng đang xem.
const doorIn = () => entranceInfo().door;
const IDLE_SPOTS = [[155, 240], [155, 330], [245, 420], [149, 420], [65, 240], [233, 170]];

let tick = 0;
let layout = [];
let layoutVersion = 0;
let printerUntil = 0;
let cabinetUntil = 0;
let microwaveUntil = 0;
export const flags = { breaksPaused: false, workMode: false };
// Hiệu ứng bay trong phòng (cục giấy ném vào thùng rác...). main.js vẽ chúng trên cùng.
export const effects = [];

export const staff = {};      // id -> nhân viên
let agents = [];              // nhân viên theo thứ tự danh sách
const students = [];          // học viên đang có mặt

function blankAgent(id, i) {
  return {
    id, name: "", role: "ta", color: "#8eb1fc", look: null, homeDesk: "", workDesk: "", inJob: false, lesson: null,
    x: 0, y: 0, facing: "S", path: [], plan: [], stepIndex: 0, stepState: null, planKind: "home",
    serverStatus: "idle", serverMessage: "", statusBubble: null, actionBubble: null,
    sitting: false, seatBlend: 0, lift: 0, moving: false, working: false, talking: false,
    holding: null, partner: null, sofaSeat: null, typingUntil: 0, homeVersion: -1,
    nextBreakAt: sec(14 + i * 7 + Math.random() * 8), animationSeed: Math.random() * 280,
  };
}

// Đồng bộ danh sách nhân viên từ hồ sơ: thêm người mới (xuất hiện ở lối vào), cập nhật, bỏ người đã xoá.
// names: id -> tên hiển thị.
export function syncStaff(records, names) {
  const ids = new Set(records.map(r => r.id));
  for (const id of Object.keys(staff)) {
    if (ids.has(id)) continue;
    const a = staff[id];
    if (a.partner) releasePartner(a);
    delete staff[id];
  }
  let changedDesk = false;
  agents = records.map((r, i) => {
    let a = staff[r.id];
    if (!a) {
      a = staff[r.id] = blankAgent(r.id, i);
      const d = doorIn();
      const spawn = nearestWalkable(d.x, d.y - 10) || d;
      Object.assign(a, { x: spawn.x, y: spawn.y, homeVersion: -1, fresh: true });
    }
    if (a.homeDesk !== r.homeDesk || a.workDesk !== r.workDesk) changedDesk = true;
    const floor = r.floor || 9;
    if (a.floor && a.floor !== floor) { a.planKind = "home"; a.plan = [home()]; a.stepIndex = 0; a.stepState = null; a.path = []; a.placed = false; }
    Object.assign(a, {
      name: names[r.id] || r.id, role: r.role, color: ROLE_COLOR[r.role] || "#8eb1fc",
      look: r.look, homeDesk: r.homeDesk || "", workDesk: r.workDesk || "", floor,
    });
    return a;
  });
  if (changedDesk) retarget();
}

export const staffList = () => agents;
export const allAgents = () => [...agents, ...students];
// Chỉ người ở tầng đang xem mới di chuyển / được vẽ (học viên luôn ở tầng có phòng học – tầng 9).
const onHere = a => (a.visitFloor || a.floor || 9) === FLOOR;
const hereAgents = () => agents.filter(onHere);
export const visibleAgents = () => [...hereAgents(), ...(FLOOR === lesson.floor ? students : [])];

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// 8 hướng theo màn hình: đi dọc trục thế giới sẽ ra các hướng chéo (SE/SW/NE/NW) – đúng kiểu isometric.
const SECTORS = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
export function facingFor(dx, dy) {
  const sx = (dx - dy) * ISO.kx, sy = (dx + dy) * ISO.ky;
  const angle = Math.atan2(sy, sx);
  const idx = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return SECTORS[idx];
}
const faceToward = (a, p) => { if (p && dist(a, p) > 0.5) a.facing = facingFor(p.x - a.x, p.y - a.y); };

const itemById = id => (id ? layout.find(it => it.id === id) || null : null);
const seatable = it => it && CATALOG[it.type]?.workDesk;

// Bàn đang "muốn" ngồi: bàn làm việc khi đang làm việc, ngược lại bàn mặc định.
const wantedDesk = a => ((flags.workMode || a.inJob) && a.workDesk ? a.workDesk : a.homeDesk);

let claimTick = -1;
let claims = new Map();
function recomputeClaims() {
  claimTick = tick;
  claims = new Map();
  const used = new Set();
  for (const a of hereAgents()) {
    for (const id of [wantedDesk(a), a.homeDesk]) {
      const d = itemById(id);
      if (!seatable(d) || used.has(d.id)) continue;
      used.add(d.id);
      claims.set(a.id, d);
      break;
    }
  }
}
export function deskOfAgent(a) {
  if (claimTick !== tick) recomputeClaims();
  return claims.get(a.id) || null;
}
export const deskOf = id => (staff[id] ? deskOfAgent(staff[id]) : null);

// Ai đang ngồi (hoặc sẽ ngồi) ở bàn này.
export function ownerOfDesk(item) {
  if (claimTick !== tick) recomputeClaims();
  for (const [id, d] of claims) if (d === item) return staff[id] || null;
  return null;
}

function nearestItem(a, types) {
  // Ưu tiên món đi tới được bình thường; không có thì chấp nhận món chỉ tới được bằng cách lách qua đồ đạc
  // (vd. chỗ ngồi bị tủ + thùng rác vây kín) – findPath sẽ tự cho người đó lách ra.
  let best = null, bestD = Infinity, loose = null, looseD = Infinity;
  for (const it of layout) {
    if (!types.includes(it.type)) continue;
    const p = usePoint(it);
    if (!p) continue;
    const d = dist(a, p);
    if (reachable(a, p)) { if (d < bestD) { bestD = d; best = it; } }
    else if (reachableByPlan(a, p) && isWalkableNear(p) && d < looseD) { looseD = d; loose = it; }
  }
  return best || loose;
}
const isWalkableNear = p => { const w = nearestWalkable(p.x, p.y); return !!w && dist(w, p) < 14; };

function idleSpot(a) {
  const k = Math.max(0, agents.indexOf(a)) % IDLE_SPOTS.length;
  const [x, y] = IDLE_SPOTS[k];
  return nearestWalkable(x, y) || { x, y };
}

function homeTarget(a) {
  const desk = deskOfAgent(a);
  return desk ? seatPoint(desk) : idleSpot(a);
}

function besideDesk(id) {
  const desk = deskOf(id);
  if (desk) {
    for (const u of [42, -42]) {
      const p = localPoint(desk, u, 48);
      const w = nearestWalkable(p.x, p.y);
      if (w && dist(w, p) < 12) return w;
    }
    const s = seatPoint(desk);
    return nearestWalkable(s.x + 18, s.y + 18);
  }
  const t = staff[id];
  return t ? nearestWalkable(t.x + 22, t.y + 10) : null;
}

// Mọi người đang ở "nhà" tính lại chỗ ngồi (đổi bàn / bật chế độ làm việc / vào-ra nhiệm vụ).
function retarget() {
  layoutVersion++;
  for (const a of agents) if (a.plan[a.stepIndex]?.type === "home") { a.path = []; a.homeVersion = -1; }
}

export function setWorkMode(on) {
  flags.workMode = !!on;
  retarget();
}
export function setInJob(ids, on) {
  for (const id of ids) if (staff[id]) staff[id].inJob = !!on;
  if (!on) for (const a of agents) a.inJob = false;
  retarget();
}

// ---------------------------------------------------------------------------
// Bước của kế hoạch
// ---------------------------------------------------------------------------
const go = (to, o = {}) => ({ type: "go", to, ...o });
const wait = (seconds, o = {}) => ({ type: "wait", ticks: sec(seconds), ...o });
const slide = (to, o = {}) => ({ type: "slide", to, ...o });
const home = (o = {}) => ({ type: "home", ...o });

function setPlan(a, kind, steps) {
  if (a.partner && kind !== "break") releasePartner(a);
  a.sofaSeat = null;
  a.planKind = kind;
  a.plan = steps;
  a.stepIndex = 0;
  a.stepState = null;
  a.path = [];
  a.actionBubble = null;
  a.talking = false;
  a.sitting = false;
}

function releasePartner(a) {
  const p = a.partner && staff[a.partner];
  a.partner = null;
  if (p && p.partner === a.id) {
    p.partner = null;
    if (p.planKind === "break") setPlan(p, "home", [home()]);
  }
}

function nextStep(a) {
  a.stepIndex++;
  a.stepState = null;
}

function enterStep(a, s) {
  a.stepState = { start: tick };
  a.holdStart = tick; // cho các cử chỉ có diễn biến theo thời gian (vo giấy, ném)
  a.actionBubble = s.bubble ? { text: typeof s.bubble === "function" ? s.bubble() : s.bubble, tone: s.tone || "ok" } : null;
  a.holding = s.holding ?? null;
  a.sitting = !!s.sit;
  a.talking = !!s.speak;
  if (s.onStart) s.onStart(a);
  if (s.type === "go") {
    const target = s.to();
    a.stepState.target = target;
    a.path = target ? findPath(a, target) : [];
  } else if (s.type === "slide") {
    a.stepState.target = s.to();
  } else if (s.type === "home") {
    // Mọi kế hoạch đều kết thúc bằng việc về chỗ: từ đây người này được coi là "ở nhà" (rảnh thì được đi giải lao).
    if (a.partner) releasePartner(a);
    a.planKind = "home";
    a.homeVersion = -1;
  }
}

// Đang ngồi mà phải đi: đứng dậy hẳn trước rồi mới bước (không trượt đi trong tư thế ngồi).
function standUp(a) {
  a.sitting = false;
  return a.seatBlend <= 0.15;
}

function followPath(a, fast) {
  if (!a.path.length) return true;
  if (!standUp(a)) return false;
  const t = a.path[0];
  const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy);
  const speed = fast ? 1.45 : 0.95;
  if (d <= speed) { a.x = t.x; a.y = t.y; a.path.shift(); } else { a.x += (dx / d) * speed; a.y += (dy / d) * speed; }
  if (d > 0.01) a.facing = facingFor(dx, dy);
  a.moving = true;
  return a.path.length === 0;
}

function applyFace(a, face) {
  if (!face) return;
  if (typeof face === "string") { a.facing = face; return; }
  const p = typeof face === "function" ? face() : face;
  if (p) faceToward(a, p);
}

function runPlan(a) {
  const s = a.plan[a.stepIndex];
  if (!s) { if (a.student) return; setPlan(a, "home", [home()]); return; }
  if (!a.stepState) enterStep(a, s);

  switch (s.type) {
    case "go":
      if (!a.stepState.target || followPath(a, s.fast)) nextStep(a);
      break;
    case "slide": {
      const t = a.stepState.target;
      if (!t) { nextStep(a); break; }
      const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy);
      const v = s.speed || 0.7;
      if (d > v && !s.sit && !standUp(a)) break;
      if (d <= v) { a.x = t.x; a.y = t.y; nextStep(a); } else { a.x += (dx / d) * v; a.y += (dy / d) * v; a.moving = true; if (!s.keepFacing) a.facing = facingFor(dx, dy); }
      break;
    }
    case "wait":
      applyFace(a, s.face);
      if (s.speak) a.talking = tick - a.stepState.start < s.ticks - sec(0.6);
      if (s.ink && (tick - a.stepState.start) % 28 === 0) runtime.boardInk = Math.min(8, runtime.boardInk + 1);
      if (s.erase && (tick - a.stepState.start) % 14 === 7) runtime.boardInk = Math.max(0, runtime.boardInk - 1);
      if (s.every) s.every(a, tick - a.stepState.start);
      if (tick - a.stepState.start >= s.ticks || (s.until && s.until(a))) nextStep(a);
      break;
    case "chat":
      chatTick(a, s);
      break;
    case "home":
      homeTick(a, s);
      break;
    case "do":
      s.fn(a);
      nextStep(a);
      break;
  }
}

function homeTick(a, s) {
  if (a.path.length) { followPath(a, s.fast); return; }
  const target = homeTarget(a);
  if (dist(a, target) > 3 && a.homeVersion !== layoutVersion) {
    a.homeVersion = layoutVersion;
    a.path = findPath(a, target);
    return;
  }
  const desk = deskOfAgent(a);
  if (desk && dist(a, target) <= 3) {
    a.sitting = true;
    a.holding = null;
    faceToward(a, desk);
  } else {
    a.sitting = false;
    if (dist(a, target) <= 3) { a.facing = "S"; a.holding = null; }
  }
}

const atHome = a => a.planKind === "home" && a.path.length === 0 && dist(a, homeTarget(a)) <= 3;

// ---------------------------------------------------------------------------
// Tán gẫu: hai người dùng chung một kịch bản hội thoại và lần lượt nói từng câu.
// ---------------------------------------------------------------------------
function chatTick(a, s) {
  const c = s.convo;
  const other = staff[s.other];
  if (!other) { nextStep(a); return; }
  applyFace(a, other);
  if (a.partner !== s.other) { nextStep(a); return; }
  const otherReady = other.plan[other.stepIndex]?.type === "chat" && !other.moving;
  if (!otherReady) {
    a.actionBubble = null;
    a.talking = false;
    if (tick - a.stepState.start > sec(15)) nextStep(a); // đợi mãi không thấy -> về
    return;
  }
  if (s.me === 0 && tick >= c.nextAt) {
    c.index++;
    if (c.index < c.lines.length) c.nextAt = tick + sec(1.8 + c.lines[c.index][1].length * 0.045);
  }
  if (c.index >= c.lines.length) {
    a.actionBubble = null;
    a.talking = false;
    if (tick >= c.nextAt + sec(0.8)) nextStep(a);
    return;
  }
  if (c.index < 0) return;
  const [who, text] = c.lines[c.index];
  const mine = who === s.me;
  a.actionBubble = mine ? { text, tone: "speech" } : null;
  a.talking = mine && tick < c.nextAt - sec(0.5);
}

function startChat(a, b, [pa, pb]) {
  const convo = { lines: pickConversation(a.role, b.role), index: -1, nextAt: 0 };
  const plan = (other, spot, me) => [
    go(() => spot, { bubble: t("sim.goChat") }),
    { type: "chat", convo, me, other: other.id },
    home(),
  ];
  setPlan(a, "break", plan(b, pa, 0));
  setPlan(b, "break", plan(a, pb, 1));
  a.partner = b.id;
  b.partner = a.id;
  b.nextBreakAt = tick + sec(30 + Math.random() * 30);
}

// ---------------------------------------------------------------------------
// Giải lao
// ---------------------------------------------------------------------------
function freeForBreak(a) {
  return atHome(a) && !BUSY.has(a.serverStatus) && !a.partner && !a.lesson && !a.inJob;
}

// Chỗ đứng tán gẫu: chỉ trong phòng nhân viên hoặc phòng Giám đốc. Hai người đứng cách nhau ~26 đơn vị,
// quay mặt vào nhau, ở khoảng trống đi lại được (không chắn trước chỗ ngồi của ai).
const CHAT_ROOMS = ["staff", "cio"];
export function chatSpots(a, b) {
  const seats = agents.map(o => deskOfAgent(o)).filter(Boolean).map(seatPoint);
  const clear = p => isWalkable(p.x, p.y) && CHAT_ROOMS.includes(roomAt(p.x, p.y)) && seats.every(s => dist(s, p) > 16);
  const cands = [];
  for (const room of ROOMS.filter(r => CHAT_ROOMS.includes(r.id))) {
    for (const [x0, y0, x1, y1] of room.rects) {
      for (let x = x0 + 15; x <= x1 - 15; x += 10) {
        for (let y = y0 + 15; y <= y1 - 15; y += 10) {
          const p = { x, y };
          if (!clear(p)) continue;
          for (const [dx, dy] of [[26, 0], [0, 26]]) {
            const q = { x: x + dx, y: y + dy };
            if (clear(q) && roomAt(q.x, q.y) === roomAt(x, y) && reachable(a, p) && reachable(b, q)) cands.push([p, q]);
          }
        }
      }
    }
  }
  if (!cands.length) return null;
  // Ưu tiên chỗ gần người rủ (đỡ phải đi xa), có chút ngẫu nhiên.
  cands.sort((p, q) => dist(p[0], a) - dist(q[0], a));
  return cands[Math.floor(Math.random() * Math.min(8, cands.length))];
}

function tryBreak(a) {
  a.nextBreakAt = tick + sec(28 + Math.random() * 35);
  if (flags.breaksPaused || flags.workMode) return;
  if (agents.filter(o => o.planKind === "break").length >= 2) return;
  const say = kind => activityLine(kind, a.role);

  const options = [];
  const drink = nearestItem(a, ["vending", "watercooler"]);
  if (drink) options.push(() => [
    go(() => usePoint(drink), { bubble: t("sim.getWater") }),
    wait(1.5, { face: drink }),
    wait(4.5, { holding: "cup", face: "S", bubble: say("coffee"), tone: "speech", speak: true }),
    home({ holding: "cup" }),
  ]);
  const fridge = nearestItem(a, ["fridge"]);
  if (fridge) options.push(() => [
    go(() => usePoint(fridge), { bubble: t("sim.toFridge") }),
    wait(1.8, { face: fridge }),
    wait(4, { holding: "cup", face: "S", bubble: say("snack"), tone: "speech", speak: true }),
    home({ holding: "cup" }),
  ]);
  const oven = nearestItem(a, ["microwave"]);
  if (oven) options.push(() => [
    go(() => usePoint(oven), { bubble: t("sim.toMicrowave") }),
    wait(3.2, { face: oven, bubble: t("sim.heating"), onStart: () => { microwaveUntil = tick + sec(3.2); } }),
    wait(4, { holding: "cup", face: "S", bubble: say("lunch"), tone: "speech", speak: true }),
    home({ holding: "cup" }),
  ]);
  const shelf = nearestItem(a, ["bookshelf"]);
  if (shelf) options.push(() => [
    go(() => usePoint(shelf), { bubble: t("sim.findDocs") }),
    wait(2, { face: shelf }),
    wait(5, { holding: "book", face: "S", bubble: `📖 ${say("read")}` }),
    home({ holding: "book" }),
  ]);
  // Thói quen của Giám đốc: hay ra khu hút thuốc (được chọn nhiều hơn hẳn các kiểu giải lao khác).
  const ashtray = a.role === "director" ? nearestItem(a, ["ashtray"]) : null;
  if (ashtray) {
    const smoke = () => [
      go(() => usePoint(ashtray), { bubble: t("sim.toSmoke") }),
      wait(1.2, { face: ashtray, holding: "cig" }),                 // châm thuốc, gạt tàn
      wait(5.5, { face: "SE", holding: "cig", bubble: say("smoke"), tone: "speech", speak: true }),
      wait(4, { face: "S", holding: "cig" }),
      wait(1, { face: ashtray, bubble: t("sim.stubOut") }),
      home(),
    ];
    options.push(smoke, smoke, smoke, smoke);
  }
  const view = nearestWindow(a);
  if (view) options.push(() => [
    go(() => view.at, { bubble: t("sim.toWindow") }),
    wait(5, { face: view.look, bubble: say("window"), tone: "speech", speak: true }),
    home(),
  ]);

  const sofa = layout.find(it => it.type === "sofa" && usePoint(it) && reachable(a, usePoint(it)));
  if (sofa) {
    const seats = sofaSeats(sofa);
    const k = seats.findIndex((_, i) => !agents.some(o => o.sofaSeat === `${sofa.id}:${i}`));
    if (k >= 0) {
      const seat = seats[k];
      const [fx, fy] = toWorld(rot(sofa), 0, 1);
      const front = { x: seat.x + fx * 32, y: seat.y + fy * 32 };
      const claim = x => { x.sofaSeat = `${sofa.id}:${k}`; };
      options.push(() => [
        go(() => nearestWalkable(front.x, front.y), { bubble: t("sim.sitRest"), onStart: claim }),
        slide(() => seat, { onStart: claim }),
        wait(7, { sit: true, bubble: `😌 ${say("sofa")}`, onStart: x => { claim(x); x.facing = facingFor(fx, fy); } }),
        slide(() => nearestWalkable(front.x, front.y)),
        home(),
      ]);
    }
  }

  // Thử vài người đang rảnh (ngẫu nhiên) – người đầu tiên tới được chỗ đứng chung thì thành bạn trò chuyện.
  // (Không lấy cứng người rảnh đầu tiên: người đó có thể đang bị đồ đạc vây kín chỗ ngồi.)
  const table = layout.find(it => it.type === "meeting" && CHAT_ROOMS.includes(roomAt(it.x, it.y)));
  const tableSpots = table ? chatPoints(table).map(p => nearestWalkable(p.x, p.y)) : null;
  let partner = null, spots = null;
  for (const o of hereAgents().filter(o => o !== a && freeForBreak(o)).sort(() => Math.random() - 0.5).slice(0, 4)) {
    let sp = tableSpots && tableSpots.every(p => p) && reachable(a, tableSpots[0]) ? tableSpots : null;
    if (!sp || !reachable(o, sp[1])) sp = chatSpots(a, o);
    if (sp && sp[1] && reachable(o, sp[1])) { partner = o; spots = sp; break; }
  }
  if (partner && spots) {
    const chat = () => { startChat(a, partner, spots); return null; };
    options.push(chat, chat); // trò chuyện thường xuyên hơn
  }

  if (!options.length) return;
  const steps = options[Math.floor(Math.random() * options.length)]();
  if (steps) setPlan(a, "break", steps);
}

// ---------------------------------------------------------------------------
// Sự kiện từ backend
// ---------------------------------------------------------------------------
function workSteps(a, status) {
  if (a.role === "director" && status === "thinking") {
    const board = nearestItem(a, ["whiteboard"]);
    if (board) return [
      go(() => usePoint(board), { bubble: t("sim.planWork"), fast: true, onStart: () => { runtime.boardInk = 0; } }),
      wait(4.5, { face: board, bubble: t("sim.assign"), ink: true }),
      home({ fast: true }),
    ];
  }
  if ((a.role === "curriculum" || a.role === "teacher" || a.role === "qa") && status === "working") {
    const shelf = nearestItem(a, ["bookshelf"]);
    if (shelf) return [
      go(() => usePoint(shelf), { bubble: t("sim.findMaterials"), fast: true }),
      wait(3, { face: shelf, bubble: t("sim.readMaterials") }),
      home({ fast: true, holding: "book" }),
    ];
  }
  return [home({ fast: true })];
}

export function applyStatus(id, status, message, { animate = true } = {}) {
  const a = staff[id];
  if (!a) return;
  const prev = a.serverStatus;
  a.serverStatus = status;
  a.serverMessage = message || "";
  if (BUSY.has(status)) {
    a.statusBubble = { text: a.serverMessage, tone: "work" };
    // Đang đứng lớp / ngồi cuối lớp thì vẫn ở lớp, chỉ đổi bong bóng.
    if (animate && prev !== status && !a.lesson && onHere(a)) setPlan(a, "work", workSteps(a, status));
  } else if (status === "done") {
    a.statusBubble = { text: t("sim.done"), tone: "ok", until: tick + sec(4) };
  } else if (status === "error") {
    a.statusBubble = { text: a.serverMessage, tone: "error", until: tick + sec(8) };
  } else {
    a.statusBubble = null; // rảnh thì không cần bong bóng – bảng "Đội ngũ" đã ghi trạng thái
    a.nextBreakAt = Math.max(a.nextBreakAt, tick + sec(8));
  }
}

export function applyActivity(id, kind, message) {
  const a = staff[id];
  if (!a || !BUSY.has(a.serverStatus)) return;
  if (kind === "thinking") {
    a.statusBubble = { text: t("sim.thinking"), tone: "work" };
  } else {
    a.typingUntil = tick + sec(4);
    a.statusBubble = { text: `⌨️ ${message || t("sim.writing")}`, tone: "work", until: tick + sec(5) };
  }
}

export function applyHandoff(fromId, toId) {
  const a = staff[fromId], b = staff[toId];
  if (!a || !b) return;
  const line = handoffLine(a.role, b.role) || t("sim.handoffDefault");
  if (a.lesson || !onHere(a) || !onHere(b)) { // đang trên lớp / khác tầng: chỉ báo bằng lời, không đi
    a.actionBubble = { text: line, tone: "speech" };
    a.statusBubble = { text: t("sim.handoffTo", { name: b.name }), tone: "ok", until: tick + sec(4) };
    return;
  }
  const steps = [];
  if (toId === "manager") {
    const printer = nearestItem(a, ["printer"]);
    if (printer) steps.push(
      go(() => usePoint(printer), { bubble: t("sim.print"), fast: true }),
      wait(2.5, { face: printer, bubble: t("sim.printing"), onStart: () => { printerUntil = tick + sec(2.5); } }),
    );
  }
  steps.push(
    go(() => besideDesk(toId), { bubble: t("sim.handoffTo", { name: b.name }), fast: true, holding: "paper" }),
    wait(3, { face: () => staff[toId], holding: "paper", tone: "speech", speak: true, bubble: line }),
    home(),
  );
  setPlan(a, "handoff", steps);
}

// ---------------------------------------------------------------------------
// Kịch bản (màn chào hỏi...): danh sách hành động tuần tự cho một nhân viên.
//   { goto: {x,y} } | { say, seconds, face, gesture } | { waitUntil: () => bool, face, gesture, say }
//   { call: fn }    | { home: true }
// ---------------------------------------------------------------------------
export function runScript(id, actions) {
  const a = staff[id];
  if (!a) return;
  const steps = actions.map(act => {
    if (act.goto) return go(() => nearestWalkable(act.goto.x, act.goto.y), { bubble: act.say, fast: act.fast });
    if (act.waitUntil) return { type: "wait", ticks: Infinity, until: act.waitUntil, face: act.face, holding: act.gesture, bubble: act.say, tone: "speech" };
    if (act.call) return { type: "do", fn: act.call };
    if (act.home) return home();
    return wait(act.seconds ?? Math.max(2.4, act.say.length * 0.06), {
      bubble: act.say, tone: "speech", speak: true, face: act.face, holding: act.gesture,
    });
  });
  setPlan(a, "script", steps);
}

// ---------------------------------------------------------------------------
// Tủ hồ sơ & thùng rác: Giám đốc cất tài liệu / vo giấy ném vào thùng rác.
// ---------------------------------------------------------------------------
const nearestOfType = (a, type) => layout.filter(it => it.type === type)
  .sort((p, q) => dist(a, p) - dist(a, q))[0] || null;

// Các cảnh việc vặt dưới đây do choreAgent() làm (Trợ giảng chính).
// Cất tài liệu: cầm tập giấy ra tủ, kéo ngăn, bỏ vào rồi về chỗ. onFiled chạy lúc đóng ngăn.
export function fileReportScene(onFiled) {
  const a = choreAgent();
  const cab = a && nearestOfType(a, "cabinet");
  const spot = cab && useSpotFor(a, cab);
  if (!cab || !spot || !onHere(a)) { onFiled?.(); return false; }
  setPlan(a, "script", [
    go(() => spot, { bubble: t("sim.toCabinet"), fast: true, holding: "paper" }),
    wait(0.5, { face: cab, holding: "paper", onStart: () => { cabinetUntil = tick + sec(2.2); } }),
    wait(1.4, { face: cab, holding: "paper", bubble: t("sim.filing"), tone: "speech", speak: true }),
    { type: "do", fn: () => onFiled?.() },
    wait(0.5, { face: cab }),
    home(),
  ]);
  return true;
}

// Hoàn tất nhiệm vụ: Trợ giảng chính ra bảng trắng gỡ kế hoạch cũ.
export function eraseBoardScene() {
  const a = choreAgent();
  const board = a && nearestOfType(a, "whiteboard");
  const spot = board && useSpotFor(a, board);
  if (!board || !spot || !onHere(a)) { runtime.boardInk = 0; return false; }
  setPlan(a, "script", [
    go(() => spot, { bubble: t("sim.toBoard"), fast: true }),
    wait(Math.max(1.2, runtime.boardInk * 0.25 + 0.6), { face: board, bubble: t("sim.erasing"), erase: true }),
    { type: "do", fn: () => { runtime.boardInk = 0; } },
    wait(1.3, { face: "S", bubble: t("sim.boardClean"), tone: "speech", speak: true }),
    home(),
  ]);
  return true;
}

// In hồ sơ: Trợ giảng chính ra máy in, chờ in xong, cầm tập giấy về. onPrinted chạy lúc giấy ra khỏi máy.
export function printReportScene(pages, onPrinted) {
  const a = choreAgent();
  const pr = a && nearestOfType(a, "printer");
  const spot = pr && useSpotFor(a, pr);
  if (!pr || !spot || !onHere(a)) { onPrinted?.(); return false; }
  const secs = Math.min(5, 1.6 + pages * 0.7);
  setPlan(a, "script", [
    go(() => spot, { bubble: t("sim.toPrinter"), fast: true }),
    wait(secs, { face: pr, bubble: t("sim.printing"), onStart: () => { printerUntil = tick + sec(secs); } }),
    { type: "do", fn: () => onPrinted?.() },
    wait(1.4, { face: "S", holding: "paper", bubble: t("sim.printDone"), tone: "speech", speak: true }),
    home(),
  ]);
  return true;
}

// Điểm ném: đứng cách thùng rác ~50 đơn vị, ưu tiên phía chỗ ngồi của Giám đốc.
function throwSpot(a, bin) {
  const from = homeTarget(a);
  if (dist(from, bin) <= 95 && reachable(a, from)) return from; // thùng ở gần: ném luôn từ chỗ ngồi
  const dx = from.x - bin.x, dy = from.y - bin.y;
  for (const r of [50, 42, 60, 34]) {
    for (const turn of [0, 0.5, -0.5, 1, -1, 1.6, -1.6]) {
      const ang = Math.atan2(dy, dx) + turn;
      const p = nearestWalkable(bin.x + Math.cos(ang) * r, bin.y + Math.sin(ang) * r);
      if (p && Math.abs(dist(p, bin) - r) < 12 && reachable(a, p)) return p;
    }
  }
  return null;
}

// Xoá tài liệu: cầm tờ giấy, vo tròn trước mặt, quay sang ném vào thùng rác.
export function trashReportScene() {
  const a = choreAgent();
  if (!a || !onHere(a)) return;
  const bin = nearestOfType(a, "trash");
  const spot = bin ? throwSpot(a, bin) : null;
  const steps = [];
  if (spot) steps.push(go(() => spot, { fast: true, holding: "paper" }));
  steps.push(
    wait(1.3, { face: "S", holding: "paper", bubble: t("sim.trashSay"), tone: "speech", speak: true }),
    wait(1.4, { face: "S", holding: "crumple", bubble: t("sim.crumple"), tone: "speech" }),
  );
  if (spot) {
    const flight = sec(0.65);
    steps.push(
      wait(0.35, { face: bin, holding: "ball" }),
      {
        type: "do", fn: me => {
          me.holdStart = tick;
          const dir = project(bin.x, bin.y).x >= project(me.x, me.y).x ? 1 : -1;
          const h = project(me.x, me.y);
          effects.push({
            kind: "paperBall", start: tick, ticks: flight,
            from: { x: h.x + dir * 9, y: h.y - 58 },
            to: (() => { const q = project(bin.x, bin.y, CATALOG.trash.h - 6); return { x: q.x, y: q.y }; })(),
            peak: 34, onLand: () => { runtime.trashCount = Math.min(5, runtime.trashCount + 1); },
          });
        },
      },
      wait(0.65, { face: bin, holding: "throw" }),
      wait(1.6, { face: bin, bubble: t("sim.score"), tone: "speech", speak: true }),
    );
  } else {
    steps.push(wait(1.2, { face: "S", holding: "ball", bubble: t("sim.pocket"), tone: "speech", speak: true }));
  }
  steps.push(home());
  setPlan(a, "script", steps);
}

// Chỗ đứng để dùng một món đồ: điểm "use" nếu tới được; nếu không (bị đồ khác vây), điểm tới được gần nó nhất
// trong bán kính maxD – vẫn đủ gần để thao tác.
function useSpotFor(a, item, maxD = 46) {
  const p = usePoint(item);
  if (!p) return null;
  const w = nearestWalkable(p.x, p.y);
  if (w && reachable(a, w) && dist(w, p) < 14) return w;
  let best = null, bestD = Infinity;
  for (let dx = -maxD; dx <= maxD; dx += 5) {
    for (let dy = -maxD; dy <= maxD; dy += 5) {
      const q = { x: p.x + dx, y: p.y + dy };
      const d = Math.hypot(dx, dy);
      if (d > maxD || d >= bestD || !isWalkable(q.x, q.y) || !reachable(a, q)) continue;
      best = q; bestD = d;
    }
  }
  return best;
}

// Ngắm cảnh: cửa sổ GẦN người này nhất mà tới được (không phải đi xa sang phòng khác).
export function nearestWindow(a) {
  let best = null, bestD = Infinity;
  for (const w of WINDOWS) {
    // Đứng trước đoạn kính, chỗ gần người này nhất (không nhất thiết giữa cửa sổ).
    const along = w.plane === "back" ? Math.max(w.a0 + 8, Math.min(w.a1 - 8, a.x)) : Math.max(w.a0 + 8, Math.min(w.a1 - 8, a.y));
    const s = windowSpot(w, along);
    const at = nearestWalkable(s.at.x, s.at.y);
    if (!at || dist(at, s.at) > 16 || !reachable(a, at)) continue;
    // Ưu tiên cửa sổ cùng phòng (khỏi phải đi vòng qua cửa sang phòng khác).
    const d = dist(a, at) + (roomAt(at.x, at.y) === roomAt(a.x, a.y) ? 0 : 150);
    if (d < bestD) { bestD = d; best = { at, look: s.look }; }
  }
  return best;
}

// Người làm việc vặt (in, cất hồ sơ, vứt rác, dọn bảng): Trợ giảng chính đang rảnh (không đứng lớp).
// Chưa có ai mang vai trò này thì tạm để Giám đốc làm.
export function choreAgent() {
  const here = hereAgents();
  const pickHere = here.find(a => a.role === "headta" && !a.lesson) || here.find(a => a.role === "headta");
  if (pickHere) return pickHere;
  return agents.find(a => a.role === "headta" && !a.lesson) || agents.find(a => a.role === "headta") || staff.manager || null;
}

// Mọi người cùng quay về một điểm (vd. nhìn Giám đốc phát biểu).
export function lookAt(point, exceptId = "manager") {
  for (const a of agents) {
    if (a.id === exceptId) continue;
    if (a.planKind === "home" && !a.moving) faceToward(a, point);
  }
}

// ---------------------------------------------------------------------------
// Buổi dạy: giảng viên đứng bục, học viên (mặc suit) từ lối vào tới bàn học, trợ lý ngồi cuối lớp.
// ---------------------------------------------------------------------------
const lesson = { active: false, floor: 9, room: null, teacher: null, assistants: [], startedAt: 0, nextChatter: 0 };
export const lessonState = () => lesson;

export const classroomDesks = room => layout.filter(it => CATALOG[it.type]?.student && roomAt(it.x, it.y) === room);

// Chỗ giảng viên đứng: luôn ở PHÍA TRƯỚC lớp theo hướng học viên thật sự quay mặt (hướng -v của đa số bàn học),
// để dù xoay / sắp xếp bàn kiểu gì giảng viên cũng không đứng sau lưng học viên.
//  - Có bục giảng nằm phía trước lớp: đứng sau bục.
//  - Không có (hoặc bục nằm sai phía): đứng trước hàng bàn đầu, giữa lớp.
function teachSpot(room, desks) {
  if (!desks.length) return null;
  const center = { x: desks.reduce((s, d) => s + d.x, 0) / desks.length, y: desks.reduce((s, d) => s + d.y, 0) / desks.length };
  const votes = [0, 0, 0, 0];
  for (const d of desks) votes[rot(d)]++;
  const r = votes.indexOf(Math.max(...votes));
  const [fx, fy] = toWorld(r, 0, -1); // hướng học viên nhìn
  const ahead = p => (p.x - center.x) * fx + (p.y - center.y) * fy;
  const depth = Math.max(...desks.map(ahead));
  const podium = layout.find(it => it.type === "podium" && roomAt(it.x, it.y) === room && ahead(it) > depth);
  if (podium) {
    const p = usePoint(podium);
    const w = nearestWalkable(p.x, p.y);
    if (w) return { at: w, look: center };
  }
  // Thử vài điểm trước hàng bàn đầu (gần -> xa, lệch ngang một chút) – điểm đầu tiên đi tới được.
  const [sx, sy] = [-fy, fx];
  for (const k of [40, 32, 50, 26, 60]) {
    for (const side of [0, 15, -15, 30, -30]) {
      const q = { x: center.x + fx * (depth + k) + sx * side, y: center.y + fy * (depth + k) + sy * side };
      const w = nearestWalkable(q.x, q.y);
      if (w && Math.hypot(w.x - q.x, w.y - q.y) < 12 && roomAt(w.x, w.y) === room) return { at: w, look: center };
    }
  }
  const front = { x: center.x + fx * (depth + 40), y: center.y + fy * (depth + 40) };
  return { at: nearestWalkable(front.x, front.y), look: center };
}

// Đường vào chỗ ngồi: tới một điểm đi được nằm trên đường thẳng sau lưng ghế (cùng hàng bàn),
// rồi lách dọc theo hàng tới sau ghế, ngồi xuống.
function seatRoute(desk, from) {
  const seat = seatPoint(desk);
  const back = localPoint(desk, 0, 22);
  const room = roomAt(desk.x, desk.y);
  // Đoạn trượt (điểm vào -> sau lưng ghế) phải nằm trong cùng phòng và không cắt qua vách – học viên không đi xuyên tường.
  const ok = p => isWalkable(p.x, p.y) && reachable(from, p) && roomAt(p.x, p.y) === room && !segmentHitsWall(p, back);
  const route = p => ({ entry: p, back, seat, face: { x: desk.x, y: desk.y } });
  // 1) Dọc theo hàng ghế (lách giữa các hàng bàn).
  for (let k = 0; k <= 280; k += 10) {
    for (const s of k ? [k, -k] : [0]) {
      const p = localPoint(desk, s, 22);
      if (ok(p)) return route(p);
    }
  }
  // 2) Không có: điểm đi được gần sau lưng ghế nhất mà đường thẳng tới ghế không vướng vách.
  let best = null, bestD = Infinity;
  for (let dx = -120; dx <= 120; dx += 10) {
    for (let dy = -120; dy <= 120; dy += 10) {
      const d = Math.hypot(dx, dy);
      if (d >= bestD) continue;
      const q = { x: back.x + dx, y: back.y + dy };
      if (ok(q)) { best = q; bestD = d; }
    }
  }
  return best ? route(best) : null;
}

const seatSteps = (r, o = {}) => [
  go(() => r.entry, { fast: o.fast, bubble: o.bubble }),
  slide(() => r.back, { speed: 0.8 }),
  slide(() => r.seat, { speed: 0.5, keepFacing: true, onStart: x => faceToward(x, r.face) }),
];
const leaveSeatSteps = r => [
  slide(() => r.back, { speed: 0.5 }),
  slide(() => r.entry, { speed: 0.8 }),
];

// Chỗ ngồi của trợ giảng: ưu tiên bàn có ghế riêng (bàn laptop / bàn làm việc) đặt trong phòng học, xa bục nhất
// (= cuối lớp) và không phải chỗ đang có người khác ngồi; thiếu thì dùng hàng bàn học cuối lớp.
function assistantSeats(room, spot, door, n, ids, usable, routes) {
  const out = [];
  const desks = layout.filter(it => CATALOG[it.type]?.workDesk && roomAt(it.x, it.y) === room)
    .filter(d => { const o = ownerOfDesk(d); return !o || ids.includes(o.id); })
    .sort((p, q) => dist(q, spot.at) - dist(p, spot.at));
  for (const d of desks) {
    if (out.length >= n) break;
    const seat = seatPoint(d);
    const entry = nearestWalkable(seat.x, seat.y);
    if (!entry || Math.hypot(entry.x - seat.x, entry.y - seat.y) > 30 || !reachable(door, entry)) continue;
    out.push({ desk: d, route: { entry, back: seat, seat, face: { x: d.x, y: d.y } } });
  }
  if (out.length < n && usable.length) {
    // Hàng cuối = các bàn học xa bục nhất (lệch không quá 30); ưu tiên bàn sát lối đi (ít phải lách qua hàng ghế).
    const depth = d => dist(d, spot.at);
    const far = Math.max(...usable.map(depth));
    const reach = d => dist(routes.get(d).entry, routes.get(d).back);
    const back = usable.filter(d => far - depth(d) <= 30).sort((p, q) => reach(p) - reach(q));
    const rest = usable.filter(d => !back.includes(d)).sort((p, q) => depth(q) - depth(p));
    for (const d of [...back, ...rest]) {
      if (out.length >= n) break;
      out.push({ desk: d, route: routes.get(d), student: true });
    }
  }
  return out;
}

// assistants: tối đa 2 trợ giảng (id) ngồi cuối lớp.
export function startLesson({ teacher, assistants = [], room = "classBig", count = 12 }) {
  if (lesson.active) endLesson(true);
  const T = staff[teacher];
  if (!T) return { ok: false, reason: "noTeacher" };
  const desks = classroomDesks(room);
  if (!desks.length) return { ok: false, reason: "noDesks" };
  const spot = teachSpot(room, desks);
  // Không bắt giảng viên phải "đi tới được" theo lưới đồ đạc: bị vây kín thì tự lách ra (xem findPath).
  if (!spot?.at) return { ok: false, reason: "noSpot" };
  const door = nearestWalkable(doorIn().x, doorIn().y) || doorIn();

  // Học viên ngồi từ bàn gần bục nhất.
  const byFront = [...desks].sort((p, q) => dist(p, spot.at) - dist(q, spot.at));
  const routes = new Map(byFront.map(d => [d, seatRoute(d, door)]));
  const usable = byFront.filter(d => routes.get(d));
  const helpers = [...new Set(assistants)].filter(id => id && id !== teacher && staff[id]).slice(0, 2);
  const taSeats = assistantSeats(room, spot, door, helpers.length, helpers, usable, routes);
  const taken = new Set(taSeats.map(s => s.desk));
  const seats = usable.filter(d => !taken.has(d)).slice(0, Math.max(0, Math.min(count, usable.length)));

  Object.assign(lesson, { active: true, floor: FLOOR, room, teacher, assistants: helpers, startedAt: tick, nextChatter: tick + sec(8) });

  // Giảng viên / trợ giảng thuộc tầng khác: tới tầng này, xuất hiện ở lối vào rồi đi vào lớp.
  for (const id of [teacher, ...helpers]) {
    const a = staff[id];
    if (!a || onHere(a)) continue;
    a.visitFloor = FLOOR;
    a.x = door.x + (Math.random() - 0.5) * 10; a.y = door.y + (Math.random() - 0.5) * 10;
    a.path = []; a.seatBlend = 0; a.sitting = false;
  }

  // Giảng viên
  T.lesson = "teacher";
  setPlan(T, "lesson", [
    go(() => spot.at, { bubble: t("sim.toClass"), fast: true, holding: "book" }),
    wait(Infinity, {
      face: spot.look, until: () => !lesson.active,
      every: (a, k) => {
        const n = k % sec(7);
        if (n === 0) { a.actionBubble = { text: teachLine(), tone: "speech" }; a.talking = true; a.holding = Math.random() < 0.5 ? "wave" : null; }
        if (n === sec(4.2)) { a.actionBubble = null; a.talking = false; a.holding = null; }
      },
    }),
    home(),
  ]);

  // Trợ giảng ngồi cuối lớp
  taSeats.forEach(({ route: r }, i) => {
    const A = staff[helpers[i]];
    A.lesson = "assistant";
    A.lessonRoute = r;
    setPlan(A, "lesson", [
      ...seatSteps(r, { fast: true, bubble: t("sim.toBackRow") }),
      wait(Infinity, {
        sit: true, face: r.face, until: () => !lesson.active,
        every: (a, k) => {
          const n = k % sec(11);
          if (n === sec(3)) a.actionBubble = { text: classLine(), tone: "speech" };
          if (n === sec(6)) a.actionBubble = null;
        },
      }),
      ...leaveSeatSteps(r),
      home(),
    ]);
  });

  // Học viên vào lớp lần lượt
  seats.forEach((desk, i) => {
    const r = routes.get(desk);
    const s = {
      ...blankAgent(`stu-${tick}-${i}`, 0), student: true, name: "", look: studentLook(),
      x: door.x + (Math.random() - 0.5) * 16, y: door.y + 4, facing: "N", seatRoute: r,
    };
    s.plan = [
      ...seatSteps(r),
      wait(Infinity, { sit: true, face: r.face, until: () => !lesson.active }),
    ];
    s.planKind = "lesson";
    s.hidden = true; // xuất hiện ở cửa đúng lúc tới lượt
    s.appearAt = tick + sec(0.2 + i * 1.1);
    students.push(s);
  });
  return { ok: true, seats: seats.length, assistantSeats: taSeats.length };
}

// Kết thúc buổi học: học viên ra về (lần lượt), giảng viên và trợ lý về chỗ.
export function endLesson(immediate = false) {
  if (!lesson.active) return;
  lesson.active = false;
  const door = nearestWalkable(doorIn().x, doorIn().y) || doorIn();
  const out = entranceInfo().out;
  const exitTo = { x: door.x + out.x * 18, y: door.y + out.y * 18 };
  // Người ghé từ tầng khác: rời ghế (trợ giảng), ra lối vào rồi trở về tầng của mình.
  const goBack = x => { x.visitFloor = null; x.placed = false; x.lesson = null; setPlan(x, "home", [home()]); };
  for (const a of agents) {
    if (!a.lesson) continue;
    if (a.visitFloor) {
      setPlan(a, "leave", [
        ...(a.lesson === "assistant" && a.lessonRoute ? leaveSeatSteps(a.lessonRoute) : []),
        go(() => door),
        slide(() => exitTo, { speed: 0.9 }),
        { type: "do", fn: goBack },
      ]);
      a.lesson = null;
      continue;
    }
    if (a.lesson === "assistant" && a.lessonRoute && a.planKind === "lesson") {
      // bước "wait" kết thúc nhờ until -> tự rời ghế theo kế hoạch đã có
    } else if (a.planKind === "lesson") {
      setPlan(a, "home", [home()]);
    }
    a.lesson = null;
  }
  students.forEach((s, i) => {
    if (immediate || s.hidden) { s.gone = true; return; }
    setPlan(s, "leave", [
      wait(0.3 + Math.random() * 2.5 + i * 0.25, { sit: true, face: s.seatRoute.face }),
      ...leaveSeatSteps(s.seatRoute),
      go(() => door),
      slide(() => exitTo, { speed: 0.9 }),
      { type: "do", fn: x => { x.gone = true; } },
    ]);
  });
  for (let i = students.length - 1; i >= 0; i--) if (students[i].gone) students.splice(i, 1);
}

function lessonTick() {
  if (!lesson.active || tick < lesson.nextChatter) return;
  lesson.nextChatter = tick + sec(5 + Math.random() * 7);
  const seated = students.filter(s => s.sitting && s.seatBlend > 0.9);
  if (!seated.length) return;
  const s = seated[Math.floor(Math.random() * seated.length)];
  s.actionBubble = { text: studentLine(), tone: "speech" };
  s.bubbleUntil = tick + sec(2.8);
}

// ---------------------------------------------------------------------------
// Vòng cập nhật + bố trí
// ---------------------------------------------------------------------------
runtime.printerActive = () => tick < printerUntil;
runtime.cabinetOpen = () => tick < cabinetUntil;
runtime.microwaveOn = () => tick < microwaveUntil;
runtime.screenState = item => {
  const owner = ownerOfDesk(item);
  if (!owner) return "off";
  const busy = BUSY.has(owner.serverStatus);
  const seated = owner.seatBlend > 0.5 && Math.hypot(owner.x - seatPoint(item).x, owner.y - seatPoint(item).y) < 4;
  if (busy && seated) return tick < owner.typingUntil ? "typing" : "busy";
  if (busy || seated || flags.workMode) return "idle";
  return "off";
};

export function setLayout(items) {
  layout = items;
  layoutVersion++;
  claimTick = -1;
  for (const a of hereAgents()) {
    const s = a.plan[a.stepIndex];
    if (s?.type === "go" && a.stepState?.target) a.path = findPath(a, a.stepState.target);
    if (s?.type === "home") { a.path = []; a.homeVersion = -1; }
  }
}

// Đặt mọi người ngồi sẵn vào bàn (không cần đi bộ) – dùng khi mở trang.
export function seatEveryone() {
  for (const a of hereAgents()) {
    const t = homeTarget(a);
    a.x = t.x; a.y = t.y; a.path = []; a.fresh = false; a.placed = true;
    setPlan(a, "home", [home()]);
  }
}

// Vừa chuyển sang tầng này: ai đang "ở nhà" thì ngồi sẵn vào bàn (lúc vắng mặt họ vẫn làm việc bình thường);
// người đang có kịch bản dở (đứng lớp, bàn giao...) giữ nguyên.
export function seatArrivals() {
  for (const a of hereAgents()) {
    if (a.placed && a.planKind !== "home") continue;
    const t = homeTarget(a);
    a.x = t.x; a.y = t.y; a.path = []; a.fresh = false; a.placed = true;
    setPlan(a, "home", [home()]);
  }
}

function stepAgent(a) {
  a.moving = false;
  runPlan(a);
  a.seatBlend = Math.max(0, Math.min(1, a.seatBlend + (a.sitting ? 0.08 : -0.12)));
  a.lift = a.seatBlend * 3;
  a.working = BUSY.has(a.serverStatus) && a.seatBlend > 0.5;
}

export function update() {
  tick++;
  runtime.tick = tick;
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    if (tick - e.start >= e.ticks) { e.onLand?.(); effects.splice(i, 1); }
  }
  for (const a of hereAgents()) {
    if (a.planKind === "home" && tick >= a.nextBreakAt && freeForBreak(a)) tryBreak(a);
    stepAgent(a);
    if (a.statusBubble?.until && tick > a.statusBubble.until) {
      a.statusBubble = BUSY.has(a.serverStatus) ? { text: a.serverMessage, tone: "work" } : null;
    }
  }
  for (const s of FLOOR === lesson.floor ? students : []) {
    if (s.hidden && tick >= s.appearAt) s.hidden = false;
    if (s.hidden) continue;
    stepAgent(s);
    if (s.bubbleUntil && tick > s.bubbleUntil) { s.actionBubble = null; s.bubbleUntil = 0; }
  }
  for (let i = students.length - 1; i >= 0; i--) if (students[i].gone) students.splice(i, 1);
  lessonTick();
}

export function bubbleOf(a) {
  return a.actionBubble || a.statusBubble;
}

export function agentDrawables(draw) {
  return visibleAgents().filter(a => !a.hidden).map(a => ({
    agent: a, layer: 1,
    bounds: { x0: a.x - 5, x1: a.x + 5, y0: a.y - 5, y1: a.y + 5, z0: 0, z1: 70 },
    draw: () => draw(a),
  }));
}

export const getTick = () => tick;
export const studentCount = () => students.filter(s => !s.hidden).length;
