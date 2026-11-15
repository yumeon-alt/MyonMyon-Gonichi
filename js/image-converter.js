
// js/image-converter.js

window.ImageConverter = {

  // 拡張子を取得
  getExtension(file) {
    return file.name.split(".").pop().toLowerCase();
  },

  // HEIC / HEIF をPNGに変換
  async decodeHEIC(file) {
    if (typeof heic2any !== "function") {
      throw new Error("HEIC変換ライブラリを読み込めません。");
    }

    const result = await heic2any({
      blob: file,
      toType: "image/png"
    });

    return Array.isArray(result) ? result[0] : result;
  },

  // TIFFをCanvasに読み込む
  decodeTIFF(file) {
    if (typeof UTIF === "undefined") {
      throw new Error("TIFF変換ライブラリを読み込めません。");
    }

    const buffer = file.arrayBuffer();

    return buffer.then(data => {
      const ifds = UTIF.decode(data);

      if (!ifds || !ifds.length) {
        throw new Error("TIFF画像を読み込めません。");
      }

      UTIF.decodeImage(data, ifds[0]);

      const page = ifds[0];
      const rgba = UTIF.toRGBA8(page);

      const canvas = document.createElement("canvas");
      canvas.width = page.width;
      canvas.height = page.height;

      const context = canvas.getContext("2d");
      const imageData = new ImageData(
        new Uint8ClampedArray(rgba),
        page.width,
        page.height
      );

      context.putImageData(imageData, 0, 0);

      return canvas;
    });
  },

  // ファイルをCanvasに読み込む
  async loadCanvas(file) {
    const extension = this.getExtension(file);

    // HEIC / HEIF
    if (["heic", "heif"].includes(extension)) {
      const pngBlob = await this.decodeHEIC(file);
      return this.blobToCanvas(pngBlob);
    }

    // TIFF
    if (["tif", "tiff"].includes(extension)) {
      return await this.decodeTIFF(file);
    }

    // 通常の画像形式
    return await this.imageToCanvas(file);
  },

  // BlobからCanvasを作る
  async blobToCanvas(blob) {
    return await this.imageToCanvas(blob);
  },

  // 通常画像をCanvasに読み込む
  imageToCanvas(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);

        URL.revokeObjectURL(url);
        resolve(canvas);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(
          `${file.name || "画像"}を読み込めません。形式が未対応か、ファイルが破損している可能性があります。`
        ));
      };

      image.src = url;
    });
  },

  // CanvasからBlobを作る
  canvasToBlob(canvas, mime) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error("画像の変換に失敗しました。"));
          return;
        }

        if (blob.type !== mime) {
          reject(new Error(
            "このブラウザは指定された出力形式に対応していません。"
          ));
          return;
        }

        resolve(blob);
      }, mime, 0.92);
    });
  },

  // 画像を指定形式に変換
  async convert(file, format) {
    const canvas = await this.loadCanvas(file);

    // JPEGは白背景にする
    if (format === "jpg") {
      const output = document.createElement("canvas");
      output.width = canvas.width;
      output.height = canvas.height;

      const context = output.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, output.width, output.height);
      context.drawImage(canvas, 0, 0);

      return await this.canvasToBlob(output, "image/jpeg");
    }

    // PNG
    if (format === "png") {
      return await this.canvasToBlob(canvas, "image/png");
    }

    // WebP
    if (format === "webp") {
      return await this.canvasToBlob(canvas, "image/webp");
    }

    // PDF
    if (format === "pdf") {
      if (!window.PDFLib) {
        throw new Error("PDFライブラリを読み込めません。");
      }

      const pngBlob = await this.canvasToBlob(canvas, "image/png");
      const pngBytes = await pngBlob.arrayBuffer();

      const pdf = await PDFLib.PDFDocument.create();
      const embedded = await pdf.embedPng(pngBytes);

      const page = pdf.addPage([
        canvas.width,
        canvas.height
      ]);

      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height
      });

      const pdfBytes = await pdf.save();

      return new Blob([pdfBytes], {
        type: "application/pdf"
      });
    }

    throw new Error(
      `${format.toUpperCase()}形式への出力はまだ対応していません。`
    );
  },

  // ダウンロード
  download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
