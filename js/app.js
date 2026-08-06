const selectedDrugs = [];

const input = document.getElementById('searchInput');
const suggestionsEl = document.getElementById('suggestions');
const selectedEl = document.getElementById('selected');
const resultsEl = document.getElementById('results');
const photoInput = document.getElementById('photoInput');
const ocrStatus = document.getElementById('ocrStatus');

// ── 검색 입력 (별칭까지 매칭하되, 결과 목록엔 상품명만 표시) ──
input.addEventListener('input', () => {
  const matches = searchProducts(input.value, 8);
  suggestionsEl.innerHTML = matches
    .map(name => `<li data-name="${encodeURIComponent(name)}">${name}</li>`).join('');
});

suggestionsEl.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  addDrug(decodeURIComponent(li.dataset.name));
  input.value = '';
  suggestionsEl.innerHTML = '';
});

// ── 약봉투 사진 → OCR ──
photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  if (!file) return;

  ocrStatus.textContent = "사진을 읽는 중… (0%)";
  try {
    const text = await runOCR(file, (p) => {
      ocrStatus.textContent = `사진을 읽는 중… (${p}%)`;
    });

    // OCR에서 찾은 이름(상품명 또는 별칭)을 정식 상품명으로 변환 + 중복 제거
    const rawFound = extractDrugNames(text);
    const found = [];
    for (const n of rawFound) {
      const product = resolveToProduct(n);
      if (product && !found.includes(product)) found.push(product);
    }

    if (found.length === 0) {
      ocrStatus.textContent =
        "약 이름을 찾지 못했어요. 사진을 더 크고 또렷하게 다시 찍거나 아래에서 직접 검색해 주세요.";
    } else {
      ocrStatus.innerHTML =
        "사진에서 이런 약을 찾았어요. 맞는 것을 눌러 추가하세요:<br>" +
        found.map(n =>
          `<button class="ocr-suggest" data-name="${encodeURIComponent(n)}">＋ ${n}</button>`
        ).join(' ');
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

// ── 결과 표시 (약 이름만 보이고, 성분은 내부에서만 사용) ──
function render() {
  selectedEl.innerHTML = selectedDrugs
    .map((n, i) => `<span class="chip">${n}<button onclick="removeDrug(${i})">×</button></span>`)
    .join('');

  if (selectedDrugs.length === 0) { resultsEl.innerHTML = ''; return; }

  resultsEl.innerHTML = selectedDrugs.map((name) => {
    const ingredients = productToIngredients(name);
    if (ingredients.length === 0) {
      return `<div class="card"><h2>${name}</h2>` +
        `<p class="empty">이 약에 대한 음식 궁합 정보가 아직 없어요. (확인 불가)</p></div>`;
    }

    const body = ingredients.map((ing) => {
      const info = getInteraction(ing);
      if (!info || ((!info.avoid || info.avoid.length === 0) && (!info.good || info.good.length === 0))) {
        return `<p class="empty">이 약에 대한 음식 궁합 정보가 아직 없어요. (확인 불가)</p>`;
      }
      const avoid = info.avoid?.map(f =>
        `<div class="food-item avoid ${f.severity}">` +
        `<div class="food">🚫 ${f.food}</div>` +
        `<div class="reason">${f.reason}</div></div>`).join('') || '';
      const good = info.good?.map(f =>
        `<div class="food-item good">` +
        `<div class="food">✅ ${f.food}</div>` +
        `<div class="reason">${f.reason}</div></div>`).join('') || '';
      return `${avoid}${good}` +
        `<div class="source">출처: ${info.source} (${info.lastUpdated})</div>`;
    }).join('');

    return `<div class="card"><h2>${name}</h2>${body}</div>`;
  }).join('');
}

loadData().then(render);
