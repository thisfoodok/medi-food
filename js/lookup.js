// ── 식약처 의약품 허가정보 API 설정 ──
const DRUG_API_BASE =
  "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07/getDrugPrdtPrmsnDtlInq06";
const DRUG_API_KEY = "0Etcmuk6op0wz2DphT0c9jpRWf7vfw6OEB8jezpGHXhoyt7T7R2YY9T25%2BRjnCfaJlZBkpDsMrXZIpe8hHGAEQ%3D%3D";

// 한글 성분명 → 영문 키 변환표 (interactions.json 키와 일치)
const KOR_TO_ENG = {
  "아세트아미노펜": "acetaminophen",
  "이부프로펜": "ibuprofen",
  "아스피린": "aspirin",
  "아세틸살리실산": "aspirin",
  "와파린": "warfarin",
  "와파린나트륨": "warfarin",
  "아토르바스타틴": "atorvastatin",
  "아토르바스타틴칼슘삼수화물": "atorvastatin",
  "심바스타틴": "simvastatin",
  "암로디핀": "amlodipine",
  "암로디핀베실산염": "amlodipine",
  "암로디핀캄실산염": "amlodipine",
  "리시노프릴": "lisinopril",
  "메트포르민": "metformin",
  "메트포르민염산염": "metformin",
  "레보티록신": "levothyroxine",
  "레보티록신나트륨": "levothyroxine",
  "아목시실린": "amoxicillin",
  "아목시실린수화물": "amoxicillin",
  "시프로플록사신": "ciprofloxacin",
  "독시사이클린": "doxycycline",
  "실데나필": "sildenafil",
  "실데나필시트르산염": "sildenafil",
  "설트랄린": "sertraline",
  "프레드니솔론": "prednisolone",
  "텔미사르탄": "telmisartan",
  "하이드로클로로티아지드": "hydrochlorothiazide",
  "히드로클로로티아지드": "hydrochlorothiazide",
  "에소메프라졸": "esomeprazole",
  "판토프라졸": "pantoprazole",
  "란소프라졸": "lansoprazole",
  "덱스란소프라졸": "dexlansoprazole",
  "라베프라졸": "rabeprazole",
  "오메프라졸": "omeprazole",
  "파모티딘": "famotidine",
  "시메티딘": "cimetidine",
  "니자티딘": "nizatidine",
  "라니티딘": "ranitidine",
  "레바미피드": "rebamipide",
  "미소프로스톨": "misoprostol"
};

// 한글 성분명 하나를 영문 키로 변환 (정확 일치 → 부분 일치 순)
function korToEng(korName) {
  const name = (korName || "").trim();
  if (KOR_TO_ENG[name]) return KOR_TO_ENG[name];
  // 염 표기가 붙어 정확히 안 맞을 때: 표의 한글명이 이름에 포함되는지 검사
  for (const [kor, eng] of Object.entries(KOR_TO_ENG)) {
    if (name.includes(kor)) return eng;
  }
  return null;
}

// API의 MATERIAL_NAME 문자열에서 "성분명 : XXX" 들을 모두 뽑아 영문 키 배열로 변환
function parseIngredientsFromMaterial(materialName) {
  const raw = materialName || "";
  const matches = raw.match(/성분명\s*:\s*([^|;]+)/g) || [];
  const result = [];
  for (const m of matches) {
    const kor = m.replace(/성분명\s*:\s*/, "").trim();
    const eng = korToEng(kor);
    if (eng && !result.includes(eng)) result.push(eng);
  }
  return result;
}

// item_name으로 API를 부르고 items 배열을 반환 (없으면 빈 배열)
async function callDrugApi(itemName) {
  const url = `${DRUG_API_BASE}?serviceKey=${DRUG_API_KEY}`
    + `&item_name=${encodeURIComponent(itemName)}`
    + `&type=json&numOfRows=5&pageNo=1`;
  console.log("① 호출 URL:", url);
  const res = await fetch(url);
  console.log("② 응답 상태:", res.status);
  const data = await res.json();
  let items = data?.body?.items;
  if (items && !Array.isArray(items)) items = [items];
  return Array.isArray(items) ? items : [];
}

// 상품명(정확 or 오인식)으로 성분배열 + 정식상품명을 함께 반환
// 반환: { ingredients: [...], resolvedName: "정식이름" | null }
async function fetchDrugInfo(productName) {
  const name = (productName || "").trim();
  try {
    // 1차: 이름 그대로 검색
    let items = await callDrugApi(name);

    // 2차: 못 찾으면 뒷부분을 조금씩 잘라 앞부분으로 부분검색 (OCR 오인식 보정)
    if (items.length === 0 && name.length >= 3) {
      for (let cut = 1; cut <= 2 && name.length - cut >= 2; cut++) {
        const partial = name.slice(0, name.length - cut);
        items = await callDrugApi(partial);
        if (items.length > 0) break;
      }
    }

    if (items.length === 0) {
      console.log("❌ 검색 결과 없음:", name);
      return { ingredients: [], resolvedName: null };
    }

    const resolvedName = items[0]?.ITEM_NAME || name;
    const material = items[0]?.MATERIAL_NAME || "";
    console.log("⑤ 정식상품명:", resolvedName, "| 성분원문:", material);
    const list = parseIngredientsFromMaterial(material);
    console.log("⑥ 최종 성분배열:", list);
    return { ingredients: list, resolvedName };
  } catch (e) {
    console.log("❌ 에러 발생:", e);
    return { ingredients: [], resolvedName: null };
  }
}




// 전역 데이터 저장소
const DB = {
  products: {},
  interactions: {}
};

// ── 데이터 로드 ──
async function loadData() {
  const interactionsRes = await fetch('data/interactions.json');
  DB.interactions = await interactionsRes.json();
}


// ── 공백 제거 + 소문자화 (검색 비교용) ──
function normalize(str) {
  return (str || '').replace(/\s+/g, '').toLowerCase();
}

// ── 상품명 → 성분코드 배열 ──
// products.json 구조: { "상품명": { ingredients: [...], aliases: [...] } }
async function productToIngredients(productName) {
  const info = await fetchDrugInfo(productName);
  return info.ingredients;
}



// ── 성분코드 → 음식 정보 ──
function getInteraction(ingredientCode) {
  return DB.interactions[ingredientCode] || null;
}

// ── 검색: 입력어가 상품명(키) 또는 aliases에 부분일치하면 그 상품명(키) 반환 ──
// 반환값은 항상 "화면에 보여줄 상품명(키)" 목록. 별칭은 노출되지 않음.
function searchProducts(query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];

  const results = [];
  for (const [productName, entry] of Object.entries(DB.products)) {
    const keys = [productName, ...(entry.aliases || [])];
    const matched = keys.some(k => normalize(k).includes(q));
    if (matched) results.push(productName);
    if (results.length >= limit) break;
  }
  return results;
}

// ── 임의 문자열(상품명 또는 별칭)을 정식 상품명(키)으로 변환 ──
// OCR 결과 등에서 별칭이 잡혔을 때 화면 표시용 상품명으로 되돌리는 데 사용.
// 일치하는 상품이 없으면 null 반환.
function resolveToProduct(name) {
  const target = normalize(name);
  if (!target) return null;

  // 1) 정식 상품명(키) 정확/부분 일치 우선
  if (DB.products[name]) return name;

  // 2) 키 또는 별칭에 대한 일치 탐색
  for (const [productName, entry] of Object.entries(DB.products)) {
    const keys = [productName, ...(entry.aliases || [])];
    if (keys.some(k => normalize(k) === target)) return productName;
  }
  // 3) 부분 일치 (별칭 포함)
  for (const [productName, entry] of Object.entries(DB.products)) {
    const keys = [productName, ...(entry.aliases || [])];
    if (keys.some(k => normalize(k).includes(target) || target.includes(normalize(k)))) {
      return productName;
    }
  }
  return null;
}
