/* ==========================================================
   청소 체크리스트 관리 (standard.html)
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
    localStorage.setItem(
      RL_KEY,
      JSON.stringify({ types: rl.types, data: rl.data })
    );
  } catch (e) { }
}

const rl = RL_LOAD();
let rlSel = RL_COMMON;

const rlName = (id) =>
  id === RL_COMMON
    ? "전체 공통"
    : (rl.types.find((t) => t.id === id) || {}).name || "";
const rlData = (id) => {
  const d = (rl.data[id] = rl.data[id] || {});
  d.images = d.images || [];
  if (!d.checks || !d.checks.length) d.checks = [""];
  if (!d.proofs || !d.proofs.length) d.proofs = [{ t: "", g: "" }];
  return d;
};
/* 입력된 내용이 있는지 */
const rlHasData = (id) => {
  const d = rlData(id);
  return (
    d.images.length > 0 ||
    d.checks.some((v) => v.trim()) ||
    d.proofs.some((p) => p.t.trim() || p.g.trim())
  );
};

/* ---------- 왼쪽: 객실 타입 ---------- */
function renderTypes() {
  const items = [{ id: RL_COMMON, name: "전체 공통" }, ...rl.types];
  $("#rlTypes").innerHTML = `
    <div class="rl-types-top">
      <h2>객실 타입</h2>
      <button class="rl-icon-btn" type="button" id="rlTypeSet" aria-label="객실 타입 설정" aria-haspopup="dialog">${icon(
    "setting"
  )}</button>
    </div>
    <div class="rl-types-list" id="rlTypeList">
      ${items
      .map(
        (t) => `
        <button class="rl-type${t.id === rlSel ? " is-active" : ""
          }" type="button" data-type="${t.id}" aria-pressed="${t.id === rlSel}">
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
      <button class="rl-handle" type="button" data-handle aria-label="순서 바꾸기">${icon(
    "handle"
  )}</button>
      <div class="rl-input">
        <input type="text" value="${esc(
    v
  )}" data-check="${i}" placeholder="ex) 침구 정리하기" />
        <button class="rl-in-btn" type="button" data-del-check="${i}" aria-label="항목 삭제">${icon(
    "trash"
  )}</button>
      </div>
    </div>`;
}

function proofBox(p, i) {
  return `
    <div class="rl-proof" data-i="${i}">
      <button class="rl-handle" type="button" data-handle aria-label="순서 바꾸기">${icon(
    "handle"
  )}</button>
      <div class="rl-proof-fields">
        <div class="rl-input"><input type="text" value="${esc(
    p.t
  )}" data-proof-t="${i}" placeholder="촬영 항목명 (ex. 침구 정리 상태)" /></div>
        <div class="rl-input"><input type="text" value="${esc(
    p.g
  )}" data-proof-g="${i}" placeholder="안내 문구 (ex. 침대 전체와 베개가 보이도록 촬영)" /></div>
      </div>
      <button class="rl-del" type="button" data-del-proof="${i}" aria-label="촬영 항목 삭제">${icon(
    "trash"
  )}</button>
    </div>`;
}

function renderCard() {
  const common = rlSel === RL_COMMON;
  const name = rlName(rlSel);
  const d = rlData(rlSel);
  const pre = common ? "" : "추가 ";
  $("#rlCard").innerHTML = `
    <div class="rl-sticky">
    <div class="rl-tit">
      <div class="rl-tit-tx">
        <h2>${esc(name)} 청소 기준</h2>
        <p>${common
      ? "전체 객실 공통 청소 기준 항목을 추가해 주세요."
      : "이 객실 타입에만 필요한 항목을 추가해 주세요.<br />직원 체크리스트에서 공통 항목 아래에 표시됩니다."
    }</p>
      </div>
      <div class="rl-tit-btns">
        <button class="rl-btn is-outline" type="button" id="rlPreview">직원 화면 미리보기</button>
        <button class="rl-btn is-primary" type="button" id="rlSave">변경 사항 일괄 저장</button>
      </div>
    </div>
    <hr class="rl-line" />
    </div>
    <div class="rl-sections">
      <section class="rl-sec">
        <div class="rl-sec-head"><div class="rl-sec-tx">
          <h3>${pre}청소 참고 이미지</h3>
          <p>청소 참고 이미지는 직원에게만 보여지며, ${common ? "전체" : esc(name)
    } 객실의 정리 상태 예시입니다.</p>
        </div></div>
        <div class="rl-imgs" id="rlImgs">
          ${d.images
      .map(
        (src, i) => `
            <button class="rl-img" type="button" data-del-img="${i}" aria-label="이미지 삭제">
              <img src="${esc(src)}" alt="청소 참고 이미지 ${i + 1
          }" draggable="false" />
              <span class="rl-img-dim">${icon("trash-white", 36)}</span>
            </button>`
      )
      .join("")}
          <button class="rl-add" type="button" id="rlAddImg" aria-label="청소 참고 이미지 추가">${icon(
        "plus-gray",
        36
      )}</button>
        </div>
      </section>

      <section class="rl-sec">
        <div class="rl-sec-head">
          <div class="rl-sec-tx">
            <h3>${pre}청소 항목 체크리스트</h3>
            <p>여기서 추가한 항목은 객실 담당 직원의 체크리스트에 표시되며, 직원은 모든 항목을 필수로 체크해야 합니다.</p>
          </div>
        </div>
        <div class="rl-rows" id="rlChecks">${d.checks
      .map(checkRow)
      .join("")}</div>
        <div class="rl-add-row"><button class="rl-btn is-sm" type="button" id="rlAddCheck">${icon(
        "plus"
      )}항목 추가</button></div>
      </section>

      <section class="rl-sec">
        <div class="rl-sec-head">
          <div class="rl-sec-tx">
            <h3>${pre}청소 인증 사진</h3>
            <p>직원이 청소 완료 시 제출할 사진과 촬영 방법을 설정합니다.</p>
          </div>
        </div>
        <div class="rl-proofs" id="rlProofs">${d.proofs
      .map(proofBox)
      .join("")}</div>
        <div class="rl-add-row"><button class="rl-btn is-sm" type="button" id="rlAddProof">${icon(
        "plus"
      )}항목 추가</button></div>
      </section>
    </div>`;
}

function renderAll() {
  renderTypes();
  renderCard();
}
/* 변경 사항 일괄 저장 버튼은 입력 여부와 상관없이 늘 활성화돼 있어요 */
const refreshSave = () => { };

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
      document
        .querySelectorAll(".rl-img.is-on")
        .forEach((el) => el.classList.remove("is-on"));
      delImg.classList.add("is-on");
      return;
    }
    d.images.splice(+delImg.dataset.delImg, 1);
    renderCard();
    return;
  }
  if (e.target.closest("#rlAddImg"))
    return $("#rlFile").click(); /* 파일 탐색기 열기 */

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
  if (!e.target.closest(".rl-img"))
    document
      .querySelectorAll(".rl-img.is-on")
      .forEach((el) => el.classList.remove("is-on"));
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
      return (
        ev.clientX >= r.left &&
        ev.clientX <= r.right &&
        ev.clientY >= r.top &&
        ev.clientY <= r.bottom
      );
    });
    if (!over) return;
    const kids = [...box.children];
    box.insertBefore(
      item,
      kids.indexOf(over) > kids.indexOf(item) ? over.nextSibling : over
    );
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
  if (e.target.closest && e.target.closest(".rl-img, .rl-handle"))
    e.preventDefault();
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
    `<div class="hm-box rl-cm" role="alertdialog" aria-modal="true" aria-label="${esc(
      text
    )}">
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
  const el = rlOpen(
    `<div class="hm-box rl-tm" role="dialog" aria-modal="true" aria-labelledby="rlTmTitle"></div>`
  );
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
      <button class="hm-close" type="button" data-close aria-label="닫기">${icon(
    "close"
  )}</button>
    </div>
    <div class="rl-tm-body">
      <div class="rl-tm-list" id="rlTmList">
        <div class="rl-tm-fixed">전체 공통</div>
        ${draft
      .map(
        (t, i) => `
          <div class="rl-row" data-i="${i}">
            <button class="rl-handle" type="button" data-handle-m aria-label="순서 바꾸기">${icon(
          "handle"
        )}</button>
            <div class="rl-input">
              <input type="text" value="${esc(
          t.name
        )}" data-name="${i}" placeholder="객실 타입명을 입력해 주세요." maxlength="20" />
              <button class="rl-in-btn" type="button" data-del-type="${i}" aria-label="${esc(
          t.name || "객실 타입"
        )} 삭제">${icon("trash")}</button>
            </div>
          </div>`
      )
      .join("")}
      </div>
      <button class="rl-btn is-outline rl-tm-add" type="button" data-add-type>${icon(
        "plus"
      )}추가하기</button>
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
    if (over)
      box.insertBefore(
        item,
        kids.indexOf(over) > kids.indexOf(item) ? over.nextSibling : over
      );
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
  if (e.target.matches && e.target.matches("#rlTypeModal [data-name]"))
    draft[+e.target.dataset.name].name = e.target.value;
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
    if (rlSel !== RL_COMMON && !next.some((t) => t.id === rlSel))
      rlSel = RL_COMMON;
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
  el.querySelector("[data-cancel]").addEventListener("click", () =>
    rlClose(el)
  );
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


/* ==========================================================
   직원 화면 미리보기 (Figma 2430:40659 모달 / 2430:35554 직원 화면)
   - 딤이 깔리고 가운데에 휴대폰 화면(390 x 812)이 떠요 / 딤을 누르거나 ‹ 를 누르거나 Esc 를 누르면 닫혀요
   - 딤이 떠 있는 동안 뒤쪽 화면은 스크롤되지 않고(.hm → is-modal-open), 휴대폰 화면 안쪽만 스크롤돼요
   - 내용은 지금 화면에 입력된 값 그대로예요: '전체 공통' 항목 + (타입을 골랐다면) 그 타입의 추가 항목이 합쳐져서 보여요
   ========================================================== */
const RP_STATUS_ICONS = `<svg width="20" height="13" viewBox="0 0 20 13" fill="none" aria-hidden="true"><path d="M1.65039 7.58008C1.95012 7.58014 2.21992 7.64999 2.46973 7.7998C2.71973 7.9498 2.92031 8.15039 3.07031 8.40039C3.22009 8.6502 3.29 8.92001 3.29004 9.21973V10.6904C3.28997 10.9901 3.22011 11.26 3.07031 11.5098C2.92031 11.7598 2.71973 11.9604 2.46973 12.1104C2.21993 12.2601 1.95009 12.33 1.65039 12.3301C1.35054 12.3301 1.07022 12.2602 0.820312 12.1104C0.570312 11.9604 0.369727 11.7598 0.219727 11.5098C0.0699196 11.26 6.65565e-05 10.9901 0 10.6904V9.21973C4.28388e-05 8.92 0.0699405 8.6502 0.219727 8.40039C0.369727 8.15039 0.570312 7.9498 0.820312 7.7998C1.07023 7.64994 1.35052 7.58008 1.65039 7.58008ZM7 5.36035C7.3 5.36035 7.57031 5.43008 7.82031 5.58008C8.0701 5.73001 8.26999 5.9299 8.41992 6.17969C8.56992 6.42969 8.63965 6.7 8.63965 7V10.6904C8.63958 10.9902 8.56979 11.2599 8.41992 11.5098C8.26994 11.7597 8.07028 11.9604 7.82031 12.1104C7.57031 12.2604 7.3 12.3301 7 12.3301C6.70004 12.3301 6.4199 12.2603 6.16992 12.1104C5.91992 11.9604 5.72031 11.7598 5.57031 11.5098C5.4204 11.2599 5.34968 10.9803 5.34961 10.6904V7C5.34961 6.7 5.42031 6.42969 5.57031 6.17969C5.72027 5.92989 5.92009 5.73 6.16992 5.58008C6.41992 5.43008 6.7 5.36035 7 5.36035ZM17.6904 0C17.9901 6.55189e-05 18.26 0.0699202 18.5098 0.219727C18.7598 0.369727 18.9604 0.570312 19.1104 0.820312C19.2601 1.07011 19.33 1.33994 19.3301 1.63965V10.6904C19.33 10.9901 19.2601 11.26 19.1104 11.5098C18.9604 11.7598 18.7598 11.9604 18.5098 12.1104C18.26 12.2601 17.9901 12.33 17.6904 12.3301C17.3906 12.3301 17.1102 12.2602 16.8604 12.1104C16.6104 11.9604 16.4098 11.7598 16.2598 11.5098C16.11 11.26 16.0401 10.9901 16.04 10.6904V1.63965C16.0401 1.33992 16.11 1.07012 16.2598 0.820312C16.4098 0.570312 16.6104 0.369727 16.8604 0.219727C17.1103 0.0698807 17.3906 0 17.6904 0ZM12.3496 2.79004C12.6495 2.79004 12.92 2.85984 13.1699 3.00977C13.4199 3.15977 13.6195 3.36035 13.7695 3.61035C13.9195 3.86025 13.9902 4.12983 13.9902 4.42969V10.6797C13.9902 10.9797 13.9195 11.25 13.7695 11.5C13.6196 11.7499 13.4198 11.9497 13.1699 12.0996C12.9199 12.2496 12.6496 12.3203 12.3496 12.3203C12.0498 12.3203 11.7694 12.2603 11.5195 12.1104C11.2696 11.9704 11.0699 11.7697 10.9199 11.5098C10.77 11.2598 10.7002 10.9796 10.7002 10.6797V4.42969C10.7002 4.12993 10.7701 3.86018 10.9199 3.61035C11.0699 3.36044 11.2696 3.15975 11.5195 3.00977C11.7694 2.85983 12.0498 2.7901 12.3496 2.79004Z" fill="#000"/></svg><svg width="17" height="13" viewBox="0 0 17 13" fill="none" aria-hidden="true"><path d="M0.358555 4.76929C0.777728 5.20063 1.43114 5.12668 1.96127 4.65838C3.71194 3.08094 5.8941 2.26757 8.33517 2.26757C10.7762 2.26757 12.9707 3.10559 14.7091 4.65838C15.2269 5.13901 15.8803 5.1883 16.3118 4.76929C16.7433 4.32564 16.8049 3.66016 16.3611 3.19185C14.5118 1.30632 11.4913 0 8.33517 0C5.17904 0 2.1462 1.31864 0.309241 3.20418C-0.134589 3.66016 -0.085275 4.32564 0.358555 4.78162V4.76929ZM3.40372 7.86256C3.88454 8.33086 4.50097 8.28156 5.04343 7.83791C5.93109 7.13546 7.11463 6.65483 8.33517 6.66715C9.54337 6.66715 10.7269 7.13546 11.6269 7.85023C12.1694 8.29389 12.8105 8.31854 13.2789 7.85023C13.7351 7.38193 13.8091 6.66715 13.3283 6.2235C12.1324 5.15133 10.3324 4.39958 8.3475 4.39958C6.36259 4.39958 4.55028 5.15133 3.36674 6.2235C2.94756 6.61786 2.86126 7.29566 3.41605 7.86256H3.40372ZM7.52148 11.954C8.05161 12.4593 8.6064 12.4593 9.13653 11.954L10.1351 10.9928C10.6653 10.4752 10.7762 9.82203 10.1721 9.37838C9.66666 9.02099 9.02557 8.78684 8.33517 8.78684C7.64477 8.78684 6.99135 9.02099 6.4982 9.3907C5.8941 9.82203 6.01739 10.4875 6.54752 10.9928L7.53381 11.954H7.52148Z" fill-rule="evenodd" clip-rule="evenodd" fill="#000"/></svg><svg width="28" height="13" viewBox="0 0 28 13" fill="none" aria-hidden="true"><path d="M26.0024 4.31997V8.32922C26.4026 8.21897 27.333 7.32691 27.333 6.3246C27.333 5.32228 26.4026 4.43022 26.0024 4.31997ZM25.0019 7.4973C25.0019 7.70779 25.0019 7.91827 25.0019 8.12876C25.0019 8.30918 25.0019 8.47957 25.0019 8.65998C24.9919 9.05089 24.9719 9.43177 24.9018 9.82267C24.8318 10.2136 24.7218 10.5744 24.5417 10.9252C24.3616 11.276 24.1315 11.5867 23.8614 11.8574C23.5912 12.128 23.2711 12.3585 22.9309 12.5389C22.5807 12.7194 22.2206 12.8296 21.8304 12.8998C21.4502 12.9699 21.06 12.99 20.6698 13C20.4897 13 20.3197 13 20.1396 13C19.9295 13 19.7194 13 19.5093 13H5.49261C5.28251 13 5.07241 13 4.86231 13C4.68223 13 4.51215 13 4.33206 13C3.94187 12.99 3.56169 12.9699 3.17151 12.8998C2.78132 12.8296 2.42115 12.7194 2.07099 12.5389C1.73082 12.3585 1.41067 12.128 1.14054 11.8574C0.870414 11.5867 0.640305 11.266 0.460219 10.9252C0.280133 10.5744 0.170081 10.2136 0.100048 9.82267C0.0300143 9.44179 0.0100048 9.05089 0 8.65998C0 8.47957 0 8.30918 0 8.12876C0 7.91827 0 7.70779 0 7.4973V5.49268C0 5.28219 0 5.0717 0 4.86122C0 4.6808 0 4.51041 0 4.32999C0.0100048 3.93909 0.0300143 3.55821 0.100048 3.17733C0.170081 2.78643 0.280133 2.4256 0.460219 2.07479C0.640305 1.72398 0.870414 1.41326 1.14054 1.14264C1.41067 0.872012 1.73082 0.64148 2.07099 0.461064C2.42115 0.280648 2.78132 0.170393 3.17151 0.100231C3.55169 0.0300694 3.94187 0.0100231 4.33206 0C4.51215 0 4.68223 0 4.86231 0C5.07241 0 5.28251 0 5.49261 0H19.4993C19.7094 0 19.9195 0 20.1296 0C20.3097 0 20.4797 0 20.6598 0C21.05 0.0100231 21.4302 0.0300694 21.8204 0.100231C22.2106 0.170393 22.5707 0.280648 22.9209 0.461064C23.2711 0.64148 23.5812 0.872012 23.8513 1.14264C24.1215 1.41326 24.3516 1.734 24.5317 2.07479C24.7118 2.4256 24.8218 2.78643 24.8918 3.17733C24.9619 3.55821 24.9819 3.94911 24.9919 4.32999C24.9919 4.51041 24.9919 4.6808 24.9919 4.86122C24.9919 5.0717 24.9919 5.28219 24.9919 5.49268V7.4973H25.0019Z" fill-rule="evenodd" clip-rule="evenodd" fill="#000"/></svg>`;

function rpMerged() {
  const base = rlData(RL_COMMON);
  const own = rlSel === RL_COMMON ? { images: [], checks: [], proofs: [] } : rlData(rlSel);
  return {
    checks: [...base.checks, ...own.checks].filter((v) => v.trim()),
    images: [...base.images, ...own.images],
    proofs: [...base.proofs, ...own.proofs].filter((p) => p.t.trim() || p.g.trim()),
  };
}

function rpHtml() {
  const m = rpMerged();
  const sec = (title, desc, body, star) => `
      <section class="rp-sec">
        <div class="rp-sec-tx"><h3>${title}${star ? ` <span class="rp-req">*</span>` : ""}</h3>${desc ? `<p>${desc}</p>` : ""}</div>
        ${body}
      </section>`;
  const checks = m.checks.length
    ? sec(
      "청소 체크리스트",
      "반드시 완료해야 하는 체크리스트입니다.<br />청소가 끝나면 체크해 주세요.",
      `<div class="rp-checks">${m.checks
        .map((v) => `<button class="rp-check" type="button" role="checkbox" aria-checked="false" data-rp-check><span class="rp-box">${icon("check-white", 20)}</span><span>${esc(v)}</span></button>`)
        .join("")}</div>`,
      true
    )
    : "";
  const imgs = m.images.length
    ? sec(
      "청소 참고 이미지",
      "청소 참고 이미지를 보고 비슷하게 촬영해 주세요.",
      `<div class="rp-swiper">${m.images.map((src, i) => `<div class="rp-slide"><img src="${esc(src)}" alt="청소 참고 이미지 ${i + 1}" draggable="false" /></div>`).join("")}</div>`
    )
    : "";
  const proofs = m.proofs.length
    ? sec(
      "청소 인증 사진 촬영",
      "각 장소에 맞춰 완료된 청소 이미지를 등록해 주세요.",
      `<div class="rp-proofs">${m.proofs
        .map(
          (p) => `
          <div class="rp-proof">
            <div class="rp-proof-tx">${p.t.trim() ? `<strong>${esc(p.t)}</strong>` : ""}${p.g.trim() ? `<span>${esc(p.g)}</span>` : ""}</div>
            <div class="rp-noimg">${icon("plus-gray", 36)}</div>
            <button class="rp-cam" type="button">${icon("camera-small", 20)}사진/동영상 추가</button>
          </div>`
        )
        .join("")}</div>`
    )
    : "";
  return `
  <div class="rp-phone" role="dialog" aria-modal="true" aria-label="직원 화면 미리보기">
    <div class="rp-head">
      <div class="rp-status"><span class="rp-time">9:41</span><span class="rp-island"><svg width="125" height="37" viewBox="0 0 125 37" fill="none" aria-hidden="true"><rect width="125" height="37" rx="18.5" fill="#000"/></svg></span><span class="rp-levels">${RP_STATUS_ICONS}</span></div>
      <div class="rp-bar"><button class="rp-back" type="button" data-rp-close aria-label="닫기">${icon("arrow-left", 26)}</button><strong>청소 체크리스트</strong></div>
    </div>
    <div class="rp-scroll" id="rpScroll">
      <div class="rp-progress"><span>진행률</span><div class="rp-track"><div class="rp-fill" id="rpFill"></div></div><span id="rpPct">0%</span></div>
      <div class="rp-cont">
        ${sec(
    "현재 객실",
    "",
    `<div class="rp-room">
            <div class="rp-room-top"><strong>103호</strong><span class="rp-badge">청소 중</span></div>
            <dl class="rp-room-info"><div><dt>퇴실</dt><dd>11:00</dd></div><div><dt>다음 입실</dt><dd>13:00</dd></div></dl>
          </div>`
  )}
        ${checks}${imgs}${proofs}
        ${sec(
    "조치 필요 내용 등록",
    "해당 객실에서 발생된 문제점으로,<br />처리가 필요한 부분이 있다면 작성해 주세요.",
    `<button class="rp-select" type="button"><span>카테고리 선택</span>${icon("arrow-down", 24)}</button>
           <textarea class="rp-text" placeholder="문제점을 자유롭게 작성해 주세요." aria-label="조치 필요 내용"></textarea>`
  )}
        ${sec("전달할 메모", "", `<textarea class="rp-text" placeholder="사장님께 전달할 메모를 작성해 주세요." aria-label="전달할 메모"></textarea>`)}
      </div>
    </div>
    <div class="rp-foot"><button class="rp-submit" type="button">청소 완료 제출</button></div>
  </div>`;
}

function openStaffPreview() {
  const el = rlOpen(rpHtml());
  el.classList.add("rp-modal");
  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-rp-close]")) return rlClose(el); /* ‹ 버튼 = 딤을 누르는 것과 똑같이 닫아요 */
    const c = e.target.closest("[data-rp-check]");
    if (!c) return;
    const on = c.getAttribute("aria-checked") !== "true";
    c.setAttribute("aria-checked", String(on));
    c.classList.toggle("is-checked", on);
    const all = el.querySelectorAll("[data-rp-check]");
    const pct = Math.round((el.querySelectorAll("[data-rp-check].is-checked").length / all.length) * 100);
    el.querySelector("#rpFill").style.width = pct + "%";
    el.querySelector("#rpPct").textContent = pct + "%";
  });
  el.querySelector(".rp-back").focus();
}
document.addEventListener("click", (e) => {
  if (e.target.closest("#rlPreview")) openStaffPreview();
});

window.addEventListener("resize", fitTypes);
window.addEventListener("scroll", fitTypes, { passive: true });

renderAll();