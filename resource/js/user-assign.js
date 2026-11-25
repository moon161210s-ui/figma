/* =========================================================
   직원 배정 (user-assign.html)
   - 객실 데이터는 index.js 의 ROOMS 를 메인 화면과 같이 써요
     ('청소 필요' · '재배정 필요' 객실만 가져와서 보여줘요)
   - 담당자는 오른쪽 위 '변경사항 일괄저장'을 눌러야 반영돼요 (그 전까지는 asChanges 에만 담겨 있어요)
   ========================================================= */

let asDay = "today"; /* today | tomorrow */
let asWorkerQuery = "";
let asRoomQuery = "";
let asChanges = {}; /* { 객실번호: 새 담당자 } — 저장 전 변경사항 */

const AS_ACTIVE = ["todo", "progress", "reassign"]; /* '현재 n실' 로 세는 객실 상태 */
const asDirty = () => Object.keys(asChanges).length + Object.keys(asTomChanges).length > 0;
const asStaffOf = (r) => asChanges[r.no] || r.staff;

/* ---------- 자동 배정 기준 (모달에서 바꾸는 값 / 서버 연결 시 서버 설정으로 교체) ---------- */
const AS_SET_KEY = "assignSettings";
const AS_CRITERIA = {
    time: ["청소 가능 시간 균등분배", "객실 수보다 설정된 청소 가능 시간을 기준으로 고르게 나눕니다."],
    count: ["담당 객실 수를 비슷하게 배정", "직원마다 맡는 객실 수가 비슷하도록 배정합니다."],
    skill: ["숙련도에 맞춰 배정", "설정된 숙련도를 기준으로"],
};
const AS_SET_DEFAULT = { mode: "auto", order: ["time", "count", "skill"], maxMin: 0, apply: "future", keepManual: false };
function asSettings() {
    try {
        const v = JSON.parse(localStorage.getItem(AS_SET_KEY)) || {};
        const order = Array.isArray(v.order) && v.order.length === 3 && v.order.every((k) => k in AS_CRITERIA) ? v.order : AS_SET_DEFAULT.order;
        return { ...AS_SET_DEFAULT, ...v, order };
    } catch (e) {
        return { ...AS_SET_DEFAULT };
    }
}
const asSaveSettings = (v) => {
    try {
        localStorage.setItem(AS_SET_KEY, JSON.stringify(v));
    } catch (e) { }
};

/* ---------- 내일 근무 객실 (시스템이 사전 규칙으로 미리 배정해 둬요) ----------
   ★ 사전 규칙은 나중에 '자동 배정 기준 설정' 모달에서 직접 등록할 예정이라, 지금은 아래 임의 규칙을 써요 (AS_RULES)
   1) 내일 퇴실하는 객실이 내일 청소할 객실이에요 (오늘 새로 입실하는 손님의 퇴실일 / 연박 중인 손님의 퇴실일 기준)
   2) 같은 층은 오늘 그 층을 맡던 직원에게 먼저 맡겨요 (floorAffinity)
   3) 직원별 객실 수는 최대 1실 차이로 고르게 나눠요 (balance)
   - 사용자가 드래그로 바꾼 담당자는 asTomSaved 에 저장되고 자동 배정보다 우선해요 */
const AS_RULES = { floorAffinity: true, balance: true };
const AS_TODAY = todayMid();
const AS_TOMORROW = new Date(AS_TODAY.getFullYear(), AS_TODAY.getMonth(), AS_TODAY.getDate() + 1);
let asTomChanges = {}; /* { 객실번호: 담당자 } — 저장 전 변경사항 (내일) */
let asTomSaved = {}; /* 저장된 변경사항 (내일) / 서버 연결 시 서버 값으로 교체 */
try {
    asTomSaved = JSON.parse(localStorage.getItem("roomAssignTomorrow")) || {};
} catch (e) { }

const asTomRooms = () =>
    ROOMS.filter((r) => {
        const o = !r.empty && outDateNext(r);
        return o && o.getTime() === AS_TOMORROW.getTime();
    });
/* 내일 근무하는 직원만 (휴무인 직원 자리는 다른 직원이 채워요 / 직원 정보 설정에서 휴무일을 바꾸면 바로 반영돼요) */
const asTomWorkers = () => STAFF.filter((n) => staffWorksOn(n, AS_TOMORROW));

function asAutoPlan() {
    const rooms = asTomRooms().sort((a, b) => a.floor - b.floor || Number(a.no) - Number(b.no));
    const workers = asTomWorkers();
    if (!workers.length) return {};
    const cap = AS_RULES.balance ? Math.ceil(rooms.length / workers.length) : Infinity;
    const load = Object.fromEntries(workers.map((n) => [n, 0]));
    /* 오늘 층별로 누가 몇 실을 맡았는지 */
    const hist = {};
    ROOMS.filter((r) => !r.empty && r.staff).forEach((r) => {
        hist[r.floor] = hist[r.floor] || {};
        hist[r.floor][r.staff] = (hist[r.floor][r.staff] || 0) + 1;
    });
    const plan = {};
    rooms.forEach((r) => {
        const open = workers.filter((n) => load[n] < cap);
        const score = (n) => (AS_RULES.floorAffinity ? (hist[r.floor] || {})[n] || 0 : 0);
        const pick = open.slice().sort((a, b) => score(b) - score(a) || load[a] - load[b] || workers.indexOf(a) - workers.indexOf(b))[0];
        plan[r.no] = pick;
        load[pick]++;
    });
    return plan;
}
/* 수동 배정이면 시스템이 미리 배정하지 않아요 (자동 배정 기준 설정 모달에서 바꿔요) */
let AS_PLAN = asSettings().mode === "manual" ? {} : asAutoPlan();
/* 퇴사한 직원에게 미리 저장해 둔 담당자는 무시하고, 남은 직원끼리 새로 자동 배정한 값을 써요 */
const asTomSavedOk = (r) => !!asTomSaved[r.no] && asTomWorkers().includes(asTomSaved[r.no]);
const asTomBase = (r) => (asTomSavedOk(r) ? asTomSaved[r.no] : AS_PLAN[r.no] || "-");
const asTomStaff = (r) => asTomChanges[r.no] || asTomBase(r);
const asTomManual = (r) => !!(asTomChanges[r.no] || asTomSavedOk(r));
/* 재배정 필요 객실은 일괄 저장을 누르기 전까지 '재배정 필요'로 남아요 (담당자를 끌어다 놔도 배지가 안 사라져요) */
const asNeed = (r) => r.status === "reassign";

/* ---------- 오늘 근무자 ---------- */
const asAvatar = (name) => {
    const photo = STAFF_PHOTO[name] ? `<img class="as-avatar-photo" src="${STAFF_PHOTO[name]}" alt="" draggable="false" onerror="this.remove()" />` : "";
    return `<span class="as-avatar"><img class="as-avatar-ph" src="${ICON("user-purple")}" alt="" draggable="false" />${photo}</span>`;
};

function asCount(name) {
    if (asDay === "tomorrow") return asTomRooms().filter((r) => asTomStaff(r) === name).length;
    return ROOMS.filter((r) => inCleanList(r) && AS_ACTIVE.includes(r.status) && asStaffOf(r) === name).length;
}

/* 현재 맡은 객실이 적은 사람이 맨 앞 (같으면 직원 목록 순서) */
function asWorkers() {
    const holds = (n) => ROOMS.some((r) => !r.empty && r.staff === n);
    return (asDay === "tomorrow" ? asTomWorkers() : STAFF.filter((n) => !LEFT_EARLY.has(n) && (staffWorksOn(n, todayMid()) || holds(n))))
        .map((name, i) => ({ name, n: asCount(name), i }))
        .sort((a, b) => a.n - b.n || a.i - b.i);
}

/* 근무자 카드 보조 문구: 청소 중이면 '청소 중 | N분 째', 아니면 '다음청소 | 00시' */
function asStatusLine(name) {
    const mine = ROOMS.filter((r) => !r.empty && asStaffOf(r) === name);
    const busy = asDay === "tomorrow" ? null : mine.find((r) => r.status === "progress");
    if (busy) return ["청소 중", `${busy.cleanMin == null ? 0 : busy.cleanMin}분 째`];
    const next = (asDay === "tomorrow" ? asTomRooms().filter((r) => asTomStaff(r) === name) : mine.filter((r) => inCleanList(r) && (r.status === "todo" || r.status === "reassign")))
        .map((r) => r.clean)
        .filter(Boolean)
        .sort()[0];
    if (!next) return ["다음청소", "-"];
    const [h, m] = next.split(":").map(Number);
    return ["다음청소", `${h}시${m ? ` ${m}분` : ""}`];
}

function renderAssignWorkers() {
    const q = asWorkerQuery.trim();
    const list = asWorkers().filter((w) => !q || w.name.includes(q));
    $("#asWorkers").innerHTML = list.length
        ? list
            .map(
                (w) => `
      <div class="as-user" data-as-user="${w.name}" tabindex="0" aria-label="${w.name}, ${asStatusLine(w.name).join(" ")}. 끌어서 객실에 배정">
        <img class="i24 as-handle" src="${ICON("handle")}" alt="" draggable="false" />
        <div class="as-profile">${asAvatar(w.name)}<div class="as-user-tx"><strong>${w.name}</strong><span class="as-sub">${asStatusLine(w.name).map((t) => `<i>${t}</i>`).join("")}</span></div></div>
      </div>`
            )
            .join("")
        : `<p class="floor-empty">${q ? "검색 결과가 없어요." : asDay === "tomorrow" ? "내일 근무자가 없어요." : "오늘 근무자가 없어요."}</p>`;
}

/* ---------- 배정 가능 객실 ---------- */
function asRooms() {
    const q = asRoomQuery.trim();
    if (asDay === "tomorrow")
        return asTomRooms()
            .filter(() => filterPass("astatus", "assigned"))
            .filter((r) => !q || r.no.includes(q) || asTomStaff(r).includes(q))
            .sort((a, b) => a.floor - b.floor || Number(a.no) - Number(b.no));
    return ROOMS.filter((r) => inCleanList(r) && (r.status === "todo" || r.status === "reassign"))
        .filter((r) => filterPass("astatus", asNeed(r) ? "need" : "assigned"))
        .filter((r) => !q || r.no.includes(q) || asStaffOf(r).includes(q))
        .sort((a, b) => a.floor - b.floor || (asNeed(b) ? 1 : 0) - (asNeed(a) ? 1 : 0) || Number(a.no) - Number(b.no));
}

/* 끌어다 놓은 직원 (저장 전) */
const asDropped = (name) => `
      <div class="as-dropped">
        <img class="i24 as-handle" src="${ICON("handle")}" alt="" draggable="false" />
        <div class="as-profile">${asAvatar(name)}<div class="as-user-tx"><strong>${name}</strong><span class="as-sub">${asStatusLine(name).map((t) => `<i>${t}</i>`).join("")}</span></div></div>
      </div>`;

function asRoomCard(r) {
    const tom = asDay === "tomorrow";
    const need = !tom && asNeed(r);
    const changed = tom ? asTomManual(r) : !need && !!asChanges[r.no];
    const tag = tom
        ? changed ? "" : `<span class="tag">자동 배정</span>`
        : r.staffTag && !changed ? `<span class="tag">${r.staffTag}</span>` : "";
    return `
    <article class="as-room${need ? " is-need" : ""}" data-as-room="${r.no}" aria-label="${r.no}호 ${need ? "재배정 필요" : "배정 완료"}">
      <div class="as-room-top">
        <strong>${r.no}호</strong>
        <span class="badge ${need ? "badge-reassign" : "badge-todo"}">${need ? "재배정 필요" : "배정 완료"}</span>
      </div>
      <p class="as-room-staff"><span>담당</span><b>${tom ? asTomStaff(r) : need ? r.staff : asStaffOf(r)}</b>${tag}</p>
      ${need ? (asChanges[r.no] ? asDropped(asChanges[r.no]) : `<div class="as-drop">담당자를 드래그해 배정</div>`) : ""}
    </article>`;
}

function renderAssignRooms() {
    /* 같은 층 안에서는 재배정 필요 객실이 맨 앞(왼쪽)에 오고, 그 안에서는 호실 순서예요 (asRooms 의 정렬) */
    const list = asRooms();
    const byFloor = {};
    list.forEach((r) => (byFloor[r.floor] = byFloor[r.floor] || []).push(r));
    $("#asRooms").innerHTML = list.length
        ? Object.keys(byFloor)
            .map(
                (f) => `
      <div class="as-floor">
        <h3>${f}F <span>(${byFloor[f].length}실)</span></h3>
        <div class="as-grid">${byFloor[f].map(asRoomCard).join("")}</div>
      </div>`
            )
            .join("")
        : `<p class="floor-empty">${asDay === "tomorrow" ? "내일 배정할 객실이 없어요." : "조건에 맞는 객실이 없어요."}</p>`;
}

function renderAssign() {
    renderAssignWorkers();
    renderAssignRooms();
    $("#asSave").disabled = false; /* 변경사항 일괄저장은 항상 눌러볼 수 있어요 */
}

/* 두 카드(근무자 / 객실 목록)는 화면 아래(여백 20px)까지 채우고, 카드 안의 목록만 스크롤돼요 (좁은 화면에서는 페이지가 스크롤) */
function fitAssign() {
    const body = $("#asBody");
    if (!body) return;
    if (window.innerWidth <= 900) {
        body.style.height = "";
        return;
    }
    const top = body.getBoundingClientRect().top + window.scrollY;
    body.style.height = Math.max(480, window.innerHeight - top - 20) + "px";
}
window.addEventListener("resize", fitAssign);

/* ---------- 드래그로 배정 ---------- */
function assignTo(no, name) {
    const r = ROOMS.find((x) => x.no === no);
    if (!r) return;
    if (asDay === "tomorrow") {
        if (asTomBase(r) === name) delete asTomChanges[no]; /* 원래 담당자로 되돌리면 변경 없음 */
        else asTomChanges[no] = name;
        renderAssign();
        return;
    }
    if (r.status !== "reassign" && r.staff === name) delete asChanges[no]; /* 원래 담당자로 되돌리면 변경 없음 */
    else asChanges[no] = name;
    renderAssign();
}

function startAsDrag(e, card) {
    const name = card.dataset.asUser;
    const x0 = e.clientX, y0 = e.clientY;
    const box = card.getBoundingClientRect();
    const off = { x: x0 - box.left, y: y0 - box.top };
    let ghost = null, over = null, raf = 0, py = y0;
    const list = $("#asRooms");

    /* 끌어서 객실 목록의 위·아래 가장자리에 가면 목록이 알아서 스크롤돼요 */
    const autoScroll = () => {
        const b = list.getBoundingClientRect();
        const edge = 70, max = 18;
        if (py < b.top + edge) list.scrollTop -= Math.ceil((Math.min(edge, b.top + edge - py) / edge) * max);
        else if (py > b.bottom - edge) list.scrollTop += Math.ceil((Math.min(edge, py - (b.bottom - edge)) / edge) * max);
        raf = requestAnimationFrame(autoScroll);
    };

    const setOver = (el) => {
        if (el === over) return;
        over?.classList.remove("is-over");
        over = el;
        over?.classList.add("is-over");
    };

    const move = (ev) => {
        if (!ghost) {
            if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
            /* 프로필 잔상: 카드 모양 그대로 복제해서 포인터를 따라다녀요 */
            ghost = card.cloneNode(true);
            ghost.classList.add("as-ghost");
            ghost.removeAttribute("data-as-user");
            ghost.style.width = box.width + "px";
            document.body.appendChild(ghost);
            card.classList.add("is-dragging");
            document.body.classList.add("as-dragging");
            raf = requestAnimationFrame(autoScroll);
        }
        py = ev.clientY;
        ghost.style.transform = `translate(${ev.clientX - off.x}px, ${ev.clientY - off.y}px)`;
        setOver(document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-as-room]") || null);
    };

    const end = (commit) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("keydown", key, true);
        cancelAnimationFrame(raf);
        ghost?.remove();
        card.classList.remove("is-dragging");
        document.body.classList.remove("as-dragging");
        const target = over;
        setOver(null);
        if (commit && ghost && target) assignTo(target.dataset.asRoom, name);
    };
    const up = () => end(true);
    const cancel = () => end(false);
    const key = (ev) => {
        if (ev.key === "Escape") {
            ev.stopPropagation();
            end(false);
        }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
}

/* 이미지가 브라우저 기본 드래그로 끌려가 버리면 포인터 이벤트가 끊겨서 막아요 */
document.addEventListener("dragstart", (e) => e.target.closest?.("[data-as-user]") && e.preventDefault());

document.addEventListener("pointerdown", (e) => {
    const card = e.target.closest("[data-as-user]");
    if (!card || e.button > 0) return;
    startAsDrag(e, card);
});

/* ---------- 모달 (저장 확인 / 저장 완료 / 저장 안 하고 나갈 때) ---------- */
const asModal = document.createElement("div");
asModal.className = "hm";
asModal.id = "asModal";
asModal.hidden = true;
document.body.appendChild(asModal);

const AS_MODALS = {
    save: {
        icon: "check-purple",
        title: "변경된 내용으로 저장하시겠습니까?",
        sub: ["변경한 객실별 담당 직원 정보가 일괄 저장되며,", "저장 후 해당 직원에게 배정 내용이 반영됩니다."],
        btns: [["outline", "close", "닫기"], ["primary", "save", "변경 사항 저장"]],
    },
    done: {
        icon: "check-purple",
        title: "객실 담당자 재배정이 완료되었습니다",
        btns: [["primary", "close", "확인"]],
    },
    leave: {
        icon: "exclamation-red",
        danger: true,
        title: "저장되지 않은 변경 사항이 있습니다!",
        sub: ["저장하지 않고 페이지를 이동하면 변경 사항이 사라지며,", "사라진 내용은 다시 복구할 수 없습니다."],
        btns: [["outline", "leave", "저장하지 않고 나가기"], ["primary", "close", "계속 수정"]],
    },
};

function openAsModal(kind) {
    const m = AS_MODALS[kind];
    asModal.dataset.kind = kind;
    asModal.innerHTML = `
    <div class="hm-box rs-cm" role="alertdialog" aria-modal="true" aria-label="${m.title}">
      <div class="rs-cm-body">
        <span class="rs-cm-ic${m.danger ? " is-danger" : ""}"><img src="${ICON(m.icon)}" alt="" /></span>
        <div class="rs-cm-tx"><strong>${m.title}</strong>${m.sub ? `<span>${m.sub.join("<br />")}</span>` : ""}</div>
      </div>
      <div class="rs-cm-btns">${m.btns.map(([style, act, label]) => `<button class="btn btn-lg btn-${style}" type="button" data-as-m="${act}">${label}</button>`).join("")}</div>
    </div>`;
    asModal.hidden = false;
    asModal.querySelector(".btn-primary").focus();
}

const closeAsModal = () => {
    asModal.hidden = true;
    asModal.innerHTML = "";
};

function saveAssign() {
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem("roomAssign")) || {};
    } catch (e) { }
    Object.entries(asChanges).forEach(([no, name]) => {
        saved[no] = name;
        const r = ROOMS.find((x) => x.no === no);
        if (!r) return;
        r.staff = name; /* 다른 화면(메인 등)도 같은 ROOMS 값을 봐요 */
        r.staffTag = "";
        if (r.status === "reassign") r.status = "todo"; /* 담당자가 정해지면 '청소 필요'로 돌아가요 */
    });
    try {
        localStorage.setItem("roomAssign", JSON.stringify(saved));
    } catch (e) { }
    asChanges = {};
    if (Object.keys(asTomChanges).length) {
        Object.assign(asTomSaved, asTomChanges);
        try {
            localStorage.setItem("roomAssignTomorrow", JSON.stringify(asTomSaved));
        } catch (e) { }
        asTomChanges = {};
    }
    renderAssign();
}

let asPendingUrl = null;
let asSkipLeave = false;

/* 저장 안 한 변경사항이 있으면 화면 이동을 막고 경고 모달을 띄워요 (index.js 의 navigateTo 도 이 함수를 거쳐요) */
function beforeLeave(url) {
    if (!asDirty() || asSkipLeave) return true;
    asPendingUrl = url;
    openAsModal("leave");
    return false;
}

asModal.addEventListener("click", (e) => {
    if (e.target === asModal) return closeAsModal();
    const b = e.target.closest("[data-as-m]");
    if (!b) return;
    const act = b.dataset.asM;
    if (act === "save") {
        saveAssign();
        openAsModal("done");
    } else if (act === "leave") {
        asSkipLeave = true;
        location.href = asPendingUrl;
    } else closeAsModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !asModal.hidden) closeAsModal();
});

/* 사이드바 등 모든 링크 클릭을 가로채요 (같은 화면으로 가는 링크도 새로고침되니까 똑같이 막아요) */
document.addEventListener(
    "click",
    (e) => {
        const a = e.target.closest("a[href]");
        if (!a) return;
        const href = a.getAttribute("href");
        if (!href || href.startsWith("#")) return;
        if (beforeLeave(href) === false) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    },
    true
);

/* 브라우저 새로고침·탭 닫기 */
window.addEventListener("beforeunload", (e) => {
    if (asDirty() && !asSkipLeave) {
        e.preventDefault();
        e.returnValue = "";
    }
});


/* ---------- 자동 배정 기준 설정 모달 ---------- */
const asSetModal = document.createElement("div");
asSetModal.className = "hm";
asSetModal.id = "asSetModal";
asSetModal.hidden = true;
document.body.appendChild(asSetModal);
let asSetDraft = null;

const asSetRankHtml = (order) =>
    order
        .map(
            (k, i) => `<div class="as-rank" data-key="${k}">
        <img class="i24 as-rank-handle" src="${ICON("handle")}" alt="" draggable="false" />
        <span class="as-rank-badge">${i + 1}순위</span>
        <div class="as-rank-tx"><strong>${AS_CRITERIA[k][0]}</strong><span>${AS_CRITERIA[k][1]}</span></div>
    </div>`
        )
        .join("");

function openAsSet() {
    const v = asSettings();
    asSetDraft = { ...v, order: v.order.slice() };
    asSetModal.innerHTML = `
    <div class="hm-box as-set" role="dialog" aria-modal="true" aria-labelledby="asSetTitle">
      <div class="hm-head">
        <h2 class="hm-title" id="asSetTitle">자동 배정 기준 설정</h2>
        <button class="hm-close" type="button" data-as-set="close" aria-label="닫기"><img class="i20" src="${ICON("close")}" alt="" /></button>
      </div>
      <div class="hm-body">
        <section class="as-set-sec as-set-top">
          <div class="as-set-tx"><h3>직원 자동 배정</h3><p>청소 일정이 생기면, 설정된 배정 기준과<br />직원별 근무 일정을 바탕으로 자동 배정합니다.</p></div>
          <div class="ui-seg" role="group" aria-label="배정 방식">
            <button type="button" data-as-mode="auto" class="${v.mode === "auto" ? "is-on" : ""}" aria-pressed="${v.mode === "auto"}">자동 배정</button>
            <button type="button" data-as-mode="manual" class="${v.mode === "manual" ? "is-on" : ""}" aria-pressed="${v.mode === "manual"}">수동 배정</button>
          </div>
        </section>
        <section class="as-set-sec">
          <div class="as-set-tx"><h3>배정 우선순위</h3><p>위쪽 기준부터 우선 적용합니다. 순서를 변경해 운영 방식에 맞게 설정하세요.</p></div>
          <div class="as-rank-list" id="asRankList">${asSetRankHtml(v.order)}</div>
        </section>
        <section class="as-set-sec">
          <h3>세부 배정 설정</h3>
          <div class="as-set-detail">
            <div class="as-set-grp">
              <div class="as-set-lb"><strong>직원당 하루 최대 업무량</strong><span>설정한 최대 업무량을 초과하면 미배정 상태로 남습니다.</span></div>
              <div class="as-max"><span>최대</span>
                <label class="as-max-in"><input type="text" inputmode="numeric" id="asMax" value="${v.maxMin}" maxlength="4" aria-label="하루 최대 업무량(분)" /></label>
                <span>분</span></div>
            </div>
            <div class="as-set-grp">
              <strong class="as-set-lb-t">기준 적용 방식</strong>
              <label class="as-rd"><input type="radio" name="asApply" value="future"${v.apply === "future" ? " checked" : ""} /><span class="as-radio"></span>
                <span class="as-rd-tx"><b>앞으로 생성되는 일정부터 적용</b><span>기존 배정은 유지하며 새 일정부터 적용합니다.</span></span></label>
              <div class="as-rd-item">
                <label class="as-rd"><input type="radio" name="asApply" value="today"${v.apply === "today" ? " checked" : ""} /><span class="as-radio"></span>
                  <span class="as-rd-tx"><b>오늘 미시작 업무도 다시 배정</b></span></label>
                <label class="as-chk-row" id="asKeepRow"${v.apply === "today" ? "" : " hidden"}><input type="checkbox" id="asKeep"${v.keepManual ? " checked" : ""} /><span class="as-chk"><img src="${ICON("check-white")}" alt="" /></span><span>관리자가 수동 변경한 배정은 유지</span></label>
              </div>
            </div>
            <div class="as-notice"><img class="i24" src="${ICON("exclamation-circle-gray")}" alt="" /><p>저장 후 선택한 적용 방식에 따라 반영됩니다.</p></div>
          </div>
        </section>
      </div>
      <div class="hm-foot">
        <button class="btn btn-lg btn-outline" type="button" data-as-set="close">닫기</button>
        <button class="btn btn-lg btn-primary" type="button" data-as-set="save">저장</button>
      </div>
    </div>`;
    asSetModal.hidden = false;
}
const closeAsSet = () => {
    asSetModal.hidden = true;
    asSetModal.innerHTML = "";
    asSetDraft = null;
};

/* 세그먼트: 바꿀 때마다 바로 시스템 값을 바꿔요 */
function asSetMode(mode) {
    const cur = asSettings();
    if (cur.mode === mode) return;
    asSaveSettings({ ...cur, mode });
    AS_PLAN = mode === "manual" ? {} : asAutoPlan();
    asSetModal.querySelectorAll("[data-as-mode]").forEach((b) => {
        const on = b.dataset.asMode === mode;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", on);
    });
    if (typeof renderAssign === "function") renderAssign();
}

/* 우선순위: 눌러서 끌면 위치가 바뀌고, 놓을 때마다 순위 숫자가 다시 매겨져요 */
function asRankDrag(e) {
    const el = e.target.closest(".as-rank");
    const list = el && el.parentElement;
    if (!el || e.button > 0) return;
    e.preventDefault();
    const lr = list.getBoundingClientRect();
    const grab = e.clientY - el.getBoundingClientRect().top; /* 잡은 위치 */
    el.classList.add("is-drag");
    el.setPointerCapture(e.pointerId);
    const numbers = () => list.querySelectorAll(".as-rank").forEach((r, i) => (r.querySelector(".as-rank-badge").textContent = `${i + 1}순위`));
    const place = (clientY) => {
        const y = clientY - lr.top - grab;
        const max = list.offsetHeight - el.offsetHeight;
        el.style.transform = `translateY(${Math.min(Math.max(y, 0), max) - el.offsetTop}px)`;
        const top = Math.min(Math.max(y, 0), max);
        const bottom = top + el.offsetHeight; /* 위로는 윗변, 아래로는 아랫변이 이웃 카드의 가운데를 넘으면 자리를 바꿔요 (카드 높이가 달라도 맨 끝까지 가요) */
        const swap = (other, before) => {
            const was = other.offsetTop;
            before ? list.insertBefore(el, other) : list.insertBefore(el, other.nextSibling);
            const d = was - other.offsetTop; /* 밀려난 카드가 부드럽게 제자리로 가요 */
            other.style.transition = "none";
            other.style.transform = `translateY(${d}px)`;
            other.getBoundingClientRect();
            other.style.transition = "";
            other.style.transform = "";
            numbers();
        };
        /* 빠르게 끌어도 지나친 칸만큼 한 번에 자리를 바꿔요 (1순위 ↔ 3순위 바로 이동) */
        let prev = el.previousElementSibling;
        let next = el.nextElementSibling;
        while (prev && top < prev.offsetTop + prev.offsetHeight / 2) {
            swap(prev, true);
            prev = el.previousElementSibling;
        }
        while (next && bottom > next.offsetTop + next.offsetHeight / 2) {
            swap(next, false);
            next = el.nextElementSibling;
        }
        el.style.transform = `translateY(${Math.min(Math.max(y, 0), max) - el.offsetTop}px)`;
    };
    place(e.clientY);
    const move = (ev) => place(ev.clientY);
    const up = () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        el.classList.remove("is-drag");
        el.style.transform = "";
        asSetDraft.order = [...list.querySelectorAll(".as-rank")].map((r) => r.dataset.key);
        numbers();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
}

asSetModal.addEventListener("pointerdown", (e) => e.target.closest(".as-rank") && asRankDrag(e));
asSetModal.addEventListener("click", (e) => {
    if (e.target === asSetModal) return closeAsSet();
    const m = e.target.closest("[data-as-mode]");
    if (m) return asSetMode(m.dataset.asMode);
    const b = e.target.closest("[data-as-set]");
    if (!b) return;
    if (b.dataset.asSet === "save") {
        const cur = asSettings();
        asSaveSettings({
            ...cur,
            order: asSetDraft.order,
            maxMin: +asSetModal.querySelector("#asMax").value || 0,
            apply: asSetModal.querySelector("input[name=asApply]:checked").value,
            keepManual: asSetModal.querySelector("#asKeep").checked,
        });
    }
    closeAsSet();
});
/* 라디오는 둘 중 하나만 선택돼요 (같은 name) / 체크박스는 '오늘 미시작 업무도 다시 배정'을 골랐을 때만 보여요 */
asSetModal.addEventListener("change", (e) => {
    if (e.target.name !== "asApply") return;
    asSetModal.querySelector("#asKeepRow").hidden = e.target.value !== "today";
});
asSetModal.addEventListener("input", (e) => {
    if (e.target.id === "asMax") e.target.value = e.target.value.replace(/\D/g, "");
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !asSetModal.hidden) closeAsSet();
});

/* ---------- 이벤트 ---------- */
$("#asAuto")?.addEventListener("click", openAsSet);
$("#asSave").addEventListener("click", () => openAsModal("save"));
$("#asWorkerSearch").addEventListener("input", (e) => {
    asWorkerQuery = e.target.value;
    renderAssignWorkers();
});
$("#asRoomSearch").addEventListener("input", (e) => {
    asRoomQuery = e.target.value;
    renderAssignRooms();
});
document.querySelector(".as-tabs").addEventListener("click", (e) => {
    const t = e.target.closest("[data-as-day]");
    if (!t) return;
    asDay = t.dataset.asDay;
    document.querySelectorAll("[data-as-day]").forEach((b) => {
        const on = b === t;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", String(on));
    });
    $("#asWorkersTitle").textContent = asDay === "tomorrow" ? "내일 근무자 목록" : "오늘 근무자 목록";
    renderAssignWorkers();
    renderAssignRooms();
});

updateFilterButtons();
renderAssign();
fitAssign();