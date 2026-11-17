// js/app.js

const $ = id => document.getElementById(id);

const formats = [
  "jpg", "png", "gif",
  "webp", "bmp", "tiff", "svg",
  "ico", "raw", "avif", "heic", "pdf"
];

const defaultFavorites = ["jpg", "png", "webp", "pdf"];

// JPEGをJPGに統一
let savedFavorites;

try {
  savedFavorites = JSON.parse(
    localStorage.getItem("fileStudioFavorites") || "null"
  );
} catch {
  savedFavorites = null;
}

let favorites = savedFavorites
  ? [...new Set(
      savedFavorites.map(format =>
        format === "jpeg" ? "jpg" : format
      )
    )].filter(format => formats.includes(format))
  : [...defaultFavorites];

let selectedFormat = null;
let selectedFiles = [];

// お気に入りを保存
localStorage.setItem(
  "fileStudioFavorites",
  JSON.stringify(favorites)
);

// ページ切り替え
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    showPage(tab.dataset.page);
  });
});

function showPage(page) {
  document.querySelectorAll(".page").forEach(element => {
    element.classList.remove("active");
    element.classList.add("hidden");
  });

  const target = $(page);

  if (target) {
    target.classList.remove("hidden");
    target.classList.add("active");
  }

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.page === page);
  });
}

// 設定画面
if ($("settingsBtn")) {
  $("settingsBtn").addEventListener("click", () => {
    showPage("settings");
    renderSettings();
  });
}

// ステータス表示
function setStatus(message = "", isError = false) {
  const status = $("status");
  if (!status) return;

  status.textContent = message;
  status.style.color = isError ? "#d94848" : "#16845b";
}

// 変換ボタンの状態更新
function updateConvertButtonState() {
  const convertBtn = $("convertBtn");
  if (convertBtn) {
    convertBtn.disabled = !(selectedFiles.length > 0 && selectedFormat !== null);
  }
}

// ファイル表示・選択状態の更新
function displayFiles(files) {
  selectedFiles = Array.from(files);

  const nameArea = $("fileName");
  if (nameArea) {
    nameArea.textContent = selectedFiles.length
      ? selectedFiles.map(file => file.name).join("、")
      : "ファイルが選択されていません";
  }

  updateConvertButtonState();
  if (selectedFiles.length === 0) {
    setStatus();
  }
}

// ファイル管理エリア（file-manager.js）からの変更通知を受け取る
window.addEventListener("file-studio-files-changed", event => {
  if (event.detail && event.detail.files) {
    displayFiles(event.detail.files);
  }
});

// お気に入り保存
function saveFavorites() {
  localStorage.setItem(
    "fileStudioFavorites",
    JSON.stringify(favorites)
  );

  renderFormats();
  renderSettings();
}

// 形式ボタン作成
function createFormatButton(format) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "format-button";

  if (selectedFormat === format) {
    button.classList.add("selected");
  }

  const name = document.createElement("span");
  name.textContent = format.toUpperCase();

  const star = document.createElement("span");
  star.className = "favorite-star";
  star.textContent = favorites.includes(format) ? "★" : "☆";

  star.addEventListener("click", event => {
    event.stopPropagation();
    if (favorites.includes(format)) {
      favorites = favorites.filter(item => item !== format);
    } else {
      favorites.push(format);
    }
    saveFavorites();
  });

  button.append(name, star);

  button.addEventListener("click", () => {
    selectedFormat = format;
    renderFormats();
    updateConvertButtonState();
  });

  return button;
}

// 形式一覧を描画
function renderFormats() {
  const favoriteArea = $("favoriteFormats");
  const otherArea = $("otherFormats");

  if (!favoriteArea || !otherArea) return;

  favoriteArea.innerHTML = "";
  otherArea.innerHTML = "";

  favorites.forEach(format => {
    favoriteArea.appendChild(createFormatButton(format));
  });

  formats
    .filter(format => !favorites.includes(format))
    .forEach(format => {
      otherArea.appendChild(createFormatButton(format));
    });
}

// その他の形式の開閉
if ($("otherBtn")) {
  $("otherBtn").addEventListener("click", () => {
    const area = $("otherFormats");
    const isHidden = area.hidden || area.classList.contains("hidden");

    area.hidden = !isHidden;
    area.classList.toggle("hidden", !isHidden);

    $("otherBtn").textContent = isHidden
      ? "その他の形式を閉じる ▲"
      : "その他の形式を見る ▼";
  });
}

// お気に入り設定描画
function renderSettings() {
  const area = $("favoriteSettings");
  if (!area) return;

  area.innerHTML = "";

  formats.forEach(format => {
    const label = document.createElement("label");
    label.className = "setting-format";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = favorites.includes(format);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        if (!favorites.includes(format)) {
          favorites.push(format);
        }
      } else {
        favorites = favorites.filter(item => item !== format);
      }
      saveFavorites();
    });

    const text = document.createElement("span");
    text.textContent = format.toUpperCase();

    label.append(checkbox, text);
    area.appendChild(label);
  });
}

// 変換ボタン押下時の実行ロジック
if ($("convertBtn")) {
  $("convertBtn").addEventListener("click", async () => {
    if (selectedFiles.length === 0) {
      setStatus("ファイルを選択してください。", true);
      return;
    }

    if (!selectedFormat) {
      setStatus("変換先の形式を選択してください。", true);
      return;
    }

    if (!window.ImageConverter) {
      setStatus("変換プログラムが読み込まれていません。", true);
      return;
    }

    const button = $("convertBtn");
    button.disabled = true;

    let success = 0;
    const errors = [];
    const successfulFiles = [];

    setStatus("変換しています...");

    for (const file of selectedFiles) {
      try {
        const blob = await window.ImageConverter.convert(
          file,
          selectedFormat
        );

        const originalName = file.name.replace(/\.[^.]+$/, "");
        const outputName = `${originalName}.${selectedFormat}`;

        window.ImageConverter.download(blob, outputName);

        success++;
        successfulFiles.push(file); // 成功したファイルを記録
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error("変換エラー:", error);
        errors.push(`${file.name}: ${error.message}`);
      }
    }

    // 変換に成功したファイルをファイルマネージャーの一覧から削除する
    if (successfulFiles.length > 0 && typeof managedFiles !== "undefined") {
      managedFiles = managedFiles.filter(item => !successfulFiles.includes(item.file));
      if (typeof renderFileList === "function") {
        renderFileList();
      }
      if (typeof notifyApp === "function") {
        notifyApp();
      }
    }

    button.disabled = false;

    if (errors.length === 0) {
      setStatus(`${success}個のファイルを変換しました！`);
    } else {
      setStatus(
        `${success}個成功、${errors.length}個失敗。\n${errors.join("\n")}`,
        true
      );
    }
  });
}

// 初期化
renderFormats();
renderSettings();
updateConvertButtonState();

if ($("otherFormats")) {
  $("otherFormats").hidden = true;
  $("otherFormats").classList.add("hidden");
}