const SHEET_NAME = 'responses';
const HEADERS = [
  'server_timestamp',
  'study_id',
  'annotator_id',
  'item_id',
  'question_type',
  'answer',
  'answer_field',
  'page_index',
  'task_order',
  'client_timestamp',
  'page_url',
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
  if (needsHeader) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = ensureSheet_();
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    const row = HEADERS.map(header => {
      if (header === 'server_timestamp') return new Date();
      return payload[header] || '';
    });
    sheet.appendRow(row);
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
