/* ==========================================================
   청소 결과 화면 (result.html / index.js 뒤에 불러와요)
   - 날짜별 결과 목록 / 상태 칩 필터 / 호실 검색 / 객실 유형 필터
   - 행 클릭 → 우측 패널 (검수 이력 · 인증 사진 · 체크리스트 · 메모 · 조치 필요 내용)
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
        no: "101", type: "스탠다드", staff: "최하석", status: "review", at: "13:10", first: "12:25", resub: true,
        hist: [
            ["12:25", "최초 청소 완료"],
            ["12:40", "재청소 요청", "요청사유: 침구 정리가 잘 안된것 같습니다. 다시 해주세요."],
            ["13:10", "직원 재검수 요청", "전달된 메모: 꼼꼼하게 다시 재청소 했습니다!"],
        ],
        memo: ["13:10", "꼼꼼하게 다시 재청소 했습니다!"],
        notes: [[0, "12:40", "한다경", "드라이기 바람이 약해요. 교체해야 할 것 같아요."], [-2, "11:50", "전재연", "진상 손님이 바닥을 박살내고 갔어요ㅠ"]],
    },
    { no: "102", type: "디럭스", staff: "유가은", status: "done", at: "11:50", hist: [["11:50", "최초 청소 완료"]] },
    { no: "105", type: "디럭스", staff: "이서영", status: "done", at: "12:15", hist: [["12:15", "최초 청소 완료"]] },
    {
        no: "203", type: "프리미엄", staff: "한다경", status: "review", at: "13:40", first: "12:25", resub: true,
        hist: [
            ["12:25", "최초 청소 완료"],
            ["12:55", "재청소 요청", "요청사유: 바닥 청소가 필요합니다."],
            ["13:40", "직원 재검수 요청", "전달된 메모: 바닥까지 다시 닦았어요."],
        ],
        memo: ["13:40", "바닥까지 다시 닦았어요."],
    },
    { no: "207", type: "스탠다드", staff: "이서영", status: "review", at: "12:35", hist: [["12:35", "최초 청소 완료"]] },
    { no: "305", type: "디럭스", staff: "유가은", status: "review", at: "14:10", hist: [["14:10", "최초 청소 완료"]] },
    {
        no: "403", type: "프리미엄", staff: "최하석", status: "reclean", at: "13:30", first: "13:30",
        hist: [["13:30", "최초 청소 완료"], ["14:00", "재청소 요청", "요청사유: 환기가 필요합니다."]],
        req: ["환기"], msg: "환기가 필요합니다.",
    },
    {
        no: "408", type: "스탠다드", staff: "송혜원", status: "reclean", at: "11:50", first: "11:50",
        hist: [["11:50", "최초 청소 완료"], ["12:35", "재청소 요청", "요청사유: 욕실 물기 제거가 필요합니다."]],
        req: ["욕실 물기 제거"], msg: "욕실 물기 제거가 필요합니다.",
    },
    { no: "409", type: "스탠다드", staff: "전재연", status: "done", confirmed: true, at: "11:45", hist: [["11:45", "최초 청소 완료"], ["12:30", "검수 완료"]] },
    { no: "504", type: "프리미엄", staff: "김이레", status: "done", confirmed: true, at: "14:35", hist: [["14:35", "최초 청소 완료"], ["15:10", "검수 완료"]] },
];
const clone = (o) => JSON.parse(JSON.stringify(o));
const dayKey = (dt) => `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
const resultCache = {};

/* 사용성 테스트용으로 내용을 고정한 객실 (오늘 날짜 / 메인 · 업무 특이사항과 같은 이야기로 이어져요)
   - 105호: 문제없이 꼼꼼하게 끝낸 청소
   - 107호: 욕실 환풍기가 고장 나서 욕실 물기가 덜 마른 청소 · 메모 없이 조치 필요 내용만 (인증 사진은 FIXED_PHOTOS 로 고정) */
const RESULT_FIXED = {
    105: {
        start: 10, /* 청소 가능 시각보다 몇 분 뒤에 시작했는지 */
        hist: (s, e) => [[s, "청소 시작"], [e, "최초 청소 완료", "침구 교체 · 욕실 청소 · 비품 보충 · 바닥 청소 · 환기까지 모두 마쳤어요."]],
        memo: "침구는 전부 새것으로 교체했고, 욕실 바닥과 세면대 물기까지 닦았어요. 수건 4장, 생수 2병, 어메니티도 채워 뒀어요.",
        notes: [
            [0, "11:37", "이서영", "현관 천장등이 계속 깜빡여요.\n전등 교체 부탁드립니다."],
            [0, "11:37", "이서영", "암막 커튼 레일 한쪽이 천장에서 빠져 처져 있어요. 다음 입실 전에 레일 고정 부탁드립니다."],
        ],
    },
    107: {
        start: 10,
        hist: (s, e) => [[s, "청소 시작"], [e, "최초 청소 완료"]],
        /* 전달된 메모 없이 조치 필요 내용만 남겨요 */
        notes: [[0, addMinutes(cleanDoneAt("107"), -5), "유가은", "욕실 환풍기 스위치를 켜도 작동하지 않아요.\n물기가 잘 마르지 않으니 시설 점검 부탁드립니다."]],
    },
};

/* 사용성 테스트용: 107호 재청소 요청 뒤 직원이 올린 재검수 내용 (재청소 요청을 누르면 이 내용으로 바뀌어요)
   after: 재청소 요청 뒤 몇 분 만에 재검수를 요청하는지 / memo: 직원이 전달한 메모 (시정한 내용) */
const RESULT_RECLEAN = {
    107: { after: 25, memo: "욕실 바닥과 세면대에 남아 있던 물기를 다시 닦았어요. 환풍기가 작동하지 않아서 창문을 열어 환기도 했어요." },
};

/* 오늘의 결과: 메인의 객실 데이터(청소 완료 · 검수 대기)에서 만들고, 결과 화면에서 바꾼 검수 상태를 덧입혀요 */
function todayResultRows() {
    const saved = loadResultState();
    return ROOMS.filter((r) => !r.empty && (["done", "review"].includes(r.status) || (saved[r.no] && saved[r.no].status === "reclean")))
        .map((r) => {
            const at = addMinutes(r.clean || r.out, 50);
            const row = { no: r.no, type: r.type, staff: r.staff, status: r.status, at, hist: [[at, "최초 청소 완료"]] };
            const fx = RESULT_FIXED[r.no];
            if (fx) {
                row.hist = fx.hist(addMinutes(r.clean || r.out, fx.start), at);
                if (fx.memo) row.memo = [at, fx.memo];
                row.notes = fx.notes.map(([off, , name, text]) => [off, addMinutes(at, -5), name, text]);
            }
            return saved[r.no] ? Object.assign(row, clone(saved[r.no])) : row;
        });
}
/* 결과 화면에서 바꾼 오늘의 검수 상태를 저장해요 (메인 객실 상태와 공유) */
function syncResult(r) {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    if (rsDate.getTime() !== t.getTime()) return;
    saveResultState(r.no, r);
    if (typeof applyResultState === "function") {
        const room = ROOMS.find((x) => x.no === r.no);
        if (room) {
            room.status = r.status === "reclean" ? "todo" : r.status;
            room.reclean = r.status === "reclean";
            room.confirmed = !!r.confirmed && r.status === "done"; /* 확인한 청소 완료는 메인에서도 회색 */
        }
    }
}

/* 날짜별 목록: 11.10 은 시안 그대로 / 그보다 이전은 전부 확인 완료 / 이후(오늘까지)는 일부 객실 / 미래는 없음 */
function resultRows(date) {
    const key = dayKey(date);
    if (resultCache[key]) return resultCache[key];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let rows;
    if (date.getTime() === today.getTime()) rows = todayResultRows();
    else if (date.getTime() === RESULT_BASE_DATE.getTime()) rows = clone(RESULT_BASE);
    else if (date > today) rows = [];
    else {
        rows = clone(RESULT_BASE).filter((_, i) => (i + date.getDate()) % 3 !== 0);
        if (date < RESULT_BASE_DATE)
            rows = rows.map((r) => ({
                no: r.no, type: r.type, staff: r.staff, status: "done", confirmed: true, at: r.at,
                hist: [[r.at, "최초 청소 완료"], [addMinutes(r.at, 40), "검수 완료"]],
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

/* 사진 묶음별 사진 목록
   - 고정 사진이 있는 객실(FIXED_PHOTOS)은 그 장수만큼만 보여줘요. 재검수를 요청하면(r.resub) 새로 올라온 사진(FIXED_PHOTOS_REDO)이 앞에 NEW 로 붙어요.
   - 그 외 객실은 PHOTO_GROUPS 의 장수대로 시안 사진을 돌려 써요. */
const rsFixedList = (r, gi) => {
    const base = FIXED_PHOTOS[r.no] && FIXED_PHOTOS[r.no][gi];
    if (!base) return null;
    const redo = (r.resub && FIXED_PHOTOS_REDO[r.no] && FIXED_PHOTOS_REDO[r.no][gi]) || [];
    return { list: [...redo, ...base], fresh: redo.length };
};
const rsCount = (r, gi) => {
    const f = rsFixedList(r, gi);
    return f ? f.list.length : PHOTO_GROUPS[gi].n;
};
const rsPhoto = (r, gi, i) => {
    const f = rsFixedList(r, gi);
    if (f) return { src: f.list[i], fresh: i < f.fresh };
    return {
        src: RESULT_PHOTOS[gi][i % RESULT_PHOTOS[gi].length],
        fresh: !!(r.resub && i < PHOTO_GROUPS[gi].fresh),
    };
};

/* 검수 대기 객실의 침구 정리 상태: 사진 옆에 영상 (resource/room.mp4) — 눌러서 크게 재생 */
const RS_VIDEO = "resource/room.mp4";
const rsVideoTile = (r) => `
            <button class="rs-photo rs-video" type="button" data-rs-video aria-label="${r.no}호 침구 정리 영상 재생"><video src="${RS_VIDEO}#t=0.1" preload="metadata" muted playsinline tabindex="-1"></video><span class="rs-video-play"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 4.8v10.4a.8.8 0 0 0 1.2.7l8.4-5.2a.8.8 0 0 0 0-1.4L8.2 4.1A.8.8 0 0 0 7 4.8Z" fill="#fff"/></svg></span></button>`;

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
    /* 토글 기본값: 인증 사진 · 체크리스트는 펼침, 검수 이력은 접힘 / 전달된 메모와 조치 필요 내용은 있을 때만 생기고 펼쳐서 보여줘요 */
    const acc = (title, body, open = true) => `
      <section class="rs-acc${open ? "" : " is-closed"}">
        <button class="rs-acc-top" type="button" data-rs-acc aria-expanded="${open}"><span>${title}</span>${arrow}</button>
        <div class="rs-acc-body">${body}</div>
      </section>`;
    const item = (stamp, main, sub) => `
      <div class="rs-item">
        <p class="rs-item-when">${stamp}</p>
        <div class="rs-item-tg"><strong>${main}</strong>${sub ? `<span>${sub}</span>` : ""}</div>
      </div>`;

    const history = acc(
        "청소 검수 이력",
        `<div class="rs-items">${r.hist.map(([t, title, note]) => item(fmtStamp(rsDate, t), title, note)).join("")}</div>`,
        false
    );

    const photos = acc(
        "인증 사진",
        PHOTO_GROUPS.map(
            (g, gi) => `
        <div class="rs-photo-group">
          <div class="rs-photo-tit"><strong>${g.name}</strong><span>${g.desc}</span></div>
          <div class="rs-photo-list">${Array.from({ length: rsCount(r, gi) }, (_, i) => `
            <button class="rs-photo" type="button" data-rs-photo="${gi}:${i}" aria-label="${g.name} ${i + 1}번 사진 크게 보기"><img src="${rsPhoto(r, gi, i).src}" alt="" onerror="this.style.visibility='hidden'" />${rsPhoto(r, gi, i).fresh ? `<span class="badge badge-pr500 rs-new">NEW</span>` : ""}</button>`).join("")}${gi === 0 && r.status === "review" ? rsVideoTile(r) : ""}
          </div>
        </div>`
        ).join("")
    );

    const editable = isEditable(r);
    const checklist =
        editable || r.status === "reclean"
            ? acc(
                editable ? "재청소를 요청할 항목을 선택해 주세요" : "재청소를 요청한 항목",
                `<div class="rs-checks">
            <div class="rs-check-list">${CHECK_ITEMS.map((c) => {
                    const on = !editable && (r.req || []).includes(c);
                    return `<button class="rs-check-item${on ? " is-checked" : ""}" type="button" role="checkbox" aria-checked="${on}" data-rs-check${editable ? "" : " disabled"}>
                <span class="rs-box">${icon("check-white", 20)}</span><span>${c}</span></button>`;
                }).join("")}</div>
          </div>
          ${editable || r.msg
                    ? `<div class="rs-textarea">
            <label for="rsMsg">${editable ? "직원에게 요청할 사항" : "직원에게 요청한 사항"}</label>
            <textarea id="rsMsg" placeholder="직원에게 요청할 내용을 작성해 주세요."${editable ? "" : " readonly"}>${editable ? "" : r.msg || ""}</textarea>
          </div>`
                    : ""}`
            )
            : "";

    /* 전달된 메모가 0건이면 토글 자체를 만들지 않아요 */
    const memo = r.memo && r.memo[1] ? acc("전달된 메모", `<div class="rs-items">${item(fmtStamp(rsDate, r.memo[0]), r.memo[1])}</div>`, true) : "";
    const notes = r.notes && r.notes.length
        ? acc(
            "조치 필요 내용",
            `<div class="rs-items">${r.notes.map(([off, t, name, text]) => {
                const dt = new Date(rsDate.getFullYear(), rsDate.getMonth(), rsDate.getDate() + off);
                return item(fmtStamp(dt, t), name, text);
            }).join("")}</div>`,
            true
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
    rsSyncCta();
}

/* 재청소 요청 CTA 색: 체크리스트에 하나라도 표시하면 '재청소 요청'이 보라색 (메모는 색에 영향이 없어요) / 체크리스트가 모두 비어 있으면 '검수 완료'가 보라색 */
function rsSyncCta() {
    const rc = $("#rsDetail [data-rs-reclean]");
    const cf = $("#rsDetail [data-rs-confirm]");
    if (!rc || !cf) return; /* 두 버튼이 같이 있는 검수 대기 상태에서만 바뀌어요 */
    const touched = !!document.querySelector("#rsDetail .rs-check-item.is-checked");
    rc.classList.toggle("btn-primary", touched);
    rc.classList.toggle("btn-outline", !touched);
    cf.classList.toggle("btn-primary", !touched);
    cf.classList.toggle("btn-outline", touched);
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
    if (prev && prev.no !== next && prev.status === "done" && !prev.confirmed) {
        prev.confirmed = true;
        syncResult(prev);
    }
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
        rsSyncCta();
        return true;
    }
    const r = currentRows().find((x) => x.no === rsSelected);
    if (r && e.target.closest("[data-rs-confirm]")) {
        r.confirmed = true;
        r.status = "done";
        r.hist.push([nowHHMM(), "검수 완료"]);
        syncResult(r);
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
        r.msg = msg; /* 사장이 직접 적은 내용만 남겨요 (안 적었으면 메모는 어디에도 보이지 않아요) */
        r.first = r.first || r.at;
        r.hist.push(msg ? [nowHHMM(), "재청소 요청", `요청사유: ${msg}`] : [nowHHMM(), "재청소 요청"]);
        /* 사용성 테스트용: 107호는 재청소 요청을 하면 직원이 바로 다시 청소해서 재검수를 요청한 모습으로 바뀌어요 */
        const rc = RESULT_RECLEAN[r.no];
        if (rc && !r.redo) {
            r.redo = { at: r.at };
            r.resub = true; /* 새 사진에 NEW 배지 · 처음 청소 완료 시각에 취소선 */
            r.at = addMinutes(nowHHMM(), rc.after);
            r.hist.push([r.at, "직원 재검수 요청", `전달된 메모: ${rc.memo}`]);
            r.memo = [r.at, rc.memo];
            /* 직원이 재청소를 마치고 다시 검수를 요청한 상태 → 체크리스트가 비워진 '검수 대기'예요 (같은 내용으로 다시 재청소를 요청할 수도 있어요) */
            r.status = "review";
        }
        syncResult(r);
        renderResults();
        renderResultDetail();
        openRsModal("requested");
        return true;
    }
    if (r && e.target.closest("[data-rs-cancel]")) {
        openRsModal("cancelAsk");
        return true;
    }
    if (r && e.target.closest("[data-rs-video]")) {
        openRsViewer(r, 0, rsCount(r, 0)); /* 영상은 사진들 뒤에 붙어 있어요 */
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

/* ---------- 모달 (딤드 + 가운데) : 재청소 요청 완료 / 요청 취소 확인 / 취소 완료 / 인증 사진 크게 보기 ---------- */
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

/* 인증 사진 뷰어: 큰 사진을 좌우로 끌면(드래그) 끈 방향의 다음 사진으로 넘어가요.
   아래 작은 사진들은 지금 보는 사진만 선명하고 나머지는 흐려요 (작은 사진을 눌러도 그 사진으로 넘어가요) */
let rsView = null;
function openRsViewer(r, gi, i) {
    const g = PHOTO_GROUPS[gi];
    rsView = { photos: Array.from({ length: rsCount(r, gi) }, (_, k) => rsPhoto(r, gi, k)), i, dx: 0 };
    /* 검수 대기 객실의 인증 영상은 사진 맨 뒤에 같이 넘겨 볼 수 있어요 */
    const hasVideo = gi === 0 && r.status === "review";
    if (hasVideo) rsView.photos.push({ src: RS_VIDEO, video: true });
    rsModalEl.innerHTML = `
    <div class="hm-box rs-vw" role="dialog" aria-modal="true" aria-label="${hasVideo ? "인증 사진 · 영상" : "인증 사진"}">
      <div class="hm-head">
        <h2 class="hm-title">${hasVideo ? "인증 사진 · 영상" : "인증 사진"}</h2>
        <button class="hm-close" type="button" data-rs-m="close" aria-label="닫기"><img class="i20" src="${ICON("close")}" alt="" /></button>
      </div>
      <div class="rs-vw-body">
        <div class="rs-vw-main" id="rsVwMain" aria-roledescription="carousel" aria-label="좌우로 끌어서 다음 사진 보기">
          <div class="rs-vw-track" id="rsVwTrack">${rsView.photos.map((p, k) => `
            <div class="rs-vw-slide${p.video ? " is-video" : ""}" role="group" aria-label="${k + 1} / ${rsView.photos.length}">${p.video ? `<video src="${p.src}" controls playsinline preload="metadata"></video>` : `<img src="${p.src}" alt="" draggable="false" onerror="this.style.visibility='hidden'" />`}</div>`).join("")}
          </div>
          <div class="rs-vw-nav">
            <button class="rs-vw-btn" type="button" data-rs-step="-1" aria-label="이전 사진"><img class="i20" src="${ICON("arrow-left")}" alt="" /></button>
            <button class="rs-vw-btn" type="button" data-rs-step="1" aria-label="다음 사진"><img class="i20" src="${ICON("arrow-right")}" alt="" /></button>
          </div>
        </div>
        <div class="rs-vw-list" id="rsVwList">${rsView.photos.map((p) => `
          <div class="rs-vw-th${p.video ? " is-video" : ""}">${p.video ? `<video src="${p.src}#t=0.1" preload="metadata" muted playsinline tabindex="-1"></video><span class="rs-video-play"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 4.8v10.4a.8.8 0 0 0 1.2.7l8.4-5.2a.8.8 0 0 0 0-1.4L8.2 4.1A.8.8 0 0 0 7 4.8Z" fill="#fff"/></svg></span>` : `<img src="${p.src}" alt="" draggable="false" onerror="this.style.visibility='hidden'" />`}${p.fresh ? `<span class="badge badge-pr500 rs-new">NEW</span>` : ""}</div>`).join("")}
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
    /* 다른 사진으로 넘어가면 재생 중인 영상은 멈춰요 */
    rsModalEl.querySelectorAll(".rs-vw-slide video").forEach((v, n) => {
        if (v.closest(".rs-vw-slide") !== rsModalEl.querySelectorAll(".rs-vw-slide")[rsView.i]) v.pause();
    });
    /* 영상 칸에서는 이전/다음 버튼이 영상 재생 바를 가리지 않게 위쪽으로 올려요 */
    rsModalEl.querySelector("#rsVwMain")?.classList.toggle("is-vid", !!(rsView.photos[rsView.i] || {}).video);
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
    if (!main || !rsView || e.button > 0 || e.target.closest(".rs-vw-nav, video")) return; /* 영상 위에서는 재생 조작을 우선해요 (넘기기는 ‹ › 버튼 · 키보드) */
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
    /* 아래 작은 사진을 누르면 그 사진으로 넘어가요 */
    const th = e.target.closest(".rs-vw-th");
    if (th && rsView) {
        rsView.i = [...rsModalEl.querySelectorAll(".rs-vw-th")].indexOf(th);
        rsView.dx = 0;
        paintRsViewer(true);
        return;
    }
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
            if (r.redo) {
                /* 요청을 취소하면 직원의 재검수 요청도 없던 일이 돼요 */
                r.hist = r.hist.filter((h) => h[1] !== "직원 재검수 요청");
                r.at = r.redo.at;
                r.resub = false;
                r.redo = null;
                r.memo = null;
            }
            r.hist.push([nowHHMM(), "재청소 요청 취소"]);
            syncResult(r);
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