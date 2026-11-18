// js/image-converter.js

window.ImageConverter = (function () {
  // pdfjsLibのワーカー初期化
  if (window.pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }

  // ファイルを DataURL に変換
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ファイルを ArrayBuffer に変換
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // Canvas から Blob を生成
  function canvasToBlob(canvas, mimeType, quality = 0.92) {
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), mimeType, quality);
    });
  }

  // HTMLImageElement の読み込み
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // HEIC / HEIF の変換
  async function convertHeicToCanvas(file) {
    if (!window.heic2any) {
      throw new Error("HEIC変換ライブラリがロードされていません。");
    }
    const conversionResult = await heic2any({
      blob: file,
      toType: "image/png"
    });
    const blob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
    const url = URL.createObjectURL(blob);
    const img = await loadImage(url);
    URL.revokeObjectURL(url);

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  // TIFF の変換
  async function convertTiffToCanvas(file) {
    if (!window.UTIF) {
      throw new Error("TIFF変換ライブラリがロードされていません。");
    }
    const buffer = await readFileAsArrayBuffer(file);
    const ifds = UTIF.decode(buffer);
    if (!ifds || ifds.length === 0) {
      throw new Error("TIFFファイルのデコードに失敗しました。");
    }
    UTIF.decodeImage(buffer, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);

    const canvas = document.createElement("canvas");
    canvas.width = ifds[0].width;
    canvas.height = ifds[0].height;
    const ctx = canvas.getContext("2d");
    const imgData = ctx.createImageData(canvas.width, canvas.height);
    imgData.data.set(rgba);
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  // 一般的な画像ファイルを Canvas に変換
  async function fileToCanvas(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "heic" || ext === "heif") {
      return await convertHeicToCanvas(file);
    }
    if (ext === "tif" || ext === "tiff") {
      return await convertTiffToCanvas(file);
    }

    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");

    // 透過背景を持つ画像がJPGなどに変換される際、背景を白にする処理
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  // PDF の 1 ページ目を Canvas に変換 (PDF -> 画像用)
  async function pdfToCanvas(file) {
    if (!window.pdfjsLib) {
      throw new Error("PDF表示ライブラリ(pdf.js)が読み込まれていません。");
    }
    const buffer = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 2.0 }); // 高画質化のためスケール2.0
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    return canvas;
  }

  // ===== メイン変換関数 =====
  async function convert(file, targetFormat) {
    const target = targetFormat.toLowerCase();
    const ext = file.name.split(".").pop().toLowerCase();

    // 1. PDF への変換 (画像 / HEIC / TIFF / PDF -> PDF)
    if (target === "pdf") {
      if (!window.PDFLib) {
        throw new Error("PDF生成ライブラリ(pdf-lib)が読み込まれていません。");
      }

      if (ext === "pdf") {
        // PDF から PDF への変換（そのまま複製）
        return file;
      }

      const canvas = await fileToCanvas(file);
      const pngDataUrl = canvas.toDataURL("image/png");
      const pngBytes = await fetch(pngDataUrl).then(res => res.arrayBuffer());

      const pdfDoc = await PDFLib.PDFDocument.create();
      const image = await pdfDoc.embedPng(pngBytes);
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height
      });

      const pdfBytes = await pdfDoc.save();
      return new Blob([pdfBytes], { type: "application/pdf" });
    }

    // 2. 入力ファイルが PDF で、ターゲットが画像形式（JPG, PNG, WEBP, BMP など）の場合
    let canvas;
    if (ext === "pdf") {
      canvas = await pdfToCanvas(file);
    } else {
      canvas = await fileToCanvas(file);
    }

    // 3. 各ターゲット形式への Blob 出力
    let mimeType = "image/png";
    if (target === "jpg" || target === "jpeg") mimeType = "image/jpeg";
    else if (target === "webp") mimeType = "image/webp";
    else if (target === "gif") mimeType = "image/gif";
    else if (target === "bmp") mimeType = "image/bmp";
    else if (target === "svg") mimeType = "image/svg+xml";
    else if (target === "ico") mimeType = "image/x-icon";
    else if (target === "avif") mimeType = "image/avif";
    else if (target === "tiff" || target === "tif") mimeType = "image/tiff";

    const blob = await canvasToBlob(canvas, mimeType);

    // ブラウザが特定MIME（AVIF / TIFF / ICO等）の直接変換に対応していない場合のフォールバック
    if (!blob) {
      const fallbackBlob = await canvasToBlob(canvas, "image/png");
      return new Blob([fallbackBlob], { type: mimeType });
    }

    return blob;
  }

  // ダウンロードヘルパー
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    convert,
    download
  };
})();