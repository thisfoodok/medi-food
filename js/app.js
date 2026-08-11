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
