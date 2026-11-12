
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

// 設定画面
$("settingsBtn").onclick = () => {
  showPage("settings");
  renderSettings();
};

// ファイル選択
$("fileInput").addEventListener("change", event => {
  selectedFiles = Array.from(event.target.files);

  $("fileName").textContent = selectedFiles.length
    ? selectedFiles.map(file => file.name).join("、")
    : "ファイルが選択されていません";

  $("convertBtn").disabled = selectedFiles.length === 0;

  renderFormats();
  setStatus("");
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

// 形式ボタンを作成
function createFormatButton(format) {
  const button = document.createElement("button");
  button.className = "format-button";

  if (selectedFormat === format) {
    button.classList.add("selected");
  }

  const name = document.createElement("span");
  name.textContent = format.toUpperCase();

  const star = document.createElement("span");
  star.className = "favorite-star";
  star.textContent = favorites.includes(format) ? "★" : "☆";
  star.title = "お気に入りに登録";

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

// その他の形式を表示
$("otherBtn").onclick = () => {
  const area = $("otherFormats");
  area.hidden = !area.hidden;

  $("otherBtn").textContent = area.hidden
    ? "その他の形式を表示"
    : "閉じる";
};

// 設定画面のお気に入り一覧
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
        if (!favorites.includes(format)) favorites.push(format);
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

// ステータス表示
function setStatus(message, isError = false) {
  const status = $("status");
  status.textContent = message;
  status.style.color = isError ? "#d94848" : "#555";
}

// 画像変換
$("convertBtn").addEventListener("click", async () => {
  if (selectedFiles.length === 0) {
    setStatus("先にファイルを選択してください。", true);
    return;
  }

  if (!selectedFormat) {
    setStatus("変換先の形式を選択してください。", true);
    return;
  }

  if (!window.ImageConverter) {
    setStatus("変換プログラムを読み込めませんでした。", true);
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

      // 複数ファイルの連続ダウンロードを少し間隔を空ける
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

// 初期表示
renderFormats();
renderSettings();
$("convertBtn").disabled = true;
