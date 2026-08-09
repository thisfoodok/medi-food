// ── 이미지 전처리: 확대 + 흑백 + 대비 강화 ──
async function preprocessImage(file) {
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });

  const scale = Math.max(2, 2000 / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const contrast = 1.5;
  for (let i = 0; i < d.length; i += 4) {
    let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
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
    }
  });

  return result.data.text;
}

// ── 사진에서 읽은 텍스트에서 "상품명"을 찾아낸다 ──
// 큰 글씨인 상품명은 OCR이 잘 읽으므로, "정/캡슐/시럽" 등으로 끝나는 약 이름을 뽑는다.
// 뽑은 상품명은 그대로 API에 넘겨 성분을 조회한다.
function extractDrugNames(text) {
  const found = [];
  const lines = (text || "").split(/[\n\r]+/);

  // 상품명 끝에 흔한 제형 표시
  const productMarkers =
    /(정|캡슐|캅셀|시럽|산|과립|연고|크림|주사|주|액|겔)$/;

  for (const line of lines) {
    // 한글·영문·숫자만 남기고 나머지는 공백으로
    const words = line.split(/[^가-힣A-Za-z0-9]+/);
    for (let w of words) {
      let word = (w || "").trim();
      // 뒤에 붙은 숫자/용량 제거 (예: 리피토정10 → 리피토정)
      word = word.replace(/[0-9]+$/, "");
      const korCount = (word.match(/[가-힣]/g) || []).length;
      if (korCount < 2) continue;
      if (word.length < 3 || word.length > 20) continue;

      // 제형 표시로 끝나는 것만 상품명 후보로 인정
      if (productMarkers.test(word)) {
        if (!found.includes(word)) found.push(word);
      }
    }
  }

  return found;
}
