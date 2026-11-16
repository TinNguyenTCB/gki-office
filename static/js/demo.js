// Chạy mô phỏng một nhiệm vụ trọn vẹn mà KHÔNG gọi API: phát lại đúng chuỗi sự kiện backend sẽ gửi.
// Mọi nội dung trong tài liệu mẫu đều là VÍ DỤ minh hoạ.

import { clientName, getLang } from "./i18n.js";

const TEXT = {
  vi: {
    tag: "[MÔ PHỎNG]", prompt: { course: "Thiết kế khoá Python cơ bản 8 tuần", roadmap: "Lộ trình chuyển nghề sang Data Analyst", lesson: "Buổi 3 – Vòng lặp trong Python" },
    assigning: "Đang phân công công việc", monitoring: "Đã giao việc, theo dõi tiến độ",
    work: { sensei: "Đang soạn bài & phương pháp kèm cặp", secretary: "Đang lên lịch & soạn thông báo", clerklead: "Đang lập kế hoạch hành chính", clerk: "Đang chuẩn bị biểu mẫu, hồ sơ", headta: "Đang chuẩn bị học liệu & hồ sơ lớp", curriculum: "Đang thiết kế chương trình", teacher: "Đang soạn nội dung bài giảng", advisor: "Đang phân tích nhu cầu học viên", qa: "Đang rà soát & thiết kế đánh giá", ta: "Đang soạn tài liệu bổ trợ", admissions: "Đang lên phương án tuyển sinh" },
    lessonTeacher: "Đang giảng bài trên lớp", lessonAssistant: "Đang hỗ trợ lớp ở cuối phòng",
    director: { course: "Đang viết đề cương khoá học", roadmap: "Đang viết lộ trình học tập", lesson: "Đang duyệt giáo án" },
    done: "Xong phần việc", ready: "Sẵn sàng cho việc tiếp theo",
    typing: "Đang viết mục tiếp theo…", handoff: "Bản nháp phần của mình, kèm ghi chú",
    report: {
      course: c => `## ĐỀ CƯƠNG KHOÁ HỌC MẪU – Python cơ bản (8 tuần)

> ⚠️ Đây là **tài liệu mô phỏng** để xem trước giao diện; nội dung chỉ là ví dụ.

- **Gửi:** ${c}
- **Đối tượng:** người đi làm trái ngành, chưa biết lập trình · **Hình thức:** 2 buổi tối/tuần, 2 giờ/buổi

### 1. Mục tiêu đầu ra
1. Viết được chương trình Python có biến, điều kiện, vòng lặp, hàm.
2. Đọc/ghi file CSV và xử lý dữ liệu đơn giản.
3. Hoàn thành một dự án nhỏ và đưa lên GitHub.

### 2. Nội dung theo tuần
| Tuần | Chủ đề | Thực hành |
|---|---|---|
| 1 | Cài đặt, biến, kiểu dữ liệu | Máy tính bỏ túi |
| 2 | Điều kiện | Xếp loại điểm |
| 3 | Vòng lặp | Trò chơi đoán số |
| 4 | Hàm | Thư viện hàm tiện ích |
| 5 | List, dict | Danh bạ |
| 6 | File & CSV | Báo cáo chi tiêu |
| 7 | Git & GitHub | Đưa code lên GitHub |
| 8 | Dự án cuối khoá | Thuyết trình |

### 3. Đánh giá
- Bài tập hằng tuần 40% · Kiểm tra giữa khoá 20% · Dự án cuối khoá 40% (có rubric).

---
**Lưu ý:** Tài liệu do đội ngũ AI soạn, chỉ mang tính tham khảo, cần giảng viên rà soát trước khi sử dụng.`,
      roadmap: c => `## LỘ TRÌNH HỌC TẬP MẪU – Chuyển nghề sang Data Analyst

> ⚠️ Đây là **tài liệu mô phỏng** để xem trước giao diện; nội dung chỉ là ví dụ.

- **Gửi:** ${c}
- **Quỹ thời gian:** 10 giờ/tuần · **Mục tiêu:** ứng tuyển vị trí Data Analyst sau 12 tháng

### 1. Lộ trình theo chặng
| Chặng | Nội dung | Thời lượng | Kết quả cần đạt |
|---|---|---|---|
| 1 | Excel nâng cao, thống kê cơ bản | 2 tháng | Dashboard Excel |
| 2 | SQL | 3 tháng | Truy vấn báo cáo bán hàng |
| 3 | Python (pandas) | 3 tháng | Làm sạch & phân tích dữ liệu |
| 4 | Power BI / trực quan hoá | 2 tháng | Dashboard hoàn chỉnh |
| 5 | Portfolio & ứng tuyển | 2 tháng | 3 dự án trên GitHub |

### 2. Kế hoạch hằng tuần
- 3 buổi tối × 2 giờ + 4 giờ cuối tuần cho bài tập/dự án.

---
**Lưu ý:** Tài liệu do đội ngũ AI soạn, chỉ mang tính tham khảo; thông tin chứng chỉ và thị trường có thể đã thay đổi.`,
      lesson: c => `## GIÁO ÁN MẪU – Buổi 3: Vòng lặp trong Python (90 phút)

> ⚠️ Đây là **tài liệu mô phỏng** để xem trước giao diện; nội dung chỉ là ví dụ.

- **Gửi:** ${c}

### 1. Mục tiêu
- Dùng được \`for\` với \`range()\` và \`while\` có điều kiện dừng.

### 2. Tiến trình
| Phút | Hoạt động |
|---|---|
| 0–10 | Khởi động: in 1..5 bằng tay |
| 10–35 | Lý thuyết \`for\`, \`range\` |
| 35–55 | Lý thuyết \`while\`, \`break\` |
| 55–80 | Thực hành: trò chơi đoán số |
| 80–90 | Tổng kết, giao bài |

### 3. Bài tập về nhà
1. Tính tổng các số chẵn từ 1 đến n.
2. In bảng cửu chương.

---
**Lưu ý:** Tài liệu do đội ngũ AI soạn, chỉ mang tính tham khảo, cần giảng viên rà soát trước khi sử dụng.`,
    },
  },
  en: {
    tag: "[SIMULATION]", prompt: { course: "Design an 8-week beginner Python course", roadmap: "Career-change roadmap to Data Analyst", lesson: "Session 3 – Loops in Python" },
    assigning: "Assigning tasks", monitoring: "Tasks assigned, monitoring progress",
    work: { sensei: "Preparing lessons & mentoring", secretary: "Scheduling & drafting notices", clerklead: "Planning administration", clerk: "Preparing forms & records", headta: "Preparing materials & class records", curriculum: "Designing the curriculum", teacher: "Writing lesson content", advisor: "Analysing learner needs", qa: "Reviewing & designing assessments", ta: "Preparing support materials", admissions: "Planning enrolment" },
    lessonTeacher: "Teaching the class", lessonAssistant: "Supporting the class from the back row",
    director: { course: "Writing the course syllabus", roadmap: "Writing the learning roadmap", lesson: "Reviewing the lesson plan" },
    done: "Part done", ready: "Ready for the next task",
    typing: "Writing the next section…", handoff: "Draft of my part, with notes",
    report: {
      course: c => `## SAMPLE COURSE SYLLABUS – Python basics (8 weeks)

> ⚠️ This is a **simulated document** for previewing the interface; the content is only an example.

- **To:** ${c}
- **Audience:** career changers with no coding background · **Format:** 2 evenings/week, 2 hours each

### 1. Learning outcomes
1. Write Python programs with variables, conditions, loops and functions.
2. Read/write CSV files and do simple data processing.
3. Finish a small project and publish it on GitHub.

### 2. Weekly content
| Week | Topic | Lab |
|---|---|---|
| 1 | Setup, variables, types | Calculator |
| 2 | Conditions | Grade classifier |
| 3 | Loops | Guess-the-number |
| 4 | Functions | Utility library |
| 5 | Lists, dicts | Contact book |
| 6 | Files & CSV | Expense report |
| 7 | Git & GitHub | Publish to GitHub |
| 8 | Final project | Presentation |

### 3. Assessment
- Weekly exercises 40% · Mid-course test 20% · Final project 40% (with rubric).

---
**Note:** Written by the AI team for reference only; an instructor should review it before use.`,
      roadmap: c => `## SAMPLE LEARNING ROADMAP – Career change to Data Analyst

> ⚠️ This is a **simulated document** for previewing the interface; the content is only an example.

- **To:** ${c}
- **Time:** 10 hours/week · **Goal:** apply for Data Analyst roles within 12 months

### 1. Stages
| Stage | Content | Duration | Outcome |
|---|---|---|---|
| 1 | Advanced Excel, basic statistics | 2 months | Excel dashboard |
| 2 | SQL | 3 months | Sales report queries |
| 3 | Python (pandas) | 3 months | Clean & analyse data |
| 4 | Power BI / visualisation | 2 months | Full dashboard |
| 5 | Portfolio & applications | 2 months | 3 projects on GitHub |

### 2. Weekly plan
- 3 evenings × 2 hours + 4 hours at the weekend for exercises/projects.

---
**Note:** Written by the AI team for reference only; certification and job-market details may have changed.`,
      lesson: c => `## SAMPLE LESSON PLAN – Session 3: Loops in Python (90 min)

> ⚠️ This is a **simulated document** for previewing the interface; the content is only an example.

- **To:** ${c}

### 1. Objectives
- Use \`for\` with \`range()\` and \`while\` with a stop condition.

### 2. Flow
| Minutes | Activity |
|---|---|
| 0–10 | Warm-up: print 1..5 by hand |
| 10–35 | Theory: \`for\`, \`range\` |
| 35–55 | Theory: \`while\`, \`break\` |
| 55–80 | Lab: guess-the-number game |
| 80–90 | Wrap-up, homework |

### 3. Homework
1. Sum the even numbers from 1 to n.
2. Print the multiplication table.

---
**Note:** Written by the AI team for reference only; an instructor should review it before use.`,
    },
  },
  ja: {
    tag: "【シミュレーション】", prompt: { course: "8週間のPython入門コースを設計", roadmap: "データアナリストへの転職ロードマップ", lesson: "第3回 – Pythonのループ" },
    assigning: "タスクを割り振り中", monitoring: "割り振り完了、進捗を確認中",
    work: { sensei: "授業と指導方法を準備中", secretary: "日程調整・案内文を作成中", clerklead: "事務計画を作成中", clerk: "書類・様式を準備中", headta: "教材とクラス書類を準備中", curriculum: "カリキュラムを設計中", teacher: "講義内容を作成中", advisor: "受講者のニーズを分析中", qa: "評価を設計・レビュー中", ta: "補助教材を作成中", admissions: "募集計画を作成中" },
    lessonTeacher: "授業中", lessonAssistant: "教室の後ろでサポート中",
    director: { course: "コースシラバスを作成中", roadmap: "学習ロードマップを作成中", lesson: "指導案を審査中" },
    done: "担当完了", ready: "次のタスクの準備OK",
    typing: "次の項目を作成中…", handoff: "担当分の下書きとメモです",
    report: {
      course: c => `## コースシラバス（サンプル）– Python入門（8週間）

> ⚠️ これは画面確認用の**シミュレーション資料**です。内容は例にすぎません。

- **宛先：** ${c}
- **対象：** プログラミング未経験の社会人 · **形式：** 週2回夜間、各2時間

### 1. 到達目標
1. 変数・条件分岐・ループ・関数を使ったPythonプログラムを書ける。
2. CSVファイルを読み書きし、簡単なデータ処理ができる。
3. 小さな課題を完成させGitHubに公開できる。

### 2. 週ごとの内容
| 週 | テーマ | 演習 |
|---|---|---|
| 1 | 環境構築・変数・型 | 電卓 |
| 2 | 条件分岐 | 成績判定 |
| 3 | ループ | 数当てゲーム |
| 4 | 関数 | ユーティリティ集 |
| 5 | リスト・辞書 | 連絡帳 |
| 6 | ファイルとCSV | 支出レポート |
| 7 | GitとGitHub | GitHubに公開 |
| 8 | 最終課題 | 発表 |

### 3. 評価
- 毎週の課題 40% · 中間テスト 20% · 最終課題 40%（ルーブリックあり）。

---
**注意：** AIチームが作成した参考資料です。使用前に講師の確認が必要です。`,
      roadmap: c => `## 学習ロードマップ（サンプル）– データアナリストへの転職

> ⚠️ これは画面確認用の**シミュレーション資料**です。内容は例にすぎません。

- **宛先：** ${c}
- **学習時間：** 週10時間 · **目標：** 12か月以内にデータアナリスト職へ応募

### 1. 段階
| 段階 | 内容 | 期間 | 成果 |
|---|---|---|---|
| 1 | Excel応用・統計の基礎 | 2か月 | Excelダッシュボード |
| 2 | SQL | 3か月 | 売上レポートのクエリ |
| 3 | Python（pandas） | 3か月 | データのクレンジングと分析 |
| 4 | Power BI・可視化 | 2か月 | ダッシュボード完成 |
| 5 | ポートフォリオと応募 | 2か月 | GitHubに3作品 |

### 2. 週間計画
- 平日夜3回×2時間 + 週末4時間で課題・制作。

---
**注意：** AIチームが作成した参考資料です。資格や求人市場の情報は変わっている可能性があります。`,
      lesson: c => `## 授業指導案（サンプル）– 第3回：Pythonのループ（90分）

> ⚠️ これは画面確認用の**シミュレーション資料**です。内容は例にすぎません。

- **宛先：** ${c}

### 1. 目標
- \`range()\` を使った \`for\` と、停止条件付きの \`while\` を使える。

### 2. 流れ
| 分 | 活動 |
|---|---|
| 0–10 | ウォームアップ：1〜5を手で出力 |
| 10–35 | 理論：\`for\`、\`range\` |
| 35–55 | 理論：\`while\`、\`break\` |
| 55–80 | 演習：数当てゲーム |
| 80–90 | まとめ・宿題 |

### 3. 宿題
1. 1からnまでの偶数の合計を求める。
2. 九九の表を出力する。

---
**注意：** AIチームが作成した参考資料です。使用前に講師の確認が必要です。`,
    },
  },
};

// job: { kind, directorId, members: [{ id, role }], lesson: { teacher, assistants: [] } | null }
function script(prompt, job) {
  const L = TEXT[getLang()] || TEXT.vi;
  const st = (agent, status, message) => ({ type: "status", agent, status, message });
  const dir = job.directorId;
  const steps = [[0, { type: "job", state: "started", prompt: `${L.tag} ${prompt || L.prompt[job.kind]}`.slice(0, 140), kind: job.kind }],
    [300, st(dir, "thinking", L.assigning)],
    [5500, st(dir, "idle", L.monitoring)]];
  // Giám đốc kiêm giảng viên: đứng lớp ở bước đầu, duyệt ở bước cuối.
  const dirTeaches = job.kind === "lesson" && job.lesson?.teacher === dir;
  const order = [...(dirTeaches ? [dir] : []), ...job.members.map(m => m.id), dir];
  const roleOf = id => job.members.find(m => m.id === id)?.role;
  const workMsg = (id, final) => {
    if (final) return L.director[job.kind];
    if (job.kind === "lesson") return id === job.lesson?.teacher ? L.lessonTeacher : L.lessonAssistant;
    return L.work[roleOf(id)] || L.work.ta;
  };
  const long = job.kind === "lesson" ? 1.8 : 1; // buổi dạy kéo dài hơn để kịp thấy lớp học
  order.forEach((agent, i) => {
    const final = i === order.length - 1;
    steps.push([0, st(agent, final ? "reviewing" : "working", workMsg(agent, final))]);
    steps.push([1800, { type: "activity", agent, kind: "thinking" }]);
    steps.push([(final ? 6000 : 5000) * long, { type: "activity", agent, kind: "typing", message: L.typing }]);
    steps.push([3500 * long, st(agent, "done", L.done)]);
    const next = order[i + 1];
    if (next && next !== agent) steps.push([0, { type: "handoff", from: agent, to: next, message: L.handoff }]);
  });
  return { steps, L, order: [...new Set(order)] };
}

let running = null;

export function isDemoRunning() { return !!running; }

export async function runDemo(emit, name, prompt, job) {
  if (running) return;
  const token = { cancelled: false };
  running = token;
  const { steps, L, order } = script(prompt, job);
  try {
    for (const [wait, msg] of steps) {
      if (wait) await new Promise(r => setTimeout(r, wait));
      if (token.cancelled) return;
      emit(msg);
    }
    await new Promise(r => setTimeout(r, 800));
    if (token.cancelled) return;
    for (const agent of order) emit({ type: "status", agent, status: "idle", message: L.ready });
    emit({ type: "job", state: "finished", result: L.report[job.kind](clientName(name)), demo: true });
  } finally {
    if (running === token) running = null;
  }
}

export function cancelDemo() {
  if (running) running.cancelled = true;
  running = null;
}
