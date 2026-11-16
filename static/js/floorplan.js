// Mặt bằng các tầng (tầng 9: văn phòng hình chữ L; tầng 6: chữ nhật – xem FLOOR_DATA) chia thành nhiều phòng bằng vách ngăn thấp (kiểu cắt ngang để nhìn vào trong).
// Tỉ lệ theo bản vẽ của người dùng:
//   Cánh trái (x 30–280, y 30–760): phòng nhân viên (~60% chiều dài), phòng Giám đốc (rộng ngang) ở góc trên-phải,
//                                    phòng riêng, phòng học nhỏ, khu hút thuốc, hành lang, kho dưới cùng.
//   Hành lang (x 280–440, y 300–760): lối vào của học viên (mũi tên đỏ ở mép trước).
//   Cánh phải (x 280–680, y 30–300): kho nhỏ sát góc + phòng học lớn.
// Góc phía trước (x > 440, y > 300) để trống – nhìn thẳng xuống thành phố.
//
// Tường sau (x = 24, y = 24) cao như cũ; vách ngăn bên trong thấp (WALL_H) để vẫn thấy người phía sau.

import { box, getContext, line, poly, project, ISO } from "./iso.js";

export const WALL_H = 42;

// Phiên bản mặt bằng. v2: cánh trái rộng thêm 40 – bố cục lưu theo v1 được đổi toạ độ x bằng planX().
export const PLAN_VERSION = 2;
const PLAN_KNOTS = [[30, 30], [90, 100], [105, 120], [115, 130], [155, 180], [240, 280]];
export function planX(x) {
  if (x <= 30) return x;
  if (x >= 240) return x + 40;
  for (let i = 1; i < PLAN_KNOTS.length; i++) {
    const [a, A] = PLAN_KNOTS[i - 1], [b, B] = PLAN_KNOTS[i];
    if (x <= b) return Math.round(A + ((x - a) * (B - A)) / (b - a));
  }
  return x;
}
const HALF = 2; // nửa bề dày vách

// ===========================================================================
// Các tầng. Mỗi tầng: khung sàn (plan), vách + cửa (walls), lối vào (entrance), phòng (rooms), thảm (rugs),
// cửa sổ tường sau (windows), biển hiệu (signs), phòng học (classrooms).
// Tầng đang xem đổi bằng setFloor(); PLAN / WALLS / ROOMS... là "live binding" nên mọi module thấy ngay giá trị mới.
// ===========================================================================
const FLOOR_DATA = {
  // Tầng 9: văn phòng chữ L (trung tâm đào tạo).
  9: {
    plan: {
  min: 30, maxX: 680, maxY: 760, notchX: 440, notchY: 300, outer: 24, outerMaxX: 686, outerMaxY: 766,
},
    walls: [
  { plane: "x", at: 100, a: 24, b: 130, doors: [] },                                      // phòng Giám đốc (rộng ngang)
  { plane: "y", at: 130, a: 100, b: 280, doors: [[111, 147, -1]] },
  { plane: "y", at: 335, a: 24, b: 120, doors: [] },                                     // phòng riêng
  { plane: "x", at: 120, a: 335, b: 450, doors: [[405, 441, -1]] },
  { plane: "y", at: 450, a: 24, b: 280, doors: [[224, 260, 1]] },                        // phòng nhân viên | phần dưới
  { plane: "x", at: 280, a: 24, b: 766, doors: [[620, 656, 1]] },                       // cánh trái | cánh phải & sảnh (phòng nhân viên không có cửa sang phòng học)
  { plane: "y", at: 140, a: 280, b: 370, doors: [[315, 351, -1]] },                      // kho nhỏ
  { plane: "x", at: 370, a: 24, b: 140, doors: [] },
  { plane: "y", at: 300, a: 280, b: 440, doors: [[342, 378, 1]] },                       // phòng học lớn | hành lang (hành lang rộng tới x 440)
  { plane: "x", at: 180, a: 450, b: 575, doors: [[495, 531, 1]] },                       // phòng học nhỏ
  { plane: "y", at: 575, a: 24, b: 180, doors: [] },
  { plane: "x", at: 130, a: 575, b: 675, doors: [[610, 646, -1]] },                      // khu hút thuốc
  { plane: "y", at: 675, a: 24, b: 280, doors: [[177, 213, 1]] },                        // kho lớn
],
    entrance: { x0: 330, x1: 390, y: 760 }, // giữa hành lang (x 280–440)
    rooms: [
  { id: "staff", rects: [[30, 30, 100, 130], [30, 130, 280, 335], [120, 335, 280, 450]], tint: "rgba(62,140,215,0.50)", label: [127, 442] },
  { id: "cio", rects: [[100, 30, 280, 130]], tint: "rgba(62,140,215,0.50)", label: [108, 122] },
  { id: "private", rects: [[30, 335, 120, 450]], tint: "rgba(74,170,96,0.26)", label: [35, 442] },
  { id: "classBig", rects: [[370, 30, 680, 300], [280, 140, 370, 300]], tint: "rgba(128,134,142,0.62)", label: [376, 292] },
  { id: "storageS", rects: [[280, 30, 370, 140]], tint: "rgba(128,134,142,0.62)", label: [286, 132] },
  { id: "classSmall", rects: [[30, 450, 180, 575]], tint: "rgba(128,134,142,0.62)", label: [35, 567] },
  { id: "smoking", rects: [[30, 575, 130, 675]], tint: "rgba(128,134,142,0.62)", label: [35, 667] },
  { id: "hall", rects: [[180, 450, 280, 575], [130, 575, 280, 675]], tint: "rgba(128,134,142,0.62)", label: [186, 567] },
  { id: "storageL", rects: [[30, 675, 280, 760]], tint: "rgba(128,134,142,0.62)", label: [35, 752] },
  { id: "lobby", rects: [[280, 300, 440, 760]], tint: "rgba(255,255,255,0)", label: [286, 690] },
],
    rugs: [[142, 78, 239, 122], [37, 380, 113, 430]],
    windows: [
  { plane: "back", a0: 37, a1: 93 },   // phòng nhân viên
  { plane: "back", a0: 161, a1: 271 }, // phòng Giám đốc
  { plane: "back", a0: 440, a1: 530 }, // phòng học lớn
  { plane: "back", a0: 555, a1: 640 },
  { plane: "left", a0: 180, a1: 285 }, // phòng nhân viên
  { plane: "left", a0: 350, a1: 435 }, // phòng riêng
  { plane: "left", a0: 470, a1: 565 }, // phòng học nhỏ
  { plane: "left", a0: 592, a1: 665 }, // khu hút thuốc
],
    signs: [
  { plane: "x", at: 280, along: 611, z: 27, blade: true, w: 22, h: 8 }, // cửa ra vào (lối đi ⇄ hành lang)
  { plane: "y", at: 300, along: 320, z: 21 },                            // cửa phòng học 1 (dán phẳng, nhìn từ hành lang)
],
    classrooms: {
  classBig: { front: { x: 537, y: 45 } },
  classSmall: { front: { x: 96, y: 465 } },
},
  },
  // Tầng 6: chữ nhật theo bản vẽ người dùng – 4 phòng phía trên + hành lang chạy ngang phía dưới.
  //   Phòng 1 (trái, chữ L ôm cả dải trên), Phòng 2 (giữa, có phần nhô lên góc trên-phải), Phòng 3 (phải),
  //   Sảnh (giữa-dưới, cửa ra hành lang). Cửa sổ chỉ ở tường sau phía trên.
  6: {
    plan: { min: 30, maxX: 680, maxY: 690, notchX: 686, notchY: 696, outer: 24, outerMaxX: 686, outerMaxY: 696 },
    walls: [
      { plane: "x", at: 185, a: 125, b: 455, doors: [[335, 371, -1]] }, // Phòng 1 | Sảnh
      { plane: "y", at: 125, a: 185, b: 365, doors: [] },                // dải trên của Phòng 1 | Phòng 2
      { plane: "x", at: 365, a: 24, b: 125, doors: [] },
      { plane: "x", at: 455, a: 24, b: 455, doors: [[328, 364, 1]] },    // Phòng 2 & Sảnh | Phòng 3
      { plane: "y", at: 295, a: 185, b: 455, doors: [[205, 241, -1]] },  // Phòng 2 | Sảnh
      { plane: "y", at: 455, a: 24, b: 686, doors: [[258, 294, 1]] },    // các phòng | hành lang (cửa ở Sảnh)
    ],
    entrance: { side: "x", x: 680, y0: 543, y1: 603 }, // cạnh dưới-phải (x lớn nhất), giữa đầu hành lang (y 455–690)
    rooms: [
      { id: "f6r1", rects: [[30, 30, 185, 455], [185, 30, 365, 125]], tint: "rgba(128,134,142,0.62)", label: [35, 447] },
      { id: "f6r2", rects: [[185, 125, 455, 295], [365, 30, 455, 125]], tint: "rgba(128,134,142,0.62)", label: [191, 287] },
      { id: "f6r3", rects: [[455, 30, 680, 455]], tint: "rgba(128,134,142,0.62)", label: [461, 447] },
      { id: "f6lobby", rects: [[185, 295, 455, 455]], tint: "rgba(128,134,142,0.62)", label: [191, 447] },
      { id: "f6hall", rects: [[30, 455, 680, 690]], tint: "rgba(255,255,255,0)", label: [35, 682] },
    ],
    rugs: [],
    windows: [
      { plane: "back", a0: 66, a1: 156 },
      { plane: "back", a0: 232, a1: 312 },
      { plane: "back", a0: 380, a1: 432 },
      { plane: "back", a0: 499, a1: 644 },
    ],
    signs: [{ plane: "y", at: 455, along: 249, z: 27, blade: true, w: 22, h: 8 }], // cửa Sảnh ⇄ hành lang (bên trái khung cửa, không che cánh cửa)
    classrooms: {},
  },
};
export const FLOOR_IDS = [9, 6];
export let FLOOR = 9;
export let PLAN, WALLS, ENTRANCE, ROOMS, WINDOWS, CLASSROOMS;
let RUGS = [], SIGNS = [];
const floorListeners = [];
export const onFloorChange = fn => floorListeners.push(fn);
// Đổi tầng đang xem: thay dữ liệu mặt bằng, xoá bộ đệm vách/cửa (vẽ lại theo tầng mới).
export function setFloor(id) {
  const d = FLOOR_DATA[id] || FLOOR_DATA[9];
  FLOOR = FLOOR_DATA[id] ? Number(id) : 9;
  PLAN = d.plan; WALLS = d.walls; ENTRANCE = d.entrance; ROOMS = d.rooms; WINDOWS = d.windows; CLASSROOMS = d.classrooms;
  RUGS = d.rugs; SIGNS = d.signs;
  cachedDrawables = null;
  doors.length = 0;
  for (const fn of floorListeners) fn(FLOOR);
}

// Vách ngăn: plane "x" = vách nằm trong mặt phẳng x = at, chạy dọc trục y (từ a tới b); "y" ngược lại.
// doors: [đầu, cuối, phía mở cánh (+1 / -1 theo pháp tuyến)].



// Chỗ đứng trước cửa sổ (cách tường ~28) và điểm nhìn ra ngoài.
export function windowSpot(w, along = (w.a0 + w.a1) / 2) {
  return w.plane === "back"
    ? { at: { x: along, y: 58 }, look: { x: along, y: 0 } }
    : { at: { x: 58, y: along }, look: { x: 0, y: along } };
}

// Phòng chứa điểm (x, y) – id trong ROOMS hoặc null.
// Lối vào: side "y" (mặc định) = trên cạnh y lớn nhất, đoạn x0..x1; side "x" = trên cạnh x lớn nhất, đoạn y0..y1.
// Trả về thảm chùi chân, mũi tên (chỉ vào trong), chỗ đặt chữ, vùng cấm kê đồ và điểm đứng ngay trong cửa.
export function entranceInfo(E = ENTRANCE) {
  if (E.side === "x") {
    const ay = (E.y0 + E.y1) / 2, ex = E.x;
    return {
      mat: [ex - 30, E.y0, ex - 2, E.y1],
      arrow: [{ x: ex - 26, y: ay }, { x: ex - 14, y: ay + 10 }, { x: ex - 14, y: ay + 4 }, { x: ex - 5, y: ay + 4 },
        { x: ex - 5, y: ay - 4 }, { x: ex - 14, y: ay - 4 }, { x: ex - 14, y: ay - 10 }],
      label: [ex - 62, E.y0 - 4],
      keepClear: [ex - 34, E.y0, ex + 10, E.y1],
      door: { x: ex - 12, y: ay },
      out: { x: 1, y: 0 }, // hướng đi ra khỏi toà nhà
    };
  }
  const ax = (E.x0 + E.x1) / 2, ey = E.y;
  return {
    mat: [E.x0, ey - 30, E.x1, ey - 2],
    arrow: [{ x: ax, y: ey - 26 }, { x: ax + 10, y: ey - 14 }, { x: ax + 4, y: ey - 14 }, { x: ax + 4, y: ey - 5 },
      { x: ax - 4, y: ey - 5 }, { x: ax - 4, y: ey - 14 }, { x: ax - 10, y: ey - 14 }],
    label: [E.x0 - 4, ey - 34],
    keepClear: [E.x0, ey - 34, E.x1, ey + 10],
    door: { x: ax, y: ey - 12 },
    out: { x: 0, y: 1 },
  };
}

// Phòng của một tầng bất kỳ (không cần đang xem tầng đó).
export const floorRooms = f => (FLOOR_DATA[f] || FLOOR_DATA[9]).rooms;
export function roomAtOn(f, x, y) {
  for (const r of floorRooms(f)) for (const [x0, y0, x1, y1] of r.rects) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return r.id;
  return null;
}
export const roomFloorOf = id => FLOOR_IDS.find(f => floorRooms(f).some(r => r.id === id)) || 9;

export function roomAt(x, y) {
  for (const r of ROOMS) for (const [x0, y0, x1, y1] of r.rects) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return r.id;
  return null;
}


// ---------------------------------------------------------------------------
// Hình học
// ---------------------------------------------------------------------------
// Điểm có nằm trên sàn (hình chữ L) không.
export function onFloor(x, y, inset = 0) {
  const lo = PLAN.min + inset;
  if (x < lo || y < lo) return false;
  return (x <= PLAN.maxX - inset && y <= PLAN.notchY - inset) || (x <= PLAN.notchX - inset && y <= PLAN.maxY - inset);
}

// Khối chữ nhật b nằm gọn trên sàn.
export function rectOnFloor(b) {
  if (b.x0 < PLAN.min || b.y0 < PLAN.min || b.x1 > PLAN.maxX || b.y1 > PLAN.maxY) return false;
  return !(b.x1 > PLAN.notchX && b.y1 > PLAN.notchY);
}

const doorSpan = (w, d) => ({ a: d[0], b: d[1] });

// Khối chữ nhật b có đè lên vách, hoặc chắn lối trước cửa / lối vào không.
export function rectBlocked(b) {
  const hit = (x0, y0, x1, y1) => b.x0 < x1 && b.x1 > x0 && b.y0 < y1 && b.y1 > y0;
  for (const w of WALLS) {
    if (w.plane === "x" ? hit(w.at - HALF - 1, w.a, w.at + HALF + 1, w.b) : hit(w.a, w.at - HALF - 1, w.b, w.at + HALF + 1)) return true;
    for (const d of w.doors) {
      const s = doorSpan(w, d), clear = 24;
      if (w.plane === "x" ? hit(w.at - clear, s.a, w.at + clear, s.b) : hit(s.a, w.at - clear, s.b, w.at + clear)) return true;
    }
  }
  return hit(...entranceInfo().keepClear);
}

// Khối chữ nhật b có chạm vách / khung cửa không (không xét vùng chừa trước cửa) – dùng cho ghế của bàn.
export function rectHitsWall(b) {
  const hit = (x0, y0, x1, y1) => b.x0 < x1 && b.x1 > x0 && b.y0 < y1 && b.y1 > y0;
  if (!rectOnFloor(b)) return true;
  return WALLS.some(w => {
    const span = w.plane === "x" ? hit(w.at - HALF - 1, w.a, w.at + HALF + 1, w.b) : hit(w.a, w.at - HALF - 1, w.b, w.at + HALF + 1);
    if (!span) return false;
    // Lọt hẳn vào khoảng trống cửa (giữa hai trụ) thì không tính là chạm vách.
    const lo = w.plane === "x" ? b.y0 : b.x0, hi = w.plane === "x" ? b.y1 : b.x1;
    return !w.doors.some(([d0, d1]) => lo >= d0 + 2 && hi <= d1 - 2);
  });
}

// Đoạn thẳng p -> q có cắt ngang vách (không tính khe cửa) không – vd. từ bàn tới ghế: ghế không được ở bên kia vách.
export function segmentHitsWall(p, q) {
  const n = Math.max(2, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 2));
  for (let i = 0; i <= n; i++) {
    const x = p.x + ((q.x - p.x) * i) / n, y = p.y + ((q.y - p.y) * i) / n;
    for (const w of WALLS) {
      const across = w.plane === "x" ? x - w.at : y - w.at, along = w.plane === "x" ? y : x;
      if (Math.abs(across) > HALF + 0.5 || along < w.a || along > w.b) continue;
      if (w.doors.some(([d0, d1]) => along > d0 && along < d1)) continue;
      return true;
    }
  }
  return false;
}

// Ô lưới (tâm x, y) có bị tường chặn không – dùng cho tìm đường. gap = khoảng chừa "thân người".
export function wallBlocks(x, y, gap) {
  if (!onFloor(x, y, gap)) return true;
  const reach = HALF + gap;
  for (const w of WALLS) {
    const across = w.plane === "x" ? x - w.at : y - w.at;
    const along = w.plane === "x" ? y : x;
    if (Math.abs(across) >= reach || along < w.a - reach || along > w.b + reach) continue;
    if (w.doors.some(d => along > d[0] + 1 && along < d[1] - 1)) continue;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Vẽ sàn
// ---------------------------------------------------------------------------
function lPath(ctx, inset) {
  const o = PLAN.outer + inset, MX = PLAN.outerMaxX - inset, MY = PLAN.outerMaxY - inset, nx = PLAN.notchX, ny = PLAN.notchY;
  const pts = [[o, o], [MX, o], [MX, ny], [nx, ny], [nx, MY], [o, MY]];
  ctx.beginPath();
  pts.forEach(([x, y], i) => { const p = project(x, y); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
  ctx.closePath();
}

const rectPoly = ([x0, y0, x1, y1], fill, stroke) =>
  poly([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], fill, stroke);


export function drawFloorPlan() {
  const ctx = getContext();
  const O = PLAN.outer, MX = PLAN.outerMaxX, MY = PLAN.outerMaxY, nx = PLAN.notchX, ny = PLAN.notchY, lo = PLAN.min, hi = PLAN.maxY;
  // Mép sàn (viền) + mặt sàn
  ctx.fillStyle = "#dde4ef";
  ctx.strokeStyle = "#a9b8d3";
  lPath(ctx, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#f8fafd";
  lPath(ctx, 6); ctx.fill();

  ctx.save();
  lPath(ctx, 6);
  ctx.clip();
  for (let x = lo; x < hi; x += 50) {
    for (let y = lo; y < hi; y += 50) {
      if (((x - lo) / 50 + (y - lo) / 50) % 2 === 0) rectPoly([x, y, x + 50, y + 50], "rgba(58, 90, 158, 0.035)");
    }
  }
  for (const room of ROOMS) for (const r of room.rects) rectPoly(r, room.tint);
  // Phòng học: sàn gỗ (vạch dọc); hành lang + sảnh: ô gạch lớn.
  for (const room of ROOMS.filter(r => r.id.startsWith("class"))) {
    for (const [x0, y0, x1, y1] of room.rects) {
      for (let y = y0 + 14; y < y1; y += 14) poly([{ x: x0, y }, { x: x1, y }], null, "rgba(40,44,52,0.16)");
    }
  }
  for (let x = lo + 42; x < hi; x += 42) poly([{ x, y: lo }, { x, y: hi }], null, "rgba(60, 90, 150, 0.07)");
  for (let y = lo + 42; y < hi; y += 42) poly([{ x: lo, y }, { x: hi, y }], null, "rgba(60, 90, 150, 0.07)");
  // Thảm trải sàn ở phòng Giám đốc / phòng riêng
  for (const r of RUGS) rectPoly(r, "rgba(40,90,64,0.55)", "rgba(117,216,153,0.25)"); // #keep-color (thảm phòng xanh lá theo bản vẽ)
  // Thảm chùi chân + mũi tên đỏ ở lối vào
  const ent = entranceInfo();
  rectPoly(ent.mat, "rgba(70,76,88,0.85)", "rgba(200,206,216,0.6)");
  poly(ent.arrow, "#e0473a", "#ff8a7a");
  // (Không ghi chữ trên nền nhà – tên phòng / lối vào đã bỏ theo yêu cầu.)
  ctx.restore();

  // Mặt cắt sàn phía trước (độ dày sàn)
  const slab = (a, b, fill) => poly([{ ...a }, { ...b }, { ...b, z: -14 }, { ...a, z: -14 }], fill, "#9fb0d0");
  slab({ x: O, y: MY }, { x: nx, y: MY }, "#d3dbe8");
  slab({ x: nx, y: ny }, { x: nx, y: MY }, "#bcc7da");
  slab({ x: nx, y: ny }, { x: MX, y: ny }, "#d3dbe8");
  slab({ x: MX, y: O }, { x: MX, y: ny }, "#bcc7da");
}

// ---------------------------------------------------------------------------
// Vách ngăn + cánh cửa: là drawable trong sắp xếp chiều sâu cùng đồ đạc và nhân viên.
// ---------------------------------------------------------------------------
const WALL_COL = { top: "#ffffff", front: "#e9eef6", side: "#d6deea", edge: null };
const DOOR_COL = { top: "#7997d9", front: "#355aab", side: "#294789", edge: null };
const FRAME_COL = { top: "#ffffff", front: "#cbd5e6", side: "#b9c5da", edge: null };

// wall: { plane, at } – cho bộ xếp chiều sâu biết đây là vách mỏng (xem wallSide trong iso.js).
function pieceDrawable(x0, x1, y0, y1, h, colors, wall = null) {
  const bounds = { x0, x1, y0, y1, z0: 0, z1: h };
  return { bounds, layer: 0, wall, draw: () => box((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, h, 0, colors) };
}

// ---------------------------------------------------------------------------
// Cánh cửa tự động: mặc định đóng, mở ra khi có người tới gần (đi qua), rồi tự khép lại.
// Cánh xoay quanh bản lề ở đầu d0, mở về phía `side` (giống hướng mở cũ). Cửa không chặn đường đi.
// ---------------------------------------------------------------------------
let doorSensor = () => [];
// fn() trả về danh sách người đang có mặt ({ x, y }) – main.js truyền vào (nhân viên + học viên).
export function setDoorSensor(fn) { doorSensor = fn; }
const DOOR_NEAR = 28;      // tới gần cửa trong khoảng này thì cửa mở
const DOOR_HOLD = 450;     // ms giữ cửa mở sau khi người cuối cùng đi khỏi
const doors = [];
let lastDoorTime = 0;

function makeDoor(w, d0, d1, side) {
  const along = (d0 + d1) / 2;
  const center = w.plane === "x" ? { x: w.at, y: along } : { x: along, y: w.at };
  const door = { w, d0, d1, side, center, open: 0, until: 0, bounds: { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: WALL_H - 4 } };
  door.drawable = { bounds: door.bounds, layer: 0, draw: () => drawLeaf(door) };
  return door;
}

// Bốn góc đáy của cánh cửa ở độ mở hiện tại (0 = đóng, 1 = mở 90°).
function leafCorners(door) {
  const { w, d0, d1, side } = door;
  const a = (door.open * Math.PI) / 2, len = d1 - d0 - 4;
  const hinge = w.plane === "x" ? { x: w.at, y: d0 + 2 } : { x: d0 + 2, y: w.at };
  const dir = w.plane === "x" ? { x: Math.sin(a) * side, y: Math.cos(a) } : { x: Math.cos(a), y: Math.sin(a) * side };
  const n = { x: -dir.y, y: dir.x };
  const end = { x: hinge.x + dir.x * len, y: hinge.y + dir.y * len };
  const t = 1;
  return {
    dir, n,
    pts: [
      { x: hinge.x + n.x * t, y: hinge.y + n.y * t }, { x: end.x + n.x * t, y: end.y + n.y * t },
      { x: end.x - n.x * t, y: end.y - n.y * t }, { x: hinge.x - n.x * t, y: hinge.y - n.y * t },
    ],
  };
}

function drawLeaf(door) {
  const { dir, n, pts } = leafCorners(door);
  const H = WALL_H - 4;
  const up = p => ({ ...p, z: H });
  // Mặt bên nhìn thấy được khi pháp tuyến hướng về phía người xem (+x / +y).
  const faces = [
    { a: pts[0], b: pts[1], nx: n.x, ny: n.y },
    { a: pts[2], b: pts[3], nx: -n.x, ny: -n.y },
    { a: pts[1], b: pts[2], nx: dir.x, ny: dir.y },
  ];
  for (const f of faces) {
    if (f.nx + f.ny <= 0.01) continue;
    const col = Math.abs(f.ny) >= Math.abs(f.nx) ? DOOR_COL.front : DOOR_COL.side;
    poly([{ ...f.a, z: 0 }, { ...f.b, z: 0 }, up(f.b), up(f.a)], col);
  }
  poly(pts.map(up), DOOR_COL.top);
  // Tay nắm
  const k = 0.8, hx = pts[0].x + (pts[1].x - pts[0].x) * k, hy = pts[0].y + (pts[1].y - pts[0].y) * k;
  poly([{ x: hx, y: hy, z: 19 }, { x: hx + dir.x * 3, y: hy + dir.y * 3, z: 19 }, { x: hx + dir.x * 3, y: hy + dir.y * 3, z: 21 }, { x: hx, y: hy, z: 21 }], "#e8c25a");
}

function updateDoors() {
  const now = performance.now();
  const dt = Math.min(100, lastDoorTime ? now - lastDoorTime : 16);
  lastDoorTime = now;
  const people = doorSensor() || [];
  for (const d of doors) {
    if (people.some(p => Math.hypot(p.x - d.center.x, p.y - d.center.y) < DOOR_NEAR)) d.until = now + DOOR_HOLD;
    const target = now < d.until ? 1 : 0;
    const speed = target ? 0.0045 : 0.0028; // mở nhanh, khép chậm hơn một chút
    d.open = target ? Math.min(1, d.open + dt * speed) : Math.max(0, d.open - dt * speed);
    const { pts } = leafCorners(d);
    Object.assign(d.bounds, {
      x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)),
      y0: Math.min(...pts.map(p => p.y)), y1: Math.max(...pts.map(p => p.y)),
    });
  }
}

// ---------------------------------------------------------------------------
// Biển hiệu logo GKI nhỏ gắn trên tường cạnh cửa, mặt quay ra hành lang (phía người xem).
//   plane/at: vách mang biển; along: tâm biển dọc theo vách; z: mép dưới biển.
// ---------------------------------------------------------------------------
//   blade: biển chìa – tấm đế áp tường + tấm biển chìa ra vuông góc (mặt có logo quay về người xem).
const SIGN_W = 30, SIGN_H = 10.5;

// Tấm biển trắng có logo, vẽ trong hệ toạ độ đã biến đổi (đơn vị = đơn vị thế giới), góc trên-trái ở (0, 0).
function signPlate(ctx, W, H) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#9fb0d0";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 1.2);
  ctx.fill();
  ctx.stroke();
  if (logoImg && logoImg.complete && logoImg.naturalWidth) {
    const w = W - 2, h = (w * 230) / 800;
    ctx.drawImage(logoImg, 1, (H - h) / 2, w, h);
  }
}

// Biển chìa trên vách plane "y": tấm đế áp tường, tấm biển chìa ra theo +y (ra hành lang), mặt +x có logo quay về người xem.
function drawBladeY(sg) {
  const ctx = getContext();
  const y0 = sg.at + HALF, top = sg.z + sg.h, base = 1.2, t = 0.8;
  const frame = "#2a3550";
  const mz0 = sg.z - 2, mz1 = top + 2;
  poly([{ x: sg.along - 1.5, y: y0 + base, z: mz0 }, { x: sg.along + 1.5, y: y0 + base, z: mz0 },
    { x: sg.along + 1.5, y: y0 + base, z: mz1 }, { x: sg.along - 1.5, y: y0 + base, z: mz1 }], frame);
  poly([{ x: sg.along + 1.5, y: y0, z: mz0 }, { x: sg.along + 1.5, y: y0 + base, z: mz0 },
    { x: sg.along + 1.5, y: y0 + base, z: mz1 }, { x: sg.along + 1.5, y: y0, z: mz1 }], "#1d2740");
  const ya = y0 + base, yb = ya + sg.w;
  poly([{ x: sg.along - t, y: yb, z: sg.z }, { x: sg.along + t, y: yb, z: sg.z },
    { x: sg.along + t, y: yb, z: top }, { x: sg.along - t, y: yb, z: top }], "#c9d4e6", frame);
  poly([{ x: sg.along - t, y: ya, z: top }, { x: sg.along - t, y: yb, z: top },
    { x: sg.along + t, y: yb, z: top }, { x: sg.along + t, y: ya, z: top }], "#e9eef6", frame);
  // Mặt +x: chữ chạy theo hướng -y (từ đầu ngoài vào tường) để đọc từ trái sang phải trên màn hình.
  const p = project(sg.along + t, yb, top);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.transform(ISO.kx, -ISO.ky, 0, 1, 0, 0);
  signPlate(ctx, sg.w, sg.h);
  ctx.restore();
}

// Biển chìa trên vách plane "x" (kiểu đơn giản): tấm đế mỏng áp sát tường (cao hơn biển một chút),
// tấm biển gắn thẳng vào giữa đế, chìa ra vuông góc (theo +x, ra hành lang), mặt +y có logo quay về người xem.
function drawBlade(sg) {
  if (sg.plane === "y") { drawBladeY(sg); return; }
  const ctx = getContext();
  const x0 = sg.at + HALF, top = sg.z + sg.h, base = 1.2, t = 0.8;
  const frame = "#2a3550";
  // Tấm đế áp tường: cao hơn biển 2 đơn vị mỗi đầu, rộng 3 dọc theo tường
  const mz0 = sg.z - 2, mz1 = top + 2;
  poly([{ x: x0 + base, y: sg.along - 1.5, z: mz0 }, { x: x0 + base, y: sg.along + 1.5, z: mz0 },
    { x: x0 + base, y: sg.along + 1.5, z: mz1 }, { x: x0 + base, y: sg.along - 1.5, z: mz1 }], frame);
  poly([{ x: x0, y: sg.along + 1.5, z: mz0 }, { x: x0 + base, y: sg.along + 1.5, z: mz0 },
    { x: x0 + base, y: sg.along + 1.5, z: mz1 }, { x: x0, y: sg.along + 1.5, z: mz1 }], "#1d2740");
  // Tấm biển: cạnh ngoài + mặt trên (độ dày) rồi mặt trước có logo
  const xa = x0 + base, xb = xa + sg.w;
  poly([{ x: xb, y: sg.along - t, z: sg.z }, { x: xb, y: sg.along + t, z: sg.z },
    { x: xb, y: sg.along + t, z: top }, { x: xb, y: sg.along - t, z: top }], "#c9d4e6", frame);
  poly([{ x: xa, y: sg.along - t, z: top }, { x: xb, y: sg.along - t, z: top },
    { x: xb, y: sg.along + t, z: top }, { x: xa, y: sg.along + t, z: top }], "#e9eef6", frame);
  const p = project(xa, sg.along + t, top);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.transform(ISO.kx, ISO.ky, 0, 1, 0, 0);
  signPlate(ctx, sg.w, sg.h);
  ctx.restore();
}
const logoImg = typeof Image === "undefined" ? null : Object.assign(new Image(), { src: "static/logo.svg" });

function drawSign(sg) {
  const ctx = getContext();
  // Góc trên-trái của biển (theo chiều đọc từ trái sang phải trên màn hình).
  const top = sg.z + SIGN_H, off = HALF + 0.4;
  const p = sg.plane === "x"
    ? project(sg.at + off, sg.along + SIGN_W / 2, top)  // mặt +x: chữ chạy theo hướng -y
    : project(sg.along - SIGN_W / 2, sg.at + off, top); // mặt +y: chữ chạy theo hướng +x
  ctx.save();
  ctx.translate(p.x, p.y);
  if (sg.plane === "x") ctx.transform(ISO.kx, -ISO.ky, 0, 1, 0, 0);
  else ctx.transform(ISO.kx, ISO.ky, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(10, 30, 80, .18)"; // bóng đổ nhẹ
  ctx.fillRect(0.8, 0.8, SIGN_W, SIGN_H);
  signPlate(ctx, SIGN_W, SIGN_H);
  ctx.restore();
}

let cachedDrawables = null;
export function wallDrawables() {
  if (cachedDrawables) { updateDoors(); return cachedDrawables; }
  const out = [];
  // Mối nối chữ T: vách vuông góc kết thúc ngay trên vách này (tại toạ độ `along`).
  const perp = w => WALLS.filter(o => o.plane !== w.plane);
  const meets = (o, at) => Math.abs(o.at - at) < 0.5;
  for (const w of WALLS) {
    const cuts = [...w.doors].sort((p, q) => p[0] - q[0]);
    let from = w.a;
    let spans = [];
    for (const [d0, d1] of cuts) { if (d0 > from) spans.push([from, d0]); from = d1; }
    if (w.b > from) spans.push([from, w.b]);
    // 1) Đầu vách chạm mặt vách vuông góc thì dừng ở MẶT vách đó (không lấn vào bề dày) – nếu lấn, hai khối chồng nhau
    //    ở góc và thứ tự vẽ bị rối (đoạn vách ngắn nổi ra phía trước).
    spans = spans.map(([a, b]) => {
      for (const o of perp(w)) {
        if (w.at < o.a - 0.5 || w.at > o.b + 0.5) continue;
        if (meets(o, a)) a += HALF;
        if (meets(o, b)) b -= HALF;
      }
      return [a, b];
    }).filter(([a, b]) => b - a > 0.5);
    // 2) Chia vách dài tại các điểm có vách khác nối vào, để mỗi đoạn được xếp thứ tự vẽ đúng với đồ đạc / người xung quanh.
    const joints = perp(w).filter(o => (meets({ at: w.at }, o.a) || meets({ at: w.at }, o.b))).map(o => o.at);
    spans = spans.flatMap(([a, b]) => {
      const cutsAt = joints.filter(j => j > a + 1 && j < b - 1).sort((p, q) => p - q);
      const parts = [];
      let s0 = a;
      for (const j of cutsAt) { parts.push([s0, j]); s0 = j; }
      parts.push([s0, b]);
      return parts;
    });
    for (const [a, b] of spans) {
      const piece = w.plane === "x"
        ? pieceDrawable(w.at - HALF, w.at + HALF, a, b, WALL_H, WALL_COL, { plane: "x", at: w.at })
        : pieceDrawable(a, b, w.at - HALF, w.at + HALF, WALL_H, WALL_COL, { plane: "y", at: w.at });
      // Biển hiệu nằm trên đoạn vách này: vẽ ngay sau vách (cùng thứ tự chiều sâu).
      const signs = SIGNS.filter(sg => !sg.blade && sg.plane === w.plane && sg.at === w.at && sg.along - SIGN_W / 2 >= a && sg.along + SIGN_W / 2 <= b);
      if (signs.length) {
        const base = piece.draw;
        piece.draw = () => { base(); signs.forEach(drawSign); };
      }
      out.push(piece);
    }
    for (const [d0, d1, side] of cuts) {
      // Khung cửa: hai trụ mảnh hai bên
      for (const e of [d0, d1]) {
        out.push(w.plane === "x"
          ? pieceDrawable(w.at - HALF - 1, w.at + HALF + 1, e - 1.5, e + 1.5, WALL_H + 3, FRAME_COL, { plane: "x", at: w.at })
          : pieceDrawable(e - 1.5, e + 1.5, w.at - HALF - 1, w.at + HALF + 1, WALL_H + 3, FRAME_COL, { plane: "y", at: w.at }));
      }
      // Cánh cửa (đóng/mở theo người đi qua)
      const door = makeDoor(w, d0, d1, side);
      doors.push(door);
      out.push(door.drawable);
    }
  }
  // Biển chìa: vật thể riêng nhô ra hành lang -> drawable riêng để xếp chiều sâu đúng với người đi qua.
  for (const sg of SIGNS.filter(s => s.blade)) {
    const o = sg.at + HALF;
    const bounds = sg.plane === "y"
      ? { x0: sg.along - 1, x1: sg.along + 1, y0: o, y1: o + sg.w + 4, z0: sg.z, z1: sg.z + sg.h + 5 }
      : { x0: o, x1: o + sg.w + 4, y0: sg.along - 1, y1: sg.along + 1, z0: sg.z, z1: sg.z + sg.h + 5 };
    out.push({ bounds, layer: 0, draw: () => drawBlade(sg) });
  }
  cachedDrawables = out;
  updateDoors();
  return out;
}

// Độ mở hiện tại của từng cửa (0 đóng – 1 mở) – để kiểm thử tự động.
export const doorStates = () => doors.map(d => ({ x: d.center.x, y: d.center.y, open: +d.open.toFixed(2) }));

setFloor(9);
