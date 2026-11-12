// js/image-converter.js

window.ImageConverter = {
  // 画像ファイルを読み込む
  loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`${file.name} を画像として読み込めません。`));
      };

      image.src = url;
    });
  },

  // 画像を指定形式に変換する
  async convert(file, format) {
    const image = await this.loadImage(file);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    // JPEG系は透過に対応しないため白背景にする（jpgやjpegのどちらを指定されても対応）
    if (format === "jpg" || format === "jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(image, 0, 0);

    if (format === "pdf") {
      if (!window.PDFLib) {
        throw new Error("PDF変換ライブラリを読み込めませんでした。");
      }

      const pdf = await PDFLib.PDFDocument.create();
      const pngBytes = await new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (!blob) {
            reject(new Error("画像の読み込みに失敗しました。"));
            return;
          }
          blob.arrayBuffer().then(resolve).catch(reject);
        }, "image/png");
      });

      const embedded = await pdf.embedPng(pngBytes);
      const page = pdf.addPage([canvas.width, canvas.height]);

      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height
      });

      return new Blob([await pdf.save()], {
        type: "application/pdf"
      });
    }

    // MIMEタイプの定義（jpgに一本化しつつ、念のためjpegも残しておく）
    const mimeTypes = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp"
    };

    const mime = mimeTypes[format];

    if (!mime) {
      throw new Error(
        `${format.toUpperCase()}形式への変換は、まだ対応していません。`
      );
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error("画像を変換できませんでした。"));
          return;
        }

        // ブラウザが指定形式に対応していない場合の確認
        if (blob.type !== mime) {
          reject(new Error(
            `${format.toUpperCase()}形式への変換にブラウザが対応していません。`
          ));
          return;
        }

        resolve(blob);
      }, mime, 0.92);
    });
  },

  // 変換したファイルをダウンロード
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