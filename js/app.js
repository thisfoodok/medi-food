const selectedDrugs = [];

const REQUEST_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzqfCSWn6-xu0T6I1TpvaHdNId15cc1JgBpWSdswit3ewZUGRT9NiGewACChY9PVUoIfw/exec";

const input = document.getElementById('searchInput');
const suggestionsEl = document.getElementById('suggestions');
const selectedEl = document.getElementById('selected');
const resultsEl = document.getElementById('results');
const photoInput = document.getElementById('photoInput');
const ocrStatus = document.getElementById('ocrStatus');

// ── 검색 입력: 입력한 약 이름을 Enter로 바로 추가 (API가 성분 조회) ──
input.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const query = input.value.trim();
  if (query.length < 2) return;
  addDrug(query);
  input.value = '';
  suggestionsEl.innerHTML = '';
});

// 입력 중에는 안내만 표시
input.addEventListener('input', () => {
  const query = input.value.trim();
  if (query.length >= 2) {
    suggestionsEl.innerHTML =
      `<li class="no-result">‘${query}’ 검색하려면 Enter를 누르세요.</li>`;
  } else {
    suggestionsEl.innerHTML = '';
  }
});


// ── 없는 약 추가 요청 (약 이름만 전송) ──
async function requestDrug(name, btn) {
  if (!name) return;
  btn.disabled = true;
  btn.textContent = "요청을 보내는 중…";
  try {
    await fetch(REQUEST_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ name: name })
    });
    btn.textContent = "요청이 접수되었어요. 감사합니다!";
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "＋ 이 약 추가 요청하기";
    alert("요청 전송에 실패했어요. 잠시 후 다시 시도해 주세요.");
  }
}

// ── 약봉투 사진 → OCR ──
photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  if (!file) return;

  ocrStatus.textContent = "사진을 읽는 중… (0%)";
  try {
    const text = await runOCR(file, (p) => {
      ocrStatus.textContent = `사진을 읽는 중… (${p}%)`;
    });

    const rawFound = extractDrugNames(text);
    const found = [];
    for (const n of rawFound) {
      const name = (n || "").trim();
      if (name.length >= 2 && !found.includes(name)) found.push(name);
    }


    if (found.length === 0) {
      ocrStatus.textContent =
        "약 이름을 찾지 못했어요. 사진을 더 크고 또렷하게 다시 찍거나 아래에서 직접 검색해 주세요.";
    } else {
      // 찾은 약을 바로 전부 추가 → 위쪽에 음식 궁합 요약이 즉시 표시됨
      ocrStatus.textContent =
        `사진에서 ${found.length}개의 약을 찾았어요. 아래 요약을 확인하세요.`;
      for (const n of found) {
        addDrug(n);
      }
    }

  } catch (err) {
    ocrStatus.textContent = "사진 인식에 실패했어요. 다시 시도해 주세요.";
  }
  photoInput.value = "";
});

ocrStatus.addEventListener('click', (e) => {
  const btn = e.target.closest('.ocr-suggest');
  if (!btn) return;
  addDrug(decodeURIComponent(btn.dataset.name));
  btn.disabled = true;
});

// ── 약 추가/제거 (항상 정식 상품명만 저장) ──
function addDrug(name) {
  if (selectedDrugs.includes(name)) return;
  selectedDrugs.push(name);
  render();
}

function removeDrug(index) {
  selectedDrugs.splice(index, 1);
  render();
}


// 현재 펼쳐서 보고 있는 약 이름 (null이면 아무것도 안 펼침)
let openDrug = null;

// 약 하나의 성분별 음식정보를 { avoid:[], good:[], hasInfo, allSafe } 로 정리
async function getDrugFacts(name) {
  const ingredients = await productToIngredients(name);
  const facts = { avoid: [], good: [], hasInfo: false, allSafe: false, unknown: false };
  if (!ingredients || ingredients.length === 0) { facts.unknown = true; return facts; }

  let matchedAny = false;
  for (const ing of ingredients) {
    const info = getInteraction(ing);
    if (!info) { facts.unknown = true; continue; }
    matchedAny = true;
    (info.avoid || []).forEach(f => facts.avoid.push(f));
    (info.good || []).forEach(f => facts.good.push(f));
  }
  facts.hasInfo = matchedAny;
  facts.allSafe = matchedAny && facts.avoid.length === 0 && facts.good.length === 0;
  return facts;
}

// ── 화면 그리기 ──
async function render() {
  // 1) 모든 약의 정보를 모아둔다 (요약 + 개별 상세에 공통 사용)
  const allFacts = {};
  for (const name of selectedDrugs) {
    allFacts[name] = await getDrugFacts(name);
  }

  // 2) 상단 요약: 모든 약의 피해야 할 음식 / 함께 먹으면 좋은 음식을 합쳐 중복 제거
  renderSummary(allFacts);

  // 3) 약 버튼 목록 (누르면 해당 약 상세 토글)
  selectedEl.innerHTML = selectedDrugs
    .map((n, i) =>
      `<span class="chip ${openDrug === n ? 'active' : ''}" onclick="toggleDrug('${n.replace(/'/g, "\\'")}')">` +
      `${n}<button class="chip-x" onclick="event.stopPropagation(); removeDrug(${i})">×</button></span>`)
    .join('');

  // 4) 개별 상세: 선택된 약만 표시
  if (openDrug && allFacts[openDrug]) {
    resultsEl.innerHTML = renderDetailCard(openDrug, allFacts[openDrug]);
  } else if (selectedDrugs.length > 0) {
    resultsEl.innerHTML = `<p class="hint">약을 누르면 그 약의 자세한 음식 궁합을 볼 수 있어요.</p>`;
  } else {
    resultsEl.innerHTML = '';
  }
}

// 상단 요약 영역 그리기
function renderSummary(allFacts) {
  const names = Object.keys(allFacts);
  if (names.length === 0) { document.getElementById('summary').innerHTML = ''; return; }

  const avoidMap = new Map();  // 음식이름 -> {food, reason, severity}
  const goodMap = new Map();
  let hasUnknown = false;

  for (const name of names) {
    const f = allFacts[name];
    if (f.unknown) hasUnknown = true;
    f.avoid.forEach(x => { if (!avoidMap.has(x.food)) avoidMap.set(x.food, x); });
    f.good.forEach(x => { if (!goodMap.has(x.food)) goodMap.set(x.food, x); });
  }

  let html = `<h2 class="summary-title">🍽️ 전체 음식 궁합 요약</h2>`;

  if (avoidMap.size > 0) {
    html += `<div class="summary-block avoid"><div class="summary-head">⚠️ 피하거나 줄이세요</div>`;
    for (const x of avoidMap.values()) {
      html += `<div class="food-item avoid ${x.severity || ''}">` +
        `<div class="food"><span class="food-icon">🚫</span><span class="food-name">${x.food}</span></div>` +
        `<div class="reason">${x.reason}</div></div>`;
    }
    html += `</div>`;
  }

  if (goodMap.size > 0) {
    html += `<div class="summary-block good"><div class="summary-head">✅ 함께 먹으면 좋아요</div>`;
    for (const x of goodMap.values()) {
      html += `<div class="food-item good">` +
        `<div class="food"><span class="food-icon">✅</span><span class="food-name">${x.food}</span></div>` +
        `<div class="reason">${x.reason}</div></div>`;
    }
    html += `</div>`;
  }

  if (avoidMap.size === 0 && goodMap.size === 0 && !hasUnknown) {
    html += `<p class="ok"><span class="food-icon">✅</span> 특별히 주의할 음식은 없어요.</p>`;
  }

  if (hasUnknown) {
    html += `<p class="hint">ℹ️ 일부 성분은 아직 음식 정보가 확인되지 않았어요. 최종 확인은 약사에게 문의하세요.</p>`;
  }

  document.getElementById('summary').innerHTML = html;
}

// 개별 약 상세 카드 그리기
function renderDetailCard(name, f) {
  if (f.unknown && !f.hasInfo) {
    return `<div class="card"><h2>${name}</h2>` +
      `<p class="empty">이 약에 대한 음식 궁합 정보가 아직 없어요. (확인 불가)</p></div>`;
  }
  if (f.allSafe) {
    return `<div class="card"><h2>${name}</h2>` +
      `<p class="ok"><span class="food-icon">✅</span> 특별히 주의할 음식은 없어요.</p></div>`;
  }

  let body = '';
  f.avoid.forEach(x => {
    body += `<div class="food-item avoid ${x.severity || ''}">` +
      `<div class="food"><span class="food-icon">🚫</span><span class="food-name">${x.food}</span></div>` +
      `<div class="reason">${x.reason}</div></div>`;
  });
  f.good.forEach(x => {
    body += `<div class="food-item good">` +
      `<div class="food"><span class="food-icon">✅</span><span class="food-name">${x.food}</span></div>` +
      `<div class="reason">${x.reason}</div></div>`;
  });
  if (f.unknown) {
    body += `<p class="hint">ℹ️ 이 약의 일부 성분은 아직 음식 정보가 확인되지 않았어요.</p>`;
  }
  return `<div class="card"><h2>${name}</h2>${body}</div>`;
}

// 약 버튼 클릭 → 상세 토글
function toggleDrug(name) {
  openDrug = (openDrug === name) ? null : name;
  render();
}

loadData().then(render);
