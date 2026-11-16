"""GKI – trung tâm đào tạo CNTT vận hành bởi đội ngũ AI (backend).

Người dùng chọn LOẠI NHIỆM VỤ và THÀNH VIÊN tham gia; mỗi thành viên là một agent CrewAI với vai trò riêng,
làm việc tuần tự, cuối cùng Giám đốc đào tạo tổng hợp và ký duyệt:
    course  : thiết kế khoá học        -> Đề cương khoá học
    roadmap : tư vấn lộ trình học viên -> Lộ trình học tập cá nhân
    lesson  : buổi dạy trên lớp        -> Giáo án + bài giảng (giảng viên dạy, trợ lý ngồi cuối lớp)

Mọi trạng thái gửi xuống trình duyệt đều đến từ sự kiện thật của CrewAI
(TaskStarted / TaskCompleted / LLMCall...), không phải kịch bản dựng sẵn.
"""

import asyncio
import json
import os
import re
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator

from crewai import LLM, Agent, Crew, Process, Task
from crewai.events import (
    LLMCallCompletedEvent,
    LLMCallStartedEvent,
    TaskCompletedEvent,
    TaskFailedEvent,
    TaskStartedEvent,
    crewai_event_bus,
)

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


@asynccontextmanager
async def lifespan(_: FastAPI):
    office.loop = asyncio.get_running_loop()
    yield


app = FastAPI(title="GKI AI Training Office", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
# Chỉ cho phép trang chạy trên máy này (vd. VS Code Live Server) gọi API – không mở "*".
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# ---------------------------------------------------------------------------
# Danh mục model – UI lấy danh sách này qua /api/models nên nhãn luôn khớp.
# ---------------------------------------------------------------------------
MODELS: dict[str, dict[str, str]] = {
    # Gói API miễn phí tính hạn mức RIÊNG cho từng model: hết lượt model này thì đổi sang model khác.
    "gemini-3.8-flash": {"label": "Gemini 3.8 Flash", "model": "gemini/gemini-3.8-flash", "env": "GEMINI_API_KEY"},
    "gemini-3.5-flash": {"label": "Gemini 3.5 Flash", "model": "gemini/gemini-3.5-flash", "env": "GEMINI_API_KEY"},
    "gemini-3.1-flash-lite": {"label": "Gemini 3.1 Flash Lite", "model": "gemini/gemini-3.1-flash-lite", "env": "GEMINI_API_KEY"},
    "gemini-3.1-pro": {"label": "Gemini 3.1 Pro (preview)", "model": "gemini/gemini-3.1-pro-preview", "env": "GEMINI_API_KEY"},
    "gpt-5.5": {"label": "GPT-5.5", "model": "openai/gpt-5.5", "env": "OPENAI_API_KEY"},
    "gpt-5.4-mini": {"label": "GPT-5.4 Mini", "model": "openai/gpt-5.4-mini", "env": "OPENAI_API_KEY"},
    "claude-opus-5-5": {"label": "Claude Opus 5.5", "model": "anthropic/claude-opus-5-5", "env": "ANTHROPIC_API_KEY"},
    "claude-sonnet-5-5": {"label": "Claude Sonnet 5.5", "model": "anthropic/claude-sonnet-5-5", "env": "ANTHROPIC_API_KEY"},
    "claude-haiku-5-5": {"label": "Claude Haiku 5.5", "model": "anthropic/claude-haiku-5-5", "env": "ANTHROPIC_API_KEY"},
}
# Mặc định = model đầu tiên trong danh sách ưu tiên mà .env có API key.
# Claude đứng đầu: Sonnet làm Giám đốc (tổng hợp tài liệu cuối cần chất lượng), Haiku cho đội thực thi (nhanh, rẻ).
LEADER_PREFERENCE = ["claude-sonnet-5-5", "gemini-3.5-flash", "gemini-3.8-flash", "gpt-5.4-mini"]
TEAM_PREFERENCE = ["claude-haiku-5-5", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gpt-5.4-mini"]


def model_available(key: str) -> bool:
    return bool(os.getenv(MODELS[key]["env"], "").strip())


def default_model(preference: list[str]) -> str:
    return next((k for k in preference if model_available(k)), preference[0])


def build_llm(key: str) -> LLM:
    spec = MODELS[key]
    extra: dict[str, Any] = {}
    if spec["model"].startswith("gemini/"):
        # google-genai 3.x mặc định gọi API "v1", nơi KHÔNG có các model preview (vd. gemini-3.1-pro-preview)
        # -> 404 NOT_FOUND. "v1beta" có cả model ổn định lẫn preview.
        # Máy chủ Gemini hay quá tải tạm thời (503) -> tự thử lại vài lần thay vì hỏng cả nhiệm vụ.
        # Không thử lại 429 (hết hạn mức): thử lại cũng vô ích, để explain_error báo cho người dùng.
        extra["client_params"] = {"http_options": {
            "api_version": "v1beta",
            "retry_options": {"attempts": 6, "initial_delay": 2.0, "max_delay": 45.0,
                              "http_status_codes": [500, 502, 503, 504]},
        }}
    return LLM(model=spec["model"], api_key=os.getenv(spec["env"]), **extra)


# ---------------------------------------------------------------------------
# Trạng thái văn phòng + phát sóng WebSocket
# ---------------------------------------------------------------------------
class Office:
    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()
        self.agents: dict[str, dict[str, str]] = {}
        self.busy = False
        self.result: str | None = None
        self.loop: asyncio.AbstractEventLoop | None = None

    def snapshot(self) -> dict[str, Any]:
        return {"type": "snapshot", "busy": self.busy, "agents": self.agents, "result": self.result}

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.connections.add(ws)
        await ws.send_text(json.dumps(self.snapshot()))

    def disconnect(self, ws: WebSocket) -> None:
        self.connections.discard(ws)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        text = json.dumps(payload)
        dead = []
        for ws in list(self.connections):
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.connections.discard(ws)

    # Gọi được từ luồng worker của CrewAI.
    def emit(self, payload: dict[str, Any]) -> None:
        if payload.get("type") == "status":
            self.agents[payload["agent"]] = {"status": payload["status"], "message": payload["message"]}
        if self.loop:
            asyncio.run_coroutine_threadsafe(self.broadcast(payload), self.loop)

    def status(self, agent: str, status: str, message: str) -> None:
        self.emit({"type": "status", "agent": agent, "status": status, "message": message})


office = Office()
job_lock = threading.Lock()


def short(text: Any, limit: int = 90) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


# ---------------------------------------------------------------------------
# Vai trò & công việc. Prompt viết bằng tiếng Việt; ngôn ngữ ĐẦU RA theo lựa chọn của người dùng.
# ---------------------------------------------------------------------------
Kind = Literal["course", "roadmap", "lesson"]
Role = Literal["director", "headta", "curriculum", "teacher", "sensei", "advisor", "qa", "ta", "admissions", "secretary", "clerklead", "clerk"]

ROLES: dict[str, dict[str, Any]] = {
    "director": {
        "role": "Giám đốc đào tạo kiêm giảng viên",
        "goal": "Tổng hợp, thẩm định và ký duyệt tài liệu đào tạo gửi khách hàng; khi cần thì trực tiếp đứng lớp",
        "backstory": "Giám đốc đào tạo CNTT nhiều năm kinh nghiệm, vẫn trực tiếp đứng lớp; đặt chất lượng học tập và quyền lợi học viên lên trên hết, viết rõ ràng, trung thực.",
    },
    "curriculum": {
        "role": "Chuyên viên thiết kế chương trình",
        "goal": "Thiết kế chương trình đào tạo CNTT có mục tiêu rõ ràng, đo lường được và sát nhu cầu thực tế",
        "backstory": "Chuyên gia thiết kế chương trình học, quen các khung năng lực CNTT phổ biến và phương pháp học qua dự án.",
        "course": ("Thiết kế khung chương trình: mục tiêu đầu ra (đo lường được), đối tượng & điều kiện đầu vào, "
                   "danh sách module/buổi học theo tuần, thời lượng, dự án cuối khoá.",
                   "Khung chương trình dạng bảng: tuần / chủ đề / mục tiêu / thời lượng, kèm dự án cuối khoá."),
        "roadmap": ("Đề xuất lộ trình các khoá học/chủ đề theo thứ tự hợp lý cho học viên này, kèm thời lượng ước tính "
                    "và điều kiện tiên quyết của từng chặng.",
                    "Lộ trình theo chặng (chặng / nội dung / thời lượng / điều kiện tiên quyết)."),
    },
    "teacher": {
        "role": "Giảng viên CNTT",
        "goal": "Biến nội dung kỹ thuật thành bài giảng dễ hiểu, có ví dụ và bài thực hành sát thực tế",
        "backstory": "Giảng viên lập trình đứng lớp lâu năm, giải thích từ dễ tới khó, luôn có ví dụ code chạy được.",
        "course": ("Soạn nội dung chi tiết cho 2–3 buổi học tiêu biểu của khoá: lý thuyết trọng tâm, ví dụ code, "
                   "bài thực hành có hướng dẫn.",
                   "Nội dung mẫu cho các buổi học tiêu biểu, kèm ví dụ code và bài thực hành."),
        "roadmap": ("Đánh giá kỹ năng kỹ thuật cần bổ sung để học viên đạt mục tiêu; gợi ý bài tập/dự án nhỏ "
                    "cho từng chặng để tự kiểm tra.",
                    "Danh sách kỹ năng cần bổ sung + bài tập/dự án nhỏ theo chặng."),
    },
    "advisor": {
        "role": "Chuyên viên tư vấn học tập",
        "goal": "Hiểu đúng nhu cầu, hoàn cảnh của người học và tư vấn lựa chọn phù hợp, thực tế",
        "backstory": "Chuyên viên tư vấn học tập & nghề nghiệp CNTT, lắng nghe kỹ và không hứa hẹn quá mức.",
        "course": ("Phân tích chân dung học viên mục tiêu: nền tảng, động lực, khó khăn thường gặp; đề xuất hình thức học "
                   "(online/offline, lịch học), cách hỗ trợ và giữ chân học viên.",
                   "Chân dung học viên mục tiêu + đề xuất hình thức tổ chức lớp và hỗ trợ học viên."),
        "roadmap": ("Phân tích hồ sơ học viên: nền tảng hiện tại, mục tiêu nghề nghiệp, quỹ thời gian; xác định khoảng cách "
                    "năng lực và vị trí việc làm phù hợp tại thị trường.",
                    "Phân tích hồ sơ, khoảng cách năng lực và định hướng nghề nghiệp phù hợp."),
    },
    "qa": {
        "role": "Chuyên viên khảo thí & chất lượng",
        "goal": "Đảm bảo nội dung đào tạo chính xác, đánh giá được và đạt chuẩn chất lượng",
        "backstory": "Chuyên viên khảo thí kỹ tính, soi từng mục tiêu học tập xem có đo được không và nội dung có lỗi thời không.",
        "course": ("Thiết kế cách đánh giá: tiêu chí đạt của từng module, bài kiểm tra, rubric chấm dự án cuối khoá; "
                   "rà soát lỗi kỹ thuật hoặc nội dung lỗi thời trong phần của đồng đội.",
                   "Kế hoạch đánh giá + rubric chấm dự án + danh sách điểm cần sửa."),
        "roadmap": ("Đề xuất mốc kiểm tra năng lực sau mỗi chặng (tiêu chí đạt, bài test gợi ý) và các chứng chỉ "
                    "quốc tế/phổ biến phù hợp (nếu có, ghi rõ có thể đã thay đổi).",
                    "Mốc kiểm tra theo chặng + chứng chỉ gợi ý."),
    },
    "ta": {
        "role": "Trợ giảng",
        "goal": "Hỗ trợ học viên thực hành, giải đáp thắc mắc và chuẩn bị tài liệu bổ trợ",
        "backstory": "Trợ giảng nhiệt tình, hiểu những lỗi người mới hay gặp và cách gỡ rối từng bước.",
        "course": ("Soạn bộ câu hỏi thường gặp, lỗi hay gặp khi thực hành và tài liệu đọc thêm cho khoá học.",
                   "FAQ + lỗi thường gặp & cách sửa + tài liệu đọc thêm."),
        "roadmap": ("Gợi ý thói quen học, công cụ, cộng đồng và tài nguyên miễn phí giúp học viên tự học hiệu quả theo lộ trình.",
                    "Danh sách tài nguyên, công cụ và lịch tự học gợi ý."),
    },
    "headta": {
        "role": "Trợ giảng chính",
        "goal": "Giữ cho lớp học vận hành trơn tru: học liệu, hậu cần, hồ sơ và hỗ trợ học viên",
        "backstory": "Trợ giảng chính chu đáo, quản lý học liệu và hồ sơ lớp, nắm rõ những gì học viên cần để học tốt.",
        "course": ("Chuẩn bị danh sách học liệu, checklist tổ chức lớp (phòng, thiết bị, tài khoản phần mềm), quy trình "
                   "điểm danh, kênh hỗ trợ học viên ngoài giờ.",
                   "Danh sách học liệu + checklist tổ chức lớp + quy trình hỗ trợ học viên."),
        "roadmap": ("Lập lịch học chi tiết theo tuần cho học viên, các mốc nộp bài/nhắc nhở và cách liên hệ khi cần hỗ trợ.",
                    "Lịch học theo tuần + mốc nhắc nhở + kênh hỗ trợ."),
    },
    "sensei": {
        "role": "Thầy giáo",
        "goal": "Giảng dạy dễ hiểu, kèm cặp và định hướng học viên tiến bộ",
        "backstory": "Thầy giáo CNTT tận tâm, giải thích bằng ví dụ đời thường và theo sát từng học viên.",
        "course": ("Soạn nội dung chi tiết cho các buổi học tiêu biểu, ví dụ thực tế và cách kèm cặp học viên yếu.",
                   "Nội dung buổi học tiêu biểu + ví dụ + phương pháp kèm cặp."),
        "roadmap": ("Nhận xét điểm mạnh/yếu kỹ thuật của học viên và lời khuyên học tập cho từng chặng.",
                    "Nhận xét kỹ năng + lời khuyên theo chặng."),
    },
    "secretary": {
        "role": "Thư ký",
        "goal": "Sắp xếp lịch và văn bản liên lạc rõ ràng, đúng hạn",
        "backstory": "Thư ký chu đáo, quản lý lịch làm việc và soạn thông báo chuyên nghiệp.",
        "course": ("Lên lịch khai giảng, lịch học theo tuần, mẫu thông báo và thư mời học viên.",
                   "Lịch khai giảng & lịch học + mẫu thông báo / thư mời."),
        "roadmap": ("Sắp lịch các buổi tư vấn, nhắc các mốc học tập và soạn mẫu email liên lạc với học viên.",
                    "Lịch tư vấn + mốc nhắc nhở + mẫu email."),
    },
    "clerklead": {
        "role": "Trưởng nhân viên văn phòng",
        "goal": "Điều phối công việc hành chính để khoá học vận hành trơn tru",
        "backstory": "Trưởng bộ phận văn phòng nhiều kinh nghiệm, nắm rõ quy trình và nguồn lực của trung tâm.",
        "course": ("Lập kế hoạch hành chính cho khoá học: nhân sự, phòng học, thiết bị, mốc thời gian và phân công.",
                   "Kế hoạch hành chính (nhân sự, phòng, thiết bị, mốc thời gian)."),
        "roadmap": ("Đề xuất thủ tục đăng ký, chính sách hỗ trợ học viên và đầu mối liên hệ.",
                    "Thủ tục đăng ký + chính sách hỗ trợ + đầu mối liên hệ."),
    },
    "clerk": {
        "role": "Nhân viên văn phòng",
        "goal": "Chuẩn bị hồ sơ, giấy tờ chính xác và đầy đủ",
        "backstory": "Nhân viên văn phòng cẩn thận, quen việc biểu mẫu và hồ sơ học viên.",
        "course": ("Chuẩn bị mẫu hồ sơ đăng ký, danh sách lớp, biểu mẫu điểm danh và mẫu chứng nhận hoàn thành.",
                   "Bộ biểu mẫu: đăng ký, danh sách lớp, điểm danh, chứng nhận."),
        "roadmap": ("Liệt kê giấy tờ cần chuẩn bị và quy trình đăng ký từng khoá trong lộ trình.",
                    "Danh sách giấy tờ + quy trình đăng ký."),
    },
    "admissions": {
        "role": "Chuyên viên tuyển sinh",
        "goal": "Đưa chương trình tới đúng người học và truyền thông trung thực",
        "backstory": "Chuyên viên tuyển sinh hiểu thị trường đào tạo CNTT, ưu tiên thông tin minh bạch cho người học.",
        "course": ("Đề xuất tên khoá học, thông điệp chính, điểm khác biệt, học phí tham khảo theo thị trường (ghi rõ là ước tính) "
                   "và kế hoạch tuyển sinh ngắn gọn.",
                   "Tên khoá, thông điệp, học phí ước tính, kế hoạch tuyển sinh."),
        "roadmap": ("Gợi ý hình thức học phù hợp với quỹ thời gian và ngân sách của học viên (lớp tối, cuối tuần, online, kèm 1-1), "
                    "ước tính chi phí (ghi rõ là ước tính).",
                    "Phương án học phù hợp + chi phí ước tính."),
    },
}
ROLE_KEYS = tuple(ROLES)

LESSON_TEACHER = (
    "Bạn đang đứng lớp buổi học này. Soạn BÀI GIẢNG chi tiết theo trình tự trên lớp: mục tiêu buổi học, khởi động, "
    "lý thuyết trọng tâm (giải thích dễ hiểu), ví dụ code minh hoạ có chú thích, hoạt động thực hành trên lớp, tổng kết.",
    "Bài giảng chi tiết theo trình tự trên lớp, có ví dụ code.",
)
LESSON_ASSISTANT = (
    "Bạn là trợ lý ngồi cuối lớp hỗ trợ giảng viên. Dựa trên bài giảng, soạn: bài tập về nhà (3–5 bài, từ dễ tới khó) kèm "
    "đáp án/gợi ý, 5 câu hỏi trắc nghiệm kiểm tra nhanh kèm đáp án, các lỗi học viên hay gặp và cách hỗ trợ.",
    "Bài tập về nhà + đáp án, câu hỏi kiểm tra nhanh, lỗi thường gặp.",
)
DIRECTOR_TASK = {
    "course": ("ĐỀ CƯƠNG KHOÁ HỌC",
               "1) Tổng quan khoá học (tên, đối tượng, điều kiện đầu vào, hình thức, thời lượng); 2) Mục tiêu đầu ra; "
               "3) Nội dung chi tiết theo tuần/buổi (bảng); 4) Dự án cuối khoá; 5) Phương pháp & tiêu chí đánh giá; "
               "6) Tài liệu & công cụ; 7) Ghi chú cho khách hàng (điều cần kiểm chứng thêm, phần nào là ước tính)."),
    "roadmap": ("LỘ TRÌNH HỌC TẬP CÁ NHÂN",
                "1) Tóm tắt hồ sơ & mục tiêu; 2) Đánh giá năng lực hiện tại và khoảng cách cần lấp; 3) Lộ trình theo chặng "
                "(bảng: chặng / nội dung / thời lượng / kết quả cần đạt); 4) Kế hoạch học hằng tuần; 5) Mốc kiểm tra & chứng chỉ; "
                "6) Tài nguyên gợi ý; 7) Lưu ý (phần nào là ước tính, cần kiểm chứng thêm)."),
    "lesson": ("GIÁO ÁN BUỔI HỌC",
               "1) Thông tin buổi học (chủ đề, lớp, giảng viên, trợ lý, sĩ số); 2) Mục tiêu; 3) Tiến trình buổi học theo phút "
               "(bảng); 4) Nội dung bài giảng; 5) Bài tập & câu hỏi kiểm tra kèm đáp án; 6) Ghi chú cho giảng viên và trợ lý."),
}
DISCLAIMER = (
    "Kết thúc bằng mục 'Lưu ý': tài liệu do đội ngũ AI soạn, chỉ mang tính tham khảo, cần giảng viên/chuyên gia rà soát "
    "trước khi sử dụng; thông tin về công nghệ, chứng chỉ, học phí có thể đã thay đổi."
)

# ---------------------------------------------------------------------------
# Đa ngôn ngữ: tài liệu + thông báo trạng thái + lỗi theo ngôn ngữ người dùng chọn (vi / en / ja).
# ---------------------------------------------------------------------------
LANG_NAME = {"vi": "tiếng Việt", "en": "English", "ja": "日本語 (Japanese)"}
CLIENT_ADDRESS = {"vi": "Quý khách {name}", "en": "{name}", "ja": "{name}様"}

MSG = {
    "vi": {
        "assigning": "Đang phân công công việc", "monitoring": "Đã giao việc, theo dõi tiến độ",
        "work": {"sensei": "Đang soạn bài & phương pháp kèm cặp", "secretary": "Đang lên lịch & soạn thông báo", "clerklead": "Đang lập kế hoạch hành chính", "clerk": "Đang chuẩn bị biểu mẫu, hồ sơ", "headta": "Đang chuẩn bị học liệu & hồ sơ lớp", "curriculum": "Đang thiết kế chương trình", "teacher": "Đang soạn nội dung bài giảng",
                 "advisor": "Đang phân tích nhu cầu học viên", "qa": "Đang rà soát & thiết kế đánh giá",
                 "ta": "Đang soạn tài liệu bổ trợ", "admissions": "Đang lên phương án tuyển sinh"},
        "lesson_teacher": "Đang giảng bài trên lớp", "lesson_assistant": "Đang hỗ trợ lớp ở cuối phòng",
        "director": {"course": "Đang viết đề cương khoá học", "roadmap": "Đang viết lộ trình học tập", "lesson": "Đang duyệt giáo án"},
        "done": "Xong phần việc", "ready": "Sẵn sàng cho việc tiếp theo", "stopped": "Dừng do lỗi",
        "task_error": "Lỗi: {error}",
        "bad_model": "Model không hợp lệ: {key}", "no_key": "Chưa có {env} trong .env cho {label}.",
        "busy": "Văn phòng đang bận một nhiệm vụ khác.",
        "retry_in": " Thử lại sau khoảng {wait}.", "minutes": "{n} phút",
        "quota_day": "Hết hạn mức MIỄN PHÍ trong ngày của {models}.{wait} Mỗi model có hạn mức riêng – hãy chọn model khác (vd. Gemini 3.5 Flash / 3.1 Flash Lite) hoặc bật Billing cho API key trong AI Studio.",
        "quota_min": "Gọi {models} quá nhanh so với hạn mức theo phút.{wait} Đợi một chút rồi gửi lại, hoặc giảm CREW_MAX_RPM trong .env.",
        "not_found": "Model {models} không tồn tại hoặc API key không có quyền dùng. Hãy chọn model khác.",
        "auth": "API key không hợp lệ hoặc không có quyền. Kiểm tra lại key trong .env rồi khởi động lại backend.",
        "resuming": "Máy chủ AI đang quá tải – chờ {s} giây rồi làm tiếp từ bước này ({n}/{max})",
        "no_credit": "Tài khoản API của {models} đã hết tiền/credit (không phải lỗi gọi quá nhanh). Hãy nạp thêm credit trong trang Billing của nhà cung cấp, hoặc chọn model của hãng khác.",
        "overloaded": "Máy chủ {models} đang quá tải (đã tự thử lại nhưng chưa được). Đây là lỗi tạm thời phía nhà cung cấp – hãy gửi lại sau ít phút hoặc chọn model khác.",
        "bad_team": "Danh sách thành viên không hợp lệ.",
    },
    "en": {
        "assigning": "Assigning tasks", "monitoring": "Tasks assigned, monitoring progress",
        "work": {"sensei": "Preparing lessons & mentoring", "secretary": "Scheduling & drafting notices", "clerklead": "Planning administration", "clerk": "Preparing forms & records", "headta": "Preparing materials & class records", "curriculum": "Designing the curriculum", "teacher": "Writing lesson content",
                 "advisor": "Analysing learner needs", "qa": "Reviewing & designing assessments",
                 "ta": "Preparing support materials", "admissions": "Planning enrolment"},
        "lesson_teacher": "Teaching the class", "lesson_assistant": "Supporting the class from the back row",
        "director": {"course": "Writing the course syllabus", "roadmap": "Writing the learning roadmap", "lesson": "Reviewing the lesson plan"},
        "done": "Part done", "ready": "Ready for the next task", "stopped": "Stopped due to an error",
        "task_error": "Error: {error}",
        "bad_model": "Invalid model: {key}", "no_key": "{env} is missing in .env for {label}.",
        "busy": "The office is busy with another task.",
        "retry_in": " Try again in about {wait}.", "minutes": "{n} min",
        "quota_day": "The FREE daily quota for {models} is used up.{wait} Each model has its own quota – pick another model (e.g. Gemini 3.5 Flash / 3.1 Flash Lite) or enable Billing for the API key in AI Studio.",
        "quota_min": "{models} was called faster than the per-minute quota allows.{wait} Wait a moment and resend, or lower CREW_MAX_RPM in .env.",
        "not_found": "Model {models} doesn't exist or the API key can't use it. Please choose another model.",
        "auth": "The API key is invalid or lacks permission. Check the key in .env and restart the backend.",
        "resuming": "The AI servers are overloaded – waiting {s}s, then continuing from this step ({n}/{max})",
        "no_credit": "The API account for {models} has no credits left (this is not a rate limit). Add credits on the provider's Billing page, or pick a model from another provider.",
        "overloaded": "The {models} servers are overloaded (automatic retries didn't help). This is a temporary provider-side issue – resend in a few minutes or pick another model.",
        "bad_team": "Invalid team list.",
    },
    "ja": {
        "assigning": "タスクを割り振り中", "monitoring": "割り振り完了、進捗を確認中",
        "work": {"sensei": "授業と指導方法を準備中", "secretary": "日程調整・案内文を作成中", "clerklead": "事務計画を作成中", "clerk": "書類・様式を準備中", "headta": "教材とクラス書類を準備中", "curriculum": "カリキュラムを設計中", "teacher": "講義内容を作成中",
                 "advisor": "受講者のニーズを分析中", "qa": "評価を設計・レビュー中",
                 "ta": "補助教材を作成中", "admissions": "募集計画を作成中"},
        "lesson_teacher": "授業中", "lesson_assistant": "教室の後ろでサポート中",
        "director": {"course": "コースシラバスを作成中", "roadmap": "学習ロードマップを作成中", "lesson": "指導案を審査中"},
        "done": "担当完了", "ready": "次のタスクの準備OK", "stopped": "エラーで停止",
        "task_error": "エラー：{error}",
        "bad_model": "無効なモデル：{key}", "no_key": "{label} 用の {env} が .env にありません。",
        "busy": "オフィスは別のタスクを処理中です。",
        "retry_in": " 約{wait}後に再試行してください。", "minutes": "{n}分",
        "quota_day": "{models} の無料枠（1日分）を使い切りました。{wait} 無料枠はモデルごとに別なので、他のモデル（例：Gemini 3.5 Flash / 3.1 Flash Lite）を選ぶか、AI Studio でAPIキーの課金を有効にしてください。",
        "quota_min": "{models} の1分あたりの上限を超える速さで呼び出しました。{wait} 少し待ってから再送するか、.env の CREW_MAX_RPM を下げてください。",
        "not_found": "モデル {models} が存在しないか、APIキーで利用できません。別のモデルを選んでください。",
        "auth": "APIキーが無効か権限がありません。.env のキーを確認し、バックエンドを再起動してください。",
        "resuming": "AIサーバーが混雑中 – {s}秒待ってからこの工程を再開します（{n}/{max}）",
        "no_credit": "{models} のAPIアカウントのクレジットが残っていません（速度制限ではありません）。提供元の Billing ページでクレジットを追加するか、別のプロバイダーのモデルを選んでください。",
        "overloaded": "{models} のサーバーが混雑しています（自動で再試行しましたが失敗）。提供元の一時的な問題です。数分後に再送するか、別のモデルを選んでください。",
        "bad_team": "メンバーの指定が正しくありません。",
    },
}


# ---------------------------------------------------------------------------
# Đầu vào
# ---------------------------------------------------------------------------
class Member(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,24}$")
    name: str = Field(min_length=1, max_length=40)
    role: Role
    gender: Literal["male", "female"] | None = None


class LessonInfo(BaseModel):
    room: str = Field(default="", max_length=40)
    students: int = Field(default=0, ge=0, le=60)
    teacher: str = Field(pattern=r"^[A-Za-z0-9_-]{1,24}$")
    # Tối đa 2 trợ giảng ngồi cuối lớp. "assistant" (một người) giữ lại cho bản giao diện cũ.
    assistants: list[str] = Field(default_factory=list, max_length=2)
    assistant: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{1,24}$")

    @model_validator(mode="after")
    def merge(self) -> "LessonInfo":
        ids = [*self.assistants, *([self.assistant] if self.assistant else [])]
        if any(not re.fullmatch(r"[A-Za-z0-9_-]{1,24}", i) for i in ids):
            raise ValueError("bad assistant id")
        self.assistants = list(dict.fromkeys(ids))[:2]
        self.assistant = None
        return self


class JobInput(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    client_name: str = Field(min_length=1, max_length=60)
    language: Literal["vi", "en", "ja"] = "vi"
    kind: Kind = "course"
    director: Member
    team: list[Member] = Field(default_factory=list, max_length=12)
    lesson: LessonInfo | None = None
    manager_choice: str = Field(default_factory=lambda: default_model(LEADER_PREFERENCE))
    worker_choice: str = Field(default_factory=lambda: default_model(TEAM_PREFERENCE))

    @model_validator(mode="after")
    def check(self) -> "JobInput":
        ids = [m.id for m in self.team]
        if len(set(ids)) != len(ids) or self.director.id in ids or any(m.role == "director" for m in self.team):
            raise ValueError("duplicate or misplaced team member")
        if self.kind == "lesson":
            # Giám đốc kiêm giảng viên: được đứng lớp (không nằm trong team).
            if not self.lesson or (self.lesson.teacher not in ids and self.lesson.teacher != self.director.id):
                raise ValueError("lesson needs a teacher")
            if any(a not in ids or a == self.lesson.teacher for a in self.lesson.assistants):
                raise ValueError("assistants must be in the team")
        elif not self.team:
            raise ValueError("team must not be empty")
        return self


def build_crew(job: JobInput):
    leader_llm, team_llm = build_llm(job.manager_choice), build_llm(job.worker_choice)
    lang = job.language
    addressed = CLIENT_ADDRESS[lang].format(name=job.client_name.strip())
    lesson_line = ""
    if job.kind == "lesson" and job.lesson:
        names = {m.id: m.name for m in job.team}
        names[job.director.id] = job.director.name
        lesson_line = (
            f"\nThông tin buổi học: phòng {job.lesson.room or 'phòng học'}, sĩ số {job.lesson.students} học viên, "
            f"giảng viên {names[job.lesson.teacher]}"
            + (f", trợ giảng {', '.join(names[a] for a in job.lesson.assistants)} (ngồi cuối lớp)" if job.lesson.assistants else "") + "."
        )
    brief = (
        f"GKI là trung tâm đào tạo CNTT. Khách hàng: {addressed}\nYêu cầu của khách hàng:\n{job.prompt}{lesson_line}\n\n"
        "QUY TẮC: chỉ dùng kiến thức bạn chắc chắn; với thông tin dễ thay đổi (phiên bản công nghệ, chứng chỉ, học phí, "
        "thị trường việc làm) hãy ghi rõ có thể đã lỗi thời; đánh dấu rõ số nào là ƯỚC TÍNH; không bịa nguồn.\n\n"
        f"NGÔN NGỮ ĐẦU RA: viết TOÀN BỘ câu trả lời bằng {LANG_NAME[lang]} (kể cả tiêu đề các mục); "
        f"xưng hô với khách hàng là \"{addressed}\"."
    )

    def make_agent(m: Member, llm: LLM) -> Agent:
        spec = ROLES[m.role]
        gender = {"male": " Bạn là nam.", "female": " Bạn là nữ."}.get(m.gender or "", "")
        return Agent(role=f"{spec['role']} ({m.name})", goal=spec["goal"], backstory=spec["backstory"] + gender, llm=llm)

    agents: list[Agent] = []
    tasks: list[Task] = []
    agent_ids: dict[int, str] = {}
    task_ids: dict[int, str] = {}
    order: list[str] = []
    working_msg: dict[str, str] = {}
    M = MSG[lang]

    members = list(job.team)
    director_teaches = job.kind == "lesson" and job.lesson and job.lesson.teacher == job.director.id
    if job.kind == "lesson" and job.lesson:
        members = [job.director] if director_teaches else [m for m in job.team if m.id == job.lesson.teacher]
        members += [m for a in job.lesson.assistants for m in job.team if m.id == a]
    director = make_agent(job.director, leader_llm)

    for m in members:
        agent = director if m.id == job.director.id else make_agent(m, team_llm)
        if job.kind == "lesson":
            is_teacher = job.lesson and m.id == job.lesson.teacher
            desc, expected = LESSON_TEACHER if is_teacher else LESSON_ASSISTANT
            working_msg[m.id] = M["lesson_teacher"] if is_teacher else M["lesson_assistant"]
        else:
            desc, expected = ROLES[m.role][job.kind]
            working_msg[m.id] = M["work"][m.role]
        task = Task(description=f"{brief}\n\nNhiệm vụ của bạn: {desc}", expected_output=expected,
                    agent=agent, context=list(tasks))
        if agent is not director:
            agents.append(agent)
        tasks.append(task)
        agent_ids[id(agent)] = m.id
        task_ids[id(task)] = m.id
        order.append(m.id)

    title, sections = DIRECTOR_TASK[job.kind]
    final = Task(
        description=(
            f"{brief}\n\nNhiệm vụ: tổng hợp kết quả của đồng đội, sửa chỗ chưa chính xác và viết {title} "
            f"hoàn chỉnh gửi {addressed} bằng Markdown, gồm: {sections} {DISCLAIMER}"
        ),
        expected_output=f"{title} hoàn chỉnh bằng Markdown.",
        agent=director,
        context=list(tasks),
    )
    agents.append(director)
    tasks.append(final)
    agent_ids[id(director)] = job.director.id
    task_ids[id(final)] = job.director.id
    order.append(job.director.id)
    # Giám đốc đứng lớp: lúc đầu là "đang giảng bài", tới bước cuối (seq[-1]) đổi sang "đang duyệt giáo án".
    final_msg = M["director"][job.kind]
    working_msg.setdefault(job.director.id, final_msg)

    crew = Crew(
        agents=agents,
        tasks=tasks,
        process=Process.sequential,
        # Gói miễn phí giới hạn số request/phút; CrewAI tự chờ khi chạm ngưỡng này thay vì nhận lỗi 429.
        max_rpm=int(os.getenv("CREW_MAX_RPM", "8")),
    )
    return crew, agent_ids, task_ids, order, working_msg, final_msg


def explain_error(exc: Exception, leader_key: str, team_key: str, lang: str = "vi") -> str:
    """Đổi các lỗi hay gặp của nhà cung cấp LLM thành câu dễ hiểu (theo ngôn ngữ người dùng)."""
    M = MSG[lang]
    text = str(exc)
    models = " / ".join(dict.fromkeys(MODELS[k]["label"] for k in (leader_key, team_key)))
    low = text.lower()
    if "no credits" in low or "insufficient_quota" in low or "credit balance" in low or "billing" in low and "429" in text:
        return M["no_credit"].format(models=models)
    if "429" in text or "RESOURCE_EXHAUSTED" in text or "quota" in low:
        retry = re.search(r"retry in (\d[\dhms.]*?)\.?\s|'retryDelay': '(\d+)s'", text + " ")
        wait = ""
        if retry:
            amount = retry.group(1) or M["minutes"].format(n=int(retry.group(2)) // 60 + 1)
            wait = M["retry_in"].format(wait=amount)
        key = "quota_day" if "PerDay" in text else "quota_min"
        return M[key].format(models=models, wait=wait)
    if "503" in text or "UNAVAILABLE" in text or "overloaded" in text.lower():
        return M["overloaded"].format(models=models)
    if "404" in text and "NOT_FOUND" in text:
        return M["not_found"].format(models=models)
    if "401" in text or "403" in text or "API key not valid" in text:
        return M["auth"]
    return short(f"{type(exc).__name__}: {exc}", 300)


# Lỗi tạm thời phía nhà cung cấp (quá tải / lỗi máy chủ) – khác với hết hạn mức (429) hay sai key.
TRANSIENT_MARKERS = ("503", "UNAVAILABLE", "overloaded", "500 INTERNAL", "502", "504", "timed out", "Timeout")
RESUME_WAIT = int(os.getenv("RESUME_WAIT", "30"))   # giây chờ trước khi chạy tiếp
RESUME_LIMIT = int(os.getenv("RESUME_LIMIT", "2"))  # số lần chạy tiếp tối đa cho một nhiệm vụ


def is_transient(exc: Exception) -> bool:
    text = str(exc)
    return "429" not in text and any(m in text for m in TRANSIENT_MARKERS)


def kickoff_with_resume(crew: Crew, task_ids: dict[int, str], M: dict) -> Any:
    """Chạy cả đội; nếu gặp lỗi tạm thời giữa chừng thì chờ rồi chạy TIẾP từ bước hỏng.

    Kết quả của các bước đã xong vẫn nằm trên đối tượng Task, và các bước sau đọc ngữ cảnh từ đó,
    nên không phải làm lại từ đầu (đỡ tốn thời gian lẫn hạn mức API).
    """
    tasks = list(crew.tasks)
    current, attempt = crew, 0
    while True:
        try:
            return current.kickoff()
        except Exception as exc:  # noqa: BLE001
            remaining = [t for t in tasks if t.output is None]
            if attempt >= RESUME_LIMIT or not remaining or not is_transient(exc):
                raise
            attempt += 1
            sid = task_ids.get(id(remaining[0]))
            if sid:
                office.status(sid, "thinking", M["resuming"].format(s=RESUME_WAIT, n=attempt, max=RESUME_LIMIT))
            time.sleep(RESUME_WAIT)
            agents = list({id(t.agent): t.agent for t in remaining}.values())
            current = Crew(agents=agents, tasks=remaining, process=Process.sequential, max_rpm=crew.max_rpm)


def run_job(job: JobInput) -> None:
    ids = [job.director.id, *(m.id for m in job.team)]
    try:
        _run_job(job)
    except Exception as exc:  # noqa: BLE001 – vd. lỗi khi khởi tạo LLM/agent
        for sid in ids:
            office.status(sid, "idle", MSG[job.language]["stopped"])
        office.emit({"type": "job", "state": "failed",
                     "error": explain_error(exc, job.manager_choice, job.worker_choice, job.language)})
    finally:
        office.busy = False
        job_lock.release()


def _run_job(job: JobInput) -> None:
    M = MSG[job.language]
    crew, agent_ids, task_ids, order, working_msg, final_msg = build_crew(job)
    director_id = job.director.id

    # Ánh xạ theo id() đối tượng; nếu CrewAI có sao chép đối tượng thì rơi về tên vai trò.
    roles = {a.role: sid for a in crew.agents for k, sid in agent_ids.items() if id(a) == k}

    def by_role(agent) -> str | None:
        return roles.get(getattr(agent, "role", None))

    def staff_of_task(event) -> str | None:
        task = getattr(event, "task", None)
        return task_ids.get(id(task)) or by_role(getattr(task, "agent", None))

    def staff_of_llm(event) -> str | None:
        agent = getattr(event, "from_agent", None)
        task = getattr(event, "from_task", None)
        return agent_ids.get(id(agent)) or task_ids.get(id(task)) or by_role(agent) or by_role(getattr(task, "agent", None))

    # Quy trình tuần tự: bước đang chạy = số bước đã xong (đúng cả khi chạy tiếp sau lỗi tạm thời,
    # và khi Giám đốc vừa đứng lớp vừa duyệt – một người hai bước).
    progress = {"done": 0}

    def on_task_started(source, event):
        sid = staff_of_task(event)
        if not sid:
            return
        step = min(progress["done"], len(order) - 1)
        final = step == len(order) - 1
        if step == 0 and sid != director_id:
            office.status(director_id, "idle", M["monitoring"])
        office.status(sid, "reviewing" if final else "working", final_msg if final else working_msg[sid])

    def on_task_completed(source, event):
        sid = staff_of_task(event)
        if not sid:
            return
        step = progress["done"]
        progress["done"] += 1
        office.status(sid, "done", M["done"])
        nxt = order[step + 1] if step + 1 < len(order) else None
        if nxt and nxt != sid:
            office.emit({
                "type": "handoff", "from": sid, "to": nxt,
                "message": short(getattr(event.output, "raw", ""), 120),
            })

    def on_task_failed(source, event):
        sid = staff_of_task(event)
        if sid:
            office.status(sid, "error", short(M["task_error"].format(error=event.error)))

    def on_llm_started(source, event):
        sid = staff_of_llm(event)
        if sid:
            office.emit({"type": "activity", "agent": sid, "kind": "thinking"})

    def on_llm_completed(source, event):
        sid = staff_of_llm(event)
        if sid:
            office.emit({"type": "activity", "agent": sid, "kind": "typing",
                         "message": short(getattr(event, "response", ""), 60)})

    handlers = [
        (TaskStartedEvent, on_task_started),
        (TaskCompletedEvent, on_task_completed),
        (TaskFailedEvent, on_task_failed),
        (LLMCallStartedEvent, on_llm_started),
        (LLMCallCompletedEvent, on_llm_completed),
    ]
    for event_type, handler in handlers:
        crewai_event_bus.on(event_type)(handler)

    try:
        output = kickoff_with_resume(crew, task_ids, M)
        crewai_event_bus.flush(timeout=5)
    finally:
        for event_type, handler in handlers:
            crewai_event_bus.off(event_type, handler)

    office.result = str(output)
    for sid in order:
        office.status(sid, "idle", M["ready"])
    office.emit({"type": "job", "state": "finished", "result": office.result})


# ---------------------------------------------------------------------------
# HTTP / WebSocket
# ---------------------------------------------------------------------------
@app.get("/")
async def index() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")


@app.get("/api/models")
async def list_models() -> dict[str, Any]:
    return {
        "models": [
            {"id": key, "label": spec["label"], "available": model_available(key)}
            for key, spec in MODELS.items()
        ],
        "defaults": {"leader": default_model(LEADER_PREFERENCE), "team": default_model(TEAM_PREFERENCE)},
    }


@app.post("/api/tasks", status_code=202)
async def assign_task(job: JobInput):
    M = MSG[job.language]
    for key in (job.manager_choice, job.worker_choice):
        if key not in MODELS:
            return JSONResponse({"detail": M["bad_model"].format(key=key)}, status_code=400)
        if not model_available(key):
            return JSONResponse(
                {"detail": M["no_key"].format(env=MODELS[key]["env"], label=MODELS[key]["label"])},
                status_code=400,
            )
    if not job_lock.acquire(blocking=False):
        return JSONResponse({"detail": M["busy"]}, status_code=409)

    office.busy = True
    office.result = None
    office.agents = {sid: {"status": "idle", "message": ""} for sid in [job.director.id, *(m.id for m in job.team)]}
    office.emit({"type": "job", "state": "started", "prompt": short(job.prompt, 120), "kind": job.kind})
    office.status(job.director.id, "thinking", M["assigning"])

    # Thread riêng (daemon) – không phụ thuộc vào việc giữ tham chiếu asyncio.Task.
    threading.Thread(target=run_job, args=(job,), name="office-job", daemon=True).start()
    return {"message": "Nhiệm vụ đã được chuyển tới văn phòng!"}


@app.websocket("/ws")
async def websocket_route(ws: WebSocket) -> None:
    await office.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        office.disconnect(ws)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000)
