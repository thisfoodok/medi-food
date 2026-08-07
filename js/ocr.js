// 이미지에서 텍스트를 읽는다 (브라우저 안에서만 처리, 서버 전송 없음)
async function runOCR(file, onProgress) {
  const result = await Tesseract.recognize(file, "kor", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });
  return result.data.text;
}

// 사진에서 읽은 전체 텍스트에서 products.json에 있는 약을 찾아낸다.
// 상품명(키)뿐 아니라 aliases(성분명 등)도 함께 검사하되, 결과엔 항상 상품명만 담는다.
function extractDrugNames(text) {
  const found = [];
  const lines = (text || "").split(/[\n\r]+/);

  // 약 이름에 흔히 붙는 표시 (뒤에 숫자·용량이 더 붙어도 인정)
  const drugMarkers = /(정|캡슐|캅셀|주사|시럽|과립|연고|크림|밀리그람|밀리그램|mg)/;
  // 약 성분에 흔한 어미들
  const ingredientMarkers = /(스타틴|사르탄|프릴|디핀|티아지드|프라졸|티딘|마이신|실린|시클린|세타몰|프로펜|리손|니솔|겔)/;

  for (const line of lines) {
    // 한글·영문·숫자·슬래시·점만 남기고 나머지 기호는 공백으로
    const words = line.split(/[^가-힣A-Za-z0-9/.]+/);
    for (let w of words) {
      const word = (w || "").trim();
      const korCount = (word.match(/[가-힣]/g) || []).length;
      if (korCount < 3) continue;
      if (word.length < 4 || word.length > 30) continue;

      if (drugMarkers.test(word) || ingredientMarkers.test(word)) {
        if (!found.includes(word)) found.push(word);
      }
    }
  }

  return found;
}



