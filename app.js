const isAdminPage = location.search.includes('page=admin');
let ADMIN_TOKEN = localStorage.getItem('admin_token') || '';

function call(fn, ...args){
  return new Promise((res, rej)=>{
    google.script.run.withSuccessHandler(res).withFailureHandler(rej)[fn](...args);
  });
}

async function init(){
  const opt = await call('getFilterOptions');
  fillSelect('category', opt.categories);
  fillSelect('brand', opt.brands);

  document.getElementById('apply')?.addEventListener('click', loadProducts);

  if(isAdminPage){
    document.getElementById('sendOtp').onclick = async ()=>{
      await call('requestAdminOtp');
      showMsg('Đã gửi OTP về email admin.');
    };
    document.getElementById('login').onclick = async ()=>{
      const code = document.getElementById('otp').value.trim();
      const r = await call('verifyAdminOtp', code);
      if(!r.ok) return showMsg('OTP sai hoặc hết hạn.');
      ADMIN_TOKEN = r.token;
      localStorage.setItem('admin_token', ADMIN_TOKEN);
      showMsg('Đăng nhập admin thành công.');
      loadProducts();
    };
  }

  loadProducts();
}

function fillSelect(id, items){
  const el = document.getElementById(id);
  if(!el) return;
  const first = el.querySelector('option');
  el.innerHTML = '';
  el.appendChild(first);
  items.forEach(x=>{
    const o = document.createElement('option');
    o.value = x; o.textContent = x;
    el.appendChild(o);
  });
}

function getFilters(){
  return {
    q: (document.getElementById('q')?.value || '').trim(),
    category: document.getElementById('category')?.value || '',
    brand: document.getElementById('brand')?.value || ''
  };
}

async function loadProducts(){
  const data = await call('getProducts', getFilters());
  render(data);
}

function render(data){
  const grid = document.getElementById('grid');
  if(!grid) return;

  if(!data.length){
    grid.innerHTML = `<div class="muted">Không có dữ liệu.</div>`;
    return;
  }

  grid.innerHTML = data.map(p=>{
    const img = p.imageUrl ? `<img src="${p.imageUrl}">` : `<img style="display:none">`;

    const info = `
      <div class="small">
        <div><b>ID:</b> ${esc(p.id)}</div>
        <div><b>OEM:</b> ${esc(p.oem)}</div>
        <div><b>Tên:</b> ${esc(p.name)}</div>
        <div><b>Thương hiệu:</b> ${esc(p.brand)}</div>
        <div><b>Giá:</b> <b>${fmt(p.price)}</b></div>
        <div><b>Số lượng còn:</b> <b>${Number(p.stock||0)}</b></div>
        <div class="muted" style="margin-top:6px">${esc(p.info||'')}</div>
      </div>
    `;

    const adminActions = isAdminPage ? `
      <div class="actions">
        <button class="btn" onclick="stockIn('${p.id}')">Nhập hàng</button>
        <button class="btn" onclick="stockOut('${p.id}')">Xuất hàng</button>
        <button class="btn" onclick="changePrice('${p.id}', ${Number(p.price||0)})">Điều chỉnh giá</button>
        <label class="btn">
          Up hình
          <input type="file" accept="image/*" style="display:none" onchange="uploadImg('${p.id}', this.files[0])">
        </label>
      </div>
    ` : '';

    return `<div class="card">${img}${info}${adminActions}</div>`;
  }).join('');
}

async function stockIn(id){
  if(!ADMIN_TOKEN) return alert('Hãy đăng nhập admin trước');
  const qty = prompt('Nhập số lượng nhập:');
  if(!qty) return;
  const note = prompt('Ghi chú (tuỳ chọn):') || '';
  await call('adjustStock', ADMIN_TOKEN, id, Number(qty), 'IN', note);
  loadProducts();
}

async function stockOut(id){
  if(!ADMIN_TOKEN) return alert('Hãy đăng nhập admin trước');
  const qty = prompt('Nhập số lượng xuất:');
  if(!qty) return;
  const note = prompt('Ghi chú (tuỳ chọn):') || '';
  try{
    await call('adjustStock', ADMIN_TOKEN, id, Number(qty), 'OUT', note);
    loadProducts();
  }catch(e){
    alert(e.message || e);
  }
}

async function changePrice(id, current){
  if(!ADMIN_TOKEN) return alert('Hãy đăng nhập admin trước');
  const price = prompt('Nhập giá mới:', String(current));
  if(price === null) return;
  await call('updatePrice', ADMIN_TOKEN, id, Number(price));
  loadProducts();
}

async function uploadImg(id, file){
  if(!ADMIN_TOKEN) return alert('Hãy đăng nhập admin trước');
  if(!file) return;

  const base64 = await fileToBase64(file);
  const pure = base64.split(',')[1];
  const r = await call('uploadImage', ADMIN_TOKEN, id, file.name, pure);
  if(r.ok) loadProducts();
}

function fileToBase64(file){
  return new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = ()=>res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

function fmt(n){ return Number(n||0).toLocaleString('vi-VN') + ' đ'; }
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function showMsg(t){
  const el = document.getElementById('msg');
  if(el) el.textContent = t;
}

init();

