// Hồ sơ nhân viên (lưu trên trình duyệt): tên, vai trò, ngoại hình, bàn mặc định, bàn làm việc.
// Giám đốc luôn có id "manager" và vai trò "director" (không xoá được).

import { randomLook } from "./characters.js";
import { ROLE_KEYS, STAFF_ROLES, roleShort } from "./roles.js";

const KEY = "ai-office-staff-v1";
export const MAX_STAFF = 12;
export const DIRECTOR_ID = "manager";

const look = (o) => ({
  glasses: false, beard: false, headphones: false, lanyard: false, earrings: false, ...o,
});

export const DEFAULT_TEAM = [
  {
    id: "manager", role: "director", name: "西木", homeDesk: "d-manager", workDesk: "f-mwinl9qi-9yqtl",
    look: look({ glasses: true, gender: "male", skin: "#e8b98f", hair: "#6b3e22", hairStyle: "short", outfit: "suit", jacket: "#2d3a4f", shirt: "#e9edf2", accent: "#063279", pants: "#232c3b" }),
  },
  {
    id: "e1", role: "teacher", name: "伊藤", homeDesk: "f-mwino0mb-1gjuh", workDesk: "",
    look: look({ gender: "female", bottom: "skirt", skin: "#f2cfae", hair: "#1a1a1a", hairStyle: "short", outfit: "suit", jacket: "#24084e", shirt: "#000000", accent: "#000000", pants: "#24084e" }),
  },
  {
    id: "e2", role: "teacher", name: "今野", homeDesk: "f-mwinobnc-36mfb", workDesk: "",
    look: look({ gender: "female", bottom: "skirt", skin: "#f6d7bd", hair: "#3b3836", hairStyle: "bun", outfit: "suit", jacket: "#4f4f4f", shirt: "#000000", accent: "#000000", pants: "#4f4f4f", earrings: true }),
  },
];

export const cleanMember = (r, i) => {
  if (!r || typeof r !== "object" || typeof r.id !== "string" || !/^[A-Za-z0-9_-]{1,24}$/.test(r.id)) return null;
  const role = r.id === DIRECTOR_ID ? "director" : STAFF_ROLES.includes(r.role) ? r.role : "ta";
  return {
    id: r.id, role,
    name: typeof r.name === "string" ? r.name.slice(0, 24) : "",
    homeDesk: typeof r.homeDesk === "string" ? r.homeDesk : "",
    workDesk: typeof r.workDesk === "string" ? r.workDesk : "",
    look: look({ ...(DEFAULT_TEAM[i]?.look || randomLook()), ...(r.look && typeof r.look === "object" ? r.look : {}) }),
  };
};

// Làm sạch danh sách nhân viên (từ bộ nhớ trình duyệt hoặc file nhập); null nếu không hợp lệ.
export function sanitizeTeam(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const uniq = list.map(cleanMember).filter(Boolean).filter(r => !seen.has(r.id) && seen.add(r.id));
  return uniq.some(r => r.id === DIRECTOR_ID) ? uniq.slice(0, MAX_STAFF) : null;
}

export function loadTeam() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (Array.isArray(saved)) {
      const list = saved.map(cleanMember).filter(Boolean);
      const seen = new Set();
      const uniq = list.filter(r => !seen.has(r.id) && seen.add(r.id));
      if (uniq.some(r => r.id === DIRECTOR_ID)) return uniq.slice(0, MAX_STAFF);
    }
  } catch { /* bỏ qua – dùng mặc định */ }
  return structuredClone(DEFAULT_TEAM);
}

export function saveTeam(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}

export function newMemberId(list) {
  for (let i = 1; i < 1000; i++) { const id = `e${i}`; if (!list.some(r => r.id === id)) return id; }
  return `e${Date.now().toString(36)}`;
}

// Tên hiển thị: tên tự đặt, nếu trống thì theo vai trò (đánh số khi trùng vai trò).
export function displayName(rec, list) {
  if (rec.name && rec.name.trim()) return rec.name.trim();
  const same = list.filter(r => r.role === rec.role && !(r.name && r.name.trim()));
  const base = roleShort(rec.role);
  return same.length > 1 ? `${base} ${same.indexOf(rec) + 1}` : base;
}

export { ROLE_KEYS };
