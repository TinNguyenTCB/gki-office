// Vai trò nhân viên của trung tâm đào tạo CNTT GKI + loại nhiệm vụ.
// Khoá vai trò (role) khớp với ROLES trong main.py; chữ hiển thị theo ngôn ngữ đang chọn.

import { getLang } from "./i18n.js";

export const ROLE_KEYS = ["director", "headta", "curriculum", "teacher", "sensei", "advisor", "qa", "ta", "admissions", "secretary", "clerklead", "clerk"];
export const STAFF_ROLES = ROLE_KEYS.filter(r => r !== "director"); // vai trò chọn được cho nhân viên thường
export const KIND_KEYS = ["course", "roadmap", "lesson"];

export const ROLE_COLOR = {
  director: "#d9b44a", headta: "#e07b39", sensei: "#2e8b57", secretary: "#c2569b", clerklead: "#5b6bd6", clerk: "#7f8fa6", curriculum: "#b48ad6", teacher: "#4fae6f", advisor: "#e59a6b",
  qa: "#3f8fd8", ta: "#e06a8f", admissions: "#2fb3b0",
};

const R = {
  vi: {
    director: ["Giám đốc đào tạo kiêm giảng viên", "Giám đốc", "Phân công, duyệt tài liệu & đứng lớp"],
    sensei: ["Thầy giáo", "Thầy giáo", "Đứng lớp, kèm cặp & định hướng học viên"],
    secretary: ["Thư ký", "Thư ký", "Lịch làm việc, văn bản, liên lạc"],
    clerklead: ["Trưởng nhân viên văn phòng", "Trưởng VP", "Điều phối công việc hành chính"],
    clerk: ["Nhân viên văn phòng", "NV văn phòng", "Hồ sơ, giấy tờ, hỗ trợ hành chính"],
    headta: ["Trợ giảng chính", "Trợ giảng chính", "In ấn, lưu hồ sơ, dọn dẹp; hỗ trợ lớp học"],
    curriculum: ["Chuyên viên thiết kế chương trình", "Thiết kế CT", "Khung chương trình, mục tiêu, dự án"],
    teacher: ["Giảng viên CNTT", "Giảng viên", "Đứng lớp, soạn bài giảng & thực hành"],
    advisor: ["Chuyên viên tư vấn học tập", "Tư vấn", "Hồ sơ học viên, định hướng nghề"],
    qa: ["Chuyên viên khảo thí & chất lượng", "Khảo thí", "Đánh giá, rubric, rà soát nội dung"],
    ta: ["Trợ giảng", "Trợ giảng", "Hỗ trợ thực hành, FAQ, tài liệu bổ trợ"],
    admissions: ["Chuyên viên tuyển sinh", "Tuyển sinh", "Thông điệp, học phí, kế hoạch tuyển sinh"],
  },
  en: {
    director: ["Training Director & Instructor", "Director", "Assigns, reviews documents & teaches"],
    sensei: ["Teacher", "Teacher", "Teaches, mentors & guides learners"],
    secretary: ["Secretary", "Secretary", "Schedules, documents, communication"],
    clerklead: ["Office Manager", "Office lead", "Coordinates admin work"],
    clerk: ["Office Staff", "Office staff", "Records, paperwork, admin support"],
    headta: ["Lead Teaching Assistant", "Lead TA", "Printing, filing, tidying; class support"],
    curriculum: ["Curriculum Designer", "Curriculum", "Course structure, outcomes, projects"],
    teacher: ["IT Instructor", "Instructor", "Teaches classes, writes lessons & labs"],
    advisor: ["Learning Advisor", "Advisor", "Learner profiles, career direction"],
    qa: ["Assessment & QA Specialist", "Assessment", "Assessments, rubrics, content review"],
    ta: ["Teaching Assistant", "TA", "Lab support, FAQ, extra materials"],
    admissions: ["Admissions Officer", "Admissions", "Messaging, fees, enrolment plan"],
  },
  ja: {
    director: ["研修部長（講師兼任）", "部長", "割り振り・審査・授業"],
    sensei: ["先生", "先生", "授業・指導・受講者のサポート"],
    secretary: ["秘書", "秘書", "スケジュール・文書・連絡"],
    clerklead: ["事務リーダー", "事務リーダー", "事務作業の取りまとめ"],
    clerk: ["事務スタッフ", "事務", "書類・手続き・事務サポート"],
    headta: ["主任アシスタント", "主任TA", "印刷・書類整理・片付け・授業サポート"],
    curriculum: ["カリキュラム設計担当", "カリキュラム", "コース構成・到達目標・課題"],
    teacher: ["IT講師", "講師", "授業・講義資料・演習の作成"],
    advisor: ["学習アドバイザー", "アドバイザー", "受講者プロフィール・キャリア"],
    qa: ["評価・品質担当", "評価担当", "評価・ルーブリック・内容チェック"],
    ta: ["ティーチングアシスタント", "TA", "演習サポート・FAQ・補助教材"],
    admissions: ["募集担当", "募集", "訴求・受講料・募集計画"],
  },
};

const L = () => getLang() in R ? getLang() : "vi";
export const roleTitle = role => (R[L()][role] || R[L()].ta)[0];
export const roleShort = role => (R[L()][role] || R[L()].ta)[1];
export const roleDuty = role => (R[L()][role] || R[L()].ta)[2];

// ---------------------------------------------------------------------------
// Loại nhiệm vụ: tên, gợi ý nhập, việc từng người trên bảng phân công.
// ---------------------------------------------------------------------------
const K = {
  vi: {
    name: { course: "Thiết kế khoá học", roadmap: "Tư vấn lộ trình", lesson: "Buổi dạy" },
    doc: { course: "Đề cương khoá học", roadmap: "Lộ trình học tập", lesson: "Giáo án buổi học" },
    placeholder: {
      course: "Ví dụ: Thiết kế khoá Python cơ bản 8 tuần cho 20 người đi làm trái ngành, học buổi tối 2 buổi/tuần.",
      roadmap: "Ví dụ: Tôi 27 tuổi, đang làm kế toán, biết Excel, muốn chuyển sang Data Analyst trong 1 năm, học được 10 giờ/tuần.",
      lesson: "Ví dụ: Buổi 3 – Vòng lặp for/while trong Python cho lớp mới bắt đầu, 90 phút.",
    },
    task: {
      course: {
        curriculum: "Thiết kế khung chương trình: mục tiêu đầu ra đo lường được, đối tượng, danh sách module theo tuần, thời lượng, dự án cuối khoá.",
        teacher: "Soạn nội dung chi tiết cho 2–3 buổi học tiêu biểu: lý thuyết trọng tâm, ví dụ code, bài thực hành có hướng dẫn.",
        advisor: "Phân tích chân dung học viên mục tiêu, đề xuất hình thức học, lịch học và cách hỗ trợ, giữ chân học viên.",
        qa: "Thiết kế cách đánh giá: tiêu chí đạt từng module, bài kiểm tra, rubric dự án; rà soát lỗi kỹ thuật, nội dung lỗi thời.",
        ta: "Soạn câu hỏi thường gặp, lỗi hay gặp khi thực hành và tài liệu đọc thêm.",
        headta: "Chuẩn bị học liệu, checklist tổ chức lớp (phòng, thiết bị, tài khoản), quy trình điểm danh và hỗ trợ học viên.",
        admissions: "Đề xuất tên khoá, thông điệp, điểm khác biệt, học phí ước tính và kế hoạch tuyển sinh.",
        sensei: "Soạn nội dung chi tiết cho các buổi học tiêu biểu, ví dụ thực tế và cách kèm cặp học viên yếu.",
        secretary: "Lên lịch khai giảng, lịch học, mẫu thông báo và thư mời học viên.",
        clerklead: "Lập kế hoạch hành chính cho khoá học: nhân sự, phòng học, thiết bị, mốc thời gian.",
        clerk: "Chuẩn bị mẫu hồ sơ đăng ký, danh sách lớp, biểu mẫu điểm danh và chứng nhận.",
        director: "Tổng hợp, sửa và ký duyệt Đề cương khoá học: tổng quan, mục tiêu, nội dung theo tuần, dự án, đánh giá, tài liệu.",
      },
      roadmap: {
        curriculum: "Đề xuất lộ trình các khoá/chủ đề theo thứ tự hợp lý, thời lượng và điều kiện tiên quyết từng chặng.",
        teacher: "Đánh giá kỹ năng kỹ thuật cần bổ sung, gợi ý bài tập/dự án nhỏ cho từng chặng.",
        advisor: "Phân tích hồ sơ: nền tảng, mục tiêu nghề nghiệp, quỹ thời gian; xác định khoảng cách năng lực và vị trí phù hợp.",
        qa: "Đề xuất mốc kiểm tra năng lực sau mỗi chặng và chứng chỉ phù hợp.",
        ta: "Gợi ý thói quen học, công cụ, cộng đồng và tài nguyên miễn phí để tự học.",
        headta: "Lập lịch học chi tiết theo tuần, nhắc mốc nộp bài và cách liên hệ hỗ trợ.",
        admissions: "Gợi ý hình thức học hợp quỹ thời gian, ngân sách và ước tính chi phí.",
        sensei: "Nhận xét điểm mạnh/yếu kỹ thuật và lời khuyên học tập cho từng chặng.",
        secretary: "Sắp lịch tư vấn, nhắc mốc học tập và mẫu email liên lạc với học viên.",
        clerklead: "Đề xuất thủ tục đăng ký, chính sách hỗ trợ và đầu mối liên hệ cho học viên.",
        clerk: "Liệt kê giấy tờ cần chuẩn bị và quy trình đăng ký từng khoá trong lộ trình.",
        director: "Tổng hợp, sửa và ký duyệt Lộ trình học tập cá nhân gửi khách hàng.",
      },
      lesson: {
        teacher: "Đứng lớp: giảng bài và soạn bài giảng chi tiết theo trình tự trên lớp, có ví dụ code và hoạt động thực hành.",
        assistant: "Ngồi cuối lớp hỗ trợ: soạn bài tập về nhà kèm đáp án, câu hỏi kiểm tra nhanh, lỗi học viên hay gặp.",
        director: "Duyệt và ký Giáo án buổi học: mục tiêu, tiến trình theo phút, nội dung, bài tập & đáp án.",
      },
    },
  },
  en: {
    name: { course: "Design a course", roadmap: "Learning roadmap", lesson: "Class session" },
    doc: { course: "Course syllabus", roadmap: "Learning roadmap", lesson: "Lesson plan" },
    placeholder: {
      course: "e.g. Design an 8-week beginner Python course for 20 career changers, two evening sessions a week.",
      roadmap: "e.g. I'm 27, working in accounting, good at Excel, and want to become a Data Analyst within a year with 10 hours/week.",
      lesson: "e.g. Session 3 – for/while loops in Python for beginners, 90 minutes.",
    },
    task: {
      course: {
        curriculum: "Design the course structure: measurable outcomes, audience, weekly modules, duration, final project.",
        teacher: "Write detailed content for 2–3 typical sessions: key theory, code examples, guided labs.",
        advisor: "Profile the target learners and suggest format, schedule, and how to support and retain them.",
        qa: "Design assessments: pass criteria per module, tests, project rubric; review for technical errors and outdated content.",
        ta: "Write FAQs, common lab mistakes and further reading.",
        headta: "Prepare materials, a class logistics checklist (room, equipment, accounts), attendance and learner support.",
        admissions: "Propose the course name, messaging, differentiators, estimated fee and an enrolment plan.",
        sensei: "Write detailed content for typical sessions, real-world examples and how to mentor struggling learners.",
        secretary: "Set the start date and timetable, plus announcement and invitation templates.",
        clerklead: "Plan course administration: staffing, rooms, equipment and milestones.",
        clerk: "Prepare registration forms, class lists, attendance sheets and certificates.",
        director: "Consolidate, correct and sign the Course syllabus: overview, outcomes, weekly content, project, assessment, materials.",
      },
      roadmap: {
        curriculum: "Propose an ordered path of courses/topics with durations and prerequisites per stage.",
        teacher: "Assess technical skills to build and suggest small exercises/projects for each stage.",
        advisor: "Analyse the profile: background, career goal, available time; identify skill gaps and suitable roles.",
        qa: "Propose checkpoints after each stage and suitable certifications.",
        ta: "Suggest study habits, tools, communities and free resources for self-study.",
        headta: "Draft a detailed weekly study schedule, submission reminders and how to get help.",
        admissions: "Suggest a study format that fits the learner's time and budget, with estimated costs.",
        sensei: "Assess technical strengths/weaknesses and give study advice for each stage.",
        secretary: "Schedule consultations, milestone reminders and contact email templates.",
        clerklead: "Propose enrolment procedures, support policies and points of contact.",
        clerk: "List required documents and the enrolment steps for each course on the path.",
        director: "Consolidate, correct and sign the personal Learning roadmap for the client.",
      },
      lesson: {
        teacher: "Teach the class and write a detailed lesson in classroom order, with code examples and activities.",
        assistant: "Support from the back row: homework with answers, quick-check questions, common learner mistakes.",
        director: "Review and sign the Lesson plan: objectives, minute-by-minute flow, content, exercises & answers.",
      },
    },
  },
  ja: {
    name: { course: "コース設計", roadmap: "学習ロードマップ", lesson: "授業" },
    doc: { course: "コースシラバス", roadmap: "学習ロードマップ", lesson: "授業指導案" },
    placeholder: {
      course: "例：異業種から転職を目指す社会人20名向け、週2回夜間・8週間のPython入門コースを設計して。",
      roadmap: "例：27歳、経理職、Excelは得意。週10時間の学習で1年以内にデータアナリストになりたい。",
      lesson: "例：第3回 – Pythonのfor/whileループ（初心者クラス、90分）。",
    },
    task: {
      course: {
        curriculum: "コース構成を設計：測定可能な到達目標、対象者、週ごとのモジュール、時間数、最終課題。",
        teacher: "代表的な2〜3回分の授業内容を作成：重要な理論、コード例、ガイド付き演習。",
        advisor: "想定受講者像を分析し、受講形式・スケジュール・サポート方法を提案。",
        qa: "評価を設計：モジュールごとの合格基準、テスト、課題ルーブリック。技術的な誤りや古い内容を確認。",
        ta: "よくある質問、演習でのよくあるミス、参考資料をまとめる。",
        headta: "教材、クラス運営チェックリスト（教室・機材・アカウント）、出欠と受講者サポートを準備。",
        admissions: "コース名、訴求ポイント、差別化、受講料の目安、募集計画を提案。",
        sensei: "代表的な授業の詳しい内容、実例、つまずいた受講者の指導方法を作成。",
        secretary: "開講日・時間割、案内文と招待状のテンプレートを作成。",
        clerklead: "コースの事務計画：人員、教室、機材、スケジュール。",
        clerk: "申込書、名簿、出席表、修了証を準備。",
        director: "コースシラバスを統合・修正し承認：概要、目標、週ごとの内容、課題、評価、教材。",
      },
      roadmap: {
        curriculum: "コース／テーマの順序立てた道筋と、各段階の期間・前提条件を提案。",
        teacher: "補うべき技術スキルを評価し、段階ごとの小さな課題を提案。",
        advisor: "プロフィールを分析：経歴、キャリア目標、学習時間。スキルギャップと適した職種を特定。",
        qa: "各段階後の確認ポイントと適した資格を提案。",
        ta: "学習習慣、ツール、コミュニティ、無料の学習リソースを提案。",
        headta: "週ごとの詳しい学習スケジュール、提出期限のリマインド、サポート窓口をまとめる。",
        admissions: "時間と予算に合う受講形式と費用の目安を提案。",
        sensei: "技術面の強み・弱みを評価し、段階ごとの学習アドバイス。",
        secretary: "相談日程、学習の節目のリマインド、連絡用メールの雛形。",
        clerklead: "申込手続き、支援制度、窓口を提案。",
        clerk: "各コースに必要な書類と申込手順をまとめる。",
        director: "個人向け学習ロードマップを統合・修正し承認。",
      },
      lesson: {
        teacher: "授業を行い、授業の流れに沿った詳しい講義資料（コード例・演習付き）を作成。",
        assistant: "教室の後ろでサポート：宿題と解答、確認クイズ、受講者のよくあるミス。",
        director: "授業指導案を審査・承認：目標、分単位の流れ、内容、演習と解答。",
      },
    },
  },
};

const KL = () => K[L()];
export const kindName = kind => KL().name[kind] || kind;
export const kindDoc = kind => KL().doc[kind] || kind;
export const kindPlaceholder = kind => KL().placeholder[kind] || "";
// lessonPart: "teacher" | "assistant" (chỉ dùng cho buổi dạy)
export function taskText(kind, role, lessonPart = null) {
  const T = KL().task[kind] || {};
  if (role === "director") return T.director || "";
  if (kind === "lesson") return T[lessonPart || "assistant"] || "";
  return T[role] || "";
}
