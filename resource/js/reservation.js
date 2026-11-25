/* ==========================================================
   예약 현황 (reservation.html / index.js 뒤에 불러와요)
   - 월별 / 주별 달력 (마지막에 본 보기 방식은 localStorage 'rvView' 로 저장 → 다시 열어도 유지)
   - 한 날짜의 번호 줄(날짜 + '+ 외 N건')을 누르면 우측 '날짜 상세' 패널이 열려요
   - 예약 한 칸을 누르면 '개별 일정' 카드가 그 칸 옆에 떠요 (칸과 10px 간격, 카드 위 또는 아래 끝선이 칸과 같은 선)
   - 한 칸 안의 정렬: 대실 → 숙박 순, 같은 종류는 입실 시간이 이른 순서 (위 → 아래)
   - 지금은 샘플 데이터 / 서버 연결 시 RV_RESERVATIONS 만 서버 예약으로 바꾸면 돼요
   ========================================================== */
const RV_VIEW_KEY = "rvView";
const RV_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const RV_MONTH_CAP = 2; /* 월별 칸 하나에 보이는 예약 수 (넘치면 '+ 외 N건') */

/* ---------- 데이터 (서버 연결 시 교체) ----------
   type: "rest"(대실) | "stay"(숙박) · start/end: 입실/퇴실 날짜 · in/out: 입실/퇴실 시간 · ext: 연장(분) */
const RV_BASE = (() => {
  const t = todayMid();
  return new Date(t.getFullYear(), t.getMonth(), 1);
})();
const rvDay = (d) => new Date(RV_BASE.getFullYear(), RV_BASE.getMonth(), d);
let rvSeq = 0;
const RV = (room, type, day, nights, ch, tin, tout, guests = 2, ext = 0) => ({
  id: ++rvSeq,
  room,
  type,
  ch,
  start: rvDay(day),
  end: rvDay(day + (type === "stay" ? nights : 0)),
  in: tin,
  out: tout,
  guests,
  ext,
});
const RV_RESERVATIONS = [
  RV("304", "stay", 7, 1, "nol", "20:00", "11:00"),
  RV("504", "stay", 10, 3, "agoda", "15:00", "11:00", 3),
  RV("305", "stay", 13, 1, "yeogi", "16:00", "11:00"),
  RV("405", "rest", 16, 0, "nol", "13:00", "17:00"),
  RV("102", "rest", 16, 0, "nol", "13:00", "17:00"),
  RV("301", "rest", 16, 0, "trip", "15:00", "19:00"),
  RV("203", "stay", 16, 1, "onda", "17:00", "11:00"),
  RV("105", "rest", 16, 0, "nol", "18:00", "22:00"),
  RV("201", "rest", 17, 0, "nol", "14:00", "18:00"),
  RV("403", "stay", 17, 2, "yeogi", "15:00", "11:00", 2),
  RV("201", "rest", 20, 0, "nol", "13:00", "17:00"),
  RV("304", "stay", 20, 1, "nol", "15:00", "11:00"),
  RV("502", "rest", 20, 0, "agoda", "14:00", "18:00"),
  RV("104", "stay", 20, 2, "yeogi", "16:00", "11:00"),
  RV("303", "rest", 20, 0, "trip", "19:00", "23:00"),
  RV("205", "stay", 20, 1, "onda", "18:00", "11:00"),
  RV("401", "rest", 24, 0, "yeogi", "13:00", "18:00", 2, 60),
  RV("302", "rest", 24, 0, "nol", "13:00", "17:00"),
  RV("205", "rest", 24, 0, "agoda", "19:00", "23:00"),
  RV("101", "stay", 24, 1, "nol", "13:00", "17:00", 2, 120),
  RV("103", "stay", 24, 1, "yeogi", "15:00", "11:00"),
  RV("305", "stay", 22, 2, "trip", "15:00", "11:00"),
  RV("402", "stay", 24, 1, "onda", "17:00", "11:00"),
  RV("504", "stay", 24, 2, "agoda", "20:00", "11:00"),
  RV("101", "rest", 28, 0, "trip", "13:00", "17:00"),
  RV("402", "stay", 29, 2, "trip", "15:00", "11:00"),
];

/* ---------- 채널 로고 (resource/*.svg) ---------- */
/* 시안(기업로고): 높이 15.83 상자 안에 로고 / 로고마다 가로폭이 달라요 (야놀자 24 · 여기어때 40 · 트립닷컴 40 / 온다 32 · 아고다 40은 시안 확인 전 임시값) */
const RV_LOGO_W = { nol: 24, here: 40, trip: 40, onda: 32, agoda: 40 };
const rvLogo = (file, name) =>
  `<span class="rv-logo"><img src="resource/logo/${file}.svg" alt="${name}"${RV_LOGO_W[file] ? ` style="width:${RV_LOGO_W[file]}px"` : ' class="is-auto"'
  } /></span>`;
const RV_CH = {
  nol: { name: "야놀자", html: rvLogo("nol", "야놀자") },
  yeogi: { name: "여기어때", html: rvLogo("here", "여기어때") },
  agoda: { name: "아고다", html: rvLogo("agoda", "아고다") },
  trip: { name: "트립닷컴", html: rvLogo("trip", "트립닷컴") },
  onda: { name: "온다", html: rvLogo("onda", "온다") },
};

/* ---------- 계산 ---------- */
/* 숙박 퇴실 시간: 메인 화면에서 직접 고친 시간이 가장 우선이고, 없으면 '운영 시간대 설정'의 퇴실 시간(평일/주말은 퇴실 날짜 기준)이에요 */
function rvBaseOut(r) {
  if (r.type !== "stay") return r.out;
  const m = ROOMS.find(
    (x) =>
      !x.empty &&
      x.no === r.room &&
      x.end &&
      x.end.getTime() === r.end.getTime() &&
      x.outLocked
  );
  if (m) return m.out;
  return HOURS[hoursKey(r)]?.out || r.out;
}
const rvKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const rvSame = (a, b) => rvKey(a) === rvKey(b);
const rvFmtMD = (d) => `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
const rvFmtFull = (d) =>
  `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${RV_DAYS[d.getDay()]
  })`;
const rvExtText = (m) =>
  m % 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분 연장` : `${m / 60}시간 연장`;

/* 퇴실 시간을 직접 바꾼 예약은 그 시간이 가장 우선이에요 (이 브라우저에 보관 / 서버 연결 시 서버 값으로 교체) */
const RV_OVER_KEY = "rvOutOver";
let RV_OVER = {};
try {
  RV_OVER = JSON.parse(localStorage.getItem(RV_OVER_KEY)) || {};
} catch (e) { }
const rvOut = (r) => RV_OVER[r.id] || rvBaseOut(r);
const rvToMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
/* 연장 시간: 처음 퇴실 시간(운영 규칙 · 예약 원래 시간)보다 늦춘 만큼 */
const rvExt = (r) => {
  const orig = rvToMin(rvBaseOut(r)) - (r.ext || 0);
  return RV_OVER[r.id] ? Math.max(0, rvToMin(RV_OVER[r.id]) - orig) : r.ext || 0;
};

/* 그 날짜에 걸친 예약: 대실 → 숙박, 입실 시간이 이른 순 */
const rvOnDay = (d) =>
  RV_RESERVATIONS.filter((r) => d >= r.start && d <= r.end).sort(
    (a, b) =>
      (a.type === b.type ? 0 : a.type === "rest" ? -1 : 1) ||
      a.in.localeCompare(b.in) ||
      a.room.localeCompare(b.room)
  );

let rvView = "month";
try {
  if (localStorage.getItem(RV_VIEW_KEY) === "week") rvView = "week";
} catch (e) { }
let rvAnchor = todayMid(); /* 지금 보고 있는 달/주를 알려주는 날짜 */
let rvSel = rvView === "month" ? todayMid() : null; /* 선택한 날짜 (우측 패널) / 월별 보기는 처음에 오늘 날짜가 열려 있어요 */
let rvTab = "all";
let rvPop = null; /* {id, date, el} */

/* 한 주(7칸) 안에서 여러 날에 걸친 예약이 같은 줄(slot)에 놓이도록 줄 번호를 정해요
   - 날짜 순서대로 훑으면서, 이미 줄이 정해진 예약은 그대로 두고 새 예약은 (대실 → 숙박, 이른 시간 순으로) 빈 줄에 넣어요
   - 결과: { 날짜키: [slot0, slot1, ...] }  (빈 줄은 null) */
function rvSlots(days) {
  const out = {};
  for (let i = 0; i < days.length; i += 7) {
    const own = {};
    days.slice(i, i + 7).forEach((d) => {
      const list = rvOnDay(d);
      const row = [];
      list.forEach((r) => {
        if (own[r.id] !== undefined) row[own[r.id]] = r;
      });
      list.forEach((r) => {
        if (own[r.id] !== undefined) return;
        let k = 0;
        while (row[k]) k++;
        own[r.id] = k;
        row[k] = r;
      });
      out[rvKey(d)] = Array.from(row, (x) => x || null);
    });
  }
  return out;
}

/* ---------- 예약 한 칸 ----------
   칸의 왼쪽 끝마디 = 예약이 시작하는 날, 오른쪽 끝마디 = 예약이 끝나는 날. 사이 날짜는 끝마디 없이 이어져요 */
function rvBar(r, d) {
  const first = rvSame(d, r.start);
  const last = rvSame(d, r.end);
  const span = r.start.getTime() !== r.end.getTime();
  /* 여러 날에 걸친 예약은 한 줄로 이어진 하나의 칸처럼 보여요: 글자는 시작 칸과 (줄이 바뀌는) 일요일 칸에만 써요 */
  const show = !span || first || d.getDay() === 0;
  const time = `${r.in} - ${rvOut(r)}`; /* 숙박도 퇴실 시간까지 모두 보여줘요 */
  const pick = rvPop && rvPop.id === r.id ? " is-picked" : "";
  /* 기업 로고는 시안처럼 (한 줄로 이어진) 막대의 오른쪽 끝에 둬요: 끝 칸 또는 줄이 바뀌는 토요일 칸 */
  const logoHere = !span || last || d.getDay() === 6;
  return `<button class="rv-bar rv-${r.type}${first ? " is-first" : ""}${last ? " is-last" : ""
    }${show ? "" : " is-cont"}${pick}" type="button" data-rid="${r.id
    }" data-date="${rvKey(d)}">
        <span class="rv-bar-top"><b>${r.room}</b>${logoHere ? RV_CH[r.ch].html : ""
    }</span>
        <span class="rv-bar-time">${time || "&nbsp;"}</span>
        ${first ? '<i class="rv-cap rv-cap-l"></i>' : ""}${last ? '<i class="rv-cap rv-cap-r"></i>' : ""
    }
    </button>`;
}

/* ---------- 달력 ---------- */
function rvRange() {
  if (rvView === "week") {
    const s = dayAdd(rvAnchor, -rvAnchor.getDay());
    return { start: s, end: dayAdd(s, 6) };
  }
  const first = new Date(rvAnchor.getFullYear(), rvAnchor.getMonth(), 1);
  const last = new Date(rvAnchor.getFullYear(), rvAnchor.getMonth() + 1, 0);
  return {
    start: dayAdd(first, -first.getDay()),
    end: dayAdd(last, 6 - last.getDay()),
    first,
    last,
  };
}

function rvDayHead(d, hidden, other) {
  const today = rvSame(d, todayMid());
  const sel = rvSel && rvSame(d, rvSel);
  const more =
    hidden > 0 ? `<span class="rv-more">+ 외 ${hidden}건</span>` : "";
  return `<button class="rv-dayhead${other ? " is-other" : ""
    }" type="button" data-pick="${rvKey(d)}" aria-label="${rvFmtFull(
      d
    )} 상세 열기">
        <span class="rv-day${today ? " is-today" : ""}${sel ? " is-sel" : ""
    }">${d.getDate()}</span>${more}
    </button>`;
}

function renderReserve() {
  const t = $("#rvTable");
  const { start, end, first, last } = rvRange();
  const todayD = todayMid();
  $("#rvTitle").textContent =
    rvView === "week"
      ? `${start.getFullYear()}년 ${start.getMonth() + 1
      }월 ${start.getDate()}일 ~ ${end.getMonth() + 1}월 ${end.getDate()}일`
      : `${rvAnchor.getFullYear()}년 ${rvAnchor.getMonth() + 1}월`;
  document.querySelectorAll("#rvView button").forEach((b) => {
    const on = b.dataset.view === rvView;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-selected", on);
  });
  const days = [];
  for (let d = start; d <= end; d = dayAdd(d, 1)) days.push(d);

  const slots = rvSlots(days);
  const slotHtml = (d, cap) =>
    slots[rvKey(d)]
      .slice(0, cap)
      .map((r) => (r ? rvBar(r, d) : '<i class="rv-gap"></i>'))
      .join("");
  if (rvView === "week") {
    t.className = "rv-table rv-week";
    t.innerHTML =
      `<div class="rv-thead">${days
        .map((d) => {
          const today = rvSame(d, todayD);
          return `<div class="rv-th${today ? " is-today" : ""}">
                        <small>${RV_DAYS[d.getDay()]
            }</small><strong>${d.getDate()}</strong></div>`;
        })
        .join("")}</div>` +
      `<div class="rv-tbody"><div class="rv-wgrid">${days
        .map((d) => `<div class="rv-wcell">${slotHtml(d, 99)}</div>`)
        .join("")}</div></div>`;
  } else {
    t.className = "rv-table rv-month";
    t.innerHTML =
      `<div class="rv-thead">${RV_DAYS.map(
        (w) => `<div class="rv-th"><span>${w}</span></div>`
      ).join("")}</div>` +
      `<div class="rv-tbody"><div class="rv-mgrid">${days
        .map((d) => {
          const total = rvOnDay(d).length;
          const hidden = slots[rvKey(d)]
            .slice(RV_MONTH_CAP)
            .filter(Boolean).length;
          const other = d < first || d > last;
          return `<div class="rv-cell${other ? " is-other" : ""}">${rvDayHead(
            d,
            hidden,
            other
          )}
                        <div class="rv-list">${slotHtml(
            d,
            RV_MONTH_CAP
          )}</div></div>`;
        })
        .join("")}</div></div>`;
  }

  /* 동일 예약 그룹 Hover 처리 */
  if (!t.dataset.rvGroupHoverBound) {
    t.dataset.rvGroupHoverBound = "true";

    t.addEventListener("pointerover", (e) => {
      const bar = e.target.closest(".rv-bar");
      if (!bar) return;
      t.querySelectorAll(`.rv-bar[data-rid="${bar.dataset.rid}"]`).forEach(
        (el) => el.classList.add("is-hover")
      );
    });

    t.addEventListener("pointerout", (e) => {
      const bar = e.target.closest(".rv-bar");
      if (!bar) return;
      const next = e.relatedTarget?.closest?.(".rv-bar");
      if (next?.dataset.rid === bar.dataset.rid) return;
      t.querySelectorAll(`.rv-bar[data-rid="${bar.dataset.rid}"]`).forEach(
        (el) => el.classList.remove("is-hover")
      );
    });
  }
}

/* ---------- 우측 '날짜 상세' 패널 ---------- */
function rvCard(r, pop) {
  const stay = r.type === "stay";
  const ext = rvExt(r);
  const outBtn = `<button class="rv-out-btn" type="button" data-rv-out="${r.id}">퇴실 시간 변경</button>`;
  const miniExt = ext ? `<em class="rv-mini">${rvExtText(ext)}</em>` : "";
  const chRow = `<div><dt>예약</dt><dd>${RV_CH[r.ch].html}</dd></div>`;
  const nights = dayDiff(r.start, r.end);
  const sched = `${rvFmtMD(r.start)} - ${rvFmtMD(r.end)}${stay ? ` (${nights}박)` : ""
    }`;
  return `<div class="rv-card">
        <div class="rv-card-tit"><strong>${r.room
    }호</strong><span class="badge ${stay ? "badge-primary" : "badge-todo"
    }">${stay ? "숙박" : "대실"}</span></div>
        <dl class="rv-info">
            ${pop ? "" : chRow}
            <div><dt>일정</dt><dd>${sched}</dd></div>
            <div><dt>인원</dt><dd>${r.guests}명</dd></div>
            <div><dt>입실</dt><dd>${r.in}</dd></div>
            ${pop
      ? `<div><dt>퇴실</dt><dd>${rvOut(r)}${miniExt}${outBtn}</dd></div>`
      : `<div class="is-top"><dt>퇴실</dt><dd class="rv-out"><span class="rv-out-line"><span>${rvOut(r)}</span>${miniExt}</span>${outBtn}</dd></div>`
    }
            ${pop ? chRow : ""}
        </dl>
    </div>`;
}

function renderRvDetail() {
  const p = $("#rvDetail");
  const lay = $("#rvLayout");
  if (!rvSel) {
    p.hidden = true;
    lay.classList.remove("has-detail");
    return;
  }
  const all = rvOnDay(rvSel);
  const rest = all.filter((r) => r.type === "rest").length;
  const list = all.filter((r) => rvTab === "all" || r.type === rvTab);
  const tabs = [
    ["all", "전체"],
    ["stay", "숙박"],
    ["rest", "대실"],
  ];
  const keepScroll = p.querySelector(".rv-d-body")?.scrollTop || 0;
  p.innerHTML = `<div class="rs-d-head"><h2>날짜 상세</h2>
            <button class="rs-x" type="button" data-rv="close-detail" aria-label="닫기">${icon(
    "close",
    24
  )}</button></div>
        <div class="rv-d-body">
            <p class="rv-d-date">${rvFmtFull(rvSel)}</p>
            <section class="rv-d-sec"><h3>예약 요약</h3>
                <dl class="rv-sum"><div><dt>총 예약</dt><dd>${all.length
    }건</dd></div><div><dt>대실</dt><dd>${rest}건</dd></div><div><dt>숙박</dt><dd>${all.length - rest
    }건</dd></div></dl>
            </section>
            <section class="rv-d-sec"><h3>예약 목록</h3>
                <div class="rv-seg rv-seg-full" role="tablist">${tabs
      .map(
        ([k, v]) =>
          `<button type="button" role="tab" class="${rvTab === k ? "is-on" : ""
          }" data-rv-tab="${k}">${v}</button>`
      )
      .join("")}</div>
                <div class="rv-cards">${list.length
      ? list.map(rvCard).join("")
      : '<p class="rv-empty">예약이 없어요.</p>'
    }</div>
            </section>
        </div>`;
  p.hidden = false;
  lay.classList.add("has-detail");
  p.querySelector(".rv-d-body").scrollTop = keepScroll;
}

/* ---------- 개별 일정 카드 (예약 한 칸 선택) ---------- */
function closeRvPop() {
  if (!rvPop) return;
  rvPop.el.remove();
  rvPop = null;
  document
    .querySelectorAll(".rv-bar.is-picked")
    .forEach((b) => b.classList.remove("is-picked"));
}

function openRvPop(bar) {
  const r = RV_RESERVATIONS.find((x) => x.id === +bar.dataset.rid);
  if (!r) return;
  const [y, m, dd] = bar.dataset.date.split("-").map(Number);
  const date = new Date(y, m - 1, dd);
  closeRvPop();
  document
    .querySelectorAll(`.rv-bar[data-rid="${r.id}"]`)
    .forEach((b) => b.classList.add("is-picked"));
  const el = document.createElement("div");
  el.className = "rv-pop";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "개별 일정");
  el.innerHTML = `<div class="rv-pop-head"><h3>${rvFmtFull(date)}</h3>
        <button class="rs-x" type="button" data-rv="close-pop" aria-label="닫기">${icon(
    "close",
    24
  )}</button></div>
        <div class="rv-pop-body">${rvCard(r, true).replace(
    'class="rv-card"',
    'class="rv-card is-plain"'
  )}</div>`;
  document.body.appendChild(el);
  rvPop = { id: r.id, date, el };
  rvPlacePop(bar);
}

/* 카드는 칸의 오른쪽(자리가 없으면 왼쪽)에 10px 띄워서 놓고,
   카드의 맨 위선을 칸의 맨 위선에 맞춰요 (아래로 넘치면 카드의 맨 아래선을 칸의 맨 아래선에 맞춰요) */
function rvPlacePop(bar) {
  if (!rvPop) return;
  const el = rvPop.el;
  const b = bar.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const GAP = 10;
  const M = 20;
  let left = b.right + GAP;
  if (left + w > innerWidth - M) left = b.left - GAP - w;
  if (left < M)
    left = Math.max(
      M,
      Math.min(innerWidth - M - w, b.left + (b.width - w) / 2)
    );
  let top = b.top;
  if (top + h > innerHeight - M) top = b.bottom - h;
  top = Math.max(M, top);
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

/* ---------- 퇴실 시간 변경 ---------- */
function rvOpenOutModal(id) {
  const r = RV_RESERVATIONS.find((x) => x.id === id);
  if (!r) return;
  const el = document.createElement("div");
  el.className = "hm rv-out-md";
  el.innerHTML = `<div class="hm-box" role="dialog" aria-modal="true" aria-label="퇴실 시간 변경">
      <div class="hm-head"><h2 class="hm-title">퇴실 시간 변경</h2>
        <button class="hm-close" type="button" data-out-x aria-label="닫기">${icon("close", 24)}</button></div>
      <div class="hm-body"><p class="rv-out-sub">${r.room}호 · 현재 ${rvOut(r)}</p>${timePickerHtml("rvOutTime", rvOut(r))}</div>
      <div class="hm-foot"><button class="btn btn-lg btn-outline" type="button" data-out-x>취소</button>
        <button class="btn btn-lg btn-primary" type="button" data-out-save>저장</button></div>
    </div>`;
  document.body.appendChild(el);
  initTimePicker(el);
  const close = () => {
    el.remove();
    document.removeEventListener("keydown", onKey, true);
  };
  const onKey = (e) => {
    if (e.key === "Escape" && el.querySelector(".tp-panel[hidden]")) close();
  };
  document.addEventListener("keydown", onKey, true);
  el.addEventListener("mousedown", (e) => (el._down = e.target === el));
  el.addEventListener("click", (e) => {
    if ((e.target === el && el._down) || e.target.closest("[data-out-x]")) return close();
    if (!e.target.closest("[data-out-save]")) return;
    const t = $("#rvOutTime", el).value;
    if (t === rvBaseOut(r)) delete RV_OVER[r.id];
    else RV_OVER[r.id] = t;
    try {
      localStorage.setItem(RV_OVER_KEY, JSON.stringify(RV_OVER));
    } catch (err) { }
    close();
    const pop = rvPop;
    renderReserve();
    renderRvDetail();
    if (pop) {
      const bar = document.querySelector(`.rv-bar[data-rid="${pop.id}"][data-date="${rvKey(pop.date)}"]`);
      closeRvPop();
      if (bar) openRvPop(bar);
    }
  });
  el.querySelector(".tp-field").focus();
}

/* ---------- 이동 / 선택 ---------- */
function rvMove(dir) {
  closeRvPop();
  if (rvView === "week") rvAnchor = dayAdd(rvAnchor, 7 * dir);
  else
    rvAnchor = new Date(rvAnchor.getFullYear(), rvAnchor.getMonth() + dir, 1);
  renderReserve();
}

function rvSetView(v) {
  if (v === rvView) return;
  closeRvPop();
  rvView = v;
  /* 주별 보기에서는 우측 '날짜 상세' 패널을 쓰지 않아요 / 월별 보기로 돌아오면 오늘 날짜가 다시 열려요 */
  rvSel = v === "month" ? todayMid() : null;
  renderRvDetail();
  try {
    localStorage.setItem(RV_VIEW_KEY, v);
  } catch (e) { }
  /* 월 ↔ 주 전환 시 보던 날짜 근처를 유지해요 */
  if (v === "month")
    rvAnchor = new Date(
      rvAnchor.getFullYear(),
      rvAnchor.getMonth(),
      1 +
      (rvSame(rvAnchor, todayMid())
        ? todayMid().getDate() - 1
        : rvAnchor.getDate() - 1)
    );
  renderReserve();
}

function rvSelect(key) {
  if (rvView === "week") return;
  const [y, m, d] = key.split("-").map(Number);
  const nd = new Date(y, m - 1, d);
  closeRvPop();
  if (rvSel && rvSame(rvSel, nd)) {
    /* 같은 날짜를 다시 누르면 패널이 닫혀요 */
    rvSel = null;
  } else {
    rvSel = nd;
    rvTab = "all";
  }
  renderReserve();
  renderRvDetail();
}

function handleReserveClick(e) {
  if (!$("#viewReserve")) return false;

  /* 예약 바 클릭 우선 */
  const bar = e.target.closest(".rv-bar");
  if (bar) {
    if (rvPop && rvPop.id === +bar.dataset.rid) closeRvPop();
    else openRvPop(bar);
    return true;
  }

  const outBtn = e.target.closest("[data-rv-out]");
  if (outBtn) {
    rvOpenOutModal(+outBtn.dataset.rvOut);
    return true;
  }

  if (e.target.closest(".rv-pop")) {
    if (e.target.closest('[data-rv="close-pop"]')) closeRvPop();
    return true;
  }

  closeRvPop();

  /* 날짜 헤더 클릭 */
  const pick = e.target.closest("[data-pick]");
  if (pick) {
    rvSelect(pick.dataset.pick);
    return true;
  }
  /* 날짜 셀 전체 클릭 */
  const cell = e.target.closest(".rv-cell");
  if (cell) {
    const date = cell.querySelector("[data-pick]")?.dataset.pick;
    if (date) rvSelect(date);
    return true;
  }

  if (e.target.closest('[data-rv="close-detail"]')) {
    rvSel = null;
    renderReserve();
    renderRvDetail();
    return true;
  }

  const tab = e.target.closest("[data-rv-tab]");
  if (tab) {
    if (rvTab === tab.dataset.rvTab) return true;
    rvTab = tab.dataset.rvTab;
    const group = tab.closest(".rv-seg");
    group.querySelectorAll("button").forEach((btn) => {
      const on = btn === tab;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-selected", on);
    });

    const list = rvOnDay(rvSel).filter(
      (r) => rvTab === "all" || r.type === rvTab
    );
    const cards = $("#rvDetail .rv-cards");

    if (cards) {
      cards.innerHTML = list.length
        ? list.map(rvCard).join("")
        : '<p class="rv-empty">예약이 없어요.</p>';
    }

    return true;
  }

  const v = e.target.closest("#rvView [data-view]");
  if (v) {
    rvSetView(v.dataset.view);
    return true;
  }

  if (e.target.closest("#rvPrev")) return rvMove(-1), true;
  if (e.target.closest("#rvNext")) return rvMove(1), true;
  if (e.target.closest("#rvToday")) {
    rvAnchor = todayMid();
    renderReserve();
    return true;
  }

  return false;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && rvPop) closeRvPop();
});
addEventListener("resize", () => {
  if (!rvPop) return;
  const bar = document.querySelector(
    `.rv-bar.is-picked[data-date="${rvKey(rvPop.date)}"]`
  );
  if (bar) rvPlacePop(bar);
  else closeRvPop();
});
document.addEventListener("scroll", () => closeRvPop(), true);

renderReserve();
renderRvDetail();