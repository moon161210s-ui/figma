/* ==========================================================
   청소 자동 배정 관리 (user-auto.html / index.js 뒤에 불러와요)
   - 위쪽: 전체 청소 팀 · 전체 직원 · 배정 가능한 직원(아직 어느 팀에도 없는 직원) 수
   - 왼쪽: 청소 조 목록 (팀 추가하기 / 팀 수정하기 / 삭제) — 한 팀 = 팀원 2명 + 팀원별 배정 제외 대상(없을 수 있어요)
   - 오른쪽: 청소 자동 배정 기준 설정 (직원 자동 배정 · 객실당 청소 인원 · 우선순위 · 기준 적용 방식) / 닫기 = 바꾼 내용 버리기, 저장 = 반영
   - 저장 위치 (직원 재배정 화면과 같은 값을 써요 / 서버 연결 시 두 값만 서버 값으로 바꾸면 돼요)
       · 팀: localStorage 'cleanTeams'  [{ name, members: [이름, 이름], exclude: [제외 대상 | "", 제외 대상 | ""] }]
       · 기준: localStorage 'assignSettings'  { mode, unit, order, apply, keepManual, ... }
   ========================================================== */
const AU_TEAMS_KEY = "cleanTeams";
const AU_SET_KEY = "assignSettings";

/* 아직 저장된 팀이 없을 때 보여주는 기본 팀 (user-assign.js 의 AS_TEAMS_DEFAULT 와 같은 값이에요) */
const AU_TEAMS_DEFAULT = [
    { name: "1팀", members: ["최하석", "유가은"], exclude: ["송혜원", "한다경"] },
    { name: "2팀", members: ["한다경", "김이레"], exclude: ["최하석", "유가은"] },
    { name: "3팀", members: ["이서영", "전재연"], exclude: ["송혜원", "김이레"] },
];

/* 우선순위 기준 이름 · 설명 */
const AU_CRITERIA = {
    near: ["가까운 객실 순서로 배정", "그날 처음 맡은 객실에서 가까운 위치의 객실을 우선 배정합니다."],
    count: ["담당 객실 수를 비슷하게 배정", "직원마다 맡는 객실 수가 비슷하도록 배정합니다."],
    skill: ["숙련도에 맞춰 배정", "직원 정보에서 설정한 숙련도를 기준으로 객실을 배정합니다."],
};
const AU_SET_DEFAULT = { mode: "auto", unit: "team", order: ["near", "count", "skill"], apply: "future", keepManual: false };

const auEsc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* 일하는 직원 전체 (퇴사 처리한 직원은 빠져요) */
const auRoster = () => Object.keys(STAFF_PATTERN).filter((n) => !resignedStaff().includes(n));

function auLoadTeams() {
    try {
        const v = JSON.parse(localStorage.getItem(AU_TEAMS_KEY));
        if (Array.isArray(v)) {
            return v
                .filter((t) => t && t.name && Array.isArray(t.members) && t.members.length)
                .map((t) => ({ name: t.name, members: t.members.slice(), exclude: Array.isArray(t.exclude) ? t.exclude.slice() : [] }));
        }
    } catch (e) { }
    return JSON.parse(JSON.stringify(AU_TEAMS_DEFAULT));
}
function auSaveTeams() {
    try {
        localStorage.setItem(AU_TEAMS_KEY, JSON.stringify(auTeams));
    } catch (e) { }
    /* TODO: 서버 연결 시 여기서 auTeams 를 전송 */
}
function auLoadSet() {
    try {
        const v = JSON.parse(localStorage.getItem(AU_SET_KEY)) || {};
        const order = Array.isArray(v.order) && v.order.length === 3 && v.order.every((k) => k in AU_CRITERIA) ? v.order : AU_SET_DEFAULT.order;
        return { ...AU_SET_DEFAULT, ...v, order };
    } catch (e) {
        return { ...AU_SET_DEFAULT, order: AU_SET_DEFAULT.order.slice() };
    }
}

let auTeams = auLoadTeams();
let auDraft = auLoadSet(); /* 오른쪽 패널에서 바꾸는 중인 값 (저장해야 반영돼요) */

/* ---------- 프로필 ---------- */
function auAvatar(name, cls) {
    const photo = STAFF_PHOTO[name] ? `<img class="au-avatar-photo" src="${STAFF_PHOTO[name]}" alt="" draggable="false" onerror="this.remove()" />` : "";
    return `<span class="au-avatar ${cls || ""}"><img class="au-avatar-ph" src="${ICON("user-purple")}" alt="" draggable="false" />${photo}</span>`;
}

/* ---------- 위쪽 숫자 카드 ---------- */
function renderStats() {
    const inTeam = new Set(auTeams.flatMap((t) => t.members));
    const roster = auRoster();
    const cards = [
        ["전체 청소 팀", auTeams.length, "팀"],
        ["전체 직원", roster.length, "명"],
        ["배정 가능한 직원", roster.filter((n) => !inTeam.has(n)).length, "명"],
    ];
    $("#auStats").innerHTML = cards
        .map(([t, v, u]) => `<div class="au-stat"><span class="au-stat-t">${t}</span><div class="au-stat-v"><strong>${v}</strong><small>${u}</small></div></div>`)
        .join("");
}

/* ---------- 청소 조 목록 ---------- */
function renderTeams() {
    const rows = auTeams
        .map(
            (t, i) => `
        <div class="au-team" data-team="${i}">
          <strong class="au-team-name">${auEsc(t.name)}</strong>
          <div class="au-members">${t.members
                    .map(
                        (n, k) => `<div class="au-member">${auAvatar(n)}<div class="au-member-tx"><strong>${auEsc(n)}</strong><span>배정 제외 대상 : ${auEsc(t.exclude[k] || "없음")}</span></div></div>`
                    )
                    .join("")}</div>
          <div class="au-team-btns">
            <button class="btn btn-sm btn-outline au-edit" type="button" data-au="edit">팀 수정하기</button>
            <button class="au-del" type="button" data-au="del" aria-label="${auEsc(t.name)} 삭제">${icon("trash", 20)}</button>
          </div>
        </div>`
        )
        .join("");
    $("#auTeams").innerHTML = `
      <div class="au-teams-head">
        <div class="au-teams-tit"><h2>청소 조 목록</h2><span>${auTeams.length}팀</span></div>
        <button class="btn btn-md btn-primary" type="button" data-au="add">팀 추가하기</button>
      </div>
      <div class="au-team-card"><div class="au-team-list">${rows || '<p class="floor-empty">등록된 팀이 없어요.</p>'}</div></div>`;
}

/* ---------- 오른쪽: 청소 자동 배정 기준 설정 ---------- */
const auSeg = (name, items, cur) =>
    `<div class="ui-seg" role="tablist">
        <span class="ui-seg-indicator" aria-hidden="true"></span>
        ${items
        .map(([v, t]) => `<button type="button" role="tab" class="${v === cur ? "is-on" : ""}" aria-selected="${v === cur}" data-seg="${name}" data-val="${v}">${t}</button>`)
        .join("")}
    </div>`;
function auPositionSeg(group, animate) {
    const active = group.querySelector("button.is-on");
    const ind = group.querySelector(".ui-seg-indicator");
    if (!active || !ind) return;
    if (!animate) ind.style.transition = "none";
    ind.style.width = `${active.offsetWidth}px`;
    ind.style.transform = `translateX(${active.offsetLeft}px)`;
    if (!animate) {
        void ind.offsetWidth;
        ind.style.transition = "";
    }
}
const auRankHtml = (order) =>
    order
        .map(
            (k, i) => `<div class="as-rank" data-key="${k}">
        <img class="i24 as-rank-handle" src="${ICON("handle")}" alt="" draggable="false" />
        <span class="as-rank-badge">${i + 1}순위</span>
        <div class="as-rank-tx"><strong>${AU_CRITERIA[k][0]}</strong><span>${AU_CRITERIA[k][1]}</span></div>
    </div>`
        )
        .join("");

function renderPanel() {
    const v = auDraft;
    $("#auPanel").innerHTML = `
      <div class="hm-head"><h2 class="hm-title">청소 자동 배정 기준 설정</h2></div>
      <div class="hm-body">
        <section class="as-set-sec as-set-top">
          <div class="as-set-tx"><h3>직원 자동 배정</h3><p>청소 일정이 생기면, 설정된 배정 기준과 <br />직원별 근무 일정을 바탕으로 자동 배정합니다.</p></div>
          ${auSeg("mode", [["auto", "자동 배정"], ["manual", "수동 배정"]], v.mode)}
        </section>
        <section class="as-set-sec as-set-top">
          <div class="as-set-tx"><h3>객실당 청소 인원 배정</h3><p>2인 1조 또는 1인을 기준으로 객실당 청소 인원을 배정합니다.</p></div>
          ${auSeg("unit", [["team", "조별 배정"], ["solo", "개인 배정"]], v.unit)}
        </section>
        <section class="as-set-sec">
          <div class="as-set-tx"><h3>객실당 직원 배정 우선순위</h3><p>위쪽 기준부터 우선 적용합니다. 순서를 변경해 운영 방식에 맞게 설정하세요.</p></div>
          <div class="as-rank-list" id="auRankList">${auRankHtml(v.order)}</div>
        </section>
        <section class="as-set-sec">
          <h3>세부 배정 설정</h3>
          <div class="as-set-detail">
            <div class="as-set-grp">
              <strong class="as-set-lb-t">기준 적용 방식</strong>
              <label class="as-rd"><input type="radio" name="auApply" value="future"${v.apply === "future" ? " checked" : ""} /><span class="as-radio"></span>
                <span class="as-rd-tx"><b>앞으로 생성되는 일정부터 적용</b><span>기존 배정은 유지하며 새 일정부터 적용합니다.</span></span></label>
              <div class="as-rd-item">
                <label class="as-rd"><input type="radio" name="auApply" value="today"${v.apply === "today" ? " checked" : ""} /><span class="as-radio"></span>
                  <span class="as-rd-tx"><b>오늘 미시작 업무도 다시 배정</b></span></label>
                <label class="as-chk-row" id="auKeepRow"${v.apply === "today" ? "" : " hidden"}><input type="checkbox" id="auKeep"${v.keepManual ? " checked" : ""} /><span class="as-chk"><img src="${ICON("check-white")}" alt="" /></span><span>관리자가 수동 변경한 배정은 유지</span></label>
              </div>
            </div>
            <div class="as-notice"><img class="i24" src="${ICON("exclamation-circle-gray")}" alt="" /><p>저장 후 선택한 적용 방식에 따라 반영됩니다.</p></div>
          </div>
        </section>
      </div>
      <div class="hm-foot">
        <button class="btn btn-lg btn-outline" type="button" data-au-set="close">닫기</button>
        <button class="btn btn-lg btn-primary" type="button" data-au-set="save">저장</button>
      </div>`;
    $("#auPanel")
        .querySelectorAll(".ui-seg")
        .forEach((g) => auPositionSeg(g, false));
}

/* 우선순위: 눌러서 끌면 위치가 바뀌고, 놓을 때마다 순위 숫자가 다시 매겨져요 */
function auRankDrag(e) {
    const el = e.target.closest(".as-rank");
    const list = el && el.parentElement;
    if (!el || e.button > 0) return;
    e.preventDefault();
    const lr = list.getBoundingClientRect();
    const grab = e.clientY - el.getBoundingClientRect().top;
    el.classList.add("is-drag");
    el.setPointerCapture(e.pointerId);
    const numbers = () => list.querySelectorAll(".as-rank").forEach((r, i) => (r.querySelector(".as-rank-badge").textContent = `${i + 1}순위`));
    const place = (clientY) => {
        const y = clientY - lr.top - grab;
        const max = list.offsetHeight - el.offsetHeight;
        const top = Math.min(Math.max(y, 0), max);
        const bottom = top + el.offsetHeight;
        const swap = (other, before) => {
            const was = other.offsetTop;
            before ? list.insertBefore(el, other) : list.insertBefore(el, other.nextSibling);
            const d = was - other.offsetTop;
            other.style.transition = "none";
            other.style.transform = `translateY(${d}px)`;
            other.getBoundingClientRect();
            other.style.transition = "";
            other.style.transform = "";
            numbers();
        };
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
        el.style.transform = `translateY(${top - el.offsetTop}px)`;
    };
    place(e.clientY);
    const move = (ev) => place(ev.clientY);
    const up = () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        el.classList.remove("is-drag");
        el.style.transform = "";
        auDraft.order = [...list.querySelectorAll(".as-rank")].map((r) => r.dataset.key);
        numbers();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
}

/* ---------- 모달 공통 (딤을 누르거나 Esc 를 누르면 닫혀요) ---------- */
const auModals = [];
function auOpen(html) {
    const el = document.createElement("div");
    el.className = "hm";
    el.innerHTML = html;
    el.addEventListener("mousedown", (e) => (el._down = e.target === el));
    el.addEventListener("click", (e) => {
        if (e.target === el && el._down) auClose(el);
    });
    document.body.appendChild(el);
    auModals.push(el);
    return el;
}
function auClose(el) {
    const i = auModals.indexOf(el);
    if (i < 0) return;
    auModals.splice(i, 1);
    closeAuMenu();
    el.remove();
}
document.addEventListener(
    "keydown",
    (e) => {
        if (e.key !== "Escape" || !auModals.length) return;
        e.stopImmediatePropagation();
        if (auMenu) return closeAuMenu();
        auClose(auModals[auModals.length - 1]);
    },
    true
);

function auDone(text) {
    const el = auOpen(`<div class="hm-box au-cm" role="alertdialog" aria-modal="true" aria-label="${auEsc(text)}">
      <div class="rs-cm-body">
        <span class="rs-cm-ic">${icon("check-purple", 40)}</span>
        <div class="rs-cm-tx"><strong>${auEsc(text)}</strong></div>
      </div>
      <div class="rs-cm-btns"><button class="btn btn-lg btn-primary" type="button" data-ok>확인</button></div>
    </div>`);
    const ok = el.querySelector("[data-ok]");
    ok.addEventListener("click", () => auClose(el));
    ok.focus();
}

function auConfirmDelete(i) {
    const t = auTeams[i];
    const el = auOpen(`<div class="hm-box au-cm" role="alertdialog" aria-modal="true" aria-label="팀 삭제 확인">
      <div class="rs-cm-body">
        <span class="rs-cm-ic is-danger">${icon("exclamation-red", 40)}</span>
        <div class="rs-cm-tx"><strong>${auEsc(t.name)}을(를) 삭제하시겠습니까?</strong><span>삭제한 팀은 복구할 수 없습니다.</span></div>
      </div>
      <div class="rs-cm-btns">
        <button class="btn btn-lg btn-outline" type="button" data-cancel>취소</button>
        <button class="btn btn-lg btn-primary" type="button" data-yes>삭제</button>
      </div>
    </div>`);
    el.querySelector("[data-cancel]").addEventListener("click", () => auClose(el));
    const yes = el.querySelector("[data-yes]");
    yes.addEventListener("click", () => {
        auTeams.splice(i, 1);
        auSaveTeams();
        auClose(el);
        renderAll();
    });
    yes.focus();
}

/* ---------- 팀 추가하기 / 팀 수정하기 모달 (Figma 2412:76638 · 2412:77133) ---------- */
let auForm = null; /* { index | null, name, members: [a, b], exclude: [a, b], el } */
let auMenu = null;

/* 셀렉트에는 일하는 직원 전체가 떠요. 고를 수 없는 사람(같은 팀의 짝꿍 · 배정 제외 대상이 될 수 없는 본인/짝꿍)은 흐리게 보여줘요 */
const auTeamOf = (name) => {
    const f = auForm;
    const i = auTeams.findIndex((t, k) => k !== f.index && t.members.includes(name));
    return i < 0 ? "" : auTeams[i].name;
};
const auOptions = (slot, kind) => {
    const f = auForm;
    const other = f.members[1 - slot];
    return auRoster().map((n) => {
        let off = "";
        if (kind === "member") {
            if (n === other) off = `팀원 ${2 - slot}로 선택됨`;
        } else if (n === f.members[slot]) off = "팀원 본인";
        else if (n === other) off = "같은 팀 팀원";
        const mine = f.index != null && auTeams[f.index] && auTeams[f.index].members.includes(n);
        const sub = off || (mine ? f.name || auTeams[f.index].name : auTeamOf(n) || "소속 팀 없음");
        return { n, sub, off: !!off };
    });
};

function auMemberCard(slot) {
    const f = auForm;
    const m = f.members[slot];
    const ex = f.exclude[slot];
    const sel = (kind, val, label) =>
        `<div class="au-field"><span class="au-field-lb">${label}</span>
          <button class="select is-lg au-sel${val ? " is-active" : ""}" type="button" data-sel="${kind}" data-slot="${slot}" aria-haspopup="listbox" aria-expanded="false"><span class="select-label">${val ? auEsc(val) : "직원을 선택해 주세요"}</span><img class="i24" src="${ICON("arrow-down")}" alt="" /></button></div>`;
    return `<div class="au-mcard" data-slot="${slot}">
      <div class="au-mcard-head">${m ? auAvatar(m, "is-sm") : `<span class="au-avatar is-sm"><img class="au-avatar-ph" src="${ICON("user-purple")}" alt="" draggable="false" /></span>`}<strong>${m ? auEsc(m) : `팀원 ${slot + 1}`}</strong></div>
      ${sel("member", m, "직원 선택")}
      ${sel("exclude", ex, "배정 제외 대상 선택")}
    </div>`;
}

function openTeamForm(index) {
    const t = index == null ? null : auTeams[index];
    auForm = {
        index: t ? index : null,
        name: t ? t.name : `${auTeams.length + 1}팀`,
        members: t ? t.members.slice(0, 2) : ["", ""],
        exclude: t ? [t.exclude[0] || "", t.exclude[1] || ""] : ["", ""],
    };
    const edit = !!t;
    const el = auOpen(`<div class="hm-box au-form" role="dialog" aria-modal="true" aria-labelledby="auFormTitle">
      <div class="hm-head">
        <div class="au-form-tit"><h2 class="hm-title" id="auFormTitle">${edit ? "팀 수정하기" : "팀 추가하기"}</h2><span>${edit ? "함께 청소할 팀원과 직원별 배정 제외 대상을 설정하세요." : "새로운 청소 팀의 이름과 함께 일할 팀원을 선택하세요."}</span></div>
        <button class="hm-close" type="button" data-form="close" aria-label="닫기">${icon("close", 20)}</button>
      </div>
      <div class="au-form-body">
        <div class="au-form-grp">
          <label class="au-form-lb" for="auTeamName">팀 이름</label>
          <span class="au-name" id="auNameWrap"><input id="auTeamName" type="text" value="${auEsc(auForm.name)}" maxlength="10" autocomplete="off" /></span>
        </div>
        <div class="au-form-grp">
          <div class="au-form-lbs"><strong>팀원 선택</strong><span>서로 다른 직원 2명을 선택해 주세요.</span></div>
          <div class="au-mcards" id="auMCards">${auMemberCard(0)}${auMemberCard(1)}</div>
        </div>
        <div class="as-notice"><img class="i24" src="${ICON("exclamation-circle-gray")}" alt="" /><p>저장한 변경사항은 다음 자동 배정부터 적용됩니다.</p></div>
      </div>
      <div class="hm-foot">
        <button class="btn btn-lg btn-outline" type="button" data-form="close">닫기</button>
        <button class="btn btn-lg btn-primary" type="button" data-form="save">저장</button>
      </div>
    </div>`);
    auForm.el = el;
    el.addEventListener("click", auFormClick);
    el.addEventListener("input", (e) => {
        if (e.target.id === "auTeamName") {
            auForm.name = e.target.value;
            e.target.parentElement.classList.remove("is-error");
        }
    });
    el.querySelector("#auTeamName").focus();
}

function closeAuMenu() {
    if (!auMenu) return;
    auMenu.btn.setAttribute("aria-expanded", "false");
    auMenu.el.remove();
    auMenu = null;
}
function openAuMenu(btn) {
    const same = auMenu && auMenu.btn === btn;
    closeAuMenu();
    if (same) return;
    const kind = btn.dataset.sel;
    const slot = +btn.dataset.slot;
    const cur = auForm[kind === "member" ? "members" : "exclude"][slot];
    const opts = auOptions(slot, kind);
    /* 20명이 넘으면 맨 위에 검색 칸이 나와요 */
    const searchable = opts.length > 20;
    const none = kind === "exclude" ? `<li class="filter-item au-opt is-single${cur === "" ? " is-selected" : ""}" role="option" aria-selected="${cur === ""}" data-opt="" data-nm=""><span class="au-opt-nm">선택 안 함</span></li>` : "";
    const rows = opts
        .map(
            (o) =>
                `<li class="filter-item au-opt is-single${cur === o.n ? " is-selected" : ""}${o.off ? " is-off" : ""}" role="option" aria-selected="${cur === o.n}"${o.off ? ' aria-disabled="true"' : ""} data-opt="${auEsc(o.n)}" data-nm="${auEsc(o.n)}"><span class="au-opt-nm">${auEsc(o.n)}</span></li>`
        )
        .join("");
    const el = document.createElement("div");
    el.className = "filter-menu au-menu";
    el.innerHTML = `${searchable ? '<label class="au-menu-search"><input type="text" placeholder="이름을 검색해 주세요." autocomplete="off" aria-label="직원 검색" /></label>' : ""}<ul class="au-menu-list" role="listbox">${none}${rows}<li class="au-menu-empty" hidden>검색 결과가 없어요.</li></ul>`;
    document.body.appendChild(el);
    const r = btn.getBoundingClientRect();
    el.style.width = `${r.width}px`;
    const h = el.offsetHeight; /* 최대 260px (CSS) */
    const below = innerHeight - r.bottom - 8 - 12;
    const above = r.top - 8 - 12;
    const openDown = h <= below || below >= above;
    el.style.left = `${Math.round(r.left)}px`;
    el.style.top = `${openDown ? r.bottom + 8 : r.top - 8 - Math.min(h, above)}px`;
    el.style.maxHeight = `${Math.max(120, Math.min(260, openDown ? below : above))}px`;
    btn.setAttribute("aria-expanded", "true");
    auMenu = { el, btn, kind, slot };
    const sel = el.querySelector(".is-selected");
    if (sel) sel.scrollIntoView({ block: "nearest" });
    const q = el.querySelector(".au-menu-search input");
    if (q) {
        q.focus();
        q.addEventListener("input", () => {
            const v = q.value.trim();
            let n = 0;
            el.querySelectorAll(".au-opt").forEach((li) => {
                const hit = !v || li.dataset.nm.includes(v);
                li.hidden = !hit;
                if (hit) n++;
            });
            el.querySelector(".au-menu-empty").hidden = n > 0;
        });
    }
    el.addEventListener("click", (e) => {
        const o = e.target.closest("[data-opt]");
        if (!o || o.classList.contains("is-off")) return;
        const val = o.dataset.opt;
        const m = auMenu;
        closeAuMenu();
        auForm[m.kind === "member" ? "members" : "exclude"][m.slot] = val;
        /* 팀원을 바꿨는데 제외 대상이 그 사람이거나 짝꿍이면 비워요 */
        [0, 1].forEach((s) => {
            if (auForm.exclude[s] && (auForm.exclude[s] === auForm.members[s] || auForm.exclude[s] === auForm.members[1 - s])) auForm.exclude[s] = "";
        });
        $("#auMCards", auForm.el).innerHTML = auMemberCard(0) + auMemberCard(1);
    });
}

function auFormClick(e) {
    const f = auForm;
    const sel = e.target.closest("[data-sel]");
    if (sel) return openAuMenu(sel);
    if (auMenu && !e.target.closest(".au-menu")) closeAuMenu();
    const b = e.target.closest("[data-form]");
    if (!b) return;
    if (b.dataset.form === "close") return auClose(f.el);
    /* 저장: 팀 이름이 있고 다른 팀과 겹치지 않으며, 서로 다른 팀원 2명을 골라야 해요 */
    const name = f.name.trim();
    let bad = null;
    const nameWrap = $("#auNameWrap", f.el);
    const dupName = auTeams.some((t, i) => i !== f.index && t.name === name);
    nameWrap.classList.toggle("is-error", !name || dupName);
    if (!name || dupName) bad = $("#auTeamName", f.el);
    f.el.querySelectorAll('[data-sel="member"]').forEach((btn) => {
        const miss = !f.members[+btn.dataset.slot];
        btn.classList.toggle("is-error", miss);
        if (miss && !bad) bad = btn;
    });
    if (bad) return bad.focus();
    const team = { name, members: f.members.slice(), exclude: f.exclude.slice() };
    /* 다른 팀에 있던 직원을 골랐다면 그 팀에서는 빠져요 (한 직원은 한 팀에만 있어요) */
    auTeams.forEach((t, i) => {
        if (i === f.index) return;
        team.members.forEach((m) => {
            const k = t.members.indexOf(m);
            if (k < 0) return;
            t.members.splice(k, 1);
            t.exclude.splice(k, 1);
        });
    });
    if (f.index == null) auTeams.push(team);
    else auTeams[f.index] = team;
    auSaveTeams();
    auClose(f.el);
    auForm = null;
    renderAll();
}

/* ---------- 이벤트 ---------- */
$("#auTeams").addEventListener("click", (e) => {
    const b = e.target.closest("[data-au]");
    if (!b) return;
    const row = b.closest("[data-team]");
    const i = row ? +row.dataset.team : null;
    if (b.dataset.au === "add") openTeamForm(null);
    else if (b.dataset.au === "edit") openTeamForm(i);
    else if (b.dataset.au === "del") auConfirmDelete(i);
});

const auPanel = $("#auPanel");
auPanel.addEventListener("pointerdown", (e) => e.target.closest(".as-rank") && auRankDrag(e));
auPanel.addEventListener("click", (e) => {
    const seg = e.target.closest("[data-seg]");
    if (seg) {
        auDraft[seg.dataset.seg] = seg.dataset.val;
        const g = seg.closest(".ui-seg");
        g.querySelectorAll("button").forEach((x) => {
            const on = x === seg;
            x.classList.toggle("is-on", on);
            x.setAttribute("aria-selected", on);
        });
        return auPositionSeg(g, true);
    }
    const b = e.target.closest("[data-au-set]");
    if (!b) return;
    if (b.dataset.auSet === "close") {
        /* 닫기 = 바꾼 내용을 버리고 저장된 값으로 되돌려요 */
        auDraft = auLoadSet();
        return renderPanel();
    }
    /* 저장: 다른 값(예: 하루 최대 업무량)은 그대로 두고 이 패널의 값만 바꿔요 */
    let cur = {};
    try {
        cur = JSON.parse(localStorage.getItem(AU_SET_KEY)) || {};
    } catch (err) { }
    auDraft.apply = auPanel.querySelector("input[name=auApply]:checked").value;
    auDraft.keepManual = auPanel.querySelector("#auKeep").checked;
    try {
        localStorage.setItem(AU_SET_KEY, JSON.stringify({ ...cur, mode: auDraft.mode, unit: auDraft.unit, order: auDraft.order, apply: auDraft.apply, keepManual: auDraft.keepManual }));
    } catch (err) { }
    /* TODO: 서버 연결 시 여기서 auDraft 를 전송 */
    auDone("저장이 완료되었습니다.");
});
/* 라디오는 둘 중 하나만 선택돼요 / 체크박스는 '오늘 미시작 업무도 다시 배정'을 골랐을 때만 보여요 */
auPanel.addEventListener("change", (e) => {
    if (e.target.name !== "auApply") return;
    auDraft.apply = e.target.value;
    auPanel.querySelector("#auKeepRow").hidden = e.target.value !== "today";
});
window.addEventListener("resize", () => auPanel.querySelectorAll(".ui-seg").forEach((g) => auPositionSeg(g, false)));

/* 패널은 화면 맨 아래(여백 20px)까지만 채우고, 스크롤하면 헤더 아래(120px)까지 올라와 붙어요 (메인 우측 상세 패널과 같은 방식) */
function auFitPanel() {
    if (getComputedStyle(auPanel).position !== "sticky") return (auPanel.style.maxHeight = "");
    const top = Math.max(120, auPanel.getBoundingClientRect().top);
    auPanel.style.maxHeight = Math.max(480, window.innerHeight - top - 20) + "px";
}
window.addEventListener("scroll", auFitPanel, { passive: true });
window.addEventListener("resize", auFitPanel);
auFitPanel();
document.addEventListener("scroll", closeAuMenu, true);

function renderAll() {
    renderStats();
    renderTeams();
}
renderAll();
renderPanel();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => auPanel.querySelectorAll(".ui-seg").forEach((g) => auPositionSeg(g, false)));