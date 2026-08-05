// 사용자가 확정한 약: { label: 약봉투에 적힌 이름, ingredients: [성분...] }
const selectedDrugs = [];

const input = document.getElementById('searchInput');
const suggestionsEl = document.getElementById('suggestions');
const selectedEl = document.getElementById('selected');
const resultsEl = document.getElementById('results');
const photoInput = document.getElementById('photoInput');
const ocrStatus = document.getElementById('ocrStatus');

// ── 직접 검색 입력 ──
input.addEventListener('input', () => {
  const matches = searchProducts(input.value);
  suggestionsEl.innerHTML = matches
    .map(name => `<li data-name="${name}">${name}</li>`).join('');
});

suggestionsEl.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  addDrug(li.dataset.name);
  input.value = '';
  suggestionsEl.innerHTML = '';
});

// ── 약봉투 촬영/업로드 → OCR ──
photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  if (!file) return;

  ocrStatus.textContent = "사진을 읽는 중… (0%)";
  try {
    const text = await runOCR(file, (p) => {
      ocrStatus.textContent = `사진을 읽는 중… (${p}%)`;
    });
    const candidates = extractDrugNameCandidates(text);

    if (candidates.length === 0) {
      ocrStatus.textContent =
        "약 이름을 찾지 못했어요. 사진을 더 크고 또렷하게 다시 찍거나 아래에서 직접 검색해 주세요.";
    } else {
      // ★ 약봉투에 적힌 이름 그대로 보여주고 확인받는다
      ocrStatus.innerHTML =
        "사진에서 이런 약 이름을 읽었어요. 맞는 것을 눌러 추가하세요:<br>" +
        candidates.map(n =>
          `<button class="ocr-suggest" data-name="${encodeURIComponent(n)}">＋ ${n}</button>`
        ).join(" ");
    }
  } catch (err) {
    ocrStatus.textContent = "사진 인식에 실패했어요. 다시 시도해 주세요.";
  }
  photoInput.value = "";
});

// OCR이 읽은 이름을 사용자가 눌러서 확정
ocrStatus.addEventListener('click', (e) => {
  const btn = e.target.closest('.ocr-suggest');
  if (!btn) return;
  const name = decodeURIComponent(btn.dataset.name);
  addDrug(name);
  btn.disabled = true;
});

// ── 약 추가 (이름 → 성분 연결 시도) ──
function addDrug(rawName) {
  // 이미 추가된 이름이면 무시
  if (selectedDrugs.some(d => d.label === rawName)) return;
  const ingredients = resolveIngredients(rawName);
  selectedDrugs.push({ label: rawName, ingredients });
  render();
}

function removeDrug(index) {
  selectedDrugs.splice(index, 1);
  render();
}

// ── 결과 렌더링 ──
function render() {
  // 선택된 약: 약봉투에 적힌 이름 그대로 칩으로 표시
  selectedEl.innerHTML = selectedDrugs
    .map((d, i) => `<span class="chip">${d.label}<button onclick="removeDrug(${i})">×</button></span>`)
    .join('');

  if (selectedDrugs.length === 0) { resultsEl.innerHTML = ''; return; }

  const cards = selectedDrugs.map((d) => {
    // 성분을 못 찾은 경우
    if (d.ingredients.length === 0) {
      return `<div class="card">
        <h2>${d.label}</h2>
        <p class="empty">이 약에 대한 음식 궁합 정보가 아직 없어요. (확인 불가)</p>
      </div>`;
    }
    // 성분별 카드
    return d.ingredients.map((ing) => {
      const info = getInteraction(ing);
      if (!info) {
        return `<div class="card"><h2>${d.label}</h2>
          <p class="empty">이 약에 대한 음식 궁합 정보가 아직 없어요. (확인 불가)</p></div>`;
      }
      const avoid = info.avoid?.map(f =>
        `<div class="food-item avoid ${f.severity}">
           <div class="food">🚫 ${f.food}</div>
           <div class="reason">${f.reason}</div></div>`).join('') || '';
      const good = info.good?.map(f =>
        `<div class="food-item good">
           <div class="food">✅ ${f.food}</div>
           <div class="reason">${f.reason}</div></div>`).join('') || '';
      return `<div class="card">
        <h2>${d.label}</h2>
        <p class="ingredient-note">→ ${info.displayName}</p>
        ${avoid}${good}
        <div class="source">출처: ${info.source} (${info.lastUpdated})</div>
      </div>`;
    }).join('');
  }).join('');

  resultsEl.innerHTML = cards;
}

// 시작
loadData().then(render);
