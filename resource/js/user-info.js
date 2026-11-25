/* ==========================================================
   직원 정보 설정 (user-info.html / index.js 뒤에 불러와요)
   - 왼쪽: 이번 주 근무 일정 (직원 목록 / 이름 검색 / 현재 근무 상태 필터 / 주 이동)
   - 오른쪽: 직원 정보 수정 패널 (숙련도 · 청소 검수 대상 · 주간 근무 일정)
       · 직원을 고르기 전 / 패널을 닫았을 때는 안내 화면이 떠요
       · 취소 = 수정 내용을 버리고 패널 닫기 / 저장 = 목록에 반영
   - 데이터는 지금은 샘플 / 서버 연결 시 SI_STAFF · SI_SHIFTS 만 서버 값으로 바꾸면 돼요
   ========================================================== */
const SI_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

/* 근무 형태 = '근무 시간대 설정' 모달에서 정한 목록 (이름 · 시작 ~ 끝) / 저장한 값이 없으면 아래 기본 3개
   - SI_SHIFTS: { 아이디: { label, time } } / SI_SHIFT_ORDER: '근무 형태 변경'을 누를 때 도는 순서 (null = 휴무)
   - 서버 연결 시 WS_DEFAULT 와 localStorage('workShifts') 를 서버 값으로 바꾸면 돼요 */
const WS_KEY = "workShifts";
const WS_DEFAULT = [
    { id: "day", name: "오전", start: "08:00", end: "13:00" },
    { id: "aft", name: "오후", start: "13:00", end: "22:00" },
    { id: "night", name: "야간", start: "22:00", end: "07:00" },
];
const SI_SHIFTS = {};
const SI_SHIFT_ORDER = [];
function wsLoad() {
    try {
        const v = JSON.parse(localStorage.getItem(WS_KEY));
        if (Array.isArray(v) && v.length) return v;
    } catch (e) { }
    return JSON.parse(JSON.stringify(WS_DEFAULT));
}
function wsApply(list) {
    Object.keys(SI_SHIFTS).forEach((k) => delete SI_SHIFTS[k]);
    SI_SHIFT_ORDER.length = 0;
    list.forEach((w) => {
        SI_SHIFTS[w.id] = { label: w.name, time: `${w.start}~${w.end}` };
        SI_SHIFT_ORDER.push(w.id);
    });
    SI_SHIFT_ORDER.push(null);
}
wsApply(wsLoad());

/* 현재 근무 상태 (목록의 이름 옆 배지 / 필터) */
const SI_WSTATE = { work: "근무 중", off: "휴무", early: "조퇴", resigned: "퇴사" };
const SI_LEVELS = ["상", "중", "하"];

/* pattern: 일 ~ 토 요일별 근무 형태 (null = 쉬는 날) / over: 날짜별로 따로 고친 값 */
const SI_STAFF = [
    {
        id: 1,
        name: "최하석",
        phone: "010-1234-5678",
        account: "active",
        level: "하",
        review: true,
    },
    {
        id: 2,
        name: "유가은",
        phone: "010-2345-6789",
        account: "active",
        level: "상",
        review: false,
    },
    {
        id: 3,
        name: "이서영",
        phone: "010-4567-8901",
        account: "active",
        level: "상",
        review: false,
    },
    {
        id: 4,
        name: "한다경",
        phone: "010-4567-8901",
        account: "active",
        level: "중",
        review: true,
    },
    {
        id: 5,
        name: "송혜원",
        phone: "010-5678-9012",
        account: "invited",
        level: null,
        review: false,
    },
    {
        id: 6,
        name: "전재연",
        phone: "010-6789-0123",
        account: "active",
        level: "중",
        review: false,
    },
    {
        id: 7,
        name: "김이레",
        phone: "010-7890-1234",
        account: "active",
        level: "중",
        review: false,
    },
];
SI_STAFF.forEach((s) => {
    s.pattern = STAFF_PATTERN[s.name];
    s.over = { ...(staffOver()[s.name] || {}) };
    /* 오늘(페이지를 확인하는 날) 근무 상태: 조퇴자는 조퇴 / 그 밖에는 오늘 근무 일정이 있으면 근무 중, 없으면 휴무 */
    s.state =
        s.account === "invited"
            ? null
            : LEFT_EARLY.has(s.name)
                ? "early"
                : staffWorksOn(s.name, todayMid())
                    ? "work"
                    : "off";
    if (resignedStaff().includes(s.name))
        s.account =
            "resigned"; /* 퇴사 처리한 직원: 기록은 남기고 목록에서만 빠져요 */
});

/* 지워진(또는 없는) 시간대를 쓰는 근무 일정은 휴무로 돌려요 (저장한 시간대 목록이 샘플 일정과 다를 때도 안전하게) */
function wsFixStaff(st) {
    st.pattern = st.pattern.map((f) => (f && SI_SHIFTS[f] ? f : null));
    Object.keys(st.over || {}).forEach((k) => {
        if (st.over[k] && !SI_SHIFTS[st.over[k]]) st.over[k] = null;
    });
}
SI_STAFF.forEach(wsFixStaff);

/* ---------- 날짜 ---------- */
const siKey = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const siWeekStart = (d) => dayAdd(d, -d.getDay());
let siWeek = siWeekStart(todayMid()); /* 왼쪽 목록이 보여주는 주 */
let siPWeek = siWeekStart(todayMid()); /* 오른쪽 패널이 보여주는 주 (목록과 따로 움직여요) */
let siSelId = null; /* 수정 중인 직원 */
let siDraft = null; /* 저장 전 수정 내용 */
let siDay = null; /* 패널에서 고른 날짜 */
let siQuery = "";

const siWeekNo = (d) => {
    const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    return Math.ceil((d.getDate() + first) / 7);
};
const siShiftOn = (s, d) => {
    const k = siKey(d);
    return k in s.over ? s.over[k] : s.pattern[d.getDay()];
};
const siWeekDays = () => Array.from({ length: 7 }, (_, i) => dayAdd(siWeek, i));
const siPanelDays = () => Array.from({ length: 7 }, (_, i) => dayAdd(siPWeek, i));

function siSchedule(s) {
    const worked = siWeekDays()
        .map((d) => ({ d, f: siShiftOn(s, d) }))
        .filter((x) => x.f);
    if (!worked.length) return null;
    const kinds = new Set(worked.map((x) => x.f));
    return {
        days: worked.map((x) => SI_DAYS[x.d.getDay()]).join(", "),
        kind:
            kinds.size === 1 ? SI_SHIFTS[[...kinds][0]].label : "요일별 시간 상이",
    };
}

/* ---------- 왼쪽 목록 ---------- */
const siAvatar = (s, size) => {
    const src = typeof STAFF_PHOTO !== "undefined" && STAFF_PHOTO[s.name];
    return `<span class="ui-avatar is-${size}">${src
        ? `<img class="ui-avatar-photo" src="${src}" alt="" />`
        : `<img class="ui-avatar-ic" src="${ICON("user-purple-small")}" alt="" />`
        }</span>`;
};

function renderStaffInfo() {
    const week = siWeekDays();
    $("#uiWeekText").textContent = `(${week[0].getFullYear()} ${pad(
        week[0].getMonth() + 1
    )}.${pad(week[0].getDate())} - ${pad(week[6].getMonth() + 1)}.${pad(
        week[6].getDate()
    )})`;
    const q = siQuery.trim();
    /* 활성 직원 → 초대 대기 직원 순서 / 같은 그룹 안에서는 가나다순 */
    const list = SI_STAFF.filter(
        (s) =>
            (!q || s.name.includes(q)) &&
            /* 퇴사한 직원은 '퇴사' 필터를 골랐을 때만 보여요 */
            (s.account === "resigned"
                ? filters.wstatus.has("resigned")
                : filters.wstatus.size === 0 || (s.state && filters.wstatus.has(s.state)))
    ).sort(
        (a, b) =>
            (a.account === "active" ? 0 : 1) - (b.account === "active" ? 0 : 1) ||
            a.name.localeCompare(b.name, "ko")
    );
    $("#uiCount").textContent = `전체 직원 총 ${SI_STAFF.filter((s) => s.account === "active").length
        }명`;
    const rows = list
        .map((s) => {
            const sc = siSchedule(s);
            const badge =
                s.account === "resigned"
                    ? `<span class="tag">${SI_WSTATE.resigned}</span>`
                    : s.state === "off" || s.state === "early"
                        ? `<span class="tag">${SI_WSTATE[s.state]}</span>`
                        : "";
            return `<div class="ui-tr${s.id === siSelId ? " is-selected" : ""
                }" data-staff="${s.id}" tabindex="0" role="button" aria-pressed="${s.id === siSelId
                }">
                <div class="ui-td ui-name">${siAvatar(s, "sm")}<span>${s.name
                }</span>${badge}</div>
                <div class="ui-td">${s.phone}</div>
                <div class="ui-td ui-sch">${sc
                    ? `<span>${sc.days}</span><span class="is-sub">${sc.kind}</span>`
                    : "-"
                }</div>
                <div class="ui-td"><i class="ui-dot${s.account === "active" ? " is-on" : ""
                }"></i>${s.account === "active" ? "활성" : s.account === "resigned" ? "퇴사" : "초대 대기"}</div>
                <div class="ui-td">${s.level || "-"}</div>
                <div class="ui-td">${s.review
                    ? '<span class="badge badge-review ui-review">검수 대상</span>'
                    : "-"
                }</div>
            </div>`;
        })
        .join("");
    $(
        "#uiTable"
    ).innerHTML = `<div class="ui-thead"><div class="ui-th">이름</div><div class="ui-th">전화번호</div><div class="ui-th">근무 일정</div><div class="ui-th">계정 상태</div><div class="ui-th">숙련도</div><div class="ui-th">검수 설정</div></div>
        <div class="ui-tbody">${rows || '<p class="floor-empty">조건에 맞는 직원이 없어요.</p>'
        }</div>`;
}

/* ---------- 우측 패널 ---------- */

const siSeg = (name, items, cur) =>
    `<div class="ui-seg" role="tablist">
        <span class="ui-seg-indicator" aria-hidden="true"></span>
        ${items
        .map(
            ([v, t]) =>
                `<button type="button" role="tab" class="${v === cur ? "is-on" : ""
                }" aria-selected="${v === cur
                }" data-seg="${name}" data-val="${v}">${t}</button>`
        )
        .join("")}
    </div>`;

/* 세그먼트 선택 배경 위치 변경 */
function siPositionSeg(group, animate = true) {
    const active = group.querySelector("button.is-on");
    const indicator = group.querySelector(".ui-seg-indicator");
    if (!active || !indicator) return;

    if (!animate) indicator.style.transition = "none";

    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft}px)`;

    if (!animate) {
        void indicator.offsetWidth;
        indicator.style.transition = "";
    }
}

function renderStaffDetail() {
    const p = $("#uiDetail");
    const s = SI_STAFF.find((x) => x.id === siSelId);
    if (!s) {
        p.classList.add("is-empty");
        p.innerHTML = `<div class="rs-d-head"><h2>직원 정보 수정</h2></div>
            <div class="rs-d-empty">
                <img class="rs-d-icon" src="${ICON("search-color")}" alt="" />
                <div class="rs-d-text">
                    <strong>선택한 직원의 상세 정보가 여기에 표시됩니다.</strong>
                    <span>직원을 선택하면 상세 정보를 확인하고, 근무 일정 및 상태를 관리할 수 있습니다.</span>
                </div>
            </div>`;
        return;
    }
    p.classList.remove("is-empty");
    const d = siDraft;
    const week = siPanelDays();
    const keep = p.querySelector(".ui-d-body")?.scrollTop || 0;
    const shiftOf = (day) => {
        const k = siKey(day);
        return k in d.over ? d.over[k] : s.pattern[day.getDay()];
    };
    const sel = siDay || week[0];
    const selShift = shiftOf(sel);
    const first = week[0];

    p.innerHTML = `<div class="rs-d-head"><h2>직원 정보 수정</h2>
<button class="rs-x" type="button" data-ui="close" aria-label="닫기">${icon(
        "close",
        20
    )}</button></div>
<div class="ui-d-body">
<div class="ui-user">${siAvatar(s, "lg")}<div><strong>${s.name
        }</strong><span>${s.phone}</span></div></div>
<section class="ui-sec"><h3>기본 설정</h3>
    <div class="ui-set">
        <div class="ui-set-row"><div><p>숙련도 설정</p><p class="is-sub">설정한 숙련도는 청소 자동 배정에 반영됩니다.</p></div>${siSeg(
            "level",
            SI_LEVELS.map((l) => [l, l]),
            d.level
        )}</div>
        <div class="ui-set-row"><div><p>청소 검수 대상</p><p class="is-sub">검수 대상 직원의 청소는 관리자 확인이 필요합니다.</p></div>${siSeg(
            "review",
            [
                ["y", "검수 대상"],
                ["n", "대상 아님"],
            ],
            d.review ? "y" : "n"
        )}</div>
    </div>
</section>
<hr class="ui-line" />
<section class="ui-sec"><h3>근무 일정</h3>
    <div class="ui-weeknav">
        <button class="rv-icon-btn" type="button" data-ui="prev" aria-label="이전 주">${icon(
            "arrow-left"
        )}</button>
        <strong>${first.getFullYear()}년 ${first.getMonth() + 1
        }월 ${siWeekNo(first)}주차</strong>
        <button class="rv-icon-btn" type="button" data-ui="next" aria-label="다음 주">${icon(
            "arrow-right"
        )}</button>
    </div>

    <div class="ui-week-group">
        <div class="ui-week">${week
            .map((day) => {
                const f = shiftOf(day);
                return `<button type="button" class="ui-day${siKey(day) === siKey(sel) ? " is-on" : ""
                    }" data-day="${siKey(day)}">
                <span class="ui-day-w">${SI_DAYS[day.getDay()]
                    }</span><strong>${day.getDate()}</strong><span class="ui-day-s">${f ? SI_SHIFTS[f].label : "-"
                    }</span></button>`;
            })
            .join("")}</div>

        <div class="ui-daybox-group">
            <div class="ui-daybox">
                <p class="ui-daybox-tit">${sel.getMonth() + 1
        }월 ${sel.getDate()}일 (${SI_DAYS[sel.getDay()]})</p>
                <div class="ui-daybox-row">
                    <dl><div><dt>근무 형태</dt><dd>${selShift ? SI_SHIFTS[selShift].label : "휴무"
        }</dd></div>
                        <div><dt>근무 시간</dt><dd>${selShift ? SI_SHIFTS[selShift].time : "-"
        }</dd></div></dl>
                    <div class="ui-daybox-btns">
                        <button class="btn btn-sm btn-outline" type="button" data-soon>근무 형태 변경</button>
                        <button class="btn btn-sm btn-outline" type="button" data-soon>${d.state === "early" ? "조퇴 취소" : "조퇴 처리"
        }</button>
                    </div>
                </div>
            </div>

            ${s.account === "resigned" ? "" : '<div class="ui-resign"><button class="text-btn" type="button" data-ui="resign">직원 퇴사 처리하기</button></div>'}
        </div>
    </div>
</section>
</div>
<div class="ui-d-foot"><button class="btn btn-lg btn-outline" type="button" data-ui="cancel">취소</button><button class="btn btn-lg btn-primary" type="button" data-ui="save">저장</button></div>`;

    p.querySelector(".ui-d-body").scrollTop = keep;
    p.querySelectorAll(".ui-seg").forEach((group) => siPositionSeg(group, false));

}

function siSelect(id) {
    const s = SI_STAFF.find((x) => x.id === id);
    if (!s) return;
    siSelId = id;
    siDraft = {
        level: s.level || "중",
        review: s.review,
        over: { ...s.over },
        state: s.state,
    };
    const today = todayMid();
    siPWeek = siWeek; /* 처음 열 때만 목록과 같은 주에서 시작해요 */
    const days = siPanelDays();
    siDay = days.find((x) => siKey(x) === siKey(today)) || days[0];
    renderStaffInfo();
    renderStaffDetail();
}

function siClose() {
    siSelId = siDraft = siDay = null;
    renderStaffInfo();
    renderStaffDetail();
}

function siSave() {
    const s = SI_STAFF.find((x) => x.id === siSelId);
    if (!s) return;
    s.level = siDraft.level;
    s.review = siDraft.review;
    s.over = { ...siDraft.over };
    /* 휴무일을 바꾸면 다른 화면(직원 배정)의 앞으로의 배정도 새로 계산돼요 */
    try {
        const all = staffOver();
        all[s.name] = { ...s.over };
        localStorage.setItem(STAFF_OVER_KEY, JSON.stringify(all));
    } catch (e) { }
    if (s.state !== null) s.state = siDraft.state;
    siClose();
}

/* ---------- 직원 퇴사 처리 확인 모달 ---------- */
const siModal = document.createElement("div");
siModal.className = "hm";
siModal.id = "siModal";
siModal.hidden = true;
document.body.appendChild(siModal);

function openResign() {
    const s = SI_STAFF.find((x) => x.id === siSelId);
    if (!s) return;
    siModal.innerHTML = `
    <div class="hm-box rs-cm" role="alertdialog" aria-modal="true" aria-label="${s.name
        } 직원 퇴사 처리">
      <div class="rs-cm-body">
        <span class="rs-cm-ic is-danger"><img src="${ICON(
            "exclamation-red"
        )}" alt="" /></span>
        <div class="rs-cm-tx"><strong>${s.name
        } 직원을 퇴사 처리하시겠습니까?</strong><span>퇴사 처리 후에는 새 청소 업무를 배정할 수 없습니다.<br />근무·업무 이력은 유지되며, 미완료 업무는 재배정이 필요할 수 있습니다.</span></div>
      </div>
      <div class="rs-cm-btns">
        <button class="btn btn-lg btn-outline" type="button" data-si-m="close">닫기</button>
        <button class="btn btn-lg btn-primary" type="button" data-si-m="ok">확인</button>
      </div>
    </div>`;
    siModal.hidden = false;
    siModal.querySelector(".btn-primary").focus();
}
/* 저장 확인 (직원 배정 화면의 '변경된 내용으로 저장하시겠습니까?' 모달과 같은 모양) */
function openSaveConfirm() {
    siModal.innerHTML = `
    <div class="hm-box rs-cm" role="alertdialog" aria-modal="true" aria-label="변경된 내용으로 저장하시겠습니까?">
      <div class="rs-cm-body">
        <span class="rs-cm-ic"><img src="${ICON(
        "check-purple"
    )}" alt="" /></span>
        <div class="rs-cm-tx"><strong>변경된 내용으로 저장하시겠습니까?</strong><span>변경한 직원 정보가 저장되며,<br />숙련도와 근무 일정은 청소 자동 배정에 반영됩니다.</span></div>
      </div>
      <div class="rs-cm-btns">
        <button class="btn btn-lg btn-outline" type="button" data-si-m="close">닫기</button>
        <button class="btn btn-lg btn-primary" type="button" data-si-m="save">변경 사항 저장</button>
      </div>
    </div>`;
    siModal.hidden = false;
    siModal.querySelector(".btn-primary").focus();
}
const closeResign = () => {
    siModal.hidden = true;
    siModal.innerHTML = "";
};
siModal.addEventListener("click", (e) => {
    if (e.target === siModal) return closeResign();
    const b = e.target.closest("[data-si-m]");
    if (!b) return;
    if (b.dataset.siM === "save") {
        closeResign();
        siSave();
    } else if (b.dataset.siM === "ok") {
        /* 기존 데이터는 그대로 두고, 앞으로 새 업무 배정만 막아요 (서버 연결 시 퇴사 처리 요청으로 교체) */
        const s = SI_STAFF.find((x) => x.id === siSelId);
        if (s) {
            s.account = "resigned";
            try {
                const n = todayMid();
                localStorage.setItem(
                    RESIGNED_KEY,
                    JSON.stringify({
                        ...resignedMap(),
                        [s.name]: `${n.getFullYear()}-${n.getMonth() + 1}-${n.getDate()}`,
                    })
                );
            } catch (e) { }
        }
        closeResign();
        siClose();
    } else closeResign();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !siModal.hidden) closeResign();
});

/* 왼쪽 목록의 주 이동 (오른쪽 패널은 그대로예요) */
function siMoveWeek(dir) {
    siWeek = dayAdd(siWeek, 7 * dir);
    renderStaffInfo();
}

/* 오른쪽 패널의 주 이동 (왼쪽 목록은 그대로예요) */
function siMovePanelWeek(dir) {
    siPWeek = dayAdd(siPWeek, 7 * dir);
    if (siDay) siDay = dayAdd(siDay, 7 * dir);
    renderStaffDetail();
}

document.addEventListener("click", (e) => {
    if (!$("#viewUserInfo")) return;
    const tr = e.target.closest(".ui-tr");
    if (tr) return siSelect(+tr.dataset.staff);
    if (e.target.closest("#uiPrev")) return siMoveWeek(-1);
    if (e.target.closest("#uiNext")) return siMoveWeek(1);

    const seg = e.target.closest("[data-seg]");
    if (seg && siDraft) {
        if (seg.classList.contains("is-on")) return;

        if (seg.dataset.seg === "level") siDraft.level = seg.dataset.val;
        else siDraft.review = seg.dataset.val === "y";

        const group = seg.closest(".ui-seg");
        group.querySelectorAll("button").forEach((btn) => {
            const on = btn === seg;
            btn.classList.toggle("is-on", on);
            btn.setAttribute("aria-selected", on);
        });

        siPositionSeg(group);
        return;
    }

    const day = e.target.closest("[data-day]");
    if (day) {
        const [y, m, dd] = day.dataset.day.split("-").map(Number);
        siDay = new Date(y, m - 1, dd);
        return renderStaffDetail();
    }
    const act = e.target.closest("[data-ui]");
    if (!act) return;
    const a = act.dataset.ui;
    if (a === "close" || a === "cancel") siClose();
    else if (a === "save") openSaveConfirm();
    else if (a === "resign") openResign();
    else if (a === "prev") siMovePanelWeek(-1);
    else if (a === "next") siMovePanelWeek(1);
    /* 근무 형태 변경 · 조퇴 처리는 아직 연결 전이라 data-soon 으로 '준비 중' 모달을 띄워요 */
});

document.addEventListener("keydown", (e) => {
    if (!$("#viewUserInfo")) return;
    const tr = e.target.closest && e.target.closest(".ui-tr");
    if (tr && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        siSelect(+tr.dataset.staff);
    }
});

$("#uiSearch").addEventListener("input", (e) => {
    siQuery = e.target.value;
    renderStaffInfo();
});

renderStaffInfo();
renderStaffDetail();

["#uiUpload", "#uiInvite"].forEach((q) =>
    $(q)?.setAttribute("data-soon", "")
);

/* ==========================================================
   근무 시간대 설정 모달 (Figma 2431:69314 비어 있을 때 / 2431:69450 값이 있을 때)
   - 시간대마다 이름 + 시작 ~ 끝 시간 (시간은 알람처럼 돌려서 골라요)
   - 항목 추가 / 휴지통(삭제) / 저장 / 닫기 · X · 바깥 클릭 · Esc 로 닫기 (저장 전 내용은 버려요)
   - 저장하면 근무 형태(SI_SHIFTS)가 바뀌고, 지워진 시간대를 쓰던 근무 일정은 휴무로 돌아가요
   ========================================================== */
const wsModal = document.createElement("div");
wsModal.className = "hm";
wsModal.id = "wsModal";
wsModal.hidden = true;
document.body.appendChild(wsModal);
let wsTrigger = null;
const wsEsc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const wsNewId = () => `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function wsRow(w) {
    return `
    <div class="ws-item" data-ws-row="${w.id}">
      <div class="ws-main">
        <label class="ws-name"><input type="text" value="${wsEsc(w.name)}" maxlength="10" autocomplete="off" placeholder="근무 시간대 이름을 설정해 주세요. (ex. 오전)" aria-label="근무 시간대 이름" /></label>
        <div class="ws-time">${timePickerHtml("wsS-" + w.id, w.start)}<span class="ws-tilde">~</span>${timePickerHtml("wsE-" + w.id, w.end)}</div>
      </div>
      <button class="ws-del" type="button" aria-label="삭제" data-ws-m="del">${icon("trash", 20)}</button>
    </div>`;
}

function openWorkShifts(trigger) {
    wsTrigger = trigger || null;
    wsModal.innerHTML = `
    <div class="hm-box ws-set" role="dialog" aria-modal="true" aria-labelledby="wsTitle">
      <div class="hm-head">
        <h2 class="hm-title" id="wsTitle">근무 시간대 설정</h2>
        <button class="hm-close" type="button" data-ws-m="close" aria-label="닫기">${icon("close", 20)}</button>
      </div>
      <div class="ws-body">
        <div class="ws-list" id="wsList">${wsLoad().map(wsRow).join("")}</div>
        <button class="btn btn-sm btn-outline ws-add" type="button" data-ws-m="add">${icon("plus", 20)}항목 추가</button>
      </div>
      <div class="hm-foot">
        <button class="btn btn-lg btn-outline" type="button" data-ws-m="close">닫기</button>
        <button class="btn btn-lg btn-primary" type="button" data-ws-m="save">저장</button>
      </div>
    </div>`;
    initTimePicker(wsModal);
    wsModal.hidden = false;
    wsModal.querySelector(".ws-name input").focus();
}
function closeWorkShifts() {
    wsModal.hidden = true;
    wsModal.innerHTML = "";
    if (wsTrigger) wsTrigger.focus();
}

function wsRead() {
    return [...wsModal.querySelectorAll("[data-ws-row]")].map((r) => ({
        id: r.dataset.wsRow,
        name: r.querySelector(".ws-name input").value.trim(),
        start: normTime($("input[type=hidden]", r.querySelector(".tp")).value) || "00:00",
        end: normTime($("input[type=hidden]", r.querySelectorAll(".tp")[1]).value) || "00:00",
    }));
}

function wsSave() {
    const list = wsRead();
    const seen = new Set();
    let bad = null;
    wsModal.querySelectorAll("[data-ws-row]").forEach((r, i) => {
        const n = list[i].name;
        const err = !n || seen.has(n); /* 이름이 비었거나 같은 이름이 또 있으면 빨간 테두리 */
        seen.add(n);
        r.querySelector(".ws-name").classList.toggle("is-error", err);
        if (err && !bad) bad = r.querySelector(".ws-name input");
    });
    if (bad) return bad.focus();
    try {
        localStorage.setItem(WS_KEY, JSON.stringify(list));
    } catch (e) { }
    /* TODO: 서버 연결 시 여기서 list 를 전송 */
    wsApply(list);
    SI_STAFF.forEach(wsFixStaff);
    if (siDraft) wsFixStaff(siDraft);
    renderStaffInfo();
    renderStaffDetail();
    closeWorkShifts();
}

wsModal.addEventListener("click", (e) => {
    if (e.target === wsModal) return closeWorkShifts();
    const b = e.target.closest("[data-ws-m]");
    if (!b) return;
    const act = b.dataset.wsM;
    if (act === "close") closeWorkShifts();
    else if (act === "save") wsSave();
    else if (act === "add") {
        const w = { id: wsNewId(), name: "", start: "00:00", end: "00:00" };
        const list = $("#wsList", wsModal);
        list.insertAdjacentHTML("beforeend", wsRow(w));
        const row = list.lastElementChild;
        row.querySelectorAll(".tp").forEach((tp) => initOneTimePicker(wsModal, tp));
        row.scrollIntoView({ block: "nearest" });
        row.querySelector(".ws-name input").focus();
    } else if (act === "del") {
        const rows = wsModal.querySelectorAll("[data-ws-row]");
        const row = b.closest("[data-ws-row]");
        if (rows.length > 1) row.remove();
        else {
            /* 하나만 남았을 때는 지우지 않고 비워요 (비어 있는 상태) */
            row.querySelector(".ws-name input").value = "";
            row.querySelectorAll(".tp").forEach((tp) => tp._set("00:00"));
            row.querySelector(".ws-name input").focus();
        }
    }
});
/* 시간 목록을 열면 모달 안에서 잘리지 않게 스크롤해서 보여줘요 */
wsModal.addEventListener("click", (e) => {
    const f = e.target.closest(".tp-field");
    if (!f) return;
    setTimeout(() => f.parentElement.querySelector(".tp-panel:not([hidden])")?.scrollIntoView({ block: "nearest" }), 0);
});
wsModal.addEventListener("input", (e) => {
    if (e.target.matches(".ws-name input")) e.target.closest(".ws-name").classList.remove("is-error");
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !wsModal.hidden && !wsModal.querySelector(".tp-panel:not([hidden])")) closeWorkShifts();
});
$("#uiHours")?.addEventListener("click", (e) => openWorkShifts(e.currentTarget));