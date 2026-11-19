/* ==========================================================
   청소 기준 설정 (standard.html)
   - 왼쪽: 객실 타입 목록 (전체 공통 + 타입별) / 오른쪽: 선택한 타입의 청소 기준
   - 타입별 기준은 '전체 공통' 체크리스트 아래에 추가로 붙어요 (직원 앱에서 합쳐서 보여줘요)
   - 데이터는 지금은 localStorage("cleanRules") 에 저장 / 서버 연결 시 RL_LOAD · RL_SAVE 만 바꾸면 돼요
   ========================================================== */

const RL_KEY = "cleanRules";
const RL_COMMON = "common";

/* 기본값: 데이터 없음 상태 (타입 목록만 있고 기준·이미지는 비어 있어요) */
const RL_DEFAULT = () => ({
    types: [
        { id: "std", name: "스탠다드" },
        { id: "dlx", name: "디럭스" },
        { id: "sui", name: "스위트" },
    ],
    data: {},
});

/* ★ 서버 연결 지점 ★  GET /api/clean-rules  /  PUT /api/clean-rules */
function RL_LOAD() {
    try {
        const s = JSON.parse(localStorage.getItem(RL_KEY));
        if (s && Array.isArray(s.types) && s.data) return s;
    } catch (e) { }
    return RL_DEFAULT();
}
function RL_SAVE() {
    try {
        localStorage.setItem(RL_KEY, JSON.stringify({ types: rl.types, data: rl.data }));
    } catch (e) { }
}

const rl = RL_LOAD();
let rlSel = RL_COMMON;

const rlName = (id) => (id === RL_COMMON ? "전체 공통" : (rl.types.find((t) => t.id === id) || {}).name || "");
const rlData = (id) => {
    const d = (rl.data[id] = rl.data[id] || {});
    d.images = d.images || [];
    if (!d.checks || !d.checks.length) d.checks = [""];
    if (!d.proofs || !d.proofs.length) d.proofs = [{ t: "", g: "" }];
    return d;
};
/* 아무것도 입력하지 않은 상태인지 (저장하기 버튼 활성 조건) */
const rlHasData = (id) => {
    const d = rlData(id);
    return d.images.length > 0 || d.checks.some((v) => v.trim()) || d.proofs.some((p) => p.t.trim() || p.g.trim());
};

/* ---------- 왼쪽: 객실 타입 ---------- */
function renderTypes() {
    const items = [{ id: RL_COMMON, name: "전체 공통" }, ...rl.types];
    $("#rlTypes").innerHTML = `
    <div class="rl-types-top">
      <h2>객실 타입</h2>
      <button class="rl-icon-btn" type="button" id="rlTypeSet" aria-label="객실 타입 설정" aria-haspopup="dialog">${icon("setting")}</button>
    </div>
    <div class="rl-types-list" id="rlTypeList">
      ${items
            .map(
                (t) => `
        <button class="rl-type${t.id === rlSel ? " is-active" : ""}" type="button" data-type="${t.id}" aria-pressed="${t.id === rlSel}">
          <span>${esc(t.name)}</span>${icon("arrow-right", 24)}
        </button>`
            )
            .join("")}
    </div>`;
    fitTypes();
}

/* 객실 타입 카드는 화면 아래(여백 20px)까지만 커지고, 타입이 더 많으면 목록 안에서 스크롤돼요 */
function fitTypes() {
    const box = $("#rlTypes");
    if (!box) return;
    if (window.innerWidth <= 900) {
        box.style.maxHeight = "";
        return;
    }
    const top = Math.max(120, box.getBoundingClientRect().top);
    box.style.maxHeight = Math.max(240, window.innerHeight - top - 20) + "px";
}

/* ---------- 오른쪽: 선택한 타입의 청소 기준 ---------- */
function checkRow(v, i) {
    return `
    <div class="rl-row" data-i="${i}">
      <button class="rl-handle" type="button" data-handle aria-label="순서 바꾸기">${icon("handle")}</button>
      <div class="rl-input">
        <input type="text" value="${esc(v)}" data-check="${i}" placeholder="추가할 체크리스트 항목을 작성해 주세요." />
        <button class="rl-in-btn" type="button" data-del-check="${i}" aria-label="항목 삭제">${icon("trash")}</button>
      </div>
    </div>`;
}

function proofBox(p, i) {
    return `
    <div class="rl-proof" data-i="${i}">
      <button class="rl-handle" type="button" data-handle aria-label="순서 바꾸기">${icon("handle")}</button>
      <div class="rl-proof-fields">
        <div class="rl-input"><input type="text" value="${esc(p.t)}" data-proof-t="${i}" placeholder="촬영 항목명" /></div>
        <div class="rl-input"><input type="text" value="${esc(p.g)}" data-proof-g="${i}" placeholder="촬영 방법 안내 문구를 작성해 주세요." /></div>
      </div>
      <button class="rl-del" type="button" data-del-proof="${i}" aria-label="촬영 항목 삭제">${icon("trash")}</button>
    </div>`;
}

function renderCard() {
    const common = rlSel === RL_COMMON;
    const name = rlName(rlSel);
    const d = rlData(rlSel);
    const pre = common ? "" : "추가 ";
    $("#rlCard").innerHTML = `
    <div class="rl-tit">
      <div class="rl-tit-tx">
        <h2>${esc(name)} 청소 기준</h2>
        <p>${common
            ? "전체 객실 공통 청소 기준 항목을 추가해 주세요."
            : "이 객실 타입에만 필요한 항목을 추가해 주세요.<br />직원 체크리스트에서 공통 항목 아래에 표시됩니다."}</p>
      </div>
      <div class="rl-tit-btns">
        <button class="rl-btn is-outline" type="button" id="rlPreview">직원 화면 미리보기</button>
        <button class="rl-btn is-primary" type="button" id="rlSave"${rlHasData(rlSel) ? "" : " disabled"}>저장하기</button>
      </div>
    </div>
    <hr class="rl-line" />
    <div class="rl-sections">
      <section class="rl-sec">
        <div class="rl-sec-head"><div class="rl-sec-tx">
          <h3>${pre}청소 참고 이미지</h3>
          <p>청소 참고 이미지는 직원에게만 보이며, ${common ? "전체" : esc(name)} 객실의 정리 상태 예시입니다.</p>
        </div></div>
        <div class="rl-imgs" id="rlImgs">
          ${d.images
            .map(
                (src, i) => `
            <button class="rl-img" type="button" data-del-img="${i}" aria-label="이미지 삭제">
              <img src="${esc(src)}" alt="청소 참고 이미지 ${i + 1}" draggable="false" />
              <span class="rl-img-dim">${icon("trash-white", 36)}</span>
            </button>`
            )
            .join("")}
          <button class="rl-add" type="button" id="rlAddImg" aria-label="청소 참고 이미지 추가">${icon("plus-gray", 36)}</button>
        </div>
      </section>

      <section class="rl-sec">
        <div class="rl-sec-head">
          <div class="rl-sec-tx">
            <h3>${pre}관리 항목 체크리스트 <em>*직원 응답 필수</em></h3>
            <p>직원이 청소 중 참고하는 항목입니다.</p>
          </div>
          <button class="rl-btn is-sm" type="button" id="rlAddCheck">${icon("plus")}항목 추가</button>
        </div>
        <div class="rl-rows" id="rlChecks">${d.checks.map(checkRow).join("")}</div>
      </section>

      <section class="rl-sec">
        <div class="rl-sec-head">
          <div class="rl-sec-tx">
            <h3>${pre}청소 인증 사진 <em>*직원 응답 필수</em></h3>
            <p>직원이 청소 완료 시 제출할 사진과 촬영 방법을 설정합니다.</p>
          </div>
          <button class="rl-btn is-sm" type="button" id="rlAddProof">${icon("plus")}항목 추가</button>
        </div>
        <div class="rl-proofs" id="rlProofs">${d.proofs.map(proofBox).join("")}</div>
      </section>
    </div>`;
}

function renderAll() {
    renderTypes();
    renderCard();
}
const refreshSave = () => {
    const b = $("#rlSave");
    if (b) b.disabled = !rlHasData(rlSel);
};

/* ---------- 입력 / 클릭 ---------- */
document.addEventListener("input", (e) => {
    const t = e.target;
    if (!t.closest || !t.closest("#rlCard")) return;
    const d = rlData(rlSel);
    if (t.dataset.check != null) d.checks[+t.dataset.check] = t.value;
    else if (t.dataset.proofT != null) d.proofs[+t.dataset.proofT].t = t.value;
    else if (t.dataset.proofG != null) d.proofs[+t.dataset.proofG].g = t.value;
    refreshSave();
});

/* 사진 칸: 터치 화면은 처음 누르면 삭제 아이콘만 보여주고, 한 번 더 누르면 삭제해요 */
const rlTouch = () => window.matchMedia("(hover: none)").matches;

document.addEventListener("click", (e) => {
    const typeBtn = e.target.closest("[data-type]");
    if (typeBtn && typeBtn.closest("#rlTypes")) {
        rlSel = typeBtn.dataset.type;
        renderAll();
        return;
    }
    if (e.target.closest("#rlTypeSet")) return openTypeModal();

    const d = rlData(rlSel);
    const delImg = e.target.closest("[data-del-img]");
    if (delImg) {
        if (rlTouch() && !delImg.classList.contains("is-on")) {
            document.querySelectorAll(".rl-img.is-on").forEach((el) => el.classList.remove("is-on"));
            delImg.classList.add("is-on");
            return;
        }
        d.images.splice(+delImg.dataset.delImg, 1);
        renderCard();
        return;
    }
    if (e.target.closest("#rlAddImg")) return $("#rlFile").click(); /* 파일 탐색기 열기 */

    if (e.target.closest("#rlAddCheck")) {
        d.checks.push("");
        renderCard();
        const ins = document.querySelectorAll("#rlChecks input");
        ins[ins.length - 1].focus();
        return;
    }
    const delCheck = e.target.closest("[data-del-check]");
    if (delCheck) {
        d.checks.splice(+delCheck.dataset.delCheck, 1);
        renderCard();
        return;
    }
    if (e.target.closest("#rlAddProof")) {
        d.proofs.push({ t: "", g: "" });
        renderCard();
        const ins = document.querySelectorAll("#rlProofs [data-proof-t]");
        ins[ins.length - 1].focus();
        return;
    }
    const delProof = e.target.closest("[data-del-proof]");
    if (delProof) {
        d.proofs.splice(+delProof.dataset.delProof, 1);
        renderCard();
        return;
    }
    if (e.target.closest("#rlSave")) {
        RL_SAVE();
        openDoneModal("저장이 완료되었습니다.");
        return;
    }
    if (!e.target.closest(".rl-img")) document.querySelectorAll(".rl-img.is-on").forEach((el) => el.classList.remove("is-on"));
});

/* 선택한 사진을 참고 이미지로 추가 */
$("#rlFile").addEventListener("change", (e) => {
    const files = [...e.target.files].filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length) return;
    const d = rlData(rlSel);
    Promise.all(
        files.map(
            (f) =>
                new Promise((res) => {
                    const r = new FileReader();
                    r.onload = () => res(r.result);
                    r.onerror = () => res(null);
                    r.readAsDataURL(f);
                })
        )
    ).then((list) => {
        list.filter(Boolean).forEach((src) => d.images.push(src));
        renderCard();
    });
});

/* ---------- 손잡이를 끌어서 순서 바꾸기 (체크리스트 / 인증 사진) ---------- */
document.addEventListener("pointerdown", (e) => {
    const h = e.target.closest("[data-handle]");
    if (!h || e.button > 0) return;
    const item = h.closest(".rl-row, .rl-proof");
    const box = item.parentElement;
    const isCheck = box.id === "rlChecks";
    e.preventDefault();
    item.classList.add("is-dragging");
    document.body.classList.add("rl-dragging");
    const move = (ev) => {
        const over = [...box.children].find((c) => {
            if (c === item) return false;
            const r = c.getBoundingClientRect();
            return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
        });
        if (!over) return;
        const kids = [...box.children];
        box.insertBefore(item, kids.indexOf(over) > kids.indexOf(item) ? over.nextSibling : over);
    };
    const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        item.classList.remove("is-dragging");
        document.body.classList.remove("rl-dragging");
        const d = rlData(rlSel);
        const order = [...box.children].map((c) => +c.dataset.i);
        if (isCheck) d.checks = order.map((i) => d.checks[i]);
        else d.proofs = order.map((i) => d.proofs[i]);
        renderCard();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
});
document.addEventListener("dragstart", (e) => {
    if (e.target.closest && e.target.closest(".rl-img, .rl-handle")) e.preventDefault();
});

/* ==========================================================
   모달 (공통: 딤드 + 가운데 / 배경이나 Esc 로 닫기)
   ========================================================== */
const rlModals = [];
function rlOpen(html, onClose) {
    const el = document.createElement("div");
    el.className = "hm";
    el.innerHTML = html;
    el.addEventListener("mousedown", (e) => {
        el._down = e.target === el;
    });
    el.addEventListener("click", (e) => {
        if (e.target === el && el._down) rlClose(el);
    });
    document.body.appendChild(el);
    el._onClose = onClose;
    rlModals.push(el);
    return el;
}
function rlClose(el) {
    const i = rlModals.indexOf(el);
    if (i < 0) return;
    rlModals.splice(i, 1);
    el.remove();
    el._onClose && el._onClose();
}
document.addEventListener(
    "keydown",
    (e) => {
        if (e.key !== "Escape" || !rlModals.length) return;
        e.stopImmediatePropagation();
        rlClose(rlModals[rlModals.length - 1]);
    },
    true
);

/* 완료 안내 (확인 버튼 하나) */
function openDoneModal(text, onOk) {
    const el = rlOpen(
        `<div class="hm-box rl-cm" role="alertdialog" aria-modal="true" aria-label="${esc(text)}">
      <div class="rs-cm-body">
        <span class="rs-cm-ic">${icon("check-purple", 40)}</span>
        <div class="rs-cm-tx"><strong>${esc(text)}</strong></div>
      </div>
      <div class="rs-cm-btns"><button class="btn btn-lg btn-primary" type="button" data-ok>확인</button></div>
    </div>`,
        onOk
    );
    el.querySelector("[data-ok]").addEventListener("click", () => rlClose(el));
    el.querySelector("[data-ok]").focus();
}

/* ---------- 객실 타입 설정 모달 ---------- */
let draft = [];
function openTypeModal() {
    draft = rl.types.map((t) => ({ ...t }));
    const el = rlOpen(`<div class="hm-box rl-tm" role="dialog" aria-modal="true" aria-labelledby="rlTmTitle"></div>`);
    el.id = "rlTypeModal";
    drawTypeModal();
    const first = el.querySelector("[data-name]");
    first && first.focus();
}

function drawTypeModal() {
    const el = $("#rlTypeModal .hm-box");
    if (!el) return;
    el.innerHTML = `
    <div class="hm-head">
      <h2 class="hm-title" id="rlTmTitle">객실 타입 설정</h2>
      <button class="hm-close" type="button" data-close aria-label="닫기">${icon("close")}</button>
    </div>
    <div class="rl-tm-body">
      <div class="rl-tm-list" id="rlTmList">
        <div class="rl-tm-fixed">전체 공통</div>
        ${draft
            .map(
                (t, i) => `
          <div class="rl-row" data-i="${i}">
            <button class="rl-handle" type="button" data-handle-m aria-label="순서 바꾸기">${icon("handle")}</button>
            <div class="rl-input">
              <input type="text" value="${esc(t.name)}" data-name="${i}" placeholder="객실 타입명을 입력해 주세요." maxlength="20" />
              <button class="rl-in-btn" type="button" data-del-type="${i}" aria-label="${esc(t.name || "객실 타입")} 삭제">${icon("trash")}</button>
            </div>
          </div>`
            )
            .join("")}
      </div>
      <button class="rl-btn is-outline rl-tm-add" type="button" data-add-type>${icon("plus")}추가하기</button>
    </div>
    <div class="rs-cm-btns">
      <button class="btn btn-lg btn-outline" type="button" data-close>닫기</button>
      <button class="btn btn-lg btn-primary" type="button" data-save-types>저장</button>
    </div>`;
}

/* 모달 안의 손잡이로 순서 바꾸기 */
document.addEventListener("pointerdown", (e) => {
    const h = e.target.closest("[data-handle-m]");
    if (!h || e.button > 0) return;
    const item = h.closest(".rl-row");
    const box = item.parentElement;
    e.preventDefault();
    item.classList.add("is-dragging");
    const move = (ev) => {
        const kids = [...box.querySelectorAll(".rl-row")];
        const over = kids.find((c) => {
            if (c === item) return false;
            const r = c.getBoundingClientRect();
            return ev.clientY >= r.top && ev.clientY <= r.bottom;
        });
        if (over) box.insertBefore(item, kids.indexOf(over) > kids.indexOf(item) ? over.nextSibling : over);
    };
    const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        const order = [...box.querySelectorAll(".rl-row")].map((c) => +c.dataset.i);
        syncDraftNames();
        draft = order.map((i) => draft[i]);
        drawTypeModal();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
});

const syncDraftNames = () =>
    document.querySelectorAll("#rlTypeModal [data-name]").forEach((inp) => {
        draft[+inp.dataset.name].name = inp.value;
    });

document.addEventListener("input", (e) => {
    if (e.target.matches && e.target.matches("#rlTypeModal [data-name]")) draft[+e.target.dataset.name].name = e.target.value;
});

document.addEventListener("click", (e) => {
    const modal = e.target.closest("#rlTypeModal");
    if (!modal) return;
    if (e.target.closest("[data-close]")) return rlClose(modal);
    if (e.target.closest("[data-add-type]")) {
        syncDraftNames();
        draft.push({ id: "", name: "" });
        drawTypeModal();
        const ins = modal.querySelectorAll("[data-name]");
        ins[ins.length - 1].focus();
        return;
    }
    const del = e.target.closest("[data-del-type]");
    if (del) {
        syncDraftNames();
        const i = +del.dataset.delType;
        if (!draft[i].id) {
            /* 아직 저장하지 않은 새 타입은 바로 지워요 */
            draft.splice(i, 1);
            drawTypeModal();
        } else openDeleteConfirm(draft[i].id);
        return;
    }
    if (e.target.closest("[data-save-types]")) {
        syncDraftNames();
        const old = new Map(rl.types.map((t) => [t.id, t.name]));
        const next = [];
        draft.forEach((t, i) => {
            const name = t.name.trim() || old.get(t.id) || "";
            if (!name) return; /* 이름을 안 적은 새 타입은 저장하지 않아요 */
            next.push({ id: t.id || "t" + Date.now().toString(36) + i, name });
        });
        rl.types = next;
        if (rlSel !== RL_COMMON && !next.some((t) => t.id === rlSel)) rlSel = RL_COMMON;
        RL_SAVE();
        rlClose(modal);
        renderAll();
    }
});

/* 삭제 확인 → 삭제 완료 (타입별 청소 기준도 함께 지워져요) */
function openDeleteConfirm(id) {
    const el = rlOpen(
        `<div class="hm-box rl-cm" role="alertdialog" aria-modal="true" aria-label="객실 타입 삭제 확인">
      <div class="rs-cm-body">
        <span class="rs-cm-ic is-danger">${icon("exclamation-red", 40)}</span>
        <div class="rs-cm-tx">
          <strong>객실 타입을 삭제하시겠습니까?</strong>
          <span>객실 타입을 삭제하면 해당 타입에 등록된 청소 기준, 인증 사진<br />항목 및 참고 이미지도 함께 삭제되며, 삭제한 내용은 복구할 수 없습니다.</span>
        </div>
      </div>
      <div class="rs-cm-btns">
        <button class="btn btn-lg btn-outline" type="button" data-cancel>취소</button>
        <button class="btn btn-lg btn-primary" type="button" data-yes>삭제</button>
      </div>
    </div>`
    );
    el.querySelector("[data-cancel]").addEventListener("click", () => rlClose(el));
    el.querySelector("[data-yes]").addEventListener("click", () => {
        rl.types = rl.types.filter((t) => t.id !== id);
        delete rl.data[id];
        draft = draft.filter((t) => t.id !== id);
        if (rlSel === id) rlSel = RL_COMMON;
        RL_SAVE();
        rlClose(el);
        drawTypeModal();
        renderAll();
        openDoneModal("삭제가 완료되었습니다.");
    });
    el.querySelector("[data-yes]").focus();
}

window.addEventListener("resize", fitTypes);
window.addEventListener("scroll", fitTypes, { passive: true });

renderAll();