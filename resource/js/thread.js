/* ==========================================================
   업무 특이사항 (thread.html / index.js 뒤에 불러와요)
   - 직원이 남긴 특이사항을 카테고리별 칸으로 보여줘요 (고장/파손 · 청소/위생 · 비품/소모품 · 기타 ...)
   - 상태: 처리 대기 → (처리하기) → 처리 중 → (처리 완료) → 완료
       · 처리 중 카드는 '처리하는 사람' 에게만 처리 취소 / 처리 완료 버튼이 보여요
       · 처리 중이 아닌 사람에게는 버튼 없이 내용만 보여요
   - 날짜 / 호실·내용 검색 / 카테고리 필터 / 상태 칩 / 리스트 설정(카테고리 추가·삭제·순서·이름)
   - 알림센터 '자세히 보기' 로 들어올 수 있어요 (thread.html)
   - 데이터는 지금은 샘플 + localStorage / 서버 연결 시 TH_LOAD · TH_SAVE_* 만 바꾸면 돼요
   ========================================================== */
const clone = (o) => JSON.parse(JSON.stringify(o));
const TH_ME = "이서영"; /* 지금 로그인한 관리자 (처리하는 사람) — 서버 연결 시 로그인 정보로 교체 */
const TH_CATS_KEY = "threadCats";
const TH_STATE_KEY = "threadState";
const TH_MAX_CATS = 10;
const TH_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const TH_STATE = {
    wait: { label: "처리 대기", cls: "badge-info" },
    doing: { label: "처리 중", cls: "badge-todo" },
    done: { label: "완료", cls: "badge-todo" },
};
const TH_CHIPS = [
    ["wait", "대기"],
    ["doing", "처리 중"],
    ["done", "처리 완료"],
];

/* ---------- 데이터 (서버 연결 시 교체) ---------- */
const TH_CATS_DEFAULT = [
    { id: "broken", name: "고장/파손" },
    { id: "clean", name: "청소/위생" },
    { id: "supply", name: "비품/소모품" },
    { id: "etc", name: "기타" },
];
let TH_CATS = clone(TH_CATS_DEFAULT);
try {
    const saved = JSON.parse(localStorage.getItem(TH_CATS_KEY));
    if (Array.isArray(saved) && saved.length) TH_CATS = saved;
} catch (e) { }

/* 특이사항 1건: T(번호, 카테고리, 호실, 시각, 내용, [작성자|담당자, 이름], 사진 수, 상태, 처리자, 며칠 전) */
let thSeq = 0;
const T = (cat, room, time, text, by, photos, state, handler, ago = 0, img = null) => ({
    id: ++thSeq, cat, room, time, text, by, photos, state, handler: handler || null, img,
    date: dayAdd(todayMid(), -ago),
});
const TH_ITEMS = [
    /* 처리 대기 14 */
    T("broken", "303", "15:42", "샤워기를 온수 쪽으로 돌려도 찬물만 나와요.\n다음 입실 전 점검 부탁드립니다.", ["작성자", "이서영"], 0, "wait"),
    T("broken", "105", addMinutes(cleanDoneAt("105"), -5), "현관 천장등이 계속 깜빡여요.\n전등 교체 부탁드립니다.", ["담당자", "이서영"], 1, "wait"),
    T("broken", "104", "17:03", "에어컨을 켜면 표시등이 깜빡이고 곧 멈춰요. 시설 점검 부탁드립니다.", ["작성자", "이서영"], 1, "wait"),
    T("broken", "105", addMinutes(cleanDoneAt("105"), -5), "암막 커튼 레일 한쪽이 천장에서 빠져 처져 있어요. 다음 입실 전에 레일 고정 부탁드립니다.", ["담당자", "이서영"], 1, "wait"),
    T("broken", "107", addMinutes(cleanDoneAt("107"), -5), "욕실 환풍기 스위치를 켜도 작동하지 않아요.\n물기가 잘 마르지 않으니 시설 점검 부탁드립니다.", ["담당자", "유가은"], 1, "wait", null, 0, FIXED_PHOTOS[107][1][0]),
    T("broken", "303", "15:42", "침대 왼쪽 콘센트에 꽂으면 전원이 들어오지 않아요.\n콘센트 점검 부탁드립니다.", ["작성자", "한다경"], 0, "wait"),
    T("broken", "303", "15:42", "욕실 환풍기 스위치를 켜도 작동하지 않아요.\n시설 점검 부탁드립니다.", ["작성자", "최하석"], 0, "wait"),
    T("broken", "104", "17:03", "현관 전신거울 오른쪽 아래가 깨져 금이 갔어요....", ["작성자", "김이레"], 1, "wait"),
    T("broken", "303", "15:42", "책상 의자에 앉으면 다리 한쪽이 흔들려요.\n다음 입실 전 수리 부탁드립니다.", ["작성자", "유가은"], 0, "wait"),
    T("clean", "204", "16:42", "시트를 걷어보니 매트리스에 얼룩이 남아 있어요....", ["담당자", "유가은"], 3, "wait"),
    T("clean", "403", "16:42", "세면대 배수구 주변에 물때가 남아 있어요.\n재청소 부탁드립니다.", ["담당자", "유가은"], 0, "wait"),
    T("supply", "204", "16:47", "빗 파손이요.\n교체 부탁드립니다.", ["담당자", "이서영"], 1, "wait"),
    T("supply", "102", "16:47", "드라이기 선이 끊어지려해요.\n교체해야 할 것 같아요.", ["담당자", "이서영"], 4, "wait"),
    T("supply", "303", "15:42", "빗 파손이요.\n교체 부탁드립니다.", ["작성자", "이서영"], 0, "wait"),
    T("etc", "502", "17:03", "객실 안에서 벽을 타고 웅웅거리는 소리가 반복돼요.\n소음이 어디서 나는지 확인 부탁드립니다.", ["작성자", "한다경"], 0, "wait"),
    /* 처리 중 7 (다른 사람이 처리하는 중이라 버튼 없이 보여요) */
    T("broken", "303", "15:42", "샤워기 수압이 약하고 물이 한쪽으로만 나와요....", ["작성자", "이서영"], 3, "doing", "유가은"),
    T("broken", "105", "13:57", "현관 천장등이 금 간거 같아요.\n전등 교체 부탁드립니다.", ["담당자", "이서영"], 4, "doing", "한다경"),
    T("clean", "206", "16:42", "욕실 세면대에 물때가 남아 있어요. 재청소 요청했습니다.", ["담당자", "유가은"], 0, "doing", "최하석"),
    T("supply", "204", "16:47", "객실 수건이 2장만 비치되어 있어요.\n추가 비치 부탁드립니다.", ["담당자", "이서영"], 2, "doing", "김이레"),
    T("supply", "102", "16:47", "화장실 휴지걸이가 흔들려요.\n고정이 필요할 것 같아요.", ["담당자", "이서영"], 4, "doing", "유가은"),
    T("supply", "303", "15:42", "객실에 비치할 샴푸 재고가 부족해요.\n추가 보충 요청했습니다.", ["작성자", "이서영"], 0, "doing", "한다경"),
    T("etc", "502", "17:03", "객실 안에서 벽을 타고 웅웅거리는 소리가 반복돼요....", ["작성자", "한다경"], 1, "doing", "최하석"),
    /* 처리 완료 2 */
    T("broken", "303", "15:42", "샤워기 수압이 약해요.", ["작성자", "이서영"], 2, "done", "유가은"),
    T("broken", "105", "13:57", "현관 천장등 군데 군데가 불이 안들어와요.", ["담당자", "이서영"], 5, "done", "한다경"),
    /* 어제 */
    T("clean", "207", "14:20", "욕실 거울에 얼룩이 심해요.\n다음 청소 때 닦아 주세요.", ["담당자", "한다경"], 1, "done", "이서영", 1),
    T("supply", "305", "11:05", "타월이 2장 부족해요.\n추가 보충 부탁드립니다.", ["작성자", "유가은"], 0, "wait", null, 1),
    T("etc", "408", "16:30", "복도 쪽 소음이 심하다는 손님 의견이 있었어요.", ["작성자", "최하석"], 0, "doing", "전재연", 1),
    /* 지난 특이사항 (객실별 '특이사항 내역'에 쌓여 있는 기록 / 모두 처리 완료) */
    T("broken", "303", "14:10", "욕실 문 손잡이가 헐거워서 덜컹거려요.\n나사 조임 부탁드립니다.", ["작성자", "한다경"], 1, "done", "유가은", 6),
    T("clean", "303", "11:25", "침대 헤드 뒤쪽에 먼지가 쌓여 있어요.", ["작성자", "최하석"], 0, "done", "이서영", 13),
    T("supply", "303", "16:05", "객실 슬리퍼가 한 켤레 부족해요.\n추가 비치 부탁드립니다.", ["작성자", "이서영"], 0, "done", "유가은", 13),
    T("broken", "303", "13:40", "TV 리모컨이 반응하지 않아요. 건전지 교체 부탁드립니다.", ["작성자", "유가은"], 0, "done", "한다경", 29),
    T("etc", "303", "15:20", "객실 창문 틈으로 바람 소리가 들려요.", ["작성자", "김이레"], 1, "done", "유가은", 410),
    T("broken", "105", "12:30", "욕실 샤워 커튼 고리가 부러졌어요.\n교체 부탁드립니다.", ["담당자", "이서영"], 1, "done", "한다경", 9),
    T("clean", "105", "15:50", "창틀에 먼지가 남아 있어요.", ["담당자", "이서영"], 0, "done", "최하석", 21),
    T("supply", "204", "13:15", "일회용 칫솔이 부족해요.\n추가 보충 부탁드립니다.", ["담당자", "이서영"], 0, "done", "김이레", 7),
    T("broken", "204", "10:50", "옷장 문 경첩이 빠졌어요.", ["작성자", "유가은"], 1, "done", "한다경", 18),
    T("clean", "206", "14:45", "욕실 배수구에서 냄새가 올라와요.", ["담당자", "유가은"], 0, "done", "최하석", 11),
    T("supply", "102", "15:35", "물컵이 한 개 깨져 있어요.\n교체 부탁드립니다.", ["담당자", "이서영"], 0, "done", "유가은", 5),
];
/* 처리 완료 시각 (샘플은 등록 50분 뒤로 해 둬요 / 처리 완료를 누르면 그 순간의 시각이 기록돼요) */
TH_ITEMS.forEach((i) => {
    if (i.state !== "done") return;
    const [h, m] = i.time.split(":").map(Number);
    i.doneAt = new Date(Math.min(new Date(i.date.getFullYear(), i.date.getMonth(), i.date.getDate(), h, m + 50), Date.now()));
});
/* 처리 상태 변경은 이 브라우저에 보관해요 (서버 연결 시 서버 값으로 교체) */
try {
    const st = JSON.parse(localStorage.getItem(TH_STATE_KEY)) || {};
    TH_ITEMS.forEach((i) => {
        const v = st[i.id];
        if (v) {
            i.state = v.state;
            i.handler = v.handler;
            i.carry = !!v.carry;
            if (v.doneAt) i.doneAt = new Date(v.doneAt);
            else if (v.state !== "done") i.doneAt = null;
        }
    });
} catch (e) { }
/* 이월: 어제까지 처리가 끝나지 않은 특이사항은 자정이 지나는 순간 오늘 목록으로 넘어와요 (처리 완료로 바꿔도 오늘 목록에 남아요) */
function thRollover() {
    const today = todayMid();
    let moved = false;
    TH_ITEMS.forEach((i) => {
        if (i.state !== "done" && i.date < today && !i.carry) {
            i.carry = true;
            moved = true;
        }
    });
    return moved;
}
thRollover();
function thSaveState() {
    const st = {};
    TH_ITEMS.forEach((i) => (st[i.id] = { state: i.state, handler: i.handler, carry: !!i.carry, doneAt: i.doneAt ? +i.doneAt : null }));
    try {
        localStorage.setItem(TH_STATE_KEY, JSON.stringify(st));
    } catch (e) { }
    /* TODO: 서버 연결 시 여기서 처리 상태를 전송 */
}

/* ---------- 상태 ---------- */
let tdDate = todayMid(); /* 보고 있는 날짜 (처음에는 오늘) */
let thChip = "wait";
let thQuery = "";
const thSameDay = (a, b) => a.getTime() === b.getTime();
/* 그 날 목록에 올라오는지: 작성한 날 + (오늘 목록에는) 이월된 것 */
const thOnDay = (i, day) => thSameDay(i.date, day) || (i.carry && thSameDay(day, todayMid()));
const thHeadDate = (dt) => `${dt.getFullYear()}. ${pad(dt.getMonth() + 1)}. ${pad(dt.getDate())}. (${TH_DAYS[dt.getDay()]})`;
const thStamp = (i) => `${pad(i.date.getMonth() + 1)}.${pad(i.date.getDate())} (${TH_DAYS[i.date.getDay()]}) ${i.time}`;
const thEsc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- 카드 ---------- */
/* 처리 대기 = 처리하기 / 내가 처리 중 = 처리 취소 · 처리 완료 / 다른 사람이 처리 중 = 내용만 / 완료 = 처리자까지 */
function thCard(i) {
    const st = TH_STATE[i.state];
    const mine = i.state === "doing" && i.handler === TH_ME;
    const users = [i.by];
    if (mine || i.state === "done") users.push(["처리자", i.handler]);
    const img = i.photos
        ? `<div class="th-img"><img src="${i.img || ATTACHMENTS[i.id % ATTACHMENTS.length]}" alt="" onerror="this.style.visibility='hidden'" />${i.photos > 1 ? `<span class="th-img-more">+${i.photos - 1}</span>` : ""}</div>`
        : "";
    const btns =
        i.state === "wait"
            ? `<div class="th-btns"><button class="btn btn-md btn-primary" type="button" data-th-act="take">처리하기</button></div>`
            : mine
                ? `<div class="th-btns">
          <button class="btn btn-md btn-outline" type="button" data-th-act="cancel">처리 취소</button>
          <button class="btn btn-md btn-primary" type="button" data-th-act="finish">처리 완료</button>
        </div>`
                : "";
    return `
    <article class="th-card" data-th-id="${i.id}">
      <div class="th-card-body">
        <div class="th-card-tit">
          <div class="th-card-room"><strong>${i.room}호</strong><span class="badge ${st.cls}">${st.label}</span></div>
          <span class="th-card-time">${i.carry && thSameDay(tdDate, todayMid()) && !thSameDay(i.date, tdDate) ? `<span class="tag">이월</span> ` : ""}${thStamp(i)}</span>
        </div>
        <div class="th-card-cont">
          ${img}
          <div class="th-card-txt">
            <p class="th-msg">${thEsc(i.text)}</p>
            <div class="th-user">${users.map(([k, v]) => `<p>${k}: ${thEsc(v)}</p>`).join("")}</div>
          </div>
        </div>
      </div>
      ${btns}
    </article>`;
}

/* ---------- 목록 그리기 ---------- */
function thVisibleCats() {
    return TH_CATS.filter((c) => filters.tcat.size === 0 || filters.tcat.has(c.id));
}
function renderThread() {
    $("#thDateText").textContent = thHeadDate(tdDate);
    const q = thQuery.trim();
    const cats = thVisibleCats();
    const ids = new Set(cats.map((c) => c.id));
    const base = TH_ITEMS.filter(
        (i) => thOnDay(i, tdDate) && ids.has(i.cat) && (!q || i.room.includes(q) || i.text.includes(q))
    );
    $("#thChips").innerHTML = TH_CHIPS.map(
        ([k, label]) =>
            `<button class="rs-chip${thChip === k ? " is-active" : ""}" type="button" role="tab" aria-selected="${thChip === k}" data-th-chip="${k}">${label} ${base.filter((i) => i.state === k).length}</button>`
    ).join("");

    const wide = cats.length === 1; /* 카테고리를 하나만 고르면 한 칸을 넓게 쓰고 카드를 여러 줄로 보여줘요 */
    $("#thBoard").innerHTML = cats
        .map((c) => {
            const list = base.filter((i) => i.cat === c.id && i.state === thChip);
            return `
      <section class="th-col${wide ? " is-wide" : ""}" aria-label="${thEsc(c.name)}">
        <h2 class="th-col-tit"><span>${thEsc(c.name)}</span><span>${list.length}</span></h2>
        <div class="th-list">${list.map(thCard).join("")}</div>
      </section>`;
        })
        .join("");
}

/* ---------- 리스트 설정 모달 (딤드 + 가운데) ---------- */
const thModalEl = document.createElement("div");
thModalEl.className = "hm";
thModalEl.id = "thModal";
thModalEl.hidden = true;
document.body.appendChild(thModalEl);
let thDraft = []; /* 모달에서 고치는 중인 목록 { id, name } */
let thTrigger = null;

function closeThModal() {
    thModalEl.hidden = true;
    thModalEl.innerHTML = "";
    if (thTrigger) thTrigger.focus();
}

function thSetRow(c) {
    return `
    <div class="th-set-item" data-th-row="${c.id}">
      <button class="th-set-handle" type="button" aria-label="${thEsc(c.name || "새 항목")} 순서 바꾸기" data-th-handle>${icon("handle", 20)}</button>
      <label class="th-set-input">
        <input type="text" value="${thEsc(c.name)}" maxlength="12" autocomplete="off" aria-label="리스트 이름" />
        <button class="th-set-del" type="button" aria-label="삭제" data-th-del>${icon("trash", 20)}</button>
      </label>
    </div>`;
}
function thSyncSetCount() {
    const n = thModalEl.querySelectorAll("[data-th-row]").length;
    $("#thSetCount").textContent = `총 ${n}개`;
    $("#thSetAdd").disabled = n >= TH_MAX_CATS;
    thModalEl.querySelectorAll("[data-th-del]").forEach((b) => (b.disabled = n <= 1));
}
function openThModal(trigger) {
    thTrigger = trigger || null;
    thDraft = clone(TH_CATS);
    thModalEl.innerHTML = `
    <div class="hm-box th-set" role="dialog" aria-modal="true" aria-labelledby="thSetTitle">
      <div class="hm-head">
        <h2 class="hm-title" id="thSetTitle">리스트 설정</h2>
        <button class="hm-close" type="button" data-th-m="close" aria-label="닫기">${icon("close", 20)}</button>
      </div>
      <div class="th-set-body">
        <div class="th-set-top"><strong>리스트</strong><span id="thSetCount"></span></div>
        <div class="th-set-list" id="thSetList">${thDraft.map(thSetRow).join("")}</div>
        <button class="btn btn-md btn-outline th-set-add" id="thSetAdd" type="button" data-th-m="add">${icon("plus", 20)}추가하기</button>
      </div>
      <div class="hm-foot">
        <button class="btn btn-lg btn-outline" type="button" data-th-m="close">닫기</button>
        <button class="btn btn-lg btn-primary" type="button" data-th-m="save">저장</button>
      </div>
    </div>`;
    thModalEl.hidden = false;
    thSyncSetCount();
    thModalEl.querySelector(".th-set-input input").focus();
}

/* 입력칸에 적은 이름을 draft 에 옮겨요 (행 순서 = 화면에 보이는 순서) */
function thReadRows() {
    const rows = [...thModalEl.querySelectorAll("[data-th-row]")];
    thDraft = rows.map((r) => ({ id: r.dataset.thRow, name: r.querySelector("input").value.trim() }));
}
function thSaveList() {
    thReadRows();
    const seen = new Set();
    let bad = null;
    thModalEl.querySelectorAll("[data-th-row]").forEach((r, i) => {
        const n = thDraft[i].name;
        const err = !n || seen.has(n);
        seen.add(n);
        r.querySelector(".th-set-input").classList.toggle("is-error", err);
        if (err && !bad) bad = r.querySelector("input");
    });
    if (bad) return bad.focus();
    /* 삭제한 카테고리의 특이사항은 '기타'(없으면 마지막 카테고리)로 옮겨서 사라지지 않게 해요 */
    const keep = new Set(thDraft.map((c) => c.id));
    const fallback = (thDraft.find((c) => c.name === "기타") || thDraft[thDraft.length - 1]).id;
    TH_ITEMS.forEach((i) => {
        if (!keep.has(i.cat)) i.cat = fallback;
    });
    TH_CATS = thDraft;
    filters.tcat.forEach((v) => !keep.has(v) && filters.tcat.delete(v));
    try {
        localStorage.setItem(TH_CATS_KEY, JSON.stringify(TH_CATS));
        localStorage.setItem("threadCatMap", JSON.stringify(TH_ITEMS.map((i) => [i.id, i.cat])));
    } catch (e) { }
    /* TODO: 서버 연결 시 여기서 TH_CATS 를 전송 */
    updateFilterButtons();
    renderThread();
    closeThModal();
}

thModalEl.addEventListener("click", (e) => {
    if (e.target === thModalEl) return closeThModal(); /* 딤드를 누르면 닫혀요 */
    const m = e.target.closest("[data-th-m]");
    if (m) {
        const k = m.dataset.thM;
        if (k === "close") closeThModal();
        else if (k === "save") thSaveList();
        else if (k === "add" && thModalEl.querySelectorAll("[data-th-row]").length < TH_MAX_CATS) {
            const c = { id: "c" + Date.now().toString(36), name: "" };
            $("#thSetList").insertAdjacentHTML("beforeend", thSetRow(c));
            thSyncSetCount();
            const list = $("#thSetList");
            list.lastElementChild.querySelector("input").focus();
            list.scrollTop = list.scrollHeight;
        }
        return;
    }
    const del = e.target.closest("[data-th-del]");
    if (del && !del.disabled) {
        del.closest("[data-th-row]").remove();
        thReadRows();
        thSyncSetCount();
    }
});
thModalEl.addEventListener("input", (e) => {
    if (e.target.matches(".th-set-input input")) e.target.closest(".th-set-input").classList.remove("is-error");
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !thModalEl.hidden) closeThModal();
});

/* 손잡이를 끌어서 순서 바꾸기 (끄는 동안에는 화면에서만 옮기고, 놓으면 순서가 정해져요) */
{
    let dragRow = null;
    thModalEl.addEventListener("pointerdown", (e) => {
        const h = e.target.closest("[data-th-handle]");
        if (!h) return;
        dragRow = h.closest("[data-th-row]");
        dragRow.classList.add("is-dragging");
        h.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    thModalEl.addEventListener("pointermove", (e) => {
        if (!dragRow) return;
        const list = $("#thSetList");
        const rows = [...list.querySelectorAll("[data-th-row]")].filter((r) => r !== dragRow);
        const next = rows.find((r) => e.clientY < r.getBoundingClientRect().top + r.offsetHeight / 2);
        if (next) {
            if (dragRow.nextElementSibling !== next) list.insertBefore(dragRow, next);
        } else if (list.lastElementChild !== dragRow) list.appendChild(dragRow);
    });
    const end = () => {
        if (!dragRow) return;
        dragRow.classList.remove("is-dragging");
        dragRow = null;
        thReadRows();
    };
    thModalEl.addEventListener("pointerup", end);
    thModalEl.addEventListener("pointercancel", end);
}


/* 처리하기 / 처리 취소 / 처리 완료 (카드와 특이사항 상세가 같이 써요) */
function thApply(item, k) {
    if (k === "take") {
        item.state = "doing";
        item.handler = TH_ME;
    } else if (k === "cancel") {
        item.state = "wait";
        item.handler = null;
        item.doneAt = null;
    } else if (k === "finish") {
        item.state = "done";
        item.doneAt = new Date(); /* 처리 완료를 누른 순간의 시각 */
    }
    thSaveState();
}

/* ---------- 특이사항 상세 (딤드 + 오른쪽 패널) ---------- */
const TD_STATE = { wait: "처리 대기", doing: "처리 중", done: "처리 완료" };
const tdEl = document.createElement("div");
tdEl.className = "hm th-dp";
tdEl.id = "thDetail";
tdEl.hidden = true;
document.body.appendChild(tdEl);
let tdItem = null; /* 지금 보고 있는 특이사항 */
let tdF = { cat: "all", state: "all" };
let tdPick = null; /* 달력에서 고른 날짜 (그 날 내역으로 스크롤해요) */
let tdYears = new Set(); /* 펼쳐 둔 연도 */
let tdMenu = null; /* 열려 있는 필터 드롭다운 */

const tdImgs = (i, n) => Array.from({ length: n }, (_, k) => (k === 0 && i.img) || ATTACHMENTS[(i.id + k) % ATTACHMENTS.length]);
const tdImgHtml = (i, cls) => (i.photos ? `<div class="td-imgs ${cls}">${tdImgs(i, Math.min(i.photos, 3)).map((src) => `<span class="td-img"><img src="${src}" alt="" onerror="this.style.visibility='hidden'" /></span>`).join("")}</div>` : "");
const tdMini = (st) => `<span class="mini-badge ${st === "wait" ? "is-blue" : "is-dark"}">${TD_STATE[st]}</span>`;
const tdCatName = (id) => (TH_CATS.find((c) => c.id === id) || { name: "기타" }).name;
const tdWhen = (i) => `${pad(i.date.getMonth() + 1)}.${pad(i.date.getDate())} ${i.time}`;

function tdHistory() {
    return TH_ITEMS.filter((x) => x.room === tdItem.room && (tdF.cat === "all" || x.cat === tdF.cat) && (tdF.state === "all" || x.state === tdF.state)).sort(
        (a, b) => b.date - a.date || (a.time < b.time ? 1 : a.time > b.time ? -1 : 0)
    );
}

function tdItemHtml(x, first) {
    const cur = x.id === tdItem.id;
    const users = [`<p>${x.by[0]}: ${thEsc(x.by[1])} (${tdWhen(x)} 등록)</p>`];
    if (x.handler) users.push(`<p>처리자: ${thEsc(x.handler)}${x.state === "done" && x.doneAt ? ` (${pad(x.doneAt.getMonth() + 1)}.${pad(x.doneAt.getDate())} ${pad(x.doneAt.getHours())}:${pad(x.doneAt.getMinutes())} 처리 완료)` : ""}</p>`);
    /* 처리 대기 = 처리하기 / 내가 처리 중 = 처리 취소 · 처리 완료 / 다른 사람이 처리 중 · 완료 = 버튼 없음 */
    const btns =
        x.state === "wait"
            ? `<button class="btn btn-sm btn-primary" type="button" data-td-act="take">처리하기</button>`
            : x.state === "doing" && x.handler === TH_ME
                ? `<button class="btn btn-sm btn-outline" type="button" data-td-act="cancel">처리 취소</button><button class="btn btn-sm btn-primary" type="button" data-td-act="finish">처리 완료</button>`
                : "";
    return `<div class="td-item" data-td-id="${x.id}">
      <span class="td-time">${x.time}</span>
      <span class="td-rail"><i class="${first ? "is-blank" : ""}"></i><b></b><i class="is-line"></i></span>
      <div class="td-sec">
        <div class="td-sec-tit"><strong${cur ? ' class="is-cur"' : ""}>${thEsc(tdCatName(x.cat))}</strong>${tdMini(x.state)}</div>
        <p class="td-msg">${thEsc(x.text)}</p>
        <div class="td-user">${users.join("")}</div>
        ${tdImgHtml(x, "is-sm")}
        ${btns ? `<div class="td-btns">${btns}</div>` : ""}
      </div>
    </div>`;
}

function tdHistoryHtml() {
    const list = tdHistory();
    if (!list.length) return `<p class="floor-empty">조건에 맞는 특이사항이 없어요.</p>`;
    const years = [...new Set(list.map((x) => x.date.getFullYear()))];
    return years
        .map((y) => {
            const open = tdYears.has(y);
            const inYear = list.filter((x) => x.date.getFullYear() === y);
            const dates = [...new Set(inYear.map((x) => x.date.getTime()))];
            return `<div class="td-acc${open ? " is-open" : ""}">
        <button class="td-acc-top" type="button" data-td-year="${y}" aria-expanded="${open}"><span>${y}</span><img class="i32" src="${ICON("arrow-up")}" alt="" /></button>
        <div class="td-acc-body"${open ? "" : " hidden"}>${dates
                    .map((t) => {
                        const d = new Date(t);
                        const day = inYear.filter((x) => x.date.getTime() === t);
                        return `<div class="td-day" data-td-date="${t}"><h4>${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${TH_DAYS[d.getDay()]}) ${day.length}건</h4>
              <div class="td-list">${day.map((x, k) => tdItemHtml(x, k === 0)).join("")}</div></div>`;
                    })
                    .join("")}</div>
      </div>`;
        })
        .join("");
}

const tdSelect = (kind, label, on) =>
    `<div class="td-dd"><button class="select${on ? " is-active" : ""}" type="button" data-td-dd="${kind}" aria-haspopup="listbox" aria-expanded="false"><span class="select-label">${label}</span><img class="i24" src="${ICON("arrow-down")}" alt="" /></button></div>`;

function tdRender(keep) {
    const i = tdItem;
    const users = [`<p>${i.by[0]}: ${thEsc(i.by[1])}</p>`];
    if (i.handler) users.push(`<p>처리자: ${thEsc(i.handler)}</p>`);
    const catLabel = tdF.cat === "all" ? "카테고리 전체" : tdCatName(tdF.cat);
    const stLabel = tdF.state === "all" ? "상태 전체" : TD_STATE[tdF.state];
    const perLabel = tdPick ? `${tdPick.getFullYear()}. ${pad(tdPick.getMonth() + 1)}. ${pad(tdPick.getDate())}.` : "기간 전체";
    tdEl.innerHTML = `
    <aside class="th-dp-box" role="dialog" aria-modal="true" aria-label="${i.room}호 특이사항 상세">
      <div class="td-head"><h2>${i.room}호</h2>
        <button class="hm-close" type="button" data-td-close aria-label="닫기">${icon("close", 20)}</button></div>
      <div class="td-body">
        <section class="td-cur">
          <div class="td-cur-tit"><div><strong>${thEsc(tdCatName(i.cat))}</strong><span class="td-state is-${i.state === "wait" ? "wait" : "etc"}">${TD_STATE[i.state]}</span></div><time>${thStamp(i)}</time></div>
          <p class="td-msg">${thEsc(i.text)}</p>
          <div class="td-user">${users.join("")}</div>
          ${tdImgHtml(i, "is-lg")}
        </section>
        <hr class="td-line" />
        <section class="td-hist">
          <h3>특이사항 내역 <span>(${tdHistory().length}건)</span></h3>
          <div class="td-filters">
            <div class="td-dd"><button class="td-date${tdPick ? " is-active" : ""}" type="button" data-td-date-btn aria-haspopup="dialog" aria-expanded="false">${icon("calender", 20)}<span>${perLabel}</span></button></div>
            <div class="td-filters-r">${tdSelect("cat", catLabel, tdF.cat !== "all")}${tdSelect("state", stLabel, tdF.state !== "all")}</div>
          </div>
          <div class="td-accs">${tdHistoryHtml()}</div>
        </section>
      </div>
      <div class="hm-foot">
        <button class="btn btn-lg btn-outline" type="button" data-td-close>닫기</button>
        <button class="btn btn-lg btn-primary" type="button" data-td-close>저장</button>
      </div>
    </aside>`;
    if (keep != null) tdEl.querySelector(".td-body").scrollTop = keep;
}

function openThDetail(item) {
    tdItem = item;
    tdF = { cat: "all", state: "all" };
    tdPick = null;
    tdYears = new Set([item.date.getFullYear()]);
    tdRender();
    tdEl.hidden = false;
    tdEl.querySelector(".td-body").scrollTop = 0;
}
/* 달력에서 날짜를 고르면 그 날의 내역까지 스크롤해요 (그 날 내역이 없으면 가장 가까운 날로 가요) */
function tdGoDate(d) {
    tdPick = d;
    const dates = [...new Set(tdHistory().map((x) => x.date.getTime()))];
    if (dates.length) {
        const near = dates.reduce((a, b) => (Math.abs(b - +d) < Math.abs(a - +d) ? b : a));
        tdYears.add(new Date(near).getFullYear());
        tdRender(tdEl.querySelector(".td-body").scrollTop);
        const el = tdEl.querySelector(`[data-td-date="${near}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else tdRender(tdEl.querySelector(".td-body").scrollTop);
}
const closeThDetail = () => {
    closePopover();
    closeTdMenu();
    tdEl.hidden = true;
};
function closeTdMenu() {
    if (!tdMenu) return;
    tdMenu.remove();
    tdMenu = null;
    tdEl.querySelectorAll("[data-td-dd]").forEach((b) => b.setAttribute("aria-expanded", "false"));
}
function openTdMenu(btn) {
    const kind = btn.dataset.tdDd;
    const same = tdMenu && tdMenu.dataset.kind === kind;
    closeTdMenu();
    if (same) return;
    const opts = kind === "cat" ? [["all", "카테고리 전체"], ...TH_CATS.map((c) => [c.id, c.name])] : [["all", "상태 전체"], ...Object.entries(TD_STATE)];
    tdMenu = document.createElement("ul");
    tdMenu.className = "td-menu";
    tdMenu.setAttribute("role", "listbox");
    tdMenu.dataset.kind = kind;
    tdMenu.innerHTML = opts.map(([v, l]) => `<li class="filter-item${tdF[kind] === v ? " is-selected" : ""}" role="option" aria-selected="${tdF[kind] === v}" data-td-opt="${v}"><span class="label">${thEsc(l)}</span></li>`).join("");
    btn.parentElement.appendChild(tdMenu);
    btn.setAttribute("aria-expanded", "true");
}

tdEl.addEventListener("click", (e) => {
    if (e.target === tdEl || e.target.closest("[data-td-close]")) return closeThDetail();
    const opt = e.target.closest("[data-td-opt]");
    if (opt) {
        tdF[tdMenu.dataset.kind] = opt.dataset.tdOpt;
        const keep = tdEl.querySelector(".td-body").scrollTop;
        tdMenu = null;
        return tdRender(keep);
    }
    const act = e.target.closest("[data-td-act]");
    if (act) {
        const item = TH_ITEMS.find((x) => String(x.id) === act.closest("[data-td-id]").dataset.tdId);
        if (!item) return;
        thApply(item, act.dataset.tdAct);
        renderThread(); /* 뒤의 업무 특이사항 목록도 같이 바뀌어요 */
        return tdRender(tdEl.querySelector(".td-body").scrollTop);
    }
    const dbtn = e.target.closest("[data-td-date-btn]");
    if (dbtn) {
        e.stopPropagation(); /* 공용 '팝오버 바깥을 누르면 닫기' 가 방금 연 달력을 닫지 않게 해요 */
        closeTdMenu();
        const same = pop && popAnchor === dbtn;
        closePopover();
        if (!same) openPopover("threadHistDate", dbtn);
        return;
    }
    const dd = e.target.closest("[data-td-dd]");
    if (dd) return openTdMenu(dd);
    const yr = e.target.closest("[data-td-year]");
    if (yr) {
        const y = +yr.dataset.tdYear;
        tdYears.has(y) ? tdYears.delete(y) : tdYears.add(y);
        const keep = tdEl.querySelector(".td-body").scrollTop;
        return tdRender(keep);
    }
    if (!e.target.closest(".td-dd")) closeTdMenu();
});
document.addEventListener(
    "keydown",
    (e) => {
        if (e.key !== "Escape" || tdEl.hidden || pop) return; /* 달력이 열려 있으면 달력만 닫아요 (index.js) */
        tdMenu ? closeTdMenu() : closeThDetail();
    },
    true
);

/* ---------- 클릭 처리 (index.js 의 공용 click 이 먼저 불러줘요) ---------- */
function handleThreadClick(e) {
    const dateBtn = e.target.closest("#thDate");
    if (dateBtn) {
        const same = pop && popAnchor === dateBtn;
        closePopover();
        closeFilterMenu();
        dateBtn.setAttribute("aria-expanded", String(!same));
        if (!same) openPopover("threadDate", dateBtn);
        return true;
    }
    const chip = e.target.closest("[data-th-chip]");
    if (chip) {
        thChip = chip.dataset.thChip;
        renderThread();
        return true;
    }
    if (e.target.closest("#thSettings")) {
        closePopover();
        closeFilterMenu();
        openThModal(e.target.closest("#thSettings"));
        return true;
    }
    const act = e.target.closest("[data-th-act]");
    if (act) {
        const item = TH_ITEMS.find((x) => String(x.id) === act.closest("[data-th-id]").dataset.thId);
        if (!item) return true;
        const k = act.dataset.thAct;
        thApply(item, k);
        renderThread();
        return true;
    }
    /* 카드를 누르면 그 호실의 특이사항 상세가 오른쪽에서 열려요 (카드 안 버튼은 제외) */
    const card = e.target.closest(".th-card");
    if (card && !e.target.closest("button")) {
        const item = TH_ITEMS.find((x) => String(x.id) === card.dataset.thId);
        if (item) openThDetail(item);
        return true;
    }
    return false;
}

$("#thSearch").addEventListener("input", (e) => {
    thQuery = e.target.value;
    renderThread();
});

/* 저장해 둔 카테고리 이동(삭제한 카테고리의 특이사항)을 반영해요 */
try {
    (JSON.parse(localStorage.getItem("threadCatMap")) || []).forEach(([id, cat]) => {
        const i = TH_ITEMS.find((x) => x.id === id);
        if (i && TH_CATS.some((c) => c.id === cat)) i.cat = cat;
    });
} catch (e) { }

/* 알림센터 '자세히 보기'로 들어오면 대기 칩부터 보여줘요 (?date=YYYY-MM-DD 가 있으면 그 날짜) */
{
    const q = new URLSearchParams(location.search);
    const [y, m, d] = String(q.get("date") || "").split("-").map(Number);
    if (y && m && d) tdDate = new Date(y, m - 1, d);
}
updateFilterButtons();
renderThread();


/* 자정이 지나면 (화면을 켜 둔 채로도) 어제 못 끝낸 특이사항이 오늘로 넘어와요 */
function thScheduleMidnight() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    setTimeout(() => {
        const wasToday = thSameDay(tdDate, dayAdd(todayMid(), -1));
        if (wasToday) tdDate = todayMid();
        thRollover();
        thSaveState();
        renderThread();
        thScheduleMidnight();
    }, next - now);
}
thScheduleMidnight();