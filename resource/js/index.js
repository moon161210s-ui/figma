/* ==========================================================
   실시간 객실 청소 현황 - 화면 동작
   - 객실 타일 그리기 / 선택 → 우측 상세 패널
   - 퇴실 예정(달력+시간), 청소 가능 시간, 담당 직원 수정 팝오버
   ========================================================== */

const ICON = (name) => `resource/icon/${name}.svg`;
/* 이미지 파일은 resource/img/ 에 있어요 (파일명에 한글·공백·& 가 있어서 주소로 바꿔 써요) */
const IMG = (file) => `resource/img/${encodeURIComponent(file)}.png`;
/* 직원 프로필 사진: 사진이 없는 직원은 보라색 사람 아이콘으로 보여요 */
const STAFF_PHOTO = {
    송혜원: IMG("Profile_송혜원"),
    유가은: IMG("Profile_유가은"),
    이서영: IMG("Profile_이서영"),
    최하석: IMG("Profile_최하석"),
};
/* 메인 우측 패널의 '첨부파일 (4)': 침구 · 미니바 · 욕실 바닥 · 욕실 (시안 순서) */
const ATTACHMENTS = [
    IMG("메인&청소결과상세_01"),
    IMG("메인&청소결과상세_03"),
    IMG("메인&청소결과상세_05"),
    IMG("메인&청소결과상세_06"),
];
/* 청소 결과 상세의 인증사진: [침구 정리 상태, 욕실 청소 상태] (시안 순서 / 앞쪽이 재검수 때 NEW 가 붙는 사진) */
const RESULT_PHOTOS = [
    [IMG("메인&청소결과상세_01"), IMG("메인&청소결과상세_04")],
    [IMG("메인&청소결과상세_06"), IMG("메인&청소결과상세_02"), IMG("메인&청소결과상세_05"), IMG("메인&청소결과상세_02")],
];

/* 사용성 테스트용으로 고정한 청소 인증 사진: { 객실: { 사진 묶음 번호(0 침구 · 1 욕실): [앞에서부터 쓸 사진 경로] } }
   - 105호: 침구 정리는 사진 1장 (욕실은 기본 사진)
   - 107호: 침구 정리는 사진 1장 / 욕실은 물기가 제대로 닦이지 않은 사진 2장 (욕실_물기, 욕실_물기2) */
const FIXED_PHOTOS = {
    105: { 0: [IMG("메인&청소결과상세_04")] },
    107: { 0: [IMG("메인&청소결과상세_04")], 1: [IMG("욕실_물기"), IMG("욕실_물기2")] },
};
/* 107호 재청소 요청 후 직원이 다시 올린 뽀송한 욕실 사진: 재검수 요청 상태에서 욕실 사진 앞쪽에 NEW 배지와 함께 붙어요 (침구는 새 사진 없음) */
const FIXED_PHOTOS_REDO = {
    107: { 1: [IMG("메인&청소결과상세_02"), IMG("메인&청소결과상세_05")] },
};
/* 메인 우측 패널의 첨부파일: 고정 사진이 있는 객실은 그 사진을 맨 앞에 써요 */
const roomPhotos = (no) => {
    const fixed = [...new Set(Object.values(FIXED_PHOTOS[no] || {}).flat())];
    return fixed.length
        ? [
            ...fixed,
            ...ATTACHMENTS.slice(0, Math.max(0, ATTACHMENTS.length - fixed.length)),
        ]
        : ATTACHMENTS;
};

/* 청소 담당자가 청소를 끝내는 시각 (결과 화면 · 업무 특이사항이 같은 시각을 써요) */
const cleanDoneAt = (no) => {
    const r = ROOMS.find((x) => x.no === no);
    return addMinutes(r.clean || r.out, 50);
};

/* ---------- 유틸 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const pad = (n) => String(n).padStart(2, "0");
const toMin = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
};
function addMinutes(t, add) {
    const total = (toMin(t) + add + 1440) % 1440;
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
/* "930", "9:30", "0930" 같은 입력을 "09:30" 으로 맞춰요 (잘못된 값이면 null) */
function normTime(v) {
    const n = String(v).replace(/\D/g, "");
    if (!n) return null;
    let h, m;
    if (n.length <= 2) {
        h = +n;
        m = 0;
    } else if (n.length === 3) {
        h = +n[0];
        m = +n.slice(1);
    } else {
        h = +n.slice(0, 2);
        m = +n.slice(2, 4);
    }
    return h > 23 || m > 59 ? null : `${pad(h)}:${pad(m)}`;
}
const fmtDate = (dt) => `${pad(dt.getMonth() + 1)}.${pad(dt.getDate())}`;
const dayDiff = (a, b) => Math.round((b - a) / 86400000);
/* 아이콘은 svg 파일 색 그대로 사용. 검은색이 아닌 아이콘은 파일명 뒤에 -색상을 붙여요 (예: help-gray, help-purple) */
const icon = (name, size = 20) =>
    `<img class="i${size}" src="${ICON(name)}" alt="" />`;

const stayText = (r) =>
    `${fmtDate(r.start)} - ${fmtDate(r.end)} (${dayDiff(r.start, r.end)}박)`;
const stayTag = (r) => {
    const n = dayDiff(r.origEnd, r.end);
    return n > 0 ? `${n}박 연장` : "";
};
const outTag = (r) => {
    const diff = toMin(r.out) - toMin(r.origOut);
    if (diff <= 0) return "";
    const h = Math.floor(diff / 60),
        m = diff % 60;
    return `${h ? h + "시간" : ""}${h && m ? " " : ""}${m ? m + "분" : ""} 연장`;
};
/* 운영자가 퇴실 시간을 바꿨는데 담당 직원이 아직 확인하지 않았으면 '직원 미확인' 미니 배지를 달아요 (확인하면 사라져요) */
const outUnconfirmedTag = (r) => (r.outChange === "unconfirmed" ? "직원 미확인" : "");
const outChangeNote = (r) =>
    r.outChange && r.staff
        ? `${r.staff} · 퇴실 변경 ${r.outChange === "confirmed" ? "확인완료" : "미확인"} 상태`
        : "";
const cleanText = (r) =>
    r.clean ? `${r.clean} ~ ${addMinutes(r.clean, r.cleanLen)}` : "-";
const staffText = (r) => (r.staff ? `${r.staff}${tagHtml(r.staffTag)}` : "-");
/* 숙박 중이라 오늘 청소 대상이 아닌 객실 (청소를 등록하기 전까지) */
const isStayOnly = (r) => r.status === "stay";
/* 손님 요청으로 청소를 등록할 수 있는 객실: 숙박 중(청소 없음)이거나 빈 객실 (칩이 없는 상태) */
const canRequest = (r) => isStayOnly(r) || (r.empty && !r.status);
/* 청소 목록에 올라오는 객실: 숙박 객실이거나, 빈 객실이라도 청소를 요청해 등록된 객실 */
const inCleanList = (r) => !r.empty || !!r.cleanReq;

/* 요청 청소 취소: 담당자와 청소 가능 시간을 비우고 원래 상태(숙박 중 / 빈 객실)로 돌려요 */
function cancelRequest(r) {
    r.staff = "";
    r.staffTag = "";
    r.clean = null;
    r.cleanLocked = false;
    r.cleanLen = 0;
    r.cleanReq = false;
    if (r.empty) delete r.status;
    else r.status = "stay";
}

/* 퇴실일에 맞춰 청소 대상 여부를 정리해요
   - 퇴실일이 오늘이 되면 숙박 중이던 객실도 청소 필요가 되고, 미리 등록한 요청 청소는 퇴실 청소 하나로 합쳐져요
   - 퇴실일이 오늘이 아니게 되면 (아직 시작 전인) 퇴실 청소는 취소돼요 */
function syncStayStatus(r) {
    if (r.empty) return;
    const today = todayMid();
    if (r.end <= today) {
        if (r.cleanReq) {
            r.cleanReq = false;
            r.cleanLocked = false; /* 퇴실 청소 규칙의 시간으로 돌아가요 */
        }
        if (r.status === "stay") r.status = "todo";
    } else if (["todo", "reassign"].includes(r.status) && !r.cleanReq) {
        r.status = "stay";
        r.staff = "";
        r.staffTag = "";
        r.clean = null;
        r.cleanLocked = false;
        r.cleanLen = 0;
    }
}
const tagHtml = (t) => (t ? `<span class="tag">${t}</span>` : "");

/* ---------- 샘플 데이터 (실제 서비스에서는 서버 데이터로 교체) ---------- */
/* 새 업무를 배정할 수 있는 직원 (퇴사 처리한 직원은 빠져요 / 지난 청소·근무 기록은 그대로 남아요) */
const RESIGNED_KEY = "resignedStaff"; /* { 이름: 퇴사 처리한 날짜(YYYY-M-D) } */
const resignedMap = () => {
    try {
        const v = JSON.parse(localStorage.getItem(RESIGNED_KEY));
        if (Array.isArray(v))
            return Object.fromEntries(v.map((n) => [n, ""])); /* 예전 형식 */
        return v || {};
    } catch (e) {
        return {};
    }
};
const resignedStaff = () => Object.keys(resignedMap());
const STAFF = [
    "이서영",
    "전재연",
    "유가은",
    "한다경",
    "최하석",
    "김이레",
].filter((n) => !resignedStaff().includes(n));
/* 순서 = 청소 상태 필터 드롭다운에 보이는 순서 (시안) */
const STATUS = {
    /* 숙박 중이고 오늘 청소 대상이 아닌 객실: 상태 칩을 보여주지 않아요 */
    stay: { label: "숙박 중", tile: "", panel: "" },
    todo: { label: "청소 필요", tile: "badge-todo", panel: "badge-todo" },
    progress: { label: "청소 중", tile: "badge-progress", panel: "badge-info" },
    done: { label: "청소 완료", tile: "badge-done", panel: "badge-done" },
    reassign: {
        label: "재배정 필요",
        tile: "badge-reassign",
        panel: "badge-reassign",
    },
    review: { label: "검수 대기", tile: "badge-review", panel: "badge-review" },
};

/* 청소 완료는 결과 화면에서 확인하기 전 = 초록 / 확인(검수 완료) 후 = 회색 (청소 결과 화면의 배지와 같아요) */
const statusTile = (r) => (r.status === "done" && r.confirmed ? "badge-todo" : STATUS[r.status].tile);

/* 객실 카드의 날짜는 항상 오늘 기준이에요 (오늘 입실 · nights 박 뒤 퇴실). 실제 서비스에서는 서버의 예약 날짜로 교체 */
const todayMid = () => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
};
const dayAdd = (base, n) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);

/* 직원별 요일 근무 형태 (일 ~ 토 / null = 쉬는 날) — 직원 정보 설정 · 직원 배정이 함께 써요 (서버 연결 시 교체)
   송혜원은 초대 대기라서 아직 근무 일정이 없어요 */
const STAFF_PATTERN = {
    최하석: ["night", null, "night", null, "night", "night", "night"],
    유가은: [null, "day", "day", "day", "day", "day", null],
    이서영: ["aft", null, "day", "day", "aft", null, "night"],
    한다경: ["night", "night", null, null, "night", "night", "night"],
    전재연: [null, "day", null, "day", "day", "day", "day"],
    김이레: ["aft", "aft", null, "aft", "aft", null, null],
    송혜원: [null, null, null, null, null, null, null],
};
/* 날짜별로 따로 고친 근무 형태 { 이름: { 'YYYY-MM-DD': 형태 | null } } (직원 정보 설정에서 저장하면 여기에 보관해요) */
const STAFF_OVER_KEY = "staffOver";
const staffOver = () => {
    try {
        return JSON.parse(localStorage.getItem(STAFF_OVER_KEY)) || {};
    } catch (e) {
        return {};
    }
};
const staffDateKey = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/* 그 날 근무하는 직원인지 (휴무일을 바꾸면 이 값이 바뀌고, 그 날의 자동 배정도 새로 계산돼요) */
function staffWorksOn(name, d) {
    const o = staffOver()[name];
    const k = staffDateKey(d);
    if (o && k in o) return !!o[k];
    return !!(STAFF_PATTERN[name] || [])[d.getDay()];
}

/* 사용성 테스트용 '조퇴하는 직원' (108호 담당): 기본은 전재연이고, 그 날 전재연이 휴무면 김이레가 대신해요 (둘 다 다른 객실은 맡지 않아서 나머지 값은 그대로예요) */
const EARLY_LEAVER =
    ["전재연", "김이레"].find((n) => staffWorksOn(n, todayMid())) || "전재연";

/* 객실 한 건 = 오늘 화면에 보여줄 투숙 정보 (샘플 / 실제 서비스에서는 서버의 예약 데이터로 교체)
   nights   : 숙박 박수 (1박, 2박 …)
   stayed   : 오늘 기준으로 이미 지낸 박수 (생략하면 nights 와 같아요 = 오늘 퇴실)
              → 입실일 = 오늘 - stayed / 퇴실일 = 입실일 + nights  (stayed 가 nights 보다 작으면 연박 중)
   nextIn   : 퇴실 청소 뒤 오늘 새 손님이 입실하는지 / nextNights : 그 손님의 숙박 박수
   extHour  : 퇴실 연장 시간 / extNight : 연박 연장 박수 */
const RAW_ROOMS = [
    {
        no: "101",
        floor: 1,
        status: "done",
        out: "13:00",
        extHour: 2,
        outChange: "confirmed" /* 퇴실 변경을 직원이 확인한 상태 */,
        staff: EARLY_LEAVER,
        clean: "12:00",
        nights: 2,
    },
    {
        no: "102",
        floor: 1,
        status: "progress",
        out: "11:00",
        staff: "유가은",
        nights: 1,
        cleanMin: 40,
        nextIn: true,
        nextNights: 2,
    },
    {
        no: "103",
        floor: 1,
        status: "progress",
        out: "13:00",
        staff: "한다경",
        nights: 3,
        nextIn: true,
        nextNights: 1,
    },
    {
        no: "104",
        floor: 1,
        status: "todo",
        out: "13:00",
        staff: "한다경",
        nights: 1,
        nextIn: true,
        nextNights: 3,
    },
    {
        no: "105",
        floor: 1,
        status: "review",
        out: "11:00",
        staff: "이서영",
        nights: 2,
    },
    {
        no: "106",
        floor: 1,
        status: "done",
        out: "11:00",
        staff: "이서영",
        nights: 1,
        nextIn: true,
        nextNights: 1,
    },
    {
        no: "107",
        floor: 1,
        status: "review",
        out: "13:00",
        staff: "유가은",
        nights: 4,
        nextIn: true,
        nextNights: 2,
    },
    {
        no: "108",
        floor: 1,
        status: "reassign",
        out: "11:00",
        staff: EARLY_LEAVER,
        staffTag: "조퇴",
        nights: 1,
        nextIn: true,
        nextNights: 1,
    },
    {
        no: "201",
        floor: 2,
        outChange: "unconfirmed" /* 퇴실 변경을 직원이 아직 확인하지 못한 상태 */,
        status: "todo",
        out: "13:00",
        staff: "이서영",
        nights: 2,
        nextIn: true,
        nextNights: 2,
    },
    {
        no: "202",
        floor: 2,
        status: "done",
        out: "13:00",
        staff: "김이레",
        nights: 1,
    },
    {
        no: "203",
        floor: 2,
        status: "progress",
        out: "13:00",
        staff: "이서영",
        nights: 5,
        nextIn: true,
        nextNights: 1,
    },
    {
        no: "204",
        floor: 2,
        status: "progress",
        out: "11:00",
        staff: "유가은",
        nights: 2,
        nextIn: true,
        nextNights: 3,
    },
    {
        no: "301",
        floor: 3,
        status: "progress",
        out: "13:00",
        staff: "최하석",
        nights: 1,
        nextIn: true,
        nextNights: 1,
    },
    {
        no: "302",
        floor: 3,
        status: "stay",
        out: "12:00",
        extHour: 1,
        nights: 3,
        stayed: 1,
        extNight: 1,
    },
    {
        no: "303",
        floor: 3,
        status: "todo",
        out: "13:00",
        staff: "이서영",
        nights: 3,
        stayed: 2,
        clean: "11:00",
        cleanReq: true,
    },
    { no: "304", floor: 3, empty: true },
];

/* 오늘 기준으로 입실일 · 퇴실일을 계산해요 (날짜가 바뀌면 refreshToday 가 다시 불러요) */
function setStay(r, base) {
    const nights = r.nights || 1;
    const stayed = r.stayed ?? nights;
    r.start = dayAdd(base, -stayed);
    r.end = dayAdd(r.start, nights);
    r.origEnd = dayAdd(r.end, -(r.extNight || 0));
}
/* 내일 퇴실하는 객실인지: 오늘 새 손님이 입실하면 그 손님의 퇴실일 / 아니면 지금 손님의 퇴실일 (직원 배정 '내일' 탭이 써요) */
function outDateNext(r) {
    const base = todayMid();
    if (r.nextIn) return dayAdd(base, r.nextNights || 1);
    return r.end > base ? r.end : null;
}

/* 시안 샘플: 객실 유형 (층마다 섞어 둬요) */
const ROOM_TYPE = {
    101: "스탠다드", 102: "디럭스", 103: "프리미엄", 104: "스탠다드", 105: "디럭스", 106: "스탠다드", 107: "프리미엄", 108: "디럭스",
    201: "디럭스", 202: "스탠다드", 203: "프리미엄", 204: "스탠다드",
    301: "프리미엄", 302: "디럭스", 303: "스탠다드", 304: "프리미엄",
};

/* 서버에서 받은 객실 한 건을 화면에서 쓰는 형태(날짜 계산 포함)로 바꿔요 */
function normalizeRoom(r) {
    r.type = ROOM_TYPE[r.no] || "스탠다드";
    if (r.empty) {
        if (r.cleanReq && r.status === "done")
            cancelRequest(r); /* 요청 청소가 끝나면 빈 객실로 돌아가요 */
        return r;
    }
    setStay(r, todayMid());
    r.origOut = addMinutes(r.out, -(r.extHour || 0) * 60);
    /* 시안 샘플: 퇴실을 연장한 객실 / 청소 시간을 직접 정한 객실은 '직접 고친 값'으로 취급 */
    r.outLocked = !!r.extHour;
    r.cleanLocked = !!r.clean;
    r.clean = r.clean || r.out;
    if (r.status === "progress" && r.cleanMin == null) r.cleanMin = 12; /* 시안 샘플: 청소를 시작한 지 지난 분 */
    r.cleanLen = 0; /* applyHours() 가 운영 시간대 규칙으로 채워요 */
    syncStayStatus(r);
    if (r.cleanReq && r.status === "done")
        cancelRequest(
            r
        ); /* 요청 청소가 끝나면 다시 숙박 중(칩 없음)으로 돌아가요 */
    return r;
}
/* ---------- 운영 시간대 기본 규칙 (모달에서 설정 / 모든 객실 타일의 기본값) ----------
   - 객실별로 우측 패널에서 직접 고친 시간(outLocked / cleanLocked)은 이 규칙보다 우선해요 */
const HOURS_DEFAULT = {
    weekday: { in: "15:00", out: "11:00" },
    weekend: { in: "15:00", out: "11:00" },
    cleanOut: "0" /* 퇴실 N시간 후부터 청소 */,
    cleanIn: "0" /* 입실 N시간 전까지 청소 */,
    extend: "0" /* 연장 N시간 초과 시 1박 추가 */,
    dayUse: "0" /* 대실 최대 N시간 */,
};
let HOURS = JSON.parse(JSON.stringify(HOURS_DEFAULT));
try {
    const saved = JSON.parse(localStorage.getItem("hours"));
    /* 예전 기본값(입실 20시 · 퇴실 15시) 그대로 저장돼 있던 값은 새 기본값(입실 15시 · 퇴실 11시)으로 바꿔요 */
    const wasOldDefault = (h) => h && h.in === "20:00" && h.out === "15:00";
    if (saved && wasOldDefault(saved.weekday) && wasOldDefault(saved.weekend)) {
        delete saved.weekday;
        delete saved.weekend;
    }
    if (saved) HOURS = { ...HOURS, ...saved };
} catch (e) { }

/* 평일/주말은 퇴실 날짜의 요일로 정해요 (토·일 = 주말) */
const hoursKey = (r) =>
    [0, 6].includes(r.end.getDay()) ? "weekend" : "weekday";

/* 기본 규칙을 모든 객실에 적용해요 (직접 고친 시간은 그대로 둬요)
   퇴실 시간 = 규칙의 퇴실 시간 / 청소 시작 = 퇴실 + N시간 후 / 청소 마감 = 입실 시간 - M시간 전 */
function applyHours() {
    ROOMS.forEach((r) => {
        if (r.empty) {
            /* 빈 객실의 요청 청소: 시작 시간은 직접 정한 값, 마감만 규칙(입실 시간 - M시간)으로 */
            if (r.cleanReq && r.clean) {
                const hh =
                    HOURS[[0, 6].includes(new Date().getDay()) ? "weekend" : "weekday"];
                r.cleanLen = Math.max(
                    0,
                    toMin(hh.in) - Number(HOURS.cleanIn) * 60 - toMin(r.clean)
                );
            }
            return;
        }
        /* 숙박 전환: 퇴실을 "숙박 전환 기준"(시간) 초과해 연장하면 연장 대신 1박 추가로 바꿔요 (0 = 사용 안 함)
               새 퇴실일의 규칙 퇴실 시간으로 돌아가고, 이미 청소가 시작됐거나 끝난 객실은 건드리지 않아요 */
        const limit = Number(HOURS.extend) * 60;
        if (
            limit > 0 &&
            r.outLocked &&
            !["progress", "review", "done"].includes(r.status)
        ) {
            const base = HOURS[hoursKey(r)].out;
            if (toMin(r.out) - toMin(base) > limit) {
                r.nights = (r.nights || 1) + 1;
                r.extNight = (r.extNight || 0) + 1;
                r.extHour = 0;
                r.end = dayAdd(r.end, 1);
                r.outLocked = false;
                syncStayStatus(
                    r
                ); /* 퇴실일이 오늘이 아니게 되면 청소 목록에서 빠져요 */
            }
        }
        const h = HOURS[hoursKey(r)];
        /* 청소가 이미 시작됐거나 끝난 객실은 연장이 확정된 상태라, 규칙을 바꿔도 '연장한 시간'은 그대로 두고 퇴실 시간만 규칙에 맞춰 같이 움직여요 */
        if (r.outLocked && ["progress", "review", "done"].includes(r.status)) {
            if (r.extMin == null)
                r.extMin = Math.max(0, toMin(r.out) - toMin(r.origOut ?? h.out));
            r.out = addMinutes(h.out, r.extMin);
        } else r.extMin = null;
        if (!r.outLocked) r.out = h.out;
        /* '연장' 칩은 운영 시간대에 등록한 퇴실 시간과 이 객실 퇴실 시간의 차이로 계산해요
               (규칙을 바꾸면 직접 고친 객실의 연장 시간도 같이 다시 계산돼요) */
        r.origOut = h.out;
        /* 숙박 중인 객실은 청소 시간을 직접 정하기 전까지 청소 가능 시간이 없어요 */
        if (isStayOnly(r) && !r.cleanLocked) {
            r.clean = null;
            r.cleanLen = 0;
            return;
        }
        if (!r.cleanLocked)
            r.clean = addMinutes(r.out, Number(HOURS.cleanOut) * 60);
        const end = toMin(h.in) - Number(HOURS.cleanIn) * 60;
        r.cleanLen = Math.max(0, end - toMin(r.clean));
    });
}

const ROOMS = RAW_ROOMS.map(normalizeRoom);

/* 직원 배정 화면에서 저장한 담당자를 반영해요 (같은 객실 데이터를 모든 화면이 공유 / 서버 연결 시 서버 값으로 교체)
   - 재배정 필요였던 객실은 담당자가 정해지면 '청소 필요'로 돌아가요 */
function applyAssignments() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem("roomAssign"));
    } catch (e) { }
    if (!saved) return;
    ROOMS.forEach((r) => {
        if (!saved[r.no] || r.empty) return;
        r.staff = saved[r.no];
        r.staffTag = "";
        if (r.status === "reassign") r.status = "todo";
    });
}
/* 조퇴한 직원 (오늘 근무자 목록에서 빠져요 / 담당자를 바꾸면 객실의 조퇴 표시는 지워지지만 이 목록은 그대로 둬요) */
const LEFT_EARLY = new Set(
    RAW_ROOMS.filter((r) => r.staffTag === "조퇴").map((r) => r.staff)
);
applyAssignments();

/* 청소 결과 화면과 공유하는 오늘의 검수 상태 (같은 객실 데이터를 두 화면이 함께 써요 / 서버 연결 시 서버 값으로 교체)
   - 결과 화면에서 검수 완료 · 재청소 요청 · 요청 취소를 하면 여기에 저장하고, 메인의 객실 상태도 같이 바뀌어요 */
const RESULT_KEY = "roomResult";
const todayKey = () => {
    const t = todayMid();
    return `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
};
function loadResultState() {
    try {
        const s = JSON.parse(localStorage.getItem(RESULT_KEY));
        if (s && s.date === todayKey()) return s.rooms || {};
    } catch (e) { }
    return {};
}
function saveResultState(no, row) {
    const rooms = loadResultState();
    rooms[no] = {
        status: row.status,
        confirmed: !!row.confirmed,
        hist: row.hist,
        req: row.req || null,
        msg: row.msg || null,
        first: row.first || null,
        prev: row.prev || null,
        at: row.at,
        resub: !!row.resub,
        memo: row.memo || null,
        redo: row.redo || null,
    };
    try {
        localStorage.setItem(
            RESULT_KEY,
            JSON.stringify({ date: todayKey(), rooms })
        );
    } catch (e) { }
}
/* 재청소 요청 = 메인에서는 다시 '청소 필요' / 검수 완료 = '청소 완료' / 검수 대기 = '검수 대기' */
function applyResultState() {
    const saved = loadResultState();
    ROOMS.forEach((r) => {
        const v = saved[r.no];
        if (!v || r.empty) return;
        r.status = v.status === "reclean" ? "todo" : v.status;
        r.confirmed = !!v.confirmed && v.status === "done";
    });
}
applyResultState();

/* 오늘 퇴사 처리한 직원이 맡은 객실 중 청소를 끝내지 못한 객실(청소 필요 · 청소 중)은 '재배정 필요'로 바꿔요 (담당자 옆에는 조퇴 대신 퇴사 배지) */
function applyResignations() {
    const map = resignedMap();
    const now = todayMid();
    const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    ROOMS.forEach((r) => {
        if (r.empty || !r.staff || map[r.staff] !== today) return;
        if (!["todo", "progress"].includes(r.status)) return;
        r.status = "reassign";
        r.staffTag = "퇴사";
    });
}
applyResignations();
applyHours();

/* 상단 요약 카드 숫자 (서버 데이터로 교체 대상) */
/* 서버가 주는 요약 숫자가 없으면 객실 목록에서 바로 세요 (입실 · 퇴실 · 청소 대상 · 확인 필요) */
let SUMMARY = { checkin: 0, checkout: 0, clean: 0, alert: 0 };
let SUMMARY_AUTO = true;
function deriveSummary() {
    const today = todayMid().getTime();
    const rooms = ROOMS.filter(inCleanList);
    return {
        checkin: rooms.filter(
            (r) => r.nextIn || (r.start && r.start.getTime() === today)
        ).length /* 오늘 입실 예정 */,
        checkout: rooms.filter((r) => r.end && r.end.getTime() === today)
            .length /* 오늘 퇴실 예정 */,
        clean: rooms.filter((r) => !isStayOnly(r))
            .length /* 오늘 청소 대상 = 숙박 중(청소 없음) 객실은 빼요 */,
        alert: rooms.filter((r) => ["review", "reassign"].includes(r.status))
            .length,
    };
}

/* ---------- 상태 ---------- */
let selectedNo = null;
let query = "";
/* '오늘 청소할 목록만 보기' (기본 켜짐): 숙박 중이라 청소가 없는 객실과 청소를 등록하지 않은 빈 객실은 꺼야 보여요 */
let todayOnly = true;
const inTodayList = (r) => inCleanList(r) && !isStayOnly(r);

/* ---------- 객실 타일 ---------- */
function roomCard(r) {
    if (r.empty) {
        const reg = !!r.status; /* 청소를 요청해 등록된 빈 객실 */
        return `
      <article class="room-card is-empty${r.no === selectedNo ? " is-selected" : ""
            }" data-room="${r.no}" tabindex="0" role="button" aria-pressed="${r.no === selectedNo
            }">
        <div class="room-top"><span class="room-no">${r.no}호</span>${reg
                ? `<span class="badge ${statusTile(r)}">${STATUS[r.status].label
                }</span>`
                : ""
            }</div>
        <dl class="room-info">
          <div><dt>퇴실</dt><dd>-</dd></div>
          <div><dt>담당</dt><dd>${staffText(r)}</dd></div>
        </dl>
      </article>`;
    }
    const s = STATUS[r.status];
    return `
      <article class="room-card${r.no === selectedNo ? " is-selected" : ""
        }" data-room="${r.no}" tabindex="0" role="button" aria-pressed="${r.no === selectedNo
        }">
        <div class="room-top">
          <span class="room-no">${r.no}호</span>
          ${isStayOnly(r)
            ? ""
            : `<span class="badge ${statusTile(r)}">${s.label}</span>`
        }
        </div>
        <dl class="room-info">
          <div><dt>퇴실</dt><dd>${r.out}${tagHtml(outTag(r))}${tagHtml(outUnconfirmedTag(r))}</dd></div>
          <div><dt>담당</dt><dd>${staffText(r)}</dd></div>
        </dl>
      </article>`;
}

/* 체크된 필터 값 (처음에는 전부 체크 = 전체 / 아래 FILTER_DEFS 뒤에서 채워요) */
/* 선택한 값만 담아요. 아무것도 선택하지 않으면 필터 없음(= 전체) */
const filters = {
    floor: new Set(),
    status: new Set(),
    rtype: new Set(),
    astatus: new Set(),
    tcat: new Set(),
    wstatus: new Set(),
};
const filterPass = (kind, value) =>
    filters[kind].size === 0 || filters[kind].has(value);

function renderFloors() {
    if (!$("#floors")) return; /* 청소 결과 화면(result.html)에는 없어요 */
    const q = query.trim();
    const floors = [...new Set(ROOMS.map((r) => r.floor))];
    const html = floors
        .map((f) => {
            const list = ROOMS.filter(
                (r) =>
                    r.floor === f &&
                    (!q || r.no.includes(q)) &&
                    (!todayOnly || inTodayList(r)) &&
                    filterPass("floor", String(r.floor)) &&
                    /* 상태가 없는 빈 객실(304호)은 청소 상태 필터를 쓰지 않을 때만 보여요 */
                    (r.status
                        ? filterPass("status", r.status)
                        : filters.status.size === 0)
            );
            if (!list.length) return "";
            return `
      <section class="floor">
        <h2 class="floor-title">${f}F <small>(${list.length}실)</small></h2>
        <div class="room-grid">${list.map(roomCard).join("")}</div>
      </section>`;
        })
        .join("");
    $("#floors").innerHTML =
        html || `<p class="floor-empty">조건에 맞는 객실이 없어요.</p>`;
}

/* ---------- 우측 상세 패널 ---------- */
function renderDetail() {
    const workspace = $("#workspace");
    if (!workspace) return; /* 청소 결과 화면(result.html)에는 없어요 */
    const panel = $("#detail");
    const r = ROOMS.find((x) => x.no === selectedNo);
    workspace.classList.toggle("has-detail", !!r);
    if (!r) {
        panel.innerHTML = "";
        panel.style.height = "";
        return;
    }

    const done = r.status === "done";
    /* 청소가 이미 시작됐거나 끝난 객실은 퇴실(연장)을 바꿀 수 없어요 → 연장은 새 예약으로 들어와요 */
    const outLockedNow = ["progress", "review", "done"].includes(r.status);
    const edit = (kind, label) =>
        done ||
            (r.empty && kind === "checkout") ||
            (kind === "checkout" && outLockedNow)
            ? ""
            : `<button class="btn-icon" type="button" data-edit="${kind}" aria-label="${label} 수정">${icon(
                "pen"
            )}</button>`;
    const row = (label, value, kind) => `
      <div class="detail-row">
        <dt>${label}</dt>
        <dd${kind &&
            !done &&
            !(r.empty && kind === "checkout") &&
            !(kind === "checkout" && outLockedNow)
            ? ' class="has-edit"'
            : ""
        }>${value}</dd>
        ${kind ? edit(kind, label) : ""}
      </div>`;

    panel.innerHTML = `
    <div class="detail-head">
      <h2>선택한 객실 상세</h2>
      <button class="btn-plain" type="button" data-close aria-label="닫기">${icon(
        "close",
        24
    )}</button>
    </div>
    <div class="detail-body">
      <div class="detail-room">
        <span class="detail-room-no">${r.no}호</span>
${(r.empty && !r.status) || isStayOnly(r)
            ? ""
            : `<span class="badge ${statusTile(r)}">${STATUS[r.status].label
            }</span>`
        }
      </div>
      <dl class="detail-info">
        ${row("객실 유형", r.type)}
        ${r.empty
            ? `${row("숙박 일정", "-")}${row("퇴실 예정", "-")}${row(
                "청소 가능 시간",
                cleanText(r),
                "clean"
            )}${row("담당 직원", staffText(r), "staff")}`
            : `${row("숙박 일정", `${stayText(r)}${tagHtml(stayTag(r))}`)}
        <div class="detail-group">
          ${row("퇴실 예정", `${r.out}${tagHtml(outTag(r))}${tagHtml(outUnconfirmedTag(r))}`, "checkout")}
          ${outChangeNote(r) ? `<p class="detail-note">${outChangeNote(r)}</p>` : ""}
        </div>
        ${row("청소 가능 시간", cleanText(r), "clean")}
        ${row("담당 직원", staffText(r), "staff")}`
        }
      </dl>
      ${done
            ? `
        <h3 class="detail-section">첨부파일 <small>(${roomPhotos(r.no).length
            })</small></h3>
        <div class="attach-list">
          ${roomPhotos(r.no)
                .map((src) => `<img src="${src}" alt="청소 완료 사진" />`)
                .join("")}
        </div>`
            : `
        <h3 class="detail-section">첨부파일</h3>
        <div class="attach-empty">
          <strong>등록된 첨부파일이 없어요.</strong>
          담당 직원의 청소가 완료되면 확인할 수 있어요.
        </div>`
        }
    </div>
    <button class="btn btn-lg btn-primary" type="button" data-result ${done || r.status === "review" ? "" : "disabled"
        }>청소 결과 확인하기</button>`;

    fitDetail();
}

/* 패널은 화면 맨 아래(여백 20px)까지 채우고, 스크롤하면 헤더 아래(120px)에 붙어요 */
function fitDetail() {
    const cell = $(".detail-cell");
    if (!cell) return;
    const panel = $("#detail");
    if (!$("#workspace").classList.contains("has-detail")) return;
    const top = Math.max(120, cell.getBoundingClientRect().top);
    panel.style.height = Math.max(480, window.innerHeight - top - 20) + "px";
    /* 시안: 클릭 직후(패널이 아래쪽) 버튼 아래 여백 24px → 스크롤해서 상단에 붙으면 16px */
    const t = Math.min(1, Math.max(0, (top - 120) / 242));
    panel.style.paddingBottom = Math.round(16 + 8 * t) + "px";
}

function selectRoom(no) {
    closePopover();
    selectedNo = no;

    document.querySelectorAll(".room-card[data-room]").forEach((card) => {
        const isSelected = card.dataset.room === no;

        card.classList.toggle("is-selected", isSelected);
        card.setAttribute("aria-pressed", String(isSelected));
    });

    renderDetail();
}

/* ==========================================================
   팝오버
   ========================================================== */
let pop = null; /* 현재 열린 팝오버 요소 */
let popAnchor = null; /* 팝오버를 연 버튼 */

function closePopover() {
    const rd =
        document.getElementById("rsDate") || document.getElementById("thDate");
    if (rd) rd.setAttribute("aria-expanded", "false");
    if (pop) pop.remove();
    pop = null;
    popAnchor = null;
    if (pendingDetail) {
        pendingDetail = false;
        rerenderDetail();
    } /* 수정 중에 바뀐 패널 반영 */
}

/* 팝오버도 열려 있는 동안 기준 버튼이 움직이면(창 크기 조절, 스크롤바 생김/사라짐, 목록 갱신 등) 바로 따라가요 */
let popTrackOn = false;
function trackPopover() {
    if (popTrackOn) return;
    popTrackOn = true;
    let last = "";
    const tick = () => {
        if (!pop || !popAnchor) {
            popTrackOn = false;
            return;
        }
        if (document.contains(popAnchor)) {
            const a = popAnchor.getBoundingClientRect();
            const key = [
                a.left,
                a.top,
                a.width,
                a.height,
                pop.offsetWidth,
                pop.offsetHeight,
                window.innerWidth,
                window.innerHeight,
            ].join();
            if (key !== last) {
                last = key;
                placePopover();
            }
        }
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

/* 시간 선택 목록 HTML: 휴대폰 알람처럼 오전/오후 · 시 · 분 세 줄을 돌려서 골라요 (고른 값은 숨겨진 #id 에 "HH:MM" 으로 들어가요)
   - 시(1~12)와 분(00~59)은 끝없이 이어져서 계속 돌릴 수 있고, 11시에서 12시로 넘어갈 때 오전 ↔ 오후가 알아서 바뀌어요
   - 분이 59 에서 00 으로 넘어가면 시도 하나 넘어가요 (11:59 → 12:00 오후)
   팝오버(퇴실 시간 등)와 운영 시간대 설정 모달이 같이 써요 */
const TP_H_COPIES = 9;
const TP_M_COPIES = 5;
function timePickerHtml(id, value) {
    const t = normTime(value) || "00:00";
    const items = (vals, label) =>
        vals.map((v) => `<button type="button" class="tp-item" data-v="${v}" role="option" aria-selected="false" tabindex="-1">${label(v)}</button>`).join("");
    const rep = (arr, n) => Array.from({ length: n }, () => arr).flat();
    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const mins = Array.from({ length: 60 }, (_, i) => i);
    return `
    <div class="tp" id="tp-${id}">
      <button type="button" class="tp-field" aria-haspopup="listbox" aria-expanded="false">${icon(
        "time"
    )}<span class="tp-text">${t}</span></button>
      <input id="${id}" type="hidden" value="${t}" />
      <div class="tp-panel" hidden>
        <div class="tp-col" data-col="ap" role="listbox">${items(["AM", "PM"], (v) => (v === "AM" ? "오전" : "오후"))}</div>
        <div class="tp-col" data-col="h" role="listbox">${items(rep(hours, TP_H_COPIES), String)}</div>
        <div class="tp-col" data-col="m" role="listbox">${items(rep(mins, TP_M_COPIES), pad)}</div>
      </div>
    </div>`;
}

function placePopover() {
    if (!pop || !popAnchor || !document.contains(popAnchor)) return;
    trackPopover();
    const a = popAnchor.getBoundingClientRect();
    /* 떠 있는 시간 목록이 팝오버 아래로 삐져나오면 그만큼도 화면 안에 들어오게 해요 */
    const pn = pop.querySelector(".tp-panel:not([hidden])");
    const extra = pn
        ? Math.max(
            0,
            pn.getBoundingClientRect().bottom - pop.getBoundingClientRect().bottom
        )
        : 0;
    const w = pop.offsetWidth,
        h = pop.offsetHeight + extra;
    /* 기본은 버튼 오른쪽 끝에 맞추고, data-align="left" 인 팝오버(청소 결과 날짜)는 왼쪽 끝에 맞춰요 */
    let left = pop.dataset.align === "left" ? a.left : a.right - w;
    left = Math.max(
        8,
        Math.min(left, document.documentElement.clientWidth - w - 8)
    );
    let top = a.bottom + 4; /* 버튼 아래 4px */
    if (top + h > window.innerHeight - 4)
        top = Math.max(4, window.innerHeight - h - 4);
    pop.style.left = left + "px";
    pop.style.top = top + "px";
}

function openPopover(kind, anchor, room) {
    closePopover();
    popAnchor = anchor;
    pop = document.createElement("div");
    pop.className = "popover";
    pop.setAttribute("role", "dialog");

    /* 손님 요청으로 등록한 청소는 담당자 · 청소 가능 시간 팝오버에서 취소할 수 있어요 (아직 시작 전일 때만) */
    const cancelBtn =
        room &&
            room.cleanReq &&
            ["todo", "reassign"].includes(room.status) &&
            ["clean", "staff"].includes(kind)
            ? `<button class="btn btn-sm btn-outline pop-cancel" type="button" data-pop-cancel>청소 요청 취소</button>`
            : "";
    const actions = `
    ${cancelBtn}
    <div class="pop-actions">
      <button class="btn btn-sm btn-outline" type="button" data-pop-close>닫기</button>
      <button class="btn btn-sm btn-primary" type="button" data-pop-save>저장하기</button>
    </div>`;
    /* 시간 선택: 오전/오후 · 시 · 분 목록 (timePickerHtml / initTimePicker 참고) */
    const timeField = timePickerHtml;
    /* 저장할 때 시간을 읽어요 (형식이 틀리면 빨간 테두리) */
    const readTime = () => {
        const el = $("#popTime", pop);
        const t = normTime(el.value);
        el.classList.toggle("is-error", !t);
        if (!t) el.focus();
        return t;
    };

    let save = () => true;

    if (kind === "clean") {
        pop.innerHTML = `
      <p class="pop-label">청소 가능 시간</p>
      ${timeField("popTime", room.clean || "10:00")}
      ${actions}`;
        save = () => {
            const t = readTime();
            if (!t) return false;
            room.clean = t;
            room.cleanLocked = true; /* 직접 고친 시간이 기본 규칙보다 우선 */
            applyHours();
            maybeRegisterClean(room);
            return true;
        };
    }

    if (kind === "checkout") {
        let view = new Date(room.end.getFullYear(), room.end.getMonth(), 1);
        let sel = new Date(room.end);
        const drawCal = () => {
            const first = view.getDay();
            const days = new Date(
                view.getFullYear(),
                view.getMonth() + 1,
                0
            ).getDate();
            const cells = ["일", "월", "화", "수", "목", "금", "토"].map(
                (w, i) =>
                    `<span class="dow${i === 0 ? " sun" : i === 6 ? " sat" : ""
                    }">${w}</span>`
            );
            for (let i = 0; i < first; i++) cells.push("<span></span>");
            for (let n = 1; n <= days; n++) {
                const dt = new Date(view.getFullYear(), view.getMonth(), n);
                const disabled = room.dayOk
                    ? !room.dayOk(dt) /* 예약 현황의 대실처럼 날짜를 정해 둔 경우 */
                    : dt <= room.start; /* 입실일 이전·당일은 퇴실일로 선택 불가 */
                const on = dt.getTime() === sel.getTime();
                cells.push(
                    `<button type="button" data-day="${n}"${disabled ? " disabled" : ""}${on ? ' class="is-selected"' : ""
                    }>${n}</button>`
                );
            }
            $(".cal-grid", pop).innerHTML = cells.join("");
            $(".cal-title", pop).textContent = `${view.getFullYear()}년 ${view.getMonth() + 1
                }월`;
        };
        pop.innerHTML = `
      <div class="cal-head">
        <strong class="cal-title"></strong>
        <div class="cal-nav">
          <button class="btn-icon" type="button" data-cal="-1" aria-label="이전 달">${icon(
            "arrow-left"
        )}</button>
          <button class="btn-icon" type="button" data-cal="1" aria-label="다음 달">${icon(
            "arrow-right"
        )}</button>
        </div>
      </div>
      <div class="cal-grid"></div>
      <div class="cal-time">
        <p class="pop-label">퇴실 시간</p>
        ${timeField("popTime", room.out)}
      </div>
      ${actions}`;
        drawCal();
        pop.addEventListener("click", (e) => {
            const nav = e.target.closest("[data-cal]");
            const day = e.target.closest("[data-day]");
            if (nav) {
                view = new Date(
                    view.getFullYear(),
                    view.getMonth() + Number(nav.dataset.cal),
                    1
                );
                drawCal();
            }
            if (day && !day.disabled) {
                sel = new Date(
                    view.getFullYear(),
                    view.getMonth(),
                    Number(day.dataset.day)
                );
                drawCal();
            }
            placePopover();
        });
        save = () => {
            const t = readTime();
            if (!t) return false;
            /* 예약 현황에서 연 팝오버는 예약 데이터에 저장해요 (reservation.js) */
            if (room.rvSave) {
                room.rvSave(sel, t);
                return true;
            }
            const changed = room.out !== t || room.end.getTime() !== sel.getTime();
            room.end = sel;
            room.out = t;
            if (changed && room.staff) room.outChange = "unconfirmed"; /* 직원이 확인하기 전까지 '직원 미확인' */
            room.outLocked = true; /* 직접 고친 시간이 기본 규칙보다 우선 */
            syncStayStatus(room); /* 퇴실일이 바뀌면 청소 대상 여부도 바뀌어요 */
            applyHours();
            renderSummary(); /* 퇴실일이 바뀌면 위쪽 요약 카드 숫자도 같이 바뀌어요 */
            return true;
        };
    }

    if (kind === "staff") {
        let chosen = room.staff;
        const drawStaff = () => {
            $(".staff-list", pop).innerHTML = STAFF.map((name) => {
                const rooms = room.noRooms
                    ? "" /* 업무 특이사항의 담당자 배정은 호실 줄 없이 이름만 보여줘요 */
                    : ROOMS.filter((x) => x.staff === name)
                        .map((x) => x.no + "호")
                        .join(", ") || "배정된 객실 없음";
                const photo = STAFF_PHOTO[name]
                    ? `<img src="${STAFF_PHOTO[name]}" alt="" />`
                    : `<span class="staff-initial">${name[0]}</span>`; /* 사진이 없는 직원은 이름 첫 글자 */
                return `
          <button class="staff-item${name === chosen ? " is-selected" : ""}${room.noRooms ? " is-simple" : ""
                    }" type="button" data-staff="${name}" role="radio" aria-checked="${name === chosen
                    }">
            ${photo}
            <span class="staff-text"><strong>${name}</strong>${rooms ? `<span>${rooms}</span>` : ""}</span>
            <span class="radio"></span>
          </button>`;
            }).join("");
        };
        pop.innerHTML = `
      <p class="pop-label">오늘 근무 직원</p>
      <div class="staff-list" role="radiogroup"></div>
      ${actions}`;
        drawStaff();
        pop.addEventListener("click", (e) => {
            const item = e.target.closest("[data-staff]");
            if (item) {
                chosen = item.dataset.staff;
                drawStaff();
            }
        });
        save = () => {
            if (room.onAssign) {
                /* 업무 특이사항: 고른 직원을 그 특이사항의 담당자로 저장해요 (thread.js) */
                room.onAssign(chosen);
                return true;
            }
            if (chosen !== room.staff) {
                room.staff = chosen;
                room.staffTag = ""; /* 조퇴 표시는 이전 직원 기준이라 지워요 */
                if (room.status === "reassign")
                    room.status = "todo"; /* 재배정 완료 → 청소 필요 */
            }
            maybeRegisterClean(room);
            return true;
        };
    }

    /* 청소 결과 · 업무 특이사항 날짜 선택: 퇴실 예정 모달과 같은 달력인데 시간 칸만 없어요 (날짜 제한 없음 / 실제 달력) */
    if (
        kind === "resultDate" ||
        kind === "threadDate" ||
        kind === "threadHistDate"
    ) {
        pop.dataset.align = "left";
        if (kind === "threadHistDate")
            pop.classList.add("is-above"); /* 특이사항 상세 패널 위에 떠요 */
        const baseDate =
            kind === "threadHistDate"
                ? tdPick || new Date()
                : kind === "threadDate"
                    ? tdDate
                    : rsDate;
        let view = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        let sel = new Date(baseDate);
        const todayMid = new Date();
        todayMid.setHours(0, 0, 0, 0);
        const drawCal = () => {
            const first = view.getDay();
            const days = new Date(
                view.getFullYear(),
                view.getMonth() + 1,
                0
            ).getDate();
            const cells = ["일", "월", "화", "수", "목", "금", "토"].map(
                (w, i) =>
                    `<span class="dow${i === 0 ? " sun" : i === 6 ? " sat" : ""
                    }">${w}</span>`
            );
            for (let i = 0; i < first; i++) cells.push("<span></span>");
            for (let n = 1; n <= days; n++) {
                const dt = new Date(view.getFullYear(), view.getMonth(), n);
                const on = dt.getTime() === sel.getTime();
                const isToday = dt.getTime() === todayMid.getTime();
                const cls = [on ? "is-selected" : "", isToday ? "is-today" : ""]
                    .filter(Boolean)
                    .join(" ");
                cells.push(
                    `<button type="button" data-day="${n}"${cls ? ` class="${cls}"` : ""
                    }${isToday ? ' aria-label="오늘"' : ""}>${n}</button>`
                );
            }
            $(".cal-grid", pop).innerHTML = cells.join("");
            $(".cal-title", pop).textContent = `${view.getFullYear()}년 ${view.getMonth() + 1
                }월`;
        };
        pop.innerHTML = `
      <div class="cal-head">
        <strong class="cal-title"></strong>
        <div class="cal-nav">
          <button class="btn-icon" type="button" data-cal="-1" aria-label="이전 달">${icon(
            "arrow-left"
        )}</button>
          <button class="btn-icon" type="button" data-cal="1" aria-label="다음 달">${icon(
            "arrow-right"
        )}</button>
        </div>
      </div>
      <div class="cal-grid"></div>
      ${actions}`;
        drawCal();
        pop.addEventListener("click", (e) => {
            const nav = e.target.closest("[data-cal]");
            const day = e.target.closest("[data-day]");
            if (nav) {
                view = new Date(
                    view.getFullYear(),
                    view.getMonth() + Number(nav.dataset.cal),
                    1
                );
                drawCal();
            }
            if (day) {
                sel = new Date(
                    view.getFullYear(),
                    view.getMonth(),
                    Number(day.dataset.day)
                );
                drawCal();
            }
            placePopover();
        });
        save = () => {
            if (kind === "threadHistDate") {
                closePopover();
                tdGoDate(sel);
                return false;
            }
            if (kind === "threadDate") {
                tdDate = sel;
                closePopover();
                renderThread();
                return false;
            }
            rsDate = sel;
            rsSelected = null;
            closePopover();
            renderResults();
            renderResultDetail();
            return false; /* 이미 닫고 다시 그렸어요 */
        };
    }

    pop.addEventListener("click", (e) => {
        if (e.target.closest("[data-pop-close]")) closePopover();
        if (e.target.closest("[data-pop-cancel]")) {
            cancelRequest(room);
            closePopover();
            renderSummary();
            renderFloors();
            renderDetail();
        }
        if (e.target.closest("[data-pop-save]")) {
            if (save()) {
                closePopover();
                if (room && room.afterSave) return room.afterSave();
                renderFloors();
                renderDetail();
            }
        }
    });

    const timeInput = $("#popTime", pop);
    if (timeInput) {
        timeInput.addEventListener("input", () => {
            const n = timeInput.value.replace(/\D/g, "").slice(0, 4);
            timeInput.value = n.length > 2 ? `${n.slice(0, 2)}:${n.slice(2)}` : n;
            timeInput.classList.remove("is-error");
        });
        timeInput.addEventListener("blur", () => {
            const t = normTime(timeInput.value);
            if (t) timeInput.value = t;
        });
        timeInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") $("[data-pop-save]", pop).click();
        });
    }

    /* 퇴실 예정(요일+시간 설정) 모달만 높이 400px 로 고정하고, 내용이 넘치면 본문만 스크롤돼요 (닫기/저장하기 버튼은 아래에 고정) */
    if (kind === "checkout") {
        pop.classList.add("is-fixed");
        const body = document.createElement("div");
        body.className = "pop-body";
        const act = $(".pop-actions", pop);
        while (pop.firstChild && pop.firstChild !== act)
            body.appendChild(pop.firstChild);
        pop.insertBefore(body, act);
    }

    document.body.appendChild(pop);
    initTimePicker(pop);
    placePopover();
}

/* 시간 선택 목록 동작: 세 줄을 손으로(휠 · 터치) 돌리거나 눌러서 고르고, 방향키 위·아래로도 돌려요
   내부 값은 하루 중 몇 분인지(T)로 들고 있어서, 시 · 분이 넘어갈 때 오전/오후와 시가 자연스럽게 따라가요 */
function initTimePicker(root) {
    root.querySelectorAll(".tp").forEach((tp) => initOneTimePicker(root, tp));
}
function initOneTimePicker(root, tp) {
    const ROW = 40; /* 한 줄 높이 (CSS .tp-item 과 같아야 해요) */
    const input = $("input[type=hidden]", tp);
    const text = $(".tp-text", tp);
    const field = $(".tp-field", tp);
    const panel = $(".tp-panel", tp);
    const cols = {};
    tp.querySelectorAll(".tp-col").forEach((c) => (cols[c.dataset.col] = c));
    const copies = { h: TP_H_COPIES, m: TP_M_COPIES };
    const size = { ap: 2, h: 12, m: 60 };
    let T = 0; /* 하루 중 분 (0~1439) */
    const toT = (value) => {
        const t = normTime(value);
        return t ? +t.slice(0, 2) * 60 + +t.slice(3) : null;
    };
    const wrap = (n) => ((n % 1440) + 1440) % 1440;
    const idxOf = (key) => {
        const h24 = Math.floor(T / 60);
        if (key === "ap") return h24 < 12 ? 0 : 1;
        if (key === "h") return (h24 % 12 || 12) - 1 + size.h * Math.floor(copies.h / 2); /* 가운데 묶음에서 */
        return (T % 60) + size.m * Math.floor(copies.m / 2);
    };
    const ref = { ap: 0, h: 0, m: 0 }; /* 줄마다 지금 가운데에 있는 칸 번호 */
    const lock = { ap: 0, h: 0, m: 0 };
    const place = (key) => {
        const col = cols[key];
        const i = idxOf(key);
        ref[key] = i;
        lock[key] = Date.now() + 160;
        col.scrollTop = i * ROW;
        col.querySelectorAll(".tp-item").forEach((b, n) => {
            const on = n === i;
            b.classList.toggle("is-selected", on);
            b.setAttribute("aria-selected", String(on));
            b.tabIndex = on ? 0 : -1;
        });
    };
    const render = () => {
        const v = `${pad(Math.floor(T / 60))}:${pad(T % 60)}`;
        input.value = v;
        text.textContent = v;
        input.classList.remove("is-error");
    };
    /* 값이 바뀌면 세 줄을 모두 새 값에 맞춰요 (돌리고 있던 줄은 그대로 두고 나머지만 따라가요) */
    const sync = (except) => {
        render();
        ["ap", "h", "m"].forEach((k) => {
            if (k === except) return;
            if (panel.hidden) return;
            if (k === "ap") {
                ref.ap = idxOf("ap");
                lock.ap = Date.now() + 400;
                cols.ap.scrollTo({ top: ref.ap * ROW, behavior: "smooth" });
                cols.ap.querySelectorAll(".tp-item").forEach((b, n) => {
                    b.classList.toggle("is-selected", n === ref.ap);
                    b.setAttribute("aria-selected", String(n === ref.ap));
                    b.tabIndex = n === ref.ap ? 0 : -1;
                });
            } else place(k);
        });
    };
    const settle = (key) => {
        const col = cols[key];
        let i = Math.round(col.scrollTop / ROW);
        i = Math.max(0, Math.min(col.children.length - 1, i));
        const d = i - ref[key];
        if (!d) return;
        if (key === "ap") {
            ref.ap = i;
            if (i !== idxOf("ap")) T = wrap(T + 720);
            col.querySelectorAll(".tp-item").forEach((b, n) => {
                b.classList.toggle("is-selected", n === i);
                b.setAttribute("aria-selected", String(n === i));
                b.tabIndex = n === i ? 0 : -1;
            });
            sync("ap");
            return;
        }
        T = wrap(T + (key === "h" ? d * 60 : d));
        sync();
        place(key); /* 돌린 줄도 가운데 묶음으로 옮겨 다시 끝없이 돌릴 수 있게 해요 */
    };
    ["ap", "h", "m"].forEach((key) => {
        let timer = null;
        cols[key].addEventListener("scroll", () => {
            if (Date.now() < lock[key] || panel.hidden) return;
            clearTimeout(timer);
            timer = setTimeout(() => settle(key), 110);
        });
    });
    /* 칸을 누르면 그 칸이 가운데로 돌아와요 */
    tp.addEventListener("click", (e) => {
        const b = e.target.closest(".tp-item");
        if (!b) return;
        const col = b.parentElement;
        const i = [...col.children].indexOf(b);
        col.scrollTo({ top: i * ROW, behavior: "smooth" });
        /* 부드럽게 돌아가는 동안 settle 이 불리지만, 안 불리는 환경(움직임 없음)에서도 값은 바뀌게 바로 한 번 처리해요 */
        setTimeout(() => settle(col.dataset.col), 260);
    });
    tp.addEventListener("keydown", (e) => {
        const b = e.target.closest(".tp-item");
        if (!b || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
        e.preventDefault();
        const col = b.parentElement;
        const key = col.dataset.col;
        const i = Math.max(0, Math.min(col.children.length - 1, ref[key] + (e.key === "ArrowDown" ? 1 : -1)));
        col.scrollTo({ top: i * ROW, behavior: "smooth" });
        setTimeout(() => settle(key), 260);
        col.children[i].focus({ preventScroll: true });
    });
    const setOpen = (on) => {
        panel.hidden = !on;
        field.setAttribute("aria-expanded", String(on));
        if (on) ["ap", "h", "m"].forEach(place);
        placePopover(); /* 목록이 화면 아래로 넘치면 팝오버를 그만큼 위로 올려요 */
    };
    field.addEventListener("click", () => setOpen(panel.hidden));
    /* 바깥에서 값을 바꿀 때 (예: 평일/주말 탭 전환) */
    tp._set = (value) => {
        const t = toT(value);
        if (t == null) return;
        T = t;
        render();
        setOpen(false);
    };
    root.addEventListener("click", (e) => {
        if (!panel.hidden && !tp.contains(e.target)) setOpen(false);
    });
    root.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !panel.hidden) {
            e.stopPropagation();
            setOpen(false);
            field.focus();
        }
    });
    T = toT(input.value) ?? 0;
    render();
}

/* ==========================================================
   필터 드롭다운 (체크박스 다중 선택)
   - 행 40px, 목록은 360px 에서 멈추고 스크롤
   - 항목이 SEARCH_MIN 개를 넘으면 상단에 검색 입력창 표시
   - 하단 공용 버튼은 이 드롭다운에서는 사용하지 않음
   ========================================================== */
const SEARCH_MIN = 20;
const RESULT_TYPES = ["스탠다드", "디럭스", "프리미엄"];
const FILTER_DEFS = {
    astatus: {
        base: "배정 상태",
        options: () => [
            { value: "assigned", label: "배정 완료" },
            { value: "need", label: "재배정 필요" },
        ],
    },
    /* 직원 정보 설정의 현재 근무 상태 (user-info.js 의 SI_WSTATE) */
    wstatus: {
        base: "현재 근무 상태",
        options: () =>
            Object.entries(typeof SI_WSTATE !== "undefined" ? SI_WSTATE : {}).map(
                ([value, label]) => ({ value, label })
            ),
    },
    /* 업무 특이사항 카테고리 (thread.js 의 TH_CATS) */
    tcat: {
        base: "전체",
        options: () =>
            (typeof TH_CATS !== "undefined" ? TH_CATS : []).map((c) => ({
                value: c.id,
                label: c.name,
            })),
    },
    rtype: {
        base: "객실 유형",
        options: () => RESULT_TYPES.map((t) => ({ value: t, label: t })),
    },
    floor: {
        base: "층 전체",
        options: () =>
            [...new Set(ROOMS.map((r) => r.floor))].map((f) => ({
                value: String(f),
                label: f + "F",
            })),
    },
    status: {
        base: "청소 상태 전체",
        options: () =>
            Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })),
    },
};
/* 체크 표시: resource/iconcheck-white.svg (보라 배경 위 흰색 체크) */
const CHECK_SVG = icon("check-white", 16);

let fmenu = null,
    fmenuBtn = null,
    fmenuKind = null;

/* 검수 대기 / 재배정 필요 카드: 청소 상태 필터가 딱 이 두 값일 때만 보라색(선택) */
const ALERT_STATUS = ["review", "reassign"];
function syncAlertCard() {
    const card = document.querySelector("[data-summary-card='alert']");
    if (!card) return;
    const f = filters.status;
    const on =
        f.size === ALERT_STATUS.length && ALERT_STATUS.every((v) => f.has(v));
    card.classList.toggle("is-selected", on);
    card.setAttribute("aria-pressed", String(on));
}
function toggleAlertCard() {
    const on = document
        .querySelector("[data-summary-card='alert']")
        .classList.contains("is-selected");
    filters.status.clear();
    if (!on) ALERT_STATUS.forEach((v) => filters.status.add(v));
    closeFilterMenu();
    updateFilterButtons();
    renderFloors();
}

function updateFilterButtons() {
    syncAlertCard();
    document.querySelectorAll(".select[data-filter]").forEach((btn) => {
        const kind = btn.dataset.filter,
            def = FILTER_DEFS[kind];
        /* 고른 순서대로 보여줘요 (첫 번째 값 + 외 N) */
        const opts = def.options();
        const picked = [...filters[kind]]
            .map((v) => opts.find((o) => o.value === v))
            .filter(Boolean);
        let text = def.base; /* 아무것도 고르지 않음 = 기본 문구 (Default) */
        if (picked.length)
            text =
                picked[0].label + (picked.length > 1 ? ` 외 ${picked.length - 1}` : "");
        btn.querySelector(".select-label").textContent = text;
        btn.classList.toggle(
            "is-active",
            picked.length > 0
        ); /* 값을 고름 (completed) */
    });
}

function closeFilterMenu() {
    if (fmenuBtn) fmenuBtn.setAttribute("aria-expanded", "false");
    if (fmenu) fmenu.remove();
    fmenu = fmenuBtn = fmenuKind = null;
}

/* 메뉴가 열려 있는 동안에는 버튼 자리가 바뀌면(창 크기 조절, 스크롤바 생김/사라짐, 목록 갱신 등) 메뉴도 바로 따라가요 */
let fmTrackOn = false;
function trackFilterMenu() {
    if (fmTrackOn) return;
    fmTrackOn = true;
    let last = "";
    const tick = () => {
        if (!fmenu || !fmenuBtn || !fmenuBtn.isConnected) {
            fmTrackOn = false;
            return;
        }
        const a = fmenuBtn.getBoundingClientRect();
        const key = [a.left, a.top, a.width, a.height, window.innerHeight].join();
        if (key !== last) {
            last = key;
            placeFilterMenu();
        }
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

function placeFilterMenu() {
    if (!fmenu || !fmenuBtn) return;
    trackFilterMenu();
    const a = fmenuBtn.getBoundingClientRect();
    fmenu.style.width = Math.max(180, a.width) + "px";
    let top = a.bottom + 4;
    const h = fmenu.offsetHeight;
    if (top + h > window.innerHeight - 8) top = Math.max(8, a.top - h - 4);
    /* 프로필 메뉴는 버튼 오른쪽 끝선에 메뉴 오른쪽 끝선을 맞추고, 필터는 왼쪽 끝선을 맞춰요 */
    const left = fmenuKind === "profile" ? a.right - fmenu.offsetWidth : a.left;
    fmenu.style.left = Math.max(8, left) + "px";
    fmenu.style.top = top + "px";
}

/* ---------- 프로필 메뉴 (마이페이지 / 사업장 정보 / 내 문의 / 로그아웃) ---------- */
function openProfileMenu(btn) {
    const wasSame = fmenuBtn === btn;
    closePopover();
    closeFilterMenu();
    if (wasSame) return;
    fmenuBtn = btn;
    fmenuKind = "profile";
    btn.setAttribute("aria-expanded", "true");
    fmenu = document.createElement("div");
    fmenu.className = "filter-menu";
    fmenu.setAttribute("role", "menu");
    fmenu.innerHTML = `
    <ul class="filter-list">
      <li class="filter-item" role="menuitem" data-menu="mypage"><span class="label">마이페이지</span></li>
      <li class="filter-item" role="menuitem" data-menu="business"><span class="label">사업장 정보</span></li>
      <li class="filter-item" role="menuitem" data-menu="inquiry"><span class="label">내 문의</span></li>
    </ul>
    <button class="menu-logout" type="button" data-menu="logout">로그아웃</button>`;
    document.body.appendChild(fmenu);
    /* 각 메뉴가 연결할 페이지/기능은 아직 없어서 지금은 누르면 메뉴를 닫고 '준비 중' 모달을 띄워요 */
    fmenu.addEventListener("click", (e) => {
        if (!e.target.closest("[data-menu]")) return;
        closeFilterMenu();
        openSoon();
    });
    placeFilterMenu();
}

/* ---------- 사이드바 사업장 선택 (다른 필터 드롭다운과 같은 모양 / 필터 초기화 버튼만 없어요) ---------- */
const TEAM_LIST = ["벤디호텔", "솔바람 스테이", "베리문호텔"];
function openTeamMenu(btn) {
    const wasSame = fmenuBtn === btn;
    closePopover();
    closeFilterMenu();
    if (wasSame) return;
    fmenuBtn = btn;
    fmenuKind = "team";
    btn.setAttribute("aria-expanded", "true");
    fmenu = document.createElement("div");
    fmenu.className = "filter-menu";
    fmenu.setAttribute("role", "menu");
    fmenu.innerHTML = `<ul class="filter-list">${TEAM_LIST.map(
        (n) => `<li class="filter-item" role="menuitem" data-team="${n}"><span class="label">${n}</span></li>`
    ).join("")}</ul>`;
    document.body.appendChild(fmenu);
    /* 사업장 전환 기능은 아직 없어서 누르면 메뉴를 닫고 '준비 중' 모달을 띄워요 */
    fmenu.addEventListener("click", (e) => {
        if (!e.target.closest("[data-team]")) return;
        closeFilterMenu();
        openSoon();
    });
    placeFilterMenu();
}

function openFilterMenu(btn) {
    const kind = btn.dataset.filter;
    const wasSame = fmenuBtn === btn;
    closePopover();
    closeFilterMenu();
    if (wasSame) return;

    const options = FILTER_DEFS[kind].options();
    fmenuBtn = btn;
    fmenuKind = kind;
    btn.setAttribute("aria-expanded", "true");
    fmenu = document.createElement("div");
    fmenu.className = "filter-menu";
    const hasSearch = options.length > SEARCH_MIN;
    fmenu.innerHTML = `
    ${hasSearch
            ? `<label class="filter-search">
          <img class="i16 fs-icon" src="${ICON("search-gray")}" alt="" />
          <img class="i16 fs-icon-focus" src="${ICON(
                "search"
            )}" alt="" aria-hidden="true" />
          <input type="text" placeholder="검색" /></label>`
            : ""
        }
    <ul class="filter-list" role="listbox" aria-multiselectable="true"></ul>
    <button class="filter-reset" type="button">${icon(
            "reset",
            16
        )}필터 초기화</button>`;
    document.body.appendChild(fmenu);

    const list = fmenu.querySelector(".filter-list");
    let keyword = "";
    const draw = () => {
        const kw = keyword.trim().toLowerCase();
        const shown = options.filter((o) => o.label.toLowerCase().includes(kw));
        list.innerHTML = shown.length
            ? shown
                .map((o) => {
                    const on = filters[kind].has(o.value);
                    return `
          <li class="filter-item${on ? " is-checked" : ""
                        }" role="option" aria-selected="${on}" data-value="${o.value}">
            <span class="filter-check">${CHECK_SVG}</span><span class="label">${o.label
                        }</span>
          </li>`;
                })
                .join("")
            : `<li class="filter-empty">검색 결과가 없습니다</li>`;
        placeFilterMenu();
    };
    draw();
    const apply = () => {
        draw();
        updateFilterButtons();
        if (kind === "astatus") renderAssignRooms();
        else if (kind === "rtype") renderResults();
        else if (kind === "tcat") renderThread();
        else if (kind === "wstatus") renderStaffInfo();
        else renderFloors();
    };

    list.addEventListener("click", (e) => {
        const li = e.target.closest(".filter-item");
        if (!li) return;
        const set = filters[kind],
            v = li.dataset.value;
        set.has(v) ? set.delete(v) : set.add(v);
        apply();
    });
    /* 필터 초기화: 선택을 모두 지워서 전체가 보이게 해요 */
    fmenu.querySelector(".filter-reset").addEventListener("click", () => {
        filters[kind].clear();
        apply();
    });
    const input = fmenu.querySelector("input");
    if (input) {
        input.addEventListener("input", () => {
            keyword = input.value;
            draw();
        });
        input.focus();
    }
    placeFilterMenu();
}

/* ==========================================================
   이벤트
   ========================================================== */
document.addEventListener("click", (e) => {
    const tbtn = e.target.closest(".team-select");
    if (tbtn) {
        openTeamMenu(tbtn);
        return;
    }
    const pbtn = e.target.closest("#profileBtn");
    if (pbtn) {
        openProfileMenu(pbtn);
        return;
    }
    if (typeof handleResultsClick === "function" && handleResultsClick(e)) return;
    if (typeof handleThreadClick === "function" && handleThreadClick(e)) return;
    if (typeof handleReserveClick === "function" && handleReserveClick(e)) return;
    const fbtn = e.target.closest(".select[data-filter]");
    if (fbtn) {
        openFilterMenu(fbtn);
        return;
    }
    if (fmenu && !e.composedPath().includes(fmenu)) closeFilterMenu();
    const card = e.target.closest(".room-card[data-room]");
    if (card) {
        selectRoom(card.dataset.room);
        return;
    }
    if (
        e.target.closest("[data-summary-card='alert']") &&
        !e.target.closest(".tip")
    ) {
        toggleAlertCard();
        return;
    }

    if (e.target.closest("[data-close]")) {
        selectedNo = null;
        closePopover();
        renderFloors();
        renderDetail();
        return;
    }

    /* 청소 결과 확인하기 → 청소 결과 화면에서 이 객실의 상세까지 열어요 */
    const resBtn = e.target.closest("[data-result]");
    if (resBtn && !resBtn.disabled) {
        const t = todayMid();
        const room = ROOMS.find((x) => x.no === selectedNo);
        if (room)
            goResult({
                room: room.no,
                date: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`,
            });
        return;
    }
    const editBtn = e.target.closest("[data-edit]");
    if (editBtn) {
        const same = pop && popAnchor === editBtn;
        closePopover();
        if (!same)
            openPopover(
                editBtn.dataset.edit,
                editBtn,
                ROOMS.find((x) => x.no === selectedNo)
            );
        return;
    }

    /* 팝오버 바깥을 누르면 닫기 */
    /* (팝오버 안에서 목록이 다시 그려져도 안쪽 클릭으로 인식하도록 composedPath 사용) */
    if (pop && !e.composedPath().includes(pop)) closePopover();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (hoursOpen()) closeHours();
        else if (fmenu) closeFilterMenu();
        else if (pop) closePopover();
        else if (document.getElementById("rsModal")?.hidden === false) {
            /* 청소 결과 모달이 열려 있으면 모달만 닫아요 (result.js) */
        } else if (document.getElementById("thModal")?.hidden === false) {
            /* 리스트 설정 모달이 열려 있으면 모달만 닫아요 (thread.js) */
        } else if (typeof rsSelected !== "undefined" && rsSelected) closeRsDetail();
        else if (selectedNo) {
            selectedNo = null;
            renderFloors();
            renderDetail();
        }
    }
    const card = e.target.closest && e.target.closest(".room-card[data-room]");
    if (card && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        selectRoom(card.dataset.room);
    }
});

function setTodayOnly(on) {
    todayOnly = on;
    const sw = $("#todayOnly");
    if (sw) {
        sw.classList.toggle("is-on", on);
        sw.setAttribute("aria-checked", String(on));
    }
    renderFloors();
}
$("#todayOnly")?.addEventListener("click", () => setTodayOnly(!todayOnly));

$("#roomSearch")?.addEventListener("input", (e) => {
    query = e.target.value;
    renderFloors();
});

/* 검색·필터 줄이 화면 위에 붙었는지(is-stuck) 알려줘요.
   붙기 전: 필터 상자 바로 아래에 층 제목이 이어져요(간격 0) / 붙은 뒤: 아래로 20px 더 흰 배경을 깔아 스크롤되는 타일을 가려요 */
function updateToolbarStuck() {
    const bar = $(".toolbar");
    if (!bar) return; /* 청소 결과 화면(result.html)에는 없어요 */
    const stickyTop = parseFloat(getComputedStyle(bar).top) || 0;
    bar.classList.toggle(
        "is-stuck",
        bar.getBoundingClientRect().top <= stickyTop + 0.5
    );
}
updateToolbarStuck();

window.addEventListener(
    "scroll",
    () => {
        updateToolbarStuck();
        fitDetail();
        placePopover();
        placeFilterMenu();
    },
    { passive: true }
);
window.addEventListener("resize", () => {
    updateToolbarStuck();
    fitDetail();
    placePopover();
    placeFilterMenu();
});

renderFloors();
renderDetail();

/* ==========================================================
   실시간 데이터 갱신 (SSE)
   - 직원 앱에서 상태가 바뀌면 서버가 변경된 객실만 이 화면으로 보내요 (전체 새로고침 없음)
   - 변경된 객실 타일 / 상단 통계 / 알림 / (선택된 객실이면) 우측 상세 패널만 갱신해요
   - 선택된 객실(Active)·우측 패널·필터·검색어·패널 스크롤 위치는 그대로 유지돼요
   - 연결이 끊기면 브라우저가 자동으로 다시 연결하고, 다시 붙으면 전체 데이터를 한 번 받아 빠진 변경을 맞춰요
   - 연결이 끊겨 있는 동안에만 1분마다 가져오기(폴링)로 대신해요 / 숨겨진 탭에서는 폴링하지 않아요

   서버가 보내는 이벤트 (event 이름 : data)
     room         : 변경된 객실 1건 또는 배열   예) {"no":"102","status":"done"}  (바뀐 필드만 보내도 돼요)
     summary      : {"checkin":12,"checkout":15,"clean":17,"alert":3}
     notification : 알림 배열 전체
     snapshot     : {rooms, summary, notifications} 전체 (처음 연결 / 재연결 때)
   ========================================================== */
const SSE_URL =
    ""; /* ★ 서버 연결 지점 ★ 예) "/api/rooms/stream"  (비워두면 실시간 연결 없이 동작) */
const POLL_MS = 60 * 1000; /* SSE 연결이 끊겨 있을 때 대신 가져오는 간격 */
const STALE_MS =
    30 * 1000; /* 탭으로 돌아왔을 때, 마지막 갱신이 이보다 오래됐으면 바로 갱신 */
let lastFetch = Date.now();
let refreshing = false;
let sseLive = false; /* 실시간 연결이 살아 있는지 */
let pendingDetail = false; /* 팝오버 수정 중에 바뀐 패널은 팝오버가 닫힌 뒤 갱신 */

/* ★ 서버 연결 지점 (전체 가져오기: 재연결 / 폴링) ★
     const res = await fetch("/api/rooms/live");
     if (!res.ok) throw new Error(res.status);
     const data = await res.json();
     return { rooms: data.rooms.map(normalizeRoom), summary: data.summary, notifications: data.notifications }; */
async function fetchDashboard() {
    return { rooms: ROOMS, summary: SUMMARY, notifications: NOTIFICATIONS };
}

function renderSummary() {
    if (SUMMARY_AUTO) Object.assign(SUMMARY, deriveSummary());
    else
        SUMMARY.alert = ROOMS.filter((r) =>
            ["review", "reassign"].includes(r.status)
        ).length;
    const unit = { checkin: "실", checkout: "실", clean: "실", alert: "건" };
    document.querySelectorAll("[data-summary]").forEach((el) => {
        const k = el.dataset.summary;
        el.innerHTML = `${SUMMARY[k]}<small>${unit[k]}</small>`;
    });
}
renderSummary();

/* 우측 패널 다시 그리기 (스크롤 위치 유지) */
function rerenderDetail() {
    const body = $(".detail-body");
    const top = body ? body.scrollTop : 0;
    renderDetail();
    const next = $(".detail-body");
    if (next) next.scrollTop = top;
}

/* 숙박 중인 객실에 담당자와 청소 가능 시간을 모두 정하면 '손님 요청 청소'로 등록돼요 (청소 필요) */
function maybeRegisterClean(r) {
    if (canRequest(r) && r.staff && r.cleanLocked) {
        r.status = "todo";
        r.cleanReq = true;
    }
    renderSummary();
}

/* 서버 데이터를 화면에 반영해요. changed = 바뀐 객실 번호 목록 (없으면 전체 비교) */
function applyLive(changed) {
    const sel = selectedNo && ROOMS.find((x) => x.no === selectedNo);
    if (selectedNo && !sel) {
        closePopover();
        selectedNo = null;
    } /* 사라진 객실이면 선택 해제 */
    renderSummary();
    renderFloors();
    if (selectedNo && (!changed || changed.includes(selectedNo))) {
        if (pop) {
            if (sel.status === "done") {
                closePopover();
                rerenderDetail();
            } /* 청소 완료되면 수정 불가 */ else pendingDetail = true;
        } else rerenderDetail();
    } else if (!selectedNo) renderDetail();
    updateFilterButtons();
    renderBell();
    renderClock();
    lastFetch = Date.now();
}

/* 필터는 선택한 값만 담고 있어서, 새로 생긴 층·상태는 따로 처리하지 않아도 돼요 */
function keepAllFilters(update) {
    update();
}

/* 전체 데이터 교체 (재연결 / 폴링) */
async function refreshData() {
    if (refreshing) return;
    if (pop || fmenu) return; /* 작업 중이면 다음 기회에 */
    refreshing = true;
    try {
        const data = await fetchDashboard();
        keepAllFilters(() => {
            ROOMS.splice(0, ROOMS.length, ...data.rooms);
            SUMMARY = data.summary;
            SUMMARY_AUTO = false;
            setNotifications(data.notifications);
        });
        applyLive(null);
    } catch (err) {
        console.error("데이터 갱신 실패", err);
    } finally {
        refreshing = false;
    }
}

/* 변경된 객실만 합쳐요 (바뀐 필드만 와도 기존 값은 유지) */
function mergeRooms(list) {
    const changed = [];
    [].concat(list).forEach((patch) => {
        const i = ROOMS.findIndex((x) => x.no === patch.no);
        if (i === -1) {
            ROOMS.push(normalizeRoom(patch));
        } else ROOMS[i] = normalizeRoom(Object.assign(ROOMS[i], patch));
        changed.push(patch.no);
    });
    return changed;
}

const LIVE_HANDLERS = {
    snapshot(data) {
        keepAllFilters(() => {
            ROOMS.splice(0, ROOMS.length, ...data.rooms.map(normalizeRoom));
            SUMMARY = data.summary;
            SUMMARY_AUTO = false;
            setNotifications(data.notifications);
        });
        applyLive(null);
    },
    room(data) {
        let changed;
        keepAllFilters(() => {
            changed = mergeRooms(data);
        });
        applyLive(changed);
    },
    summary(data) {
        SUMMARY = data;
        SUMMARY_AUTO = false;
        renderSummary();
        lastFetch = Date.now();
    },
    notification(data) {
        setNotifications(data);
        lastFetch = Date.now();
    },
};

let source = null;
function connectLive() {
    if (!SSE_URL || !window.EventSource) return;
    source = new EventSource(SSE_URL);
    Object.keys(LIVE_HANDLERS).forEach((type) => {
        source.addEventListener(type, (e) => {
            try {
                LIVE_HANDLERS[type](JSON.parse(e.data));
            } catch (err) {
                console.error("실시간 데이터 처리 실패", type, err);
            }
        });
    });
    source.onopen = () => {
        const wasDown = !sseLive;
        sseLive = true;
        if (wasDown) refreshData(); /* 끊겨 있던 동안 놓친 변경 맞추기 */
    };
    source.onerror = () => {
        sseLive = false;
    }; /* 브라우저가 알아서 재연결해요 */
}
connectLive();

setInterval(() => {
    if (sseLive || document.visibilityState !== "visible") return;
    refreshData();
}, POLL_MS);
document.addEventListener("visibilitychange", () => {
    if (
        document.visibilityState === "visible" &&
        !sseLive &&
        Date.now() - lastFetch > STALE_MS
    )
        refreshData();
});
window.addEventListener("online", () => {
    if (!sseLive) refreshData();
});

/* ==========================================================
   헤더 날짜·시간 (기기의 현재 시각 / 형식: 2026년 11월 5일 목요일 · 14:24)
   ========================================================== */
function renderClock() {
    const d = new Date();
    const week = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    $("#headerDate").textContent = `${d.getFullYear()}년 ${d.getMonth() + 1
        }월 ${d.getDate()}일 ${week}요일 · ${pad(d.getHours())}:${pad(
            d.getMinutes()
        )}`;
}
renderClock();
/* 분이 바뀌는 시점에 맞춰 갱신 */
setTimeout(function tick() {
    renderClock();
    setTimeout(tick, 60000 - (Date.now() % 60000));
}, 60000 - (Date.now() % 60000));

/* ==========================================================
   알림 센터 (헤더 종 아이콘)
   - 종 아이콘의 빨간 점 : 확인하지 않은 알림(read: false)이 하나라도 있을 때만 보여요
   - 탭의 빨간 점 : 그 탭에 확인하지 않은 알림이 있을 때만 보여요 ('전체' 탭은 어느 탭이든 하나라도 있으면 보여요)
   - 읽음 처리 : 알림의 버튼을 누르면 그 알림이, 알림 센터를 닫으면 보고 있던 탭의 알림이 모두 읽음이 돼요
   - 서버 연결 : 서버에서 받은 알림 목록으로 setNotifications(list) 를 호출하세요
       알림 1건 = { id, type, title, date, text, actions: [{ label, room? }], read }
       type : exit(퇴실 변경 확인) / issue(특이사항) / reassign(재배정 필요) / todo(청소 필요) / review(검수 요청) / notice(시스템 공지)
       actions 의 room 이 있으면 그 객실을 선택해서 보여줘요 (없으면 읽음 처리만 해요 → 서버 연결 시 처리 동작을 넣으세요)
       actions 의 href 가 있으면 그 주소로 이동해요 (특이사항 '자세히 보기' → thread.html)
       actions 의 result({ room, date: "YYYY-MM-DD" })가 있으면 청소 결과 화면으로 이동해서 그 날짜의 그 객실 상세를 열어요 (검수 요청 알림)
       읽음 상태를 서버에 저장하려면 markRead() 안의 주석 위치에서 요청을 보내세요
   ========================================================== */
const NOTI_TYPES = {
    exit: { tab: "퇴실 변경 확인", icon: "bell-green" },
    issue: { tab: "특이사항", icon: "exclamation-triangle-orange" },
    reassign: { tab: "직원 관리", icon: "user-red" },
    todo: { tab: "청소 현황", icon: "soap-gray" },
    review: { tab: "청소 현황", icon: "check-blue" },
    notice: { tab: "시스템 공지", icon: "notice-purple" },
};
const NOTI_TABS = ["전체", "퇴실 변경 확인", "청소 현황", "직원 관리", "특이사항", "시스템 공지"];
let notiQuery = ""; /* 알림 검색어 (제목 · 내용에서 찾아요) */

const NOTI_TODAY = `${todayMid().getFullYear()}-${pad(
    todayMid().getMonth() + 1
)}-${pad(todayMid().getDate())}`;
/* 알림 날짜: n일 전 HH:MM (서비스를 며칠 써 온 것처럼 최근 일주일 알림을 보여줘요 / 서버 연결 시 서버 값으로 교체) */
const notiDate = (ago, t) => {
    const d = dayAdd(todayMid(), -ago);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${t}`;
};
const notiResult = (room, ago = 0) => ({
    label: "결과 검수",
    result: {
        room,
        date: ago ? staffDateKey(dayAdd(todayMid(), -ago)) : NOTI_TODAY,
    },
});
/* 위쪽 5건(오늘 · 사용성 테스트 고정): 107호 특이사항 · 105호 특이사항 · 108호 재배정 필요 · 105호 / 107호 검수 요청 */
let NOTIFICATIONS = [
    {
        id: 99,
        type: "exit",
        title: "이서영 · 퇴실 변경 확인",
        date: notiDate(0, "11:41"),
        text: "201호 퇴실 시간 변경 알림을 확인했어요.\n오전 11시 → 낮 12시",
        actions: [],
        read: false,
    },
    {
        id: 11,
        type: "issue",
        title: "유가은 · 특이사항 등록",
        date: notiDate(0, addMinutes(cleanDoneAt("107"), -5)),
        text: "욕실 환풍기 스위치를 켜도 작동하지 않아요.\n물기가 잘 마르지 않으니 시설 점검 부탁드립니다.",
        actions: [
            { label: "자세히 보기", href: "thread.html" },
            { label: "직접 처리하기" },
        ],
        read: false,
    },
    {
        id: 6,
        type: "review",
        title: "107호 · 검수 요청",
        date: notiDate(0, cleanDoneAt("107")),
        text: "107호 청소가 끝났어요.\n검수가 필요해요.",
        actions: [notiResult("107")],
        read: false,
    },
    {
        id: 12,
        type: "issue",
        title: "이서영 · 특이사항 등록",
        date: notiDate(0, addMinutes(cleanDoneAt("105"), -5)),
        text: "현관 천장등이 계속 깜빡여요.\n전등 교체 부탁드립니다.",
        actions: [
            { label: "자세히 보기", href: "thread.html" },
            { label: "직접 처리하기" },
        ],
        read: false,
    },
    {
        id: 4,
        type: "review",
        title: "105호 · 검수 요청",
        date: notiDate(0, cleanDoneAt("105")),
        text: "105호 청소가 끝났어요.\n검수가 필요해요.",
        actions: [notiResult("105")],
        read: false,
    },
    {
        id: 2,
        type: "reassign",
        title: "108호 · 재배정 필요",
        date: notiDate(0, "13:20"),
        text: "청소 담당자가 조퇴했어요.\n담당자 재배정이 필요해요.",
        actions: [{ label: "현황 확인", room: "108" }],
        read: true,
    },
    {
        id: 3,
        type: "todo",
        title: "104호 · 청소 필요",
        date: notiDate(0, "11:41"),
        text: "청소가 아직 시작되지 않았어요.\n예정 시간보다 1시간 지났어요.",
        actions: [{ label: "현황 확인", room: "104" }],
        read: true,
    },
    /* 어제 */
    {
        id: 13,
        type: "issue",
        title: "이서영 · 특이사항 등록",
        date: notiDate(1, "17:03"),
        text: "에어컨을 켜면 표시등이 깜빡이고 곧 멈춰요. 시설 점검 부탁드립니다.",
        actions: [
            { label: "자세히 보기", href: "thread.html" },
            { label: "직접 처리하기" },
        ],
        read: true,
    },
    {
        id: 14,
        type: "review",
        title: "202호 · 검수 요청",
        date: notiDate(1, "16:15"),
        text: "202호 청소가 끝났어요.\n검수가 필요해요.",
        actions: [notiResult("202", 1)],
        read: true,
    },
    {
        id: 15,
        type: "todo",
        title: "201호 · 청소 필요",
        date: notiDate(1, "12:10"),
        text: "청소가 아직 시작되지 않았어요.\n예정 시간보다 30분 지났어요.",
        actions: [{ label: "현황 확인", room: "201" }],
        read: true,
    },
    {
        id: 16,
        type: "reassign",
        title: "203호 · 재배정 필요",
        date: notiDate(1, "09:05"),
        text: "담당자의 휴무 일정이 변경됐어요.\n담당자 재배정이 필요해요.",
        actions: [{ label: "현황 확인", room: "203" }],
        read: true,
    },
    /* 2~3일 전 */
    {
        id: 17,
        type: "issue",
        title: "한다경 · 특이사항 등록",
        date: notiDate(2, "15:42"),
        text: "침대 왼쪽 콘센트에 꽂으면 전원이 들어오지 않아요.\n콘센트 점검 부탁드립니다.",
        actions: [
            { label: "자세히 보기", href: "thread.html" },
            { label: "직접 처리하기" },
        ],
        read: true,
    },
    {
        id: 18,
        type: "review",
        title: "303호 · 검수 요청",
        date: notiDate(2, "14:30"),
        text: "303호 청소가 끝났어요.\n검수가 필요해요.",
        actions: [notiResult("303", 2)],
        read: true,
    },
    {
        id: 19,
        type: "reassign",
        title: "106호 · 재배정 필요",
        date: notiDate(3, "10:12"),
        text: "청소 담당자가 조퇴했어요.\n담당자 재배정이 필요해요.",
        actions: [{ label: "현황 확인", room: "106" }],
        read: true,
    },
    {
        id: 20,
        type: "todo",
        title: "301호 · 청소 필요",
        date: notiDate(3, "13:40"),
        text: "청소가 아직 시작되지 않았어요.\n예정 시간보다 1시간 지났어요.",
        actions: [{ label: "현황 확인", room: "301" }],
        read: true,
    },
    {
        id: 21,
        type: "notice",
        title: "시스템 공지",
        date: notiDate(3, "09:00"),
        text: "[업데이트 안내] 직원 배정 화면에서 직원을 끌어다 객실에 배정할 수 있어요. 변경 사항은 일괄 저장 후 직원에게 반영됩니다.",
        actions: [],
        read: true,
    },
    /* 4일 전 이전 */
    {
        id: 22,
        type: "issue",
        title: "최하석 · 특이사항 등록",
        date: notiDate(4, "16:47"),
        text: "빗 파손이요.\n교체 부탁드립니다.",
        actions: [
            { label: "자세히 보기", href: "thread.html" },
            { label: "직접 처리하기" },
        ],
        read: true,
    },
    {
        id: 23,
        type: "review",
        title: "204호 · 검수 요청",
        date: notiDate(4, "15:20"),
        text: "204호 청소가 끝났어요.\n검수가 필요해요.",
        actions: [notiResult("204", 4)],
        read: true,
    },
    {
        id: 5,
        type: "notice",
        title: "시스템 공지",
        date: notiDate(5, "11:41"),
        text: "[서비스 정기 점검 안내] 안정적인 서비스 제공을 위해 정기 점검이 예정되어 있습니다. 점검 시간 동안 일부 기능 이용이 제한될 수 있습니다.",
        actions: [],
        read: true,
    },
    {
        id: 24,
        type: "reassign",
        title: "104호 · 재배정 필요",
        date: notiDate(6, "09:30"),
        text: "청소 담당자가 조퇴했어요.\n담당자 재배정이 필요해요.",
        actions: [{ label: "현황 확인", room: "104" }],
        read: true,
    },
    {
        id: 25,
        type: "todo",
        title: "102호 · 청소 필요",
        date: notiDate(6, "12:25"),
        text: "청소가 아직 시작되지 않았어요.\n예정 시간보다 30분 지났어요.",
        actions: [{ label: "현황 확인", room: "102" }],
        read: true,
    },
];

const readIds =
    new Set(); /* 이 화면에서 읽은 알림 (서버 목록으로 교체돼도 읽음 상태를 유지) */
let notiTab = "전체";
let notiOpen = false;
const esc = (v) =>
    String(v).replace(
        /[&<>"']/g,
        (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
            c
        ])
    );
const inTab = (n, tab) =>
    tab === "전체" || (NOTI_TYPES[n.type] || {}).tab === tab;
const notiMatch = (n) => {
    const q = notiQuery.trim().toLowerCase();
    return !q || `${n.title} ${n.text}`.toLowerCase().includes(q);
};

function renderBell() {
    const unread = NOTIFICATIONS.filter((n) => !n.read).length;
    const btn = $("#bellBtn");
    btn.classList.toggle("has-dot", unread > 0);
    btn.setAttribute(
        "aria-label",
        unread > 0 ? `알림 (확인하지 않은 알림 ${unread}건)` : "알림"
    );
}

function notiItem(n) {
    const t = NOTI_TYPES[n.type] || NOTI_TYPES.notice;
    const actions = (n.actions || [])
        .map(
            (a, i) =>
                `<button class="noti-btn" type="button" data-noti="${esc(
                    n.id
                )}" data-i="${i}">${esc(a.label)}</button>`
        )
        .join("");
    return `
  <article class="noti-item${n.read ? " is-read" : ""}" data-noti-id="${esc(n.id)}">
        <div class="noti-icon is-${esc(n.type)}">${icon(t.icon, 24)}</div>
        <div class="noti-body">
          <div class="noti-text">
            <div class="noti-row"><span class="noti-item-title">${esc(
        n.title
    )}</span><span class="noti-date">${esc(n.date)}</span></div>
            <p class="noti-msg">${esc(n.text)}</p>
          </div>
          ${actions ? `<div class="noti-actions">${actions}</div>` : ""}
        </div>
      </article>`;
}

function renderNoti() {
    if (!notiOpen) return;
    $("#notiTabs").innerHTML = NOTI_TABS.map((tab) => {
        const dot = NOTIFICATIONS.some((n) => !n.read && inTab(n, tab));
        return `<button class="noti-tab${tab === notiTab ? " is-active" : ""}${dot ? " has-dot" : ""
            }" type="button" role="tab" aria-selected="${tab === notiTab
            }" data-tab="${tab}">${tab}</button>`;
    }).join("");
    const list = $("#notiList");
    const top = list.scrollTop;
    const items = NOTIFICATIONS.filter((n) => inTab(n, notiTab) && notiMatch(n));
    list.innerHTML = items.length
        ? items.map(notiItem).join("")
        : `<p class="noti-empty">${notiQuery.trim() ? "검색 결과가 없어요." : "알림이 없어요."}</p>`;
    list.scrollTop = top;

    // 알림 센터 탭 마우스 드래그 코드추가
    const tabs = document.querySelector("#notiTabs");
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    let dragMoved = false;

    tabs.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        isDragging = true;
        dragMoved = false;
        startX = e.clientX;
        startScrollLeft = tabs.scrollLeft;
        tabs.classList.add("is-dragging");
    });

    tabs.addEventListener("pointermove", (e) => {
        if (!isDragging) return;

        const distance = e.clientX - startX;
        if (Math.abs(distance) > 5) {
            dragMoved = true;
            tabs.setPointerCapture(e.pointerId);
        }

        if (dragMoved) {
            tabs.scrollLeft = startScrollLeft - distance;
        }
    });

    const stopDragging = () => {
        isDragging = false;
        tabs.classList.remove("is-dragging");
    };

    tabs.addEventListener("pointerup", stopDragging);
    tabs.addEventListener("pointercancel", stopDragging);

    // 드래그 후 탭이 잘못 클릭되지 않도록 처리함
    tabs.addEventListener(
        "click",
        (e) => {
            if (dragMoved) {
                e.preventDefault();
                e.stopPropagation();
                dragMoved = false;
            }
        },
        true
    );
}

function setNotifications(list) {
    NOTIFICATIONS = list.map((n) =>
        Object.assign({}, n, { read: n.read || readIds.has(n.id) })
    );
    renderBell();
    renderNoti();
}
function markRead(ids) {
    ids.forEach((id) => readIds.add(id));
    NOTIFICATIONS.forEach((n) => {
        if (readIds.has(n.id)) n.read = true;
    });
    /* ★ 서버 연결 지점: 여기서 읽음 상태를 서버에 저장하세요  예) fetch("/api/notifications/read", { method: "POST", body: JSON.stringify({ ids }) }) */
    renderBell();
    renderNoti();
}
function markAllRead() {
    markRead(NOTIFICATIONS.map((n) => n.id));
}

/* 알림 센터 위치: 알림 버튼(종) 맨 아래에서 4px 아래,
   알림 버튼의 맨 오른쪽 선에 알림 센터의 오른쪽 끝을 맞춰요 */
function placeNoti() {
    const r = $("#bellBtn").getBoundingClientRect();
    const panel = $("#notiPanel");
    panel.style.setProperty("--noti-top", r.bottom + 4 + "px");
    /* 세로 스크롤바가 있으면 그 폭만큼 화면이 좁아지므로, 스크롤바를 뺀 폭(clientWidth)으로 계산해요 */
    panel.style.setProperty(
        "--noti-right",
        document.documentElement.clientWidth - r.right + "px"
    );
}
window.addEventListener("resize", () => {
    if (notiOpen) placeNoti();
});

/* 알림 검색: 입력할 때마다 목록만 다시 그려요 (탭은 그대로) */
$("#notiSearch").addEventListener("input", (e) => {
    notiQuery = e.target.value;
    const list = $("#notiList");
    const items = NOTIFICATIONS.filter((n) => inTab(n, notiTab) && notiMatch(n));
    list.innerHTML = items.length
        ? items.map(notiItem).join("")
        : `<p class="noti-empty">${notiQuery.trim() ? "검색 결과가 없어요." : "알림이 없어요."}</p>`;
    list.scrollTop = 0;
});

function openNoti() {
    closeFilterMenu();
    closePopover();
    notiOpen = true;
    placeNoti();
    $("#notiPanel").hidden = false;
    $("#bellBtn").setAttribute("aria-expanded", "true");
    renderNoti();
}
function closeNoti() {
    if (!notiOpen) return;
    const seen = NOTIFICATIONS.filter((n) => inTab(n, notiTab)).map((n) => n.id);
    notiOpen = false;
    notiQuery = "";
    $("#notiSearch").value = "";
    $("#notiPanel").hidden = true;
    $("#bellBtn").setAttribute("aria-expanded", "false");
    markRead(seen);
    notiTab = "전체";
}

/* 알림의 '현황 확인' 같은 버튼: 해당 객실을 선택해서 보여줘요 */
function showRoom(no) {
    const room = ROOMS.find((x) => x.no === no);
    if (!room) return;
    selectRoom(no);
    if (!$(`.room-card[data-room="${no}"]`)) {
        /* 검색·필터에 가려져 있으면 풀어서 보여줘요 */
        query = "";
        $("#roomSearch").value = "";
        if (!inTodayList(room)) setTodayOnly(false);
        Object.keys(FILTER_DEFS).forEach((k) => filters[k].clear());
        updateFilterButtons();
        renderFloors();
    }
    const card = $(`.room-card[data-room="${no}"]`);
    if (card) card.scrollIntoView({ block: "center", behavior: "smooth" });
}

/* 다른 화면으로 이동 (직원 배정 화면처럼 저장 안 한 변경사항이 있으면 beforeLeave 가 경고 모달을 띄우고 false 를 돌려줘요) */
function navigateTo(url) {
    if (typeof beforeLeave === "function" && beforeLeave(url) === false) return;
    location.href = url;
}

/* 청소 결과 화면으로 이동해서 해당 날짜의 객실 상세까지 열어요 (이미 결과 화면이면 이동 없이 바로 열어요) */
function goResult({ room, date }) {
    if (typeof openResultFor === "function") openResultFor(room, date);
    else
        navigateTo(
            `result.html?room=${encodeURIComponent(room)}&date=${encodeURIComponent(
                date
            )}`
        );
}

document.addEventListener("click", (e) => {
    const bell = e.target.closest("#bellBtn");
    if (bell) {
        notiOpen ? closeNoti() : openNoti();
        return;
    }
    if (!notiOpen) return;
    if (e.target.closest("[data-noti-close]")) {
        closeNoti();
        return;
    }
    /* 일림센터 dot아이콘 */
    const tab = e.target.closest(".noti-tab[data-tab]");
    if (tab) {
        notiTab = tab.dataset.tab;
        const seen = NOTIFICATIONS.filter((n) => inTab(n, notiTab)).map(
            (n) => n.id
        );
        markRead(seen);
        return;
    }
    const btn = e.target.closest(".noti-btn[data-noti]");
    if (btn) {
        const n = NOTIFICATIONS.find((x) => String(x.id) === btn.dataset.noti);
        const act = n && n.actions[+btn.dataset.i];
        if (!n) return;
        markRead([n.id]);
        if (act && act.href) {
            closeNoti();
            navigateTo(act.href);
        } else if (act && act.result) {
            closeNoti();
            goResult(act.result);
        } else if (act && act.room) {
            closeNoti();
            /* 청소 결과 화면에서 누르면 실시간 현황 화면으로 이동해서 그 객실을 보여줘요 */
            if (
                typeof openResultFor === "function" ||
                typeof renderAssignRooms === "function"
            )
                navigateTo(`index.html?room=${encodeURIComponent(act.room)}`);
            else showRoom(act.room);
        }
        return;
    }
    if (!e.composedPath().includes($("#notiPanel"))) closeNoti();
});
document.addEventListener(
    "keydown",
    (e) => {
        if (e.key === "Escape" && notiOpen) {
            e.stopImmediatePropagation();
            closeNoti();
            $("#bellBtn").focus();
        }
    },
    true
);
renderBell();

/* 사이드바 '조치 필요 목록' 숫자 배지: 처리 대기 중인 특이사항 수 (0이면 숨겨요)
   thread.js 가 처리 상태를 저장할 때마다 localStorage("threadWait") 에 개수를 적어 두고, 다른 화면은 그 값을 읽어요
   서버 연결 시: 서버에서 받은 처리 대기 건수로 renderNavBadge(count) 를 호출하세요 */
const NAV_WAIT_DEFAULT = 16; /* 아직 특이사항 화면을 열지 않았을 때 보여줄 처음 건수 */
function renderNavBadge(count) {
    if (count == null) {
        let v = null;
        try {
            v = localStorage.getItem("threadWait");
        } catch (e) { }
        count = v == null ? NAV_WAIT_DEFAULT : Number(v) || 0;
    }
    document.querySelectorAll('.nav-item[href="thread.html"]').forEach((a) => {
        let b = a.querySelector(".nav-badge");
        if (!count) return b && b.remove();
        if (!b) {
            b = document.createElement("span");
            b.className = "nav-badge";
            a.appendChild(b);
        }
        b.textContent = count;
        b.setAttribute("aria-label", `처리 대기 ${count}건`);
    });
}
renderNavBadge();

/* ==========================================================
   화면 모드 (해 아이콘 → 다크 모드(달 아이콘) / 다시 누르면 라이트 모드)
   - <html data-theme="dark"> 로 전환해요 (색은 style.css 의 토큰이 바뀌어요)
   - 선택한 모드는 이 브라우저에 저장돼서 새로고침해도 유지돼요 (저장이 막힌 환경에서는 저장 없이 동작)
   ========================================================== */
/* 해/달 아이콘을 미리 받아 둬요: 처음 전환할 때 달(moon.svg)을 그제야 내려받느라 아이콘만 늦게 바뀌던 문제 방지 */
["sun", "moon"].forEach((n) => {
    const im = new Image();
    im.src = ICON(n);
    if (im.decode) im.decode().catch(() => { });
});

function applyTheme(mode) {
    const dark = mode === "dark";
    if (dark) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    const btn = $("#themeBtn");
    btn.setAttribute("aria-pressed", String(dark));
    btn.setAttribute(
        "aria-label",
        dark ? "라이트 모드로 변경" : "다크 모드로 변경"
    );
    $("#themeIcon").src = ICON(dark ? "moon" : "sun"); /* 라이트: 해 / 다크: 달 */
    try {
        localStorage.setItem("theme", dark ? "dark" : "light");
    } catch (e) { }
}
$("#themeBtn").addEventListener("click", () => {
    applyTheme(
        document.documentElement.getAttribute("data-theme") === "dark"
            ? "light"
            : "dark"
    );
});
applyTheme(
    document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light"
);

/* ==========================================================
   운영 시간대 설정 모달
   - 사이드바 하단 '운영 시간대 설정' 클릭 → 열기 / 닫기·X·바깥 클릭·Esc → 닫기
   - 평일/주말 탭은 입·퇴실 시간만 따로 갖고, 나머지 설정은 공통이에요
   - 저장하면 HOURS 에 반영하고 localStorage 에 보관해요 (서버 연결 시 saveHours() 안에서 전송)
   ========================================================== */
const hm = $("#hoursModal");
let hmTab = "weekday";
let hmTrigger = null;
const hoursOpen = () => !hm.hidden;

/* 입·퇴실 시간은 오전/오후 · 시 · 분 목록에서 골라요 (고른 값은 숨겨진 #hmIn / #hmOut 에 "HH:MM" 으로 들어가요) */
$("#hmInTp").innerHTML = timePickerHtml("hmIn", HOURS.weekday.in);
$("#hmOutTp").innerHTML = timePickerHtml("hmOut", HOURS.weekday.out);
initTimePicker(hm);

/* 탭을 바꾸기 전에 현재 탭의 입·퇴실 시간을 임시 보관해요 */
const hmDraft = JSON.parse(JSON.stringify(HOURS));

function hmShowTab(tab) {
    hmTab = tab;
    hm.querySelectorAll("[data-hm-tab]").forEach((b) =>
        b.setAttribute("aria-selected", String(b.dataset.hmTab === tab))
    );
    $("#tp-hmIn")._set(hmDraft[tab].in);
    $("#tp-hmOut")._set(hmDraft[tab].out);
    hm.querySelectorAll(".is-error").forEach((el) =>
        el.classList.remove("is-error")
    );
}

/* 현재 탭 입력값을 임시 보관 (형식이 올바를 때만) */
function hmKeepTab() {
    const i = normTime($("#hmIn").value),
        o = normTime($("#hmOut").value);
    if (i) hmDraft[hmTab].in = i;
    if (o) hmDraft[hmTab].out = o;
}

function openHours(trigger) {
    hmTrigger = trigger || null;
    Object.assign(hmDraft, JSON.parse(JSON.stringify(HOURS)));
    hmShowTab(
        [0, 6].includes(new Date().getDay()) ? "weekend" : "weekday"
    ); /* 오늘 요일에 맞는 칩부터 열려요 */
    $("#hmCleanOut").value = HOURS.cleanOut;
    $("#hmCleanIn").value = HOURS.cleanIn;
    $("#hmExtend").value = HOURS.extend;
    $("#hmDayUse").value = HOURS.dayUse;
    hm.hidden = false;
    setTimeout(
        () => $("#tp-hmIn .tp-field").focus(),
        50
    ); /* 나타나는 전환이 시작된 뒤에 포커스 */
}

function closeHours() {
    hm.hidden = true;
    if (hmTrigger) hmTrigger.focus();
}

/* 저장: 시간 형식(HH:MM)과 숫자 칸을 확인하고, 틀린 칸은 빨간 테두리로 알려줘요 */
function saveHours() {
    hmKeepTab();
    const i = normTime($("#hmIn").value),
        o = normTime($("#hmOut").value);
    $("#hmIn").classList.toggle("is-error", !i);
    $("#hmOut").classList.toggle("is-error", !o);
    const nums = ["hmCleanOut", "hmCleanIn", "hmExtend", "hmDayUse"].map((id) => {
        const el = $("#" + id);
        const ok = el.value !== "";
        el.classList.toggle("is-error", !ok);
        return ok;
    });
    if (!i || !o)
        return (i ? $("#tp-hmOut .tp-field") : $("#tp-hmIn .tp-field")).focus();
    const bad = nums.indexOf(false);
    if (bad > -1)
        return $(
            "#" + ["hmCleanOut", "hmCleanIn", "hmExtend", "hmDayUse"][bad]
        ).focus();
    HOURS = {
        weekday: { ...hmDraft.weekday },
        weekend: { ...hmDraft.weekend },
        cleanOut: String(+$("#hmCleanOut").value),
        cleanIn: String(+$("#hmCleanIn").value),
        extend: String(+$("#hmExtend").value),
        dayUse: String(+$("#hmDayUse").value),
    };
    try {
        localStorage.setItem("hours", JSON.stringify(HOURS));
    } catch (e) { }
    /* TODO: 서버 연결 시 여기서 HOURS 를 전송 */
    applyHours(); /* 모든 객실 타일·우측 패널에 새 기본 규칙 적용 */
    renderFloors();
    renderDetail();
    closeHours();
}

$("#hoursBtn").addEventListener("click", (e) => {
    e.preventDefault();
    openHours(e.currentTarget);
});
hm.addEventListener("click", (e) => {
    if (e.target === hm || e.target.closest("[data-hm-close]"))
        return closeHours();
    const tab = e.target.closest("[data-hm-tab]");
    if (tab && tab.dataset.hmTab !== hmTab) {
        hmKeepTab();
        hmShowTab(tab.dataset.hmTab);
    }
});
$("#hmSave").addEventListener("click", saveHours);

/* 숫자 칸 (청소 가능 시간 ~ 대실 최대 시간): 키보드로 입력하되 숫자만 들어가요
   - 글자 키는 입력 단계에서 막고, 붙여넣기 · 한글 입력기(IME)로 들어온 글자도 바로 지워요 */
function onlyDigits(el) {
    const clean = () => {
        const v = el.value.replace(/\D/g, "");
        if (v !== el.value) el.value = v;
        el.classList.remove("is-error");
    };
    el.addEventListener("beforeinput", (e) => {
        if (e.inputType.startsWith("insert") && e.data != null && /\D/.test(e.data))
            e.preventDefault();
    });
    el.addEventListener("paste", (e) => {
        e.preventDefault();
        const max = el.maxLength > 0 ? el.maxLength : 99;
        const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "");
        el.setRangeText(t, el.selectionStart, el.selectionEnd, "end");
        el.value = el.value.slice(0, max);
        clean();
    });
    el.addEventListener("input", clean);
    el.addEventListener("compositionend", clean);
}
["#hmCleanOut", "#hmCleanIn", "#hmExtend", "#hmDayUse"].forEach((sel) =>
    onlyDigits($(sel))
);
hm.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("input")) saveHours();
    /* 모달 밖으로 포커스가 빠져나가지 않게 Tab 을 가둬요 */
    if (e.key === "Tab") {
        const f = [...hm.querySelectorAll("button, input")].filter(
            (x) => !x.disabled && x.type !== "hidden" && x.tabIndex >= 0
        );
        const first = f[0],
            last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }
});

/* 다른 화면(청소 결과)의 알림에서 넘어오면 그 객실을 바로 선택해서 보여줘요 (?room=201) */
(function () {
    if (!$("#roomSearch")) return;
    const room = new URLSearchParams(location.search).get("room");
    if (room) showRoom(room);
})();

/* ==========================================================
   스크롤 중 잘리는 카드의 모서리 (코너 radius 유지)
   카드가 헤더 · 고정 툴바 · 스크롤 영역 가장자리에 걸쳐 잘릴 때, 잘리는 선에서도
   카드 본래의 radius 로 둥글게 잘려 보이도록 clip-path 를 걸어요.
   (잘리지 않는 카드는 clip-path 를 비워 둬요)
   테두리 선이 있는 카드(객실 카드 등)는 흰 영역 아래로 곧게 들어가는 게 자연스러워서, 배경색이 있는 카드만 걸어요.
   ========================================================== */
const _edge = (sel, side) => {
    const el = document.querySelector(sel);
    return el ? el.getBoundingClientRect()[side] : null;
};
const SOFT_CLIPS = [
    { sel: ".summary-card", top: () => _edge(".header-wrap", "bottom") },
    { sel: ".rl-card", top: () => _edge(".header-wrap", "bottom") },
];

function softClip() {
    SOFT_CLIPS.forEach((c) => {
        const line = c.top ? c.top() : null;
        document.querySelectorAll(c.sel).forEach((el) => {
            const r = el.getBoundingClientRect();
            let top = line,
                bottom = null;
            if (c.box) {
                const box = el.closest(c.box);
                if (box) {
                    const b = box.getBoundingClientRect();
                    top = b.top;
                    bottom = b.bottom;
                }
            }
            const cutT = top != null ? top - r.top : 0;
            const cutB = bottom != null ? r.bottom - bottom : 0;
            if ((cutT <= 0 && cutB <= 0) || cutT + cutB >= r.height) {
                if (el.style.clipPath) el.style.clipPath = "";
                return;
            }
            const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
            const rt = cutT > 0 ? rad : 0;
            const rb = cutB > 0 ? rad : 0;
            el.style.clipPath = `inset(${Math.max(cutT, 0)}px 0 ${Math.max(
                cutB,
                0
            )}px 0 round ${rt}px ${rt}px ${rb}px ${rb}px)`;
        });
    });
}
let _softQueued = false;
const softClipSoon = () => {
    if (_softQueued) return;
    _softQueued = true;
    requestAnimationFrame(() => {
        _softQueued = false;
        softClip();
    });
};
document.addEventListener("scroll", softClipSoon, {
    capture: true,
    passive: true,
});
window.addEventListener("resize", softClipSoon);
new MutationObserver(softClipSoon).observe(document.body, {
    childList: true,
    subtree: true,
});
softClipSoon();

/* 날짜가 바뀌면 (자정이 지나거나, 며칠 만에 탭으로 돌아오면) 객실 카드의 일정을 새 오늘 기준으로 다시 계산해요 */
let _dayKey = todayMid().getTime();
function refreshToday() {
    const now = todayMid().getTime();
    if (now === _dayKey) return;
    _dayKey = now;
    const base = todayMid();
    ROOMS.forEach((r) => {
        if (r.empty) return;
        setStay(r, base);
        syncStayStatus(r);
    });
    applyHours();
    if ($("#roomSearch")) {
        renderSummary();
        renderFloors();
        renderDetail();
    }
}
setInterval(refreshToday, 60 * 1000);
document.addEventListener(
    "visibilitychange",
    () => !document.hidden && refreshToday()
);

/* =========================================================
   준비중 모달 + 모달이 열려 있는 동안 뒤쪽 화면 스크롤 막기
   - 아직 연결되지 않은 기능은 버튼에 data-soon 만 달면 돼요 (openSoon() 으로 직접 열 수도 있어요)
   ========================================================= */
const soonModal = document.createElement("div");
soonModal.className = "hm";
soonModal.id = "soonModal";
soonModal.hidden = true;
soonModal.innerHTML = `
  <div class="hm-box rs-cm" role="alertdialog" aria-modal="true" aria-label="준비 중입니다.">
    <div class="rs-cm-body is-soon">
      <span class="rs-cm-ic is-neutral"><img src="${ICON(
    "hourglass"
)}" alt="" /></span>
      <div class="rs-cm-tx"><strong>준비 중입니다.</strong><span>더 나은 서비스를 제공하기 위해 준비 중입니다.<br />빠른 시일 내에 찾아뵙겠습니다.</span></div>
    </div>
    <div class="rs-cm-btns"><button class="btn btn-lg btn-primary" type="button" data-soon-close>확인</button></div>
  </div>`;
document.body.appendChild(soonModal);

function openSoon() {
    soonModal.hidden = false;
    soonModal.querySelector(".btn-primary").focus();
}
const closeSoon = () => (soonModal.hidden = true);
soonModal.addEventListener("click", (e) => {
    if (e.target === soonModal || e.target.closest("[data-soon-close]"))
        closeSoon();
});
document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-soon]");
    if (!b) return;
    e.preventDefault();
    openSoon();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !soonModal.hidden) closeSoon();
});

/* 딤이 깔린 모달(.hm)이 하나라도 열려 있으면 페이지 스크롤을 막아요 (모달 안쪽만 스크롤) */
function syncScrollLock() {
    const open = [...document.querySelectorAll(".hm")].some((m) => !m.hidden);
    document.documentElement.classList.toggle("is-modal-open", open);
}
new MutationObserver(syncScrollLock).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["hidden"],
});
syncScrollLock();

/* 세로 스크롤바는 스크롤하는 동안만 잠깐 보여요 (멈추고 1.5초 뒤에 사라져요 / CSS 의 .is-scrolling 참고) */
const scrollTimers = new WeakMap();
document.addEventListener(
    "scroll",
    (e) => {
        /* 페이지 전체 스크롤은 html 과 body 둘 다 (브라우저가 어느 쪽 스타일을 쓰든 보이게) */
        const els =
            e.target === document
                ? [document.documentElement, document.body]
                : [e.target];
        els.forEach((el) => {
            if (!el || !el.classList) return;
            el.classList.add("is-scrolling");
            clearTimeout(scrollTimers.get(el));
            scrollTimers.set(
                el,
                setTimeout(() => el.classList.remove("is-scrolling"), 1500)
            );
        });
    },
    true
);

/* 가로로 넘치는 영역(보드 · 표 · 첨부 사진 · 상세 사진)은 마우스로 끌어서도 옮겨요 (알림 탭은 위에서 따로 처리) */
const DRAG_X_SEL = ".th-board, .ui-table, .attach-list, .td-imgs.is-lg";
let dragX = null;
document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const box = e.target.closest(DRAG_X_SEL);
    if (!box || box.scrollWidth <= box.clientWidth) return;
    if (e.target.closest("button, a, input, select, textarea, label, [draggable=true], [contenteditable]")) return;
    dragX = { box, x: e.clientX, left: box.scrollLeft, moved: false, id: e.pointerId };
});
document.addEventListener("pointermove", (e) => {
    if (!dragX) return;
    const dx = e.clientX - dragX.x;
    if (!dragX.moved && Math.abs(dx) > 5) {
        dragX.moved = true;
        dragX.box.classList.add("is-drag-scrolling");
        try { dragX.box.setPointerCapture(dragX.id); } catch (_) { }
    }
    dragX.dx = dx;
    if (dragX.moved) {
        /* 칸 단위로 넘기는 영역(보드)은 직접 움직임을 맡아요 */
        if (dragX.box.dataset.snapDrag) dragX.box.dispatchEvent(new CustomEvent("dragx-move", { detail: { dx, left: dragX.left } }));
        else dragX.box.scrollLeft = dragX.left - dx;
    }
});
const stopDragX = () => {
    if (!dragX) return;
    dragX.box.classList.remove("is-drag-scrolling");
    const moved = dragX.moved;
    /* 끝난 뒤 칸 단위로 맞추고 싶은 영역(보드)이 받아 가요 */
    if (moved) dragX.box.dispatchEvent(new CustomEvent("dragx-end", { detail: { dx: dragX.dx, left: dragX.left } }));
    dragX = null;
    /* 끌고 난 직후에 생기는 클릭(카드 열기 등)은 막아요 */
    if (moved) {
        const block = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
        document.addEventListener("click", block, { capture: true, once: true });
        setTimeout(() => document.removeEventListener("click", block, true), 0);
    }
};
/* 사진을 잡고 끌 때 브라우저의 사진 끌어오기가 먼저 동작하지 않게 막아요 */
document.addEventListener("dragstart", (e) => {
    if (e.target.closest && e.target.closest(DRAG_X_SEL) && e.target.tagName === "IMG") e.preventDefault();
});
document.addEventListener("pointerup", stopDragX);
document.addEventListener("pointercancel", stopDragX);