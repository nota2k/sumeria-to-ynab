let convertedData = null;

const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const downloadBtn = document.getElementById("downloadBtn");
const statusDiv = document.getElementById("status");
const mappingInfoDiv = document.getElementById("mappingInfo");
const previewDiv = document.getElementById("preview");

// Gestion du clic sur la zone d'upload
uploadArea.addEventListener("click", () => fileInput.click());

// Gestion du drag & drop
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
});

// Gestion de la sélection de fichier
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

// Fonction pour traiter le fichier
function handleFile(file) {
  if (!file.name.endsWith(".csv")) {
    showStatus("Veuillez sélectionner un fichier CSV", "error");
    return;
  }

  showStatus("Lecture du fichier en cours...", "info");

  Papa.parse(file, {
    complete: function (results) {
      processCSV(results.data);
    },
    skipEmptyLines: true,
    encoding: "UTF-8",
  });
}

// Fonction pour traiter les données CSV
function processCSV(data) {
  if (data.length < 2) {
    showStatus("Le fichier CSV est vide ou invalide", "error");
    return;
  }

  // Trouver la ligne d'en-tête (peut ne pas être la première ligne)
  let headerRowIndex = -1;
  let headers = [];
  
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i].map((h) => h.trim());
    const dateCol = findColumn(row, ["date"]);
    const libelleCol = findColumn(row, ["libellé", "libelle", "libellÃ©"]);
    
    if (dateCol !== -1 && libelleCol !== -1) {
      headerRowIndex = i;
      headers = row;
      break;
    }
  }

  if (headerRowIndex === -1) {
    showStatus(
      "Ligne d'en-tête non trouvée. Recherche: Date, Libellé",
      "error"
    );
    return;
  }

  // Trouver les colonnes
  const dateCol = findColumn(headers, ["date"]);
  const libelleCol = findColumn(headers, ["libellé", "libelle", "libellÃ©"]);
  const debitCol = findColumn(headers, ["débit", "debit", "dÃ©bit"]);
  const creditCol = findColumn(headers, ["crédit", "credit", "crÃ©dit"]);

  if (dateCol === -1 || libelleCol === -1 || debitCol === -1) {
    showStatus(
      "Colonnes requises non trouvées. Recherche: Date, Libellé, Débit",
      "error"
    );
    showMappingInfo(
      { date: dateCol, libelle: libelleCol, debit: debitCol },
      headers
    );
    return;
  }

  // Créer le nouveau tableau
  const newData = [["Date", "Payee", "Memo", "Outflow"]];
  let skippedLines = 0;

  // Convertir les données (commencer après la ligne d'en-tête)
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (row.length > Math.max(dateCol, libelleCol, debitCol)) {
      // Ignorer les lignes qui ont une valeur dans la colonne Crédit
      if (creditCol !== -1 && row[creditCol] && row[creditCol].trim() !== "") {
        skippedLines++;
        continue;
      }
      
      newData.push([
        row[dateCol] || "",
        "", // Payee vide
        row[libelleCol] || "",
        row[debitCol] || "",
      ]);
    }
  }

  convertedData = newData;
  const statusMessage = skippedLines > 0
    ? `✅ Conversion réussie! ${newData.length - 1} lignes traitées (${skippedLines} lignes de crédit ignorées)`
    : `✅ Conversion réussie! ${newData.length - 1} lignes traitées`;
  
  showStatus(statusMessage, "success");
  showMappingInfo(
    { date: dateCol, libelle: libelleCol, debit: debitCol },
    headers,
    true
  );
  showPreview(newData);
  downloadBtn.disabled = false;
}

// Fonction pour trouver une colonne
function findColumn(headers, searchTerms) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase();
    for (const term of searchTerms) {
      if (header.includes(term.toLowerCase())) {
        return i;
      }
    }
  }
  return -1;
}

// Afficher le statut
function showStatus(message, type) {
  statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
}

// Afficher les informations de mapping
function showMappingInfo(indices, headers, success = false) {
  if (!success) {
    mappingInfoDiv.innerHTML = `
                    <div class="mapping-info">
                        <h3>❌ Colonnes détectées</h3>
                        <div class="mapping-item">Date: ${
                          indices.date >= 0
                            ? headers[indices.date]
                            : "Non trouvée"
                        }</div>
                        <div class="mapping-item">Libellé: ${
                          indices.libelle >= 0
                            ? headers[indices.libelle]
                            : "Non trouvée"
                        }</div>
                        <div class="mapping-item">Débit: ${
                          indices.debit >= 0
                            ? headers[indices.debit]
                            : "Non trouvée"
                        }</div>
                    </div>
                `;
  } else {
    mappingInfoDiv.innerHTML = `
                    <div class="mapping-info">
                        <h3>✅ Mapping des colonnes</h3>
                        <div class="mapping-item">"${
                          headers[indices.date]
                        }" → Date</div>
                        <div class="mapping-item">"${
                          headers[indices.libelle]
                        }" → Memo</div>
                        <div class="mapping-item">"${
                          headers[indices.debit]
                        }" → Outflow</div>
                        <div class="mapping-item" style="color: #888;">Payee reste vide</div>
                    </div>
                `;
  }
}

// Afficher un aperçu
function showPreview(data) {
  const maxRows = 10;
  let html =
    '<div class="preview"><h3 style="color: #667eea; margin-bottom: 15px;">Aperçu (10 premières lignes)</h3><table>';

  // En-têtes
  html += "<tr>";
  for (const header of data[0]) {
    html += `<th>${header}</th>`;
  }
  html += "</tr>";

  // Lignes de données (max 10)
  for (let i = 1; i < Math.min(data.length, maxRows + 1); i++) {
    html += "<tr>";
    for (const cell of data[i]) {
      html += `<td>${cell}</td>`;
    }
    html += "</tr>";
  }

  html += "</table></div>";
  previewDiv.innerHTML = html;
}

// Télécharger le CSV
downloadBtn.addEventListener("click", () => {
  if (!convertedData) return;

  const csv = Papa.unparse(convertedData);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", "converted_" + new Date().getTime() + ".csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showStatus("✅ Fichier téléchargé avec succès!", "success");
});
