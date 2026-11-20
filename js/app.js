// js/app.js

const $ = id => document.getElementById(id);

// アプリがサポートする全形式
const allFormats = [
  "jpg", "png", "gif", "webp", "bmp", 
  "tiff", "svg", "ico", "raw", "avif", "heic", "pdf"
];

// 形式ごとの対応変換先マップ
const conversionMap = {
  // 画像全般の主要変換先
  image: ["jpg", "png", "webp", "pdf", "gif", "bmp", "tiff", "ico", "avif", "svg"],
  // PDFからの主要変換先
  pdf: ["jpg", "png", "webp"]
};

let currentInputFiles = [];
let selectedFormat = null;

// モーダル開閉イベント
function initModalEvents() {
  const authModal = $("authModal");
  const authModalOpenBtn = $("authModalOpenBtn");
  const authModalCloseBtn = $("authModalCloseBtn");

  if (authModalOpenBtn && authModal) {
    authModalOpenBtn.addEventListener("click", () => {
      authModal.style.display = "flex";
    });
  }

  if (authModalCloseBtn && authModal) {
    authModalCloseBtn.addEventListener("click", () => {
      authModal.style.display = "none";
    });
  }

  if (authModal) {
    authModal.addEventListener("click", (e) => {
      if (e.target === authModal) {
        authModal.style.display = "none";
      }
    });
  }
}

initModalEvents();

// タブ切り替え処理
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    
    tab.classList.add("active");
    const targetPage = $(tab.dataset.page);
    if (targetPage) {
      targetPage.classList.remove("hidden");
      targetPage.classList.add("active");
    }
  });
});

// その他の形式（アコーディオン）トグルボタン
const otherBtn = $("otherBtn");
const otherFormatsGrid = $("otherFormats");
if (otherBtn && otherFormatsGrid) {
  otherBtn.addEventListener("click", () => {
    const isHidden = otherFormatsGrid.classList.contains("hidden");
    if (isHidden) {
      otherFormatsGrid.classList.remove("hidden");
      const currentText = otherBtn.textContent.replace(" ▼", "");
      otherBtn.textContent = currentText + " ▲";
    } else {
      otherFormatsGrid.classList.add("hidden");
      const currentText = otherBtn.textContent.replace(" ▲", "");
      otherBtn.textContent = currentText + " ▼";
    }
  });
}

// 動的な変換形式グリッド描画
function renderDynamicFormats(inputFiles) {
  const favoriteFormatsGrid = $("favoriteFormats");
  const otherFormatsGrid = $("otherFormats");
  const otherBtn = $("otherBtn");
  const formatSectionTitle = $("formatSectionTitle");
  const convertBtn = $("convertBtn");

  if (!favoriteFormatsGrid || !otherFormatsGrid || !otherBtn) return;

  favoriteFormatsGrid.innerHTML = "";
  otherFormatsGrid.innerHTML = "";

  // 1. ファイルが入っていない時
  if (!inputFiles || inputFiles.length === 0) {
    selectedFormat = null;
    if (convertBtn) convertBtn.disabled = true;
    if (formatSectionTitle) formatSectionTitle.textContent = "変換可能な形式";

    otherBtn.textContent = "対応入力形式を見る ▼";
    if (!otherFormatsGrid.classList.contains("hidden")) {
      otherBtn.textContent = "対応入力形式を見る ▲";
    }

    const emptyMsg = document.createElement("div");
    emptyMsg.className = "empty-message";
    emptyMsg.style.cssText = "grid-column: 1 / -1; color: #888; padding: 20px; text-align: center; background: #f9f9fc; border-radius: 8px;";
    emptyMsg.textContent = "ファイルを上のエリアに追加すると、対応する変換形式がここに自動表示されます。";
    favoriteFormatsGrid.appendChild(emptyMsg);

    // 非折りたたみに対応全形式を参考カードとして描画（すべて非選択状態）
    allFormats.forEach(fmt => {
      const btn = document.createElement("button");
      btn.className = "format-button";
      btn.textContent = fmt.toUpperCase();
      btn.disabled = true;
      otherFormatsGrid.appendChild(btn);
    });
    return;
  }

  // 2. ファイルが入っている時
  if (formatSectionTitle) formatSectionTitle.textContent = "変換先を選択";
  otherBtn.textContent = "その他の形式を見る ▼";
  if (!otherFormatsGrid.classList.contains("hidden")) {
    otherBtn.textContent = "その他の形式を見る ▲";
  }

  // 入力ファイル群の拡張子から変換可能形式を抽出
  let allowedFormats = new Set();
  let isAllPdf = true;

  inputFiles.forEach(file => {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext !== "pdf") isAllPdf = false;
    
    if (ext === "pdf") {
      conversionMap.pdf.forEach(f => allowedFormats.add(f));
    } else {
      conversionMap.image.forEach(f => allowedFormats.add(f));
    }
  });

  const supportedArray = Array.from(allowedFormats);

  // おすすめ形式（最初の4つまでメインエリアに表示）
  const primaryFormats = supportedArray.slice(0, 4);
  const secondaryFormats = allFormats.filter(fmt => !primaryFormats.includes(fmt));

  // メインエリア描画
  primaryFormats.forEach(fmt => {
    const btn = document.createElement("button");
    btn.className = "format-button";
    if (selectedFormat === fmt) btn.classList.add("selected");
    btn.textContent = fmt.toUpperCase();

    btn.addEventListener("click", () => {
      selectedFormat = fmt;
      renderDynamicFormats(inputFiles);
      if (convertBtn) convertBtn.disabled = false;
    });

    favoriteFormatsGrid.appendChild(btn);
  });

  // その他の形式エリア描画（非対応のものは disabled ）
  secondaryFormats.forEach(fmt => {
    const btn = document.createElement("button");
    btn.className = "format-button";
    btn.textContent = fmt.toUpperCase();

    const isSupported = supportedArray.includes(fmt);
    if (!isSupported) {
      btn.disabled = true;
    } else {
      if (selectedFormat === fmt) btn.classList.add("selected");
      btn.addEventListener("click", () => {
        selectedFormat = fmt;
        renderDynamicFormats(inputFiles);
        if (convertBtn) convertBtn.disabled = false;
      });
    }

    otherFormatsGrid.appendChild(btn);
  });

  // 選択されていた形式が非対応になった場合のリセット
  if (selectedFormat && !supportedArray.includes(selectedFormat)) {
    selectedFormat = null;
    if (convertBtn) convertBtn.disabled = true;
  }
}

// ファイル管理スクリプト（file-manager.js）からの変更通知イベント受信
window.addEventListener("file-studio-files-changed", (e) => {
  currentInputFiles = e.detail.files || [];
  renderDynamicFormats(currentInputFiles);
});

// 変換ボタン押下イベント
const convertBtn = $("convertBtn");
const statusDiv = $("status");

if (convertBtn) {
  convertBtn.addEventListener("click", async () => {
    if (!currentInputFiles || currentInputFiles.length === 0 || !selectedFormat) {
      alert("ファイルと変換先形式を選択してください。");
      return;
    }

    if (!window.ImageConverter) {
      alert("画像変換ライブラリが利用できません。");
      return;
    }

    convertBtn.disabled = true;
    if (statusDiv) statusDiv.textContent = "ファイルを変換中...";

    let successCount = 0;
    const convertedFilesList = [];

    for (const fileObj of currentInputFiles) {
      try {
        const blob = await window.ImageConverter.convert(fileObj, selectedFormat);
        const baseName = fileObj.name.replace(/\.[^.]+$/, "");
        const outName = `${baseName}.${selectedFormat}`;
        
        window.ImageConverter.download(blob, outName);
        convertedFilesList.push(fileObj);
        successCount++;
      } catch (err) {
        console.error("変換エラー:", err);
      }
    }

    if (statusDiv) {
      statusDiv.textContent = `${successCount}個のファイルを変換し、ダウンロードしました！`;
    }

    // 変換完了したファイルを管理リストからクリア
    window.dispatchEvent(
      new CustomEvent("file-studio-clear-converted-files", {
        detail: { convertedFiles: convertedFilesList }
      })
    );

    convertBtn.disabled = false;
  });
}

// 初期状態の表示をセット
renderDynamicFormats([]);