// ================= הגדרות ראשיות =================
const tablesMeta = [
  { title: "טור 5000", color: "text-blue-700", cols: 6 },
  { title: "טור 4000", color: "text-green-700", cols: 12 },
  { title: "טור 3000", color: "text-purple-700", cols: 12 },
  { title: "טור 2000", color: "text-orange-700", cols: 12 },
  { title: "טור 1000", color: "text-red-700", cols: 7 }
];
const numRows = 31, cellWidth = 60, cellHeight = 36;
const cellData = {};
const blackedCells = {};
let adminMode = false, firstSelected = null, lastSelected = null;
let selectedForBlackout = new Set();
let selectedForUnblackout = new Set();

// ================== ייבוא שמות מקובץ ==================
document.getElementById('importFile').addEventListener('change', function(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt){ importNamesFromText(evt.target.result); };
  reader.readAsText(file, "utf-8");
  e.target.value = '';
});

// ================== אירועי קליק ==================
document.addEventListener('click', function(e) {
  const cell = e.target.closest('td.cell-btn');
  if (!cell) return;
  const cellId = cell.dataset.cellid;
  if (blackedCells[cellId] && !adminMode) return; // תא מושחר לא נפתח במצב רגיל
  if (adminMode) {
    handleAdminCellClick(cellId);
  } else {
    showModal(cellId);
  }
});

// סגירת טופס/מודל בכל לחיצה על הרקע או האיקס
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-bg') || e.target.classList.contains('modal-close-btn')) {
    closeModal();
  }
});

// ================== בניית טבלאות ==================

function buildColgroup(cols) {
  return `<colgroup>${Array.from({length: cols}).map(()=>`<col style="width:${cellWidth}px;">`).join('')}</colgroup>`;
}

function buildTableHeaders(cols) {
  let tds = "";
  for (let i = 1; i <= cols; i++) tds += `<th class="border">${i}</th>`;
  return `<thead><tr>${tds}</tr></thead>`;
}

// תא מפוצל: מספר מושב למעלה + שם בחור למטה
function buildSplitCell(cellId) {
  const data = cellData[cellId] || {};
  const isBlacked = blackedCells[cellId];

  return `
    <div class="split-cell${isBlacked ? ' blacked' : ''}" data-cellid="${cellId}">
      <div class="split-cell-part${isBlacked ? ' blacked-text' : ''}">
        ${data.seatNum ? data.seatNum : ""}
      </div>
      <div class="split-divider"></div>
      <div class="split-cell-part split-cell-part-bottom${isBlacked ? ' blacked-text' : ''}">
        ${data.name ? data.name : ""}
      </div>
    </div>
  `;
}

// בניית שורות הטבלה עם תמיכה ב-Drag & Drop
function buildTableRows(cols, tableIndex) {
  let trs = "";
  for (let row = 1; row <= numRows; row++) {
    let tds = "";
    for (let col = cols; col >= 1; col--) {
      let cellId = `t${tableIndex}_r${row}_c${col}`;
      let classes = "border cell-btn";
      if (adminMode && isCellInSelectedRange(cellId)) classes += " selected-range";
      if (selectedForBlackout.has(cellId)) classes += " selected-for-black";
      if (selectedForUnblackout.has(cellId)) classes += " selected-for-unblack";
      if (blackedCells[cellId]) classes += " cell-blacked";
      // תמיכה ב-Drag & Drop
      tds += `<td class="${classes}" data-cellid="${cellId}"
                ondragover="seatDragOver(event, '${cellId}')"
                ondrop="seatDrop(event, '${cellId}')"
                ondragleave="seatDragLeave(event, '${cellId}')"
              >${buildSplitCell(cellId)}</td>`;
    }
    trs += `<tr>${tds}</tr>`;
  }
  return `<tbody>${trs}</tbody>`;
}

function buildTableHtml({title, color, cols}, tableIndex) {
  return `
  <div class="bg-white rounded-xl shadow p-3 flex flex-col items-center">
    <h2 class="font-bold ${color} mb-2 text-lg text-center">${title} </h2>
    <div style="overflow-x:auto;">
      <table class="border border-gray-300 text-xs mx-auto" dir="rtl">
        ${buildColgroup(cols)}
        ${buildTableHeaders(cols)}
        ${buildTableRows(cols, tableIndex)}
      </table>
    </div>
  </div>
  `;
}

function renderTables() {
  document.getElementById("tables-container").innerHTML =
    tablesMeta.map(buildTableHtml).join('');
  // שליטה על כפתורים
  const doBlackBtn = document.getElementById('doBlackoutBtn');
  if (adminMode && document.getElementById('blackoutBtn').classList.contains('active') && selectedForBlackout.size > 0) {
    doBlackBtn.style.display = '';
  } else {
    doBlackBtn.style.display = 'none';
  }
  const doUnblackBtn = document.getElementById('doUnblackoutBtn');
  if (adminMode && document.getElementById('unblackoutBtn').classList.contains('active') && selectedForUnblackout.size > 0) {
    doUnblackBtn.style.display = '';
  } else {
    doUnblackBtn.style.display = 'none';
  }
}

// ================== פונקציות זום ==================
let zoom = 1.0;
function applyZoom() {
  document.getElementById("zoomable").style.transform = `scale(${zoom})`;
  document.getElementById("zoom-level").innerText = Math.round(zoom*100) + "%";
}
function zoomIn()  { if (zoom < 2.2) { zoom += 0.1; zoom = Math.round(zoom*10)/10; applyZoom(); } }
function zoomOut() { if (zoom > 0.3) { zoom -= 0.1; zoom = Math.round(zoom*10)/10; applyZoom(); } }

// ================== גרירה/פאנינג ==================
const panOuter = document.getElementById('pan-outer');
let isDragging = false, lastX = 0, lastY = 0, scrollLeft = 0, scrollTop = 0;
panOuter.addEventListener('mousedown', function(e) {
  isDragging = true; panOuter.style.cursor = 'grabbing';
  lastX = e.clientX; lastY = e.clientY;
  scrollLeft = panOuter.scrollLeft; scrollTop = panOuter.scrollTop;
});
window.addEventListener('mousemove', function(e) {
  if (!isDragging) return;
  panOuter.scrollLeft = scrollLeft + (lastX - e.clientX);
  panOuter.scrollTop  = scrollTop  + (lastY - e.clientY);
});
window.addEventListener('mouseup', function(e) {
  isDragging = false; panOuter.style.cursor = 'grab';
});
panOuter.addEventListener('touchstart', function(e) {
  isDragging = true;
  lastX = e.touches[0].clientX;
  lastY = e.touches[0].clientY;
  scrollLeft = panOuter.scrollLeft;
  scrollTop = panOuter.scrollTop;
}, {passive:false});
panOuter.addEventListener('touchmove', function(e) {
  if (!isDragging) return;
  panOuter.scrollLeft = scrollLeft + (lastX - e.touches[0].clientX);
  panOuter.scrollTop  = scrollTop  + (lastY - e.touches[0].clientY);
}, {passive:false});
panOuter.addEventListener('touchend', function(e) {
  isDragging = false;
}, {passive:false});

// =================== בחירת תאים: השחרה, מספור וכו' ===================
function handleAdminCellClick(cellId) {
  // מצב השחרה
  if (document.getElementById('blackoutBtn').classList.contains('active')) {
    if (selectedForBlackout.has(cellId)) {
      selectedForBlackout.delete(cellId);
    } else {
      selectedForBlackout.add(cellId);
    }
    renderTables();
    return;
  }
  // מצב הסרת השחרה
  if (document.getElementById('unblackoutBtn').classList.contains('active')) {
    if (!blackedCells[cellId]) return; // רק מושחרים!
    if (selectedForUnblackout.has(cellId)) {
      selectedForUnblackout.delete(cellId);
    } else {
      selectedForUnblackout.add(cellId);
    }
    renderTables();
    return;
  }
  // מספור רץ רגיל
  if (!firstSelected) {
    firstSelected = cellId;
    lastSelected = null;
  } else if (!lastSelected) {
    lastSelected = cellId;
    showRunNumModal();
  } else {
    firstSelected = cellId;
    lastSelected = null;
    renderTables();
  }
  renderTables();
}

function toggleAdminMode() {
  adminMode = !adminMode;
  document.getElementById('adminBtn').classList.toggle('active', adminMode);
  document.getElementById('blackoutBtn').style.display = adminMode ? '' : 'none';
  document.getElementById('unblackoutBtn').style.display = adminMode ? '' : 'none';
  firstSelected = null; lastSelected = null;
  selectedForBlackout.clear();
  selectedForUnblackout.clear();
  closeModal();
  renderTables();
}
function toggleBlackoutMode() {
  const btn = document.getElementById('blackoutBtn');
  btn.classList.toggle('active');
  document.getElementById('unblackoutBtn').classList.remove('active');
  selectedForBlackout.clear();
  selectedForUnblackout.clear();
  renderTables();
}
function blackoutSelected() {
  if (!adminMode || selectedForBlackout.size == 0) return;
  selectedForBlackout.forEach(cellId => {
    blackedCells[cellId] = true;
  });
  saveToStorage();
  selectedForBlackout.clear();
  document.getElementById('blackoutBtn').classList.remove('active');
  renderTables();
}
function toggleUnblackoutMode() {
  const btn = document.getElementById('unblackoutBtn');
  btn.classList.toggle('active');
  document.getElementById('blackoutBtn').classList.remove('active');
  selectedForBlackout.clear();
  selectedForUnblackout.clear();
  renderTables();
}
function unblackoutSelected() {
  if (!adminMode || selectedForUnblackout.size == 0) return;
  selectedForUnblackout.forEach(cellId => {
    delete blackedCells[cellId];
  });
  saveToStorage();
  selectedForUnblackout.clear();
  document.getElementById('unblackoutBtn').classList.remove('active');
  renderTables();
}

// ================== מספור רץ ==================
function isCellInSelectedRange(cellId) {
  if (!firstSelected || !lastSelected) return false;
  const allIds = getAllCellIds();
  const idx1 = allIds.indexOf(firstSelected);
  const idx2 = allIds.indexOf(lastSelected);
  if (idx1 < 0 || idx2 < 0) return false;
  const from = Math.min(idx1, idx2), to = Math.max(idx1, idx2);
  const myIdx = allIds.indexOf(cellId);
  return myIdx >= from && myIdx <= to;
}
function getAllCellIds() {
  const ids = [];
  tablesMeta.forEach((meta, tIdx) => {
    for (let r = 1; r <= numRows; r++) {
      for (let c = 1; c <= meta.cols; c++) {
        ids.push(`t${tIdx}_r${r}_c${c}`);
      }
    }
  });
  return ids;
}
function showRunNumModal() {
  document.getElementById('modal-area').innerHTML = `
    <div class="modal-bg">
      <form class="modal-card modal-run-num" onsubmit="event.preventDefault();applyRunNum();">
        <button type="button" class="modal-close-btn" title="סגור">&times;</button>
        <div style="font-size:1.18em;font-weight:bold;color:#ba8405;">מספור רץ</div>
        <div class="desc">הזן מספר התחלתי. כל התאים שבין הבחירה הראשונה לשנייה יקבלו מספור אוטומטי לפי הסדר.</div>
        <label>מספר התחלתי:</label>
        <input type="number" id="runNumStart" min="1" style="direction:ltr;" required autofocus />
        <button type="submit">אישור מספור</button>
      </form>
    </div>
  `;
  setTimeout(()=>{document.getElementById('runNumStart').focus()},150);
}
function applyRunNum() {
  const start = parseInt(document.getElementById('runNumStart').value,10);
  if (isNaN(start)) return;
  const allIds = getAllCellIds();
  const idx1 = allIds.indexOf(firstSelected), idx2 = allIds.indexOf(lastSelected);
  if (idx1 < 0 || idx2 < 0) return;
  const from = Math.min(idx1, idx2), to = Math.max(idx1, idx2);
  let num = start;
  for (let i = from; i <= to; i++) {
    const cid = allIds[i];
    if (!cellData[cid]) cellData[cid] = {};
    cellData[cid].seatNum = num++;
  }
  closeModal();
  saveToStorage();
  firstSelected = lastSelected = null;
  renderTables();
}

// ================== טופס עריכת מושב ==================
function showModal(cellId) {
  const data = cellData[cellId] || {};
  document.getElementById('modal-area').innerHTML = `
    <div class="modal-bg">
      <form class="modal-card" onsubmit="event.preventDefault();saveModal('${cellId}');">
        <button type="button" class="modal-close-btn" title="סגור">&times;</button>
        <div class="modal-section-title">נתוני מושב</div>
        <label>מספר מקום:</label>
        <input type="text" id="seatNum" placeholder="לדוג' 27" autocomplete="off" value="${data.seatNum ? data.seatNum : ''}" ${!adminMode ? 'readonly' : ''} />
        <div class="modal-section-title">נתוני משתמש</div>
        <label>שם משתמש:</label>
        <input type="text" id="userName" placeholder="שם מלא" autocomplete="off" value="${data.name ? data.name : ''}" />
        <label>טלפון:</label>
        <input type="tel" id="userPhone" placeholder="050-0000000" autocomplete="off" value="${data.phone ? data.phone : ''}" />
        <label>הערה:</label>
        <textarea id="userNote" rows="2" placeholder="הערה חופשית...">${data.note ? data.note : ''}</textarea>
        <button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white font-bold px-5 py-2 rounded-xl mt-4">שמור וסגור</button>
      </form>
    </div>
  `;
}
function saveModal(cellId) {
  const seatNum = document.getElementById('seatNum').value.trim();
  const name = document.getElementById('userName').value.trim();
  const phone = document.getElementById('userPhone').value.trim();
  const note = document.getElementById('userNote').value.trim();
  cellData[cellId] = { seatNum, name, phone, note };
  closeModal();
  saveToStorage();
  renderTables();
  renderCrmTable(); // עדכון CRM
}
function closeModal() {
  document.getElementById('modal-area').innerHTML = '';
}

// ================== שמירה/טעינה ל-LocalStorage ==================
function saveToStorage() {
  localStorage.setItem('seatMapData', JSON.stringify(cellData));
  localStorage.setItem('blackedCells', JSON.stringify([...Object.keys(blackedCells)]));
}
function loadFromStorage() {
  const json = localStorage.getItem('seatMapData');
  if (json) try { Object.assign(cellData, JSON.parse(json)); } catch(e){}
  const blackJson = localStorage.getItem('blackedCells');
  if (blackJson) {
    JSON.parse(blackJson).forEach(cellId => { blackedCells[cellId] = true; });
  }
}

// ================== ייבוא נתונים מקובץ TXT/CSV ==================
function importNamesFromText(txt) {
  const map = {};
  txt.split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;
    const [num, rest] = line.split('=');
    if (!num || !rest) return;
    const [name, phone, note] = rest.split(',');
    map[num.trim()] = {
      name: (name||'').trim(),
      phone: (phone||'').trim(),
      note: (note||'').trim()
    };
  });
  const allIds = getAllCellIds();
  allIds.forEach(cellId => {
    let d = cellData[cellId];
    if (!d || !d.seatNum) return;
    const val = map[d.seatNum];
    if (val) {
      if (!cellData[cellId]) cellData[cellId] = {};
      cellData[cellId].name = val.name;
      cellData[cellId].phone = val.phone;
      cellData[cellId].note = val.note;
    }
  });
  saveToStorage();
  renderTables();
  renderCrmTable();
  alert('הייבוא בוצע בהצלחה!');
}

// ================== ייצוא נתונים לקובץ TXT ==================
function exportToFile() {
  let rows = [];
  const allIds = getAllCellIds();
  allIds.forEach(cellId => {
    const d = cellData[cellId];
    if (d && d.seatNum) {
      const name = d.name || '';
      const phone = d.phone || '';
      const note = d.note || '';
      rows.push(`${d.seatNum}=${name},${phone},${note}`);
    }
  });
  const txt = rows.join('\n');
  const blob = new Blob([txt], {type: 'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'seat_map_export.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ================ CRM ממשק צד נפתח  ==================

let crmData = []; // מערך הבחורים ל-CRM
let crmSidebarOpen = false;
let crmSidebarWidth = 380, crmResizeActive = false, crmDragStartX = 0, crmDragStartWidth = 380;

function toggleCrmSidebar(show){
  const sidebar = document.getElementById('crmSidebar');
  crmSidebarOpen = !!show;
  sidebar.classList.toggle('open', crmSidebarOpen);
  sidebar.style.display = crmSidebarOpen ? 'block' : 'none';
  if (crmSidebarOpen) {
    renderCrmTable();
    setTimeout(()=>{ document.getElementById('crmSearch').focus(); },250);
  }
}

// שינוי רוחב הסרגל על ידי גרירה
function crmStartResize(e){
  crmResizeActive = true;
  crmDragStartX = e.clientX;
  crmDragStartWidth = document.getElementById('crmSidebar').offsetWidth;
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', crmDoResize);
  document.addEventListener('mouseup', crmStopResize);
}
function crmDoResize(e){
  if (!crmResizeActive) return;
  let newWidth = crmDragStartWidth - (crmDragStartX - e.clientX);
  newWidth = Math.max(170, Math.min(newWidth, window.innerWidth-50));
  document.getElementById('crmSidebar').style.width = newWidth + "px";
}
function crmStopResize(){
  crmResizeActive = false;
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', crmDoResize);
  document.removeEventListener('mouseup', crmStopResize);
}

// גרירת בחור מממשק CRM אל מושב
function crmRowDragStart(e, idx){
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData('application/json', JSON.stringify(crmData[idx]));
  e.currentTarget.classList.add('dragging');
}
function crmRowDragEnd(e){
  e.currentTarget.classList.remove('dragging');
}

// גרירה על מושב – אירועי drop (להכניס לתא)
window.seatDragOver = function(event, cellId){
  event.preventDefault();
  document.querySelectorAll(`[data-cellid="${cellId}"]`).forEach(td=>td.classList.add("drag-over"));
}
window.seatDragLeave = function(event, cellId){
  document.querySelectorAll(`[data-cellid="${cellId}"]`).forEach(td=>td.classList.remove("drag-over"));
}
window.seatDrop = function(event, cellId){
  event.preventDefault();
  document.querySelectorAll(`[data-cellid="${cellId}"]`).forEach(td=>td.classList.remove("drag-over"));
  let dataStr = event.dataTransfer.getData('application/json');
  let rowData = null;
  try { rowData = JSON.parse(dataStr); } catch{}
  if (!rowData) return;
  // עדכון מושב + עדכון CRM
  const seatNum = getSeatNumForCellId(cellId);
  cellData[cellId] = {
    seatNum: seatNum,
    name: rowData["שם"]||rowData["name"]||rowData["fullName"]||"",
    phone: rowData["טלפון"]||rowData["phone"]||"",
    note: rowData["הערה"]||rowData["note"]||""
  };
  saveToStorage();
  renderTables();
  renderCrmTable();
};

// עוזר – מקבל מספר מושב עדכני מתוך cellId
function getSeatNumForCellId(cellId){
  if(cellData[cellId] && cellData[cellId].seatNum) return cellData[cellId].seatNum;
  // דוג' t1_r12_c6 – בדוק אם יש מספר מושב אחר בתא זה
  const match = cellId.match(/^t\d+_r(\d+)_c(\d+)$/);
  if (!match) return '';
  // אתה יכול להחליף את החישוב הבא למשהו אחר אם תרצה מספרים שונים
  // כאן רק מחזיר "שורה_עמודה" לדוג' 12_6
  return match[1] + "_" + match[2];
}

// =================== רינדור CRM ===================

function renderCrmTable(){
  if (!crmSidebarOpen) return;
  const wrap = document.getElementById('crmTableWrap');
  if (!crmData.length) {
    wrap.innerHTML = `<div class="crm-empty">אין בחורים לטעינה.<br>ייבא קובץ csv/טקסט.</div>`;
    return;
  }
  // חיפוש
  const q = (document.getElementById('crmSearch').value||'').trim();
  let dataFiltered = crmData.filter(row => {
    if (!q) return true;
    return Object.values(row).some(v=> (v||"").toString().includes(q));
  });
  // טבלה
  let thead = `<thead><tr>${Object.keys(crmData[0]).map(k=>`<th>${k}</th>`).join("")}</tr></thead>`;
  let tbody = dataFiltered.map((row, idx) => `<tr
      draggable="true"
      ondragstart="crmRowDragStart(event,${idx})"
      ondragend="crmRowDragEnd(event)"
    >${Object.values(row).map(v=>`<td>${v||""}</td>`).join("")}</tr>`).join("");
  wrap.innerHTML = `<table class="crm-table">${thead}<tbody>${tbody}</tbody></table>`;
}

// =================== ייבוא קובץ CRM ===================
function crmImportFile(input){
  if (!input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = function(evt){
    let text = evt.target.result;
    // תמיכה גם ב־CSV וגם ב־TXT
    crmData = parseCsvToObjects(text);
    renderCrmTable();
  };
  reader.readAsText(file, "utf-8");
  input.value = '';
}

// פרסר CSV גמיש
function parseCsvToObjects(text){
  const rows = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length);
  if (!rows.length) return [];
  const headers = rows[0].split(',').map(x=>x.trim());
  return rows.slice(1).map(row=>{
    const vals = row.split(',');
    let obj = {};
    headers.forEach((h,i)=>obj[h]=vals[i]?vals[i].trim():"");
    return obj;
  });
}

// ============== טעינה ראשונית ==============
loadFromStorage();
renderTables();
applyZoom();
  