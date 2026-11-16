// Nhân vật pixel-art với 8 hướng nhìn.
// Gốc toạ độ khi vẽ = điểm chân chạm sàn, nên thứ tự chiều sâu khớp với vị trí thật.
//
// Hướng (theo màn hình): S = chính diện, N = sau lưng, E/W = nghiêng hẳn, SE/SW = 3/4 phía trước, NE/NW = 3/4 phía sau.
// Mọi hướng "trái" (W, SW, NW) được vẽ bằng cách lật ngang hướng "phải" tương ứng.

import { getContext, shade } from "./iso.js";
import { drawPaperBall } from "./furniture.js";

export const SCALE = 1.25;
const BODY_Y = -27; // khoảng cách từ chân tới "thắt lưng" của sprite gốc

// ---------------------------------------------------------------------------
// Ngoại hình tuỳ chỉnh được. Bản lưu (look) gọn, dễ sửa trong giao diện; buildLook() đổi sang tham số vẽ.
//   { skin, hair, hairStyle, outfit, jacket, shirt, accent, pants, glasses, beard, headphones, lanyard, earrings }
// ---------------------------------------------------------------------------
export const SKINS = ["#f6d7bd", "#f2cfae", "#e8b98f", "#d7a074", "#c68b5e", "#a86f48", "#8d5a3b", "#6b4228"];
export const HAIRS = ["#1a1a1a", "#3b3836", "#5a3825", "#6b3e22", "#8a5a2b", "#c79a52", "#d8c08a", "#a8a8a8", "#b8433a", "#3a5fb0"];
export const HAIR_STYLES = ["short", "swept", "fade", "bun", "long", "bald"];
export const OUTFITS = ["suit", "blazer", "shirt", "hoodie"];
export const ACCESSORIES = ["glasses", "beard", "headphones", "lanyard", "earrings"];
export const GENDERS = ["male", "female"];
export const BOTTOMS = ["pants", "skirt"];

const pick = list => list[Math.floor(Math.random() * list.length)];

export function randomLook(gender = pick(GENDERS)) {
  const outfit = pick(OUTFITS);
  const female = gender === "female";
  return {
    gender, bottom: female && Math.random() < 0.75 ? "skirt" : "pants", skin: pick(SKINS), hair: pick(HAIRS.slice(0, 8)),
    hairStyle: pick(female ? ["long", "bun", "long", "short"] : ["short", "swept", "fade", "short", "bald"]), outfit,
    jacket: pick(["#2d3a4f", "#7a5c8e", "#2f6f5a", "#b5623b", "#3a5f8f", "#5b6470", "#8a3f4a", "#2f5cbd"]),
    shirt: pick(["#e9edf2", "#efe6d8", "#ffffff", "#dfe9f7", "#f3e1e6"]),
    accent: pick(["#b8433a", "#d9b44a", "#3a6fb0", "#9bd78c", "#c99a1c"]),
    pants: pick(["#232c3b", "#3a3f4a", "#2b2f36", "#4a5160", "#5a4632"]),
    glasses: Math.random() < 0.3, beard: !female && Math.random() < 0.15, headphones: Math.random() < 0.15, lanyard: Math.random() < 0.4,
    earrings: female && Math.random() < 0.5,
  };
}

// Học viên: suit công sở (vest tối màu, sơ mi sáng, cà vạt).
export function studentLook() {
  const jacket = pick(["#1f2a3d", "#2b2f36", "#3a3f4a", "#22324f", "#474c55", "#2a2a30"]);
  const gender = pick(GENDERS), female = gender === "female";
  return {
    gender, bottom: female ? "skirt" : "pants", skin: pick(SKINS), hair: pick(HAIRS.slice(0, 7)), hairStyle: pick(female ? ["long", "bun", "long"] : ["short", "swept", "fade", "short"]), outfit: "suit",
    jacket, shirt: pick(["#ffffff", "#e9f0fa", "#f4f4f0"]), accent: pick(["#b8433a", "#2f5cbd", "#7a5c8e", "#2f6f5a", "#c99a1c", "#5b6470"]),
    pants: shade(jacket, -0.1), glasses: Math.random() < 0.25, beard: false, headphones: false, lanyard: false, earrings: female && Math.random() < 0.4,
  };
}

export function buildLook(look) {
  const k = look || {};
  const outfit = OUTFITS.includes(k.outfit) ? k.outfit : "suit";
  const jacket = k.jacket || "#2d3a4f", shirt = k.shirt || "#e9edf2", accent = k.accent || "#b8433a";
  const O = outfit === "shirt" ? { jacket: shirt, shirt: shade(shirt, 0.1), trim: accent }
    : outfit === "hoodie" ? { jacket, shirt: shade(jacket, -0.22), trim: accent }
      : { jacket, shirt, trim: accent };
  return {
    skin: k.skin || SKINS[2], hair: k.hair || HAIRS[1],
    style: HAIR_STYLES.includes(k.hairStyle) ? k.hairStyle : "short",
    hood: outfit === "hoodie", tie: outfit === "suit", shirtOnly: outfit === "shirt", female: k.gender === "female", skirt: k.bottom === "skirt",
    glasses: !!k.glasses, beard: !!k.beard, headphones: !!k.headphones, lanyard: !!k.lanyard, earrings: !!k.earrings,
    outfit: { ...O, pants: k.pants || "#232c3b" },
  };
}

function lookOf(agent) {
  const key = JSON.stringify(agent.look || null);
  if (agent._lookKey !== key) { agent._lookKey = key; agent._L = buildLook(agent.look); }
  return agent._L;
}

const VIEWS = {
  S: ["front", false], SE: ["front34", false], SW: ["front34", true],
  E: ["side", false], W: ["side", true],
  NE: ["back34", false], NW: ["back34", true], N: ["back", false],
};
export const isBackView = facing => facing === "N" || facing === "NE" || facing === "NW";

const R = (ctx, color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };

// Một đoạn tay xoay quanh vai – dùng cho góc nghiêng, nơi tay vung trước/sau.
function swingArm(ctx, sx, sy, angle, sleeve, skin, length = 12) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  R(ctx, sleeve, -2, 0, 4, length);
  R(ctx, skin, -2, length - 1, 4, 4);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Đầu
// ---------------------------------------------------------------------------
const hasHair = L => !L.hood && L.style !== "bald";
// Tóc cạo cao hai bên (fade): hai bên + gáy chỉ còn lớp chân tóc mờ, đỉnh đầu giữ một mảng tóc ngắn.
const isFade = L => !L.hood && L.style === "fade";
function mixHex(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
const buzz = L => mixHex(L.skin, L.hair, 0.42);
const HP = "#2a2f3a"; // tai nghe

function headFront(ctx, L, s) {
  const { x, y } = s;
  if (L.hood) { R(ctx, shade(L.outfit.jacket, -0.25), x - 13, y - 33, 26, 25); R(ctx, L.outfit.jacket, x - 11, y - 31, 22, 21); }
  if (L.style === "bun" && !L.hood) R(ctx, L.hair, x - 4, y - 42, 8, 7);
  if (L.style === "long" && !L.hood) { R(ctx, L.hair, x - 12, y - 31, 4, 18); R(ctx, L.hair, x + 8, y - 31, 4, 18); }
  R(ctx, s.faceShadow, x - 9, y - 31, 18, L.female ? 17 : 20); // nữ: không có bóng hàm dưới cằm (trông như râu)
  R(ctx, L.skin, x - 8, y - 32, 16, 18);
  R(ctx, s.faceLight, x - 6, y - 30, 10, 12);
  R(ctx, L.skin, x - 12, y - 26, 4, 7); R(ctx, L.skin, x + 8, y - 26, 4, 7);
  R(ctx, s.faceShadow, x - 11, y - 25, 2, 4); R(ctx, s.faceShadow, x + 9, y - 25, 2, 4);
  hairTop(ctx, L, x, y, 0);
  if (!s.blink) {
    R(ctx, "#2a1d16", x - 5, y - 25, 3, 2); R(ctx, "#2a1d16", x + 2, y - 25, 3, 2);
  } else R(ctx, "#2a1d16", x - 6, y - 25, 12, 1);
  R(ctx, "#2a1d16", x - 5, y - 27, 4, 1); R(ctx, "#2a1d16", x + 1, y - 27, 4, 1);
  R(ctx, s.faceShadow, x, y - 23, 2, 4);
  mouth(ctx, L, s, x - 3, 6);
  if (L.female && !s.blink) { R(ctx, "#2a1d16", x - 6, y - 26, 1, 1); R(ctx, "#2a1d16", x + 5, y - 26, 1, 1); }
  if (L.female) { R(ctx, "rgba(232, 118, 128, .45)", x - 7, y - 22, 3, 2); R(ctx, "rgba(232, 118, 128, .45)", x + 4, y - 22, 3, 2); }
  if (L.beard) { R(ctx, L.hair, x - 7, y - 19, 14, 5); R(ctx, L.hair, x - 5, y - 14, 10, 3); mouth(ctx, L, s, x - 2, 5); }
  if (L.glasses && !s.blink) {
    ctx.strokeStyle = "#1b1f1d"; ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 7, y - 27, 6, 5); ctx.strokeRect(x + 1, y - 27, 6, 5);
    R(ctx, "#1b1f1d", x - 1, y - 25, 2, 1);
  }
  if (L.earrings && !L.hood) { R(ctx, "#e8c25a", x - 11, y - 19, 2, 2); R(ctx, "#e8c25a", x + 9, y - 19, 2, 2); }
  if (L.headphones) { R(ctx, HP, x - 11, y - 38, 22, 2); R(ctx, HP, x - 13, y - 29, 4, 8); R(ctx, HP, x + 9, y - 29, 4, 8); }
}

function headFront34(ctx, L, s) {
  const { x, y } = s;
  if (L.hood) { R(ctx, shade(L.outfit.jacket, -0.25), x - 13, y - 33, 25, 25); R(ctx, L.outfit.jacket, x - 12, y - 31, 21, 21); }
  if (L.style === "bun" && !L.hood) R(ctx, L.hair, x - 7, y - 42, 8, 7);
  if (L.style === "long" && !L.hood) R(ctx, L.hair, x - 11, y - 31, 5, 19);
  R(ctx, s.faceShadow, x - 8, y - 31, 17, L.female ? 17 : 20);
  R(ctx, L.skin, x - 7, y - 32, 15, 18);
  R(ctx, s.faceLight, x - 2, y - 30, 9, 12);
  R(ctx, L.skin, x + 8, y - 24, 2, 3); // mũi nhô ra
  R(ctx, L.skin, x - 11, y - 26, 4, 7); R(ctx, s.faceShadow, x - 10, y - 25, 2, 4); // tai gần
  hairTop(ctx, L, x, y, 1);
  if (hasHair(L)) R(ctx, isFade(L) ? buzz(L) : L.hair, x - 9, y - 31, 4, L.female ? 4 : L.style === "bun" ? 10 : 7);
  if (L.female) R(ctx, "rgba(232, 118, 128, .45)", x + 4, y - 22, 3, 2);
  if (!s.blink) { R(ctx, "#2a1d16", x - 1, y - 25, 3, 2); R(ctx, "#2a1d16", x + 5, y - 25, 2, 2); }
  else R(ctx, "#2a1d16", x - 1, y - 25, 9, 1);
  R(ctx, "#2a1d16", x - 1, y - 27, 4, 1); R(ctx, "#2a1d16", x + 5, y - 27, 3, 1);
  R(ctx, s.faceShadow, x + 4, y - 23, 2, 4);
  mouth(ctx, L, s, x + 1, 5);
  if (L.female && !s.blink) R(ctx, "#2a1d16", x + 7, y - 26, 1, 1);
  if (L.beard) { R(ctx, L.hair, x - 5, y - 19, 13, 5); R(ctx, L.hair, x - 3, y - 14, 10, 3); mouth(ctx, L, s, x + 1, 5); }
  if (L.glasses && !s.blink) {
    ctx.strokeStyle = "#1b1f1d"; ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 2, y - 27, 6, 5); ctx.strokeRect(x + 4, y - 27, 5, 5);
    R(ctx, "#1b1f1d", x - 8, y - 26, 6, 1);
  }
  if (L.earrings && !L.hood) R(ctx, "#e8c25a", x - 10, y - 19, 2, 2);
  if (L.headphones) { R(ctx, HP, x - 9, y - 38, 17, 2); R(ctx, HP, x - 12, y - 29, 4, 8); }
}

function headSide(ctx, L, s) {
  const { x, y } = s;
  if (L.hood) { R(ctx, shade(L.outfit.jacket, -0.25), x - 11, y - 33, 21, 25); R(ctx, L.outfit.jacket, x - 10, y - 31, 18, 21); }
  if (L.style === "bun" && !L.hood) R(ctx, L.hair, x - 12, y - 39, 7, 7);
  if (L.style === "long" && !L.hood) R(ctx, L.hair, x - 9, y - 31, 7, 19);
  R(ctx, s.faceShadow, x - 6, y - 31, 14, L.female ? 17 : 20);
  R(ctx, L.skin, x - 5, y - 32, 13, 18);
  R(ctx, s.faceLight, x + 1, y - 30, 6, 11);
  R(ctx, L.skin, x + 8, y - 25, 2, 3); R(ctx, s.faceShadow, x + 8, y - 22, 1, 1); // mũi
  R(ctx, L.skin, x - 3, y - 26, 4, 6); R(ctx, s.faceShadow, x - 2, y - 25, 2, 4); // tai
  if (isFade(L)) {
    R(ctx, buzz(L), x - 7, y - 35, 15, 6);
    R(ctx, buzz(L), x - 7, y - 31, 4, 7);
    R(ctx, mixHex(L.skin, L.hair, 0.72), x - 6, y - 37, 13, 2);
    R(ctx, L.hair, x - 5, y - 39, 12, 3);
    R(ctx, L.hair, x - 4, y - 40, 10, 1);
    R(ctx, shade(L.hair, 0.3), x - 3, y - 38, 5, 1);
  } else if (hasHair(L)) {
    R(ctx, L.hair, x - 7, y - 36, 15, 6);
    R(ctx, L.hair, x - 5, y - 38, 11, 3);
    R(ctx, L.hair, x - 7, y - 31, 4, L.style === "bun" ? 11 : 8);
    if (L.style === "swept") R(ctx, L.hair, x + 3, y - 31, 5, 2);
    R(ctx, shade(L.hair, 0.3), x - 3, y - 37, 4, 1);
  } else if (!L.hood) {
    R(ctx, shade(L.skin, 0.08), x - 6, y - 35, 13, 4); // đầu trọc
    R(ctx, L.hair, x - 7, y - 29, 3, 5);
  }
  if (!s.blink) R(ctx, "#2a1d16", x + 4, y - 25, 2, 2); else R(ctx, "#2a1d16", x + 3, y - 25, 3, 1);
  R(ctx, "#2a1d16", x + 3, y - 27, 4, 1);
  mouth(ctx, L, s, x + 4, 3);
  if (L.female && !s.blink) R(ctx, "#2a1d16", x + 6, y - 26, 1, 1);
  if (L.female) R(ctx, "rgba(232, 118, 128, .45)", x + 3, y - 22, 3, 2);
  if (L.beard) { R(ctx, L.hair, x - 1, y - 20, 9, 6); R(ctx, L.hair, x + 1, y - 15, 6, 3); mouth(ctx, L, s, x + 5, 3); }
  if (L.glasses && !s.blink) {
    ctx.strokeStyle = "#1b1f1d"; ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 2, y - 27, 6, 5);
    R(ctx, "#1b1f1d", x - 2, y - 26, 4, 1);
  }
  if (L.earrings && !L.hood) R(ctx, "#e8c25a", x - 2, y - 20, 2, 2);
  if (L.headphones) { R(ctx, HP, x - 3, y - 39, 6, 3); R(ctx, HP, x - 4, y - 29, 6, 8); }
}

function headBack34(ctx, L, s) {
  const { x, y } = s;
  if (L.hood) {
    R(ctx, shade(L.outfit.jacket, -0.25), x - 13, y - 33, 25, 25); R(ctx, L.outfit.jacket, x - 12, y - 31, 22, 21);
    R(ctx, L.skin, x + 6, y - 27, 3, 8);
    if (L.headphones) R(ctx, HP, x - 8, y - 36, 16, 2);
    return;
  }
  const H = isFade(L) ? buzz(L) : hasHair(L) ? L.hair : shade(L.skin, 0.05);
  R(ctx, s.faceShadow, x - 8, y - 31, 17, 20);
  R(ctx, L.skin, x + 3, y - 30, 6, 14); // má phía xa
  R(ctx, L.skin, x + 2, y - 26, 4, 6); R(ctx, s.faceShadow, x + 3, y - 25, 2, 4); // tai
  R(ctx, H, x - 9, y - 36, 17, 6);
  R(ctx, H, x - 7, y - 38, 13, 3);
  R(ctx, H, x - 9, y - 31, 11, 15);
  if (L.style === "long") R(ctx, L.hair, x - 10, y - 31, 13, 21);
  if (isFade(L)) { R(ctx, mixHex(L.skin, L.hair, 0.72), x - 8, y - 36, 15, 2); R(ctx, L.hair, x - 7, y - 39, 13, 3); R(ctx, L.hair, x - 6, y - 40, 11, 1); }
  else if (hasHair(L)) R(ctx, shade(L.hair, 0.18), x - 6, y - 33, 9, 2);
  else R(ctx, L.hair, x - 9, y - 27, 11, 4);
  if (L.style === "bun") R(ctx, L.hair, x - 5, y - 42, 8, 7);
  if (L.beard) R(ctx, L.hair, x + 5, y - 19, 4, 5);
  if (L.glasses) R(ctx, "#1b1f1d", x + 5, y - 26, 4, 1);
  if (L.headphones) { R(ctx, HP, x - 8, y - 38, 16, 2); R(ctx, HP, x + 2, y - 29, 4, 8); }
}

function headBack(ctx, L, s) {
  const { x, y } = s;
  if (L.hood) {
    R(ctx, shade(L.outfit.jacket, -0.25), x - 13, y - 33, 26, 25); R(ctx, L.outfit.jacket, x - 11, y - 31, 22, 21);
    if (L.headphones) R(ctx, HP, x - 11, y - 36, 22, 2);
    return;
  }
  const H = isFade(L) ? buzz(L) : hasHair(L) ? L.hair : shade(L.skin, 0.05);
  R(ctx, s.faceShadow, x - 9, y - 31, 18, 20);
  R(ctx, H, x - 8, y - 33, 16, 18);
  R(ctx, H, x - 10, y - 29, 4, 12); R(ctx, H, x + 6, y - 29, 4, 12);
  R(ctx, H, x - 9, y - 36, 18, 6);
  if (L.style === "long") R(ctx, L.hair, x - 11, y - 31, 22, 22);
  if (isFade(L)) { R(ctx, mixHex(L.skin, L.hair, 0.72), x - 8, y - 36, 16, 2); R(ctx, L.hair, x - 7, y - 39, 14, 3); R(ctx, L.hair, x - 6, y - 40, 12, 1); }
  else if (hasHair(L)) R(ctx, shade(L.hair, 0.18), x - 6, y - 34, 12, 3);
  else R(ctx, L.hair, x - 9, y - 27, 18, 4);
  R(ctx, s.faceShadow, x - 11, y - 25, 2, 4); R(ctx, s.faceShadow, x + 9, y - 25, 2, 4);
  if (L.style === "bun") R(ctx, L.hair, x - 4, y - 42, 8, 7);
  if (L.headphones) { R(ctx, HP, x - 11, y - 38, 22, 2); R(ctx, HP, x - 13, y - 29, 4, 8); R(ctx, HP, x + 9, y - 29, 4, 8); }
}

function hairTop(ctx, L, x, y, shift) {
  if (L.hood) return;
  if (L.style === "bald") {
    R(ctx, shade(L.skin, 0.08), x - 8 + shift, y - 35, 16, 4);
    R(ctx, L.hair, x - 9 + shift, y - 30, 2, 4); if (!shift) R(ctx, L.hair, x + 7, y - 30, 2, 4);
    return;
  }
  if (L.style === "fade") {
    R(ctx, buzz(L), x - 9 + shift, y - 34, 18, 4);                   // hai bên cạo sát
    R(ctx, mixHex(L.skin, L.hair, 0.72), x - 8 + shift, y - 36, 16, 2); // chuyển màu (fade)
    R(ctx, L.hair, x - 7 + shift, y - 39, 14, 4);                    // mảng tóc trên đỉnh
    R(ctx, L.hair, x - 6 + shift, y - 40, 12, 1);
    R(ctx, shade(L.hair, 0.3), x - 4 + shift, y - 39, 5, 1);
    return;
  }
  if (L.style === "bun") {
    R(ctx, L.hair, x - 10 + shift, y - 36, 20, 7);
    if (!shift) { R(ctx, L.hair, x - 10, y - 30, 3, 8); R(ctx, L.hair, x + 7, y - 30, 3, 8); }
  } else {
    R(ctx, L.hair, x - 9 + shift, y - 36, 18, 6);
    R(ctx, L.hair, x - 7 + shift, y - 38, 14, 3);
    if (L.style === "swept") R(ctx, L.hair, x + 1 + shift, y - 31, 8, 3);
  }
  R(ctx, shade(L.hair, 0.3), x - 5 + shift, y - 37, 4, 1);
}

function mouth(ctx, L, s, mx, w) {
  const talking = s.talking && s.tick % 24 < 12;
  R(ctx, L.female ? "#b94a55" : "#7a3f33", mx, s.y - 17, talking ? w + 1 : w, talking ? 3 : L.female ? 2 : 1);
}

// ---------------------------------------------------------------------------
// Thân
// ---------------------------------------------------------------------------
function legs(ctx, L, s) {
  const { x, y, step, view } = s;
  const shoe = "#1a1d1c";
  // Mặc váy: phần chân lộ ra là tất màu da; quần thì cả ống chân là màu quần.
  const P = L.skirt ? shade(L.skin, -0.12) : L.outfit.pants;
  ctx.globalAlpha = 1 - s.seat;
  if (view === "side") {
    const far = -step * 1.3, near = step * 1.3;
    R(ctx, shade(P, -0.25), x - 2 + far, y + 10, 4, 13); R(ctx, shoe, x - 3 + far, y + 21, 7, 4);
    R(ctx, P, x - 2 + near, y + 10, 4, 13); R(ctx, shoe, x - 3 + near, y + 21, 7, 4);
  } else if (view === "front34" || view === "back34") {
    const k = view === "front34" ? 1 : -1;
    R(ctx, shade(P, -0.15), x + 1 - step * 0.6 * k, y + 10 - step * 0.4, 5, 13);
    R(ctx, shoe, x + 1 - step * 0.6 * k, y + 21 - step * 0.4, 6, 4);
    R(ctx, P, x - 5 + step * 0.6 * k, y + 10 + step * 0.4, 5, 13);
    R(ctx, shoe, x - 5 + step * 0.6 * k, y + 21 + step * 0.4, 6, 4);
  } else {
    R(ctx, P, x - 6, y + 10 + step, 5, 13); R(ctx, P, x + 1, y + 10 - step, 5, 13);
    R(ctx, shoe, x - 7, y + 21 + step, 7, 4); R(ctx, shoe, x + 1, y + 21 - step, 7, 4);
  }
  // Váy chữ A: phủ lên phần trên của chân (đứng / đi).
  const SK = L.outfit.pants;
  if (L.skirt) {
    if (view === "side") { R(ctx, SK, x - 5, y + 9, 10, 4); R(ctx, SK, x - 6, y + 13, 12, 5); R(ctx, shade(SK, -0.2), x - 6, y + 17, 12, 1); }
    else if (view === "front34" || view === "back34") { R(ctx, SK, x - 7, y + 9, 14, 4); R(ctx, SK, x - 8, y + 13, 16, 5); R(ctx, shade(SK, -0.2), x + 4, y + 9, 3, 9); }
    else { R(ctx, SK, x - 8, y + 9, 16, 4); R(ctx, SK, x - 9, y + 13, 18, 5); R(ctx, shade(SK, -0.2), x - 9, y + 17, 18, 1); }
  }
  // Ngồi: chân bị thân/ghế che khi quay lưng.
  ctx.globalAlpha = s.seat;
  const T = L.skirt ? SK : P; // đùi: váy hoặc quần
  if (view === "front") {
    R(ctx, T, x - 9, y + 8, 9, 4); R(ctx, T, x, y + 8, 9, 4);
    R(ctx, P, x - 10, y + 11, 10, 4); R(ctx, P, x + 1, y + 11, 10, 4);
    if (L.skirt) R(ctx, SK, x - 10, y + 10, 21, 2);
    R(ctx, shoe, x - 11, y + 13, 8, 4); R(ctx, shoe, x + 3, y + 13, 8, 4);
  } else if (view === "front34") {
    R(ctx, T, x - 6, y + 8, 11, 4); R(ctx, P, x, y + 10, 11, 4);
    if (L.skirt) R(ctx, SK, x - 6, y + 9, 14, 3);
    R(ctx, shoe, x + 4, y + 12, 7, 4); R(ctx, shoe, x + 9, y + 14, 7, 4);
  } else if (view === "side") {
    R(ctx, T, x - 3, y + 8, 13, 5); R(ctx, P, x + 7, y + 10, 4, 8); R(ctx, shoe, x + 7, y + 16, 7, 3);
  }
  ctx.globalAlpha = 1;
}

function torso(ctx, L, s) {
  const { x, y, view } = s;
  const O = L.outfit;
  const h = 20 - Math.round(s.seat * 4);
  const F = L.female;
  if (view === "side") {
    R(ctx, O.jacket, x - 5, y - 8, F ? 10 : 11, h);
    R(ctx, shade(O.jacket, -0.2), x - 5, y - 8, 2, h);
    R(ctx, O.shirt, x + 4, y - 7, 2, 9);
    return;
  }
  if (view === "front34" || view === "back34") {
    if (F) { R(ctx, O.jacket, x - 7, y - 8, 15, 9); R(ctx, O.jacket, x - 6, y + 1, 13, h - 9); }
    else R(ctx, O.jacket, x - 8, y - 8, 16, h);
    R(ctx, shade(O.jacket, -0.2), x + 5, y - 8, F ? 2 : 3, h);
    if (view === "front34") {
      R(ctx, O.shirt, x - 1, y - 7, 6, 15 - Math.round(s.seat * 3));
      if (L.tie) { R(ctx, O.trim, x + 1, y - 6, 2, 9); R(ctx, O.trim, x, y + 2, 4, 2); }
      else if (L.hood) { R(ctx, O.trim, x + 1, y - 6, 1, 6); R(ctx, O.trim, x + 4, y - 6, 1, 6); }
      else if (L.shirtOnly) { R(ctx, shade(O.jacket, -0.15), x + 2, y - 6, 1, 13); R(ctx, shade(O.jacket, 0.18), x - 1, y - 8, 7, 2); }
      else R(ctx, O.trim, x - 3, y - 6, 2, 13);
      if (L.lanyard) { R(ctx, "#3f8fd8", x, y - 8, 1, 7); R(ctx, "#3f8fd8", x + 5, y - 8, 1, 7); R(ctx, "#f4f6fa", x + 1, y - 1, 5, 6); R(ctx, "#3f8fd8", x + 1, y - 1, 5, 1); }
    } else R(ctx, shade(O.jacket, -0.15), x, y - 6, 2, 14);
    return;
  }
  if (F) { R(ctx, O.jacket, x - 8, y - 8, 16, 9); R(ctx, O.jacket, x - 7, y + 1, 14, h - 9); }
  else R(ctx, O.jacket, x - 9, y - 8, 18, h);
  if (view === "back") { R(ctx, shade(O.jacket, -0.15), x - 1, y - 6, 2, 14); return; }
  R(ctx, O.shirt, x - 4, y - 7, 8, 15 - Math.round(s.seat * 3));
  if (L.tie) { R(ctx, O.trim, x - 1, y - 6, 2, 9); R(ctx, O.trim, x - 2, y + 2, 4, 2); }
  else if (L.hood) { R(ctx, O.trim, x - 3, y - 6, 1, 6); R(ctx, O.trim, x + 2, y - 6, 1, 6); }
  else if (L.shirtOnly) { R(ctx, shade(O.jacket, -0.15), x - 1, y - 6, 1, 13); R(ctx, shade(O.jacket, 0.18), x - 5, y - 8, 10, 2); }
  else { R(ctx, O.trim, x - 8, y - 6, 2, 13); R(ctx, O.trim, x + 6, y - 6, 2, 13); }
  if (L.lanyard) { R(ctx, "#3f8fd8", x - 4, y - 8, 1, 7); R(ctx, "#3f8fd8", x + 3, y - 8, 1, 7); R(ctx, "#f4f6fa", x - 2, y - 1, 5, 6); R(ctx, "#3f8fd8", x - 2, y - 1, 5, 1); }
}

// Tay phía xa: vẽ trước thân (bị thân che một phần).
function farArm(ctx, L, s) {
  const { x, y, view, arm } = s;
  const sleeve = shade(L.outfit.jacket, -0.25), skin = shade(L.skin, -0.2);
  ctx.globalAlpha = 1 - s.seat;
  if (view === "side") swingArm(ctx, x, y - 6, arm * 0.09, sleeve, skin);
  else if (view === "front34" || view === "back34") { R(ctx, sleeve, x + 6, y - 6 - arm * 0.6, 4, 11); R(ctx, skin, x + 6, y + 4 - arm * 0.6, 4, 4); }
  ctx.globalAlpha = 1;
}

// Vo giấy: hai tay ôm tờ giấy trước ngực, bóp dần thành cục tròn.
const CRUMPLE_SECONDS = 1.3;
function crumpleArms(ctx, L, s) {
  const { x, y, view, holdT, tick } = s;
  const sleeve = L.outfit.jacket, skin = L.skin;
  const k = Math.min(1, holdT / CRUMPLE_SECONDS);
  const sq = Math.abs(Math.sin(holdT * 13)) * 1.6 + k * 2; // tay bóp vào – nhả ra
  const cx = view === "front34" ? x + 1 : x;
  // Bắp tay
  R(ctx, sleeve, x - 12, y - 6, 4, 8);
  R(ctx, sleeve, view === "front34" ? x + 5 : x + 8, y - 6, 4, 8);
  // Tờ giấy -> cục giấy
  if (k < 0.75) {
    const w = 11 - k * 7, h = 12 - k * 7;
    const jx = Math.sin(tick * 0.9) * k, jy = Math.cos(tick * 1.1) * k;
    ctx.save();
    ctx.translate(cx + jx, y + 1 + jy);
    ctx.rotate(Math.sin(holdT * 9) * 0.25 * k);
    R(ctx, "#f7f7f0", -w / 2, -h / 2, w, h);
    R(ctx, "#c9c6b8", -w / 2, -h / 2 + h * 0.35, w, 1);
    R(ctx, "#c9c6b8", -w / 2 + w * 0.3, -h / 2, 1, h);
    if (k > 0.3) { R(ctx, "#b7b3a3", -w / 2 + 1, -h / 2 + 1, w * 0.4, 1); R(ctx, "#b7b3a3", 0, h * 0.2, w * 0.4, 1); }
    ctx.restore();
  } else {
    drawPaperBall(ctx, cx, y + 1, 4.4 - (k - 0.75) * 2, tick * 0.3);
  }
  // Cẳng tay + bàn tay khép vào giữa
  R(ctx, sleeve, x - 11 + sq, y + 1, 6, 3); R(ctx, skin, cx - 7 + sq, y - 1, 3, 5);
  R(ctx, sleeve, x + 5 - sq, y + 1, 6, 3); R(ctx, skin, cx + 4 - sq, y - 1, 3, 5);
}

// Cầm cục giấy / ném: một tay xoay quanh vai. "ball" = lấy đà ra sau, "throw" = vung tới trước.
function throwAngle(s) {
  if (s.holding === "ball") return -0.5 + Math.min(1, s.holdT / 0.3) * 3.1; // tay giơ dần ra sau đầu
  const k = Math.min(1, s.holdT / 0.14);
  return 2.6 - k * 4.0; // vung mạnh ra trước
}
function throwPivot(s) {
  const { x, y, view } = s;
  if (view === "side") return [x, y - 6];
  if (view === "front") return [x + 10, y - 5];
  return [x - 9, y - 5];
}

function nearArms(ctx, L, s) {
  const { x, y, view, arm, typing } = s;
  const sleeve = L.outfit.jacket, skin = L.skin;
  const waving = s.holding === "wave" && (view === "front" || view === "front34");
  const standing = s.seat < 0.5;
  if (standing && s.holding === "crumple" && (view === "front" || view === "front34")) {
    crumpleArms(ctx, L, s);
    return;
  }
  const throwing = standing && (s.holding === "ball" || s.holding === "throw");
  // Đứng / đi
  ctx.globalAlpha = 1 - s.seat;
  if (view === "side") { if (!throwing) swingArm(ctx, x, y - 6, -arm * 0.09, sleeve, skin); }
  else if (view === "front34" || view === "back34") { if (!throwing) { R(ctx, sleeve, x - 11, y - 6 + arm * 0.6, 4, 12); R(ctx, skin, x - 11, y + 5 + arm * 0.6, 4, 4); } }
  else {
    R(ctx, sleeve, x - 12, y - 6 + arm, 4, 12); R(ctx, skin, x - 12, y + 5 + arm, 4, 4);
    if (!waving && !throwing) { R(ctx, sleeve, x + 8, y - 6 - arm, 4, 12); R(ctx, skin, x + 8, y + 5 - arm, 4, 4); }
  }
  if (waving) swingArm(ctx, x + 9, y - 5, Math.PI - 0.5 + Math.sin(s.tick * 0.25) * 0.35, sleeve, skin, 11);
  if (throwing) {
    const a = throwAngle(s);
    // Mặt "trước" của nhân vật quay về +x trong sprite (hướng trái được lật ngang), nên góc dương = ra sau lưng.
    const [px, py] = throwPivot(s);
    const sign = view === "front" ? -1 : 1;
    swingArm(ctx, px, py, a * sign, sleeve, skin, 11);
    if (s.holding === "ball") {
      const hx = px - Math.sin(a * sign) * 13, hy = py + Math.cos(a * sign) * 13;
      drawPaperBall(ctx, hx, hy, 3.6, s.tick * 0.2);
    }
  }
  // Ngồi gõ phím
  ctx.globalAlpha = s.seat;
  if (view === "front") {
    R(ctx, sleeve, x - 12, y - 6, 4, 8); R(ctx, sleeve, x + 8, y - 6, 4, 8);
    R(ctx, sleeve, x - 9, y - 1 + typing, 8, 3); R(ctx, sleeve, x + 1, y - 1 - typing, 8, 3);
    R(ctx, skin, x - 3, y - 1 + typing, 3, 3); R(ctx, skin, x + 1, y - 1 - typing, 3, 3);
  } else if (view === "front34") {
    R(ctx, sleeve, x - 11, y - 6, 4, 8);
    R(ctx, sleeve, x - 8, y - 1 + typing, 10, 3); R(ctx, skin, x + 2, y - 1 + typing, 3, 3);
    R(ctx, sleeve, x + 2, y - 2 - typing, 8, 3); R(ctx, skin, x + 9, y - 2 - typing, 3, 3);
  } else if (view === "side") {
    R(ctx, sleeve, x - 1, y - 6, 4, 8); R(ctx, sleeve, x + 1, y + typing, 10, 3); R(ctx, skin, x + 10, y - 1 + typing, 3, 3);
  } else {
    R(ctx, sleeve, x - 12, y - 6, 4, 8); R(ctx, sleeve, x - 12, y + 1 + typing, 4, 3);
    if (view === "back") { R(ctx, sleeve, x + 8, y - 6, 4, 8); R(ctx, sleeve, x + 8, y + 1 - typing, 4, 3); }
  }
  ctx.globalAlpha = 1;
}

function heldItem(ctx, s) {
  const { x, y, view, holding, tick } = s;
  if (!holding || holding === "wave" || view === "back" || view === "back34") return;
  if (holding === "crumple" || holding === "ball" || holding === "throw") return; // vẽ trong nearArms
  const hx = view === "side" ? x + 6 : view === "front34" ? x + 7 : x + 9;
  if (holding === "cup") {
    const sip = Math.sin(tick * 0.09) > 0.82 ? -5 : 0;
    R(ctx, "#e9e4d8", hx, y - 1 + sip, 6, 7); R(ctx, "#5a3a22", hx + 1, y - 1 + sip, 4, 1);
  } else if (holding === "paper") {
    R(ctx, "#f7f7f0", hx - 1, y - 2, 9, 11);
    R(ctx, "#4fbf7f", hx + 1, y + 4, 5, 1); R(ctx, "#9aa3a0", hx + 1, y + 1, 5, 1); R(ctx, "#d5463a", hx + 1, y + 6, 3, 1);
  } else if (holding === "book") {
    R(ctx, "#4f7cac", view === "side" ? x + 3 : x - 6, y - 4, view === "side" ? 8 : 12, 9);
    R(ctx, "#f1f0e8", view === "side" ? x + 4 : x - 5, y - 3, view === "side" ? 6 : 10, 1);
  } else if (holding === "cig") {
    // Thỉnh thoảng đưa lên miệng rít một hơi.
    const puff = Math.sin(tick * 0.035) > 0.75;
    const cx = puff ? (view === "side" ? x + 6 : x + 3) : hx, cy = puff ? y - 17 : y + 1;
    R(ctx, "#f4f4f0", cx, cy, 5, 1);
    R(ctx, "#d9a25a", cx, cy, 1, 1);
    R(ctx, tick % 20 < 10 ? "#ff6a3a" : "#e0473a", cx + 5, cy, 1, 1);
    ctx.save();
    ctx.globalAlpha = 0.45;
    for (let i = 1; i <= 5; i++) R(ctx, "#e4e8ee", cx + 5 + Math.round(Math.sin(tick * 0.08 + i) * 1.5), cy - i * 3, 1, 2);
    ctx.restore();
  }
}

const HEADS = { front: headFront, front34: headFront34, side: headSide, back34: headBack34, back: headBack };

export function drawAgent(agent, p, tick) {
  const ctx = getContext();
  const L = lookOf(agent);
  const [view, flip] = VIEWS[agent.facing] || VIEWS.S;
  const moving = agent.moving;
  const step = moving ? Math.sin(tick * 0.22) * 3 : 0;
  const working = agent.working;
  const arm = moving ? step * 0.9
    : agent.talking ? Math.sin(tick * 0.16) * 3.5
      : working ? Math.abs(Math.sin(tick * 0.4)) * 2 : Math.sin(tick * 0.08) * 1.2;

  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y));
  // Bóng dưới chân: nhạt đi khi ngồi ghế, tắt hẳn khi ngồi sofa (người đã ở trên đệm, không đứng trên sàn).
  ctx.fillStyle = `rgba(0,0,0,${0.38 * (1 - agent.seatBlend * (agent.sofaSeat ? 1 : 0.5))})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(flip ? -SCALE : SCALE, SCALE);

  const s = {
    x: 0,
    y: BODY_Y + (moving ? -Math.abs(Math.sin(tick * 0.22)) : Math.sin(tick * 0.04) * 0.5) + agent.seatBlend * 5 - agent.lift / SCALE,
    view, step, arm, tick, seat: agent.seatBlend, holding: agent.holding, talking: agent.talking,
    holdT: (tick - (agent.holdStart ?? tick)) / 60,
    typing: working ? Math.abs(Math.sin(tick * 0.35)) * 1.5 : Math.sin(tick * 0.07) * 0.5,
    blink: (tick + Math.round(agent.animationSeed)) % 280 > 273,
    faceShadow: shade(L.skin, -0.22), faceLight: shade(L.skin, 0.12),
  };

  farArm(ctx, L, s);
  legs(ctx, L, s);
  torso(ctx, L, s);
  nearArms(ctx, L, s);
  const neck = view === "back" || view === "back34" ? shade(L.skin, -0.1) : L.skin;
  R(ctx, neck, view === "side" ? s.x - 2 : s.x - 3, s.y - 14, view === "side" ? 5 : 6, 7);
  HEADS[view](ctx, L, s);
  heldItem(ctx, s);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Bảng tên + bong bóng thoại
// ---------------------------------------------------------------------------

function wrap(ctx, text, maxWidth, maxLines = 3) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, "…"); }
  return lines;
}

// Đặt một hình chữ nhật nhãn sao cho không đè lên các nhãn đã vẽ (đẩy dần lên trên).
function place(taken, x0, y0, w, h) {
  let y = y0;
  for (let guard = 0; guard < 12; guard++) {
    const hit = taken.find(r => x0 < r.x + r.w && r.x < x0 + w && y < r.y + r.h && r.y < y + h);
    if (!hit) break;
    y = hit.y - h - 2;
  }
  taken.push({ x: x0, y, w, h });
  return y;
}

const FONT = "\"Segoe UI\", system-ui, sans-serif";

export function drawOverlay(agent, p, bubble, taken = []) {
  const ctx = getContext();
  const headTop = Math.round(p.y + (BODY_Y - 42) * SCALE + agent.seatBlend * 5 * SCALE - agent.lift);
  const x = Math.round(p.x);
  ctx.font = `bold 10px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let nameTop = headTop - 15;
  if (agent.name) {
    const nameW = ctx.measureText(agent.name).width;
    nameTop = place(taken, x - nameW / 2 - 6, headTop - 15, nameW + 12, 14);
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.beginPath();
    ctx.roundRect(x - nameW / 2 - 6, nameTop, nameW + 12, 14, 7);
    ctx.fill();
    ctx.fillStyle = agent.color || "#8eb1fc";
    ctx.fillRect(x - nameW / 2 - 3, nameTop + 5, 4, 4);
    ctx.fillStyle = "#14233f";
    ctx.fillText(agent.name, x + 3, nameTop + 10.5);
  }

  if (!bubble) return;
  ctx.font = `600 10px ${FONT}`;
  // Lời nói (speech) được hiển thị trọn câu; bong bóng trạng thái thì gọn 3 dòng.
  const speech = bubble.tone === "speech";
  const lines = wrap(ctx, bubble.text, speech ? 170 : 140, speech ? 8 : 3);
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 14;
  const h = lines.length * 12 + 7;
  const top = place(taken, x - w / 2, nameTop - 5 - h, w, h + 4);
  ctx.fillStyle = bubble.tone === "error" ? "rgba(253,236,234,.97)" : bubble.tone === "speech" ? "rgba(255,255,255,.98)" : "rgba(255,255,255,.97)";
  ctx.strokeStyle = bubble.tone === "error" ? "#e0675a" : bubble.tone === "work" ? "#c99a1c" : bubble.tone === "speech" ? "#c0c8d4" : "#5288fb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, top, w, h, 5);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 4, top + h);
  ctx.lineTo(x, top + h + 4);
  ctx.lineTo(x + 4, top + h);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  ctx.fillStyle = bubble.tone === "speech" ? "#1d222c" : "#14233f";
  lines.forEach((l, i) => ctx.fillText(l, x, top + 12 + i * 12));
}
