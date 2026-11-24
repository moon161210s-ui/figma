/* ==========================================================
   사용성 테스트(UT) 전용 — 태스크별 성공 판정
   - task1.html ~ task9.html 로 들어오면 sessionStorage("utTask") 에 태스크 번호가 담기고,
     그 태스크의 조건을 채우면 '미션 성공' 모달이 한 번 떠요
   - 기존 화면 코드는 그대로 쓰고, 이 파일에서 동작만 살짝 감싸서(wrap) 판정해요
   - utTask 가 없으면(일반 접속) 아무 일도 하지 않아요
   ========================================================== */
(() => {
    let task = 0;
    try { task = Number(sessionStorage.getItem("utTask")) || 0; } catch (e) { }
    if (!task) return;

    const page = location.pathname.split("/").pop() || "index.html";
    let done = false;

    /* ---------- 미션 성공 모달 ---------- */
    function utSuccess() {
        if (done) return;
        done = true;
        const el = document.createElement("div");
        el.className = "hm";
        el.id = "utSuccess";
        el.style.zIndex = "300";
        el.innerHTML = `
        <div class="hm-box rs-cm" role="alertdialog" aria-modal="true" aria-label="미션 성공">
          <div class="rs-cm-body">
            <span class="rs-cm-ic"><img src="${ICON("check-purple")}" alt="" /></span>
            <div class="rs-cm-tx"><strong>미션에 성공하셨습니다!</strong><span>설문 페이지로 돌아가 버튼을 눌러 다음 미션을 진행해 주세요.</span></div>
          </div>
          <div class="rs-cm-btns"><button class="btn btn-lg btn-primary" type="button">확인</button></div>
        </div>`;
        document.body.appendChild(el);
        el.hidden = false;
        const btn = el.querySelector("button");
        btn.addEventListener("click", () => el.remove());
        btn.focus();
    }
    const later = (fn, ms = 350) => setTimeout(fn, ms); /* 기존 완료 모달 위에 얹어요 */

    /* 전역 function 을 감싸요 (같은 전역 이름으로 불러 쓰는 코드에도 적용돼요) */
    const wrap = (name, fn) => {
        const orig = window[name];
        if (typeof orig !== "function") return;
        window[name] = function (...args) {
            const pre = fn.pre ? fn.pre(...args) : undefined;
            const res = orig.apply(this, args);
            if (fn.post) fn.post(pre, ...args);
            return res;
        };
    };

    /* ---------- 태스크 1 · 조치가 필요한 객실 고르기 (105 · 107 · 108) ---------- */
    if (task === 1 && page === "index.html") {
        const TARGET = ["105", "107", "108"];
        const picked = new Set();
        const st = document.createElement("style");
        st.textContent = `
        .room-card.is-ut-picked { outline: 3px solid var(--color-primary-500); outline-offset: -3px; }
        #utPick { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 90; }`;
        document.head.appendChild(st);
        const pill = document.createElement("button");
        pill.id = "utPick";
        pill.type = "button";
        pill.className = "btn btn-lg btn-dark";
        document.body.appendChild(pill);
        const paint = () => {
            document.querySelectorAll(".room-card[data-room]").forEach((c) => c.classList.toggle("is-ut-picked", picked.has(c.dataset.room)));
            pill.textContent = `선택 완료 (${picked.size})`;
        };
        paint();
        new MutationObserver(paint).observe(document.querySelector("#floors"), { childList: true, subtree: true });
        document.addEventListener("click", (e) => {
            const card = e.target.closest(".room-card[data-room]");
            if (!card) return;
            const no = card.dataset.room;
            picked.has(no) ? picked.delete(no) : picked.add(no);
            later(paint, 0);
        }, true);
        pill.addEventListener("click", () => {
            if (picked.size === TARGET.length && TARGET.every((n) => picked.has(n))) return utSuccess();
            pill.textContent = "다시 확인해 주세요";
            setTimeout(paint, 1500);
        });
    }

    /* ---------- 태스크 2 · 104호 퇴실 11:00 → 13:00 저장 ---------- */
    if (task === 2 && page === "index.html") {
        document.addEventListener("click", () => setTimeout(() => {
            const r = ROOMS.find((x) => x.no === "104");
            if (r && r.outLocked && r.out === "13:00") utSuccess();
        }, 80));
    }

    /* ---------- 태스크 3 · 108호를 맡은 객실이 가장 적은 직원에게 배정 → 일괄 저장 ---------- */
    if (task === 3 && page === "user-assign.html") {
        let ok = false;
        wrap("assignTo", {
            pre: (no, name) => {
                const w = asWorkers();
                const me = w.find((x) => x.name === name);
                return no === "108" && me && me.n === w[0].n;
            },
            post: (pre, no) => { if (no === "108") ok = !!pre; },
        });
        wrap("saveAssign", {
            pre: () => ok && !!asChanges["108"],
            post: (pre) => { if (pre) later(utSuccess); },
        });
    }

    /* ---------- 태스크 4 · 105호 검수 완료 / 태스크 5 · 107호 재청소 요청 / 태스크 7 · 103호 재검수 결정 ---------- */
    if ((task === 4 || task === 5 || task === 7) && page === "result.html") {
        const NO = { 4: "105", 5: "107", 7: "103" }[task];
        document.addEventListener("click", (e) => {
            if (rsSelected !== NO) return;
            const confirmBtn = e.target.closest("[data-rs-confirm]");
            const recleanBtn = e.target.closest("[data-rs-reclean]");
            if (task === 4 && confirmBtn) return later(utSuccess, 150);
            if (task === 7 && (confirmBtn || recleanBtn)) return later(utSuccess, 150);
            if (task === 5 && recleanBtn) {
                const checked = [...document.querySelectorAll("#rsDetail .rs-check-item.is-checked")].map((x) => x.textContent.trim());
                const msg = ($("#rsMsg")?.value || "").trim();
                if (checked.includes("욕실 물기 제거") && msg) later(utSuccess, 150);
            }
        }, true);
    }

    /* ---------- 태스크 6 · 스탠다드 추가 항목을 넣고 저장 ---------- */
    if (task === 6 && page === "standard.html") {
        wrap("openDoneModal", {
            post: (pre, text) => {
                if (text !== "저장이 완료되었습니다." || rlSel !== "std") return;
                const d = rlData("std");
                if (d.checks.some((v) => v.trim()) || d.proofs.some((p) => p.t.trim() || p.g.trim())) later(utSuccess, 150);
            },
        });
    }

    /* ---------- 태스크 8 · 11월 24일 대실 건수(3건)와 401호 퇴실 시간(18:00)을 입력 ---------- */
    if (task === 8 && page === "reservation.html") {
        const st = document.createElement("style");
        st.textContent = `
        #utAns { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 90; display: flex; align-items: flex-end; gap: 12px; padding: 16px 20px; background: var(--color-white); border: 1px solid var(--color-line-normal); border-radius: var(--radius-x-lg, 16px); box-shadow: 0 0 12.5px rgba(31, 34, 37, 0.08); }
        #utAns label { display: flex; flex-direction: column; gap: 6px; font-size: var(--fs-body2, 14px); color: var(--color-gray-600); }
        #utAns input { width: 160px; height: 44px; padding: 0 12px; border: 1px solid var(--color-line-normal); border-radius: 8px; font: inherit; font-size: var(--fs-body1, 16px); color: var(--color-gray-900); background: var(--color-white); }
        #utAns input:focus { outline: none; border-color: var(--color-primary-500); }
        #utAns .ut-err { align-self: center; color: var(--color-dangerous); font-size: var(--fs-body2, 14px); }`;
        document.head.appendChild(st);
        const box = document.createElement("form");
        box.id = "utAns";
        box.innerHTML = `
        <label>11월 24일 대실 건수<input id="utRest" type="text" inputmode="numeric" placeholder="예) 3건" autocomplete="off" /></label>
        <label>401호 퇴실 시간<input id="utOut" type="text" placeholder="예) 11:00" autocomplete="off" /></label>
        <button class="btn btn-lg btn-dark" type="submit">제출</button>`;
        document.body.appendChild(box);
        const num = (v) => { const m = String(v).match(/\d+/); return m ? Number(m[0]) : NaN; };
        const hhmm = (v) => {
            const t = String(v);
            const m = t.match(/(\d{1,2})\s*(?::|시)\s*(\d{1,2})?/);
            if (!m) return "";
            let h = Number(m[1]);
            if (/오후|pm/i.test(t) && h < 12) h += 12;
            return `${String(h).padStart(2, "0")}:${String(Number(m[2] || 0)).padStart(2, "0")}`;
        };
        box.addEventListener("submit", (e) => {
            e.preventDefault();
            box.querySelector(".ut-err")?.remove();
            if (num($("#utRest").value) === 3 && hhmm($("#utOut").value) === "18:00") return utSuccess();
            const err = document.createElement("span");
            err.className = "ut-err";
            err.textContent = "다시 확인해 주세요";
            box.insertBefore(err, box.querySelector("button"));
        });
    }

    /* ---------- 태스크 9 · 특이사항 '처리하기' 누르기 ---------- */
    if (task === 9 && page === "thread.html") {
        wrap("thApply", { post: (pre, item, k) => { if (k === "take") later(utSuccess, 200); } });
    }
})();