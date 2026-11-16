// Lời thoại của nhân viên & học viên trung tâm đào tạo CNTT GKI, theo từng ngôn ngữ và vai trò.

import { getLang } from "./i18n.js";

const D = {
  vi: {
    activity: {
      coffee: {
        "*": ["Một ly cà phê rồi làm tiếp", "Uống chút nước cho tỉnh táo", "Nạp năng lượng đã!"],
        director: ["Một ly trước buổi duyệt giáo án", "Cà phê đen – như code không có comment"],
        teacher: ["Giữ giọng cho buổi dạy chiều", "Nước ấm cho cổ họng giảng viên"],
        curriculum: ["Caffeine để xếp lại 12 tuần học", "Thêm ly nữa là xong khung chương trình"],
      },
      snack: { "*": ["Ăn nhẹ chút cho có sức", "Sữa chua mát lạnh!", "Ai để bánh trong tủ lạnh thế này?"] },
      lunch: { "*": ["Cơm hộp nóng rồi, ăn thôi", "Hâm lại cơm trưa", "Bữa trưa tự nấu, tiết kiệm!"] },
      window: {
        "*": ["Nhìn xa cho đỡ mỏi mắt", "Trời đẹp quá", "Phố đông ghê"],
        teacher: ["Nghĩ ví dụ dễ hiểu hơn cho học viên…", "Lớp tối nay chắc đông"],
        advisor: ["Bao nhiêu người ngoài kia muốn đổi nghề IT nhỉ…"],
      },
      read: {
        "*": ["Đọc tài liệu mới", "Sách về Clean Code", "Ôn lại thuật toán"],
        curriculum: ["Khung năng lực CNTT mới", "Đọc về học qua dự án"],
        qa: ["Đọc về cách viết rubric", "Tài liệu chuẩn đánh giá"],
        teacher: ["Ôn lại bài giảng tuần sau", "Sách Python cho người mới"],
      },
      sofa: { "*": ["Nghỉ năm phút rồi làm tiếp", "Nghỉ mắt khỏi màn hình", "Ngồi chút cho đầu óc thông"] },
      smoke: { "*": ["Một điếu cho đầu óc thông thoáng…", "Hút xong rồi duyệt tiếp giáo án", "Biết là nên bỏ… mai bỏ vậy", "Nghĩ xem khoá sau mở lớp gì đây"] },
    },
    handoff: {
      "*": ["Phần của mình xong rồi, bạn xem tiếp nhé!", "Gửi bạn tài liệu, có gì hỏi mình nhé.", "Xong phần này, chuyển bạn!"],
      director: ["Đã in xong, sếp duyệt giúp em.", "Tài liệu đây ạ, sếp xem giúp."],
    },
    teach: [
      "Hôm nay chúng ta học phần mới nhé!", "Mọi người mở máy, tạo file main.py.", "Vòng lặp giúp lặp lại công việc.",
      "Ai chạy thử đoạn code này chưa?", "Lỗi này là do thiếu dấu hai chấm.", "Biến giống như một chiếc hộp có tên.",
      "Giờ làm bài thực hành 10 phút.", "Có câu hỏi gì không các bạn?", "Hàm giúp code gọn và dùng lại được.",
      "Nhớ commit code lên Git nhé!",
    ],
    cls: ["Ghi lại câu hỏi của học viên", "Bạn bàn 3 cần hỗ trợ", "Chuẩn bị bài tập về nhà", "Kiểm tra máy chiếu…", "Điểm danh xong rồi"],
    student: ["✍️ Ghi chép…", "🙋 Thầy ơi cho em hỏi!", "💡 À, hiểu rồi!", "⌨️ Chạy được rồi!", "🤔 Sao lại lỗi nhỉ…", "👍"],
    conversations: [
      { roles: ["curriculum", "teacher"], lines: [[0, "Khoá Python mình chia 8 tuần nhé."], [1, "Tuần 3 nên thêm buổi thực hành."], [0, "Ok, mình dồn lý thuyết lại."], [1, "Cuối khoá làm dự án nhỏ là đẹp."]] },
      { roles: ["qa", "curriculum"], lines: [[0, "Mục tiêu module 2 chưa đo được."], [1, "Đổi thành 'viết được hàm có tham số'?"], [0, "Chuẩn, vậy mới chấm được."]] },
      { roles: ["advisor", "teacher"], lines: [[0, "Lớp tối nay nhiều bạn trái ngành."], [1, "Mình sẽ đi chậm phần đầu."], [0, "Cảm ơn thầy, các bạn sẽ đỡ ngợp."]] },
      { roles: ["director", "advisor"], lines: [[0, "Học viên phản hồi khoá trước thế nào?"], [1, "Đa số hài lòng, muốn thêm thực hành."], [0, "Ghi vào kế hoạch khoá sau nhé."]] },
      { roles: ["teacher", "ta"], lines: [[0, "Buổi sau em hỗ trợ cuối lớp nhé."], [1, "Dạ, em chuẩn bị bài tập luôn."], [0, "Nhớ gom câu hỏi hay gặp."]] },
      { roles: ["admissions", "advisor"], lines: [[0, "Khoá Data đang nhiều người hỏi."], [1, "Đa số muốn học cuối tuần."], [0, "Mình mở thêm lớp thứ bảy."]] },
      { roles: ["teacher", "teacher"], lines: [[0, "Lớp cậu hôm qua sao rồi?"], [1, "Ổn, các bạn rất chăm."], [0, "Lớp tớ thì đang vật lộn với đệ quy."], [1, "Vẽ cây gọi hàm ra là dễ hiểu ngay."]] },
      { roles: ["*", "*"], lines: [[0, "Trưa nay ăn gì nhỉ?"], [1, "Cơm văn phòng đi!"], [0, "Chốt! Hâm bằng lò vi sóng nhé."]] },
      { roles: ["*", "*"], lines: [[0, "Cuối tuần định làm gì?"], [1, "Học thêm về Docker."], [0, "Lại học à? Nghỉ ngơi chút đi!"]] },
      { roles: ["*", "*"], lines: [[0, "Hôm nay deploy có lỗi không?"], [1, "Không, chạy mượt."], [0, "Tuyệt, thứ sáu yên bình!"]] },
    ],
  },

  en: {
    activity: {
      coffee: {
        "*": ["One coffee, then back to work", "Some water to stay sharp", "Refuelling!"],
        director: ["A cup before reviewing lesson plans", "Black coffee – like code without comments"],
        teacher: ["Saving my voice for the afternoon class", "Warm water for the instructor's throat"],
        curriculum: ["Caffeine to reorder 12 weeks of lessons", "One more cup and the outline is done"],
      },
      snack: { "*": ["A quick snack", "Cold yoghurt!", "Who left cake in the fridge?"] },
      lunch: { "*": ["Lunch box is hot, let's eat", "Reheating lunch", "Home-cooked lunch, saving money!"] },
      window: {
        "*": ["Resting my eyes on the view", "Lovely weather", "Busy streets"],
        teacher: ["Thinking of a simpler example…", "Tonight's class will be full"],
        advisor: ["How many people out there want to switch to IT…"],
      },
      read: {
        "*": ["Reading new docs", "A book on Clean Code", "Revisiting algorithms"],
        curriculum: ["A new IT skills framework", "Reading about project-based learning"],
        qa: ["How to write good rubrics", "Assessment standards"],
        teacher: ["Reviewing next week's lesson", "Python for beginners"],
      },
      sofa: { "*": ["Five minutes, then back", "Resting my eyes", "A short break clears the mind"] },
      smoke: { "*": ["One smoke to clear my head…", "Then back to reviewing lesson plans", "I know, I should quit… tomorrow", "What course should we open next?"] },
    },
    handoff: {
      "*": ["My part's done – over to you!", "Here are the materials, ping me with questions.", "Done here, passing it on!"],
      director: ["Printed and ready for your review.", "Here's the document for your sign-off."],
    },
    teach: [
      "Today we start a new topic!", "Open your laptops and create main.py.", "Loops let us repeat work.",
      "Has anyone run this snippet yet?", "This error is a missing colon.", "A variable is like a labelled box.",
      "Now a 10-minute exercise.", "Any questions?", "Functions keep code short and reusable.", "Remember to commit to Git!",
    ],
    cls: ["Noting learners' questions", "Desk 3 needs help", "Preparing homework", "Checking the projector…", "Attendance done"],
    student: ["✍️ Taking notes…", "🙋 Question, please!", "💡 Oh, I get it!", "⌨️ It runs!", "🤔 Why the error…", "👍"],
    conversations: [
      { roles: ["curriculum", "teacher"], lines: [[0, "Let's split the Python course into 8 weeks."], [1, "Week 3 needs an extra lab."], [0, "OK, I'll compress the theory."], [1, "A small final project would be great."]] },
      { roles: ["qa", "curriculum"], lines: [[0, "Module 2's outcome isn't measurable."], [1, "'Can write a function with parameters'?"], [0, "Perfect, now we can grade it."]] },
      { roles: ["advisor", "teacher"], lines: [[0, "Many career changers in tonight's class."], [1, "I'll take the first part slowly."], [0, "Thanks, that'll help a lot."]] },
      { roles: ["director", "advisor"], lines: [[0, "How was feedback on the last course?"], [1, "Mostly happy, they want more labs."], [0, "Add that to the next plan."]] },
      { roles: ["teacher", "ta"], lines: [[0, "Can you support from the back next class?"], [1, "Sure, I'll prepare exercises too."], [0, "Collect the common questions."]] },
      { roles: ["admissions", "advisor"], lines: [[0, "Lots of enquiries for the Data course."], [1, "Most want weekend classes."], [0, "Let's open a Saturday class."]] },
      { roles: ["teacher", "teacher"], lines: [[0, "How was your class yesterday?"], [1, "Good, very motivated group."], [0, "Mine is wrestling with recursion."], [1, "Draw the call tree – it clicks instantly."]] },
      { roles: ["*", "*"], lines: [[0, "What's for lunch?"], [1, "Lunch boxes?"], [0, "Deal! Microwave's free."]] },
      { roles: ["*", "*"], lines: [[0, "Plans for the weekend?"], [1, "Learning more Docker."], [0, "Studying again? Take a break!"]] },
      { roles: ["*", "*"], lines: [[0, "Any errors in today's deploy?"], [1, "None, smooth as butter."], [0, "A peaceful Friday!"]] },
    ],
  },

  ja: {
    activity: {
      coffee: {
        "*": ["コーヒーを一杯飲んでから続けよう", "水分補給", "エネルギー補給！"],
        director: ["指導案の審査前に一杯", "ブラック、コメントのないコードみたいに"],
        teacher: ["午後の授業のために喉を休める", "講師の喉には白湯"],
        curriculum: ["12週分を組み直すにはカフェインが必要", "もう一杯でシラバス完成"],
      },
      snack: { "*": ["ちょっとおやつ", "冷たいヨーグルト！", "冷蔵庫のケーキは誰の？"] },
      lunch: { "*": ["お弁当が温まった、いただきます", "お昼を温め中", "手作り弁当で節約！"] },
      window: {
        "*": ["遠くを見て目を休める", "いい天気だ", "人通りが多いね"],
        teacher: ["もっと分かりやすい例を考え中…", "今夜のクラスは満員かな"],
        advisor: ["ITに転職したい人はどれくらいいるかな…"],
      },
      read: {
        "*": ["新しいドキュメントを読む", "リーダブルコードの本", "アルゴリズムの復習"],
        curriculum: ["新しいITスキル標準", "プロジェクト型学習について"],
        qa: ["ルーブリックの書き方", "評価基準の資料"],
        teacher: ["来週の授業の予習", "初心者向けPythonの本"],
      },
      sofa: { "*": ["5分休んで再開", "画面から目を休める", "少し座って頭を整理"] },
      smoke: { "*": ["一服して頭をすっきり…", "吸い終わったら指導案の確認だ", "やめなきゃな…明日から", "次はどんな講座を開こうか"] },
    },
    handoff: {
      "*": ["私の担当は終わりました、続きをお願いします！", "資料です、質問があれば声をかけてください。", "完了、バトンタッチ！"],
      director: ["印刷しました。ご確認をお願いします。", "資料です、承認をお願いします。"],
    },
    teach: [
      "今日は新しい単元です！", "PCを開いて main.py を作りましょう。", "ループで作業を繰り返せます。",
      "このコードを実行してみた人は？", "このエラーはコロンの付け忘れです。", "変数は名前付きの箱のようなもの。",
      "では10分間の演習です。", "質問はありますか？", "関数でコードを短く再利用可能に。", "Gitへのコミットを忘れずに！",
    ],
    cls: ["受講者の質問をメモ", "3番の席がサポート待ち", "宿題を準備中", "プロジェクターを確認…", "出席確認完了"],
    student: ["✍️ メモ中…", "🙋 質問です！", "💡 なるほど！", "⌨️ 動いた！", "🤔 なぜエラー…", "👍"],
    conversations: [
      { roles: ["curriculum", "teacher"], lines: [[0, "Pythonコースは8週に分けましょう。"], [1, "3週目に演習を追加したいです。"], [0, "了解、理論を圧縮します。"], [1, "最後に小さな課題があると良いですね。"]] },
      { roles: ["qa", "curriculum"], lines: [[0, "モジュール2の目標が測定できません。"], [1, "「引数付きの関数を書ける」では？"], [0, "完璧、これで採点できます。"]] },
      { roles: ["advisor", "teacher"], lines: [[0, "今夜のクラスは異業種の方が多いです。"], [1, "最初はゆっくり進めます。"], [0, "ありがとうございます。"]] },
      { roles: ["director", "advisor"], lines: [[0, "前回のコースの反応は？"], [1, "概ね好評、演習をもっと増やしてほしいと。"], [0, "次の計画に入れよう。"]] },
      { roles: ["teacher", "ta"], lines: [[0, "次の授業は後ろでサポートを頼むね。"], [1, "はい、演習問題も準備します。"], [0, "よくある質問を集めておいて。"]] },
      { roles: ["admissions", "advisor"], lines: [[0, "データコースの問い合わせが多いです。"], [1, "週末希望が多いですね。"], [0, "土曜クラスを開きましょう。"]] },
      { roles: ["teacher", "teacher"], lines: [[0, "昨日のクラスはどうだった？"], [1, "みんなとても熱心だったよ。"], [0, "こっちは再帰に苦戦中。"], [1, "呼び出しの木を描くとすぐ分かるよ。"]] },
      { roles: ["*", "*"], lines: [[0, "お昼は何にする？"], [1, "お弁当にしよう！"], [0, "決まり！電子レンジ空いてるよ。"]] },
      { roles: ["*", "*"], lines: [[0, "週末の予定は？"], [1, "Dockerを勉強するよ。"], [0, "また勉強？たまには休もうよ！"]] },
      { roles: ["*", "*"], lines: [[0, "今日のデプロイでエラーは？"], [1, "なし、順調です。"], [0, "平和な金曜日だ！"]] },
    ],
  },
};

const cur = () => D[getLang()] || D.vi;
export const pick = list => list[Math.floor(Math.random() * list.length)];

export function activityLine(kind, role) {
  const k = cur().activity[kind] || cur().activity.coffee;
  return pick(k[role] && Math.random() < 0.65 ? k[role] : k["*"]);
}
export const handoffLine = (fromRole, toRole) => pick(cur().handoff[toRole] || cur().handoff["*"]);
export const teachLine = () => pick(cur().teach);
export const classLine = () => pick(cur().cls);
export const studentLine = () => pick(cur().student);

// Chọn hội thoại phù hợp với cặp vai trò; trả về các dòng đã quy đổi về góc nhìn [a, b].
export function pickConversation(a, b) {
  const list = cur().conversations;
  const specific = [];
  for (const c of list) {
    const [r0, r1] = c.roles;
    if (r0 === a && r1 === b) specific.push(c.lines);
    else if (r0 === b && r1 === a) specific.push(c.lines.map(([who, text]) => [1 - who, text]));
  }
  const generic = list.filter(c => c.roles[0] === "*").map(c => c.lines);
  const pool = specific.length && Math.random() < 0.7 ? specific : generic;
  return pool[Math.floor(Math.random() * pool.length)];
}
