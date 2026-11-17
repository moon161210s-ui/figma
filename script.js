/* ==========================================================
   실시간 객실 청소 현황 - 화면 동작
   - 객실 타일 그리기 / 선택 → 우측 상세 패널
   - 퇴실 예정(달력+시간), 청소 가능 시간, 담당 직원 수정 팝오버
   ========================================================== */

const ICON = (name) => `resource/icon/${name}.svg`;
const STAFF_PHOTO = {
    이서영: "resource/img/staff-1.png",
    전재연: "resource/img/staff-2.png",
    유가은: "resource/img/staff-3.png",
};
/* 청소 완료 객실의 첨부 사진: resource/img/room-1.png ~ room-4.png (실제 사진으로 교체) */
const ATTACHMENTS = [
    "resource/img/room-1.png",
    "resource/img/room-2.png",
    "resource/img/room-3.png",
    "resource/img/room-4.png",
];

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
const cleanText = (r) => `${r.clean} ~ ${addMinutes(r.clean, r.cleanLen)}`;
const tagHtml = (t) => (t ? `<span class="tag">${t}</span>` : "");

/* ---------- 샘플 데이터 (실제 서비스에서는 서버 데이터로 교체) ---------- */
const STAFF = ["이서영", "전재연", "유가은", "한다경", "최하석", "김이레"];
/* 순서 = 청소 상태 필터 드롭다운에 보이는 순서 (시안) */
const STATUS = {
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

const YEAR = 2026;
const d = (m, day) => new Date(YEAR, m - 1, day);

/* nights: 숙박 박수(기본 1) / extHour: 퇴실 연장 시간 / extNight: 연박 연장 박수 */
const RAW_ROOMS = [
    {
        no: "101",
        floor: 1,
        status: "done",
        out: "17:00",
        extHour: 2,
        staff: "전재연",
        clean: "16:00",
    },
    { no: "102", floor: 1, status: "progress", out: "15:00", staff: "유가은" },
    { no: "103", floor: 1, status: "progress", out: "17:00", staff: "전재연" },
    { no: "104", floor: 1, status: "todo", out: "17:00", staff: "한다경" },
    { no: "105", floor: 1, status: "review", out: "15:00", staff: "최하석" },
    { no: "106", floor: 1, status: "done", out: "15:00", staff: "이서영" },
    { no: "108", floor: 1, status: "todo", out: "15:00", staff: "김이레" },
    {
        no: "109",
        floor: 1,
        status: "reassign",
        out: "15:00",
        staff: "전재연",
        staffTag: "조퇴",
    },
    { no: "201", floor: 2, status: "todo", out: "17:00", staff: "이서영" },
    { no: "202", floor: 2, status: "done", out: "17:00", staff: "김이레" },
    { no: "203", floor: 2, status: "progress", out: "17:00", staff: "전재연" },
    { no: "204", floor: 2, status: "progress", out: "15:00", staff: "유가은" },
    { no: "301", floor: 3, status: "progress", out: "17:00", staff: "최하석" },
    {
        no: "302",
        floor: 3,
        status: "todo",
        out: "16:00",
        extHour: 1,
        nights: 3,
        extNight: 1,
        staff: "한다경",
    },
    { no: "303", floor: 3, status: "todo", out: "17:00", staff: "이서영" },
    { no: "304", floor: 3, empty: true },
];

/* 서버에서 받은 객실 한 건을 화면에서 쓰는 형태(날짜 계산 포함)로 바꿔요 */
function normalizeRoom(r) {
    if (r.empty) return r;
    const nights = r.nights || 1;
    r.type = "스탠다드";
    r.start = d(11, 10);
    r.end = d(11, 10 + nights);
    r.origEnd = d(11, 10 + nights - (r.extNight || 0));
    r.origOut = addMinutes(r.out, -(r.extHour || 0) * 60);
    /* 시안 샘플: 퇴실을 연장한 객실 / 청소 시간을 직접 정한 객실은 '직접 고친 값'으로 취급 */
    r.outLocked = !!r.extHour;
    r.cleanLocked = !!r.clean;
    r.clean = r.clean || r.out;
    r.cleanLen = 0; /* applyHours() 가 운영 시간대 규칙으로 채워요 */
    return r;
}
/* ---------- 운영 시간대 기본 규칙 (모달에서 설정 / 모든 객실 타일의 기본값) ----------
   - 객실별로 우측 패널에서 직접 고친 시간(outLocked / cleanLocked)은 이 규칙보다 우선해요 */
const HOURS_DEFAULT = {
    weekday: { in: "20:00", out: "15:00" },
    weekend: { in: "20:00", out: "15:00" },
    cleanOut: "0" /* 퇴실 N시간 후부터 청소 */,
    cleanIn: "0" /* 입실 N시간 전까지 청소 */,
    extend: "0" /* 연장 N시간 초과 시 1박 추가 */,
    dayUse: "0" /* 대실 최대 N시간 */,
};
let HOURS = JSON.parse(JSON.stringify(HOURS_DEFAULT));
try {
    const saved = JSON.parse(localStorage.getItem("hours"));
    if (saved) HOURS = { ...HOURS, ...saved };
} catch (e) { }


/* 평일/주말은 퇴실 날짜의 요일로 정해요 (토·일 = 주말) */
const hoursKey = (r) => ([0, 6].includes(r.end.getDay()) ? "weekend" : "weekday");

/* 기본 규칙을 모든 객실에 적용해요 (직접 고친 시간은 그대로 둬요)
   퇴실 시간 = 규칙의 퇴실 시간 / 청소 시작 = 퇴실 + N시간 후 / 청소 마감 = 입실 시간 - M시간 전 */
function applyHours() {
    ROOMS.forEach((r) => {
        if (r.empty) return;
        const h = HOURS[hoursKey(r)];
        if (!r.outLocked) {
            r.out = h.out;
            r.origOut = h.out;
        }
        if (!r.cleanLocked) r.clean = addMinutes(r.out, Number(HOURS.cleanOut) * 60);
        const end = toMin(h.in) - Number(HOURS.cleanIn) * 60;
        r.cleanLen = Math.max(0, end - toMin(r.clean));
    });
}

const ROOMS = RAW_ROOMS.map(normalizeRoom);
applyHours();

/* 상단 요약 카드 숫자 (서버 데이터로 교체 대상) */
let SUMMARY = { checkin: 12, checkout: 15, clean: 17, alert: 3 };

/* ---------- 상태 ---------- */
let selectedNo = null;
let query = "";

/* ---------- 객실 타일 ---------- */
function roomCard(r) {
    if (r.empty) {
        return `
      <article class="room-card is-empty">
        <div class="room-top"><span class="room-no">${r.no}호</span></div>
        <dl class="room-info">
          <div><dt>일정</dt><dd>-</dd></div>
          <div><dt>퇴실</dt><dd>-</dd></div>
          <div><dt>담당</dt><dd>-</dd></div>
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
          <span class="badge ${s.tile}">${s.label}</span>
        </div>
        <dl class="room-info">
          <div><dt>일정</dt><dd>${stayText(r)}</dd></div>
          <div><dt>퇴실</dt><dd>${r.out}${tagHtml(outTag(r))}</dd></div>
          <div><dt>담당</dt><dd>${r.staff}${tagHtml(r.staffTag)}</dd></div>
        </dl>
      </article>`;
}

/* 체크된 필터 값 (처음에는 전부 체크 = 전체 / 아래 FILTER_DEFS 뒤에서 채워요) */
const filters = { floor: new Set(), status: new Set() };

function renderFloors() {
    const q = query.trim();
    const floors = [...new Set(ROOMS.map((r) => r.floor))];
    const html = floors
        .map((f) => {
            const list = ROOMS.filter(
                (r) =>
                    r.floor === f &&
                    (!q || r.no.includes(q)) &&
                    filters.floor.has(String(r.floor)) &&
                    /* 상태가 없는 빈 객실(304호)은 상태가 전부 체크돼 있을 때만 보여요 */
                    (r.status
                        ? filters.status.has(r.status)
                        : Object.keys(STATUS).every((k) => filters.status.has(k)))
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
    const panel = $("#detail");
    const r = ROOMS.find((x) => x.no === selectedNo);
    workspace.classList.toggle("has-detail", !!r);
    if (!r) {
        panel.innerHTML = "";
        panel.style.height = "";
        return;
    }

    const done = r.status === "done";
    const edit = (kind, label) =>
        done
            ? ""
            : `<button class="btn-icon" type="button" data-edit="${kind}" aria-label="${label} 수정">${icon(
                "pen"
            )}</button>`;
    const row = (label, value, kind) => `
      <div class="detail-row">
        <dt>${label}</dt>
        <dd${kind && !done ? ' class="has-edit"' : ""}>${value}</dd>
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
        <span class="badge ${STATUS[r.status].panel}">${STATUS[r.status].label
        }</span>
      </div>
      <dl class="detail-info">
        ${row("객실 유형", r.type)}
        ${row("숙박 일정", `${stayText(r)}${tagHtml(stayTag(r))}`)}
        ${row("퇴실 예정", `${r.out}${tagHtml(outTag(r))}`, "checkout")}
        ${row("청소 가능 시간", cleanText(r), "clean")}
        ${row("담당 직원", `${r.staff}${tagHtml(r.staffTag)}`, "staff")}
      </dl>
      ${done
            ? `
        <h3 class="detail-section">첨부파일 <small>(${ATTACHMENTS.length
            })</small></h3>
        <div class="attach-list">
          ${ATTACHMENTS.map(
                (src) => `<img src="${src}" alt="청소 완료 사진" />`
            ).join("")}
        </div>`
            : `
        <h3 class="detail-section">첨부파일</h3>
        <div class="attach-empty">
          <strong>등록된 첨부파일이 없어요.</strong>
          담당 직원의 청소가 완료되면 확인할 수 있어요.
        </div>`
        }
    </div>
    <button class="btn btn-lg btn-primary" type="button" data-result ${done ? "" : "disabled"
        }>청소 결과 확인하기</button>`;

    fitDetail();
}

/* 패널은 화면 맨 아래(여백 20px)까지 채우고, 스크롤하면 헤더 아래(120px)에 붙어요 */
function fitDetail() {
    const cell = $(".detail-cell");
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
    if (pop) pop.remove();
    pop = null;
    popAnchor = null;
    if (pendingDetail) {
        pendingDetail = false;
        rerenderDetail();
    } /* 수정 중에 바뀐 패널 반영 */
}

function placePopover() {
    if (!pop || !popAnchor || !document.contains(popAnchor)) return;
    const a = popAnchor.getBoundingClientRect();
    const w = pop.offsetWidth,
        h = pop.offsetHeight;
    const left = Math.max(8, a.right - w); /* 버튼 오른쪽 끝에 맞춤 */
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

    const actions = `
    <div class="pop-actions">
      <button class="btn btn-sm btn-outline" type="button" data-pop-close>닫기</button>
      <button class="btn btn-sm btn-primary" type="button" data-pop-save>저장하기</button>
    </div>`;
    /* 시간 선택: 오전/오후 · 시 · 분 목록에서 골라요 (고른 값은 숨겨진 #popTime 에 "HH:MM" 으로 들어가요) */
    const timeField = (id, value) => {
        const t = normTime(value) || "00:00";
        const h24 = +t.slice(0, 2);
        const h12 = h24 % 12 || 12;
        const col = (key, items, cur) =>
            `<div class="tp-col" data-col="${key}" role="listbox">${items
                .map(
                    ([v, label]) =>
                        `<button type="button" class="tp-item${v === cur ? " is-selected" : ""}" data-v="${v}" role="option" aria-selected="${v === cur}" tabindex="${v === cur ? 0 : -1}">${label}</button>`
                )
                .join("")}</div>`;
        return `
    <div class="tp" id="tp-${id}">
      <div class="tp-field">${icon("time")}<span class="tp-text">${t}</span></div>
      <input id="${id}" type="hidden" value="${t}" />
      <div class="tp-panel">
        ${col("ap", [["AM", "오전"], ["PM", "오후"]], h24 < 12 ? "AM" : "PM")}
        ${col("h", Array.from({ length: 12 }, (_, i) => [String(i + 1), pad(i + 1)]), String(h12))}
        ${col("m", Array.from({ length: 60 }, (_, i) => [String(i), pad(i)]), String(+t.slice(3)))}
      </div>
    </div>`;
    };
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
      ${timeField("popTime", room.clean)}
      ${actions}`;
        save = () => {
            const t = readTime();
            if (!t) return false;
            room.clean = t;
            room.cleanLocked = true; /* 직접 고친 시간이 기본 규칙보다 우선 */
            applyHours();
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
                const disabled =
                    dt <= room.start; /* 입실일 이전·당일은 퇴실일로 선택 불가 */
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
            room.end = sel;
            room.out = t;
            room.outLocked = true; /* 직접 고친 시간이 기본 규칙보다 우선 */
            applyHours();
            return true;
        };
    }

    if (kind === "staff") {
        let chosen = room.staff;
        const drawStaff = () => {
            $(".staff-list", pop).innerHTML = STAFF.map((name) => {
                const rooms =
                    ROOMS.filter((x) => x.staff === name)
                        .map((x) => x.no + "호")
                        .join(", ") || "배정된 객실 없음";
                const photo = STAFF_PHOTO[name]
                    ? `<img src="${STAFF_PHOTO[name]}" alt="" />`
                    : `<span class="staff-initial">${name[0]}</span>`; /* 사진이 없는 직원은 이름 첫 글자 */
                return `
          <button class="staff-item${name === chosen ? " is-selected" : ""
                    }" type="button" data-staff="${name}" role="radio" aria-checked="${name === chosen
                    }">
            ${photo}
            <span class="staff-text"><strong>${name}</strong><span>${rooms}</span></span>
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
            if (chosen !== room.staff) {
                room.staff = chosen;
                room.staffTag = ""; /* 조퇴 표시는 이전 직원 기준이라 지워요 */
                if (room.status === "reassign")
                    room.status = "todo"; /* 재배정 완료 → 청소 필요 */
            }
            return true;
        };
    }

    pop.addEventListener("click", (e) => {
        if (e.target.closest("[data-pop-close]")) closePopover();
        if (e.target.closest("[data-pop-save]")) {
            if (save()) {
                closePopover();
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

    document.body.appendChild(pop);
    initTimePicker(pop);
    placePopover();
}

/* 시간 선택 목록 동작: 클릭 / 위·아래 방향키로 고르고, 열릴 때 선택된 값이 가운데 오게 스크롤해요 */
function initTimePicker(root) {
    const tp = $(".tp", root);
    if (!tp) return;
    const input = $("input[type=hidden]", tp);
    const text = $(".tp-text", tp);
    const cols = {};
    tp.querySelectorAll(".tp-col").forEach((c) => (cols[c.dataset.col] = c));
    const sel = (key) => $(".tp-item.is-selected", cols[key]).dataset.v;
    const sync = () => {
        const h = +sel("h") % 12;
        const h24 = sel("ap") === "PM" ? h + 12 : h;
        input.value = `${pad(h24)}:${pad(+sel("m"))}`;
        text.textContent = input.value;
        input.classList.remove("is-error");
    };
    const pick = (btn, focus) => {
        const col = btn.parentElement;
        col.querySelectorAll(".tp-item").forEach((b) => {
            const on = b === btn;
            b.classList.toggle("is-selected", on);
            b.setAttribute("aria-selected", String(on));
            b.tabIndex = on ? 0 : -1;
        });
        col.scrollTop = btn.offsetTop - (col.clientHeight - btn.offsetHeight) / 2;
        if (focus) btn.focus();
        sync();
    };
    tp.addEventListener("click", (e) => {
        const b = e.target.closest(".tp-item");
        if (b) pick(b, false);
    });
    tp.addEventListener("keydown", (e) => {
        const b = e.target.closest(".tp-item");
        if (!b || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
        e.preventDefault();
        const n = e.key === "ArrowDown" ? b.nextElementSibling : b.previousElementSibling;
        if (n) pick(n, true);
    });
    Object.values(cols).forEach((c) => {
        const b = $(".tp-item.is-selected", c);
        c.scrollTop = b.offsetTop - (c.clientHeight - b.offsetHeight) / 2;
    });
}

/* ==========================================================
   필터 드롭다운 (체크박스 다중 선택)
   - 행 40px, 목록은 360px 에서 멈추고 스크롤
   - 항목이 SEARCH_MIN 개를 넘으면 상단에 검색 입력창 표시
   - 하단 공용 버튼은 이 드롭다운에서는 사용하지 않음
   ========================================================== */
const SEARCH_MIN = 20;
const FILTER_DEFS = {
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
/* 처음에는 모든 항목이 체크된 상태(= 전체) */
Object.keys(FILTER_DEFS).forEach((k) =>
    FILTER_DEFS[k].options().forEach((o) => filters[k].add(o.value))
);
/* 체크 표시: resource/iconcheck-white.svg (보라 배경 위 흰색 체크) */
const CHECK_SVG = icon("check-white", 16);

let fmenu = null,
    fmenuBtn = null,
    fmenuKind = null;

function updateFilterButtons() {
    document.querySelectorAll(".select[data-filter]").forEach((btn) => {
        const kind = btn.dataset.filter,
            def = FILTER_DEFS[kind];
        const all = def.options();
        const picked = all.filter((o) => filters[kind].has(o.value));
        let text = def.base; /* 전체 체크 = 기본 문구 */
        if (picked.length === 0) text = "선택 없음";
        else if (picked.length < all.length)
            text =
                picked[0].label + (picked.length > 1 ? ` 외 ${picked.length - 1}` : "");
        btn.querySelector(".select-label").textContent = text;
        btn.classList.toggle("is-active", picked.length < all.length);
    });
}

function closeFilterMenu() {
    if (fmenuBtn) fmenuBtn.setAttribute("aria-expanded", "false");
    if (fmenu) fmenu.remove();
    fmenu = fmenuBtn = fmenuKind = null;
}

function placeFilterMenu() {
    if (!fmenu || !fmenuBtn) return;
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
    /* 각 메뉴가 연결할 페이지/기능은 아직 없어서 지금은 누르면 메뉴만 닫혀요 */
    fmenu.addEventListener("click", (e) => {
        if (e.target.closest("[data-menu]")) closeFilterMenu();
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
            ? `<label class="filter-search">${icon(
                "search",
                16
            )}<input type="text" placeholder="검색" /></label>`
            : ""
        }
    <ul class="filter-list" role="listbox" aria-multiselectable="true"></ul>`;
    document.body.appendChild(fmenu);

    const list = fmenu.querySelector(".filter-list");
    let keyword = "";
    const ALL = "__all";
    const isAll = () => options.every((o) => filters[kind].has(o.value));
    const draw = () => {
        const kw = keyword.trim().toLowerCase();
        const shown = options.filter((o) => o.label.toLowerCase().includes(kw));
        /* "전체" 는 맨 위에 항상 (검색 중에는 숨김) — 전부 체크돼 있을 때만 체크 */
        const rows = (kw ? [] : [{ value: ALL, label: "전체" }]).concat(shown);
        list.innerHTML = rows.length
            ? rows
                .map((o) => {
                    const on = o.value === ALL ? isAll() : filters[kind].has(o.value);
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

    list.addEventListener("click", (e) => {
        const li = e.target.closest(".filter-item");
        if (!li) return;
        const set = filters[kind],
            v = li.dataset.value;
        if (v === ALL) {
            /* 전체 체크 → 전부 해제 / 하나라도 비어 있으면 → 전부 체크 */
            const all = isAll();
            options.forEach((o) => (all ? set.delete(o.value) : set.add(o.value)));
        } else {
            set.has(v) ? set.delete(v) : set.add(v);
        }
        draw();
        updateFilterButtons();
        renderFloors();
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
    const pbtn = e.target.closest("#profileBtn");
    if (pbtn) {
        openProfileMenu(pbtn);
        return;
    }
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

    if (e.target.closest("[data-close]")) {
        selectedNo = null;
        closePopover();
        renderFloors();
        renderDetail();
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

$("#roomSearch").addEventListener("input", (e) => {
    query = e.target.value;
    renderFloors();
});

/* 검색·필터 줄이 화면 위에 붙었는지(is-stuck) 알려줘요.
   붙기 전: 필터 상자 바로 아래에 층 제목이 이어져요(간격 0) / 붙은 뒤: 아래로 20px 더 흰 배경을 깔아 스크롤되는 타일을 가려요 */
function updateToolbarStuck() {
    const bar = $(".toolbar");
    const stickyTop = parseFloat(getComputedStyle(bar).top) || 0;
    bar.classList.toggle("is-stuck", bar.getBoundingClientRect().top <= stickyTop + 0.5);
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

/* 서버 데이터를 화면에 반영해요. changed = 바뀐 객실 번호 목록 (없으면 전체 비교) */
function applyLive(changed) {
    const sel = selectedNo && ROOMS.find((x) => x.no === selectedNo && !x.empty);
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

/* 필터가 '전체' 상태였다면, 새로 생긴 층·상태도 자동으로 포함 */
function keepAllFilters(update) {
    const wasAll = {};
    Object.keys(FILTER_DEFS).forEach(
        (k) =>
        (wasAll[k] = FILTER_DEFS[k]
            .options()
            .every((o) => filters[k].has(o.value)))
    );
    update();
    Object.keys(FILTER_DEFS).forEach((k) => {
        if (wasAll[k])
            FILTER_DEFS[k].options().forEach((o) => filters[k].add(o.value));
    });
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
       type : issue(특이사항) / reassign(재배정 필요) / todo(청소 필요) / review(검수 요청) / notice(시스템 공지)
       actions 의 room 이 있으면 그 객실을 선택해서 보여줘요 (없으면 읽음 처리만 해요 → 서버 연결 시 처리 동작을 넣으세요)
       읽음 상태를 서버에 저장하려면 markRead() 안의 주석 위치에서 요청을 보내세요
   ========================================================== */
const NOTI_TYPES = {
    issue: { tab: "특이사항", icon: "exclamation-triangle-orange" },
    reassign: { tab: "직원 관리", icon: "user-red" },
    todo: { tab: "청소 현황", icon: "soap-gray" },
    review: { tab: "청소 현황", icon: "check-blue" },
    notice: { tab: "시스템 공지", icon: "notice-purple" },
};
const NOTI_TABS = ["전체", "청소 현황", "직원 관리", "특이사항", "시스템 공지"];

let NOTIFICATIONS = [
    {
        id: 1,
        type: "issue",
        title: "이민지 · 특이사항 등록",
        date: "11월 15일 11:41",
        text: "드라이기 바람이 약해요.\n교체해야 할 것 같아요.",
        actions: [{ label: "자세히 보기" }, { label: "직접 처리하기" }],
        read: false,
    },
    {
        id: 2,
        type: "reassign",
        title: "201호 · 재배정 필요",
        date: "11월 15일 11:41",
        text: "청소 담당자가 조퇴했어요.\n담당자 재배정이 필요해요.",
        actions: [{ label: "현황 확인", room: "201" }],
        read: true,
    },
    {
        id: 3,
        type: "todo",
        title: "104호 · 청소 필요",
        date: "11월 15일 11:41",
        text: "청소가 아직 시작되지 않았어요.\n예정 시간보다 1시간 지났어요.",
        actions: [{ label: "현황 확인", room: "104" }],
        read: true,
    },
    {
        id: 4,
        type: "review",
        title: "306호 · 검수 요청",
        date: "11월 15일 11:41",
        text: "306호 청소가 끝났어요.\n검수가 필요해요.",
        actions: [{ label: "결과 검수", room: "306" }],
        read: true,
    },
    {
        id: 5,
        type: "notice",
        title: "시스템 공지",
        date: "11월 15일 11:41",
        text: "[서비스 정기 점검 안내] 안정적인 서비스 제공을 위해 정기 점검이 예정되어 있습니다. 점검 시간 동안 일부 기능 이용이 제한될 수 있습니다.",
        actions: [],
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
      <article class="noti-item">
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
    const items = NOTIFICATIONS.filter((n) => inTab(n, notiTab));
    list.innerHTML = items.length
        ? items.map(notiItem).join("")
        : `<p class="noti-empty">알림이 없어요.</p>`;
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
        }, true
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
    $("#notiPanel").hidden = true;
    $("#bellBtn").setAttribute("aria-expanded", "false");
    markRead(seen);
    notiTab = "전체";
}

/* 알림의 '현황 확인' 같은 버튼: 해당 객실을 선택해서 보여줘요 */
function showRoom(no) {
    const room = ROOMS.find((x) => x.no === no && !x.empty);
    if (!room) return;
    selectRoom(no);
    if (!$(`.room-card[data-room="${no}"]`)) {
        /* 검색·필터에 가려져 있으면 풀어서 보여줘요 */
        query = "";
        $("#roomSearch").value = "";
        Object.keys(FILTER_DEFS).forEach((k) =>
            FILTER_DEFS[k].options().forEach((o) => filters[k].add(o.value))
        );
        updateFilterButtons();
        renderFloors();
    }
    const card = $(`.room-card[data-room="${no}"]`);
    if (card) card.scrollIntoView({ block: "center", behavior: "smooth" });
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
        if (act && act.room) {
            closeNoti();
            showRoom(act.room);
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

/* 탭을 바꾸기 전에 현재 탭의 입·퇴실 시간을 임시 보관해요 */
const hmDraft = JSON.parse(JSON.stringify(HOURS));

function hmShowTab(tab) {
    hmTab = tab;
    hm.querySelectorAll("[data-hm-tab]").forEach((b) =>
        b.setAttribute("aria-selected", String(b.dataset.hmTab === tab))
    );
    $("#hmIn").value = hmDraft[tab].in;
    $("#hmOut").value = hmDraft[tab].out;
    hm.querySelectorAll(".is-error").forEach((el) => el.classList.remove("is-error"));
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
    hmShowTab("weekday");
    $("#hmCleanOut").value = HOURS.cleanOut;
    $("#hmCleanIn").value = HOURS.cleanIn;
    $("#hmExtend").value = HOURS.extend;
    $("#hmDayUse").value = HOURS.dayUse;
    hm.hidden = false;
    setTimeout(() => $("#hmIn").focus(), 50); /* 나타나는 전환이 시작된 뒤에 포커스 */
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
    if (!i || !o) return (i ? $("#hmOut") : $("#hmIn")).focus();
    const bad = nums.indexOf(false);
    if (bad > -1) return $("#" + ["hmCleanOut", "hmCleanIn", "hmExtend", "hmDayUse"][bad]).focus();
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
    if (e.target === hm || e.target.closest("[data-hm-close]")) return closeHours();
    const tab = e.target.closest("[data-hm-tab]");
    if (tab && tab.dataset.hmTab !== hmTab) {
        hmKeepTab();
        hmShowTab(tab.dataset.hmTab);
    }
});
$("#hmSave").addEventListener("click", saveHours);

/* 시간 칸: 숫자만 입력하면 HH:MM 으로 자동 정리 / 숫자 칸: 숫자만 */
["#hmIn", "#hmOut"].forEach((sel) => {
    const el = $(sel);
    el.addEventListener("input", () => {
        const n = el.value.replace(/\D/g, "").slice(0, 4);
        el.value = n.length > 2 ? `${n.slice(0, 2)}:${n.slice(2)}` : n;
        el.classList.remove("is-error");
    });
    el.addEventListener("blur", () => {
        const t = normTime(el.value);
        if (t) el.value = t;
    });
});
["#hmCleanOut", "#hmCleanIn", "#hmExtend", "#hmDayUse"].forEach((sel) => {
    const el = $(sel);
    el.addEventListener("input", () => {
        el.value = el.value.replace(/\D/g, "");
        el.classList.remove("is-error");
    });
});
hm.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("input")) saveHours();
    /* 모달 밖으로 포커스가 빠져나가지 않게 Tab 을 가둬요 */
    if (e.key === "Tab") {
        const f = [...hm.querySelectorAll("button, input")].filter((x) => !x.disabled);
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