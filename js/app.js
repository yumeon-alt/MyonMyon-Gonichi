
// js/app.js

const formats = [
  "jpg", "jpeg", "png", "gif",
  "webp", "bmp", "tiff", "svg",
  "ico", "raw", "avif", "heic", "pdf"
];

const defaultFavorites = ["jpg", "png", "webp", "pdf"];

let favorites = JSON.parse(
  localStorage.getItem("fileStudioFavorites") || "null"
) || [...defaultFavorites];

let selectedFormat = null;
let selectedFiles = [];

const $ = id => document.getElementById(id);

// ページ切り替え
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    showPage(tab.dataset.page);
  });
});

function showPage(page) {
  document.querySelectorAll(".page").forEach(element => {
    element.classList.remove("active");
  });

  const target = $(page);
  if (target) target.classList.add("active");

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.page === page);
  });
}

if ($("settingsBtn")) {
  $("settingsBtn").onclick = () => {
    showPage("settings");
    renderSettings();
  };
}

// ファイル表示
function displayFiles(files) {
  selectedFiles = Array.from(files);

  const nameArea = $("fileName");

  if (nameArea) {
    nameArea.textContent = selectedFiles.length
      ? selectedFiles.map(file => file.name).join("、")
      : "ファイルが選択されていません";
  }

  if ($("convertBtn")) {
    $("convertBtn").disabled = selectedFiles.length === 0;
  }

  renderFormats();
  setStatus("");
}

// ファイル選択
if ($("fileInput")) {
  $("fileInput").addEventListener("change", event => {
    displayFiles(event.target.files);
  });
}

// ドラッグ＆ドロップ設定
function setupDragAndDrop() {
  const input = $("fileInput");

  if (!input) return;

  // input自体ではなく、アップロードエリアを取得
  const uploadArea =
    input.closest(".upload-area") ||
    input.parentElement;

  if (!uploadArea) return;

  // ファイルをドロップしたとき
  uploadArea.addEventListener("dragover", event => {
    event.preventDefault();
    uploadArea.classList.add("drag-over");
  });

  uploadArea.addEventListener("dragleave", event => {
    if (!uploadArea.contains(event.relatedTarget)) {
      uploadArea.classList.remove("drag-over");
    }
  });

  uploadArea.addEventListener("drop", event => {
    event.preventDefault();
    uploadArea.classList.remove("drag-over");

    const files = Array.from(event.dataTransfer.files);

    if (files.length === 0) return;

    displayFiles(files);

    // inputにもファイルを反映
    try {
      const transfer = new DataTransfer();
      files.forEach(file => transfer.items.add(file));
      input.files = transfer.files;
    } catch (error) {
      console.warn("ファイル入力欄への反映を省略しました。", error);
    }
  });
}

// お気に入り保存
function saveFavorites() {
  localStorage.setItem(
    "fileStudioFavorites",
    JSON.stringify(favorites)
  );

  renderFormats();
  renderSettings();
}

// 形式ボタン
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
  });

  return button;
}

// 形式一覧
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

    const isHidden = area.hidden;

    area.hidden = !isHidden;

    $("otherBtn").textContent = isHidden
      ? "その他の形式を閉じる"
      : "その他の形式を表示";
  });
}

// 設定画面
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

// ステータス
function setStatus(message, isError = false) {
  const status = $("status");

  if (!status) return;

  status.textContent = message;
  status.style.color = isError ? "#d94848" : "#555";
}

// 変換
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

    setStatus("変換しています...");

    for (const file of selectedFiles) {
      try {
        const blob = await ImageConverter.convert(
          file,
          selectedFormat
        );

        const originalName = file.name.replace(/\.[^.]+$/, "");
        const outputName = `${originalName}.${selectedFormat}`;

        ImageConverter.download(blob, outputName);
        success++;

        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        errors.push(`${file.name}: ${error.message}`);
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
setupDragAndDrop();

if ($("convertBtn")) {
  $("convertBtn").disabled = true;
}
