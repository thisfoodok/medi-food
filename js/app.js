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
async function render() {
  selectedEl.innerHTML = selectedDrugs
    .map((n, i) => `<span class="chip">${n}<button onclick="removeDrug(${i})">×</button></span>`)
    .join('');

  if (selectedDrugs.length === 0) { resultsEl.innerHTML = ''; return; }

  const cards = [];
  for (const name of selectedDrugs) {
    const ingredients = await productToIngredients(name);
    if (!ingredients || ingredients.length === 0) {
      cards.push(`<div class="card"><h2>${name}</h2>` +
        `<p class="empty">이 약에 대한 음식 궁합 정보가 아직 없어요. (확인 불가)</p></div>`);
      continue;
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

    cards.push(`<div class="card"><h2>${name}</h2>${body}</div>`);
  }

  resultsEl.innerHTML = cards.join('');
}


loadData().then(render);
