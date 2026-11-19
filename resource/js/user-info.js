/* ==========================================================
   직원 정보 설정 (user-info.html / index.js 뒤에 불러와요)
   - 왼쪽: 이번주 근무 일정 (직원 목록 / 이름 검색 / 현재 근무상태 필터 / 주 이동)
   - 오른쪽: 직원 정보 수정 패널 (숙련도 · 청소 검수 대상 · 주간 근무 일정)
       · 직원을 고르기 전 / 패널을 닫았을 때는 안내 화면이 떠요
       · 취소 = 수정 내용을 버리고 패널 닫기 / 저장 = 목록에 반영
   - 데이터는 지금은 샘플 / 서버 연결 시 SI_STAFF · SI_SHIFTS 만 서버 값으로 바꾸면 돼요
   ========================================================== */
const SI_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

/* 근무 형태 (시간은 '근무 시간대 설정' 값으로 교체) */
const SI_SHIFTS = {
    day: { label: "주간", time: "09:00~18:00" },
    aft: { label: "오후", time: "15:00~22:00" },
    night: { label: "야간", time: "22:00~07:00" },
};
const SI_SHIFT_ORDER = ["day", "aft", "night", null]; /* '근무형태 변경' 을 누를 때 도는 순서 (null = 휴무) */

/* 현재 근무 상태 (목록의 이름 옆 배지 / 필터) */
const SI_WSTATE = { work: "근무 중", off: "휴무", early: "조퇴" };
const SI_LEVELS = ["상", "중", "하"];

/* pattern: 일 ~ 토 요일별 근무 형태 (null = 쉬는 날) / over: 날짜별로 따로 고친 값 */
const SI_STAFF = [
    { id: 1, name: "최하석", phone: "010-1234-5678", pattern: [null, null, "night", null, "night", null, "night"], account: "active", level: "하", review: true, state: "off" },
    { id: 2, name: "유가은", phone: "010-2345-6789", pattern: [null, "day", "day", "day", "day", "day", null], account: "active", level: "상", review: false, state: "work" },
    { id: 3, name: "이서영", phone: "010-4567-8901", pattern: [null, null, "day", null, "aft", null, "night"], account: "active", level: "상", review: false, state: "work" },
    { id: 4, name: "한다경", phone: "010-4567-8901", pattern: ["night", null, null, "night", "night", "night", null], account: "active", level: "중", review: true, state: "work" },
    { id: 5, name: "송혜원", phone: "010-5678-9012", pattern: [null, "night", "night", "night", null, null, null], account: "active", level: "중", review: false, state: "off" },
    { id: 6, name: "전재연", phone: "010-6789-0123", pattern: [null, null, null, null, null, null, null], account: "active", level: "중", review: false, state: "early" },
    { id: 7, name: "김이레", phone: "010-7890-1234", pattern: [null, null, null, null, null, null, null], account: "invited", level: null, review: false, state: null },
];
SI_STAFF.forEach((s) => (s.over = {}));

/* ---------- 날짜 ---------- */
const siKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const siWeekStart = (d) => dayAdd(d, -d.getDay());
let siWeek = siWeekStart(todayMid());
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

/* 목록의 '근무일정' 칸: 근무하는 요일 + (같은 형태면 형태 이름 / 다르면 '요일별 시간 상이') */
function siSchedule(s) {
    const worked = siWeekDays()
        .map((d) => ({ d, f: siShiftOn(s, d) }))
        .filter((x) => x.f);
    if (!worked.length) return null;
    const kinds = new Set(worked.map((x) => x.f));
    return {
        days: worked.map((x) => SI_DAYS[x.d.getDay()]).join(", "),
        kind: kinds.size === 1 ? SI_SHIFTS[[...kinds][0]].label : "요일별 시간 상이",
    };
}

/* ---------- 왼쪽 목록 ---------- */
const siAvatar = (s, size) => {
    const src = typeof STAFF_PHOTO !== "undefined" && STAFF_PHOTO[s.name];
    return `<span class="ui-avatar is-${size}">${src ? `<img src="${src}" alt="" />` : icon("user-purple", size === "lg" ? 32 : 20)}</span>`;
};

function renderStaffInfo() {
    const week = siWeekDays();
    $("#uiWeekText").textContent = `(${week[0].getFullYear()} ${pad(week[0].getMonth() + 1)}.${pad(week[0].getDate())} - ${pad(week[6].getMonth() + 1)}.${pad(week[6].getDate())})`;
    const q = siQuery.trim();
    const list = SI_STAFF.filter((s) => (!q || s.name.includes(q)) && (filters.wstatus.size === 0 || (s.state && filters.wstatus.has(s.state))));
    $("#uiCount").textContent = `전체직원 총 ${SI_STAFF.filter((s) => s.account === "active").length}명`;
    const rows = list
        .map((s) => {
            const sc = siSchedule(s);
            const badge = s.state === "off" || s.state === "early" ? `<span class="tag">${SI_WSTATE[s.state]}</span>` : "";
            return `<div class="ui-tr${s.id === siSelId ? " is-selected" : ""}" data-staff="${s.id}" tabindex="0" role="button" aria-pressed="${s.id === siSelId}">
                <div class="ui-td ui-name">${siAvatar(s, "sm")}<span>${s.name}</span>${badge}</div>
                <div class="ui-td">${s.phone}</div>
                <div class="ui-td ui-sch">${sc ? `<span>${sc.days}</span><span class="is-sub">${sc.kind}</span>` : "-"}</div>
                <div class="ui-td"><i class="ui-dot${s.account === "active" ? " is-on" : ""}"></i>${s.account === "active" ? "활성" : "초대 대기"}</div>
                <div class="ui-td">${s.level || "-"}</div>
                <div class="ui-td">${s.review ? '<span class="badge badge-review ui-review">검수대상</span>' : "-"}</div>
            </div>`;
        })
        .join("");
    $("#uiTable").innerHTML = `<div class="ui-thead"><div class="ui-th">이름</div><div class="ui-th">전화번호</div><div class="ui-th">근무일정</div><div class="ui-th">계정 상태</div><div class="ui-th">숙련도</div><div class="ui-th">검수 설정</div></div>
        <div class="ui-tbody">${rows || '<p class="floor-empty">조건에 맞는 직원이 없어요.</p>'}</div>`;
}

/* ---------- 우측 패널 ---------- */
const siSeg = (name, items, cur) =>
    `<div class="ui-seg" role="tablist">${items.map(([v, t]) => `<button type="button" role="tab" class="${v === cur ? "is-on" : ""}" data-seg="${name}" data-val="${v}">${t}</button>`).join("")}</div>`;

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
                    <span>직원을 선택하면 상세 정보를 확인하고, 근무일정 및 상태를 관리할 수 있습니다.</span>
                </div>
            </div>`;
        return;
    }
    p.classList.remove("is-empty");
    const d = siDraft;
    const week = siWeekDays();
    const keep = p.querySelector(".ui-d-body")?.scrollTop || 0;
    const shiftOf = (day) => {
        const k = siKey(day);
        return k in d.over ? d.over[k] : s.pattern[day.getDay()];
    };
    const sel = siDay || week[0];
    const selShift = shiftOf(sel);
    const isToday = siKey(sel) === siKey(todayMid());
    const first = week[0];
    p.innerHTML = `<div class="rs-d-head"><h2>직원 정보 수정</h2>
            <button class="rs-x" type="button" data-ui="close" aria-label="닫기">${icon("close", 20)}</button></div>
        <div class="ui-d-body">
            <div class="ui-user">${siAvatar(s, "lg")}<div><strong>${s.name}</strong><span>${s.phone}</span></div></div>
            <section class="ui-sec"><h3>기본 설정</h3>
                <div class="ui-set">
                    <div class="ui-set-row"><div><p>숙련도 설정</p><p class="is-sub">설정한 숙련도는 청소 자동 배정에 반영됩니다.</p></div>${siSeg("level", SI_LEVELS.map((l) => [l, l]), d.level)}</div>
                    <div class="ui-set-row"><div><p>청소 검수 대상</p><p class="is-sub">검수 대상 직원의 청소는 관리자 확인이 필요합니다.</p></div>${siSeg("review", [["y", "검수대상"], ["n", "대상 아님"]], d.review ? "y" : "n")}</div>
                </div>
            </section>
            <hr class="ui-line" />
            <section class="ui-sec"><h3>근무 일정</h3>
                <div class="ui-weeknav">
                    <button class="rv-icon-btn" type="button" data-ui="prev" aria-label="이전 주">${icon("arrow-left")}</button>
                    <strong>${first.getFullYear()}년 ${first.getMonth() + 1}월 ${siWeekNo(first)}주차</strong>
                    <button class="rv-icon-btn" type="button" data-ui="next" aria-label="다음 주">${icon("arrow-right")}</button>
                </div>
                <div class="ui-week">${week
            .map((day) => {
                const f = shiftOf(day);
                return `<button type="button" class="ui-day${siKey(day) === siKey(sel) ? " is-on" : ""}" data-day="${siKey(day)}">
                            <span class="ui-day-w">${SI_DAYS[day.getDay()]}</span><strong>${day.getDate()}</strong><span class="ui-day-s">${f ? SI_SHIFTS[f].label : "-"}</span></button>`;
            })
            .join("")}</div>
                <div class="ui-daybox">
                    <p class="ui-daybox-tit">${sel.getMonth() + 1}월 ${sel.getDate()}일 (${SI_DAYS[sel.getDay()]})</p>
                    <div class="ui-daybox-row">
                        <dl><div><dt>근무형태</dt><dd>${selShift ? SI_SHIFTS[selShift].label : "휴무"}</dd></div>
                            <div><dt>근무시간</dt><dd>${selShift ? SI_SHIFTS[selShift].time : "-"}</dd></div></dl>
                        <div class="ui-daybox-btns">
                            <button class="btn btn-sm btn-outline" type="button" data-ui="shift">근무형태 변경</button>
                            <button class="btn btn-sm btn-outline" type="button" data-ui="early" ${isToday && selShift ? "" : "disabled"}>${d.state === "early" ? "조퇴 취소" : "조퇴 처리"}</button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
        <div class="ui-d-foot"><button class="btn btn-lg btn-outline" type="button" data-ui="cancel">취소</button><button class="btn btn-lg btn-primary" type="button" data-ui="save">저장</button></div>`;
    p.querySelector(".ui-d-body").scrollTop = keep;
}

function siSelect(id) {
    const s = SI_STAFF.find((x) => x.id === id);
    if (!s) return;
    siSelId = id;
    siDraft = { level: s.level || "중", review: s.review, over: { ...s.over }, state: s.state };
    const today = todayMid();
    const days = siWeekDays();
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
    if (s.state !== null) s.state = siDraft.state;
    siClose();
}

function siMoveWeek(dir) {
    siWeek = dayAdd(siWeek, 7 * dir);
    if (siSelId) siDay = dayAdd(siDay || siWeek, 7 * dir);
    renderStaffInfo();
    if (siSelId) renderStaffDetail();
}

document.addEventListener("click", (e) => {
    if (!$("#viewUserInfo")) return;
    const tr = e.target.closest(".ui-tr");
    if (tr) return siSelect(+tr.dataset.staff);
    if (e.target.closest("#uiPrev")) return siMoveWeek(-1);
    if (e.target.closest("#uiNext")) return siMoveWeek(1);
    const seg = e.target.closest("[data-seg]");
    if (seg && siDraft) {
        if (seg.dataset.seg === "level") siDraft.level = seg.dataset.val;
        else siDraft.review = seg.dataset.val === "y";
        return renderStaffDetail();
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
    else if (a === "save") siSave();
    else if (a === "prev") siMoveWeek(-1);
    else if (a === "next") siMoveWeek(1);
    else if (a === "shift") {
        const s = SI_STAFF.find((x) => x.id === siSelId);
        const k = siKey(siDay);
        const cur = k in siDraft.over ? siDraft.over[k] : s.pattern[siDay.getDay()];
        siDraft.over[k] = SI_SHIFT_ORDER[(SI_SHIFT_ORDER.indexOf(cur) + 1) % SI_SHIFT_ORDER.length];
        renderStaffDetail();
    } else if (a === "early") {
        siDraft.state = siDraft.state === "early" ? "work" : "early";
        renderStaffDetail();
    }
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