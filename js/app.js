// js/app.js

const $ = id => document.getElementById(id);

const formats = [
  "jpg", "png", "gif",
  "webp", "bmp", "tiff", "svg",
  "ico", "raw", "avif", "heic", "pdf"
];

const defaultFavorites = ["jpg", "png", "webp", "pdf"];

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

localStorage.setItem(
  "fileStudioFavorites",
  JSON.stringify(favorites)
);

// ==========================================
// モーダル開閉イベント（即時登録）
// ==========================================
function initModalEvents() {
  const authModal = $("authModal");
  const authModalOpenBtn = $("authModalOpenBtn");
  const authModalCloseBtn = $("authModalCloseBtn");

  // モーダルを開く
  if (authModalOpenBtn && authModal) {
    authModalOpenBtn.addEventListener("click", () => {
      authModal.style.display = "flex";
    });
  }

  // モーダルを閉じる（✕ボタン）
  if (authModalCloseBtn && authModal) {
    authModalCloseBtn.addEventListener("click", () => {
      authModal.style.display = "none";
    });
  }

  // モーダルの背景クリックで閉じる
  if (authModal) {
    authModal.addEventListener("click", (e) => {
      if (e.target === authModal) {
        authModal.style.display = "none";
      }
    });
  }
}

// 読み込み時に即座にイベントを登録
initModalEvents();

// Firebase 認証 & 履歴管理の初期化待機
const checkInterval = setInterval(() => {
  if (window.firebaseAuth && window.firebaseDb) {
    clearInterval(checkInterval);
    initAuthSystem();
  }
}, 100);

function initAuthSystem() {
  const auth = window.firebaseAuth;
  const db = window.firebaseDb;
  const { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } = window.firebaseAuthFns;

  const authStatusText = $("auth-status-text");
  const loginBtn = $("loginBtn");
  const registerBtn = $("registerBtn");
  const logoutBtn = $("logoutBtn");
  const loggedOutView = $("auth-logged-out-view");
  const loggedInView = $("auth-logged-in-view");
  const userEmailDisplay = $("user-email-display");
  const historySection = $("history-section");
  const authModal = $("authModal");

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const email = $("authEmail").value.trim();
      const password = $("authPassword").value;
      
      // メールアドレスの簡単な形式チェック
      if (!email || !email.includes("@")) {
        alert("正しいメールアドレスを入力してください。");
        return;
      }
      if (!password) {
        alert("パスワードを入力してください。");
        return;
      }

      try {
        await signInWithEmailAndPassword(auth, email, password);
        alert("ログインしました！");
        if (authModal) authModal.style.display = "none";
      } catch (err) {
        alert("ログインエラー: " + err.message);
      }
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener("click", async () => {
      const email = $("authEmail").value.trim();
      const password = $("authPassword").value;
      
      // メールアドレスの形式チェック
      if (!email || !email.includes("@")) {
        alert("正しいメールアドレスを入力してください。");
        return;
      }
      // パスワードの文字数チェック（6文字以上）
      if (!password || password.length < 6) {
        alert("パスワードは6文字以上にしてください。");
        return;
      }

      try {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("アカウントを作成し、ログインしました！");
        if (authModal) authModal.style.display = "none";
      } catch (err) {
        alert("登録エラー: " + err.message);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        alert("ログアウトしました。");
        if (authModal) authModal.style.display = "none";
      } catch (err) {
        console.error("ログアウト失敗", err);
      }
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (loggedOutView) loggedOutView.style.display = "none";
      if (loggedInView) loggedInView.style.display = "flex";
      if (userEmailDisplay) userEmailDisplay.textContent = user.email;
      if (authStatusText) authStatusText.textContent = user.email;
      
      if (historySection) historySection.classList.remove("hidden");

      loadUserHistories(user.uid);
    } else {
      if (loggedOutView) loggedOutView.style.display = "block";
      if (loggedInView) loggedInView.style.display = "none";
      if (authStatusText) authStatusText.textContent = "未ログイン";
      
      if (historySection) historySection.classList.add("hidden");

      clearHistoryUI();
    }
  });

  // 履歴をすべて削除するボタン
  const clearHistoryBtn = $("clearHistoryBtn");
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) return;
      if (!confirm("本当にすべての履歴を削除しますか？")) return;

      try {
        const { collection, query, where, getDocs, deleteDoc, doc } = window.firebaseFirestoreFns;
        const q = query(collection(db, "histories"), where("uid", "==", user.uid));
        const snapshot = await getDocs(q);
        
        const deletePromises = snapshot.docs.map(document => deleteDoc(doc(db, "histories", document.id)));
        await Promise.all(deletePromises);

        loadUserHistories(user.uid);
      } catch (err) {
        console.error("履歴の削除に失敗しました:", err);
      }
    });
  }
}

// Firestore への履歴保存用グローバル関数
window.saveUserHistory = async function(actionType, details) {
  const auth = window.firebaseAuth;
  const db = window.firebaseDb;
  if (!auth || !db) return;

  const user = auth.currentUser;
  if (!user) return;

  try {
    const { collection, addDoc, serverTimestamp } = window.firebaseFirestoreFns;
    await addDoc(collection(db, "histories"), {
      uid: user.uid,
      actionType: actionType, 
      details: details,       
      createdAt: serverTimestamp()
    });
    loadUserHistories(user.uid);
  } catch (err) {
    console.error("履歴の保存に失敗しました:", err);
  }
};

async function loadUserHistories(uid) {
  const db = window.firebaseDb;
  if (!db) return;

  try {
    const { collection, query, where, orderBy, getDocs } = window.firebaseFirestoreFns;
    const q = query(
      collection(db, "histories"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    const histories = [];
    snapshot.forEach(docSnap => {
      histories.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderHistoryList(histories);
  } catch (err) {
    console.error("履歴の取得エラー:", err);
  }
}

function renderHistoryList(histories) {
  const listEl = $("history-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  if (histories.length === 0) {
    listEl.innerHTML = "<li style='color: #888; padding: 6px 8px;'>履歴はまだありません。</li>";
    return;
  }

  histories.forEach(item => {
    const li = document.createElement("li");
    li.style.padding = "8px";
    li.style.borderBottom = "1px solid #f0f0f0";
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    
    const dateStr = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : "同期中...";
    const typeLabel = item.actionType === "image-convert" ? "🖼️ 変換" : item.actionType === "pdf-editor" ? "📕 PDF編集" : "📦 ZIP圧縮";
    
    const textSpan = document.createElement("span");
    textSpan.textContent = `[${dateStr}] ${typeLabel}: ${JSON.stringify(item.details)}`;
    
    // 個別の履歴を削除するボタン
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "削除";
    deleteBtn.style.background = "none";
    deleteBtn.style.border = "none";
    deleteBtn.style.color = "#d73a49";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.style.fontSize = "0.8rem";
    deleteBtn.style.marginLeft = "10px";

    deleteBtn.addEventListener("click", async () => {
      try {
        const db = window.firebaseDb;
        const { deleteDoc, doc } = window.firebaseFirestoreFns;
        await deleteDoc(doc(db, "histories", item.id));
        const auth = window.firebaseAuth;
        if (auth.currentUser) {
          loadUserHistories(auth.currentUser.uid);
        }
      } catch (err) {
        console.error("履歴項目の削除エラー:", err);
      }
    });

    li.append(textSpan, deleteBtn);
    listEl.appendChild(li);
  });
}

function clearHistoryUI() {
  const listEl = $("history-list");
  if (listEl) {
    listEl.innerHTML = "<li style='color: #888; padding: 6px 8px;'>ログインすると履歴が表示されます。</li>";
  }
}

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

if ($("settingsBtn")) {
  $("settingsBtn").addEventListener("click", () => {
    showPage("settings");
    renderSettings();
  });
}

function setStatus(message = "", isError = false) {
  const status = $("status");
  if (!status) return;

  status.textContent = message;
  status.style.color = isError ? "#d94848" : "#16845b";
}

function updateConvertButtonState() {
  const convertBtn = $("convertBtn");
  if (convertBtn) {
    convertBtn.disabled = !(selectedFiles.length > 0 && selectedFormat !== null);
  }
}

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

window.addEventListener("file-studio-files-changed", event => {
  if (event.detail && event.detail.files) {
    displayFiles(event.detail.files);
  }
});

function saveFavorites() {
  localStorage.setItem(
    "fileStudioFavorites",
    JSON.stringify(favorites)
  );

  renderFormats();
  renderSettings();
}

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
        successfulFiles.push(file);
        
        if (typeof window.saveUserHistory === "function") {
          await window.saveUserHistory("image-convert", { fileName: outputName, format: selectedFormat });
        }

        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error("変換エラー:", error);
        errors.push(`${file.name}: ${error.message}`);
      }
    }

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

renderFormats();
renderSettings();
updateConvertButtonState();

if ($("otherFormats")) {
  $("otherFormats").hidden = true;
  $("otherFormats").classList.add("hidden");
}