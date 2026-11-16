// js/file-manager.js

const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const addFilesBtn = document.getElementById("addFilesBtn");
const createFolderBtn = document.getElementById("createFolderBtn");
const downloadFilesBtn = document.getElementById("downloadFilesBtn");
const filePath = document.getElementById("filePath");

// 追加したZIP圧縮画面用の要素
const zipInput = document.getElementById("zipInput");
const zipName = document.getElementById("zipName");
const zipBtn = document.getElementById("zipBtn");

let managedFiles = [];
let folders = [];
let currentFolder = null;
let currentView = "icons";
let nextId = 1;

// ファイルサイズ表示
function formatFileSize(size) {
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
  return (size / (1024 * 1024)).toFixed(1) + " MB";
}

// 日付表示
function formatDate(timestamp) {
  const date = new Date(timestamp);

  return (
    date.getFullYear() + "年" +
    (date.getMonth() + 1) + "月" +
    date.getDate() + "日 " +
    String(date.getHours()).padStart(2, "0") + ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}

// ファイルアイコン
function getFileIcon(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif", "heic", "heif", "tif", "tiff"].includes(ext)) {
    return "🖼️";
  }

  if (ext === "pdf") return "📕";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";

  return "📄";
}

// ファイル追加ボタン
if (addFilesBtn && fileInput) {
  addFilesBtn.addEventListener("click", () => {
    fileInput.click();
  });

  // ファイル選択
  fileInput.addEventListener("change", () => {
    addManagedFiles(Array.from(fileInput.files));
    fileInput.value = "";
  });
}

// ドラッグ＆ドロップ
if (fileList) {
  ["dragenter", "dragover"].forEach(eventName => {
    fileList.addEventListener(eventName, event => {
      event.preventDefault();
      event.stopPropagation();
      fileList.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach(eventName => {
    fileList.addEventListener(eventName, event => {
      event.preventDefault();
      event.stopPropagation();
      fileList.classList.remove("drag-over");
    });
  });

  fileList.addEventListener("drop", event => {
    const files = Array.from(event.dataTransfer.files);
    addManagedFiles(files);
  });
}

// ファイル追加の共通処理
function addManagedFiles(files) {
  files.forEach(file => {
    const alreadyExists = managedFiles.some(item =>
      item.file.name === file.name &&
      item.file.size === file.size &&
      item.file.lastModified === file.lastModified
    );

    if (!alreadyExists) {
      managedFiles.push({
        id: nextId++,
        file,
        folderId: currentFolder,
        selected: false
      });
    }
  });

  renderFileList();
  notifyApp();
}

// 変換機能へファイル一覧を連携
function notifyApp() {
  window.dispatchEvent(
    new CustomEvent("file-studio-files-changed", {
      detail: {
        files: managedFiles.map(item => item.file)
      }
    })
  );
}

// フォルダ作成
if (createFolderBtn) {
  createFolderBtn.addEventListener("click", () => {
    const name = prompt("新しいフォルダ名を入力してください。");

    if (!name || !name.trim()) return;

    folders.push({
      id: nextId++,
      name: name.trim(),
      parentId: currentFolder
    });

    renderFileList();
  });
}

// フォルダを開く
function openFolder(id) {
  currentFolder = id;
  renderFileList();
}

// ひとつ上のフォルダへ
function goBackFolder() {
  if (currentFolder === null) return;

  const folder = folders.find(item => item.id === currentFolder);
  currentFolder = folder ? folder.parentId : null;

  renderFileList();
}

// フォルダの階層名
function getFolderPath() {
  const names = [];
  let id = currentFolder;

  while (id !== null) {
    const folder = folders.find(item => item.id === id);
    if (!folder) break;

    names.unshift(folder.name);
    id = folder.parentId;
  }

  return "📁 ファイル" + (names.length ? " / " + names.join(" / ") : "");
}

// ファイル・フォルダ表示
function renderFileList() {
  if (!fileList) return;
  fileList.innerHTML = "";
  fileList.className = "file-list";

  if (currentView === "icons") {
    fileList.classList.add("icon-view");
  } else if (currentView === "tree") {
    fileList.classList.add("tree-view");
  }

  if (filePath) {
    filePath.textContent = getFolderPath();
  }

  let hasContent = false;

  if (currentFolder !== null) {
    const back = document.createElement("div");
    back.className = "file-item";
    back.innerHTML = `
      <span class="file-icon">⬆️</span>
      <span class="file-name">上のフォルダへ戻る</span>
    `;
    back.addEventListener("click", goBackFolder);
    fileList.appendChild(back);
  }

  if (currentView === "tree" && currentFolder === null) {
    renderTree(null, 0);
    hasContent = folders.length > 0 || managedFiles.length > 0;
  } else {
    hasContent = renderCurrentFolder();
  }

  if (!hasContent) {
    const empty = document.createElement("div");
    empty.className = "drop-empty";
    empty.innerHTML = `
      <div class="drop-icon">⇩</div>
      <p>ファイルをここにドラッグ＆ドロップして追加できます。</p>
    `;
    fileList.appendChild(empty);
  }

  if (currentView === "details" && hasContent) {
    addDetailsHeader();
    if (fileList.lastElementChild) {
      fileList.prepend(fileList.lastElementChild);
    }
  }
}

// 詳細表示の見出し
function addDetailsHeader() {
  const header = document.createElement("div");
  header.className = "details-header";
  header.innerHTML = `
    <span></span>
    <span>名称</span>
    <span>最終更新日時</span>
    <span>サイズ</span>
    <span>タイプ</span>
    <span></span>
  `;
  fileList.appendChild(header);
}

// 現在のフォルダの中身
function renderCurrentFolder() {
  const currentFolders = folders.filter(folder =>
    folder.parentId === currentFolder
  );

  const currentFiles = managedFiles.filter(item =>
    item.folderId === currentFolder
  );

  currentFolders.forEach(folder => {
    const row = document.createElement("div");
    row.className = "file-item folder-item";

    row.innerHTML = `
      <span class="file-icon">📁</span>
      <span class="file-name">${escapeHTML(folder.name)}</span>
      <button class="delete-file" title="フォルダを削除">削除</button>
    `;

    row.querySelector(".file-name").addEventListener("click", () => {
      openFolder(folder.id);
    });

    row.querySelector(".file-icon").addEventListener("click", () => {
      openFolder(folder.id);
    });

    row.querySelector(".delete-file").addEventListener("click", event => {
      event.stopPropagation();
      deleteFolder(folder.id);
    });

    fileList.appendChild(row);
  });

  currentFiles.forEach(item => {
    fileList.appendChild(createFileRow(item));
  });

  return currentFolders.length > 0 || currentFiles.length > 0;
}

// ツリー表示
function renderTree(parentId, depth) {
  const childFolders = folders.filter(folder =>
    folder.parentId === parentId
  );

  childFolders.forEach(folder => {
    const row = document.createElement("div");
    row.className = "file-item folder-item";
    row.style.paddingLeft = (10 + depth * 22) + "px";

    row.innerHTML = `
      <span class="file-icon">📁</span>
      <span class="file-name">${escapeHTML(folder.name)}</span>
    `;

    row.querySelector(".file-name").addEventListener("click", () => {
      openFolder(folder.id);
    });

    row.querySelector(".file-icon").addEventListener("click", () => {
      openFolder(folder.id);
    });

    fileList.appendChild(row);

    managedFiles
      .filter(item => item.folderId === folder.id)
      .forEach(item => {
        const fileRow = createFileRow(item);
        fileRow.style.paddingLeft = (32 + depth * 22) + "px";
        fileList.appendChild(fileRow);
      });

    renderTree(folder.id, depth + 1);
  });

  if (parentId === null) {
    managedFiles
      .filter(item => item.folderId === null)
      .forEach(item => {
        fileList.appendChild(createFileRow(item));
      });
  }
}

// ファイル行を作成
function createFileRow(item) {
  const row = document.createElement("div");
  row.className = "file-item";

  if (item.selected) row.classList.add("selected");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = item.selected;

  checkbox.addEventListener("change", () => {
    item.selected = checkbox.checked;
    renderFileList();
  });

  const icon = document.createElement("span");
  icon.className = "file-icon";
  icon.textContent = getFileIcon(item.file);

  const name = document.createElement("span");
  name.className = "file-name";
  name.textContent = item.file.name;

  const info = document.createElement("span");
  info.className = "file-info";

  if (currentView === "details") {
    info.innerHTML = `
      <span>${formatDate(item.file.lastModified)}</span>
      <span>${formatFileSize(item.file.size)}</span>
      <span>${escapeHTML(item.file.type || "形式不明")}</span>
    `;
  }

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-file";
  deleteButton.textContent = "削除";
  deleteButton.title = "ファイルを削除";

  deleteButton.addEventListener("click", event => {
    event.stopPropagation();
    deleteFile(item.id);
  });

  row.addEventListener("click", event => {
    if (event.target === checkbox || event.target === deleteButton) return;
    item.selected = !item.selected;
    renderFileList();
  });

  row.append(checkbox, icon, name, info, deleteButton);

  return row;
}

// HTMLへの文字列挿入を安全にする
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// ファイル削除
function deleteFile(id) {
  managedFiles = managedFiles.filter(item => item.id !== id);
  renderFileList();
  notifyApp();
}

// フォルダ削除
function deleteFolder(id) {
  if (!confirm("このフォルダと中のファイルを削除しますか？")) return;

  const removeFolderIds = [id];

  for (let i = 0; i < removeFolderIds.length; i++) {
    const parentId = removeFolderIds[i];

    folders
      .filter(folder => folder.parentId === parentId)
      .forEach(folder => removeFolderIds.push(folder.id));
  }

  folders = folders.filter(folder =>
    !removeFolderIds.includes(folder.id)
  );

  managedFiles = managedFiles.filter(item =>
    !removeFolderIds.includes(item.folderId)
  );

  if (removeFolderIds.includes(currentFolder)) {
    currentFolder = null;
  }

  renderFileList();
  notifyApp();
}

// 【機能追加】独立したZIP圧縮セクション（#zipInput, #zipName, #zipBtn）の処理
if (zipBtn && zipInput) {
  zipBtn.addEventListener("click", async () => {
    const files = zipInput.files;
    if (!files || files.length === 0) {
      alert("ZIPにまとめるファイルを選択してください。");
      return;
    }

    if (!window.JSZip) {
      alert("ZIPライブラリ（JSZip）が読み込まれていません。");
      return;
    }

    const zip = new JSZip();

    for (let i = 0; i < files.length; i++) {
      zip.file(files[i].name, files[i]);
    }

    try {
      const blob = await zip.generateAsync({ type: "blob" });
      const filename = zipName && zipName.value.trim() !== "" ? zipName.value.trim() : "archive.zip";
      
      downloadBlob(blob, filename);
      alert("ZIPファイルの作成が完了しました！");
    } catch (error) {
      console.error("ZIPの作成に失敗しました:", error);
      alert("ZIPの作成中にエラーが発生しました。");
    }
  });
}

// 選択したファイルをダウンロード（ファイルマネージャー内）
if (downloadFilesBtn) {
  downloadFilesBtn.addEventListener("click", async () => {
    const selected = managedFiles.filter(item => item.selected);

    if (selected.length === 0) {
      alert("ダウンロードするファイルを選択してください。");
      return;
    }

    if (selected.length === 1) {
      downloadBlob(selected[0].file, selected[0].file.name);
      return;
    }

    if (!window.JSZip) {
      alert("ZIPライブラリを読み込めません。");
      return;
    }

    const zip = new JSZip();

    selected.forEach((item, index) => {
      let filename = item.file.name;

      if (zip.file(filename)) {
        const dot = filename.lastIndexOf(".");
        const base = dot > 0 ? filename.slice(0, dot) : filename;
        const ext = dot > 0 ? filename.slice(dot) : "";
        filename = `${base}_${index + 1}${ext}`;
      }

      zip.file(filename, item.file);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, "files.zip");
  });
}

// ダウンロード実行
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 表示切り替え
document.querySelectorAll(".view-btn").forEach(button => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;

    document.querySelectorAll(".view-btn").forEach(btn => {
      btn.classList.toggle("active", btn === button);
    });

    renderFileList();
  });
});

// 初期表示
renderFileList();