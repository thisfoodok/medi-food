// ── 이미지 전처리: 확대 + 흑백 + 대비 강화 ──
// 작은 회색 성분명 글씨를 OCR이 읽기 쉽게 만든다.
async function preprocessImage(file) {
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });

  // 가로 기준 최소 2000px이 되도록 확대 (작은 글씨 키우기)
  const scale = Math.max(2, 2000 / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // 흑백 + 대비 강화
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const contrast = 1.6; // 대비 강도
  for (let i = 0; i < d.length; i += 4) {
    // 회색조 변환
    let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // 대비 강화 (128 기준으로 벌림)
    gray = (gray - 128) * contrast + 128;
    gray = Math.max(0, Math.min(255, gray));
    d[i] = d[i + 1] = d[i + 2] = gray;
  }
  ctx.putImageData(imgData, 0, 0);

  return canvas;
}

// ── 이미지에서 텍스트를 읽는다 (브라우저 안에서만 처리, 서버 전송 없음) ──
async function runOCR(file, onProgress) {
  const canvas = await preprocessImage(file);

  const result = await Tesseract.recognize(canvas, "kor", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
    // 문서 전체를 여러 줄로 인식하도록 설정
    tessedit_pageseg_mode: "6"
  });

  const rawText = result.data.text;

  // ── OCR 원문 확인용 (임시) ──
  let dbg = document.getElementById("ocrDebug");
  if (!dbg) {
    dbg = document.createElement("pre");
    dbg.id = "ocrDebug";
    dbg.style.cssText =
      "white-space:pre-wrap;background:#fffbe6;border:2px solid #f0c000;padding:10px;margin:10px 0;font-size:13px;";
    document.body.prepend(dbg);
  }
  dbg.textContent = "── OCR이 읽은 원문 ──\n" + rawText;

  return rawText;
}

// ── 사진에서 읽은 텍스트에서 성분명을 찾아낸다 ──
function extractDrugNames(text) {
  const found = [];
  const lines = (text || "").split(/[\n\r]+/);

  const ingredientMarkers =
    /(아세트아미노펜|이부프로펜|아스피린|살리실산|와파린|스타틴|사르탄|프릴|디핀|티아지드|프라졸|티딘|마이신|실린|시클린|프로펜|프레드니솔론|프레드니손|미소프로스톨|레바미피드|메트포르민|글리메피리드|글리클라짓|글립틴|글리타존|알마게이트|테오브로민)/;

  for (const line of lines) {
    const words = line.split(/[^가-힣A-Za-z0-9]+/);
    for (let w of words) {
      const word = (w || "").trim();
      const korCount = (word.match(/[가-힣]/g) || []).length;
      if (korCount < 3) continue;
      if (word.length < 4 || word.length > 30) continue;

      if (ingredientMarkers.test(word)) {
        if (!found.includes(word)) found.push(word);
      }
    }
  }

  return found;
}
