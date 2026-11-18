/* ==========================================================
   청소 결과 화면 (result.html / index.js 뒤에 불러와요)
   - 날짜별 결과 목록 / 상태 칩 필터 / 호실 검색 / 객실 유형 필터
   - 행 클릭 → 우측 패널 (검수 이력 · 인증사진 · 체크리스트 · 메모 · 특이사항)
   - 재청소 요청 / 검수 완료 (서버 연결 전에는 이 화면 안에서만 바뀌어요)
   ========================================================== */
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const fmtHeadDate = (dt) =>
    `${dt.getFullYear()}. ${pad(dt.getMonth() + 1)}. ${pad(dt.getDate())}. (${WEEKDAYS[dt.getDay()]})`;
const fmtStamp = (dt, t) =>
    `${dt.getFullYear()}. ${pad(dt.getMonth() + 1)}. ${pad(dt.getDate())}(${WEEKDAYS[dt.getDay()]}) ${t}`;
const nowHHMM = () => {
    const n = new Date();
    return `${pad(n.getHours())}:${pad(n.getMinutes())}`;
};

/* 결과 상태 → 배지 (실시간 현황과 같은 .badge 컴포넌트). 청소 완료는 확인 전 = 초록 / 확인 후 = 회색(비활성) */
const resultBadge = (r) =>
    r.status === "review"
        ? { cls: "badge-review", label: "검수 대기" }
        : r.status === "reclean"
            ? { cls: "badge-reassign", label: "재청소 요청" }
            : r.confirmed
                ? { cls: "badge-todo", label: "청소 완료" }
                : { cls: "badge-done", label: "청소 완료" };

/* 샘플 데이터 (2026. 11. 10 기준 / 실제 서비스에서는 서버 데이터로 교체)
   at: 청소 완료(또는 재검수 요청) 시각 / first: 처음 청소 완료 시각 / hist: [시각, 제목, 설명]
   memo: 직원이 전달한 메모 / notes: [며칠 전, 시각, 작성자, 내용] */
const RESULT_BASE_DATE = new Date(2026, 10, 10);
const RESULT_BASE = [
    {
        no: "101", type: "스탠다드", staff: "최하석", status: "review", at: "16:10", first: "15:25", resub: true,
        hist: [
            ["15:25", "최초 청소 완료"],
            ["15:40", "재청소 요청", "요청사유: 침구 정리가 잘 안된것 같습니다. 다시 해주세요."],
            ["16:10", "직원 재검수 요청", "전달된 메모: 꼼꼼하게 다시 재청소 했습니다!"],
        ],
        memo: ["16:10", "꼼꼼하게 다시 재청소 했습니다!"],
        notes: [[0, "15:40", "한다경", "드라이기 바람이 약해요. 교체해야 할 것 같아요."], [-2, "14:20", "전재연", "진상 손님이 바닥을 박살내고 갔어요ㅠ"]],
    },
    { no: "102", type: "스탠다드", staff: "유가은", status: "done", at: "16:40", hist: [["16:40", "최초 청소 완료"]] },
    { no: "105", type: "스탠다드", staff: "이서영", status: "done", at: "16:40", hist: [["16:40", "최초 청소 완료"]] },
    {
        no: "203", type: "스탠다드", staff: "한다경", status: "review", at: "16:40", first: "15:25", resub: true,
        hist: [
            ["15:25", "최초 청소 완료"],
            ["15:55", "재청소 요청", "요청사유: 바닥 청소가 필요합니다."],
            ["16:40", "직원 재검수 요청", "전달된 메모: 바닥까지 다시 닦았어요."],
        ],
        memo: ["16:40", "바닥까지 다시 닦았어요."],
    },
    { no: "207", type: "스탠다드", staff: "이서영", status: "review", at: "16:55", hist: [["16:55", "최초 청소 완료"]] },
    { no: "305", type: "디럭스", staff: "유가은", status: "review", at: "17:10", hist: [["17:10", "최초 청소 완료"]] },
    {
        no: "403", type: "프리미엄", staff: "최하석", status: "reclean", at: "16:30", first: "16:30",
        hist: [["16:30", "최초 청소 완료"], ["17:00", "재청소 요청", "요청사유: 환기가 필요합니다."]],
        req: ["환기"], msg: "환기가 필요합니다.",
    },
    {
        no: "408", type: "디럭스", staff: "송혜원", status: "reclean", at: "16:40", first: "16:40",
        hist: [["16:40", "최초 청소 완료"], ["17:05", "재청소 요청", "요청사유: 욕실 물기 제거가 필요합니다."]],
        req: ["욕실 물기 제거"], msg: "욕실 물기 제거가 필요합니다.",
    },
    { no: "409", type: "디럭스", staff: "전재연", status: "done", confirmed: true, at: "16:40", hist: [["16:40", "최초 청소 완료"], ["17:20", "검수 완료"]] },
    { no: "504", type: "프리미엄", staff: "김이레", status: "done", confirmed: true, at: "16:40", hist: [["16:40", "최초 청소 완료"], ["17:20", "검수 완료"]] },
];
const clone = (o) => JSON.parse(JSON.stringify(o));
const dayKey = (dt) => `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
const resultCache = {};

/* 날짜별 목록: 11.10 은 시안 그대로 / 그보다 이전은 전부 확인 완료 / 이후(오늘까지)는 일부 객실 / 미래는 없음 */
function resultRows(date) {
    const key = dayKey(date);
    if (resultCache[key]) return resultCache[key];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let rows;
    if (date.getTime() === RESULT_BASE_DATE.getTime()) rows = clone(RESULT_BASE);
    else if (date > today) rows = [];
    else {
        rows = clone(RESULT_BASE).filter((_, i) => (i + date.getDate()) % 3 !== 0);
        if (date < RESULT_BASE_DATE)
            rows = rows.map((r) => ({
                no: r.no, type: r.type, staff: r.staff, status: "done", confirmed: true, at: r.at,
                hist: [[r.at, "최초 청소 완료"], ["17:20", "검수 완료"]],
            }));
        else rows.forEach((r) => (r.notes = null));
    }
    return (resultCache[key] = rows);
}

/* 처음 열면 오늘 날짜로 보여줘요 (달력도 오늘이 선택된 상태로 열려요) */
let rsDate = (() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
})();
let rsSelected = null; /* 선택한 객실 호수 */
let rsChip = "all";
let rsQuery = "";
const currentRows = () => resultRows(rsDate);
/* 검수 대기 · 청소 완료 상태에서 재청소를 요청할 수 있어요 (재청소 요청 상태는 체크한 항목을 읽기만 해요) */
const isEditable = (r) => r.status === "review" || r.status === "done";

const STAFF_AVATAR = (name) => {
    const photo = STAFF_PHOTO[name]
        ? `<img class="rs-avatar-photo" src="${STAFF_PHOTO[name]}" alt="" onerror="this.remove()" />`
        : "";
    return `<span class="rs-avatar"><img class="rs-avatar-ph" src="${ICON("user-purple")}" alt="" />${photo}</span>`;
};

const RS_CHIPS = [
    ["all", "전체"],
    ["done", "청소 완료"],
    ["review", "검수 대기"],
    ["reclean", "재청소 요청"],
];

function renderResults() {
    $("#rsDateText").textContent = fmtHeadDate(rsDate);
    const q = rsQuery.trim();
    const base = currentRows().filter(
        (r) => (!q || r.no.includes(q)) && filterPass("rtype", r.type)
    );
    const count = (k) => (k === "all" ? base.length : base.filter((r) => r.status === k).length);
    $("#rsChips").innerHTML = RS_CHIPS.map(
        ([k, label]) =>
            `<button class="rs-chip${rsChip === k ? " is-active" : ""}" type="button" role="tab" aria-selected="${rsChip === k}" data-rs-chip="${k}">${label} ${count(k)}</button>`
    ).join("");

    const shown = base.filter((r) => rsChip === "all" || r.status === rsChip);
    const head = `
    <div class="rs-tr rs-th" role="row">
      <div class="rs-td">객실 정보</div><div class="rs-td">청소 담당자</div><div class="rs-td">청소 완료일</div>
      <div class="rs-td is-center">상태</div>
    </div>`;
    const rowsHtml = shown
        .map((r) => {
            const b = resultBadge(r);
            const strike = r.resub && r.first ? `<p class="rs-strike">${fmtStamp(rsDate, r.first)}</p>` : "";
            return `
    <div class="rs-tr${r.confirmed ? " is-confirmed" : ""}${r.no === rsSelected ? " is-active" : ""}" role="row" data-rs-row="${r.no}">
      <div class="rs-td rs-room"><strong>${r.no}호</strong><span>${r.type}</span></div>
      <div class="rs-td rs-staff">${STAFF_AVATAR(r.staff)}<span>${r.staff}</span></div>
      <div class="rs-td rs-when"><p>${fmtStamp(rsDate, r.at)}</p>${strike}</div>
      <div class="rs-td is-center"><span class="badge rs-badge ${b.cls}">${b.label}</span></div>
    </div>`;
        })
        .join("");
    /* 표 머리글은 위쪽 고정 영역(.rs-sticky)에, 목록만 스크롤돼요 */
    $("#rsHead").innerHTML = head;
    $("#rsTable").innerHTML = rowsHtml || `<p class="floor-empty">조건에 맞는 청소 결과가 없어요.</p>`;
}

/* ---------- 우측 상세 패널 ---------- */
const CHECK_ITEMS = ["침구 정리", "욕실 물기 제거", "비품 보충", "바닥 청소", "환기"];
const PHOTO_GROUPS = [
    { name: "침구 정리 상태", desc: "침대 전체와 베개가 보이도록 촬영해 주세요.", n: 2, fresh: 1 },
    { name: "욕실 청소 상태", desc: "세면대와 변기, 바닥 상태가 보이도록 촬영해 주세요.", n: 4, fresh: 2 },
];

const rsPhoto = (r, gi, i) => ({
    src: ATTACHMENTS[(gi * 2 + i) % ATTACHMENTS.length],
    fresh: !!(r.resub && i < PHOTO_GROUPS[gi].fresh),
});

function renderResultDetail() {
    const box = $("#rsDetail");
    const r = currentRows().find((x) => x.no === rsSelected);
    box.classList.toggle("is-empty", !r);
    if (!r) {
        box.innerHTML = `
      <div class="rs-d-head"><h2>청소 결과 상세</h2></div>
      <div class="rs-d-empty">
        <img class="rs-d-icon" src="${ICON("search-color")}" alt="" />
        <div class="rs-d-text">
          <strong>청소 결과를 확인할 객실을 선택해 주세요.</strong>
          <span>객실을 선택하면 청소 사진과 체크리스트를 확인할 수 있어요.</span>
        </div>
      </div>`;
        fitRsDetail();
        return;
    }

    const b = resultBadge(r);
    const arrow = `<img class="rs-arrow" src="${ICON("arrow-up")}" alt="" />`;
    const acc = (title, body) => `
      <section class="rs-acc">
        <button class="rs-acc-top" type="button" data-rs-acc aria-expanded="true"><span>${title}</span>${arrow}</button>
        <div class="rs-acc-body">${body}</div>
      </section>`;
    const item = (stamp, main, sub) => `
      <div class="rs-item">
        <p class="rs-item-when">${stamp}</p>
        <div class="rs-item-tg"><strong>${main}</strong>${sub ? `<span>${sub}</span>` : ""}</div>
      </div>`;

    const history = acc(
        "청소 검수 이력",
        `<div class="rs-items">${r.hist.map(([t, title, note]) => item(fmtStamp(rsDate, t), title, note)).join("")}</div>`
    );

    const photos = acc(
        "인증사진",
        PHOTO_GROUPS.map(
            (g, gi) => `
        <div class="rs-photo-group">
          <div class="rs-photo-tit"><strong>${g.name}</strong><span>${g.desc}</span></div>
          <div class="rs-photo-list">${Array.from({ length: g.n }, (_, i) => `
            <button class="rs-photo" type="button" data-rs-photo="${gi}:${i}" aria-label="${g.name} ${i + 1}번 사진 크게 보기"><img src="${rsPhoto(r, gi, i).src}" alt="" onerror="this.style.visibility='hidden'" />${rsPhoto(r, gi, i).fresh ? `<span class="badge badge-pr500 rs-new">NEW</span>` : ""}</button>`).join("")}
          </div>
        </div>`
        ).join("")
    );

    const editable = isEditable(r);
    const checklist =
        editable || r.status === "reclean"
            ? acc(
                "청소 체크리스트",
                `<div class="rs-checks">
            <p class="rs-hint">${editable ? "재청소를 요청할 내용을 체크해 주세요." : "재청소를 요청한 내용이에요."}</p>
            <div class="rs-check-list">${CHECK_ITEMS.map((c) => {
                    const on = !editable && (r.req || []).includes(c);
                    return `<button class="rs-check-item${on ? " is-checked" : ""}" type="button" role="checkbox" aria-checked="${on}" data-rs-check${editable ? "" : " disabled"}>
                <span class="rs-box">${icon("check-white", 20)}</span><span>${c}</span></button>`;
                }).join("")}</div>
          </div>
          <div class="rs-textarea">
            <label for="rsMsg">${editable ? "직원에게 전달할 내용" : "직원에게 전달한 내용"}</label>
            <textarea id="rsMsg" placeholder="직원에게 요청할 내용을 작성해 주세요."${editable ? "" : " readonly"}>${editable ? "" : r.msg || ""}</textarea>
          </div>`
            )
            : "";

    const memo = r.memo ? acc("전달된 메모", `<div class="rs-items">${item(fmtStamp(rsDate, r.memo[0]), r.memo[1])}</div>`) : "";
    const notes = r.notes && r.notes.length
        ? acc(
            "특이사항",
            `<div class="rs-items">${r.notes.map(([off, t, name, text]) => {
                const dt = new Date(rsDate.getFullYear(), rsDate.getMonth(), rsDate.getDate() + off);
                return item(fmtStamp(dt, t), name, text);
            }).join("")}</div>`
        )
        : "";

    /* 하단 버튼: 검수 대기 = 재청소 요청 + 검수 완료 / 청소 완료 = 재청소 요청 / 재청소 요청 = 요청 취소 + 검수 완료 */
    const foot =
        r.status === "reclean"
            ? `<div class="rs-d-foot">
      <button class="btn btn-lg btn-outline" type="button" data-rs-cancel>재청소 요청 취소</button>
      <button class="btn btn-lg btn-primary" type="button" data-rs-confirm>검수 완료</button>
    </div>`
            : r.status === "review"
                ? `<div class="rs-d-foot">
      <button class="btn btn-lg btn-outline" type="button" data-rs-reclean>재청소 요청</button>
      <button class="btn btn-lg btn-primary" type="button" data-rs-confirm>검수 완료</button>
    </div>`
                : `<div class="rs-d-foot is-single">
      <button class="btn btn-lg btn-primary" type="button" data-rs-reclean>재청소 요청</button>
    </div>`;

    box.innerHTML = `
    <div class="rs-d-head">
      <h2>청소 결과 상세</h2>
      <button class="rs-x" type="button" data-rs-close aria-label="닫기"><img class="i20" src="${ICON("close")}" alt="" /></button>
    </div>
    <div class="rs-d-body">
      <div class="rs-d-in">
        <div class="rs-d-room"><span class="rs-d-no">${r.no}호</span><span class="badge ${b.cls}">${b.label}</span></div>
        <div class="rs-acc-list">${history}${photos}${checklist}${memo}${notes}</div>
      </div>
    </div>
    ${foot}`;
    fitRsDetail();
}

/* 상세 패널은 화면 맨 아래(여백 20px)까지 채우고, 스크롤하면 헤더 아래(120px)에 붙어요 */
function fitRsDetail() {
    const cell = $(".rs-cell");
    const panel = $("#rsDetail");
    if (!cell) return;
    const top = Math.max(120, cell.getBoundingClientRect().top);
    panel.style.height = Math.max(480, window.innerHeight - top - 20) + "px";
}

/* 선택한 줄이 바뀌면(다른 줄로 옮기거나 닫으면) 이전에 보던 청소 완료(초록) 결과는 확인한 것으로 보고 회색으로 바꿔요 */
function moveRsSelection(next) {
    const prev = currentRows().find((x) => x.no === rsSelected);
    if (prev && prev.no !== next && prev.status === "done" && !prev.confirmed) prev.confirmed = true;
    rsSelected = next;
}

/* 상세 패널을 닫으면 청소 완료(초록) 결과는 확인한 것으로 보고 회색으로 바꿔요 */
function closeRsDetail() {
    moveRsSelection(null);
    renderResults();
    renderResultDetail();
}

function handleResultsClick(e) {
    const dateBtn = e.target.closest("#rsDate");
    if (dateBtn) {
        const same = pop && popAnchor === dateBtn;
        closePopover();
        closeFilterMenu();
        dateBtn.setAttribute("aria-expanded", String(!same));
        if (!same) openPopover("resultDate", dateBtn);
        return true;
    }
    const chip = e.target.closest("[data-rs-chip]");
    if (chip) {
        rsChip = chip.dataset.rsChip;
        renderResults();
        return true;
    }
    /* 가로줄 어디를 눌러도 오른쪽에 상세가 열려요 */
    const row = e.target.closest("[data-rs-row]");
    if (row) {
        moveRsSelection(row.dataset.rsRow);
        renderResults();
        renderResultDetail();
        return true;
    }
    if (e.target.closest("[data-rs-close]")) {
        closeRsDetail();
        return true;
    }
    const acc = e.target.closest("[data-rs-acc]");
    if (acc) {
        const sec = acc.closest(".rs-acc");
        const closed = sec.classList.toggle("is-closed");
        acc.setAttribute("aria-expanded", String(!closed));
        return true;
    }
    const chk = e.target.closest("[data-rs-check]");
    if (chk && !chk.disabled) {
        const on = chk.getAttribute("aria-checked") !== "true";
        chk.setAttribute("aria-checked", String(on));
        chk.classList.toggle("is-checked", on);
        return true;
    }
    const r = currentRows().find((x) => x.no === rsSelected);
    if (r && e.target.closest("[data-rs-confirm]")) {
        r.confirmed = true;
        r.status = "done";
        r.hist.push([nowHHMM(), "검수 완료"]);
        renderResults();
        renderResultDetail();
        return true;
    }
    if (r && e.target.closest("[data-rs-reclean]")) {
        const req = [...document.querySelectorAll("#rsDetail .rs-check-item.is-checked")].map((x) => x.textContent.trim());
        const msg = ($("#rsMsg")?.value || "").trim();
        r.prev = { status: r.status, confirmed: !!r.confirmed };
        r.status = "reclean";
        r.confirmed = false;
        r.req = req;
        r.msg = msg || (req.length ? `${req.join(", ")} 재청소 요청` : "재청소 요청");
        r.first = r.first || r.at;
        r.hist.push([nowHHMM(), "재청소 요청", `요청사유: ${r.msg}`]);
        renderResults();
        renderResultDetail();
        openRsModal("requested");
        return true;
    }
    if (r && e.target.closest("[data-rs-cancel]")) {
        openRsModal("cancelAsk");
        return true;
    }
    const photo = e.target.closest("[data-rs-photo]");
    if (r && photo) {
        const [gi, i] = photo.dataset.rsPhoto.split(":").map(Number);
        openRsViewer(r, gi, i);
        return true;
    }
    return false;
}

/* ---------- 모달 (딤드 + 가운데) : 재청소 요청 완료 / 요청 취소 확인 / 취소 완료 / 인증사진 크게 보기 ---------- */
const rsModalEl = document.createElement("div");
rsModalEl.className = "hm";
rsModalEl.id = "rsModal";
rsModalEl.hidden = true;
document.body.appendChild(rsModalEl);

function closeRsModal() {
    rsModalEl.hidden = true;
    rsModalEl.innerHTML = "";
}

function openRsModal(kind) {
    const ok = kind === "cancelAsk";
    const danger = ok;
    const title =
        kind === "requested" ? "재청소 요청이 완료되었습니다."
            : kind === "cancelAsk" ? "재청소 요청을 취소하시겠습니까?"
                : "재청소 요청이 취소되었습니다.";
    const sub = kind === "requested" ? "재청소가 시작되기 전까지 요청을 취소할 수 있습니다." : "";
    rsModalEl.innerHTML = `
    <div class="hm-box rs-cm" role="alertdialog" aria-modal="true" aria-label="${title}">
      <div class="rs-cm-body">
        <span class="rs-cm-ic${danger ? " is-danger" : ""}"><img src="${ICON(danger ? "exclamation-red" : "check-purple")}" alt="" /></span>
        <div class="rs-cm-tx"><strong>${title}</strong>${sub ? `<span>${sub}</span>` : ""}</div>
      </div>
      <div class="rs-cm-btns">
        ${ok ? `<button class="btn btn-lg btn-outline" type="button" data-rs-m="close">닫기</button>` : ""}
        <button class="btn btn-lg btn-primary" type="button" data-rs-m="${ok ? "cancel-ok" : "close"}">확인</button>
      </div>
    </div>`;
    rsModalEl.hidden = false;
    rsModalEl.querySelector(".btn-primary").focus();
}

/* 인증사진 뷰어: 큰 사진을 좌우로 끌면(드래그) 끈 방향의 다음 사진으로 넘어가요.
   아래 작은 사진들은 지금 보는 사진만 선명하고 나머지는 흐려요 (눌러서 바꾸는 게 아니라 위치 표시예요) */
let rsView = null;
function openRsViewer(r, gi, i) {
    const g = PHOTO_GROUPS[gi];
    rsView = { photos: Array.from({ length: g.n }, (_, k) => rsPhoto(r, gi, k)), i, dx: 0 };
    rsModalEl.innerHTML = `
    <div class="hm-box rs-vw" role="dialog" aria-modal="true" aria-label="인증사진">
      <div class="hm-head">
        <h2 class="hm-title">인증사진</h2>
        <button class="hm-close" type="button" data-rs-m="close" aria-label="닫기"><img class="i20" src="${ICON("close")}" alt="" /></button>
      </div>
      <div class="rs-vw-body">
        <div class="rs-vw-main" id="rsVwMain" aria-roledescription="carousel" aria-label="좌우로 끌어서 다음 사진 보기">
          <div class="rs-vw-track" id="rsVwTrack">${rsView.photos.map((p, k) => `
            <div class="rs-vw-slide" role="group" aria-label="${k + 1} / ${rsView.photos.length}"><img src="${p.src}" alt="" draggable="false" onerror="this.style.visibility='hidden'" /></div>`).join("")}
          </div>
          <div class="rs-vw-nav">
            <button class="rs-vw-btn" type="button" data-rs-step="-1" aria-label="이전 사진"><img class="i20" src="${ICON("arrow-left")}" alt="" /></button>
            <button class="rs-vw-btn" type="button" data-rs-step="1" aria-label="다음 사진"><img class="i20" src="${ICON("arrow-right")}" alt="" /></button>
          </div>
        </div>
        <div class="rs-vw-list" id="rsVwList" aria-hidden="true">${rsView.photos.map((p) => `
          <div class="rs-vw-th"><img src="${p.src}" alt="" draggable="false" onerror="this.style.visibility='hidden'" />${p.fresh ? `<span class="badge badge-pr500 rs-new">NEW</span>` : ""}</div>`).join("")}
        </div>
      </div>
    </div>`;
    rsModalEl.hidden = false;
    paintRsViewer(false);
}

/* 지금 사진으로 이동 (animate=false 면 바로) + 작은 사진 선명도 갱신 */
function paintRsViewer(animate = true) {
    const track = $("#rsVwTrack");
    if (!track || !rsView) return;
    track.classList.toggle("is-dragging", !animate);
    track.style.transform = `translateX(calc(${-rsView.i * 100}% + ${rsView.dx}px))`;
    const ths = [...rsModalEl.querySelectorAll(".rs-vw-th")];
    ths.forEach((t, k) => t.classList.toggle("is-on", k === rsView.i));
    /* 처음/마지막 사진에서는 더 갈 수 없는 쪽 버튼을 흐리게 */
    const prev = rsModalEl.querySelector('[data-rs-step="-1"]'), next = rsModalEl.querySelector('[data-rs-step="1"]');
    if (prev) prev.disabled = rsView.i === 0;
    if (next) next.disabled = rsView.i === rsView.photos.length - 1;
    /* 작은 사진이 많아 넘치면, 지금 사진이 보이도록 목록을 옮겨 줘요 */
    const list = $("#rsVwList"), cur = ths[rsView.i];
    if (list && cur) list.scrollTo({ left: cur.offsetLeft - (list.clientWidth - cur.offsetWidth) / 2, behavior: animate ? "smooth" : "auto" });
}

function stepRsViewer(d) {
    if (!rsView) return;
    rsView.i = Math.min(Math.max(rsView.i + d, 0), rsView.photos.length - 1);
    rsView.dx = 0;
    paintRsViewer(true);
}

/* 큰 사진 드래그: 사진이 손을 따라 움직이고, 놓을 때 충분히 끌었거나(너비의 15%) 빠르게 튕기면 다음 사진으로 넘어가요 */
rsModalEl.addEventListener("pointerdown", (e) => {
    const main = e.target.closest("#rsVwMain");
    if (!main || !rsView || e.button > 0 || e.target.closest(".rs-vw-nav")) return;
    const x0 = e.clientX, t0 = performance.now();
    const w = main.clientWidth;
    main.setPointerCapture(e.pointerId);
    main.classList.add("is-grabbing");
    const move = (ev) => {
        let dx = ev.clientX - x0;
        const edge = (rsView.i === 0 && dx > 0) || (rsView.i === rsView.photos.length - 1 && dx < 0);
        rsView.dx = edge ? dx * 0.3 : dx; /* 처음/마지막에서는 저항감 */
        paintRsViewer(false);
    };
    const up = (ev) => {
        main.removeEventListener("pointermove", move);
        main.removeEventListener("pointerup", up);
        main.removeEventListener("pointercancel", up);
        main.classList.remove("is-grabbing");
        const dx = ev.clientX - x0;
        const fast = Math.abs(dx) / Math.max(performance.now() - t0, 1) > 0.5 && Math.abs(dx) > 30;
        if (Math.abs(dx) > w * 0.15 || fast) stepRsViewer(dx < 0 ? 1 : -1);
        else {
            rsView.dx = 0;
            paintRsViewer(true);
        }
    };
    main.addEventListener("pointermove", move);
    main.addEventListener("pointerup", up);
    main.addEventListener("pointercancel", up);
});

rsModalEl.addEventListener("click", (e) => {
    if (e.target === rsModalEl) return closeRsModal();
    const step = e.target.closest("[data-rs-step]");
    if (step) {
        stepRsViewer(Number(step.dataset.rsStep));
        return;
    }
    const m = e.target.closest("[data-rs-m]");
    if (!m) return;
    if (m.dataset.rsM === "cancel-ok") {
        const r = currentRows().find((x) => x.no === rsSelected);
        if (r) {
            const pv = r.prev || { status: "done", confirmed: false };
            r.status = pv.status;
            r.confirmed = pv.confirmed;
            r.prev = null;
            r.req = null;
            r.msg = null;
            r.hist.push([nowHHMM(), "재청소 요청 취소"]);
            renderResults();
            renderResultDetail();
        }
        openRsModal("cancelled");
        return;
    }
    closeRsModal();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !rsModalEl.hidden) closeRsModal();
    /* 키보드: 사진이 열려 있으면 ← → 로도 넘겨요 */
    if (!rsModalEl.hidden && $("#rsVwTrack") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) stepRsViewer(e.key === "ArrowRight" ? 1 : -1);
});

/* 알림의 '결과 검수'로 들어오면: 그 날짜로 바꾸고, 검색·필터를 풀고, 그 객실 상세를 열어요 */
function openResultFor(room, date) {
    const [y, m, d] = String(date).split("-").map(Number);
    if (y && m && d) rsDate = new Date(y, m - 1, d);
    rsChip = "all";
    rsQuery = "";
    $("#rsSearch").value = "";
    filters.rtype.clear();
    updateFilterButtons();
    moveRsSelection(currentRows().some((x) => x.no === room) ? room : null);
    renderResults();
    renderResultDetail();
    const row = $(`[data-rs-row="${room}"]`);
    if (row) row.scrollIntoView({ block: "center", behavior: "smooth" });
}

$("#rsSearch").addEventListener("input", (e) => {
    rsQuery = e.target.value;
    renderResults();
});

window.addEventListener("scroll", fitRsDetail, { passive: true });
window.addEventListener("resize", fitRsDetail);
updateFilterButtons();
renderResults();
renderResultDetail();
{
    const q = new URLSearchParams(location.search);
    if (q.get("room")) openResultFor(q.get("room"), q.get("date"));
}