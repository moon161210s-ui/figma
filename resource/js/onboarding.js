/* ==========================================================
   최초 진입 온보딩 (index.html · standard.html · user-assign.html · user-auto.html)
   - 화면에 처음 들어오면 한 번만 보여줘요 (끝내거나 건너뛰면 다시 안 떠요)
   - 다시 보려면 주소 뒤에 ?onboarding 을 붙이거나 콘솔에서 startOnboarding(true) 를 실행하세요
   - 저장 위치: localStorage 'onboarding:<화면 이름>' = "done"  (서버 연결 시 이 값만 계정 값으로 바꾸면 돼요)
   - 말풍선 · 강조 영역 · 문구는 Figma 온보딩 시안(2525:68700)을 따랐어요
   ========================================================== */
(function () {
    const GAP = 16; /* 강조 영역과 말풍선 화살표 끝 사이 */
    const EDGE = 24; /* 화면 가장자리 여백 */
    const BOX_W = 480;
    const ARROW_LONG = 50;
    const ARROW_SHORT = 36;

    const $one = (s, r = document) => r.querySelector(s);
    const $all = (s, r = document) => [...r.querySelectorAll(s)];
    const byText = (sel, text, root) => $all(sel, root).find((e) => e.textContent.trim().includes(text));

    /* ---------- 화면별 단계 ----------
       sel: 강조할 요소(들) / pad: [위아래, 좌우] 또는 숫자 / r: 모서리 / side: 말풍선이 놓일 방향(below · above · left · right)
       lines: 설명 (줄바꿈은 시안 그대로) */
    const PAGES = {
        home: {
            key: "home",
            prepare() {
                /* 시안은 객실을 하나 눌러 우측 패널이 열린 상태예요 */
                if (typeof selectedNo === "undefined" || selectedNo) return false;
                const card = $all(".room-card[data-room]").find((c) => {
                    const r = ROOMS.find((x) => x.no === c.dataset.room);
                    return r && !r.empty && !(typeof isStayOnly === "function" && isStayOnly(r));
                });
                if (!card) return false;
                selectRoom(card.dataset.room);
                return true;
            },
            restore() {
                const close = $one("#detail [data-close]");
                if (close) close.click();
            },
            steps: [
                { sel: () => $one(".summary"), r: 16, side: "below", title: "오늘 숙소 상황을 숫자로 먼저 봐요", lines: ["오늘 입실, 퇴실, 청소할 객실 수가 한눈에 보여요."] },
                {
                    sel: () => $one("[data-summary-card='alert']"),
                    r: 16,
                    side: "left",
                    title: "빨간 숫자는 지금 바로 확인할 객실이에요",
                    lines: ["청소가 끝나 검수를 기다리거나,", "담당자가 빠져 다시 배정해야 하는 객실 수예요.", "클릭하면 해당 내용만 따로 볼 수 있어요."],
                },
                { sel: () => $one(".toggle-row"), pad: [24, 12], r: 16, side: "right", title: ["버튼을 켜면 오늘 청소할 객실만", "모아볼 수 있어요"], lines: ["끄면 오늘 청소가 없는 전체 객실까지 보여요."] },
                {
                    sel: () => $one(".toolbar-right"),
                    pad: [17, 17],
                    r: 16,
                    side: "left",
                    title: "층이나 청소 상태로 골라서 볼 수 있어요",
                    lines: ["보고 싶은 상태의 객실을 고르면", "확인하려는 객실을 더 빨리 찾을 수 있어요."],
                },
                {
                    sel: () => $one(".room-card.is-selected") || $one(".room-card"),
                    pad: [10, 10] /* 시안: 카드 + 보라색 선택 테두리가 다 보이게 사방 10px 여유 */,
                    r: 16,
                    side: "right",
                    title: "색으로 청소 상태를 구분해요",
                    lines: ["초록은 청소 완료, 주황은 검수 대기, 빨강은 재배정 필요예요. ‘N시간 연장’, ‘직원 미확인’, ‘조퇴’ 같은 회색 상태도 있어요."],
                },
                {
                    sel: () => $one("#detail"),
                    r: 16,
                    side: "left",
                    title: "이 객실의 모든 일정이 모여 있어요",
                    lines: ["왼쪽에서 객실을 클릭하면 열리고,", "객실 유형, 숙박 일정, 퇴실 예정, 청소 가능 시간,", "담당 직원을 한 곳에서 볼 수 있어요."],
                },
                {
                    sel: () => {
                        const row = byText("#detail .detail-row", "퇴실 예정");
                        return (row && row.closest(".detail-group")) || row;
                    },
                    pad: [8, 8],
                    r: 12,
                    side: "left",
                    title: "퇴실 시간이 바뀌었는지 확인해요",
                    lines: ["손님이 퇴실을 미루면 바뀐 시간과 표시가 보여요.", "담당 직원이 변경된 시간을 확인하기 전까지는", "‘직원 미확인’으로 표시돼요.", "퇴실 시간은 예약 현황 관리에서 바꿀 수 있어요."],
                },
                {
                    sel: () => byText("#detail .detail-row", "담당 직원"),
                    pad: [8, 8],
                    r: 12,
                    side: "left",
                    title: "이 객실을 담당하는 직원이에요",
                    lines: ["담당자 변경은 직원 관리의", "청소 직원 재배정에서 할 수 있어요."],
                },
            ],
        },

        standard: {
            key: "standard",
            steps: [
                {
                    sel: () => $one(".rl-types"),
                    r: 16,
                    side: "below",
                    title: "객실 타입별로 체크리스트를 추가해요",
                    lines: ["전체 공통은 모든 객실에 적용되고,", "스탠다드 · 디럭스처럼 타입을 고르면 그 객실에만", "적용되는 체크리스트를 추가할 수 있어요."],
                },
                {
                    sel: () => $all(".rl-sec")[0],
                    pad: [20, 20], /* 시안(2528:49695): 섹션보다 사방 20px 정도 넓게 */
                    r: 16,
                    side: "left",
                    title: "정리된 모습을 사진으로 보여주세요",
                    lines: ["여기 올린 사진은 직원 화면에 예시로 보여요.", "객실이 어떤 상태여야 하는지 말 대신 사진으로", "알려줄 수 있어요."],
                },
                {
                    sel: () => $all(".rl-sec")[1],
                    pad: [20, 20], /* 시안(2528:49695): 섹션보다 사방 20px 정도 넓게 */
                    r: 16,
                    side: "left",
                    title: "직원이 필수로 확인할 항목을 적어요",
                    lines: ["여기에 추가한 항목은 담당 직원의 체크리스트에", "그대로 들어가요. 직원은 모든 항목을 체크해야", "청소를 완료할 수 있어요."],
                },
                {
                    sel: () => $all(".rl-sec")[2],
                    pad: [20, 20], /* 시안(2528:49695): 섹션보다 사방 20px 정도 넓게 */
                    r: 16,
                    side: "left",
                    title: "완료할 때 받을 사진을 정해요",
                    lines: ["어떤 사진을 어떻게 찍을지 적어두면,", "직원은 그 기준에 맞게 사진을 올려야", "청소를 완료할 수 있어요."],
                },
                {
                    sel: () => $one("#rlPreview"),
                    r: 12,
                    side: "below",
                    title: "직원에게 어떻게 보여지는지 확인해요",
                    lines: ["직원 화면에서는 체크리스트가 어떻게 보이는지", "미리 볼 수 있어요."],
                },
                { sel: () => $one("#rlSave"), r: 12, side: "below", title: "마지막에 꼭 저장해 주세요", lines: ["저장해야 직원 화면에 반영돼요."] },
            ],
        },

        assign: {
            key: "assign",
            steps: [
                {
                    sel: () => $one(".as-workers"),
                    r: 16,
                    side: "right",
                    title: "지금 일하는 직원/직원조를 한눈에 봐요",
                    lines: ["직원/조별로 남은 객실 수와 다음 청소 시간이 보여요.", "손이 비는 직원이나 곧 청소가 끝날 직원을 바로", "찾을 수 있어요."],
                },
                {
                    sel: () => $one(".as-user"),
                    r: 16,
                    side: "below",
                    title: ["이름 카드를 끌어다", "우측 객실 카드에 놓으면 배정돼요"],
                    lines: ["왼쪽 목록에서 직원/직원조의 카드를 끌어서", "객실의 빈칸에 놓으면 담당자가 바뀌어요. (드래그)"],
                },
                {
                    sel: () => $all(".as-room.is-need").slice(0, 2),
                    r: 16,
                    side: "below",
                    title: "빨간 표시가 있는 객실부터 확인하세요",
                    lines: ["결근, 조퇴 등의 이유로 담당자가 빠진 객실에는 ‘재배정 필요’가 떠요."],
                },
                {
                    sel: () => $one(".as-tabs"),
                    r: 12,
                    side: "below",
                    title: "내일 배정도 미리 바꿀 수 있어요",
                    lines: ["내일 버튼을 누르면", "내일 배정 현황을 보고 미리 수정할 수 있어요."],
                },
                {
                    sel: () => $one("#asSave"),
                    r: 12,
                    side: "below",
                    title: "다 배정했다면 저장을 눌러주세요",
                    lines: ["저장하면 새로 배정된 직원에게 알림을 보내요.", "직원이 알림을 확인하면, 사장님도 알림센터에서 확인 여부를 알 수 있어요."],
                },
            ],
        },

        auto: {
            key: "auto",
            steps: [
                { sel: () => $one("#auStats"), r: 16, side: "below", title: "우리 숙소 청소 인력을 먼저 확인해요", lines: ["청소 조 규모, 전체 직원,", "지금 배정 가능한 직원 수가 보여요."] },
                {
                    sel: () => $one("[data-au='add']"),
                    r: 12,
                    side: "below",
                    title: "함께 청소할 2인 1조를 만들어요",
                    lines: ["손발이 잘 맞는 직원 두 명을 한 조로 묶어두면,", "자동 배정이 조 단위로 객실을 배정해요"],
                },
                {
                    sel: () => $one(".au-edit"),
                    r: 10,
                    side: "above",
                    title: "청소 조를 바꿀 수 있어요",
                    lines: ["조원을 바꾸거나,", "같은 조로 배정되지 않게 할 직원을 정할 수 있어요.", "저장하면 다음 자동 배정부터 반영돼요."],
                },
                {
                    sel: () => $all("#auPanel .as-set-top"),
                    pad: [12, 24],
                    r: 16,
                    side: "left",
                    title: "배정 방식을 골라요",
                    lines: ["자동 배정을 켜면 청소 일정이 생길 때 알아서 배정돼요.", "조별 배정은 조 단위로,", "개인 배정은 한 명씩 객실을 맡겨요."],
                },
                {
                    sel: () => $all("#auPanel .as-set-sec")[2],
                    pad: [12, 16],
                    r: 16,
                    side: "above",
                    title: "배정을 어떤 기준으로 반영할지 순서를 정해요",
                    lines: ["카드를 위아래로 끌어서 순위를 바꿀 수 있어요.", "위에 있는 기준부터 먼저 적용돼요."],
                },
            ],
        },
    };

    const file = (location.pathname.split("/").pop() || "index.html").replace(".html", "");
    const pageName = { index: "home", "": "home", standard: "standard", "user-assign": "assign", "user-auto": "auto" }[file];
    const page = PAGES[pageName];
    if (!page) return;

    const STORE = `onboarding:${page.key}`;
    const seen = () => {
        try {
            return localStorage.getItem(STORE) === "done";
        } catch (e) {
            return false;
        }
    };
    const markSeen = () => {
        try {
            localStorage.setItem(STORE, "done");
        } catch (e) { }
        /* TODO: 서버 연결 시 여기서 '온보딩 완료'를 계정에 저장 */
    };

    /* ---------- 말풍선 화살표 (Figma polygon 50x36, 끝이 살짝 둥글어요) ---------- */
    const ARROWS = {
        up: `<svg width="50" height="36" viewBox="0 0 50 36" fill="none" aria-hidden="true"><path d="M0 36 22.4 4.2a3.4 3.4 0 0 1 5.2 0L50 36Z" fill="currentColor"/></svg>`,
        down: `<svg width="50" height="36" viewBox="0 0 50 36" fill="none" aria-hidden="true"><path d="M0 0 22.4 31.8a3.4 3.4 0 0 0 5.2 0L50 0Z" fill="currentColor"/></svg>`,
        left: `<svg width="36" height="50" viewBox="0 0 36 50" fill="none" aria-hidden="true"><path d="M36 0 4.2 22.4a3.4 3.4 0 0 0 0 5.2L36 50Z" fill="currentColor"/></svg>`,
        right: `<svg width="36" height="50" viewBox="0 0 36 50" fill="none" aria-hidden="true"><path d="M0 0 31.8 22.4a3.4 3.4 0 0 1 0 5.2L0 50Z" fill="currentColor"/></svg>`,
    };
    const ARROW_FOR_SIDE = { below: "up", above: "down", right: "left", left: "right" };

    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    let root = null;
    let steps = [];
    let idx = 0;
    let openedByUs = false;
    let raf = 0;

    const holeRect = (step) => {
        let els = step.sel();
        els = (Array.isArray(els) ? els : [els]).filter(Boolean);
        if (!els.length) return null;
        let l = Infinity,
            t = Infinity,
            r = -Infinity,
            b = -Infinity;
        els.forEach((e) => {
            const q = e.getBoundingClientRect();
            l = Math.min(l, q.left);
            t = Math.min(t, q.top);
            r = Math.max(r, q.right);
            b = Math.max(b, q.bottom);
        });
        /* 여유(pad)를 따로 정하지 않은 버튼 대상은 구멍을 버튼 크기·모서리 그대로 뚫어요 (객실 카드처럼 pad가 있는 단계는 제외) */
        if (step.pad === undefined && els.length === 1 && els[0].matches("button, .btn, [role='button']")) {
            const q = els[0].getBoundingClientRect();
            const cs = getComputedStyle(els[0]);
            const rad = Math.round(parseFloat(cs.borderTopLeftRadius)) || 0;
            return { left: Math.round(q.left), top: Math.round(q.top), width: Math.round(q.width), height: Math.round(q.height), radius: rad };
        }
        /* 시안 여유값은 1920 화면 기준이에요. 화면이 줄어 안의 요소가 작아지면 사방 여유도 같은 비율로 줄여요 (본문 폭 1640px 기준 / 정수로 반올림) */
        const k = Math.min(1, Math.max(0.3, (window.innerWidth - 260) / 1640));
        const pad = (Array.isArray(step.pad) ? step.pad : [step.pad || 0, step.pad || 0]).map((v) => Math.round(v * k));
        return { left: Math.round(l - pad[1]), top: Math.round(t - pad[0]), width: Math.round(r - l + pad[1] * 2), height: Math.round(b - t + pad[0] * 2) };
    };

    function build(step, i, total) {
        const first = i === 0;
        const last = i === total - 1;
        const titleLines = Array.isArray(step.title) ? step.title : [step.title];
        return `
      <div class="ob-hole" aria-hidden="true"></div>
      <div class="ob-tip" role="dialog" aria-modal="true" aria-labelledby="obTitle">
        <span class="ob-arrow" aria-hidden="true"></span>
        <div class="ob-box">
          <div class="ob-text">
            <h2 id="obTitle">${titleLines.map(esc).join("<br />")}</h2>
            <p>${step.lines.map(esc).join("<br />")}</p>
          </div>
          <div class="ob-foot">
            <div class="ob-row">
              <span class="ob-count">${i + 1} of ${total}</span>
              <div class="ob-btns">
                ${first ? "" : '<button class="btn btn-md btn-outline ob-btn" type="button" data-ob="prev">이전</button>'}
                <button class="btn btn-md ob-btn ob-next" type="button" data-ob="${last ? "done" : "next"}">${last ? "확인" : "다음"}</button>
              </div>
            </div>
            ${last ? "" : `<button class="ob-skip" type="button" data-ob="done">건너뛰기${icon("arrow-right", 24)}</button>`}
          </div>
        </div>
      </div>`;
    }

    function place() {
        if (!root) return;
        const step = steps[idx];
        const hole = holeRect(step);
        const holeEl = $one(".ob-hole", root);
        const tip = $one(".ob-tip", root);
        const arrow = $one(".ob-arrow", root);
        if (!hole) return;
        const vw = innerWidth;
        const vh = innerHeight;

        holeEl.style.cssText = `left:${hole.left}px;top:${hole.top}px;width:${hole.width}px;height:${hole.height}px;border-radius:${hole.radius != null ? hole.radius : step.r || 16}px`;

        /* 말풍선 방향: 시안 방향이 들어갈 자리가 없으면 반대쪽 → 위아래 순서로 바꿔요 */
        const h = tip.offsetHeight;
        const room = {
            below: vh - (hole.top + hole.height) - GAP - ARROW_SHORT - EDGE - h,
            above: hole.top - GAP - ARROW_SHORT - EDGE - h,
            right: vw - (hole.left + hole.width) - GAP - ARROW_SHORT - EDGE - BOX_W,
            left: hole.left - GAP - ARROW_SHORT - EDGE - BOX_W,
        };
        const opposite = { below: "above", above: "below", left: "right", right: "left" };
        const order = [step.side, opposite[step.side], "below", "above", "right", "left"];
        let side = order.find((s) => room[s] >= 0);
        if (!side) side = order.slice().sort((a, b) => room[b] - room[a])[0];

        const cx = hole.left + hole.width / 2;
        const cy = hole.top + hole.height / 2;
        let left;
        let top;
        let off; /* 화살표 위치 (말풍선 박스 기준, 화살표 가운데) */
        const half = ARROW_LONG / 2;
        if (side === "below" || side === "above") {
            left = Math.min(Math.max(cx - BOX_W / 2, EDGE), Math.max(EDGE, vw - BOX_W - EDGE));
            top = side === "below" ? hole.top + hole.height + GAP + ARROW_SHORT : hole.top - GAP - ARROW_SHORT - h;
            /* 어느 방향도 자리가 없으면 화면 안에 들어오게 밀어 넣어요 (강조 영역과 겹칠 수 있어요) */
            top = Math.min(Math.max(top, EDGE), Math.max(EDGE, vh - h - EDGE));
            off = Math.min(Math.max(cx - left, 24 + half), BOX_W - 24 - half);
        } else {
            top = Math.min(Math.max(cy - h / 2, EDGE), Math.max(EDGE, vh - h - EDGE));
            left = side === "right" ? hole.left + hole.width + GAP + ARROW_SHORT : hole.left - GAP - ARROW_SHORT - BOX_W;
            off = Math.min(Math.max(cy - top, 24 + half), h - 24 - half);
        }
        tip.style.left = `${Math.round(left)}px`;
        tip.style.top = `${Math.round(top)}px`;
        tip.dataset.side = side;
        arrow.innerHTML = ARROWS[ARROW_FOR_SIDE[side]];
        const a = arrow.style;
        a.left = a.right = a.top = a.bottom = "";
        if (side === "below") {
            a.left = `${Math.round(off - half)}px`;
            a.top = `${-ARROW_SHORT + 1}px`;
        } else if (side === "above") {
            a.left = `${Math.round(off - half)}px`;
            a.bottom = `${-ARROW_SHORT + 1}px`;
        } else if (side === "right") {
            a.top = `${Math.round(off - half)}px`;
            a.left = `${-ARROW_SHORT + 1}px`;
        } else {
            a.top = `${Math.round(off - half)}px`;
            a.right = `${-ARROW_SHORT + 1}px`;
        }
    }

    const schedulePlace = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(place);
    };

    function show(i) {
        idx = i;
        const step = steps[idx];
        /* 화면 밖에 있으면 가운데로 가져와요 */
        const els = [].concat(step.sel()).filter(Boolean);
        const first = els[0];
        if (first) {
            const q = first.getBoundingClientRect();
            if (q.top < 130 || q.bottom > innerHeight - 24) first.scrollIntoView({ block: "center", behavior: "instant" });
        }
        root.innerHTML = build(step, idx, steps.length);
        /* 첫 단계는 시안처럼 바로 자리 잡고, 이후 단계는 강조 영역이 부드럽게 옮겨가요 */
        const holeEl = $one(".ob-hole", root);
        holeEl.style.transition = "none";
        place();
        void holeEl.offsetWidth;
        holeEl.style.transition = "";
        const next = $one(".ob-next", root);
        if (next) next.focus({ preventScroll: true });
    }

    function finish() {
        markSeen();
        cancelAnimationFrame(raf);
        removeEventListener("resize", schedulePlace);
        removeEventListener("scroll", schedulePlace, true);
        document.removeEventListener("keydown", onKey, true);
        document.removeEventListener("wheel", stop, true);
        document.removeEventListener("touchmove", stop, true);
        document.documentElement.classList.remove("ob-lock");
        if (root) root.remove();
        root = null;
        if (openedByUs && page.restore) page.restore();
        openedByUs = false;
    }

    /* 온보딩 중에는 사용자가 스크롤하지 못하게 막아요 (단계 이동 시 위치 이동은 코드로만) */
    const stop = (e) => e.preventDefault();
    const SCROLL_KEYS = [" ", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"];

    function onKey(e) {
        if (SCROLL_KEYS.includes(e.key) && !e.target.closest("button")) e.preventDefault();
        if (e.key === " " && e.target.closest("button")) return;
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            finish();
        } else if (e.key === "ArrowRight" && idx < steps.length - 1) show(idx + 1);
        else if (e.key === "ArrowLeft" && idx > 0) show(idx - 1);
    }

    function start(force) {
        if (root) return;
        if (!force && seen()) return;
        openedByUs = !!(page.prepare && page.prepare());
        steps = page.steps.filter((s) => {
            const v = s.sel();
            return Array.isArray(v) ? v.length : !!v;
        });
        if (!steps.length) return;
        root = document.createElement("div");
        root.className = "ob";
        root.addEventListener("click", (e) => {
            const b = e.target.closest("[data-ob]");
            if (!b) return;
            const act = b.dataset.ob;
            if (act === "next") show(Math.min(idx + 1, steps.length - 1));
            else if (act === "prev") show(Math.max(idx - 1, 0));
            else finish();
        });
        document.body.appendChild(root);
        addEventListener("resize", schedulePlace);
        addEventListener("scroll", schedulePlace, true);
        document.addEventListener("keydown", onKey, true);
        document.addEventListener("wheel", stop, { capture: true, passive: false });
        document.addEventListener("touchmove", stop, { capture: true, passive: false });
        document.documentElement.classList.add("ob-lock");
        show(0);
    }

    window.startOnboarding = start;

    /* 사이드바 '도움말' = 이 화면의 온보딩을 처음부터 다시 보여줘요 */
    const helpBtn = document.getElementById("helpBtn");
    if (helpBtn)
        helpBtn.addEventListener("click", (e) => {
            e.preventDefault();
            start(true);
        });

    const go = () => setTimeout(() => start(/[?&]onboarding\b/.test(location.search)), 350);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
    else go();
})();