// Điểm vào: vẽ văn phòng toàn màn hình, menu, trình sắp xếp nội thất, màn chào, kết nối backend.

import { ISO, bindContext, floorRect, isoSort, line, poly, project, unproject } from "./iso.js";
import {
  CATALOG, DEFAULT_LAYOUT, chairBlocked, drawItem, toWorld, drawPaperBall, fitsInRoom, footprint, isWorkDesk, overlapsAny, pickItem, rot, runtime,
  sceneDrawables, seatPoint,
} from "./furniture.js";
import { rebuild, reachable } from "./pathfinding.js";
import {
  TICK_HZ, agentDrawables, allAgents, seatArrivals, visibleAgents, applyActivity, applyHandoff, applyStatus, bubbleOf, classroomDesks, effects, endLesson,
  choreAgent, fileReportScene, flags, eraseBoardScene, getTick, lessonState, lookAt, printReportScene, runScript, seatEveryone, setInJob,
  setLayout, setWorkMode, staff, startLesson, syncStaff, trashReportScene, update,
} from "./sim.js";
import { ACCESSORIES, BOTTOMS, GENDERS, HAIRS, HAIR_STYLES, OUTFITS, SKINS, drawAgent, drawOverlay, randomLook } from "./characters.js";
import { applyI18n, clientName, fmtDate, fmtDateTime, fmtTime, getLang, LANGS, setLang, t } from "./i18n.js";
import { renderMarkdown } from "./markdown.js";
import { applyIcons, icon, setLabel } from "./icons.js";
import { drawSkyline } from "./skyline.js";
import { FLOOR, FLOOR_IDS, PLAN, PLAN_VERSION, WALLS, WINDOWS, drawFloorPlan, floorRooms, planX, roomAt, roomAtOn, roomFloorOf, setDoorSensor, setFloor, wallDrawables } from "./floorplan.js";
import { delay, loadClient, openPledge, playIntro } from "./onboarding.js";
import { cancelDemo, isDemoRunning, runDemo } from "./demo.js";
import { KIND_KEYS, ROLE_COLOR, STAFF_ROLES, kindDoc, kindName, kindPlaceholder, roleDuty, roleTitle, taskText } from "./roles.js";
import { DIRECTOR_ID, MAX_STAFF, displayName, loadTeam, newMemberId, sanitizeTeam, saveTeam } from "./team.js";

const $ = id => document.getElementById(id);
applyIcons();
const canvas = $("officeCanvas");
const ctx = canvas.getContext("2d");
bindContext(ctx);

const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
};

let client = loadClient();

// ===========================================================================
// Bố trí nội thất
// ===========================================================================
const LAYOUT_KEY = "ai-office-layout-v4"; // v4: trung tâm đào tạo CNTT (bàn gán qua hồ sơ nhân viên, lớp học có bục giảng)
const newId = () => `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// Bố cục lưu theo mặt bằng cũ (planVersion < PLAN_VERSION) được đổi toạ độ sang mặt bằng hiện tại.
const PLAN_VER_KEY = "ai-office-plan-version";
function cleanLayout(list, planVersion) {
  const seen = new Set();
  const move = planVersion < 2 ? planX : x => x; // v2: cánh trái rộng thêm 40
  return (Array.isArray(list) ? list : [])
    .filter(it => it && CATALOG[it.type] && Number.isFinite(it.x) && Number.isFinite(it.y))
    .map(it => ({ id: String(it.id || newId()), type: it.type, x: move(it.x), y: it.y, rotation: rot(it) }))
    .filter(it => !seen.has(it.id) && seen.add(it.id));
}
function loadLayout() {
  const saved = store.get(LAYOUT_KEY, null);
  const ver = store.get(PLAN_VER_KEY, 1);
  const items = cleanLayout(saved, ver);
  if (items.length) {
    if (ver < PLAN_VERSION) { store.set(LAYOUT_KEY, items); store.set(PLAN_VER_KEY, PLAN_VERSION); }
    return items;
  }
  store.set(PLAN_VER_KEY, PLAN_VERSION);
  return defaultLayout();
}
const defaultLayout = () => DEFAULT_LAYOUT.map(it => ({ id: newId(), rotation: 0, ...it }));

// Mỗi tầng một bố cục riêng. Tầng 9 giữ khoá lưu cũ; tầng 6 mới tạo, ban đầu chỉ có phòng (chưa có đồ).
const FLOOR_LAYOUT_KEYS = { 9: LAYOUT_KEY, 6: "ai-office-layout-f6" };
const FLOOR_KEY = "ai-office-floor";
const defaultFloorLayout = f => (f === 9 ? defaultLayout() : []);
const layouts = { 9: loadLayout(), 6: cleanLayout(store.get(FLOOR_LAYOUT_KEYS[6], []), PLAN_VERSION) };
let layout = layouts[FLOOR];

// Bàn ở tầng nào (để biết nhân viên thuộc tầng nào).
const deskFloor = id => FLOOR_IDS.find(f => (f === FLOOR ? layout : layouts[f]).some(it => it.id === id)) || 9;
const teamWithFloors = () => team.map(r => ({ ...r, floor: deskFloor(r.homeDesk) }));

function commitLayout({ persist = true } = {}) {
  layouts[FLOOR] = layout;
  rebuild(layout);
  setLayout(layout);
  if (persist && FLOOR === 9) store.set(PLAN_VER_KEY, PLAN_VERSION);
  if (persist && !store.set(FLOOR_LAYOUT_KEYS[FLOOR], layout.map(({ _cache, ...rest }) => rest))) {
    setHint(t("furn.storageFail"));
  }
  syncStaff(teamWithFloors(), titles());
  renderEditor();
  if (!$("staffModal").hidden) renderStaffEditor();
  if (typeof renderTaskForm === "function" && document.readyState !== "loading") try { renderTaskForm(); } catch { /* lúc khởi động */ }
}

// Đổi tầng đang xem: mặt bằng + đồ đạc + người của tầng đó (người ở tầng khác tạm "vắng mặt").
function switchFloor(id, { remember = true } = {}) {
  if (!FLOOR_IDS.includes(id) || id === FLOOR) return;
  layouts[FLOOR] = layout;
  editor.selectedId = null;
  editor.placing = null;
  editor.drag = null;
  setFloor(id);
  layout = layouts[id];
  if (remember) store.set(FLOOR_KEY, id);
  commitLayout({ persist: false });
  seatArrivals();
  renderFloorSwitch();
  if (!$("staffModal").hidden) renderStaffEditor();
}

// ===========================================================================
// Đội ngũ: hồ sơ nhân viên (tên, vai trò, ngoại hình, bàn mặc định / bàn làm việc)
// ===========================================================================
let team = loadTeam();
const nameOf = id => { const r = team.find(x => x.id === id); return r ? displayName(r, team) : id; };
const recOf = id => team.find(r => r.id === id) || null;
// Bàn gán được cho nhân viên ở mọi tầng (hồ sơ nhân viên); floorDesks = chỉ tầng đang xem (nhãn trên sơ đồ).
const deskItems = () => FLOOR_IDS.flatMap(f => (f === FLOOR ? layout : layouts[f]).filter(isWorkDesk));
const floorDesks = () => layout.filter(isWorkDesk);
const roleColor = id => ROLE_COLOR[recOf(id)?.role] || "#8eb1fc";
const titles = () => Object.fromEntries(team.map(r => [r.id, nameOf(r.id)]));

function applyTeam({ persist = true } = {}) {
  syncStaff(teamWithFloors(), titles());
  if (persist && !saveTeam(team)) toast(t("furn.storageFail"), 4000, "alert");
  renderTeam();
  renderAssignmentOptions();
  renderTaskForm();
  if (editor.open) renderEditor();
}

// ===========================================================================
// Khung nhìn: văn phòng (toạ độ logic 620×620) được co giãn vào vùng trống giữa các khung giao diện.
// ===========================================================================
const ROOM_BOX = { x0: -66, y0: -24, x1: 650, y1: 660 }; // vùng logic cần hiển thị (gồm cả bảng tên trên đầu)
const view = { scale: 1, ox: 0, oy: 0, dpr: 1, w: 0, h: 0 };
const reportView = { expanded: false };

function visible(el) { return el && !el.hidden && el.getClientRects().length > 0; }

function layoutView() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  // Vùng đặt văn phòng CỐ ĐỊNH theo kích thước cửa sổ – không phụ thuộc khung nào đang mở/đóng,
  // nên mở menu, thu gọn khung báo cáo / đội ngũ / giao việc không làm văn phòng dịch chuyển hay co giãn.
  // Chừa sẵn chỗ cho khung giao việc (dưới) và hai khung bên (khi màn hình đủ rộng).
  const top = 64;
  const bottom = H - Math.min(230, Math.round(H * 0.3));
  const sideW = W > 1200 ? Math.min(352, Math.round(W * 0.24)) : 12;
  const left = sideW, right = W - sideW;
  const bw = ROOM_BOX.x1 - ROOM_BOX.x0, bh = ROOM_BOX.y1 - ROOM_BOX.y0;
  const availW = Math.max(240, right - left), availH = Math.max(240, bottom - top);
  const scale = Math.min(availW / bw, availH / bh);
  const ox = left + (availW - bw * scale) / 2 - ROOM_BOX.x0 * scale;
  const oy = top + (availH - bh * scale) / 2 - ROOM_BOX.y0 * scale;
  const cx = left + availW / 2, cy = top + availH / 2;
  Object.assign(view, {
    dpr, w: W, h: H, scale, ox, oy, cx, cy, availW, availH,
    home: { x: (cx - ox) / scale, y: (cy - oy) / scale }, // điểm logic nằm giữa vùng trống khi chưa zoom
  });
  if (camera.focus === null) camera.focus = { ...view.home };
  if (camera.follow) camera.targetZoom = followZoom();
  // Cụm nút zoom nằm ở góc trên-phải của vùng trống, né khung bên và các nút 📋 / 👥 khi khung bị thu gọn.
  // (Cụm nút là giao diện, không phải văn phòng: nó bám theo khung bên đang mở/đóng.)
  const zc = $("zoomControls");
  let zRight = W - 12, zLeft = 12;
  if (visible($("sidePanel"))) zRight = $("sidePanel").getBoundingClientRect().left - 8;
  if (visible($("reportPanel")) && !reportView.expanded) zLeft = $("reportPanel").getBoundingClientRect().right + 8;
  if (visible($("sideTab"))) zRight = Math.min(zRight, $("sideTab").getBoundingClientRect().left - 8);
  if (visible($("reportTab"))) zLeft = Math.max(zLeft, $("reportTab").getBoundingClientRect().right + 8);
  let zTop = top + 2;
  if (zRight - zc.offsetWidth < zLeft) {
    // Màn hình quá hẹp để xếp cùng hàng với các nút: xuống hàng dưới.
    zRight = W - 12;
    zTop = Math.max($("sideTab").getBoundingClientRect().bottom, $("reportTab").getBoundingClientRect().bottom) + 8;
  }
  zc.style.left = `${Math.max(8, Math.round(zRight - zc.offsetWidth))}px`;
  zc.style.top = `${Math.round(zTop)}px`;
}

// ---------------------------------------------------------------------------
// Camera: phóng to mượt vào một nhân viên (vd. Giám đốc khi chào khách) rồi thu nhỏ về.
// Toạ độ màn hình = tâm vùng trống + (điểm logic − tiêu điểm) × scale × zoom.
// Khi zoom = 1 và tiêu điểm = view.home thì trùng khít với khung nhìn bình thường.
// ---------------------------------------------------------------------------
const camera = { zoom: 1, targetZoom: 1, focus: null, follow: null, manual: null, speed: 2.2, pan: null };
const ZOOM_MIN = 1, ZOOM_MAX = 4;

// Đủ to để nhân vật + bong bóng thoại chiếm khoảng 2/3 chiều cao vùng trống.
function followZoom() {
  return Math.max(1.4, Math.min(3, (view.availH * 0.66) / (210 * view.scale)));
}
function focusTarget() {
  if (!camera.follow) return camera.manual || view.home;
  const a = staff[camera.follow];
  const p = project(a.x, a.y);
  return { x: p.x, y: p.y - 80 }; // hơi cao hơn đầu để chừa chỗ cho bong bóng thoại
}
function zoomTo(id) { camera.follow = id; camera.manual = null; camera.speed = 2.2; camera.targetZoom = followZoom(); }
function zoomOut() { camera.follow = null; camera.manual = null; camera.speed = 2.2; camera.targetZoom = 1; }

// ---- Người dùng tự phóng to / thu nhỏ / kéo ----
// Giữ tiêu điểm trong phạm vi phòng để không kéo văn phòng ra khỏi màn hình.
function clampFocus(f) {
  return { x: Math.max(ROOM_BOX.x0, Math.min(ROOM_BOX.x1, f.x)), y: Math.max(ROOM_BOX.y0, Math.min(ROOM_BOX.y1, f.y)) };
}
// Phóng to/thu nhỏ quanh một điểm màn hình (sx, sy): điểm văn phòng nằm dưới con trỏ đứng yên.
function zoomAt(sx, sy, factor) {
  if (camera.follow) return; // đang có cảnh chào khách thì không giành camera
  const z0 = camera.targetZoom;
  const z1 = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z0 * factor));
  if (Math.abs(z1 - z0) < 1e-4) return;
  const f0 = camera.manual || camera.focus;
  const s0 = view.scale * z0, s1 = view.scale * z1;
  const px = f0.x + (sx - view.cx) / s0, py = f0.y + (sy - view.cy) / s0;
  camera.speed = 10;
  camera.targetZoom = z1;
  camera.manual = z1 <= ZOOM_MIN + 1e-3 ? null : clampFocus({ x: px - (sx - view.cx) / s1, y: py - (sy - view.cy) / s1 });
  updateZoomUi();
}
function resetZoom() {
  if (camera.follow) return;
  camera.speed = 6;
  camera.targetZoom = 1;
  camera.manual = null;
  updateZoomUi();
}
// ---- Chuyển tầng ----
function renderFloorSwitch() {
  const box = $("floorSwitch");
  box.replaceChildren(...FLOOR_IDS.map(f => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `floor-btn${f === FLOOR ? " on" : ""}`;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(f === FLOOR));
    b.textContent = t("floor.name", { n: f });
    b.addEventListener("click", () => switchFloor(f));
    return b;
  }));
  layoutView();
}

function updateZoomUi() {
  $("zoomLevel").textContent = `${Math.round(camera.targetZoom * 100)}%`;
  $("zoomOutBtn").disabled = camera.targetZoom <= ZOOM_MIN + 1e-3;
  $("zoomInBtn").disabled = camera.targetZoom >= ZOOM_MAX - 1e-3;
  canvas.classList.toggle("can-pan", camera.targetZoom > 1.001 && !editor.open);
}

canvas.addEventListener("wheel", event => {
  event.preventDefault();
  const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY; // chuột "theo dòng" (Firefox)
  zoomAt(event.clientX, event.clientY, Math.exp(-delta * 0.0015));
}, { passive: false });
canvas.addEventListener("dblclick", () => { if (!editor.open) resetZoom(); });
canvas.addEventListener("contextmenu", event => { if (camera.pan || camera.targetZoom > 1) event.preventDefault(); });

// Kéo để di chuyển khi đã phóng to: chuột trái (khi không sắp xếp nội thất), hoặc chuột phải/giữa (bất kỳ lúc nào).
function startPan(event) {
  const wantsPan = event.button === 1 || event.button === 2 || (event.button === 0 && !editor.open);
  if (!wantsPan || camera.follow || camera.targetZoom <= 1.001) return false;
  camera.pan = { x: event.clientX, y: event.clientY, id: event.pointerId };
  camera.manual = camera.manual || { ...camera.focus };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-panning");
  return true;
}
function movePan(event) {
  if (!camera.pan) return false;
  const s = view.scale * camera.zoom;
  const next = clampFocus({
    x: camera.manual.x - (event.clientX - camera.pan.x) / s,
    y: camera.manual.y - (event.clientY - camera.pan.y) / s,
  });
  camera.manual = next;
  camera.focus = { ...next }; // kéo thì bám tay ngay, không trễ
  camera.pan.x = event.clientX;
  camera.pan.y = event.clientY;
  return true;
}
function endPan() {
  if (!camera.pan) return false;
  camera.pan = null;
  canvas.classList.remove("is-panning");
  return true;
}

function updateCamera(dt) {
  const k = 1 - Math.exp(-dt * camera.speed); // chào khách: chậm (~1,4 giây); người dùng lăn chuột: nhanh
  const t = focusTarget();
  camera.zoom += (camera.targetZoom - camera.zoom) * k;
  camera.focus.x += (t.x - camera.focus.x) * k;
  camera.focus.y += (t.y - camera.focus.y) * k;
  if (!camera.follow && !camera.manual && Math.abs(camera.zoom - 1) < 0.001) { camera.zoom = 1; camera.focus = { ...view.home }; }
}
window.addEventListener("resize", layoutView);
new ResizeObserver(layoutView).observe(document.body);

// Toạ độ chuột -> toạ độ logic của văn phòng.
function canvasPoint(event) {
  const s = view.scale * camera.zoom;
  return { x: camera.focus.x + (event.clientX - view.cx) / s, y: camera.focus.y + (event.clientY - view.cy) / s };
}

// ===========================================================================
// Vẽ phòng
// ===========================================================================
// Văn bản dán lên tường sau (mặt phẳng y = Y) hoặc tường trái (x = X, chữ chạy theo chiều y giảm).
function wallText(plane, at, text, font, color, { clip = null, offset = 0 } = {}) {
  const len = Math.hypot(ISO.kx, ISO.ky);
  const p = plane === "back" ? project(at.x, at.y, at.z) : project(at.x, at.y, at.z);
  ctx.save();
  ctx.translate(p.x, p.y);
  if (plane === "back") ctx.transform(ISO.kx / len, ISO.ky / len, 0, 1, 0, 0);
  else ctx.transform(ISO.kx / len, -ISO.ky / len, 0, 1, 0, 0);
  if (clip) { ctx.beginPath(); ctx.rect(0, -clip.h, clip.w, clip.h); ctx.clip(); }
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, -offset, 0);
  const width = ctx.measureText(text).width;
  ctx.restore();
  return width;
}

// Tường sau chạy hết chiều dài mặt bằng chữ L: tường "back" (y = 24) và tường "left" (x = 24).
function drawWalls() {
  const EX = PLAN.outerMaxX, EY = PLAN.outerMaxY, IX = PLAN.maxX, IY = PLAN.maxY;
  poly([{ x: 24, y: 24 }, { x: EX, y: 24 }, { x: EX, y: 24, z: 120 }, { x: 24, y: 24, z: 120 }], "#e6ecf5", "#b9c6dd");
  poly([{ x: 30, y: 30, z: 8 }, { x: IX, y: 30, z: 8 }, { x: IX, y: 30, z: 116 }, { x: 30, y: 30, z: 116 }], "#f5f8fc");
  poly([{ x: 24, y: 24 }, { x: 24, y: EY }, { x: 24, y: EY, z: 120 }, { x: 24, y: 24, z: 120 }], "#dbe3ef", "#b9c6dd");
  poly([{ x: 30, y: 30, z: 8 }, { x: 30, y: IY, z: 8 }, { x: 30, y: IY, z: 116 }, { x: 30, y: 30, z: 116 }], "#edf2f8");
  // Đường ghép tường nơi vách ngăn chạm tường sau
  for (const w of WALLS.filter(w => w.a <= 24)) {
    if (w.plane === "x") line({ x: w.at, y: 30, z: 8 }, { x: w.at, y: 30, z: 116 }, "rgba(120, 140, 180, 0.35)", 1.5);
    else line({ x: 30, y: w.at, z: 8 }, { x: 30, y: w.at, z: 116 }, "rgba(120, 140, 180, 0.35)", 1.5);
  }

  const W = (x0, x1, z0, z1, fill, stroke) =>
    poly([{ x: x0, y: 29, z: z0 }, { x: x1, y: 29, z: z0 }, { x: x1, y: 29, z: z1 }, { x: x0, y: 29, z: z1 }], fill, stroke);
  const P = (y0, y1, z0, z1, fill, stroke) =>
    poly([{ x: 31, y: y0, z: z0 }, { x: 31, y: y1, z: z0 }, { x: 31, y: y1, z: z1 }, { x: 31, y: y0, z: z1 }], fill, stroke);

  // Cửa sổ: plane "back" = tường sau (chạy theo x), "left" = tường trái (chạy theo y).
  const windowAt = (plane, a0, a1) => {
    const F = plane === "back" ? W : P;
    F(a0, a1, 49, 105, "#d3dceb", "#9fb0d0");
    F(a0 + 5, a1 - 5, 55, 99, "#6691ec", "#8db0fc");
    F(a0 + 5, a1 - 5, 55, 62, "#94b5fc");
    const n = Math.max(2, Math.round((a1 - a0) / 40));
    for (let k = 1; k < n; k++) {
      const m = a0 + 5 + ((a1 - a0 - 10) * k) / n;
      F(m - 2, m + 2, 55, 99, "#f4f7fb");
    }
    F(a0 + 5, a1 - 5, 76, 80, "#f4f7fb");
    const sill = plane === "back"
      ? [{ x: a0, y: 29, z: 46 }, { x: a1, y: 29, z: 46 }, { x: a1, y: 40, z: 46 }, { x: a0, y: 40, z: 46 }]
      : [{ x: 29, y: a0, z: 46 }, { x: 29, y: a1, z: 46 }, { x: 40, y: a1, z: 46 }, { x: 40, y: a0, z: 46 }];
    poly(sill, "#ffffff", "#b9c6dd");
  };
  for (const w of WINDOWS) windowAt(w.plane, w.a0, w.a1);

  // Biển số tầng – góc trong cùng của phòng nhân viên
  P(36, 92, 56, 106, "#06132e", "#5288fb");
  P(40, 88, 60, 102, "#07173b");
  wallText("left", { x: 31, y: 86, z: 76 }, `${FLOOR}F`, "900 24px \"Segoe UI\", sans-serif", "#e4ebfb");
  wallText("left", { x: 31, y: 86, z: 64 }, t("wall.floor", { n: FLOOR }), "800 6.5px \"Segoe UI\", sans-serif", "#5288fb");

  // Đồng hồ treo tường – chạy theo giờ thật (phòng học lớn)
  const cx = PLAN.maxX - 15, cz = 92, r = 11, Y = 29;
  const ring = k => Array.from({ length: 16 }, (_, i) => ({ x: cx + Math.cos(i / 16 * Math.PI * 2) * k, y: Y, z: cz + Math.sin(i / 16 * Math.PI * 2) * k }));
  poly(ring(r + 2), "#293550");
  poly(ring(r), "#c8d8fa");
  const now = new Date();
  const hand = (frac, len, color, width) => {
    const a = frac * Math.PI * 2;
    line({ x: cx, y: Y, z: cz }, { x: cx + Math.sin(a) * len, y: Y, z: cz + Math.cos(a) * len }, color, width);
  };
  hand(((now.getHours() % 12) + now.getMinutes() / 60) / 12, 6, "#192236", 2);
  hand((now.getMinutes() + now.getSeconds() / 60) / 60, 8.5, "#192236", 1.5);
  hand(now.getSeconds() / 60, 9.5, "#c0463a", 1);

  line({ x: 30, y: 31, z: 10 }, { x: IX, y: 31, z: 10 }, "#c3cfe4", 3);
  line({ x: 31, y: 30, z: 10 }, { x: 31, y: IY, z: 10 }, "#c3cfe4", 3);
  line({ x: 30, y: 30, z: 112 }, { x: IX, y: 30, z: 112 }, "#dde5f1", 5);
}

// ===========================================================================
// Trình sắp xếp nội thất
// ===========================================================================
const editor = { open: false, placing: null, placingRotation: 0, selectedId: null, drag: null, hover: null, resetArmedUntil: 0 };
const ghost = { id: "ghost", type: "desk", x: 0, y: 0, rotation: 0 };
let drawOrder = [];

const snap = v => Math.round(v / 5) * 5;
const selectedItem = () => layout.find(it => it.id === editor.selectedId) || null;
const validAt = (item, at) => fitsInRoom(item, at) && !overlapsAny(item, layout, at);
function setHint(text) { $("furnitureHint").textContent = text; }

// Bấm vào tủ hồ sơ (khi không sắp xếp nội thất) để mở tủ.
let clickStart = null;
function itemAt(event) {
  const s = canvasPoint(event);
  return pickItem(drawOrder, s.x, s.y, unproject(s.x, s.y));
}
canvas.addEventListener("pointerdown", event => {
  clickStart = !editor.open && event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
  if (startPan(event)) return;
  if (!editor.open || event.button !== 0) return;
  const s = canvasPoint(event);
  const world = unproject(s.x, s.y);
  if (editor.placing) {
    Object.assign(ghost, { type: editor.placing, rotation: editor.placingRotation, x: snap(world.x), y: snap(world.y) });
    if (!validAt(ghost, ghost)) { setHint(t("furn.cantPlace")); return; }
    const item = { id: newId(), type: ghost.type, x: ghost.x, y: ghost.y, rotation: ghost.rotation, assignedTo: "" };
    layout.push(item);
    editor.selectedId = item.id;
    if (!event.shiftKey) editor.placing = null;
    setHint(event.shiftKey ? t("furn.shiftHint") : t("furn.placed", { label: t(`furn.item.${item.type}`) }));
    commitLayout();
    return;
  }
  const item = pickItem(drawOrder, s.x, s.y, world);
  editor.selectedId = item ? item.id : null;
  if (item) {
    editor.drag = { id: item.id, dx: item.x - world.x, dy: item.y - world.y, moved: false };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
  }
  renderEditor();
});

canvas.addEventListener("pointermove", event => {
  if (movePan(event)) return;
  if (!editor.open) canvas.classList.toggle("over-cabinet", CLICKABLE.has(itemAt(event)?.type));
  const world = unproject(...Object.values(canvasPoint(event)));
  editor.hover = world;
  if (!editor.drag) return;
  const item = layout.find(it => it.id === editor.drag.id);
  if (!item) return;
  const at = { x: snap(world.x + editor.drag.dx), y: snap(world.y + editor.drag.dy) };
  if ((at.x !== item.x || at.y !== item.y) && validAt(item, at)) {
    item.x = at.x;
    item.y = at.y;
    editor.drag.moved = true;
  }
});

function endDrag() {
  if (!editor.drag) return;
  const moved = editor.drag.moved;
  editor.drag = null;
  canvas.classList.remove("is-dragging");
  if (moved) commitLayout();
}
canvas.addEventListener("pointerup", event => {
  endPan();
  endDrag();
  const c = clickStart;
  clickStart = null;
  if (!c || Math.hypot(event.clientX - c.x, event.clientY - c.y) >= 5) return;
  const type = itemAt(event)?.type;
  if (type === "cabinet") openCabinet();
  else if (type === "printer") openPrinter();
  else if (type === "whiteboard") openBoard();
});
canvas.addEventListener("pointercancel", () => { endPan(); endDrag(); });
$("zoomInBtn").addEventListener("click", () => zoomAt(view.cx, view.cy, 1.35));
$("zoomOutBtn").addEventListener("click", () => zoomAt(view.cx, view.cy, 1 / 1.35));
$("zoomReset").addEventListener("click", resetZoom);
document.addEventListener("keydown", event => {
  const tag = document.activeElement?.tagName;
  if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || !$("pledge").hidden) return;
  if (event.key === "+" || event.key === "=") zoomAt(view.cx, view.cy, 1.25);
  else if (event.key === "-" || event.key === "_") zoomAt(view.cx, view.cy, 1 / 1.25);
  else if (event.key === "0") resetZoom();
});
canvas.addEventListener("pointerleave", () => { editor.hover = null; });

function rotateSelection() {
  if (editor.placing) { editor.placingRotation = (editor.placingRotation + 1) % 4; renderEditor(); return; }
  const item = selectedItem();
  if (!item) return;
  const turned = { ...item, rotation: (rot(item) + 1) % 4 };
  if (!validAt(turned, turned)) { setHint(t("furn.cantRotate")); return; }
  item.rotation = turned.rotation;
  commitLayout();
}

function deleteSelection() {
  const item = selectedItem();
  if (!item) return;
  layout = layout.filter(it => it !== item);
  editor.selectedId = null;
  setHint(t("furn.deleted", { label: t(`furn.item.${item.type}`) }));
  commitLayout();
}

function furnToggleLabel() {
  setLabel($("furnitureToggle"), editor.open ? "check" : "move", editor.open ? t("furn.done") : t("furn.enable"));
}

function setEditing(on) {
  editor.open = on;
  if (!on) { editor.placing = null; editor.selectedId = null; }
  $("furnitureEditor").hidden = !on;
  $("furnitureToggle").setAttribute("aria-expanded", String(on));
  furnToggleLabel();
  canvas.classList.toggle("is-editing", on);
  renderEditor();
  updateZoomUi();
}

$("furnitureRotate").addEventListener("click", rotateSelection);
$("furnitureDelete").addEventListener("click", deleteSelection);
$("furnitureToggle").addEventListener("click", () => setEditing(!editor.open));
$("furnitureReset").addEventListener("click", () => {
  const btn = $("furnitureReset");
  if (performance.now() > editor.resetArmedUntil) {
    editor.resetArmedUntil = performance.now() + 3000;
    setLabel(btn, "alert", t("furn.confirm"));
    setTimeout(() => { setLabel(btn, "reset", t("furn.reset")); }, 3000);
    return;
  }
  editor.resetArmedUntil = 0;
  setLabel(btn, "reset", t("furn.reset"));
  layout = defaultFloorLayout(FLOOR);
  editor.selectedId = null;
  editor.placing = null;
  setHint(t("furn.restored"));
  commitLayout();
});
// Bàn mặc định của ai: chọn người -> bàn này thành bàn mặc định của họ (người đang giữ bàn này đổi sang bàn cũ của người kia).
const homeOwnerOf = item => team.find(r => r.homeDesk === item.id) || null;
// ---- Lưu / mở file: bố cục + đồ đạc + hồ sơ nhân viên ----
$("layoutExport").addEventListener("click", () => {
  const data = {
    app: "gki-office", kind: "layout", version: 1, planVersion: PLAN_VERSION, savedAt: new Date().toISOString(),
    layout: (FLOOR === 9 ? layout : layouts[9]).map(({ _cache, ...rest }) => rest),
    floors: Object.fromEntries(FLOOR_IDS.filter(f => f !== 9).map(f => [f, (f === FLOOR ? layout : layouts[f]).map(({ _cache, ...rest }) => rest)])),
    team,
  };
  const d = new Date(), pad = n => String(n).padStart(2, "0");
  const name = `gki-van-phong-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(t("layout.exported", { name }), 4500, "save");
});
$("layoutImport").addEventListener("click", () => $("layoutFile").click());
$("layoutFile").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const items = cleanLayout(data?.layout, Number(data?.planVersion) || 1);
    if (!items.length) throw new Error("no layout");
    if (net.busy || isDemoRunning() || lessonState().active) { toast(t("staff.busy"), 3500, "alert"); return; }
    layouts[9] = items;
    for (const f of FLOOR_IDS.filter(f => f !== 9)) {
      layouts[f] = cleanLayout(data?.floors?.[f], PLAN_VERSION);
      store.set(FLOOR_LAYOUT_KEYS[f], layouts[f]);
    }
    store.set(FLOOR_LAYOUT_KEYS[9], items);
    store.set(PLAN_VER_KEY, PLAN_VERSION);
    layout = layouts[FLOOR];
    editor.selectedId = null;
    const imported = sanitizeTeam(data.team);
    if (imported) team = imported;
    commitLayout();
    applyTeam();
    seatEveryone();
    toast(t("layout.imported", { n: items.length }), 3500, "check");
    log(t("layout.imported", { n: items.length }), "job");
  } catch {
    toast(t("layout.importFail"), 4500, "alert");
  }
});

$("furnitureAssignment").addEventListener("change", event => {
  const item = selectedItem();
  if (!item || !isWorkDesk(item)) return;
  const who = event.target.value;
  const prev = homeOwnerOf(item);
  const rec = recOf(who);
  if (prev && prev !== rec) prev.homeDesk = rec ? rec.homeDesk : "";
  if (rec) rec.homeDesk = item.id;
  setHint(rec ? t("furn.assigned", { title: nameOf(rec.id) }) : t("furn.unassigned"));
  applyTeam();
  renderEditor();
});
function renderAssignmentOptions() {
  const select = $("furnitureAssignment");
  const value = select.value;
  select.replaceChildren(new Option(t("furn.emptyDesk"), ""), ...team.map(r => new Option(nameOf(r.id), r.id)));
  select.value = value;
}

function layoutWarnings() {
  const warnings = [];
  for (const r of team) {
    // Bàn có thể ở tầng khác: chỉ báo "chưa có bàn" khi không tầng nào có; lối đi tới ghế chỉ xét ở tầng đang xem.
    if (!deskItems().some(it => it.id === r.homeDesk)) { warnings.push(t("furn.warn.noDesk", { title: nameOf(r.id) })); continue; }
    const desk = layout.find(it => it.id === r.homeDesk && isWorkDesk(it));
    if (desk && staff[r.id] && !reachable(staff[r.id], seatPoint(desk))) warnings.push(t("furn.warn.blocked", { title: nameOf(r.id) }));
  }
  // Bảng trắng, kệ sách, máy in, tủ hồ sơ, thùng rác phục vụ hoạt động ở tầng 9 (Giám đốc, Trợ giảng chính) – tầng khác không cần.
  if (FLOOR === 9) {
    const has = t => layout.some(it => it.type === t);
    if (!has("whiteboard")) warnings.push(t("furn.warn.noWhiteboard"));
    if (!has("bookshelf")) warnings.push(t("furn.warn.noBookshelf"));
    if (!has("printer")) warnings.push(t("furn.warn.noPrinter"));
    if (!has("cabinet")) warnings.push(t("furn.warn.noCabinet"));
    if (!has("trash")) warnings.push(t("furn.warn.noTrash"));
  }
  for (const d of floorDesks()) {
    if (chairBlocked(d)) warnings.push(t("furn.warn.chairWall", { label: deskLabel(d) }));
  }
  return warnings;
}

function renderEditor() {
  $("furnitureCatalog").replaceChildren(...Object.entries(CATALOG).map(([type, def]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `furniture-card${editor.placing === type ? " active" : ""}`;
    setLabel(b, `f-${type}`, t(`furn.item.${type}`));
    b.addEventListener("click", () => {
      editor.placing = editor.placing === type ? null : type;
      editor.selectedId = null;
      setHint(editor.placing ? t("furn.placing", { label: t(`furn.item.${type}`) }) : t("furn.cancelPlace"));
      renderEditor();
    });
    return b;
  }));
  $("furnitureCount").textContent = t("furn.count", { n: layout.length });
  const item = selectedItem();
  $("furnitureRotate").disabled = !item && !editor.placing;
  $("furnitureDelete").disabled = !item;
  setLabel($("furnitureSelection"), item ? `f-${item.type}` : null, item
    ? t("furn.selected", { label: t(`furn.item.${item.type}`), deg: rot(item) * 90 })
    : editor.placing ? t("furn.ready", { label: t(`furn.item.${editor.placing}`), deg: editor.placingRotation * 90 }) : t("furn.none"));
  $("furnitureAssignmentWrap").hidden = !item || !isWorkDesk(item);
  if (item && isWorkDesk(item)) $("furnitureAssignment").value = homeOwnerOf(item)?.id || "";
  canvas.classList.toggle("is-placing", !!editor.placing);
  const warnings = layoutWarnings();
  $("furnitureWarnings").replaceChildren(...warnings.map(w => Object.assign(document.createElement("li"), { textContent: w })));
  $("furnitureWarnings").hidden = !warnings.length;
}

// ===========================================================================
// Vòng lặp vẽ (mô phỏng 60 Hz cố định, vẽ theo tần số màn hình)
// ===========================================================================
const onboarding = { greeting: false };

function render() {
  const tick = getTick();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.45, 0, canvas.width / 2, canvas.height * 0.45, Math.max(canvas.width, canvas.height) * 0.7);
  g.addColorStop(0, "#3561c2");
  g.addColorStop(1, "#244a9c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const s = view.scale * camera.zoom;
  ctx.setTransform(view.dpr * s, 0, 0, view.dpr * s,
    view.dpr * (view.cx - camera.focus.x * s), view.dpr * (view.cy - camera.focus.y * s));

  drawSkyline(ctx, tick); // phong cảnh thành phố bên ngoài (đổi theo ngôn ngữ)
  drawFloorPlan();
  drawWalls();

  if (editor.open) {
    for (let v = PLAN.min; v <= PLAN.maxX; v += 50) line({ x: v, y: PLAN.min }, { x: v, y: v <= PLAN.notchX ? PLAN.maxY : PLAN.notchY }, "rgba(142, 177, 252, 0.10)");
    for (let v = PLAN.min; v <= PLAN.maxY; v += 50) line({ x: PLAN.min, y: v }, { x: v <= PLAN.notchY ? PLAN.maxX : PLAN.notchX, y: v }, "rgba(142, 177, 252, 0.10)");
  }

  if (onboarding.greeting && staff.manager) lookAt(staff.manager);
  drawOrder = isoSort([
    ...wallDrawables(),
    ...sceneDrawables(layout),
    ...agentDrawables(a => drawAgent(a, project(a.x, a.y), tick)),
  ]);
  for (const d of drawOrder) d.draw();

  // Cục giấy đang bay theo đường parabol vào thùng rác.
  for (const e of effects) {
    const k = Math.min(1, (tick - e.start) / e.ticks);
    const x = e.from.x + (e.to.x - e.from.x) * k;
    const y = e.from.y + (e.to.y - e.from.y) * k - e.peak * 4 * k * (1 - k);
    drawPaperBall(ctx, x, y, 4.4 - k * 1.4, tick * 0.35);
  }

  if (editor.open) drawEditorOverlay();

  const taken = [];
  visibleAgents().filter(a => !a.hidden && (a.name || bubbleOf(a)))
    .sort((a, b) => b.x + b.y - (a.x + a.y))
    .forEach(a => drawOverlay(a, project(a.x, a.y), bubbleOf(a), taken));
}

function drawEditorOverlay() {
  const sel = selectedItem();
  if (sel) {
    floorRect(footprint(sel), "rgba(142, 177, 252, 0.10)", "#8eb1fc", [5, 4]);
    if (isWorkDesk(sel)) {
      const seat = project(seatPoint(sel).x, seatPoint(sel).y);
      const owner = homeOwnerOf(sel);
      ctx.fillStyle = owner ? roleColor(owner.id) : "#8eb1fc";
      ctx.beginPath(); ctx.arc(seat.x, seat.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const desk of floorDesks()) {
    const rec = homeOwnerOf(desk);
    const owner = rec && staff[rec.id];
    const seat = seatPoint(desk);
    if (owner && Math.hypot(owner.x - seat.x, owner.y - seat.y) < 20) continue;
    const p = project(desk.x, desk.y, 62);
    const label = owner ? owner.name : t("furn.emptyLabel");
    ctx.font = "600 9px \"Segoe UI\", system-ui, sans-serif";
    ctx.textAlign = "center";
    const w = ctx.measureText(label).width + 10;
    ctx.fillStyle = "rgba(255, 255, 255, .92)";
    ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y - 11, w, 13, 6); ctx.fill();
    ctx.fillStyle = owner ? roleColor(rec.id) : "#5a6a88";
    ctx.fillText(label, p.x, p.y - 1.5);
  }
  if (editor.placing && editor.hover) {
    Object.assign(ghost, { type: editor.placing, rotation: editor.placingRotation, x: snap(editor.hover.x), y: snap(editor.hover.y) });
    const ok = validAt(ghost, ghost);
    floorRect(footprint(ghost), ok ? "rgba(82, 136, 251, 0.18)" : "rgba(224,103,90,0.25)", ok ? "#5288fb" : "#e0675a", [4, 3]);
    ghost._cache = null;
    drawItem(ghost, 0.6, true);
  }
}

const STEP_MS = 1000 / TICK_HZ;
let lastFrame = performance.now();
let accumulator = 0;
function frame(now) {
  const dt = Math.min(250, now - lastFrame);
  accumulator += dt;
  lastFrame = now;
  while (accumulator >= STEP_MS) { update(); accumulator -= STEP_MS; }
  updateCamera(dt / 1000);
  render();
  requestAnimationFrame(frame);
}

// ===========================================================================
// Khung giao diện: menu, khung thu gọn, đội ngũ, nhật ký, báo cáo, thông báo
// ===========================================================================
const UI_KEY = "ai-office-ui";
const ui = { report: window.innerWidth > 1000, side: window.innerWidth > 1000, task: true, ...store.get(UI_KEY, {}) };

function applyPanels() {
  $("reportPanel").hidden = !ui.report;
  $("sidePanel").hidden = !ui.side;
  $("reportTab").hidden = ui.report;
  $("sideTab").hidden = ui.side;
  // Khung giao việc ⇄ nút giữa cạnh dưới: đổi lớp CSS (có hiệu ứng) thay vì ẩn/hiện tức thì.
  $("taskbar").classList.toggle("folded", !ui.task);
  $("taskTab").classList.toggle("folded", ui.task);
  $("taskbar").inert = !ui.task;
  $("taskTab").inert = ui.task;
  renderTaskTab();
  $("showReport").checked = ui.report;
  $("showSide").checked = ui.side;
  store.set(UI_KEY, ui);
  layoutView();
}
document.querySelectorAll("[data-collapse]").forEach(btn => btn.addEventListener("click", () => {
  if (btn.dataset.collapse === "report") setExpanded(false);
  ui[btn.dataset.collapse] = false;
  applyPanels();
}));
$("reportTab").addEventListener("click", () => { ui.report = true; applyPanels(); });
$("sideTab").addEventListener("click", () => { ui.side = true; applyPanels(); });
// Khung giao việc thu gọn thành nút nhỏ ở góc dưới; đang có nhiệm vụ thì nút quay vòng.
function renderTaskTab() {
  const busy = net.busy || isDemoRunning() || lessonState().active;
  setLabel($("taskTab"), busy ? "spinner" : "send", busy ? t("task.busy") : t("task.send"));
  $("taskTab").classList.toggle("busy", busy);
}
$("taskTab").addEventListener("click", () => { ui.task = true; applyPanels(); $("taskInput").focus({ preventScroll: true }); });
$("showReport").addEventListener("change", e => { ui.report = e.target.checked; if (!ui.report) setExpanded(false); applyPanels(); });
$("showSide").addEventListener("change", e => { ui.side = e.target.checked; applyPanels(); });

function setDrawer(open) {
  $("drawer").hidden = !open;
  $("menuButton").setAttribute("aria-expanded", String(open));
  $("menuButton").innerHTML = icon(open ? "close" : "menu");
  if (!open && editor.open) setEditing(false);
}
$("menuButton").addEventListener("click", () => setDrawer($("drawer").hidden));
$("drawerClose").addEventListener("click", () => setDrawer(false));

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("cabinet").hidden) { closeCabinet(); return; }
  if (event.key === "Escape" && !$("printer").hidden) { closePrinter(); return; }
  if (event.key === "Escape" && !$("board").hidden) { closeBoard(); return; }
  if (event.key === "Escape" && !$("staffModal").hidden) { closeStaff(); return; }
  if (event.key === "Escape" && reportView.expanded) { setExpanded(false); return; }
  const tag = document.activeElement?.tagName;
  if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
  if (!$("pledge").hidden) return;
  if (editor.open) {
    if (event.key === "r" || event.key === "R") { rotateSelection(); event.preventDefault(); return; }
    if (event.key === "Delete" || event.key === "Backspace") { deleteSelection(); event.preventDefault(); return; }
    if (event.key === "Escape" && (editor.placing || editor.selectedId)) { editor.placing = null; editor.selectedId = null; renderEditor(); return; }
  }
  if (event.key === "Escape" && !$("drawer").hidden) setDrawer(false);
});

let toastTimer = null;
function toast(text, ms = 3500, iconName = null) {
  const el = $("toast");
  setLabel(el, iconName, text);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}


function renderTeam() {
  $("teamList").replaceChildren(...team.map(r => {
    const a = staff[r.id];
    const status = a?.serverStatus || "idle";
    const li = document.createElement("li");
    li.className = `team-row status-${status}`;
    li.tabIndex = 0;
    li.setAttribute("role", "button");
    li.title = t("staff.openHint");
    li.innerHTML = `<span class="team-dot"></span><div class="team-info"><strong></strong><small></small></div><span class="pill"></span>`;
    li.querySelector(".team-dot").style.background = roleColor(r.id);
    li.querySelector("strong").textContent = nameOf(r.id);
    li.querySelector("small").textContent = status !== "idle" && a?.serverMessage ? a.serverMessage : `${roleTitle(r.role)} · ${roleDuty(r.role)}`;
    li.querySelector(".pill").textContent = t(`team.status.${status}`);
    const open = () => openStaff(r.id);
    li.addEventListener("click", open);
    li.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    return li;
  }));
  setLabel($("workModeBtn"), "f-desk", t("work.mode"));
  $("workModeBtn").setAttribute("aria-pressed", String(flags.workMode));
  $("workModeBtn").classList.toggle("on", flags.workMode);
  setLabel($("manageStaff"), "plus", t("staff.manage"));
}

// ---- Chế độ làm việc: mọi người sang "bàn làm việc" ----
$("workModeBtn").addEventListener("click", () => {
  setWorkMode(!flags.workMode);
  store.set("ai-office-workmode", flags.workMode);
  toast(t(flags.workMode ? "work.on" : "work.off"), 3000, "f-desk");
  renderTeam();
});

// ---- Hồ sơ nhân viên: tên, vai trò, bàn, ngoại hình (xem trước trực tiếp) ----
const staffUi = { id: DIRECTOR_ID, turn: 0, raf: 0 };
const PREVIEW_FACES = ["SE", "S", "SW", "W", "NW", "N", "NE", "E"];
const jobRunning = () => net.busy || isDemoRunning() || lessonState().active;

function deskLabel(item) {
  const fl = deskFloor(item.id);
  const same = deskItems().filter(d => d.type === item.type && deskFloor(d.id) === fl);
  const room = roomAt(item.x, item.y);
  const owner = homeOwnerOf(item);
  return `${t("floor.name", { n: fl })} · ${t(`furn.item.${item.type}`)} ${same.indexOf(item) + 1}${fl === FLOOR && room ? ` · ${t(`room.${room}`)}` : ""}${owner ? ` (${t("staff.deskTaken", { name: nameOf(owner.id) })})` : ""}`;
}

function openStaff(id = staffUi.id) {
  if (!$("pledge").hidden) return;
  staffUi.id = recOf(id) ? id : DIRECTOR_ID;
  renderStaffEditor();
  $("staffModal").hidden = false;
  cancelAnimationFrame(staffUi.raf);
  const loop = () => { if ($("staffModal").hidden) return; drawPreview(); staffUi.raf = requestAnimationFrame(loop); };
  loop();
  $("staffClose").focus();
}
function closeStaff() { $("staffModal").hidden = true; cancelAnimationFrame(staffUi.raf); }
$("manageStaff").addEventListener("click", () => openStaff());
$("staffClose").addEventListener("click", closeStaff);
$("staffModal").addEventListener("click", event => { if (event.target === $("staffModal")) closeStaff(); });

// Nhân vật xem trước: dùng đúng hàm vẽ trong văn phòng, phóng to vừa khung.
const previewAgent = { id: "preview", look: null, facing: "SE", moving: false, working: false, talking: false, seatBlend: 0, lift: 0, holding: null, animationSeed: 3 };
function drawPreview() {
  const c = $("staffPreview");
  const rec = recOf(staffUi.id);
  if (!c || !rec) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = c.clientWidth || 140, H = c.clientHeight || 170;
  if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  const pc = c.getContext("2d");
  pc.setTransform(1, 0, 0, 1, 0, 0);
  pc.clearRect(0, 0, c.width, c.height);
  const k = dpr * Math.min(1.75, (H - 24) / 92); // nhân vật cao ~92 đơn vị (kể cả tóc búi)
  pc.setTransform(k, 0, 0, k, (W / 2) * dpr, (H - 14) * dpr);
  Object.assign(previewAgent, { look: rec.look, facing: PREVIEW_FACES[staffUi.turn % 8] });
  bindContext(pc);
  try { drawAgent(previewAgent, { x: 0, y: 0 }, getTick()); } finally { bindContext(ctx); }
}
$("staffTurn").addEventListener("click", () => { staffUi.turn++; });

function swatches(container, colors, value, onPick, label) {
  container.replaceChildren(...colors.map(col => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `swatch${col.toLowerCase() === String(value).toLowerCase() ? " on" : ""}`;
    b.style.background = col;
    b.setAttribute("aria-label", `${label} ${col}`);
    b.setAttribute("aria-pressed", String(col.toLowerCase() === String(value).toLowerCase()));
    b.addEventListener("click", () => onPick(col));
    return b;
  }));
}

function updateRec(fn, { rerender = true } = {}) {
  const rec = recOf(staffUi.id);
  if (!rec) return;
  fn(rec);
  applyTeam();
  if (rerender) renderStaffEditor();
}

function renderStaffList() {
  $("staffList").replaceChildren(...team.map(r => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = `staff-pick${r.id === staffUi.id ? " on" : ""}`;
    b.innerHTML = `<span class="team-dot"></span><span class="nm"></span><small></small>`;
    b.querySelector(".team-dot").style.background = roleColor(r.id);
    b.querySelector(".nm").textContent = nameOf(r.id);
    b.querySelector("small").textContent = roleTitle(r.role);
    b.addEventListener("click", () => { staffUi.id = r.id; renderStaffEditor(); });
    li.append(b);
    return li;
  }));
}

function renderStaffEditor() {
  const rec = recOf(staffUi.id);
  if (!rec) return;
  renderStaffList();
  setLabel($("staffAdd"), "plus", t("staff.add"));
  $("staffAdd").disabled = team.length >= MAX_STAFF;
  $("staffAdd").title = team.length >= MAX_STAFF ? t("staff.max", { n: MAX_STAFF }) : "";

  // Tên + vai trò
  const nameInput = $("staffName");
  if (document.activeElement !== nameInput) nameInput.value = rec.name || "";
  nameInput.placeholder = displayName({ ...rec, name: "" }, team);
  const gSel = $("staffGender");
  gSel.replaceChildren(...GENDERS.map(g => new Option(t(`gender.${g}`), g)));
  gSel.value = rec.look.gender === "female" ? "female" : "male";
  const roleSel = $("staffRole");
  const isDirector = rec.id === DIRECTOR_ID;
  roleSel.replaceChildren(...(isDirector ? ["director"] : STAFF_ROLES).map(r => new Option(roleTitle(r), r)));
  roleSel.value = rec.role;
  roleSel.disabled = isDirector || jobRunning();
  $("staffRoleHint").textContent = isDirector ? t("staff.directorRole") : roleDuty(rec.role);

  // Bàn
  const desks = deskItems();
  const homeSel = $("staffHome"), workSel = $("staffWork");
  homeSel.replaceChildren(new Option(t("staff.noDesk"), ""), ...desks.map(d => new Option(deskLabel(d), d.id)));
  homeSel.value = desks.some(d => d.id === rec.homeDesk) ? rec.homeDesk : "";
  workSel.replaceChildren(new Option(t("staff.sameDesk"), ""), ...desks.map(d => new Option(deskLabel(d), d.id)));
  workSel.value = desks.some(d => d.id === rec.workDesk) ? rec.workDesk : "";

  // Ngoại hình
  const L = rec.look;
  swatches($("staffSkin"), SKINS, L.skin, col => updateRec(r => { r.look.skin = col; }), t("staff.skin"));
  swatches($("staffHair"), HAIRS, L.hair, col => updateRec(r => { r.look.hair = col; }), t("staff.hair"));
  const hs = $("staffHairStyle");
  hs.replaceChildren(...HAIR_STYLES.map(s => new Option(t(`hair.${s}`), s)));
  hs.value = L.hairStyle;
  const of = $("staffOutfit");
  of.replaceChildren(...OUTFITS.map(s => new Option(t(`outfit.${s}`), s)));
  of.value = L.outfit;
  const bt = $("staffBottom");
  bt.replaceChildren(...BOTTOMS.map(b => new Option(t(`bottom.${b}`), b)));
  bt.value = L.bottom === "skirt" ? "skirt" : "pants";
  for (const k of ["jacket", "shirt", "accent", "pants"]) $(`staffC-${k}`).value = L[k];
  $("staffAcc").replaceChildren(...ACCESSORIES.map(a => {
    const lab = document.createElement("label");
    lab.className = "check chip";
    lab.innerHTML = `<input type="checkbox"> <span></span>`;
    lab.querySelector("input").checked = !!L[a];
    lab.querySelector("span").textContent = t(`acc.${a}`);
    lab.querySelector("input").addEventListener("change", e => updateRec(r => { r.look[a] = e.target.checked; }));
    return lab;
  }));

  const del = $("staffDelete");
  del.hidden = isDirector;
  if (del.dataset.armed !== "1") setLabel(del, "trash", t("staff.delete"));
  setLabel($("staffRandom"), "reset", t("staff.random"));
  setLabel($("staffTurn"), "rotate", t("staff.turn"));
}

$("staffName").addEventListener("input", event => {
  updateRec(r => { r.name = event.target.value.slice(0, 24); }, { rerender: false });
  renderStaffList();
});
$("staffName").addEventListener("change", () => renderStaffEditor());
$("staffRole").addEventListener("change", event => {
  if (jobRunning()) { toast(t("staff.busy"), 3000, "alert"); renderStaffEditor(); return; }
  updateRec(r => { if (r.id !== DIRECTOR_ID && STAFF_ROLES.includes(event.target.value)) r.role = event.target.value; });
});
// Đổi giới tính: tự chỉnh những chi tiết đi kèm (vẫn sửa lại được bằng tay).
$("staffGender").addEventListener("change", event => updateRec(r => {
  const L = r.look;
  L.gender = event.target.value;
  if (L.gender === "female") {
    L.beard = false;
    if (["short", "swept", "bald"].includes(L.hairStyle)) L.hairStyle = "long";
    L.bottom = "skirt";
  } else {
    if (["long", "bun"].includes(L.hairStyle)) L.hairStyle = "short";
    L.bottom = "pants";
    L.earrings = false;
  }
}));
$("staffBottom").addEventListener("change", event => updateRec(r => { r.look.bottom = event.target.value; }));
$("staffHome").addEventListener("change", event => updateRec(r => { r.homeDesk = event.target.value; }));
$("staffWork").addEventListener("change", event => updateRec(r => { r.workDesk = event.target.value; }));
$("staffHairStyle").addEventListener("change", event => updateRec(r => { r.look.hairStyle = event.target.value; }));
$("staffOutfit").addEventListener("change", event => updateRec(r => { r.look.outfit = event.target.value; }));
for (const k of ["jacket", "shirt", "accent", "pants"]) {
  $(`staffC-${k}`).addEventListener("input", event => updateRec(r => { r.look[k] = event.target.value; }, { rerender: false }));
}
$("staffRandom").addEventListener("click", () => updateRec(r => { r.look = randomLook(r.look.gender === "female" ? "female" : "male"); }));
$("staffAdd").addEventListener("click", () => {
  if (team.length >= MAX_STAFF) { toast(t("staff.max", { n: MAX_STAFF }), 3000, "alert"); return; }
  const used = new Set(team.map(r => r.homeDesk).filter(Boolean));
  const free = deskItems().find(d => !used.has(d.id));
  const counts = Object.fromEntries(STAFF_ROLES.map(r => [r, team.filter(x => x.role === r).length]));
  const role = STAFF_ROLES.slice().sort((a, b) => counts[a] - counts[b])[0];
  const rec = { id: newMemberId(team), role, name: "", homeDesk: free?.id || "", workDesk: "", look: randomLook() };
  team.push(rec);
  staffUi.id = rec.id;
  applyTeam();
  renderStaffEditor();
  toast(t("staff.added", { name: nameOf(rec.id) }), 3500, "smile");
  if (!free) toast(t("staff.noDeskWarn"), 4500, "alert");
  log(t("staff.added", { name: nameOf(rec.id) }), "job");
  $("staffName").focus();
});
$("staffDelete").addEventListener("click", () => {
  const rec = recOf(staffUi.id);
  if (!rec || rec.id === DIRECTOR_ID) return;
  if (jobRunning()) { toast(t("staff.busy"), 3000, "alert"); return; }
  armOnce($("staffDelete"), t("staff.confirm"), () => {
    const name = nameOf(rec.id);
    team = team.filter(r => r !== rec);
    staffUi.id = DIRECTOR_ID;
    applyTeam();
    renderStaffEditor();
    toast(t("staff.deleted", { name }), 3000, "trash");
  });
});

function log(text, tone = "") {
  const list = $("activityLog");
  list.querySelector(".empty")?.remove();
  const li = document.createElement("li");
  if (tone) li.className = tone;
  const time = document.createElement("time");
  time.textContent = fmtTime();
  li.append(time, document.createTextNode(text));
  list.prepend(li);
  while (list.children.length > 80) list.lastChild.remove();
}

// ===========================================================================
// Báo cáo: xem, phóng to, lưu vào tủ hồ sơ, xoá (Giám đốc vo giấy ném vào thùng rác)
// ===========================================================================
const REPORT_KEY = "ai-office-last-report";
const ARCHIVE_KEY = "ai-office-archive";
const ARCHIVE_MAX = 50;
const reportId = () => `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const report = { id: null, text: "", meta: null }; // báo cáo đang hiển thị (chỉ báo cáo hợp lệ mới có id)

let archive = store.get(ARCHIVE_KEY, []);
if (!Array.isArray(archive)) archive = [];
archive = archive.filter(e => e && typeof e.text === "string" && e.id);
runtime.archiveCount = archive.length;
const archived = id => archive.find(e => e.id === id) || null;

function showReport(text, meta = null, { error = false, id = null, persist = false } = {}) {
  const body = $("reportBody");
  body.classList.toggle("error", error);
  if (!text) {
    body.innerHTML = `<p class="placeholder" data-i18n="report.placeholder">${t("report.placeholder")}</p>`;
  } else if (error) {
    body.textContent = text;
  } else {
    body.innerHTML = renderMarkdown(text);
  }
  body.scrollTop = 0;
  body.dataset.raw = error ? "" : text || "";
  Object.assign(report, text && !error ? { id: id || reportId(), text, meta } : { id: null, text: "", meta: null });
  if (persist && report.id) store.set(REPORT_KEY, { id: report.id, text, meta });
  $("copyResult").disabled = !body.dataset.raw;
  $("reportMeta").hidden = !meta;
  if (meta) $("reportMeta").textContent = meta;
  if (!ui.report && text) { ui.report = true; applyPanels(); }
  renderReportActions();
}
$("copyResult").addEventListener("click", async () => {
  const btn = $("copyResult");
  try { await navigator.clipboard.writeText($("reportBody").dataset.raw || ""); setLabel(btn, "check", t("report.copied")); }
  catch { setLabel(btn, "alert", t("report.copyFail")); }
  setTimeout(() => { setLabel(btn, "copy", t("report.copy")); }, 1800);
});

// Tiêu đề: dòng tiêu đề Markdown đầu tiên, nếu không có thì dòng chữ đầu tiên.
function reportTitle(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const heading = lines.find(l => /^#{1,6}\s/.test(l));
  const raw = (heading || lines[0] || "").replace(/^#{1,6}\s+/, "").replace(/[*_`>#|]/g, "").trim();
  return raw.length > 90 ? `${raw.slice(0, 88)}…` : raw || t("report.untitled");
}

// Nút xoá cần bấm 2 lần (trong 3 giây) để tránh xoá nhầm.
function armOnce(btn, label, run) {
  if (btn.dataset.armed === "1") { btn.dataset.armed = ""; btn.classList.remove("armed"); run(); return; }
  btn.dataset.armed = "1";
  btn.classList.add("armed");
  const normal = btn.innerHTML;
  setLabel(btn, "alert", label);
  setTimeout(() => {
    if (btn.dataset.armed !== "1") return;
    btn.dataset.armed = "";
    btn.classList.remove("armed");
    btn.innerHTML = normal;
    delete btn.dataset.label;
  }, 3000);
}

function renderReportActions() {
  $("reportFoot").hidden = !report.id;
  const save = $("saveReport"), del = $("deleteReport");
  const saved = !!(report.id && archived(report.id));
  save.disabled = saved;
  save.classList.toggle("is-saved", saved);
  setLabel(save, saved ? "check" : "save", saved ? t("report.saved") : t("report.save"));
  if (del.dataset.armed !== "1") setLabel(del, "trash", t("report.delete"));
  const exp = $("reportExpand");
  const key = reportView.expanded ? "report.shrink" : "report.expand";
  exp.innerHTML = icon(reportView.expanded ? "shrink" : "expand");
  exp.title = t(key);
  exp.setAttribute("aria-label", t(key));
  exp.setAttribute("aria-pressed", String(reportView.expanded));
}

function setExpanded(on) {
  if (reportView.expanded === on) return;
  reportView.expanded = on;
  if (on && !ui.report) { ui.report = true; applyPanels(); }
  $("reportPanel").classList.toggle("expanded", on);
  $("reportBackdrop").hidden = !on;
  renderReportActions();
  layoutView();
}
$("reportExpand").addEventListener("click", () => setExpanded(!reportView.expanded));
$("reportBackdrop").addEventListener("click", () => setExpanded(false));

// Các cảnh của Giám đốc không chen ngang màn chào khách.
// Việc vặt do Trợ giảng chính làm (choreAgent); không chen ngang màn chào khách, người đang đứng lớp thì không rời lớp.
const managerFree = () => { const a = choreAgent(); return !!a && !onboarding.greeting && !a.lesson; };
const choreName = () => (choreAgent() ? nameOf(choreAgent().id) : "");

function saveReport() {
  if (!report.id || archived(report.id)) return;
  if (archive.length >= ARCHIVE_MAX) { toast(t("cabinet.full", { n: archive.length }), 4500, "alert"); return; }
  const entry = { id: report.id, title: reportTitle(report.text), text: report.text, meta: report.meta, savedAt: Date.now() };
  archive.unshift(entry);
  if (!store.set(ARCHIVE_KEY, archive)) { archive.shift(); toast(t("cabinet.storageFail"), 5000, "alert"); return; }
  renderReportActions();
  renderCabinet();
  toast(t("report.toastSaved"), 3500, "cabinet");
  log(t("log.filed", { title: entry.title }), "job");
  const filed = () => { runtime.archiveCount = archive.length; };
  if (managerFree()) fileReportScene(filed); else filed();
}

function deleteReport(id) {
  if (!id) return;
  if (archived(id)) {
    archive = archive.filter(e => e.id !== id);
    store.set(ARCHIVE_KEY, archive);
    runtime.archiveCount = archive.length;
  }
  if (report.id === id) {
    showReport("");
    try { localStorage.removeItem(REPORT_KEY); } catch { /* bỏ qua */ }
  }
  renderCabinet();
  toast(t("report.toastDeleted"), 3500, "trash");
  if (managerFree()) trashReportScene();
}
$("saveReport").addEventListener("click", saveReport);
$("deleteReport").addEventListener("click", () => {
  const btn = $("deleteReport");
  armOnce(btn, t("report.confirmDelete"), () => {
    setLabel(btn, "trash", t("report.delete"));
    deleteReport(report.id);
  });
});

// ---- Tủ hồ sơ ----
function renderCabinet() {
  $("cabinetCount").textContent = t("cabinet.count", { n: archive.length, max: ARCHIVE_MAX });
  const list = $("cabinetList");
  if (!archive.length) {
    list.replaceChildren(Object.assign(document.createElement("li"), { className: "cabinet-empty", textContent: t("cabinet.empty") }));
    return;
  }
  list.replaceChildren(...archive.map(entry => {
    const li = document.createElement("li");
    li.className = `cabinet-item${entry.id === report.id ? " current" : ""}`;
    li.dataset.id = entry.id;
    li.innerHTML = `<span class="folder">${icon("folder")}</span><div class="info"><strong></strong><small></small></div>
      <div class="actions"><button class="secondary small" type="button" data-act="view"></button><button class="danger small" type="button" data-act="delete"></button></div>`;
    li.querySelector("strong").textContent = entry.title;
    if (entry.id === report.id) li.querySelector("strong").append(Object.assign(document.createElement("span"), { className: "tag", textContent: `· ${t("cabinet.current")}` }));
    li.querySelector("small").textContent = `${fmtDateTime(new Date(entry.savedAt))}${entry.meta ? ` · ${entry.meta}` : ""}`;
    li.querySelector("small").title = entry.meta || "";
    const viewBtn = li.querySelector('[data-act="view"]');
    setLabel(viewBtn, "eye", t("cabinet.view"));
    viewBtn.addEventListener("click", () => {
      showReport(entry.text, entry.meta || t("report.fromArchive", { time: fmtDateTime(new Date(entry.savedAt)) }), { id: entry.id });
      closeCabinet();
      setExpanded(true);
    });
    const del = li.querySelector('[data-act="delete"]');
    setLabel(del, "trash", t("cabinet.delete"));
    del.addEventListener("click", () => armOnce(del, t("cabinet.confirm"), () => {
      li.classList.add("leaving");
      setTimeout(() => deleteReport(entry.id), 320);
    }));
    return li;
  }));
}
function openCabinet() {
  if (!$("pledge").hidden || editor.open) return;
  renderCabinet();
  $("cabinet").hidden = false;
  $("cabinetClose").focus();
}
function closeCabinet() { $("cabinet").hidden = true; }
$("openCabinet").addEventListener("click", openCabinet);
$("cabinetClose").addEventListener("click", closeCabinet);
$("cabinet").addEventListener("click", event => { if (event.target === $("cabinet")) closeCabinet(); });

const CLICKABLE = new Set(["cabinet", "printer", "whiteboard"]);

// ---- Máy in: chọn hồ sơ đã lưu, Giám đốc ra máy in, rồi mở hộp thoại in của trình duyệt ----
const printSel = new Set();
let printing = false;

function renderPrinter() {
  for (const id of [...printSel]) if (!archived(id)) printSel.delete(id);
  $("printerCount").textContent = t("printer.count", { n: archive.length, k: printSel.size });
  const go = $("printerGo"), all = $("printerAll");
  go.disabled = !printSel.size || printing;
  setLabel(go, "f-printer", printSel.size ? t("printer.go", { k: printSel.size }) : t("printer.pick"));
  all.hidden = !archive.length;
  const full = archive.length && printSel.size === archive.length;
  setLabel(all, full ? "close" : "check", full ? t("printer.none") : t("printer.all"));
  const list = $("printerList");
  if (!archive.length) {
    list.replaceChildren(Object.assign(document.createElement("li"), { className: "cabinet-empty", textContent: t("printer.empty") }));
    return;
  }
  list.replaceChildren(...archive.map(entry => {
    const li = document.createElement("li");
    const on = printSel.has(entry.id);
    li.className = `cabinet-item print-item${on ? " selected" : ""}`;
    li.innerHTML = `<input type="checkbox"><span class="folder">${icon("report")}</span><div class="info"><strong></strong><small></small></div>`;
    const box = li.querySelector("input");
    box.checked = on;
    box.setAttribute("aria-label", entry.title);
    li.querySelector("strong").textContent = entry.title;
    li.querySelector("small").textContent = `${fmtDateTime(new Date(entry.savedAt))}${entry.meta ? ` · ${entry.meta}` : ""}`;
    li.querySelector("small").title = entry.meta || "";
    const toggle = () => { if (printSel.has(entry.id)) printSel.delete(entry.id); else printSel.add(entry.id); renderPrinter(); };
    box.addEventListener("click", event => { event.stopPropagation(); toggle(); });
    li.addEventListener("click", toggle);
    return li;
  }));
}
function openPrinter() {
  if (!$("pledge").hidden || editor.open) return;
  closeCabinet();
  renderPrinter();
  $("printer").hidden = false;
  $("printerClose").focus();
}
function closePrinter() { $("printer").hidden = true; }
$("printerClose").addEventListener("click", closePrinter);
$("printer").addEventListener("click", event => { if (event.target === $("printer")) closePrinter(); });
$("printerAll").addEventListener("click", () => {
  if (printSel.size === archive.length) printSel.clear(); else archive.forEach(e => printSel.add(e.id));
  renderPrinter();
});
$("printerGo").addEventListener("click", () => {
  const entries = archive.filter(e => printSel.has(e.id));
  if (!entries.length) return;
  if (printing) { toast(t("printer.busy"), 2500, "alert"); return; }
  printing = true;
  closePrinter();
  toast(t("printer.toast", { k: entries.length, name: choreName() }), 3000, "f-printer");
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    printing = false;
    entries.forEach(e => log(t("log.printed", { title: e.title }), "job"));
    setTimeout(() => printDocument(entries), 0); // ra khỏi vòng cập nhật trước khi mở hộp thoại in (chặn luồng)
  };
  if (!managerFree() || !printReportScene(entries.length, go)) go();
  setTimeout(go, 15000); // phòng khi Giám đốc bị kẹt đường
});

// ---- Bảng phân công: nhiệm vụ hiện tại + việc Giám đốc giao cho từng người (bấm vào bảng trắng) ----
const BOARD_KEY = "ai-office-board-v2";
let board = store.get(BOARD_KEY, null);
if (!board || typeof board !== "object" || !board.tasks || !Array.isArray(board.order)) board = null;
else if (board.state === "planning" || board.state === "running") boardStopped(); // tải lại trang giữa chừng
let boardTimer = 0;

// Dừng giữa chừng: đồng hồ dừng ở lần cập nhật cuối cùng.
function boardStopped() {
  board.state = "stopped";
  board.endedAt = board.endedAt || board.lastAt || board.startedAt;
}
function boardChanged() {
  if (board) {
    if (board.state === "planning" || board.state === "running") board.lastAt = Date.now();
    store.set(BOARD_KEY, board);
  }
  if (!$("board").hidden) renderBoard();
}
function boardStart(msg) {
  const demo = isDemoRunning();
  const job = net.pendingJob || { kind: msg.kind || "course", members: [], directorId: DIRECTOR_ID, lesson: null };
  // Giám đốc đứng lớp: một dòng cho Giám đốc (giảng + duyệt) ở đầu bảng.
  const directorTeaches = job.kind === "lesson" && job.lesson?.teacher === job.directorId;
  const order = directorTeaches ? [job.directorId, ...job.members.map(m => m.id)] : [...job.members.map(m => m.id), job.directorId];
  board = {
    prompt: net.lastPrompt || String(msg.prompt || ""),
    client: client ? clientName(client.name) : "",
    models: demo ? null : (net.pendingModels || null),
    kind: job.kind, lesson: job.lesson, order,
    people: Object.fromEntries([...job.members, { id: job.directorId, role: "director" }].map(m => [m.id, { role: m.role, name: nameOf(m.id) }])),
    demo, startedAt: Date.now(), endedAt: 0, state: "planning", error: "",
    tasks: Object.fromEntries(order.map(id => [id, { state: "waiting", startedAt: 0, endedAt: 0, note: "", error: "" }])),
  };
  boardChanged();
}
function boardStatus(id, status, message) {
  const task = board?.tasks[id];
  if (!task || board.state === "finished" || board.state === "failed") return;
  const work = status === "working" || status === "reviewing";
  if (work && task.state !== "active") {
    Object.assign(task, { state: "active", startedAt: task.startedAt || Date.now(), error: "" });
    board.state = "running";
  } else if (status === "done") {
    Object.assign(task, { state: "done", endedAt: Date.now() });
  } else if (status === "error") {
    Object.assign(task, { state: "error", endedAt: Date.now(), error: message || "" });
  } else return;
  boardChanged();
}
function boardEnd(state, error = "") {
  if (!board) return;
  board.state = state;
  board.endedAt = Date.now();
  board.error = error || "";
  for (const task of Object.values(board.tasks)) {
    if (state === "finished" && task.state !== "error") Object.assign(task, { state: "done", endedAt: task.endedAt || Date.now() });
    else if (state !== "finished" && task.state === "active") Object.assign(task, { state: "error", endedAt: Date.now() });
  }
  boardChanged();
}

const fmtDur = ms => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const BADGE_ICON = { waiting: "clock", active: "spinner", done: "check", error: "alert" };

function renderBoard() {
  const body = $("boardBody");
  const live = !!board && (board.state === "planning" || board.state === "running");
  $("boardActions").hidden = !board || live;
  if (board && !live) setLabel($("boardClear"), "check", t("board.clear"));
  if (!board) {
    body.innerHTML = `<p class="board-empty">${escHtml(t("board.empty"))}</p>`;
    return;
  }
  const elapsed = (board.endedAt || Date.now()) - board.startedAt;
  const facts = [
    `<span>${icon("report")}${escHtml(t("board.kind", { x: kindName(board.kind) }))}</span>`,
    board.lesson && `<span>${icon("team")}${escHtml(t("board.lesson", { room: t(`room.${board.lesson.room}`), n: board.lesson.students }))}</span>`,
    board.client && `<span>${icon("user")}${escHtml(board.client)}</span>`,
    `<span>${icon("clock")}${escHtml(t("board.started", { time: fmtDateTime(new Date(board.startedAt)) }))}</span>`,
    `<span>${escHtml(t("board.elapsed", { t: fmtDur(elapsed) }))}</span>`,
    board.demo ? `<span>${icon("play")}${escHtml(t("board.demo"))}</span>`
      : board.models ? `<span>${icon("monitor")}${escHtml(board.models.join(" + "))}</span>` : "",
    `<span class="board-chip ${board.state}">${escHtml(t(`board.state.${board.state}`))}</span>`,
  ].filter(Boolean).join("");
  const who = id => board.people[id] || { role: recOf(id)?.role || "ta", name: nameOf(id) };
  const tasks = board.order.map((id, i) => {
    const task = board.tasks[id];
    const p = who(id);
    const prev = board.order.slice(0, i).map(x => who(x).name).join(", ");
    const part = board.kind === "lesson" ? (board.lesson?.teacher === id ? "teacher" : p.role === "director" ? null : "assistant") : null;
    const meta = [
      `<span>${icon("report")}${escHtml(p.role === "director" ? t("board.deliver", { x: kindDoc(board.kind) }) : roleTitle(p.role))}</span>`,
      part && `<span>${icon("team")}${escHtml(t(part === "teacher" ? "board.teacherTag" : "board.assistantTag"))}</span>`,
      prev && `<span>${icon("arrow")}${escHtml(t("board.inputs", { x: prev }))}</span>`,
    ].filter(Boolean).join("");
    const when = [
      task.state === "active" && task.startedAt && t("board.since", { time: fmtTime(new Date(task.startedAt)) }),
      task.endedAt && task.startedAt && t("board.took", { t: fmtDur(task.endedAt - task.startedAt) }),
    ].filter(Boolean).join(" · ");
    return `<li class="board-task ${task.state}" style="--role:${ROLE_COLOR[p.role] || "#8eb1fc"}">
      <div class="num">${i + 1}</div>
      <div class="main">
        <div class="row"><strong>${escHtml(p.name)}</strong>
          <span class="board-badge">${icon(BADGE_ICON[task.state])}${escHtml(t(`board.st.${task.state}`))}</span></div>
        <p class="desc">${escHtml(p.role === "director" && part === "teacher"
          ? `${taskText(board.kind, "teacher", "teacher")} ${taskText(board.kind, "director")}`
          : taskText(board.kind, p.role, part))}</p>
        <div class="meta">${meta}</div>
        ${when ? `<div class="meta" style="margin-top:4px"><span>${icon("clock")}${escHtml(when)}</span></div>` : ""}
        ${task.error ? `<p class="note err">${escHtml(task.error)}</p>` : task.note ? `<p class="note">“${escHtml(task.note)}”</p>` : ""}
      </div>
    </li>`;
  }).join("");
  body.innerHTML = `
    <div class="board-mission">
      <div class="board-label">${escHtml(t("board.request"))}</div>
      <p class="board-prompt">${escHtml(board.prompt)}</p>
      <div class="board-facts">${facts}</div>
      ${board.error ? `<p class="note err" style="color:#ef8a7f;margin:8px 0 0;font-size:12px">${escHtml(board.error)}</p>` : ""}
    </div>
    <div>
      <div class="board-label">${escHtml(t("board.plan"))}</div>
      <ol class="board-tasks">${tasks}</ol>
    </div>
    <p class="board-foot">${escHtml(t("board.foot"))}</p>`;
  clearInterval(boardTimer);
  if (live) boardTimer = setInterval(() => { if ($("board").hidden) clearInterval(boardTimer); else renderBoard(); }, 1000);
}
function openBoard() {
  if (!$("pledge").hidden || editor.open) return;
  closeCabinet();
  closePrinter();
  const scroll = $("boardBody").scrollTop;
  renderBoard();
  $("board").hidden = false;
  $("boardBody").scrollTop = scroll;
  $("boardClose").focus();
}
function closeBoard() { $("board").hidden = true; clearInterval(boardTimer); }
// Hoàn tất: xoá dữ liệu bảng, Giám đốc ra xoá bảng trắng.
function clearBoard() {
  if (!board) return;
  if (board.state === "planning" || board.state === "running" || net.busy || isDemoRunning()) { toast(t("board.clearBusy"), 3000, "alert"); return; }
  board = null;
  try { localStorage.removeItem(BOARD_KEY); } catch { /* bỏ qua */ }
  closeBoard();
  toast(t("board.cleared"), 2500, "check");
  log(t("log.boardCleared", { name: choreName() }), "job");
  if (managerFree()) eraseBoardScene(); else runtime.boardInk = 0;
}
$("boardClear").addEventListener("click", clearBoard);
$("boardClose").addEventListener("click", closeBoard);
$("board").addEventListener("click", event => { if (event.target === $("board")) closeBoard(); });

const escHtml = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const PRINT_CSS = `
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #181f2f; font: 10.5pt/1.55 "Be Vietnam Pro", "Segoe UI", "Yu Gothic UI", "Meiryo", Arial, sans-serif; }
  .doc { break-after: page; }
  .doc:last-child { break-after: auto; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2.5px solid #123d9a; padding-bottom: 6px; }
  .brand { font-weight: 800; letter-spacing: .14em; color: #123d9a; font-size: 13pt; }
  .brand small { display: block; letter-spacing: .02em; font-weight: 500; color: #555e71; font-size: 8.5pt; }
  .kind { font-size: 9pt; color: #555e71; text-transform: uppercase; letter-spacing: .08em; }
  h1.title { font-size: 17pt; margin: 14px 0 8px; line-height: 1.3; }
  table.info { border-collapse: collapse; margin: 0 0 14px; font-size: 9pt; color: #373e4f; }
  table.info td { padding: 2px 14px 2px 0; border: 0; }
  table.info td:first-child { color: #656e80; }
  .body h1 { font-size: 14pt; } .body h2 { font-size: 12.5pt; } .body h3 { font-size: 11pt; }
  .body h1, .body h2, .body h3 { color: #0d2f77; margin: 14px 0 6px; break-after: avoid; }
  .body p, .body li { orphans: 3; widows: 3; }
  .body table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 9pt; break-inside: avoid; }
  .body th, .body td { border: 1px solid #b4bbcc; padding: 4px 6px; text-align: left; vertical-align: top; }
  .body th { background: #e4e9f5; }
  .body code { font-family: Consolas, monospace; font-size: 9pt; background: #f0f3f1; padding: 0 3px; }
  .body blockquote { margin: 8px 0; padding: 4px 12px; border-left: 3px solid #8ea3d2; color: #373e4f; }
  footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid #c4cbd9; font-size: 8pt; color: #656e80; }
`;

function printDocument(entries) {
  const now = fmtDateTime();
  const who = client ? clientName(client.name) : "";
  const pages = entries.map(e => {
    const rows = [
      who && [t("print.client"), who],
      [t("print.saved"), fmtDateTime(new Date(e.savedAt))],
      [t("print.printed"), now],
      e.meta && [t("print.info"), e.meta],
    ].filter(Boolean).map(([k, v]) => `<tr><td>${escHtml(k)}</td><td>${escHtml(v)}</td></tr>`).join("");
    return `<article class="doc">
      <header><div class="brand">GKI<small>${escHtml(t("brand.tagline"))}</small></div><div class="kind">${escHtml(t("print.kind"))}</div></header>
      <h1 class="title">${escHtml(e.title)}</h1>
      <table class="info">${rows}</table>
      <div class="body">${renderMarkdown(e.text)}</div>
      <footer>${escHtml(t("print.footer"))}</footer>
    </article>`;
  }).join("");
  const title = entries.length === 1 ? `GKI - ${entries[0].title}` : `GKI - ${t("print.kind")} (${entries.length})`;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
  frame.srcdoc = `<!doctype html><html lang="${getLang()}"><head><meta charset="utf-8"><title>${escHtml(title)}</title><style>${PRINT_CSS}</style></head><body>${pages}</body></html>`;
  frame.addEventListener("load", () => {
    const w = frame.contentWindow;
    const cleanup = () => setTimeout(() => frame.remove(), 500);
    w.addEventListener("afterprint", cleanup, { once: true });
    w.focus();
    w.print();
    setTimeout(() => frame.isConnected && frame.remove(), 60000);
  }, { once: true });
  document.body.append(frame);
}

function renderClient() {
  $("clientBadge").hidden = !client;
  if (client) setLabel($("clientBadge"), "user", t("client.badge", { name: client.name }));
  $("clientInfo").textContent = client
    ? t("client.info", { name: client.name, date: fmtDate(new Date(client.signedAt)), no: client.docNo })
    : t("client.unsigned");
  $("viewPledge").disabled = !client;
  refreshControls();
}

// ===========================================================================
// Kết nối backend
// ===========================================================================
// Chọn máy chủ AI:
//  - ?api=https://... trên URL  -> dùng máy chủ đó (khi sau này backend được triển khai lên mạng)
//  - trang do chính backend phục vụ (cổng 8000) -> cùng nguồn
//  - GitHub Pages / mở file trực tiếp -> KHÔNG có backend: chạy chế độ xem thử (mô phỏng)
//  - trường hợp khác (vd. Live Server) -> backend ở localhost:8000
const API_PARAM = new URLSearchParams(location.search).get("api");
const STATIC_HOST = location.protocol === "file:" || /\.github\.io$/i.test(location.hostname);
const SAME_ORIGIN = location.protocol.startsWith("http") && (location.port === "8000" || !location.port) && !STATIC_HOST;
const API_BASE = API_PARAM ? API_PARAM.replace(/\/+$/, "")
  : SAME_ORIGIN ? ""
    : STATIC_HOST ? null
      : "http://localhost:8000";
const OFFLINE = API_BASE === null;
const WS_URL = OFFLINE ? null
  : API_BASE ? API_BASE.replace(/^http/, "ws") + "/ws"
    : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

const net = { models: null, socket: null, connected: false, busy: false, retry: 1000, modelsLoaded: false, submitting: false, jobStartedAt: 0, lastPrompt: "" };

function idleStatus() {
  if (OFFLINE) setStatus(t("status.offline"), "busy");
  else if (net.connected) setStatus(client ? t("status.ready", { client: clientName(client.name) }) : t("status.connected"), "ok");
}

function setStatus(text, tone = "") {
  $("statusMessage").textContent = text;
  $("statusTag").dataset.tone = tone;
}

function refreshControls() {
  const btn = $("missionButton");
  const busy = net.busy || isDemoRunning() || lessonState().active;
  const live = !OFFLINE && net.connected && net.modelsLoaded;
  btn.disabled = !client || busy || net.submitting;
  setLabel(btn, busy || net.submitting ? "spinner" : "send", busy ? t("task.busy") : net.submitting ? t("task.sending") : live ? t("task.send") : t("task.sendDemo"));
  btn.title = !client ? t("task.needPledge") : "";
  $("connDot").dataset.on = String(net.connected);
  $("connText").textContent = OFFLINE ? t("conn.preview") : net.connected ? t("conn.on") : t("conn.off");
  $("runDemo").disabled = busy;
  renderTaskTab();
}

function setBusy(busy) {
  net.busy = busy;
  refreshControls();
}

function modelLabel(selectId) {
  const s = $(selectId);
  return s.selectedOptions[0]?.text || s.value;
}

function handleMessage(msg) {
  switch (msg.type) {
    case "snapshot":
      setBusy(msg.busy);
      for (const [id, st] of Object.entries(msg.agents || {})) applyStatus(id, st.status, st.message, { animate: false });
      if (board && board.state !== "finished" && board.state !== "failed") {
        if (!msg.busy) boardStopped();
        else if (board.state === "stopped") Object.assign(board, { state: "running", endedAt: 0 });
        boardChanged();
      }
      if (msg.result && !$("reportBody").dataset.raw) showReport(msg.result, t("report.fromServer"));
      if (msg.busy) setStatus(t("status.busy"), "busy"); else idleStatus();
      renderTeam();
      break;
    case "status":
      applyStatus(msg.agent, msg.status, msg.message);
      boardStatus(msg.agent, msg.status, msg.message);
      renderTeam();
      if (msg.status !== "idle") log(`${nameOf(msg.agent)}: ${msg.message}`, msg.status === "error" ? "error" : "");
      break;
    case "activity":
      applyActivity(msg.agent, msg.kind, msg.message);
      break;
    case "handoff":
      applyHandoff(msg.from, msg.to);
      if (board?.tasks[msg.from] && msg.message) { board.tasks[msg.from].note = msg.message; boardChanged(); }
      log(t("log.handoff", { from: nameOf(msg.from), to: nameOf(msg.to), msg: msg.message ? ` “${msg.message}”` : "" }), "handoff");
      break;
    case "job":
      if (msg.state === "started") {
        setBusy(true);
        net.jobStartedAt = Date.now();
        setStatus(t("status.accepted", { prompt: msg.prompt }), "busy");
        boardStart(msg);
        log(t("log.newJob", { prompt: msg.prompt }), "job");
        beginJobScene();
      } else if (msg.state === "finished") {
        setBusy(false);
        finishJobScene();
        const secs = Math.round((Date.now() - net.jobStartedAt) / 1000);
        const meta = t("report.meta", {
          client: client ? clientName(client.name) : "—",
          time: fmtDateTime(),
          models: `${kindDoc(board?.kind || net.pendingJob?.kind || "course")} · ${msg.demo ? t("report.demoTag") : `${modelLabel("leaderSelect")} + ${modelLabel("workerSelect")}`}`,
          secs,
        });
        showReport(msg.result || "", meta, { persist: true });
        boardEnd("finished");
        setStatus(t("status.done"), "ok");
        log(t("log.approved"), "job");
        if (!staff.manager?.lesson) runScript("manager", [
          { say: client ? t("greet.reportReady", { client: clientName(client.name) }) : t("greet.reportReadyAnon"), face: "S", gesture: "wave", seconds: 3.5 },
          { home: true },
        ]);
      } else if (msg.state === "failed") {
        setBusy(false);
        finishJobScene();
        showReport(t("report.failed", { error: msg.error }), null, { error: true });
        boardEnd("failed", msg.error);
        setStatus(t("status.error", { error: msg.error }), "error");
        log(t("log.failed", { error: msg.error }), "error");
      }
      break;
  }
}

function connect() {
  const socket = new WebSocket(WS_URL);
  net.socket = socket;
  socket.onopen = () => {
    net.connected = true;
    net.retry = 1000;
    refreshControls();
    if (!net.modelsLoaded) loadModels();
  };
  socket.onmessage = event => {
    try { handleMessage(JSON.parse(event.data)); } catch (error) { console.error("Invalid message", error); }
  };
  socket.onclose = () => {
    net.connected = false;
    refreshControls();
    setStatus(t("status.disconnected", { s: Math.round(net.retry / 1000) }), "error");
    setTimeout(connect, net.retry);
    net.retry = Math.min(net.retry * 2, 10000);
  };
}

const MODEL_KEY = "ai-office-models";
async function loadModels() {
  try {
    const res = await fetch(`${API_BASE}/api/models`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    let saved = store.get(MODEL_KEY, {});
    const defaultsKey = `${data.defaults.leader}|${data.defaults.team}`;
    if (saved.defaults !== defaultsKey) { saved = { defaults: defaultsKey }; store.set(MODEL_KEY, saved); }
    net.models = data.models;
    renderModels();
    for (const [selectId, role] of [["leaderSelect", "leader"], ["workerSelect", "team"]]) {
      const select = $(selectId);
      const want = [saved[role], data.defaults[role]].find(id => data.models.some(m => m.id === id && m.available));
      if (want) select.value = want;
      else { const first = data.models.find(m => m.available); if (first) select.value = first.id; }
    }
    net.modelsLoaded = data.models.some(m => m.available);
    if (!net.modelsLoaded) setStatus(t("status.noKeys"), "error");
  } catch (error) {
    net.modelsLoaded = false;
    setStatus(t("status.modelsFail", { error: error.message }), "error");
  }
  refreshControls();
}
// Vẽ lại danh sách model (giữ lựa chọn hiện tại) – gọi cả khi đổi ngôn ngữ.
function renderModels() {
  if (!net.models) return;
  for (const selectId of ["leaderSelect", "workerSelect"]) {
    const select = $(selectId);
    const current = select.value;
    select.replaceChildren(...net.models.map(m => {
      const opt = new Option(m.available ? m.label : `${m.label} ${t("models.noKey")}`, m.id);
      opt.disabled = !m.available;
      return opt;
    }));
    if (net.models.some(m => m.id === current && m.available)) select.value = current;
  }
}
for (const [selectId, role] of [["leaderSelect", "leader"], ["workerSelect", "team"]]) {
  $(selectId).addEventListener("change", () => store.set(MODEL_KEY, { ...store.get(MODEL_KEY, {}), [role]: $(selectId).value }));
}

// ---------------------------------------------------------------------------
// Form giao việc: loại nhiệm vụ + thành viên (thiết kế khoá học / lộ trình) hoặc giảng viên, phòng, trợ lý, sĩ số (buổi dạy).
// ---------------------------------------------------------------------------
const TASK_KEY = "ai-office-task-form";
const taskForm = Object.assign({ kind: "course", members: null, teacher: "", assistants: ["", ""], room: "classBig", students: 12 }, store.get(TASK_KEY, {}));
// Bản cũ chỉ có một trợ lý (taskForm.assistant) -> chuyển sang danh sách tối đa 2 trợ giảng.
if (!Array.isArray(taskForm.assistants)) taskForm.assistants = [taskForm.assistant || "", ""];
taskForm.assistants = [0, 1].map(i => taskForm.assistants[i] || "");
delete taskForm.assistant;
const chosenAssistants = () => taskForm.assistants.filter(Boolean);
if (!KIND_KEYS.includes(taskForm.kind)) taskForm.kind = "course";
const saveTaskForm = () => store.set(TASK_KEY, taskForm);
const staffOnly = () => team.filter(r => r.id !== DIRECTOR_ID);
// Mặc định: mỗi vai trò một người (đỡ tốn lượt gọi AI).
function defaultMembers() {
  const seen = new Set();
  return staffOnly().filter(r => !seen.has(r.role) && seen.add(r.role)).map(r => r.id);
}
const chosenMembers = () => {
  const ids = (taskForm.members || defaultMembers()).filter(id => recOf(id) && id !== DIRECTOR_ID);
  return staffOnly().map(r => r.id).filter(id => ids.includes(id));
};

// Các phòng có bàn học (mọi tầng): { id, floor, seats (bàn học), work (bàn laptop / bàn làm việc cho trợ giảng) }.
function classroomList() {
  const out = [];
  for (const f of FLOOR_IDS) {
    const items = f === FLOOR ? layout : layouts[f];
    for (const room of floorRooms(f)) {
      const inRoom = items.filter(it => roomAtOn(f, it.x, it.y) === room.id);
      const seats = inRoom.filter(it => CATALOG[it.type]?.student).length;
      if (seats) out.push({ id: room.id, floor: f, seats, work: inRoom.filter(isWorkDesk).length });
    }
  }
  return out;
}

function renderTaskForm() {
  const kinds = $("taskKinds");
  kinds.replaceChildren(...KIND_KEYS.map(k => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `kind-btn${taskForm.kind === k ? " on" : ""}`;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(taskForm.kind === k));
    b.textContent = kindName(k);
    b.addEventListener("click", () => { taskForm.kind = k; saveTaskForm(); renderTaskForm(); });
    return b;
  }));
  $("taskInput").placeholder = kindPlaceholder(taskForm.kind);
  const lessonMode = taskForm.kind === "lesson";
  $("taskMembers").hidden = lessonMode;
  $("taskLesson").hidden = !lessonMode;

  const chosen = new Set(chosenMembers());
  $("taskMemberList").replaceChildren(...staffOnly().map(r => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `member-chip${chosen.has(r.id) ? " on" : ""}`;
    b.setAttribute("aria-pressed", String(chosen.has(r.id)));
    b.innerHTML = `<span class="team-dot"></span><span></span>`;
    b.querySelector(".team-dot").style.background = roleColor(r.id);
    b.querySelector("span:last-child").textContent = nameOf(r.id);
    b.title = roleTitle(r.role);
    b.addEventListener("click", () => {
      const set = new Set(chosenMembers());
      if (set.has(r.id)) set.delete(r.id); else set.add(r.id);
      taskForm.members = [...set];
      saveTaskForm();
      renderTaskForm();
    });
    return b;
  }));

  // Buổi dạy
  // Giám đốc kiêm giảng viên: luôn có thể đứng lớp.
  const teacherPool = [...team.filter(r => r.id === DIRECTOR_ID), ...staffOnly().filter(r => r.role === "teacher" || r.role === "sensei")];
  if (!teacherPool.some(r => r.id === taskForm.teacher)) taskForm.teacher = (teacherPool.find(r => r.role === "teacher" || r.role === "sensei") || teacherPool[0])?.id || "";
  const tSel = $("lessonTeacher");
  tSel.replaceChildren(...teacherPool.map(r => new Option(`${nameOf(r.id)} · ${roleTitle(r.role)}`, r.id)));
  tSel.value = taskForm.teacher;
  // Tối đa 2 trợ giảng ngồi cuối lớp (không trùng nhau, không trùng giảng viên).
  const others = team.filter(r => r.id !== taskForm.teacher && r.id !== DIRECTOR_ID);
  taskForm.assistants = taskForm.assistants.map(id => (others.some(r => r.id === id) ? id : ""));
  if (taskForm.assistants[1] && taskForm.assistants[1] === taskForm.assistants[0]) taskForm.assistants[1] = "";
  ["lessonAssistant", "lessonAssistant2"].forEach((elId, i) => {
    const sel = $(elId);
    const other = taskForm.assistants[1 - i];
    sel.replaceChildren(new Option(t("task.noAssistant"), ""),
      ...others.filter(r => r.id !== other).map(r => new Option(`${nameOf(r.id)} · ${roleTitle(r.role)}`, r.id)));
    sel.value = taskForm.assistants[i];
  });
  // Phòng học = mọi phòng (ở bất kỳ tầng nào) có kê bàn học.
  const rooms = classroomList();
  if (!rooms.some(r => r.id === taskForm.room)) taskForm.room = rooms[0]?.id || "classBig";
  const rSel = $("lessonRoom");
  rSel.replaceChildren(...(rooms.length ? rooms : [{ id: "classBig", floor: 9, seats: 0, work: 0 }])
    .map(r => new Option(`${t("floor.name", { n: r.floor })} · ${t(`room.${r.id}`)} (${t("task.seats", { n: r.seats })})`, r.id)));
  rSel.value = taskForm.room;
  // Trợ giảng ưu tiên ngồi bàn laptop / bàn làm việc trong phòng học; chỉ khi thiếu mới chiếm bàn học viên.
  const cur = rooms.find(r => r.id === taskForm.room) || { seats: 0, work: 0 };
  const maxSeats = Math.max(0, cur.seats - Math.max(0, chosenAssistants().length - cur.work));
  const n = $("lessonStudents");
  n.max = String(maxSeats);
  taskForm.students = Math.max(0, Math.min(maxSeats, Number(taskForm.students) || 0));
  n.value = String(taskForm.students);
  $("lessonMax").textContent = `/ ${maxSeats}`;
}
$("lessonTeacher").addEventListener("change", e => { taskForm.teacher = e.target.value; saveTaskForm(); renderTaskForm(); });
$("lessonAssistant").addEventListener("change", e => { taskForm.assistants[0] = e.target.value; saveTaskForm(); renderTaskForm(); });
$("lessonAssistant2").addEventListener("change", e => { taskForm.assistants[1] = e.target.value; saveTaskForm(); renderTaskForm(); });
$("lessonRoom").addEventListener("change", e => { taskForm.room = e.target.value; taskForm.students = 99; saveTaskForm(); renderTaskForm(); });
$("lessonStudents").addEventListener("change", e => { taskForm.students = Number(e.target.value) || 0; saveTaskForm(); renderTaskForm(); });

// Mô tả nhiệm vụ gửi backend / mô phỏng.
function buildJob() {
  const kind = taskForm.kind;
  if (kind === "lesson") {
    if (!recOf(taskForm.teacher)) return { error: t("task.needTeacher") };
    const ids = [...(taskForm.teacher !== DIRECTOR_ID ? [taskForm.teacher] : []), ...chosenAssistants()];
    return {
      kind, directorId: DIRECTOR_ID,
      members: ids.map(id => ({ id, role: recOf(id).role })),
      lesson: { teacher: taskForm.teacher, assistants: chosenAssistants(), room: taskForm.room, students: taskForm.students },
    };
  }
  const ids = chosenMembers();
  if (!ids.length) return { error: t("task.needMember") };
  return { kind, directorId: DIRECTOR_ID, members: ids.map(id => ({ id, role: recOf(id).role })), lesson: null };
}

// Khi nhiệm vụ bắt đầu: người tham gia sang bàn làm việc; buổi dạy thì mở lớp.
let lessonEndTimer = 0;
function beginJobScene() {
  const job = net.pendingJob;
  if (!job) return;
  setInJob([job.directorId, ...job.members.map(m => m.id)], true);
  if (job.kind === "lesson" && job.lesson) {
    switchFloor(roomFloorOf(job.lesson.room)); // tới tầng có phòng học đó
    clearTimeout(lessonEndTimer);
    const r = startLesson({ teacher: job.lesson.teacher, assistants: job.lesson.assistants || [], room: job.lesson.room, count: job.lesson.students });
    if (r.ok) {
      net.lessonStartedAt = Date.now();
      log(t("log.lessonStart", { teacher: nameOf(job.lesson.teacher), room: t(`room.${job.lesson.room}`), n: r.seats }), "job");
    } else toast(t("task.lessonFail"), 4500, "alert");
  }
}
// Kết thúc: về bàn mặc định; lớp học kéo dài tối thiểu 40 giây cho trọn cảnh.
function finishJobScene() {
  setInJob([], false);
  if (!lessonState().active) return;
  const wait = Math.max(0, 40000 - (Date.now() - (net.lessonStartedAt || 0)));
  clearTimeout(lessonEndTimer);
  lessonEndTimer = setTimeout(() => { endLesson(); log(t("log.lessonEnd"), "job"); refreshControls(); }, wait);
}

async function startMission() {
  let prompt = $("taskInput").value.trim();
  if (!client) { setStatus(t("status.needPledge"), "error"); toast(t("status.needPledge"), 3500, "alert"); return; }
  // Buổi dạy: không nhập chủ đề thì giảng viên tự chọn chủ đề phù hợp.
  if (!prompt && taskForm.kind === "lesson") prompt = t("task.defaultLesson");
  if (!prompt) { setStatus(t("status.emptyPrompt"), "error"); toast(t("status.emptyPrompt"), 3500, "alert"); $("taskInput").focus(); return; }
  if (net.busy || net.submitting || isDemoRunning() || lessonState().active) return;
  const job = buildJob();
  if (job.error) { setStatus(job.error, "error"); toast(job.error, 3500, "alert"); return; }
  net.pendingJob = job;
  // Không có máy chủ AI (bản xem thử, hoặc backend chưa chạy / chưa có API key): vẫn cho chạy bằng mô phỏng.
  const simulate = OFFLINE || !net.connected || !net.modelsLoaded;
  if (simulate) {
    toast(t(OFFLINE ? "toast.demoOffline" : "toast.demoNoServer"), 4500, "play");
    net.lastPrompt = prompt;
    runDemo(handleMessage, client.name, prompt, job).finally(refreshControls);
    refreshControls();
    return;
  }
  net.submitting = true;
  refreshControls();
  // Ghi nhớ trước khi gửi: sự kiện "job started" có thể tới qua WebSocket trước cả khi fetch trả về.
  net.lastPrompt = prompt;
  net.pendingModels = [modelLabel("leaderSelect"), modelLabel("workerSelect")];
  const member = id => ({ id, name: nameOf(id).slice(0, 40), role: recOf(id).role, gender: recOf(id).look.gender === "female" ? "female" : "male" });
  try {
    const res = await fetch(`${API_BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt, language: getLang(), client_name: client.name,
        manager_choice: $("leaderSelect").value, worker_choice: $("workerSelect").value,
        kind: job.kind, director: member(job.directorId), team: job.members.map(m => member(m.id)),
        lesson: job.lesson ? { ...job.lesson, room: t(`room.${job.lesson.room}`) } : null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = typeof body.detail === "string" ? body.detail
        : Array.isArray(body.detail) ? body.detail.map(d => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ").slice(0, 300) || `HTTP ${res.status}`
          : `HTTP ${res.status}`;
      toast(t("status.rejected", { detail }), 6000, "alert");
      setStatus(t("status.rejected", { detail }), "error");
      log(t("status.rejected", { detail }), "error");
    }
  } catch (error) {
    setStatus(t("status.sendFail", { error: error.message }), "error");
  } finally {
    net.submitting = false;
    refreshControls();
  }
}

$("missionButton").addEventListener("click", startMission);
$("taskInput").addEventListener("keydown", event => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); startMission(); }
});

$("runDemo").addEventListener("click", () => {
  if (net.busy || isDemoRunning() || lessonState().active) return;
  const job = buildJob();
  if (job.error) { toast(job.error, 3500, "alert"); return; }
  setDrawer(false);
  toast(t("toast.demo"), 3500, "play");
  net.pendingJob = job;
  net.lastPrompt = "";
  runDemo(handleMessage, client?.name || t("client.guest"), null, job).finally(refreshControls);
  refreshControls();
});

// ===========================================================================
// Màn chào + Đơn cam kết
// ===========================================================================
const GREET_SPOT = { x: 340, y: 705 }; // sảnh, ngay lối vào

async function firstVisit({ withIntro = true } = {}) {
  switchFloor(9);
  flags.breaksPaused = true;
  if (withIntro) {
    document.body.classList.add("booting");
    await playIntro();
  }
  document.body.classList.remove("booting");
  layoutView();
  await delay(1200);

  // Giám đốc rời bàn, ra giữa phòng chào khách.
  let readyForPledge;
  const ready = new Promise(r => { readyForPledge = r; });
  let signedDone = false;
  onboarding.greeting = true;
  runScript("manager", [
    { goto: GREET_SPOT, say: t("greet.ohGuest") },
    { call: () => zoomTo("manager") },
    { say: t("greet.hello"), face: "S", gesture: "wave", seconds: 3.6 },
    { say: t("greet.intro"), face: "S" },
    { say: t("greet.pledge"), face: "S", seconds: 2.6 },
    { call: () => readyForPledge() },
    { waitUntil: () => signedDone, face: "S", say: t("greet.readTerms") },
  ]);
  await ready;
  const signed = await openPledge({ mode: "sign" });
  signedDone = true;
  client = signed;
  renderClient();
  log(t("log.signed", { client: clientName(client.name), no: client.docNo }), "job");
  toast(t("toast.signed", { client: clientName(client.name) }), 3500, "check");
  runScript("manager", [
    { say: t("greet.thanks", { client: clientName(client.name) }), face: "S", gesture: "wave" },
    { say: t("greet.giveTask"), face: "S", seconds: 3 },
    { call: () => { zoomOut(); updateZoomUi(); } },
    { home: true },
  ]);
  await delay(4000);
  onboarding.greeting = false;
  flags.breaksPaused = false;
  idleStatus();
  $("taskInput").focus();
}

async function returningVisit() {
  document.body.classList.remove("booting");
  layoutView();
  await delay(900);
  toast(t("toast.welcomeBack", { client: clientName(client.name) }), 3500, "smile");
  runScript("manager", [
    { say: t("greet.welcomeBack", { client: clientName(client.name) }), face: "S", gesture: "wave", seconds: 3.2 },
    { home: true },
  ]);
}

$("viewPledge").addEventListener("click", () => { if (client) { setDrawer(false); openPledge({ mode: "view", client }); } });
$("resignPledge").addEventListener("click", async () => {
  setDrawer(false);
  const signed = await openPledge({ mode: "resign" });
  if (!signed) return;
  client = signed;
  renderClient();
  log(t("log.signed", { client: clientName(client.name), no: client.docNo }), "job");
  toast(t("toast.resigned", { client: clientName(client.name) }), 3500, "check");
  runScript("manager", [{ say: t("greet.resigned", { client: clientName(client.name) }), face: "S", gesture: "wave", seconds: 3 }, { home: true }]);
});
$("replayIntro").addEventListener("click", async () => {
  setDrawer(false);
  if (client) {
    document.body.classList.add("booting");
    await playIntro();
    await returningVisit();
  } else {
    await firstVisit();
  }
});

// ===========================================================================
// Ngôn ngữ
// ===========================================================================
const langSelect = $("langSelect");
langSelect.replaceChildren(...LANGS.map(l => new Option(l.label, l.code)));
langSelect.value = getLang();
langSelect.addEventListener("change", () => setLang(langSelect.value));

window.addEventListener("langchange", () => {
  langSelect.value = getLang();
  applyTeam({ persist: false });
  if (!$("staffModal").hidden) renderStaffEditor();
  renderFloorSwitch();
  renderModels();
  if (OFFLINE) for (const id of ["leaderSelect", "workerSelect"]) $(id).options[0].text = t("models.offline");
  furnToggleLabel();
  renderEditor();
  renderTeam();
  renderClient();
  renderReportActions();
  if (!$("cabinet").hidden) renderCabinet();
  if (!$("printer").hidden) renderPrinter();
  if (!$("board").hidden) renderBoard();
  if (!net.busy && !isDemoRunning()) idleStatus();
});

// ===========================================================================
// Khởi động
// ===========================================================================
applyI18n();
furnToggleLabel();
setStatus(t("status.connecting"));
$("connText").textContent = t("conn.connecting");
commitLayout({ persist: false });
// Cửa tự động: mở khi có nhân viên / học viên tới gần.
setDoorSensor(() => visibleAgents().filter(a => !a.hidden));
flags.workMode = !!store.get("ai-office-workmode", false);
applyTeam({ persist: false });
seatEveryone();
// Bàn có ghế lọt qua / chạm vách (bố cục cũ, trước khi có kiểm tra ghế): kéo lùi bàn ra xa vách,
// không được thì xoay ngược lại – người ngồi không còn bị "dính tường". Làm cho từng tầng.
function fixBlockedChairs() {
  let fixed = 0;
  const start = FLOOR;
  for (const f of FLOOR_IDS) {
    if (f !== FLOOR) { layouts[FLOOR] = layout; setFloor(f); layout = layouts[f]; }
    let changed = false;
    for (const d of layout.filter(isWorkDesk)) {
      if (!chairBlocked(d)) continue;
      const tryAt = (cand) => fitsInRoom(cand, cand) && !overlapsAny(cand, layout, cand);
      let done = false;
      // 1) Lùi theo hướng ngược phía ghế (5..40 đơn vị), rồi xê dịch ngang một chút.
      const [bx, by] = toWorld(rot(d), 0, -1);
      for (let k = 5; k <= 40 && !done; k += 5) {
        for (const side of [0, 5, -5, 10, -10]) {
          const [sx, sy] = toWorld(rot(d), 1, 0);
          const cand = { ...d, x: d.x + bx * k + sx * side, y: d.y + by * k + sy * side };
          if (tryAt(cand)) { Object.assign(d, { x: cand.x, y: cand.y }); done = true; break; }
        }
      }
      // 2) Xoay ngược 180° (ghế sang phía bên này).
      if (!done) {
        const cand = { ...d, rotation: (rot(d) + 2) % 4 };
        if (tryAt(cand)) { d.rotation = cand.rotation; done = true; }
      }
      if (done) { d._cache = null; fixed++; changed = true; }
    }
    if (changed) store.set(FLOOR_LAYOUT_KEYS[f], layout.map(({ _cache, ...rest }) => rest));
  }
  if (FLOOR !== start) { layouts[FLOOR] = layout; setFloor(start); layout = layouts[start]; }
  return fixed;
}
const chairsFixed = fixBlockedChairs();
if (chairsFixed) { commitLayout({ persist: false }); seatEveryone(); setTimeout(() => toast(t("furn.chairsFixed", { n: chairsFixed }), 5000, "check"), 1500); }

// Mở lại tầng đang xem lần trước (khách mới thì ở tầng 9 để Giám đốc ra chào).
if (client) switchFloor(Number(store.get(FLOOR_KEY, 9)) || 9, { remember: false });
renderFloorSwitch();
applyPanels();
renderTeam();
renderClient();
log(t("log.open"), "");
const lastReport = store.get(REPORT_KEY, null);
if (lastReport?.text) showReport(lastReport.text, lastReport.meta, { id: lastReport.id || null, persist: !lastReport.id });
layoutView();
if (OFFLINE) {
  for (const id of ["leaderSelect", "workerSelect"]) {
    $(id).replaceChildren(new Option(t("models.offline"), ""));
    $(id).disabled = true;
  }
  idleStatus();
  refreshControls();
} else {
  connect();
}
requestAnimationFrame(frame);
if (client) returningVisit(); else firstVisit();

// office.simulate({...}) cho phép thử luồng sự kiện mà không cần gọi LLM thật.
// screenOf(x, y, z): toạ độ màn hình của một điểm trong phòng (cho kiểm thử tự động).
window.office = {
  staff, get layout() { return layout; }, get team() { return team; }, ISO, simulate: handleMessage, cancelDemo,
  startLesson, endLesson, lessonState, allAgents, switchFloor, get floor() { return FLOOR; }, setWorkMode, openStaff, buildJob, taskForm, renderTaskForm,
  screenOf(x, y, z = 0) {
    const p = project(x, y, z), s = view.scale * camera.zoom;
    return { x: view.cx + (p.x - camera.focus.x) * s, y: view.cy + (p.y - camera.focus.y) * s };
  },
};
