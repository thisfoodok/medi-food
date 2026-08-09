// 이미지에서 텍스트를 읽는다 (브라우저 안에서만 처리, 서버 전송 없음)
async function runOCR(file, onProgress) {
  const result = await Tesseract.recognize(file, "kor", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    }
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

// 사진에서 읽은 전체 텍스트에서 products.json에 있는 약을 찾아낸다.
// 상품명(키)뿐 아니라 aliases(성분명 등)도 함께 검사하되, 결과엔 항상 상품명만 담는다.
function extractDrugNames(text) {
  const found = [];
  const lines = (text || "").split(/[\n\r]+/);

  // 약 성분명에 흔한 어미들 (이걸로 끝나거나 포함하는 것만 성분으로 인정)
  const ingredientMarkers =
    /(아세트아미노펜|이부프로펜|아스피린|살리실산|와파린|스타틴|사르탄|프릴|디핀|티아지드|프라졸|티딘|마이신|실린|시클린|프로펜|프레드니솔론|프레드니손|미소프로스톨|레바미피드|메트포르민|글리메피리드|글리클라짓)/;

  for (const line of lines) {
    const words = line.split(/[^가-힣A-Za-z0-9]+/);
    for (let w of words) {
      const word = (w || "").trim();
      const korCount = (word.match(/[가-힣]/g) || []).length;
      if (korCount < 3) continue;
      if (word.length < 4 || word.length > 30) continue;

      // 성분 어미를 포함할 때만 후보로 인정
      if (ingredientMarkers.test(word)) {
        if (!found.includes(word)) found.push(word);
      }
    }
  }

  return found;
}


