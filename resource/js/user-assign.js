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
const asDirty = () => Object.keys(asChanges).length > 0;
const asStaffOf = (r) => asChanges[r.no] || r.staff;
const asNeed = (r) => r.status === "reassign" && !asChanges[r.no]; /* 아직 담당자를 못 정한 재배정 필요 객실 */

/* ---------- 오늘 근무자 ---------- */
const asAvatar = (name) => {
    const photo = STAFF_PHOTO[name] ? `<img class="as-avatar-photo" src="${STAFF_PHOTO[name]}" alt="" draggable="false" onerror="this.remove()" />` : "";
    return `<span class="as-avatar"><img class="as-avatar-ph" src="${ICON("user-purple")}" alt="" draggable="false" />${photo}</span>`;
};

function asCount(name) {
    return ROOMS.filter((r) => !r.empty && AS_ACTIVE.includes(r.status) && asStaffOf(r) === name).length;
}

/* 현재 맡은 객실이 적은 사람이 맨 앞 (같으면 직원 목록 순서) */
function asWorkers() {
    return STAFF.filter((n) => !LEFT_EARLY.has(n))
        .map((name, i) => ({ name, n: asCount(name), i }))
        .sort((a, b) => a.n - b.n || a.i - b.i);
}

function renderAssignWorkers() {
    const q = asWorkerQuery.trim();
    const list = asWorkers().filter((w) => !q || w.name.includes(q));
    $("#asWorkers").innerHTML = list.length
        ? list
            .map(
                (w) => `
      <div class="as-user" data-as-user="${w.name}" tabindex="0" aria-label="${w.name}, 현재 ${w.n}실. 끌어서 객실에 배정">
        <img class="i24 as-handle" src="${ICON("handle")}" alt="" draggable="false" />
        <div class="as-profile">${asAvatar(w.name)}<div class="as-user-tx"><strong>${w.name}</strong><span>현재 ${w.n}실</span></div></div>
      </div>`
            )
            .join("")
        : `<p class="floor-empty">${q ? "검색 결과가 없어요." : "오늘 근무자가 없어요."}</p>`;
}

/* ---------- 배정 가능 객실 ---------- */
function asRooms() {
    if (asDay !== "today") return []; /* 내일 배정 데이터는 아직 없어요 */
    const q = asRoomQuery.trim();
    return ROOMS.filter((r) => !r.empty && (r.status === "todo" || r.status === "reassign"))
        .filter((r) => filterPass("astatus", asNeed(r) ? "need" : "assigned"))
        .filter((r) => !q || r.no.includes(q) || asStaffOf(r).includes(q))
        .sort((a, b) => a.floor - b.floor || (b.status === "reassign") - (a.status === "reassign") || Number(a.no) - Number(b.no));
}

function asRoomCard(r) {
    const need = asNeed(r);
    const changed = !!asChanges[r.no];
    const tag = r.staffTag && !changed ? `<span class="tag">${r.staffTag}</span>` : "";
    return `
    <article class="as-room${need ? " is-need" : ""}" data-as-room="${r.no}" aria-label="${r.no}호 ${need ? "재배정 필요" : "배정완료"}">
      <div class="as-room-top">
        <strong>${r.no}호</strong>
        <span class="badge ${need ? "badge-reassign" : "badge-todo"}">${need ? "재배정 필요" : "배정완료"}</span>
      </div>
      <p class="as-room-staff"><span>담당</span><b>${asStaffOf(r)}</b>${tag}</p>
      ${need ? `<div class="as-drop">담당자를 드래그해 배정</div>` : ""}
    </article>`;
}

function renderAssignRooms() {
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
    $("#asSave").disabled = !asDirty();
}

/* 객실 목록 카드는 화면 아래(여백 20px)까지 채우고, 이 카드 안에서만 스크롤돼요 */
function fitAssign() {
    const card = $("#asRoomsCard");
    if (!card) return;
    const top = card.getBoundingClientRect().top + window.scrollY;
    card.style.height = Math.max(380, window.innerHeight - top - 20) + "px";
}
window.addEventListener("resize", fitAssign);

/* ---------- 드래그로 배정 ---------- */
function assignTo(no, name) {
    const r = ROOMS.find((x) => x.no === no);
    if (!r) return;
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
    const list = $("#asRoomsCard");

    /* 끌어서 카드의 위(고정된 필터 줄 아래)·아래 가장자리에 가면 목록이 알아서 스크롤돼요 */
    const autoScroll = () => {
        const b = list.getBoundingClientRect();
        const top = $("#asSticky").getBoundingClientRect().bottom;
        const edge = 70, max = 18;
        if (py < top + edge) list.scrollTop -= Math.ceil((Math.min(edge, top + edge - py) / edge) * max);
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
        btns: [["outline", "close", "닫기"], ["primary", "save", "변경사항 저장"]],
    },
    done: {
        icon: "check-purple",
        title: "객실 담당자 재배정이 완료되었습니다",
        btns: [["primary", "close", "확인"]],
    },
    leave: {
        icon: "exclamation-red",
        danger: true,
        title: "저장되지 않은 변경사항이 있습니다!",
        sub: ["저장하지 않고 페이지를 이동하면 변경사항이 사라지며,", "사라진 내용은 다시 복구할 수 없습니다."],
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

/* ---------- 이벤트 ---------- */
$("#asSave").addEventListener("click", () => asDirty() && openAsModal("save"));
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
    renderAssignRooms();
});

updateFilterButtons();
renderAssign();
fitAssign();