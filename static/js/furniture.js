// Nội thất: mỗi món được dựng từ các khối 3D trong hệ toạ độ cục bộ (u, v, z),
// nên khi xoay 90° nó xoay thật trong thế giới isometric chứ không xoay hình 2D.
//
// Quy ước hệ cục bộ: +v là "mặt trước" (phía người dùng đứng/ngồi), +u là bên phải khi nhìn từ mặt trước.

import { box, getContext, isoSort, poly, project, screenBounds, shade } from "./iso.js";
import { rectBlocked, rectHitsWall, rectOnFloor, segmentHitsWall } from "./floorplan.js";

// Trạng thái động do mô phỏng cập nhật (màn hình bật, máy in chạy, mực trên bảng...).
export const runtime = {
  tick: 0,
  screenState: () => "off", // "off" | "idle" | "busy" | "typing"
  printerActive: () => false,
  boardInk: 0,
  cabinetOpen: () => false, // ngăn tủ hồ sơ đang kéo ra
  microwaveOn: () => false, // lò vi sóng đang hâm đồ ăn
  archiveCount: 0,          // số báo cáo đã lưu -> số tập hồ sơ xếp trên nóc tủ
  trashCount: 0,            // số cục giấy trong thùng rác
};

export function rot(item) { return (((item.rotation || 0) % 4) + 4) % 4; }

export function toWorld(r, u, v) {
  switch (r) {
    case 0: return [u, v];
    case 1: return [-v, u];
    case 2: return [-u, -v];
    default: return [v, -u];
  }
}

export function localPoint(item, u, v) {
  const [dx, dy] = toWorld(rot(item), u, v);
  return { x: item.x + dx, y: item.y + dy };
}

// Mặt cục bộ nào đang quay về +y (front) / +x (side) của thế giới, theo từng hướng xoay.
const FRONT_FACE = ["pv", "pu", "nv", "nu"];
const SIDE_FACE = ["pu", "nv", "nu", "pv"];
const FACE_NORMAL = { pv: [0, 1], nv: [0, -1], pu: [1, 0], nu: [-1, 0] };

const resolve = c => (typeof c === "function" ? c() : c);

// ---------------------------------------------------------------------------
// Bộ dựng khối
// ---------------------------------------------------------------------------
function makeBuilder(item) {
  const r = rot(item);
  const prims = [];

  function decalPoints(dec, b) {
    const L = (u, v, z) => {
      const [dx, dy] = toWorld(r, u, v);
      return { x: item.x + dx, y: item.y + dy, z };
    };
    if (dec.face === "top") {
      const z = b.z + b.h + 0.15;
      return {
        visible: true,
        points: [
          L(b.u + dec.u0, b.v + dec.v0, z), L(b.u + dec.u1, b.v + dec.v0, z),
          L(b.u + dec.u1, b.v + dec.v1, z), L(b.u + dec.u0, b.v + dec.v1, z),
        ],
      };
    }
    const [nu, nv] = FACE_NORMAL[dec.face];
    const [wx, wy] = toWorld(r, nu, nv);
    const visible = wx > 0 || wy > 0;
    let pts;
    if (nv !== 0) {
      const v = b.v + nv * (b.d / 2 + 0.2);
      pts = [L(b.u + dec.u0, v, dec.z0), L(b.u + dec.u1, v, dec.z0), L(b.u + dec.u1, v, dec.z1), L(b.u + dec.u0, v, dec.z1)];
    } else {
      const u = b.u + nu * (b.w / 2 + 0.2);
      pts = [L(u, b.v + dec.u0, dec.z0), L(u, b.v + dec.u1, dec.z0), L(u, b.v + dec.u1, dec.z1), L(u, b.v + dec.u0, dec.z1)];
    }
    return { visible, points: pts };
  }

  const api = {
    box(u, v, w, d, h, z, color, opts = {}) {
      const [dx, dy] = toWorld(r, u, v);
      const odd = r % 2 === 1;
      const W = odd ? d : w, D = odd ? w : d;
      const x = item.x + dx, y = item.y + dy;
      const local = { u, v, w, d, h, z };
      prims.push({
        kind: "box", x, y, w: W, d: D, h, z, color,
        faces: opts.faces || {}, edge: !!opts.edge, visible: opts.visible,
        decals: (opts.decals || []).map(dec => ({ ...decalPoints(dec, local), color: dec.color })),
        bounds: { x0: x - W / 2, x1: x + W / 2, y0: y - D / 2, y1: y + D / 2, z0: z, z1: z + h },
      });
    },
    custom(u, v, w, d, z0, z1, draw) {
      const [dx, dy] = toWorld(r, u, v);
      const x = item.x + dx, y = item.y + dy;
      prims.push({
        kind: "custom", draw: () => draw(project(x, y, z0)),
        bounds: { x0: x - w / 2, x1: x + w / 2, y0: y - d / 2, y1: y + d / 2, z0, z1 },
      });
    },
  };
  return { api, prims, r };
}

function drawPrims(prims, r) {
  for (const p of prims) {
    if (p.kind === "custom") { p.draw(); continue; }
    if (p.visible && !p.visible()) continue;
    const base = resolve(p.color);
    if (!base) continue;
    box(p.x, p.y, p.w, p.d, p.h, p.z, {
      top: resolve(p.faces.top) || shade(base, 0.14),
      front: resolve(p.faces[FRONT_FACE[r]]) || base,
      side: resolve(p.faces[SIDE_FACE[r]]) || shade(base, -0.3),
      edge: p.edge ? shade(base, 0.35) : null,
    });
    for (const dec of p.decals) {
      if (!dec.visible) continue;
      const c = resolve(dec.color);
      if (c) poly(dec.points, c);
    }
  }
}

// ---------------------------------------------------------------------------
// Từng món nội thất
// ---------------------------------------------------------------------------
const C = {
  leg: "#2a302c", metal: "#3b4440", desk: "#a8875a", pedestal: "#86694a", drawer: "#6e5539",
  casing: "#1d2421", paper: "#f1f0e8", mug: "#e9e4d8", wood: "#6b5038", chair: "#3b4a44",
};
const BOOK_COLORS = ["#b5523b", "#d0a245", "#4f7cac", "#5b8f5a", "#8a5a9e", "#c97a3c", "#3f7f86", "#a33d5c"];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function screenColor(item) {
  switch (runtime.screenState(item)) {
    case "typing": case "busy": return "#1e2433";
    case "idle": return "#2a3550";
    default: return "#16201b";
  }
}

// Các dòng code tô màu cú pháp trên màn hình; chỉ hiện khi máy đang bật.
const CODE_COLORS = ["#c792ea", "#82aaff", "#c3e88d", "#f78c6c", "#89ddff", "#ffcb6b"];
function codeLines(item, u0, u1, zTop, step, face = "pv") {
  let seed = hash(item.id || "code");
  const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0) % 1000) / 1000;
  const out = [];
  const rows = Math.floor(11 / step * 1.4);
  for (let r = 0; r < rows; r++) {
    const z = zTop - r * step;
    let u = u0 + Math.floor(rnd() * 3) * 1.6;
    const last = r === rows - 1;
    const parts = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < parts && u < u1 - 2; k++) {
      const w = Math.min(u1 - u, 2 + rnd() * 6);
      const color = CODE_COLORS[Math.floor(rnd() * CODE_COLORS.length)];
      out.push({
        face, u0: u, u1: u + w, z0: z - step * 0.45, z1: z,
        color: () => {
          const st = runtime.screenState(item);
          if (st === "off") return null;
          if (last && st === "idle") return null;
          return color;
        },
      });
      u += w + 1.2;
    }
    if (last) out.push({ face, u0: u, u1: u + 1, z0: z - step * 0.6, z1: z + 0.2, color: () => (runtime.screenState(item) === "typing" && runtime.tick % 30 < 15 ? "#ffffff" : null) });
  }
  return out;
}

function buildDesk(L, item) {
  for (const [u, v] of [[-29, -14], [29, -14], [-29, 14], [29, 14]]) L.box(u, v, 4, 4, 28, 0, C.leg);
  L.box(0, -15, 54, 2, 16, 10, "#6f5940");
  L.box(20, 1, 18, 28, 27, 0, C.pedestal, {
    decals: [
      { face: "pv", u0: -7, u1: 7, z0: 15, z1: 24, color: C.drawer },
      { face: "pv", u0: -7, u1: 7, z0: 3, z1: 12, color: C.drawer },
      { face: "pv", u0: -2, u1: 2, z0: 20, z1: 21.5, color: "#d8c9a6" },
      { face: "pv", u0: -2, u1: 2, z0: 8, z1: 9.5, color: "#d8c9a6" },
    ],
  });
  L.box(0, 0, 64, 34, 3, 28, C.desk, { edge: true });
  // Màn hình
  L.box(-6, -10, 12, 7, 1, 31, C.metal);
  L.box(-6, -11, 3, 2, 8, 32, C.metal);
  // Trình soạn code trên màn hình (dòng cuối có con trỏ nhấp nháy khi đang làm việc).
  L.box(-6, -10, 32, 3, 20, 38, C.casing, {
    decals: [
      { face: "pv", u0: -14, u1: 14, z0: 40, z1: 56, color: () => screenColor(item) },
      ...codeLines(item, -12, 12, 53.5, 1.9),
    ],
  });
  // Bàn phím, chuột, cốc, giấy
  L.box(-6, 6, 22, 7, 1.5, 31, "#2b312e", {
    decals: [{ face: "top", u0: -10, u1: 10, v0: -2.5, v1: 2.5, color: "#5c6660" }],
  });
  L.box(9, 7, 3, 5, 1.2, 31, "#2b312e");
  L.box(24, -6, 5, 5, 7, 31, C.mug, { decals: [{ face: "top", u0: -2, u1: 2, v0: -2, v1: 2, color: "#5a3a22" }] });
  L.box(-25, 5, 11, 14, 1, 31, C.paper);
}

function buildChairParts(L, cu, cv, backSign, color, part) {
  if (part !== "back") {
    L.box(cu, cv, 16, 3, 2, 0, "#262c29");
    L.box(cu, cv, 3, 16, 2, 0, "#262c29");
    L.box(cu, cv, 3, 3, 11, 2, "#262c29");
    L.box(cu, cv, 18, 17, 4, 13, color, { edge: true });
  }
  if (part !== "seat") L.box(cu, cv + backSign * 9.5, 18, 3, 18, 17, shade(color, -0.12), { edge: true });
}

function buildMeeting(L) {
  L.box(0, 0, 34, 22, 2, 0, C.leg);
  L.box(0, 0, 10, 10, 25, 2, C.leg);
  L.box(0, 0, 84, 52, 3, 27, "#8f7350", { edge: true });
  L.box(-14, 5, 16, 11, 1, 30, "#9aa3a0");
  L.box(-14, -1.5, 16, 1.5, 10, 31, "#9aa3a0", {
    decals: [{ face: "pv", u0: -7, u1: 7, z0: 32, z1: 40, color: "#3f8fbf" }],
  });
  L.box(14, 3, 12, 15, 0.8, 30, C.paper);
  L.box(30, -12, 4, 4, 5, 30, C.mug);
  L.box(-32, 12, 4, 4, 5, 30, C.mug);
}

function buildBookshelf(L, item) {
  const W = C.wood;
  L.box(0, -9.5, 64, 3, 84, 0, shade(W, -0.25));
  L.box(-30.5, 0, 3, 22, 84, 0, W);
  L.box(30.5, 0, 3, 22, 84, 0, W);
  L.box(0, 1.5, 58, 19, 5, 0, W);
  L.box(0, 1.5, 58, 19, 2.5, 28, W);
  L.box(0, 1.5, 58, 19, 2.5, 56, W);
  L.box(0, 0, 64, 22, 3, 81, W, { edge: true });
  let seed = hash(item.id || "shelf");
  const rand = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  // Sách xếp sát nhau từ vách này sang vách kia (chỉ thấy gáy, như kệ thật),
  // thỉnh thoảng cuối hàng có một chồng sách nằm ngang.
  const pick = () => BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)];
  for (const z of [5, 30.5, 58.5]) {
    let u = -29;
    while (u < 28) {
      // Chồng sách nằm chỉ đặt ở cuối hàng: nếu có sách đứng phía sau nó thì sẽ lộ cả mặt bìa.
      if (29 - u >= 10 && 29 - u <= 14 && rand() < 0.45) {
        const w = 10 + Math.floor(rand() * 3), n = 2 + Math.floor(rand() * 3);
        for (let k = 0; k < n; k++) L.box(u + w / 2 + (k % 2 ? 0.6 : -0.4), -0.5, w - (k % 2), 13, 3, z + k * 3, pick());
        u += w + 0.5;
        continue;
      }
      const w = Math.min(4 + Math.floor(rand() * 3), 29 - u);
      if (w < 2.5) break;
      L.box(u + w / 2, -0.5, w, 14, 17 + rand() * 3.5, z, pick());
      u += w;
    }
  }
}

// Bảng trắng: bảng kế hoạch (cột "Việc / Đang làm / Xong" với các giấy nhớ), dán dần khi Giám đốc phân công.
const INK_NOTES = [
  [-29, 58, "#f2c94c"], [-29, 48, "#82aaff"], [-12, 58, "#f2c94c"], [-12, 48, "#f78c6c"],
  [5, 58, "#c3e88d"], [5, 48, "#82aaff"], [22, 58, "#c3e88d"], [22, 48, "#f2c94c"],
];
function buildWhiteboard(L) {
  for (const u of [-31, 31]) {
    L.box(u, 0, 4, 16, 2, 0, "#8d938f");
    L.box(u, 0, 3, 4, 38, 2, "#9aa09c");
  }
  L.box(0, 0, 70, 3, 36, 36, "#c9ced0", {
    edge: true,
    decals: [
      { face: "pv", u0: -33, u1: 33, z0: 38, z1: 70, color: "#f3f5ef" },
      { face: "pv", u0: -30, u1: 30, z0: 65, z1: 65.8, color: "#5c6660" },
      { face: "pv", u0: -14.5, u1: -13.9, z0: 41, z1: 68, color: "#9aa09c" },
      { face: "pv", u0: 2.7, u1: 3.3, z0: 41, z1: 68, color: "#9aa09c" },
      { face: "pv", u0: 19.9, u1: 20.5, z0: 41, z1: 68, color: "#9aa09c" },
      ...INK_NOTES.map(([u0, z, color], i) => ({
        face: "pv", u0, u1: u0 + 12, z0: z - 7, z1: z, color: () => (runtime.boardInk > i ? color : null),
      })),
    ],
  });
  L.box(0, 2.5, 50, 3, 1.5, 36, "#9aa09c");
}

function buildPrinter(L) {
  L.box(0, 0, 44, 32, 22, 0, "#39443e", {
    decals: [
      { face: "pv", u0: -20, u1: -1, z0: 3, z1: 19, color: "#4a5650" },
      { face: "pv", u0: 1, u1: 20, z0: 3, z1: 19, color: "#4a5650" },
    ],
  });
  L.box(0, -1, 38, 28, 13, 22, "#c9cdc5", {
    edge: true,
    decals: [
      { face: "pv", u0: -12, u1: 12, z0: 25, z1: 27.5, color: "#2a2f2c" },
      {
        face: "pv", u0: 13, u1: 16, z0: 30, z1: 32,
        color: () => (runtime.printerActive() ? (runtime.tick % 20 < 10 ? "#8fffa6" : "#e8f77a") : "#4f7a55"),
      },
    ],
  });
  L.box(0, -3, 34, 22, 3, 35, "#e2e5dd");
  L.box(0, 15, 18, 8, 1, 26, C.paper, { visible: () => runtime.printerActive() });
}

function buildWatercooler(L) {
  L.box(0, 0, 24, 24, 34, 0, "#dfe3dc", {
    edge: true,
    decals: [
      { face: "pv", u0: -6, u1: 6, z0: 19, z1: 28, color: "#b9c0b8" },
      { face: "pv", u0: -3, u1: -1, z0: 22, z1: 25, color: "#3a7bd5" },
      { face: "pv", u0: 1, u1: 3, z0: 22, z1: 25, color: "#d5463a" },
    ],
  });
  L.box(0, 0, 8, 8, 3, 34, "#cfd5ce");
  L.box(0, 0, 16, 16, 20, 37, "#8cc6e6", {
    decals: [{ face: "pv", u0: -8, u1: 8, z0: 46, z1: 49, color: "#c3e6f6" }],
  });
}

function buildVending(L) {
  const items = ["#e05a47", "#f2c94c", "#5fb3e0", "#7bc96f", "#e58fb1", "#f29b38", "#9b7be0", "#5ad1b3", "#e05a47"];
  L.box(0, 0, 46, 32, 80, 0, "#2c6f8e", {
    edge: true,
    decals: [
      { face: "pv", u0: -21, u1: 21, z0: 76, z1: 79, color: "#f2c94c" },
      { face: "pv", u0: -20, u1: 8, z0: 24, z1: 74, color: "#152a33" },
      ...items.map((color, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        return { face: "pv", u0: -18 + col * 9, u1: -12 + col * 9, z0: 62 - row * 15, z1: 70 - row * 15, color };
      }),
      { face: "pv", u0: 11, u1: 19, z0: 46, z1: 66, color: "#cfd8d6" },
      { face: "pv", u0: 13, u1: 17, z0: 40, z1: 43, color: "#1e2326" },
      { face: "pv", u0: -16, u1: 4, z0: 8, z1: 16, color: "#0e1418" },
    ],
  });
}

function buildSofa(L) {
  const S = SOFA_BLUE;
  L.box(0, 0, 84, 34, 12, 0, shade(S, -0.25));
  L.box(0, -12.5, 84, 9, 26, 12, S, { edge: true });
  L.box(-38, 2, 8, 30, 10, 12, S, { edge: true });
  L.box(38, 2, 8, 30, 10, 12, S, { edge: true });
  L.box(-17, 3.5, 32, 25, 6, 12, shade(S, 0.1), { edge: true });
  L.box(17, 3.5, 32, 25, 6, 12, shade(S, 0.1), { edge: true });
  L.box(-26, -5.5, 12, 4, 10, 18, "#d9b44a");
}

function buildPlant(L, item) {
  const variant = hash(item.id || "plant") % 3;
  L.box(0, 0, 16, 16, 14, 0, "#b56a43", {
    edge: true,
    decals: [{ face: "top", u0: -6.5, u1: 6.5, v0: -6.5, v1: 6.5, color: "#4a3626" }],
  });
  L.custom(0, 0, 18, 18, 14, 52, p => drawLeaves(p, variant));
}

function drawLeaves(p, variant) {
  const ctx = getContext();
  const stems = [
    [[0, -2, -2, -33], [-2, -3, -16, -22], [2, -3, 16, -26], [0, -3, 1, -40], [0, -3, -19, -14]],
    [[0, -2, -8, -26], [0, -2, 9, -28], [0, -2, 0, -34], [0, -2, -14, -14], [0, -2, 14, -15]],
    [[0, -2, 0, -46], [0, -2, -4, -38], [0, -2, 5, -40]],
  ][variant];
  const leaves = [
    [[-18, -25], [-6, -35], [8, -29], [15, -22], [-20, -16], [-2, -42]],
    [[-12, -28], [5, -31], [-4, -36], [-17, -16], [11, -18], [0, -24]],
    [[-4, -48], [-8, -40], [3, -44], [4, -36], [-6, -30], [2, -26]],
  ][variant];
  ctx.strokeStyle = "#3f6f45";
  ctx.lineWidth = 2.5;
  for (const [sx, sy, ex, ey] of stems) {
    ctx.beginPath();
    ctx.moveTo(p.x + sx, p.y + sy);
    ctx.quadraticCurveTo(p.x + (sx + ex) / 2, p.y + (sy + ey) / 2 - 3, p.x + ex, p.y + ey);
    ctx.stroke();
  }
  leaves.forEach(([x, y], i) => {
    ctx.fillStyle = i % 2 ? "#6fa65a" : "#88bd68";
    ctx.fillRect(Math.round(p.x + x), Math.round(p.y + y), 9, 6);
    ctx.fillStyle = "#4f8a4a";
    ctx.fillRect(Math.round(p.x + x), Math.round(p.y + y + 4), 9, 2);
  });
}

// Tủ hồ sơ 4 ngăn bằng kim loại: ngăn trên cùng trượt ra khi Giám đốc cất báo cáo,
// trên nóc tủ xếp chồng các tập hồ sơ theo số báo cáo đã lưu.
const FOLDER_COLORS = ["#d9b44a", "#4f7cac", "#c0463a", "#5b8f5a", "#8a5a9e"];
function buildCabinet(L) {
  const body = "#7c8884";
  L.box(0, 0, 28, 22, 2, 0, "#3a4240");
  L.box(0, 0, 28, 22, 56, 2, body, {
    edge: true,
    decals: [0, 1, 2, 3].flatMap(i => {
      const z0 = 4 + i * 13.5;
      return [
        { face: "pv", u0: -12.5, u1: 12.5, z0, z1: z0 + 12, color: "#8d9995" },
        { face: "pv", u0: -4, u1: 4, z0: z0 + 8, z1: z0 + 10.5, color: "#efe9d6" },
        { face: "pv", u0: -3, u1: 3, z0: z0 + 3.5, z1: z0 + 5, color: "#3a4240" },
      ];
    }),
  });
  // Ngăn kéo trên cùng (khi mở) + giấy bên trong
  L.box(0, 17, 24, 12, 11, 45, "#8d9995", {
    visible: () => runtime.cabinetOpen(),
    decals: [
      { face: "top", u0: -10, u1: 10, v0: -5, v1: 5, color: "#5e6a66" },
      { face: "top", u0: -8, u1: 8, v0: -4, v1: 3, color: "#f1f0e8" },
      { face: "pv", u0: -3, u1: 3, z0: 49, z1: 50.5, color: "#3a4240" },
    ],
  });
  FOLDER_COLORS.forEach((color, i) => {
    L.box(i % 2 ? 1.5 : -1, 0, 20, 15, 1.8, 58 + i * 1.9, color, { visible: () => runtime.archiveCount > i });
  });
}

// Thùng rác lưới nhỏ cạnh bàn; cục giấy vo tròn chất dần lên miệng thùng.
function buildTrash(L) {
  L.box(0, 0, 14, 14, 18, 0, "#3f4b47", {
    edge: true,
    decals: [
      { face: "top", u0: -5.5, u1: 5.5, v0: -5.5, v1: 5.5, color: "#1c2422" },
      ...[-4, 0, 4].map(u => ({ face: "pv", u0: u - 0.6, u1: u + 0.6, z0: 2, z1: 16, color: "#566561" })),
      ...[-4, 0, 4].map(u => ({ face: "pu", u0: u - 0.6, u1: u + 0.6, z0: 2, z1: 16, color: "#566561" })),
    ],
  });
  L.custom(0, 0, 14, 14, 18, 26, p => drawPaperBalls(p, runtime.trashCount));
}

const BALL_SPOTS = [[-2, -1], [3, 0], [0, -4], [-4, -3], [2, -6]];
function drawPaperBalls(p, n) {
  const ctx = getContext();
  for (let i = 0; i < Math.min(n, BALL_SPOTS.length); i++) {
    const [dx, dy] = BALL_SPOTS[i];
    drawPaperBall(ctx, p.x + dx, p.y + dy, 3, i * 1.7);
  }
}

// Cục giấy vo tròn (dùng chung cho thùng rác và cục giấy đang bay).
export function drawPaperBall(ctx, x, y, r, spin = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = "#f4f1e6";
  ctx.strokeStyle = "#a9a493";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const rr = r * (k % 2 ? 0.82 : 1.05);
    if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(r * 0.1, r * 0.25); ctx.lineTo(r * 0.5, -r * 0.3);
  ctx.stroke();
  ctx.restore();
}

// Bàn học sinh liền ghế đỏ: mặt bàn phía sau (-v), ghế phía trước (+v) – học viên ngồi quay về -v.
// Ghế tách thành phần riêng ("seat" / "back") để người ngồi được vẽ đúng giữa mặt ghế và lưng ghế.
const STUDENT_RED = "#c2453a";
function buildStudentDesk(L) {
  for (const [u, v] of [[-15, -16], [15, -16], [-15, -4], [15, -4]]) L.box(u, v, 3, 3, 24, 0, C.leg);
  L.box(0, -10, 34, 4, 8, 12, "#7a5f40");
  L.box(0, -10, 36, 18, 3, 24, "#b08f60", { edge: true });
  L.box(-6, -11, 10, 7, 0.8, 27, C.paper);
}
function buildStudentSeat(L) {
  for (const [u, v] of [[-7, 6], [7, 6], [-7, 17], [7, 17]]) L.box(u, v, 2.5, 2.5, 14, 0, "#262c29");
  L.box(0, 11, 18, 14, 3, 14, STUDENT_RED, { edge: true });
}
function buildStudentBack(L) {
  L.box(0, 18.5, 18, 3, 16, 17, shade(STUDENT_RED, -0.15), { edge: true });
}

// Bàn laptop gọn (phòng riêng của giảng viên).
function buildLaptopDesk(L, item) {
  for (const [u, v] of [[-18, -11], [18, -11], [-18, 11], [18, 11]]) L.box(u, v, 3, 3, 28, 0, C.leg);
  L.box(0, 0, 40, 26, 3, 28, "#c2a274", { edge: true });
  L.box(-4, 4, 18, 11, 1, 31, "#9aa3ad"); // bàn phím laptop
  L.box(-4, -2.5, 18, 1.5, 12, 32, "#4a5160", {
    decals: [
      { face: "pv", u0: -8, u1: 8, z0: 33.5, z1: 43, color: () => screenColor(item) },
      ...codeLines(item, -7, 7, 41.8, 1.4),
    ],
  });
  L.box(13, 3, 4, 4, 5, 31, C.mug, { decals: [{ face: "top", u0: -1.5, u1: 1.5, v0: -1.5, v1: 1.5, color: "#5a3a22" }] });
  L.box(13, -7, 8, 10, 3, 31, "#4f7cac");
}

// Bục giảng nhỏ cho giảng viên: mặt trước (+v) quay về phía học viên, giảng viên đứng sau (-v).
function buildPodium(L) {
  L.box(0, 0, 28, 18, 3, 0, "#5a4632");
  L.box(0, 1, 24, 14, 36, 3, "#8a6a45", {
    edge: true,
    decals: [
      { face: "pv", u0: -9, u1: 9, z0: 22, z1: 32, color: "#f3f5ef" },
      { face: "pv", u0: -8, u1: -2, z0: 24, z1: 30, color: "#2a52a8" },
      { face: "pv", u0: -1, u1: 8, z0: 27.5, z1: 29.5, color: "#2a52a8" },
      { face: "pv", u0: -1, u1: 6, z0: 24.5, z1: 26, color: "#c0392b" },
    ],
  });
  L.box(0, -1, 28, 20, 3, 39, "#9c7a52", { edge: true });
  L.box(-5, -2, 12, 9, 1, 42, C.paper);
  L.box(7, -4, 2, 2, 7, 42, "#2a2f3a"); // micro
  L.box(7, -1.5, 2, 4, 1.5, 48, "#2a2f3a");
}

// Tủ lạnh mini.
function buildFridge(L) {
  L.box(0, 0, 26, 24, 2, 0, "#4a5160");
  L.box(0, 0, 26, 24, 44, 2, "#e8edf3", {
    edge: true,
    decals: [
      { face: "pv", u0: -12, u1: 12, z0: 30.5, z1: 31.5, color: "#b9c3d0" },
      { face: "pv", u0: 8, u1: 10, z0: 34, z1: 42, color: "#8a96a8" },
      { face: "pv", u0: 8, u1: 10, z0: 16, z1: 27, color: "#8a96a8" },
      { face: "pv", u0: -9, u1: -4, z0: 36, z1: 40, color: "#f2c94c" }, // nam châm
      { face: "pv", u0: -6, u1: 1, z0: 20, z1: 26, color: "#ffffff" },  // tờ ghi chú
    ],
  });
}

// Kệ thấp có lò vi sóng.
function buildMicrowave(L) {
  L.box(0, 0, 40, 24, 30, 0, "#8a6a45", {
    edge: true,
    decals: [
      { face: "pv", u0: -18, u1: -1, z0: 3, z1: 27, color: "#9c7a52" },
      { face: "pv", u0: 1, u1: 18, z0: 3, z1: 27, color: "#9c7a52" },
      { face: "pv", u0: -3, u1: -2, z0: 13, z1: 18, color: "#d8c9a6" },
      { face: "pv", u0: 2, u1: 3, z0: 13, z1: 18, color: "#d8c9a6" },
    ],
  });
  L.box(-2, -1, 30, 18, 17, 30, "#dfe3ea", {
    edge: true,
    decals: [
      { face: "pv", u0: -13, u1: 5, z0: 33, z1: 44, color: () => (runtime.microwaveOn() ? (runtime.tick % 20 < 10 ? "#ffd27a" : "#f2b84b") : "#2a2f3a") },
      { face: "pv", u0: 8, u1: 13, z0: 40, z1: 44, color: () => (runtime.microwaveOn() ? "#7bff9b" : "#1e2a22") },
      { face: "pv", u0: 9, u1: 12, z0: 34, z1: 38, color: "#9aa3ad" },
    ],
  });
  L.box(14, 3, 6, 6, 8, 30, C.mug);
}

// Thùng các-tông chồng lên nhau trong kho.
function buildBoxes(L, item) {
  let seed = hash(item.id || "boxes");
  const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  const card = "#b98a52";
  L.box(-7, -5, 18, 16, 14, 0, card, { edge: true, decals: [{ face: "top", u0: -1, u1: 1, v0: -8, v1: 8, color: "#d8b27a" }] });
  L.box(8, 4, 16, 18, 16, 0, shade(card, -0.08), { edge: true, decals: [{ face: "top", u0: -8, u1: 8, v0: -1, v1: 1, color: "#d8b27a" }] });
  L.box(-5 + rnd() * 3, -3, 16, 14, 12, 14, shade(card, 0.06), { edge: true, decals: [{ face: "pv", u0: -4, u1: 4, z0: 18, z1: 22, color: "#f1f0e8" }] });
  if (rnd() < 0.7) L.box(7, 4, 12, 12, 10, 16, shade(card, -0.04), { edge: true });
}

// Kệ sắt nhiều tầng chất thùng hàng / hộp hồ sơ.
function buildRack(L, item) {
  let seed = hash(item.id || "rack");
  const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0) % 1000) / 1000;
  for (const [u, v] of [[-28, -9], [28, -9], [-28, 9], [28, 9]]) L.box(u, v, 3, 3, 72, 0, "#59625e");
  for (const z of [4, 26, 48, 70]) L.box(0, 0, 60, 20, 2, z, "#7d8783", { edge: true });
  const colors = ["#b98a52", "#a87c48", "#c99a62", "#6f8fa8", "#d9b44a"];
  for (const z of [6, 28, 50]) {
    let u = -26;
    while (u < 22) {
      const w = 10 + Math.floor(rnd() * 8);
      if (u + w > 27) break;
      if (rnd() < 0.8) L.box(u + w / 2, 0, w - 1, 14, 10 + rnd() * 8, z, colors[Math.floor(rnd() * colors.length)], { edge: true });
      u += w;
    }
  }
}

// Gạt tàn đứng ở khu hút thuốc (có làn khói mảnh bay lên).
function buildAshtray(L) {
  L.box(0, 0, 12, 12, 2, 0, "#3a4240");
  L.box(0, 0, 4, 4, 26, 2, "#7c8884");
  L.box(0, 0, 13, 13, 4, 28, "#9aa3a0", { edge: true, decals: [{ face: "top", u0: -4.5, u1: 4.5, v0: -4.5, v1: 4.5, color: "#3a3f3d" }] });
  L.custom(0, 0, 12, 12, 32, 60, p => {
    const ctx = getContext(), k = runtime.tick * 0.05;
    ctx.strokeStyle = "rgba(220,225,220,0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    for (let i = 1; i <= 8; i++) ctx.lineTo(p.x + Math.sin(k + i * 0.9) * (1 + i * 0.5), p.y - i * 3.2);
    ctx.stroke();
  });
}

// Ghế băng gỗ.
// Ghế băng bọc nệm cùng màu xanh với sofa.
const SOFA_BLUE = "#4d6a85";
function buildBench(L) {
  for (const u of [-24, 24]) L.box(u, 0, 4, 16, 14, 0, C.leg);
  L.box(0, 0, 60, 18, 3, 14, shade(SOFA_BLUE, 0.1), { edge: true });
  L.box(0, -8, 60, 3, 14, 17, SOFA_BLUE, { edge: true });
}

// ---------------------------------------------------------------------------
// Danh mục
// ---------------------------------------------------------------------------
const chairParts = v => ({
  seat: (L, item) => buildChairParts(L, 0, v, 1, item.chairColor || C.chair, "seat"),
  back: (L, item) => buildChairParts(L, 0, v, 1, item.chairColor || C.chair, "back"),
});

// seat: chỗ ngồi (nhân viên / học viên); parts: phần ghế vẽ tách riêng để người ngồi nằm giữa.
// workDesk: bàn gán được cho nhân viên làm "bàn mặc định" / "bàn làm việc".
export const CATALOG = {
  desk: { label: "Bàn làm việc", icon: "🖥️", w: 64, d: 34, h: 58, seat: { u: 0, v: 42 }, workDesk: true, parts: chairParts(42), build: buildDesk },
  laptopDesk: { label: "Bàn laptop", icon: "💻", w: 40, d: 26, h: 44, seat: { u: 0, v: 32 }, workDesk: true, parts: chairParts(32), build: buildLaptopDesk },
  meeting: { label: "Bàn họp", icon: "🗂️", w: 84, d: 52, h: 42, chat: [{ u: -58, v: 0 }, { u: 58, v: 0 }], build: buildMeeting },
  bookshelf: { label: "Kệ sách", icon: "📚", w: 64, d: 22, h: 84, use: { u: 0, v: 34 }, build: buildBookshelf },
  whiteboard: { label: "Bảng trắng", icon: "📋", w: 70, d: 6, h: 72, use: { u: 0, v: 28 }, build: buildWhiteboard },
  printer: { label: "Máy in", icon: "🖨️", w: 44, d: 32, h: 38, use: { u: 0, v: 34 }, build: buildPrinter },
  watercooler: { label: "Cây nước", icon: "🚰", w: 26, d: 26, h: 57, use: { u: 0, v: 28 }, build: buildWatercooler },
  vending: { label: "Máy bán nước", icon: "🥤", w: 46, d: 32, h: 80, use: { u: 0, v: 32 }, build: buildVending },
  sofa: { label: "Sofa", icon: "🛋️", w: 84, d: 34, h: 38, use: { u: 0, v: 36 }, seats: [{ u: -18, v: 4 }, { u: 18, v: 4 }], build: buildSofa },
  plant: { label: "Cây cảnh", icon: "🪴", w: 22, d: 22, h: 52, build: buildPlant },
  cabinet: { label: "Tủ hồ sơ", icon: "🗄️", w: 28, d: 22, h: 68, use: { u: -34, v: 26 }, build: buildCabinet },
  trash: { label: "Thùng rác", icon: "🗑️", w: 14, d: 14, h: 26, build: buildTrash },
  studentDesk: {
    label: "Bàn học", icon: "🪑", w: 36, d: 40, h: 34, seat: { u: 0, v: 11 }, student: true,
    parts: { seat: buildStudentSeat, back: buildStudentBack }, build: buildStudentDesk,
  },
  podium: { label: "Bục giảng", icon: "🎤", w: 28, d: 18, h: 50, use: { u: 0, v: -22 }, build: buildPodium },
  fridge: { label: "Tủ lạnh mini", icon: "🧊", w: 26, d: 24, h: 46, use: { u: 0, v: 27 }, build: buildFridge },
  microwave: { label: "Lò vi sóng", icon: "🍱", w: 40, d: 24, h: 47, use: { u: 0, v: 27 }, build: buildMicrowave },
  boxes: { label: "Thùng hàng", icon: "📦", w: 34, d: 30, h: 30, build: buildBoxes },
  rack: { label: "Kệ kho", icon: "🗄️", w: 60, d: 22, h: 74, build: buildRack },
  ashtray: { label: "Gạt tàn", icon: "🚬", w: 14, d: 14, h: 32, use: { u: 0, v: 20 }, build: buildAshtray },
  bench: { label: "Ghế băng", icon: "🪑", w: 60, d: 20, h: 31, build: buildBench },
  chair: {
    label: "Ghế", icon: "🪑", w: 22, d: 22, h: 36,
    build: L => buildChairParts(L, 0, 0, -1, C.chair, "all"),
  },
};

// Bố cục mặc định tầng 9 – văn phòng do người dùng tự sắp xếp (file gki-van-phong-20261116-1205.json).
// Id cố định để hồ sơ nhân viên mặc định (team.js) trỏ đúng bàn.
export const DEFAULT_LAYOUT = [
  { id: "f-mwinj9qk-n4tty", type: "printer", x: 300, y: 190, rotation: 3 },
  { id: "d-manager", type: "desk", x: 204, y: 95, rotation: 3 },
  { id: "f-mwinj9qk-vni7q", type: "cabinet", x: 256, y: 45, rotation: 0 },
  { id: "f-mwinj9qk-0knt2", type: "trash", x: 266, y: 108, rotation: 0 },
  { id: "podium-big", type: "podium", x: 640, y: 165, rotation: 1 },
  { id: "f-mwinj9qk-wgz2q", type: "studentDesk", x: 460, y: 100, rotation: 1 },
  { id: "f-mwinj9qk-s5t31", type: "studentDesk", x: 460, y: 160, rotation: 1 },
  { id: "f-mwinj9qk-84yt4", type: "studentDesk", x: 455, y: 225, rotation: 1 },
  { id: "f-mwinj9qk-bjvqg", type: "studentDesk", x: 570, y: 225, rotation: 1 },
  { id: "f-mwinj9qk-hjvkm", type: "studentDesk", x: 515, y: 105, rotation: 1 },
  { id: "f-mwinj9qk-dnqsv", type: "studentDesk", x: 515, y: 165, rotation: 1 },
  { id: "f-mwinj9qk-80uk7", type: "studentDesk", x: 515, y: 225, rotation: 1 },
  { id: "f-mwinj9qk-woesb", type: "studentDesk", x: 565, y: 105, rotation: 1 },
  { id: "f-mwinj9qk-mbhvd", type: "studentDesk", x: 570, y: 165, rotation: 1 },
  { id: "f-mwinj9qk-tqb6h", type: "rack", x: 325, y: 45, rotation: 0 },
  { id: "f-mwinj9qk-850k8", type: "boxes", x: 302, y: 95, rotation: 0 },
  { id: "f-mwinj9qk-xbcq5", type: "studentDesk", x: 67, y: 495, rotation: 0 },
  { id: "f-mwinj9qk-16pmm", type: "studentDesk", x: 67, y: 540, rotation: 0 },
  { id: "f-mwinj9qk-8oj55", type: "studentDesk", x: 127, y: 495, rotation: 0 },
  { id: "f-mwinj9qk-qgrny", type: "studentDesk", x: 127, y: 540, rotation: 0 },
  { id: "f-mwinj9qk-vcd7n", type: "bench", x: 44, y: 625, rotation: 3 },
  { id: "f-mwinj9qk-1lag7", type: "ashtray", x: 88, y: 595, rotation: 0 },
  { id: "f-mwinj9qk-3enpi", type: "rack", x: 77, y: 740, rotation: 2 },
  { id: "f-mwinj9qk-hujmy", type: "rack", x: 239, y: 740, rotation: 2 },
  { id: "f-mwinj9qk-c48t8", type: "boxes", x: 142, y: 730, rotation: 0 },
  { id: "f-mwinl9qi-9yqtl", type: "laptopDesk", x: 635, y: 240, rotation: 3 },
  { id: "f-mwinm4s7-4dlcr", type: "laptopDesk", x: 365, y: 175, rotation: 1 },
  { id: "f-mwinm9yi-jy97m", type: "laptopDesk", x: 365, y: 220, rotation: 1 },
  { id: "f-mwinn6gf-945vg", type: "whiteboard", x: 290, y: 260, rotation: 3 },
  { id: "f-mwino0mb-1gjuh", type: "laptopDesk", x: 107, y: 175, rotation: 1 },
  { id: "f-mwino5dh-02ug9", type: "laptopDesk", x: 107, y: 235, rotation: 1 },
  { id: "f-mwinobnc-36mfb", type: "laptopDesk", x: 180, y: 155, rotation: 3 },
  { id: "f-mwinogrn-c5nbr", type: "laptopDesk", x: 180, y: 220, rotation: 3 },
  { id: "f-mwinol43-7rpvp", type: "laptopDesk", x: 180, y: 265, rotation: 3 },
  { id: "f-mwinoqt0-sjwkc", type: "laptopDesk", x: 180, y: 310, rotation: 3 },
  { id: "f-mwinp03n-2bk3z", type: "microwave", x: 48, y: 90, rotation: 3 },
  { id: "f-mwinp6zs-p4svv", type: "fridge", x: 48, y: 125, rotation: 3 },
  { id: "f-mwintibm-nrd32", type: "desk", x: 94, y: 370, rotation: 1 },
];

// ---------------------------------------------------------------------------
// Hình học
// ---------------------------------------------------------------------------
export function footprint(item, at = item) {
  const def = CATALOG[item.type];
  const odd = rot(item) % 2 === 1;
  const W = odd ? def.d : def.w, D = odd ? def.w : def.d;
  return { x0: at.x - W / 2, x1: at.x + W / 2, y0: at.y - D / 2, y1: at.y + D / 2, z0: 0, z1: def.h };
}

// Ghế của bàn (nằm ngoài khung bàn): khung ~18×18 quanh chỗ ngồi.
export function chairBox(item, at = item) {
  const def = CATALOG[item.type];
  if (!def?.seat || def.student) return null;
  const [dx, dy] = toWorld(rot(item), def.seat.u, def.seat.v);
  const x = at.x + dx, y = at.y + dy;
  return { x0: x - 9, x1: x + 9, y0: y - 9, y1: y + 9 };
}

export function fitsInRoom(item, at = item) {
  const b = footprint(item, at);
  if (!rectOnFloor(b) || rectBlocked(b)) return false;
  // Ghế không được lọt vào vách / khung cửa, cũng không được nằm bên kia vách so với bàn (người ngồi sẽ bị "dính tường").
  return !chairBlocked(item, at);
}

export function chairBlocked(item, at = item) {
  const c = chairBox(item, at);
  if (!c) return false;
  const seat = { x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2 };
  return rectHitsWall(c) || segmentHitsWall({ x: at.x, y: at.y }, seat);
}

export function overlapsAny(item, items, at = item, margin = 2) {
  const a = footprint(item, at);
  return items.some(other => {
    if (other === item || other.id === item.id) return false;
    const b = footprint(other);
    return a.x0 < b.x1 + margin && b.x0 < a.x1 + margin && a.y0 < b.y1 + margin && b.y0 < a.y1 + margin;
  });
}

export const seatPoint = item => (CATALOG[item.type].seat ? localPoint(item, CATALOG[item.type].seat.u, CATALOG[item.type].seat.v) : null);
export const usePoint = item => (CATALOG[item.type].use ? localPoint(item, CATALOG[item.type].use.u, CATALOG[item.type].use.v) : null);
export const chatPoints = item => (CATALOG[item.type].chat || []).map(p => localPoint(item, p.u, p.v));
export const sofaSeats = item => (CATALOG[item.type].seats || []).map(p => localPoint(item, p.u, p.v));

// ---------------------------------------------------------------------------
// Bộ đệm khối đã dựng + drawable cho cảnh
// ---------------------------------------------------------------------------
function cached(item, slot, build) {
  const key = `${item.x},${item.y},${rot(item)}`;
  item._cache ??= {};
  const hit = item._cache[slot];
  if (hit && hit.key === key) return hit.prims;
  const { api, prims, r } = makeBuilder(item);
  build(api, item);
  const sorted = isoSort(prims);
  item._cache[slot] = { key, prims: sorted, r };
  return sorted;
}

export function drawItem(item, alpha = 1, withParts = false) {
  const def = CATALOG[item.type];
  const prims = cached(item, "main", def.build);
  const ctx = getContext();
  ctx.save();
  ctx.globalAlpha = alpha;
  drawPrims(prims, rot(item));
  if (withParts && def.parts) for (const part of ["seat", "back"]) drawPrims(cached(item, part, def.parts[part]), rot(item));
  ctx.restore();
}

const primBounds = prims => prims.reduce((b, p) => ({
  x0: Math.min(b.x0, p.bounds.x0), x1: Math.max(b.x1, p.bounds.x1),
  y0: Math.min(b.y0, p.bounds.y0), y1: Math.max(b.y1, p.bounds.y1),
  z0: Math.min(b.z0, p.bounds.z0), z1: Math.max(b.z1, p.bounds.z1),
}), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity });

export function sceneDrawables(items) {
  const out = [];
  for (const item of items) {
    const def = CATALOG[item.type];
    if (!def.parts) { out.push({ item, bounds: footprint(item), layer: 0, draw: () => drawItem(item) }); continue; }
    // Món có ghế tách rời: thân món chỉ chiếm khung của chính nó (không gồm ghế) để người ngồi xếp chiều sâu đúng.
    const main = cached(item, "main", def.build);
    out.push({ item, bounds: primBounds(main), layer: 0, draw: () => drawItem(item) });
    for (const part of ["seat", "back"]) {
      const prims = cached(item, part, def.parts[part]);
      out.push({ item, bounds: primBounds(prims), layer: 0, draw: () => drawPrims(prims, rot(item)) });
    }
  }
  return out;
}

// Chỗ ngồi nào là bàn gán được cho nhân viên.
export const isWorkDesk = item => !!CATALOG[item.type]?.workDesk;

// Chọn món đồ dưới con trỏ: ưu tiên món được vẽ sau cùng (gần người xem nhất).
// Trước tiên thử đúng ô sàn dưới chuột, sau đó mới tới khung bao trên màn hình (đồ cao).
export function pickItem(drawOrder, sx, sy, ground) {
  for (let i = drawOrder.length - 1; i >= 0; i--) {
    const d = drawOrder[i];
    if (!d.item) continue;
    const b = footprint(d.item);
    if (ground.x >= b.x0 && ground.x <= b.x1 && ground.y >= b.y0 && ground.y <= b.y1) return d.item;
  }
  for (let i = drawOrder.length - 1; i >= 0; i--) {
    const d = drawOrder[i];
    if (!d.item) continue;
    const s = screenBounds(footprint(d.item));
    if (sx >= s.minX && sx <= s.maxX && sy >= s.minY && sy <= s.maxY) return d.item;
  }
  return null;
}
