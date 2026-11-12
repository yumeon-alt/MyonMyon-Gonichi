
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

// タブ切り替え
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    showPage(tab.dataset.page);
  });
});

function showPage(page) {
  document.querySelectorAll(".page").forEach(p => {
    p.classList.add("hidden");
  });

  document.getElementById(page).classList.remove("hidden");

  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.page === page);
  });
}

// 設定画面
$("settingsBtn").onclick = () => {
  showPage("settings");
  renderSettings();
};

// ファイル選択
$("fileInput").addEventListener("change", e => {
  selectedFiles = [...e.target.files];

  $("fileList").textContent = selectedFiles.length
    ? selectedFiles.map(f => f.name).join(" / ")
    : "ファイル未選択";

  $("convertBtn").disabled = !selectedFiles.length;

  renderFormats();
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
  button.className = "format";
  button.innerHTML = `
    .${format.toUpperCase()}
    <span class="star">
      ${favorites.includes(format) ? "★" : "☆"}
    </span>
  `;

  button.onclick = e => {
    if (e.target.classList.contains("star")) {
      favorites = favorites.includes(format)
        ? favorites.filter(f => f !== format)
        : [...favorites, format];

      saveFavorites();
      return;
    }

    selectedFormat = format;
    renderFormats();
  };

  button.classList.toggle(
    "selected",
    selectedFormat === format
  );

  return button;
}

// 形式表示
function renderFormats() {
  const fav = $("favoriteFormats");
  const other = $("otherFormats");

  fav.innerHTML = "";
  other.innerHTML = "";

  favorites.forEach(format => {
    fav.appendChild(createFormatButton(format));
  });

  formats.filter(f => !favorites.includes(f)).forEach(format => {
    other.appendChild(createFormatButton(format));
  });
}

// その他の形式
$("otherBtn").onclick = () => {
  $("otherFormats").classList.toggle("hidden");

  $("otherBtn").textContent =
    $("otherFormats").classList.contains("hidden")
      ? "その他の形式を見る ▼"
      : "その他の形式を閉じる ▲";
};

// 設定画面
function renderSettings() {
  $("favoriteSettings").innerHTML = "";

  formats.forEach(format => {
    const button = document.createElement("button");
    button.className = "format";

    button.textContent =
      `${favorites.includes(format) ? "★" : "☆"} .${format}`;

    button.style.margin = "5px";

    button.onclick = () => {
      favorites = favorites.includes(format)
        ? favorites.filter(f => f !== format)
        : [...favorites, format];

      saveFavorites();
    };

    $("favoriteSettings").appendChild(button);
  });
}

// 初期表示
renderFormats();
renderSettings();
