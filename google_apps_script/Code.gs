const SHEET_NAME = 'responses';
const HEADERS = [
  'server_timestamp',
  'record_key',
  'batch_id',
  'study_id',
  'annotator_id',
  'item_id',
  'question_type',
  'answer',
  'answer_field',
  'page_index',
  'task_order',
  'client_timestamp',
  'user_agent'
];

function ensureSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeader = firstRow.every(value => value === '');
  if (needsHeader || firstRow.join('\t') !== HEADERS.join('\t')) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

function normalizeRecords_(payload) {
  if (Array.isArray(payload.records)) {
    return payload.records;
  }
  return [payload];
}

function existingRowByKey_(sheet) {
  const lastRow = sheet.getLastRow();
  const index = {};
  if (lastRow < 2) return index;

  const keyColumn = HEADERS.indexOf('record_key') + 1;
  const keys = sheet.getRange(2, keyColumn, lastRow - 1, 1).getValues();
  keys.forEach((row, idx) => {
    const key = row[0];
    if (key) {
      index[key] = idx + 2;
    }
  });
  return index;
}

function rowFromRecord_(record) {
  const normalized = Object.assign({}, record);
  if (!normalized.record_key) {
    normalized.record_key = [
      normalized.study_id || '',
      normalized.annotator_id || '',
      normalized.item_id || '',
      normalized.question_type || ''
    ].join(':');
  }
  return HEADERS.map(header => {
    if (header === 'server_timestamp') return new Date();
    return normalized[header] || '';
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = ensureSheet_();
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    const rowByKey = existingRowByKey_(sheet);
    const rowsToAppend = [];
    normalizeRecords_(payload).forEach(record => {
      if (!record.batch_id && payload.batch_id) {
        record.batch_id = payload.batch_id;
      }
      const row = rowFromRecord_(record);
      const recordKey = row[HEADERS.indexOf('record_key')];
      const existingRow = rowByKey[recordKey];
      if (existingRow) {
        sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([row]);
      } else {
        rowsToAppend.push(row);
      }
    });
    if (rowsToAppend.length) {
      sheet
        .getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, HEADERS.length)
        .setValues(rowsToAppend);
    }
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
