/************ CONFIG ************/
const SPREADSHEET_ID = 'https://docs.google.com/spreadsheets/d/1wLiBZl8J9NhdGJeA2mF6QWWV_xHUl64ydq09YRtMGLg/edit?usp=sharing'; // <<<< DÁN ID SHEET
const SHEET_NAME = 'products';                     // tab dữ liệu
const LOG_SHEET = 'StockLog';                    // log nhập/xuất (auto tạo)
const ADMIN_EMAIL = 'haivothanh0603@gmail.com';  // mail admin của bạn

/************ ROUTER ************/
function doGet(e) {
  const page = e?.parameter?.page || 'index';
  return HtmlService.createTemplateFromFile(page)
    .evaluate()
    .setTitle('Kho Phụ Tùng')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/************ SHEET HELPERS ************/
function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}
function sh_() {
  const sh = ss_().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Không tìm thấy tab dữ liệu: ' + SHEET_NAME);
  return sh;
}
function logSh_() {
  const ss = ss_();
  let sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET);
    sh.appendRow(['time', 'type', 'id', 'oem', 'name', 'qty', 'before', 'after', 'note']);
  }
  return sh;
}
function colMap_(headerRow) {
  return Object.fromEntries(headerRow.map((h, idx) => [String(h), idx]));
}

/************ FILTER OPTIONS ************/
function getFilterOptions() {
  const values = sh_().getDataRange().getValues();
  if (values.length < 2) return { categories: [], brands: [] };

  const h = values[0].map(String);
  const c = colMap_(h);
  const cats = new Set();
  const brands = new Set();

  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const cat = String(r[c.category] || '').trim();
    const br = String(r[c.brand] || '').trim();
    if (cat) cats.add(cat);
    if (br) brands.add(br);
  }

  return { categories: [...cats].sort(), brands: [...brands].sort() };
}

/************ LIST PRODUCTS + FILTER ************/
function getProducts(filters) {
  const f = filters || {};
  const q = (f.q || '').toString().trim().toLowerCase();
  const category = (f.category || '').toString().trim();
  const brand = (f.brand || '').toString().trim();

  const values = sh_().getDataRange().getValues();
  if (values.length < 2) return [];

  const h = values[0].map(String);
  const c = colMap_(h);

  const out = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];

    const item = {
      id: String(r[c.id] || ''),
      oem: String(r[c.oem] || ''),
      name: String(r[c.name] || ''),
      category: String(r[c.category] || ''),
      brand: String(r[c.brand] || ''), // thương hiệu sản phẩm
      info: String(r[c.info] || ''),
      price: Number(r[c.price] || 0),
      stock: Number(r[c.stock] || 0),
      imageUrl: String(r[c.imageUrl] || ''),
    };

    if (category && item.category !== category) continue;
    if (brand && item.brand !== brand) continue;

    if (q) {
      const hay = `${item.id} ${item.oem} ${item.name} ${item.brand} ${item.category} ${item.info}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    out.push(item);
  }
  return out;
}

/************ ADMIN: OTP ************/
function requestAdminOtp() {
  const otp = String(Math.floor(100000 + Math.random() * 900000)); // 6 số
  CacheService.getScriptCache().put('admin_otp', otp, 5 * 60); // 5 phút
  MailApp.sendEmail(ADMIN_EMAIL, 'OTP Admin - Kho Phụ Tùng', `Mã OTP: ${otp}\nHết hạn sau 5 phút.`);
  return { ok: true };
}

function verifyAdminOtp(code) {
  const saved = CacheService.getScriptCache().get('admin_otp');
  if (saved && String(code).trim() === saved) {
    const token = Utilities.getUuid();
    CacheService.getScriptCache().put('admin_token_' + token, '1', 60 * 60); // 1 giờ
    return { ok: true, token };
  }
  return { ok: false };
}

function isAdmin_(token) {
  return token && CacheService.getScriptCache().get('admin_token_' + token) === '1';
}

/************ ADMIN: NHẬP/XUẤT ************/
function adjustStock(token, id, qty, type, note) {
  if (!isAdmin_(token)) throw new Error('Unauthorized');
  qty = Number(qty || 0);
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Số lượng không hợp lệ');

  const sh = sh_();
  const data = sh.getDataRange().getValues();
  const h = data[0].map(String);
  const c = colMap_(h);

  const idx = data.findIndex((r, i) => i > 0 && String(r[c.id]) === String(id));
  if (idx < 0) throw new Error('Không tìm thấy sản phẩm');

  const before = Number(data[idx][c.stock] || 0);
  const after = type === 'IN' ? before + qty : before - qty;
  if (after < 0) throw new Error('Không đủ tồn để xuất');

  // update stock
  sh.getRange(idx + 1, c.stock + 1).setValue(after);

  // update sold nếu OUT
  if (type === 'OUT') {
    const soldBefore = Number(data[idx][c.sold] || 0);
    sh.getRange(idx + 1, c.sold + 1).setValue(soldBefore + qty);
  }

  // updatedAt
  sh.getRange(idx + 1, c.updatedAt + 1).setValue(new Date());

  // log
  logSh_().appendRow([
    new Date(), type,
    data[idx][c.id], data[idx][c.oem], data[idx][c.name],
    qty, before, after, note || ''
  ]);

  return { ok: true, before, after };
}

/************ ADMIN: GIÁ ************/
function updatePrice(token, id, price) {
  if (!isAdmin_(token)) throw new Error('Unauthorized');
  price = Number(price || 0);
  if (!Number.isFinite(price) || price < 0) throw new Error('Giá không hợp lệ');

  const sh = sh_();
  const data = sh.getDataRange().getValues();
  const h = data[0].map(String);
  const c = colMap_(h);

  const idx = data.findIndex((r, i) => i > 0 && String(r[c.id]) === String(id));
  if (idx < 0) throw new Error('Không tìm thấy sản phẩm');

  sh.getRange(idx + 1, c.price + 1).setValue(price);
  sh.getRange(idx + 1, c.updatedAt + 1).setValue(new Date());
  return { ok: true };
}

/************ ADMIN: UP ẢNH ************/
function uploadImage(token, id, filename, base64) {
  if (!isAdmin_(token)) throw new Error('Unauthorized');

  const folderName = 'KhoPhuTung_Images';
  const it = DriveApp.getFoldersByName(folderName);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(folderName);

  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, MimeType.JPEG, filename || ('img_' + Date.now() + '.jpg'));
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const url = `https://drive.google.com/uc?export=view&id=${file.getId()}`;

  const sh = sh_();
  const data = sh.getDataRange().getValues();
  const h = data[0].map(String);
  const c = colMap_(h);

  const idx = data.findIndex((r, i) => i > 0 && String(r[c.id]) === String(id));
  if (idx < 0) throw new Error('Không tìm thấy sản phẩm');

  sh.getRange(idx + 1, c.imageUrl + 1).setValue(url);
  sh.getRange(idx + 1, c.updatedAt + 1).setValue(new Date());

  return { ok: true, url };
}

