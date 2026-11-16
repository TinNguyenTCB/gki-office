// Đa ngôn ngữ: Tiếng Việt (mặc định), English, 日本語.
// t("key", { name }) trả về chuỗi theo ngôn ngữ hiện tại (thiếu thì rơi về tiếng Việt).
// Phần tử HTML gắn data-i18n / data-i18n-html / data-i18n-placeholder / data-i18n-title / data-i18n-aria-label
// được applyI18n() tự cập nhật.

export const LANGS = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
];
const LANG_KEY = "ai-office-lang";

const pad = n => String(n).padStart(2, "0");

const DICT = {
  vi: {
    "doc.title": "GKI – Trung tâm đào tạo CNTT",
    "brand.tagline": "Trung tâm đào tạo CNTT vận hành bởi đội ngũ AI",
    "common.loading": "Đang tải…",
    "a11y.openMenu": "Mở menu", "a11y.openTask": "Mở khung giao việc", "a11y.collapse": "Thu gọn", "a11y.openReport": "Mở báo cáo", "a11y.openTeam": "Mở đội ngũ",
    "a11y.office": "Văn phòng GKI", "a11y.task": "Giao nhiệm vụ",
    "conn.connecting": "Đang kết nối…", "conn.on": "Đã kết nối", "conn.off": "Mất kết nối", "conn.preview": "Bản xem thử", "conn.title": "Kết nối backend",

    "menu.title": "Menu", "menu.close": "Đóng menu",
    "menu.language": "Ngôn ngữ",
    "menu.ai": "Cài đặt AI", "menu.leaderModel": "Giám đốc đào tạo", "menu.teamModel": "Đội ngũ (giảng viên & chuyên viên)",
    "menu.modelHint": "Model thiếu API key trong <code>.env</code> sẽ bị khoá.",
    "menu.client": "Khách hàng", "menu.furniture": "Nội thất",
    "menu.display": "Hiển thị & thử nghiệm", "menu.showReport": "Khung báo cáo (trái)", "menu.showSide": "Đội ngũ & nhật ký (phải)",
    "menu.runDemo": "Chạy mô phỏng (không tốn API)", "menu.replayIntro": "Xem lại màn chào",

    "models.noKey": "(thiếu API key)", "models.offline": "Không có máy chủ AI – chế độ mô phỏng",

    "client.unsigned": "Chưa ký đơn cam kết.", "client.viewPledge": "Xem đơn cam kết", "client.resign": "Ký lại tên khác",
    "client.badge": "Quý khách {name}", "client.info": "Quý khách {name} · ký ngày {date} · {no}",
    "client.address": "Quý khách {name}", "client.guest": "Khách",

    "furn.enable": "Bật chế độ sắp xếp", "furn.done": "Xong sắp xếp",
    "furn.help": "Chọn món rồi bấm lên sàn để đặt. Kéo để di chuyển · <kbd>R</kbd> xoay · <kbd>Del</kbd> xoá · <kbd>Esc</kbd> huỷ.",
    "furn.count": "({n} món)", "furn.none": "Chưa chọn món nào.",
    "furn.selected": "{label} · hướng {deg}°", "furn.ready": "Sẵn sàng đặt: {label} · hướng {deg}°",
    "furn.seatedLabel": "Bàn mặc định của", "furn.emptyDesk": "— Bàn trống —", "furn.emptyLabel": "Bàn trống",
    "furn.rotate": "Xoay 90°", "furn.delete": "Xoá", "furn.reset": "Mặc định", "furn.confirm": "Bấm lần nữa để xác nhận",
    "furn.cantPlace": "Không đặt được ở đây: chồng lên đồ khác hoặc ra ngoài phòng.",
    "furn.shiftHint": "Giữ Shift để đặt tiếp món tương tự.", "furn.placed": "Đã đặt {label}. Kéo để di chuyển, R để xoay.",
    "furn.cantRotate": "Không xoay được: sẽ chạm đồ khác hoặc tường.", "furn.deleted": "Đã xoá {label}.",
    "furn.restored": "Đã khôi phục bố trí mặc định.", "furn.placing": "Đang đặt {label}: bấm lên sàn (R để xoay, Shift để đặt nhiều).",
    "furn.cancelPlace": "Đã huỷ đặt đồ.", "furn.assigned": "Bàn này là bàn mặc định của {title}.", "furn.unassigned": "Bàn đã trống.",
    "furn.storageFail": "Không lưu được bố trí trên trình duyệt này (localStorage bị chặn).",
    "furn.warn.noDesk": "{title} chưa có bàn – sẽ đứng chờ ở khu trống.", "furn.warn.blocked": "Ghế của {title} đang bị chặn lối đi.",
    "furn.warn.noWhiteboard": "Không có bảng trắng: Giám đốc sẽ lập kế hoạch tại bàn.",
    "furn.warn.noBookshelf": "Không có kệ sách: mọi người sẽ tra tài liệu tại bàn.",
    "furn.warn.noPrinter": "Không có máy in: tài liệu sẽ được nộp trực tiếp, Trợ giảng chính không cần ra máy in.",
    "furn.warn.noCabinet": "Không có tủ hồ sơ: tài liệu vẫn lưu được nhưng Trợ giảng chính không có chỗ cất.", "furn.warn.noTrash": "Không có thùng rác: Trợ giảng chính sẽ bỏ túi giấy vo.",
    "furn.item.desk": "Bàn làm việc", "furn.item.meeting": "Bàn họp", "furn.item.bookshelf": "Kệ sách", "furn.item.whiteboard": "Bảng trắng",
    "furn.item.printer": "Máy in", "furn.item.watercooler": "Cây nước", "furn.item.vending": "Máy bán nước", "furn.item.sofa": "Sofa",
    "furn.item.plant": "Cây cảnh", "furn.item.chair": "Ghế",
    "furn.item.cabinet": "Tủ hồ sơ", "furn.item.trash": "Thùng rác",

    "report.title": "Tài liệu đào tạo", "report.copy": "Sao chép", "report.copied": "Đã chép", "report.copyFail": "Không chép được",
    "report.placeholder": "Tài liệu (đề cương, lộ trình, giáo án) sẽ xuất hiện ở đây sau khi Giám đốc đào tạo duyệt và ký.",
    "report.meta": "Gửi: {client} · {time} · {models} · {secs}s", "report.demoTag": "MÔ PHỎNG",
    "report.fromServer": "Báo cáo gần nhất trên máy chủ", "report.failed": "Nhiệm vụ thất bại:\n{error}",
    "report.expand": "Phóng to toàn màn hình", "report.shrink": "Thu nhỏ lại", "report.save": "Lưu vào tủ hồ sơ", "report.saved": "Đã lưu trong tủ", "report.delete": "Xoá", "report.confirmDelete": "Bấm lần nữa để xoá", "report.toastSaved": "Đã cất báo cáo vào tủ hồ sơ", "log.filed": "Đã cất vào tủ hồ sơ: {title}", "report.toastDeleted": "Đã xoá báo cáo", "report.untitled": "Báo cáo không tên", "report.fromArchive": "Từ tủ hồ sơ · lưu lúc {time}", "cabinet.title": "Tủ hồ sơ", "cabinet.open": "Mở tủ hồ sơ", "cabinet.close": "Đóng", "cabinet.count": "{n}/{max} báo cáo đã lưu", "cabinet.empty": "Tủ hồ sơ đang trống. Bấm “Lưu vào tủ hồ sơ” bên dưới báo cáo để cất lại.", "cabinet.view": "Xem", "cabinet.delete": "Xoá", "cabinet.confirm": "Chắc chưa?", "cabinet.current": "Đang mở", "cabinet.full": "Tủ hồ sơ đã đầy ({n} báo cáo). Hãy xoá bớt trước khi lưu thêm.", "cabinet.storageFail": "Trình duyệt không cho lưu thêm (bộ nhớ đầy hoặc chế độ ẩn danh).", "cabinet.hint": "Mẹo: bấm vào tủ hồ sơ trong văn phòng để mở tủ.",
    "team.title": "Đội ngũ", "log.title": "Nhật ký hoạt động",
    "team.status.idle": "Rảnh", "team.status.thinking": "Lập kế hoạch", "team.status.working": "Đang làm",
    "team.status.reviewing": "Duyệt tài liệu", "team.status.done": "Xong", "team.status.error": "Lỗi",

    "zoom.group": "Thu phóng văn phòng", "zoom.out": "Thu nhỏ ( - )", "zoom.in": "Phóng to ( + )", "zoom.reset": "Về mặc định ( 0 hoặc nhấp đúp )",

    "task.placeholder": "Nhập yêu cầu cho trung tâm…",
    "task.send": "Giao việc", "task.sendDemo": "Giao việc (mô phỏng)", "task.busy": "Đang làm…", "task.sending": "Đang gửi…",
    "task.needPledge": "Vui lòng ký Đơn cam kết trước",
    "task.hint": "Ctrl + Enter để gửi · Lăn chuột để phóng to, kéo để di chuyển, nhấp đúp để về mặc định · Tài liệu do AI soạn, chỉ mang tính tham khảo.",

    "status.connecting": "Đang kết nối backend…", "status.connected": "Đã kết nối.", "status.ready": "Sẵn sàng phục vụ {client}.",
    "status.offline": "Bản xem thử trên GitHub Pages – chưa có máy chủ AI. “Giao việc” sẽ chạy mô phỏng với nội dung ví dụ.",
    "status.busy": "Văn phòng đang xử lý một nhiệm vụ.", "status.accepted": "Đã nhận nhiệm vụ: {prompt}",
    "status.done": "Hoàn thành! Tài liệu ở khung bên trái.", "status.error": "Lỗi: {error}",
    "status.disconnected": "Mất kết nối backend – thử lại sau {s} giây… (nút “Giao việc” sẽ chạy bằng mô phỏng)",
    "status.noKeys": "Chưa có API key nào trong .env – thêm key rồi khởi động lại backend.",
    "status.modelsFail": "Không tải được danh sách model: {error}",
    "status.needPledge": "Quý khách cần ký Đơn cam kết trước khi giao việc.", "status.emptyPrompt": "Hãy nhập yêu cầu cho văn phòng trước đã.",
    "status.rejected": "Không giao được việc: {detail}", "status.sendFail": "Không gửi được tới backend: {error}",

    "toast.demo": "Đang chạy mô phỏng – không gọi API, dữ liệu hư cấu",
    "toast.demoOffline": "Bản xem thử: chạy mô phỏng – không gọi AI, dữ liệu hư cấu",
    "toast.signed": "Đã ký cam kết – chào mừng {client}!", "toast.welcomeBack": "Chào mừng {client} quay lại!",
    "toast.resigned": "Văn phòng sẽ làm việc với {client}",

    "log.open": "Văn phòng mở cửa.", "log.handoff": "{from} → {to}: bàn giao{msg}", "log.newJob": "Nhiệm vụ mới: {prompt}",
    "log.approved": "Giám đốc đào tạo đã ký duyệt tài liệu.", "log.failed": "Nhiệm vụ thất bại: {error}",
    "log.signed": "{client} đã ký Đơn cam kết ({no}).",

    "greet.ohGuest": "Ồ, có khách!", "greet.hello": "Xin chào! Chào mừng Quý khách đến với GKI.",
    "greet.intro": "Tôi là Giám đốc đào tạo. Đội ngũ của chúng tôi thiết kế khoá học, tư vấn lộ trình và đứng lớp theo yêu cầu của Quý khách.",
    "greet.pledge": "Trước khi bắt đầu, mời Quý khách đọc và ký Đơn cam kết.", "greet.readTerms": "Mời Quý khách xem kỹ các điều khoản…",
    "greet.thanks": "Cảm ơn {client}! Rất hân hạnh được đồng hành cùng Quý khách.", "greet.giveTask": "Mời Quý khách giao nhiệm vụ ở khung phía dưới.",
    "greet.welcomeBack": "Chào mừng {client} quay lại!", "greet.reportReady": "Báo cáo đã sẵn sàng, mời {client} xem.",
    "greet.reportReadyAnon": "Báo cáo đã sẵn sàng!", "greet.resigned": "Rất vui được làm việc với {client}!",

    "intro.tag": "Trung tâm đào tạo CNTT vận hành bởi đội ngũ AI", "intro.hello": "Xin chào, chào mừng Quý khách!",
    "intro.chooseLang": "Chọn ngôn ngữ", "intro.enter": "Vào văn phòng",

    "pledge.title": "ĐƠN CAM KẾT SỬ DỤNG DỊCH VỤ", "pledge.lead": "Tôi, người ký tên dưới đây, xác nhận đã đọc và hiểu rõ:",
    "pledge.t1": "Đội ngũ của GKI là <strong>trợ lý AI</strong> (mô hình ngôn ngữ) đóng vai giảng viên và chuyên viên đào tạo.",
    "pledge.t2": "Đề cương, lộ trình, giáo án chỉ mang tính <strong>tham khảo</strong>; cần người có chuyên môn rà soát trước khi sử dụng.",
    "pledge.t3": "AI có thể sai hoặc dùng thông tin <strong>đã lỗi thời</strong> (phiên bản công nghệ, chứng chỉ, học phí, thị trường việc làm). Tôi sẽ tự kiểm chứng khi cần.",
    "pledge.t4": "Kết quả học tập phụ thuộc vào nỗ lực của người học; GKI không cam kết đầu ra hay việc làm.",
    "pledge.t5": "Tôi không nhập thông tin nhạy cảm (mật khẩu, số tài khoản, giấy tờ tuỳ thân…). Nội dung yêu cầu sẽ được gửi tới nhà cung cấp AI đã chọn để xử lý.",
    "pledge.t6": "Tên của tôi chỉ được lưu trên trình duyệt này để văn phòng xưng hô.",
    "pledge.nameLabel": "Họ và tên khách hàng", "pledge.namePlaceholder": "Nhập họ và tên của Quý khách",
    "pledge.agree": "Tôi đã đọc, hiểu và đồng ý với các điều trên.",
    "pledge.clientLabel": "KHÁCH HÀNG", "pledge.clientSub": "(ký, ghi rõ họ tên)",
    "pledge.officeLabel": "ĐẠI DIỆN GKI", "pledge.officeSub": "Giám đốc đào tạo (AI)", "pledge.officeSign": "Giám đốc AI",
    "pledge.stampRing": "GKI ✦ TRUNG TÂM ĐÀO TẠO CNTT ✦", "pledge.stampCenter": "ĐÃ DUYỆT",
    "pledge.submit": "Ký tên & đóng dấu", "pledge.close": "Đóng", "pledge.cancel": "Huỷ",
    "pledge.errName": "Vui lòng nhập họ và tên (ít nhất 2 ký tự).", "pledge.errAgree": "Quý khách cần đánh dấu đồng ý trước khi ký.",
    "pledge.no": "Số:",
    "pledge.date": d => `Ngày ${pad(d.getDate())} tháng ${pad(d.getMonth() + 1)} năm ${d.getFullYear()}`,

    "furn.item.laptopDesk": "Bàn laptop", "furn.item.podium": "Bục giảng", "furn.item.fridge": "Tủ lạnh mini", "furn.item.microwave": "Lò vi sóng", "sim.planWork": "Lập kế hoạch đào tạo", "sim.findMaterials": "Tìm tài liệu chuyên môn", "sim.readMaterials": "Đọc tài liệu tham khảo", "sim.toFridge": "Lấy đồ trong tủ lạnh", "sim.toMicrowave": "Hâm cơm trưa", "sim.heating": "🍱 Đang hâm…", "sim.toClass": "Lên lớp thôi!", "sim.toBackRow": "Ra cuối lớp hỗ trợ", "task.kind": "Loại nhiệm vụ", "task.members": "Thành viên", "task.teacher": "Giảng viên", "task.assistant": "Trợ giảng 1", "task.noAssistant": "— Không có —", "task.room": "Phòng học", "task.students": "Học viên", "task.needMember": "Hãy chọn ít nhất 1 thành viên tham gia.", "task.needTeacher": "Cần có một giảng viên để dạy buổi học.", "task.lessonFail": "Không bắt đầu được buổi học (thiếu bàn học hoặc lối vào lớp bị chặn).", "log.lessonStart": "{teacher} bắt đầu dạy ở {room} ({n} học viên).", "log.lessonEnd": "Buổi học kết thúc, học viên ra về.", "work.mode": "Chế độ làm việc", "work.on": "Đã bật chế độ làm việc – mọi người sang bàn làm việc.", "work.off": "Đã tắt chế độ làm việc – mọi người về bàn mặc định.", "staff.manage": "Quản lý nhân viên", "staff.title": "Hồ sơ nhân viên", "staff.add": "Thêm nhân viên", "staff.name": "Tên", "staff.namePh": "Để trống = tên theo vai trò", "staff.role": "Vai trò", "staff.homeDesk": "Bàn mặc định", "staff.workDesk": "Bàn làm việc", "staff.sameDesk": "— Giống bàn mặc định —", "staff.noDesk": "— Chưa có bàn —", "staff.deskTaken": "đang dùng: {name}", "staff.deskHint": "Bàn mặc định: chỗ ngồi thường ngày. Bàn làm việc: nơi nhân viên chuyển sang khi bật “Chế độ làm việc” hoặc khi đang tham gia nhiệm vụ.", "staff.look": "Ngoại hình", "staff.skin": "Màu da", "staff.hair": "Màu tóc", "staff.hairStyle": "Kiểu tóc", "staff.outfit": "Trang phục", "staff.jacket": "Áo khoác", "staff.shirt": "Áo trong", "staff.accent": "Cà vạt / điểm nhấn", "staff.pants": "Quần / váy", "staff.acc": "Phụ kiện", "staff.random": "Ngẫu nhiên", "staff.delete": "Xoá nhân viên", "staff.confirm": "Bấm lần nữa để xoá", "staff.added": "Đã thêm {name} – đang đi từ cửa vào.", "staff.deleted": "Đã xoá {name}.", "staff.max": "Tối đa {n} nhân viên.", "staff.busy": "Đang có nhiệm vụ – đợi xong rồi hãy xoá hoặc đổi vai trò.", "staff.directorRole": "Giám đốc luôn giữ vai trò Giám đốc đào tạo.", "staff.turn": "Xoay", "staff.noDeskWarn": "Chưa có bàn trống – hãy kê thêm bàn trong mục Nội thất.", "staff.openHint": "Bấm vào một người trong danh sách để sửa hồ sơ.", "hair.short": "Ngắn", "hair.swept": "Vuốt", "hair.bun": "Búi", "hair.long": "Dài", "hair.bald": "Trọc", "outfit.suit": "Vest + cà vạt", "outfit.blazer": "Áo blazer", "outfit.shirt": "Sơ mi", "outfit.hoodie": "Hoodie", "acc.glasses": "Kính", "acc.beard": "Râu", "acc.headphones": "Tai nghe", "acc.lanyard": "Thẻ nhân viên", "acc.earrings": "Khuyên tai", "board.kind": "Loại: {x}", "board.lesson": "{room} · {n} học viên", "board.assistantTag": "trợ giảng cuối lớp", "board.teacherTag": "đứng lớp",
    "staff.gender": "Giới tính", "gender.male": "Nam", "gender.female": "Nữ", "layout.export": "Lưu ra file", "layout.import": "Mở file", "layout.hint": "Lưu bố cục, đồ đạc và hồ sơ nhân viên ra file để sao lưu hoặc mang sang máy khác.", "layout.exported": "Đã lưu {name} (thư mục Tải xuống).", "layout.imported": "Đã mở bố cục ({n} món đồ) và hồ sơ nhân viên.", "layout.importFail": "File không hợp lệ – hãy chọn file .json được lưu từ nút “Lưu ra file”.",
    "staff.bottom": "Quần / váy", "bottom.pants": "Quần", "bottom.skirt": "Váy",
    "task.defaultLesson": "Buổi học lập trình – giảng viên tự chọn chủ đề phù hợp với trình độ lớp.", "toast.demoNoServer": "Chưa kết nối máy chủ AI – chạy bằng mô phỏng (nội dung ví dụ).",
    "task.assistant2": "Trợ giảng 2",
    "hair.fade": "Cắt ngắn, cạo cao 2 bên",
    "sim.toSmoke": "Ra khu hút thuốc", "sim.stubOut": "Dụi tàn thuốc",
    "floor.name": "Tầng {n}", "floor.switch": "Chọn tầng", "room.f6r1": "Phòng 1", "room.f6r2": "Phòng 2", "room.f6r3": "Phòng 3", "room.f6lobby": "Sảnh", "room.f6hall": "Hành lang",
    "furn.warn.chairWall": "Ghế của {label} đang chạm vách – hãy kéo bàn ra xa vách một chút.",
    "furn.chairsFixed": "Đã chỉnh {n} bàn có ghế lọt qua vách (kéo bàn ra khỏi vách) – người ngồi không còn bị dính tường.",
    "task.seats": "{n} chỗ",
    "room.staff": "Phòng nhân viên", "room.cio": "Giám đốc", "room.private": "Phòng riêng", "room.classBig": "Phòng học 1", "room.classSmall": "Phòng học 2", "room.storageS": "Kho", "room.storageL": "Kho", "room.smoking": "Hút thuốc", "room.hall": "Lối đi", "room.lobby": "Hành lang", "room.entrance": "Lối vào", "wall.floor": "TẦNG {n}", "furn.item.studentDesk": "Bàn học", "furn.item.boxes": "Thùng hàng", "furn.item.rack": "Kệ kho", "furn.item.ashtray": "Gạt tàn", "furn.item.bench": "Ghế băng",
    "wall.tagline": "Đào tạo CNTT",
    "sim.getWater": "Đi lấy nước", "sim.findDocs": "Tìm tài liệu", "sim.toWindow": "Ra cửa sổ", "sim.sitRest": "Ngồi nghỉ chút",
    "sim.goChat": "Ra trò chuyện chút", "sim.assign": "Phân công nhiệm vụ",
    "sim.findReports": "Tìm tài liệu chuyên môn", "sim.readAnnual": "Đọc tài liệu tham khảo", "sim.print": "In báo cáo", "sim.printing": "Đang in…",
    "sim.handoffTo": "Bàn giao cho {name}", "sim.handoffDefault": "Phần của mình xong rồi nhé!", "sim.done": "Xong phần việc ✔",
    "sim.thinking": "💭 Đang suy nghĩ…", "sim.writing": "Đang viết…",
    "board.title": "Bảng phân công", "board.open": "Xem bảng phân công", "board.hint": "Mẹo: bấm vào bảng trắng trong văn phòng để xem nhiệm vụ và phân công.", "board.empty": "Chưa có nhiệm vụ nào. Hãy giao việc ở khung bên dưới – Giám đốc sẽ ra bảng trắng lập kế hoạch và phân công cho từng người.", "board.request": "Yêu cầu của khách hàng", "board.plan": "Phân công của Giám đốc", "board.started": "Bắt đầu {time}", "board.elapsed": "Thời gian {t}", "board.demo": "Chế độ mô phỏng", "board.state.planning": "Đang lập kế hoạch", "board.state.running": "Đang thực hiện", "board.state.finished": "Hoàn thành", "board.state.failed": "Thất bại", "board.state.stopped": "Đã dừng", "board.st.waiting": "Chờ", "board.st.active": "Đang làm", "board.st.done": "Xong", "board.st.error": "Lỗi", "board.deliver": "Bàn giao: {x}", "board.took": "Mất {t}", "board.since": "Từ {time}", "board.inputs": "Nhận đầu vào từ: {x}", "board.foot": "Mỗi người nhận kết quả của người trước; Giám đốc đào tạo tổng hợp và ký duyệt. Nội dung từng phần do AI tự soạn.",
    "printer.title": "Máy in", "printer.open": "Mở máy in", "printer.count": "{n} hồ sơ trong tủ · đã chọn {k}", "printer.empty": "Tủ hồ sơ đang trống. Hãy lưu báo cáo vào tủ trước khi in.", "printer.all": "Chọn tất cả", "printer.none": "Bỏ chọn", "printer.go": "In {k} hồ sơ", "printer.pick": "Chọn hồ sơ để in", "printer.hint": "Mẹo: bấm vào máy in trong văn phòng để mở danh sách in.", "printer.toast": "{name} đang in {k} hồ sơ…", "printer.busy": "Máy in đang chạy, đợi chút nhé.", "print.kind": "Tài liệu đào tạo", "print.client": "Khách hàng", "print.saved": "Lưu lúc", "print.printed": "In lúc", "print.info": "Thông tin", "print.footer": "Tài liệu do đội ngũ AI của GKI soạn, chỉ mang tính tham khảo – cần người có chuyên môn rà soát trước khi sử dụng.", "board.clear": "Hoàn tất – làm trống bảng", "board.clearBusy": "Đội đang làm, chưa thể làm trống bảng.", "board.cleared": "Đã làm trống bảng phân công.", "sim.toBoard": "Dọn bảng phân công", "sim.erasing": "🧽 Xoá kế hoạch cũ…", "sim.boardClean": "Bảng sạch rồi, sẵn sàng việc mới!", "log.boardCleared": "{name} đã làm trống bảng phân công.",
    "sim.toPrinter": "Ra máy in", "sim.printDone": "In xong rồi! 🖨️", "log.printed": "Đã in: {title}",
    "sim.toCabinet": "Cất vào tủ hồ sơ", "sim.filing": "🗂️ Lưu hồ sơ cẩn thận…", "sim.trashSay": "Bản này không cần nữa rồi…", "sim.crumple": "*sột soạt* 🤏", "sim.score": "Vào! 🗑️ Gọn gàng.", "sim.pocket": "Để lát bỏ thùng rác vậy.",
  },

  en: {
    "doc.title": "GKI – IT Training Center",
    "brand.tagline": "IT training center run by an AI team",
    "common.loading": "Loading…",
    "a11y.openMenu": "Open menu", "a11y.openTask": "Open the task box", "a11y.collapse": "Collapse", "a11y.openReport": "Open report", "a11y.openTeam": "Open team",
    "a11y.office": "GKI office", "a11y.task": "Assign a task",
    "conn.connecting": "Connecting…", "conn.on": "Connected", "conn.off": "Disconnected", "conn.preview": "Preview", "conn.title": "Backend connection",

    "menu.title": "Menu", "menu.close": "Close menu",
    "menu.language": "Language",
    "menu.ai": "AI settings", "menu.leaderModel": "Training Director", "menu.teamModel": "Team (instructors & specialists)",
    "menu.modelHint": "Models without an API key in <code>.env</code> are locked.",
    "menu.client": "Client", "menu.furniture": "Furniture",
    "menu.display": "Display & testing", "menu.showReport": "Report panel (left)", "menu.showSide": "Team & activity log (right)",
    "menu.runDemo": "Run simulation (no API cost)", "menu.replayIntro": "Replay welcome",

    "models.noKey": "(no API key)", "models.offline": "No AI server – simulation mode",

    "client.unsigned": "Commitment form not signed yet.", "client.viewPledge": "View commitment form", "client.resign": "Sign with another name",
    "client.badge": "{name}", "client.info": "{name} · signed {date} · {no}",
    "client.address": "{name}", "client.guest": "Guest",

    "furn.enable": "Enable arrange mode", "furn.done": "Done arranging",
    "furn.help": "Pick an item, then click the floor to place it. Drag to move · <kbd>R</kbd> rotate · <kbd>Del</kbd> delete · <kbd>Esc</kbd> cancel.",
    "furn.count": "({n} items)", "furn.none": "Nothing selected.",
    "furn.selected": "{label} · facing {deg}°", "furn.ready": "Ready to place: {label} · facing {deg}°",
    "furn.seatedLabel": "Default desk of", "furn.emptyDesk": "— Empty desk —", "furn.emptyLabel": "Empty desk",
    "furn.rotate": "Rotate 90°", "furn.delete": "Delete", "furn.reset": "Default", "furn.confirm": "Click again to confirm",
    "furn.cantPlace": "Can't place here: overlaps another item or is outside the room.",
    "furn.shiftHint": "Hold Shift to keep placing the same item.", "furn.placed": "Placed {label}. Drag to move, R to rotate.",
    "furn.cantRotate": "Can't rotate: it would hit another item or a wall.", "furn.deleted": "Deleted {label}.",
    "furn.restored": "Default layout restored.", "furn.placing": "Placing {label}: click the floor (R to rotate, Shift to place several).",
    "furn.cancelPlace": "Placement cancelled.", "furn.assigned": "This is now {title}'s default desk.", "furn.unassigned": "The desk is now empty.",
    "furn.storageFail": "Couldn't save the layout in this browser (localStorage is blocked).",
    "furn.warn.noDesk": "{title} has no desk – will wait in an open area.", "furn.warn.blocked": "{title}'s chair is blocked.",
    "furn.warn.noWhiteboard": "No whiteboard: the CIO will plan at the desk.",
    "furn.warn.noBookshelf": "No bookshelf: the team will look up materials at their desks.",
    "furn.warn.noPrinter": "No printer: documents are handed over directly; the Lead TA won't go to a printer.",
    "furn.warn.noCabinet": "No filing cabinet: documents can still be saved, but the Lead TA has nowhere to file them.", "furn.warn.noTrash": "No wastebasket: the Lead TA will pocket the crumpled paper.",
    "furn.item.desk": "Desk", "furn.item.meeting": "Meeting table", "furn.item.bookshelf": "Bookshelf", "furn.item.whiteboard": "Whiteboard",
    "furn.item.printer": "Printer", "furn.item.watercooler": "Water cooler", "furn.item.vending": "Vending machine", "furn.item.sofa": "Sofa",
    "furn.item.plant": "Plant", "furn.item.chair": "Chair",
    "furn.item.cabinet": "Filing cabinet", "furn.item.trash": "Wastebasket",

    "report.title": "Training document", "report.copy": "Copy", "report.copied": "Copied", "report.copyFail": "Couldn't copy",
    "report.placeholder": "Documents (syllabus, roadmap, lesson plan) appear here once the Training Director has reviewed and signed them.",
    "report.meta": "To: {client} · {time} · {models} · {secs}s", "report.demoTag": "SIMULATION",
    "report.fromServer": "Latest report on the server", "report.failed": "Task failed:\n{error}",
    "report.expand": "Full screen", "report.shrink": "Exit full screen", "report.save": "Save to cabinet", "report.saved": "Saved in cabinet", "report.delete": "Delete", "report.confirmDelete": "Click again to delete", "report.toastSaved": "Report filed in the cabinet", "log.filed": "Filed in the cabinet: {title}", "report.toastDeleted": "Report deleted", "report.untitled": "Untitled report", "report.fromArchive": "From the filing cabinet · saved {time}", "cabinet.title": "Filing cabinet", "cabinet.open": "Open filing cabinet", "cabinet.close": "Close", "cabinet.count": "{n}/{max} saved reports", "cabinet.empty": "The cabinet is empty. Click “Save to cabinet” under a report to file it.", "cabinet.view": "Open", "cabinet.delete": "Delete", "cabinet.confirm": "Sure?", "cabinet.current": "Showing", "cabinet.full": "The cabinet is full ({n} reports). Delete some before saving more.", "cabinet.storageFail": "The browser refused to store more (storage full or private mode).", "cabinet.hint": "Tip: click the filing cabinet in the office to open it.",
    "team.title": "Team", "log.title": "Activity log",
    "team.status.idle": "Idle", "team.status.thinking": "Planning", "team.status.working": "Working",
    "team.status.reviewing": "Reviewing", "team.status.done": "Done", "team.status.error": "Error",

    "zoom.group": "Office zoom", "zoom.out": "Zoom out ( - )", "zoom.in": "Zoom in ( + )", "zoom.reset": "Reset view ( 0 or double-click )",

    "task.placeholder": "Describe your request…",
    "task.send": "Assign", "task.sendDemo": "Assign (simulation)", "task.busy": "Working…", "task.sending": "Sending…",
    "task.needPledge": "Please sign the commitment form first",
    "task.hint": "Ctrl + Enter to send · Scroll to zoom, drag to pan, double-click to reset · AI-written documents are for reference only.",

    "status.connecting": "Connecting to the backend…", "status.connected": "Connected.", "status.ready": "Ready to serve you, {client}.",
    "status.offline": "Preview on GitHub Pages – no AI server. “Assign” runs a simulation with example content.",
    "status.busy": "The office is working on a task.", "status.accepted": "Task received: {prompt}",
    "status.done": "Done! The document is in the left panel.", "status.error": "Error: {error}",
    "status.disconnected": "Backend disconnected – retrying in {s}s… (“Assign” will run as a simulation)",
    "status.noKeys": "No API key in .env – add one and restart the backend.",
    "status.modelsFail": "Couldn't load the model list: {error}",
    "status.needPledge": "Please sign the commitment form before assigning a task.", "status.emptyPrompt": "Please type a request for the office first.",
    "status.rejected": "Couldn't assign the task: {detail}", "status.sendFail": "Couldn't reach the backend: {error}",

    "toast.demo": "Running a simulation – no API calls, fictional data",
    "toast.demoOffline": "Preview: running a simulation – no AI calls, fictional data",
    "toast.signed": "Form signed – welcome, {client}!", "toast.welcomeBack": "Welcome back, {client}!",
    "toast.resigned": "The office will now work with {client}",

    "log.open": "The office is open.", "log.handoff": "{from} → {to}: handover{msg}", "log.newJob": "New task: {prompt}",
    "log.approved": "The Training Director signed off the document.", "log.failed": "Task failed: {error}",
    "log.signed": "{client} signed the commitment form ({no}).",

    "greet.ohGuest": "Oh, a visitor!", "greet.hello": "Hello! Welcome to GKI.",
    "greet.intro": "I'm the Training Director. Our team designs courses, plans learning roadmaps and teaches classes for you.",
    "greet.pledge": "Before we begin, please read and sign our commitment form.", "greet.readTerms": "Please take a moment to read the terms…",
    "greet.thanks": "Thank you, {client}! It's a pleasure to work with you.", "greet.giveTask": "Please give us a task in the box below.",
    "greet.welcomeBack": "Welcome back, {client}!", "greet.reportReady": "Your report is ready, {client}.",
    "greet.reportReadyAnon": "The report is ready!", "greet.resigned": "Glad to work with you, {client}!",

    "intro.tag": "IT training center run by an AI team", "intro.hello": "Hello, and welcome!",
    "intro.chooseLang": "Choose your language", "intro.enter": "Enter the office",

    "pledge.title": "SERVICE COMMITMENT FORM", "pledge.lead": "I, the undersigned, confirm that I have read and understood the following:",
    "pledge.t1": "GKI's staff are <strong>AI assistants</strong> (language models) acting as instructors and training specialists.",
    "pledge.t2": "Syllabi, roadmaps and lesson plans are for <strong>reference</strong> only and should be reviewed by a qualified person before use.",
    "pledge.t3": "AI may be wrong or use <strong>outdated</strong> information (technology versions, certifications, fees, job market). I will verify where needed.",
    "pledge.t4": "Learning results depend on the learner's effort; GKI does not guarantee outcomes or jobs.",
    "pledge.t5": "I will not enter sensitive information (passwords, account numbers, ID documents…). My requests are sent to the selected AI provider for processing.",
    "pledge.t6": "My name is stored only in this browser so the office can address me.",
    "pledge.nameLabel": "Client full name", "pledge.namePlaceholder": "Enter your full name",
    "pledge.agree": "I have read, understood and agree to the above.",
    "pledge.clientLabel": "CLIENT", "pledge.clientSub": "(signature & full name)",
    "pledge.officeLabel": "ON BEHALF OF GKI", "pledge.officeSub": "Training Director (AI)", "pledge.officeSign": "AI Director",
    "pledge.stampRing": "GKI ✦ IT TRAINING CENTER ✦", "pledge.stampCenter": "APPROVED",
    "pledge.submit": "Sign & stamp", "pledge.close": "Close", "pledge.cancel": "Cancel",
    "pledge.errName": "Please enter your full name (at least 2 characters).", "pledge.errAgree": "Please tick the agreement box before signing.",
    "pledge.no": "No.",
    "pledge.date": d => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),

    "furn.item.laptopDesk": "Laptop desk", "furn.item.podium": "Lectern", "furn.item.fridge": "Mini fridge", "furn.item.microwave": "Microwave", "sim.planWork": "Planning the work", "sim.findMaterials": "Finding reference material", "sim.readMaterials": "Reading references", "sim.toFridge": "Raiding the fridge", "sim.toMicrowave": "Heating lunch", "sim.heating": "🍱 Heating…", "sim.toClass": "Off to class!", "sim.toBackRow": "Heading to the back row", "task.kind": "Task type", "task.members": "Team", "task.teacher": "Instructor", "task.assistant": "Assistant 1", "task.noAssistant": "— None —", "task.room": "Classroom", "task.students": "Learners", "task.needMember": "Pick at least one team member.", "task.needTeacher": "A class needs an instructor.", "task.lessonFail": "Couldn't start the class (no desks or the way in is blocked).", "log.lessonStart": "{teacher} started teaching in {room} ({n} learners).", "log.lessonEnd": "Class over – learners are heading home.", "work.mode": "Work mode", "work.on": "Work mode on – everyone moves to their work desk.", "work.off": "Work mode off – everyone returns to their default desk.", "staff.manage": "Manage staff", "staff.title": "Staff profiles", "staff.add": "Add staff", "staff.name": "Name", "staff.namePh": "Empty = role name", "staff.role": "Role", "staff.homeDesk": "Default desk", "staff.workDesk": "Work desk", "staff.sameDesk": "— Same as default —", "staff.noDesk": "— No desk —", "staff.deskTaken": "used by {name}", "staff.deskHint": "Default desk: the everyday seat. Work desk: where the person moves in Work mode or while on a task.", "staff.look": "Appearance", "staff.skin": "Skin tone", "staff.hair": "Hair colour", "staff.hairStyle": "Hairstyle", "staff.outfit": "Outfit", "staff.jacket": "Jacket", "staff.shirt": "Shirt", "staff.accent": "Tie / accent", "staff.pants": "Trousers / skirt", "staff.acc": "Accessories", "staff.random": "Randomise", "staff.delete": "Remove", "staff.confirm": "Click again to remove", "staff.added": "{name} added – walking in from the entrance.", "staff.deleted": "{name} removed.", "staff.max": "At most {n} staff.", "staff.busy": "A task is running – wait until it finishes to remove or change roles.", "staff.directorRole": "The Director always keeps the Training Director role.", "staff.turn": "Turn", "staff.noDeskWarn": "No free desk – add one under Furniture.", "staff.openHint": "Click a person to edit their profile.", "hair.short": "Short", "hair.swept": "Swept", "hair.bun": "Bun", "hair.long": "Long", "hair.bald": "Bald", "outfit.suit": "Suit & tie", "outfit.blazer": "Blazer", "outfit.shirt": "Shirt", "outfit.hoodie": "Hoodie", "acc.glasses": "Glasses", "acc.beard": "Beard", "acc.headphones": "Headphones", "acc.lanyard": "ID badge", "acc.earrings": "Earrings", "board.kind": "Type: {x}", "board.lesson": "{room} · {n} learners", "board.assistantTag": "back-row assistant", "board.teacherTag": "teaching",
    "staff.gender": "Gender", "gender.male": "Male", "gender.female": "Female", "layout.export": "Save to file", "layout.import": "Open file", "layout.hint": "Save the layout, furniture and staff profiles to a file to back them up or move them to another computer.", "layout.exported": "Saved {name} (Downloads folder).", "layout.imported": "Loaded the layout ({n} items) and staff profiles.", "layout.importFail": "Invalid file – choose a .json saved with “Save to file”.",
    "staff.bottom": "Trousers / skirt", "bottom.pants": "Trousers", "bottom.skirt": "Skirt",
    "task.defaultLesson": "A programming class – the instructor picks a topic suited to the class level.", "toast.demoNoServer": "No AI server connected – running a simulation (example content).",
    "task.assistant2": "Assistant 2",
    "hair.fade": "Short, high fade",
    "sim.toSmoke": "Off for a smoke", "sim.stubOut": "Stubbing it out",
    "floor.name": "Floor {n}", "floor.switch": "Choose floor", "room.f6r1": "Room 1", "room.f6r2": "Room 2", "room.f6r3": "Room 3", "room.f6lobby": "Lobby", "room.f6hall": "Corridor",
    "furn.warn.chairWall": "The chair of {label} touches a wall – drag the desk a little away from it.",
    "furn.chairsFixed": "Adjusted {n} desk(s) whose chair went through a wall – no more people stuck in walls.",
    "task.seats": "{n} seats",
    "room.staff": "Staff room", "room.cio": "CIO", "room.private": "Private", "room.classBig": "Classroom 1", "room.classSmall": "Classroom 2", "room.storageS": "Storage", "room.storageL": "Storage", "room.smoking": "Smoking", "room.hall": "Passage", "room.lobby": "Corridor", "room.entrance": "Entrance", "wall.floor": "FLOOR {n}", "furn.item.studentDesk": "Student desk", "furn.item.boxes": "Boxes", "furn.item.rack": "Storage rack", "furn.item.ashtray": "Ashtray", "furn.item.bench": "Bench",
    "wall.tagline": "IT Training",
    "sim.getWater": "Grabbing a drink", "sim.findDocs": "Looking for a book", "sim.toWindow": "To the window", "sim.sitRest": "Taking a seat",
    "sim.goChat": "Quick chat", "sim.assign": "Assigning tasks",
    "sim.findReports": "Finding reference material", "sim.readAnnual": "Reading references", "sim.print": "Printing the report", "sim.printing": "Printing…",
    "sim.handoffTo": "Handing over to {name}", "sim.handoffDefault": "My part is done!", "sim.done": "Part done ✔",
    "sim.thinking": "💭 Thinking…", "sim.writing": "Writing…",
    "board.title": "Task board", "board.open": "Open task board", "board.hint": "Tip: click the whiteboard in the office to see the mission and assignments.", "board.empty": "No task yet. Assign one below – the Director will plan at the whiteboard and assign each person.", "board.request": "Client request", "board.plan": "The Director's assignments", "board.started": "Started {time}", "board.elapsed": "Elapsed {t}", "board.demo": "Simulation mode", "board.state.planning": "Planning", "board.state.running": "In progress", "board.state.finished": "Completed", "board.state.failed": "Failed", "board.state.stopped": "Stopped", "board.st.waiting": "Waiting", "board.st.active": "Working", "board.st.done": "Done", "board.st.error": "Error", "board.deliver": "Deliverable: {x}", "board.took": "Took {t}", "board.since": "Since {time}", "board.inputs": "Input from: {x}", "board.foot": "Each person builds on the previous person's work; the Training Director consolidates and signs. Every part is written by AI.",
    "printer.title": "Printer", "printer.open": "Open printer", "printer.count": "{n} reports in the cabinet · {k} selected", "printer.empty": "The cabinet is empty. Save a report to the cabinet before printing.", "printer.all": "Select all", "printer.none": "Clear", "printer.go": "Print {k}", "printer.pick": "Select reports to print", "printer.hint": "Tip: click the printer in the office to open the print list.", "printer.toast": "{name} is printing {k} document(s)…", "printer.busy": "The printer is busy, one moment.", "print.kind": "Training document", "print.client": "Client", "print.saved": "Saved", "print.printed": "Printed", "print.info": "Details", "print.footer": "Written by GKI's AI team for reference only – have a qualified person review it before use.", "board.clear": "Done – clear the board", "board.clearBusy": "The team is still working; the board can't be cleared yet.", "board.cleared": "Task board cleared.", "sim.toBoard": "Clearing the task board", "sim.erasing": "🧽 Wiping the old plan…", "sim.boardClean": "Clean board, ready for the next job!", "log.boardCleared": "{name} cleared the task board.",
    "sim.toPrinter": "Off to the printer", "sim.printDone": "All printed! 🖨️", "log.printed": "Printed: {title}",
    "sim.toCabinet": "Filing the report", "sim.filing": "🗂️ Filed away neatly…", "sim.trashSay": "We won't need this one…", "sim.crumple": "*crinkle crinkle* 🤏", "sim.score": "Swish! 🗑️ Nice and tidy.", "sim.pocket": "I'll bin it later.",
  },

  ja: {
    "doc.title": "GKI – IT研修センター",
    "brand.tagline": "AIチームが運営するIT研修センター",
    "common.loading": "読み込み中…",
    "a11y.openMenu": "メニューを開く", "a11y.openTask": "依頼ボックスを開く", "a11y.collapse": "折りたたむ", "a11y.openReport": "レポートを開く", "a11y.openTeam": "チームを開く",
    "a11y.office": "GKIのオフィス", "a11y.task": "依頼を出す",
    "conn.connecting": "接続中…", "conn.on": "接続済み", "conn.off": "接続切れ", "conn.preview": "プレビュー版", "conn.title": "バックエンド接続",

    "menu.title": "メニュー", "menu.close": "メニューを閉じる",
    "menu.language": "言語",
    "menu.ai": "AI設定", "menu.leaderModel": "研修部長", "menu.teamModel": "チーム（講師・担当者）",
    "menu.modelHint": "<code>.env</code> にAPIキーがないモデルは選択できません。",
    "menu.client": "お客様", "menu.furniture": "家具",
    "menu.display": "表示とテスト", "menu.showReport": "レポート欄（左）", "menu.showSide": "チームと活動ログ（右）",
    "menu.runDemo": "シミュレーション実行（API不要）", "menu.replayIntro": "オープニングを再生",

    "models.noKey": "（APIキーなし）", "models.offline": "AIサーバーなし – シミュレーションモード",

    "client.unsigned": "同意書はまだ署名されていません。", "client.viewPledge": "同意書を見る", "client.resign": "別の名前で署名",
    "client.badge": "{name}様", "client.info": "{name}様 · 署名日 {date} · {no}",
    "client.address": "{name}様", "client.guest": "ゲスト",

    "furn.enable": "配置モードをオン", "furn.done": "配置を終了",
    "furn.help": "家具を選び、床をクリックして配置します。ドラッグで移動 · <kbd>R</kbd> 回転 · <kbd>Del</kbd> 削除 · <kbd>Esc</kbd> キャンセル。",
    "furn.count": "（{n}点）", "furn.none": "何も選択されていません。",
    "furn.selected": "{label} · 向き {deg}°", "furn.ready": "配置準備：{label} · 向き {deg}°",
    "furn.seatedLabel": "この席を使う人", "furn.emptyDesk": "— 空席 —", "furn.emptyLabel": "空席",
    "furn.rotate": "90°回転", "furn.delete": "削除", "furn.reset": "初期配置", "furn.confirm": "もう一度押して確定",
    "furn.cantPlace": "ここには置けません：他の家具と重なるか、部屋の外です。",
    "furn.shiftHint": "Shiftを押したままで同じ家具を続けて配置できます。", "furn.placed": "{label}を配置しました。ドラッグで移動、Rで回転。",
    "furn.cantRotate": "回転できません：他の家具か壁に当たります。", "furn.deleted": "{label}を削除しました。",
    "furn.restored": "初期配置に戻しました。", "furn.placing": "{label}を配置中：床をクリック（Rで回転、Shiftで連続配置）。",
    "furn.cancelPlace": "配置をキャンセルしました。", "furn.assigned": "この席は{title}の定位置になりました。", "furn.unassigned": "空席になりました。",
    "furn.storageFail": "このブラウザでは配置を保存できません（localStorageがブロックされています）。",
    "furn.warn.noDesk": "{title}の席がありません – 空いている場所で待機します。", "furn.warn.blocked": "{title}の椅子への通路がふさがれています。",
    "furn.warn.noWhiteboard": "ホワイトボードがないため、運用責任者は自席で計画を立てます。",
    "furn.warn.noBookshelf": "本棚がありません：資料は席で調べます。",
    "furn.warn.noPrinter": "プリンターがありません：資料は直接提出し、主任TAは印刷しません。",
    "furn.warn.noCabinet": "書類キャビネットがありません：保存はできますが、主任TAがしまう場所がありません。", "furn.warn.noTrash": "ゴミ箱がありません：主任TAは丸めた紙をポケットにしまいます。",
    "furn.item.desk": "デスク", "furn.item.meeting": "会議テーブル", "furn.item.bookshelf": "本棚", "furn.item.whiteboard": "ホワイトボード",
    "furn.item.printer": "プリンター", "furn.item.watercooler": "ウォーターサーバー", "furn.item.vending": "自動販売機", "furn.item.sofa": "ソファ",
    "furn.item.plant": "観葉植物", "furn.item.chair": "椅子",
    "furn.item.cabinet": "書類キャビネット", "furn.item.trash": "ゴミ箱",

    "report.title": "研修資料", "report.copy": "コピー", "report.copied": "コピーしました", "report.copyFail": "コピーできません",
    "report.placeholder": "研修部長が審査・承認すると、資料（シラバス・ロードマップ・指導案）がここに表示されます。",
    "report.meta": "宛先：{client} · {time} · {models} · {secs}秒", "report.demoTag": "シミュレーション",
    "report.fromServer": "サーバー上の最新レポート", "report.failed": "タスクが失敗しました：\n{error}",
    "report.expand": "全画面表示", "report.shrink": "全画面を終了", "report.save": "キャビネットに保存", "report.saved": "保存済み", "report.delete": "削除", "report.confirmDelete": "もう一度押すと削除", "report.toastSaved": "レポートをキャビネットにしまいました", "log.filed": "キャビネットに保存：{title}", "report.toastDeleted": "レポートを削除しました", "report.untitled": "無題のレポート", "report.fromArchive": "書類キャビネットより · 保存日時 {time}", "cabinet.title": "書類キャビネット", "cabinet.open": "書類キャビネットを開く", "cabinet.close": "閉じる", "cabinet.count": "保存済みレポート {n}/{max} 件", "cabinet.empty": "キャビネットは空です。レポート下の「キャビネットに保存」で保存できます。", "cabinet.view": "開く", "cabinet.delete": "削除", "cabinet.confirm": "本当に？", "cabinet.current": "表示中", "cabinet.full": "キャビネットがいっぱいです（{n} 件）。先にいくつか削除してください。", "cabinet.storageFail": "ブラウザに保存できませんでした（容量不足またはプライベートモード）。", "cabinet.hint": "ヒント：オフィスの書類キャビネットをクリックしても開けます。",
    "team.title": "チーム", "log.title": "活動ログ",
    "team.status.idle": "待機中", "team.status.thinking": "計画中", "team.status.working": "作業中",
    "team.status.reviewing": "審査中", "team.status.done": "完了", "team.status.error": "エラー",

    "zoom.group": "オフィスの拡大縮小", "zoom.out": "縮小（ - ）", "zoom.in": "拡大（ + ）", "zoom.reset": "表示をリセット（ 0 またはダブルクリック ）",

    "task.placeholder": "ご依頼内容を入力…",
    "task.send": "依頼する", "task.sendDemo": "依頼する（シミュレーション）", "task.busy": "作業中…", "task.sending": "送信中…",
    "task.needPledge": "先に同意書に署名してください",
    "task.hint": "Ctrl + Enter で送信 · ホイールで拡大、ドラッグで移動、ダブルクリックで元に戻す · AIが作成した資料は参考用です。",

    "status.connecting": "バックエンドに接続中…", "status.connected": "接続しました。", "status.ready": "{client}、ご依頼をお待ちしています。",
    "status.offline": "GitHub Pages のプレビュー版 – AIサーバーはありません。「依頼する」は例の内容でシミュレーションします。",
    "status.busy": "オフィスは別のタスクを処理中です。", "status.accepted": "依頼を受け付けました：{prompt}",
    "status.done": "完了！資料は左側のパネルにあります。", "status.error": "エラー：{error}",
    "status.disconnected": "バックエンドとの接続が切れました – {s}秒後に再接続…（「依頼する」はシミュレーションで実行されます）",
    "status.noKeys": ".env にAPIキーがありません – キーを追加してバックエンドを再起動してください。",
    "status.modelsFail": "モデル一覧を読み込めません：{error}",
    "status.needPledge": "依頼の前に同意書へのご署名が必要です。", "status.emptyPrompt": "まずオフィスへのご依頼を入力してください。",
    "status.rejected": "依頼できませんでした：{detail}", "status.sendFail": "バックエンドに送信できません：{error}",

    "toast.demo": "シミュレーション実行中 – APIは使わず、データは架空です",
    "toast.demoOffline": "プレビュー版：シミュレーション実行中 – AIは使わず、データは架空です",
    "toast.signed": "署名完了 – ようこそ、{client}！", "toast.welcomeBack": "{client}、おかえりなさいませ！",
    "toast.resigned": "今後は{client}を担当いたします",

    "log.open": "オフィスが開きました。", "log.handoff": "{from} → {to}：引き継ぎ{msg}", "log.newJob": "新しい依頼：{prompt}",
    "log.approved": "研修部長が資料を承認しました。", "log.failed": "タスク失敗：{error}",
    "log.signed": "{client}が同意書に署名しました（{no}）。",

    "greet.ohGuest": "おや、お客様だ！", "greet.hello": "いらっしゃいませ！GKIへようこそ。",
    "greet.intro": "研修部長です。私たちのチームがコース設計、学習ロードマップの作成、授業を行います。",
    "greet.pledge": "始める前に、同意書をお読みいただき、ご署名をお願いします。", "greet.readTerms": "内容をご確認ください…",
    "greet.thanks": "{client}、ありがとうございます！ご一緒できて光栄です。", "greet.giveTask": "下の欄からご依頼をどうぞ。",
    "greet.welcomeBack": "{client}、おかえりなさいませ！", "greet.reportReady": "{client}、レポートの準備ができました。",
    "greet.reportReadyAnon": "レポートが完成しました！", "greet.resigned": "{client}、よろしくお願いいたします！",

    "intro.tag": "AIチームが運営するIT研修センター", "intro.hello": "ようこそ、いらっしゃいませ！",
    "intro.chooseLang": "言語を選択", "intro.enter": "オフィスに入る",

    "pledge.title": "サービス利用同意書", "pledge.lead": "私（下記署名者）は、以下の内容を読み、理解したことを確認します。",
    "pledge.t1": "GKIのスタッフは講師・研修担当を務める<strong>AIアシスタント</strong>（言語モデル）です。",
    "pledge.t2": "シラバス・ロードマップ・指導案は<strong>参考</strong>用です。使用前に専門家の確認が必要です。",
    "pledge.t3": "AIは誤ったり<strong>古い</strong>情報（技術のバージョン、資格、受講料、求人市場）を使ったりすることがあります。必要に応じて自分で確認します。",
    "pledge.t4": "学習成果は受講者の努力によります。GKIは成果や就職を保証しません。",
    "pledge.t5": "機密情報（パスワード、口座番号、身分証明書など）は入力しません。依頼内容は選択したAIプロバイダーに送信され処理されます。",
    "pledge.t6": "私の名前は、オフィスが呼びかけるためにこのブラウザにのみ保存されます。",
    "pledge.nameLabel": "お客様のお名前", "pledge.namePlaceholder": "お名前を入力してください",
    "pledge.agree": "上記の内容を読み、理解し、同意します。",
    "pledge.clientLabel": "お客様", "pledge.clientSub": "（署名・氏名）",
    "pledge.officeLabel": "GKI代表", "pledge.officeSub": "研修部長（AI）", "pledge.officeSign": "AI部長",
    "pledge.stampRing": "GKI ✦ IT研修センター ✦", "pledge.stampCenter": "承認",
    "pledge.submit": "署名して押印", "pledge.close": "閉じる", "pledge.cancel": "キャンセル",
    "pledge.errName": "お名前を入力してください（2文字以上）。", "pledge.errAgree": "署名の前に同意にチェックを入れてください。",
    "pledge.no": "番号:",
    "pledge.date": d => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,

    "furn.item.laptopDesk": "ノートPCデスク", "furn.item.podium": "教卓", "furn.item.fridge": "小型冷蔵庫", "furn.item.microwave": "電子レンジ", "sim.planWork": "研修計画を立てる", "sim.findMaterials": "参考資料を探す", "sim.readMaterials": "参考資料を読む", "sim.toFridge": "冷蔵庫へ", "sim.toMicrowave": "お昼を温める", "sim.heating": "🍱 温め中…", "sim.toClass": "授業へ！", "sim.toBackRow": "教室の後ろへ", "task.kind": "依頼の種類", "task.members": "メンバー", "task.teacher": "講師", "task.assistant": "アシスタント1", "task.noAssistant": "— なし —", "task.room": "教室", "task.students": "受講者", "task.needMember": "メンバーを1人以上選んでください。", "task.needTeacher": "授業には講師が必要です。", "task.lessonFail": "授業を開始できません（机がないか、通路がふさがっています）。", "log.lessonStart": "{teacher}が{room}で授業を開始（受講者{n}名）。", "log.lessonEnd": "授業終了、受講者が帰ります。", "work.mode": "作業モード", "work.on": "作業モードON – 全員が作業席へ移動します。", "work.off": "作業モードOFF – 全員が定位置に戻ります。", "staff.manage": "スタッフ管理", "staff.title": "スタッフ情報", "staff.add": "スタッフを追加", "staff.name": "名前", "staff.namePh": "空欄＝役職名", "staff.role": "役割", "staff.homeDesk": "定位置の席", "staff.workDesk": "作業席", "staff.sameDesk": "— 定位置と同じ —", "staff.noDesk": "— 席なし —", "staff.deskTaken": "使用中：{name}", "staff.deskHint": "定位置：普段の席。作業席：作業モード中やタスク参加中に移動する席。", "staff.look": "外見", "staff.skin": "肌の色", "staff.hair": "髪の色", "staff.hairStyle": "髪型", "staff.outfit": "服装", "staff.jacket": "上着", "staff.shirt": "シャツ", "staff.accent": "ネクタイ／差し色", "staff.pants": "ズボン／スカート", "staff.acc": "アクセサリー", "staff.random": "ランダム", "staff.delete": "削除", "staff.confirm": "もう一度押すと削除", "staff.added": "{name}を追加しました。入口から入ってきます。", "staff.deleted": "{name}を削除しました。", "staff.max": "スタッフは最大{n}名です。", "staff.busy": "タスク実行中です。終了後に削除・役割変更してください。", "staff.directorRole": "部長の役割は変更できません。", "staff.turn": "回転", "staff.noDeskWarn": "空いている席がありません。家具メニューで机を追加してください。", "staff.openHint": "一覧の人をクリックすると編集できます。", "hair.short": "ショート", "hair.swept": "流し", "hair.bun": "おだんご", "hair.long": "ロング", "hair.bald": "スキンヘッド", "outfit.suit": "スーツ＋ネクタイ", "outfit.blazer": "ジャケット", "outfit.shirt": "シャツ", "outfit.hoodie": "パーカー", "acc.glasses": "メガネ", "acc.beard": "ひげ", "acc.headphones": "ヘッドホン", "acc.lanyard": "社員証", "acc.earrings": "イヤリング", "board.kind": "種類：{x}", "board.lesson": "{room} · 受講者{n}名", "board.assistantTag": "後方アシスタント", "board.teacherTag": "授業担当",
    "staff.gender": "性別", "gender.male": "男性", "gender.female": "女性", "layout.export": "ファイルに保存", "layout.import": "ファイルを開く", "layout.hint": "レイアウト・家具・スタッフ情報をファイルに保存してバックアップや別のPCへの移行ができます。", "layout.exported": "{name} を保存しました（ダウンロード）。", "layout.imported": "レイアウト（{n}点）とスタッフ情報を読み込みました。", "layout.importFail": "無効なファイルです。「ファイルに保存」で作った .json を選んでください。",
    "staff.bottom": "ズボン／スカート", "bottom.pants": "ズボン", "bottom.skirt": "スカート",
    "task.defaultLesson": "プログラミングの授業 – 講師がクラスのレベルに合ったテーマを選ぶ。", "toast.demoNoServer": "AIサーバー未接続 – シミュレーションで実行します（例の内容）。",
    "task.assistant2": "アシスタント2",
    "hair.fade": "ツーブロック（刈り上げ）",
    "sim.toSmoke": "喫煙所へ", "sim.stubOut": "火を消す",
    "floor.name": "{n}階", "floor.switch": "階を選択", "room.f6r1": "部屋1", "room.f6r2": "部屋2", "room.f6r3": "部屋3", "room.f6lobby": "ロビー", "room.f6hall": "廊下",
    "furn.warn.chairWall": "{label} の椅子が壁に接しています – 机を少し壁から離してください。",
    "furn.chairsFixed": "椅子が壁を越えていた机を {n} 台調整しました。",
    "task.seats": "{n}席",
    "room.staff": "スタッフ室", "room.cio": "責任者室", "room.private": "個室", "room.classBig": "教室 1", "room.classSmall": "教室 2", "room.storageS": "倉庫", "room.storageL": "倉庫", "room.smoking": "喫煙所", "room.hall": "通路", "room.lobby": "廊下", "room.entrance": "入口", "wall.floor": "{n}階", "furn.item.studentDesk": "学習机", "furn.item.boxes": "段ボール", "furn.item.rack": "収納ラック", "furn.item.ashtray": "灰皿", "furn.item.bench": "ベンチ",
    "wall.tagline": "IT研修",
    "sim.getWater": "飲み物を取りに", "sim.findDocs": "資料を探す", "sim.toWindow": "窓辺へ", "sim.sitRest": "ちょっと休憩",
    "sim.goChat": "ちょっと雑談", "sim.assign": "タスクを割り振り",
    "sim.findReports": "参考資料を探す", "sim.readAnnual": "参考資料を読む", "sim.print": "レポートを印刷", "sim.printing": "印刷中…",
    "sim.handoffTo": "{name}へ引き継ぎ", "sim.handoffDefault": "私の分は終わりました！", "sim.done": "担当完了 ✔",
    "sim.thinking": "💭 考え中…", "sim.writing": "執筆中…",
    "board.title": "タスクボード", "board.open": "タスクボードを開く", "board.hint": "ヒント：オフィスのホワイトボードをクリックすると、ミッションと担当が見られます。", "board.empty": "まだタスクはありません。下で依頼すると、部長がホワイトボードで計画し、各自に割り振ります。", "board.request": "お客様のご依頼", "board.plan": "部長の割り振り", "board.started": "開始 {time}", "board.elapsed": "経過 {t}", "board.demo": "シミュレーション", "board.state.planning": "計画中", "board.state.running": "進行中", "board.state.finished": "完了", "board.state.failed": "失敗", "board.state.stopped": "停止", "board.st.waiting": "待機", "board.st.active": "作業中", "board.st.done": "完了", "board.st.error": "エラー", "board.deliver": "成果物：{x}", "board.took": "所要 {t}", "board.since": "{time} から", "board.inputs": "受け取る情報：{x}", "board.foot": "各自が前の担当者の成果を引き継ぎ、研修部長がまとめて承認します。各部分はAIが作成します。",
    "printer.title": "プリンター", "printer.open": "プリンターを開く", "printer.count": "キャビネット内 {n} 件 · {k} 件選択", "printer.empty": "キャビネットは空です。印刷する前にレポートを保存してください。", "printer.all": "すべて選択", "printer.none": "選択解除", "printer.go": "{k} 件を印刷", "printer.pick": "印刷するレポートを選択", "printer.hint": "ヒント：オフィスのプリンターをクリックすると印刷リストが開きます。", "printer.toast": "{name}が {k} 件を印刷しています…", "printer.busy": "印刷中です。少々お待ちください。", "print.kind": "研修資料", "print.client": "お客様", "print.saved": "保存日時", "print.printed": "印刷日時", "print.info": "詳細", "print.footer": "GKIのAIチームが作成した参考資料です。使用前に専門家の確認が必要です。", "board.clear": "完了 – ボードを消す", "board.clearBusy": "チームが作業中のため、まだボードを消せません。", "board.cleared": "タスクボードを消しました。", "sim.toBoard": "タスクボードを片付け", "sim.erasing": "🧽 古い計画を消しています…", "sim.boardClean": "きれいになった、次の仕事もどうぞ！", "log.boardCleared": "{name}がタスクボードを消しました。",
    "sim.toPrinter": "プリンターへ", "sim.printDone": "印刷完了！🖨️", "log.printed": "印刷しました：{title}",
    "sim.toCabinet": "書類をしまう", "sim.filing": "🗂️ きちんと保管…", "sim.trashSay": "これはもう要らないな…", "sim.crumple": "*くしゃくしゃ* 🤏", "sim.score": "ナイスシュート！🗑️", "sim.pocket": "後で捨てておこう。",
  },
};

const LOCALES = { vi: "vi-VN", en: "en-GB", ja: "ja-JP" };

let lang = (() => {
  try { const v = localStorage.getItem(LANG_KEY); return DICT[v] ? v : "vi"; } catch { return "vi"; }
})();

export const getLang = () => lang;
export const locale = () => LOCALES[lang];

export function t(key, params = {}) {
  let s = DICT[lang][key] ?? DICT.vi[key] ?? key;
  if (typeof s === "function") return s(params);
  return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
}

// Cách xưng hô với khách theo từng ngôn ngữ: "Quý khách An" / "An" / "An様".
export const clientName = name => t("client.address", { name });

export function setLang(code) {
  if (!DICT[code] || code === lang) return;
  lang = code;
  try { localStorage.setItem(LANG_KEY, code); } catch { /* bỏ qua */ }
  applyI18n();
  window.dispatchEvent(new CustomEvent("langchange", { detail: code }));
}

export function applyI18n(root = document) {
  document.documentElement.lang = lang;
  document.title = t("doc.title");
  root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); }); // chỉ chuỗi tĩnh trong DICT
  root.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll("[data-i18n-aria-label]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel)); });
  root.querySelectorAll("[data-lang]").forEach(el => {
    el.classList.toggle("active", el.dataset.lang === lang);
    el.setAttribute("aria-checked", String(el.dataset.lang === lang));
  });
}

export const fmtTime = (d = new Date()) => d.toLocaleTimeString(locale(), { hour12: false });
export const fmtDateTime = (d = new Date()) => d.toLocaleString(locale(), { hour12: false });
export const fmtDate = (d = new Date()) => d.toLocaleDateString(locale());
