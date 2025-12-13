import { sb, fmtMoney, esc } from "./app.js";

const ADMIN_EMAIL = "haivothanh0603@gmail.com"; // phải khớp policy SQL

const me = document.getElementById("me");
const msg = document.getElementById("msg");

const fileInput = document.getElementById("file");
const previewImg = document.getElementById("preview");
const previewText = document.getElementById("previewText");

document.getElementById("login").onclick = login;
document.getElementById("logout").onclick = logout;
document.getElementById("add").onclick = addProduct;
document.getElementById("reload").onclick = load;

fileInput.addEventListener("change", onPickFile);

await refreshMe();
await load();

function stockBadge(stock){
  const s = Number(stock||0);
  if (s <= 0) return `<span class="badge danger">Hết hàng</span>`;
  if (s <= 3) return `<span class="badge warn">Sắp hết</span>`;
  return `<span class="badge ok">Còn hàng</span>`;
}

async function refreshMe(){
  const { data: { user } } = await sb.auth.getUser();
  me.textContent = user ? `Đã login: ${user.email}` : "Chưa login";
  return user;
}

function requireAdmin(user){
  if(!user) throw new Error("Bạn chưa đăng nhập admin.");
  if(user.email !== ADMIN_EMAIL) throw new Error("Sai email admin (không đúng policy).");
}

async function login(){
  msg.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return alert("Login thất bại: " + error.message);

  await refreshMe();
  await load();
}

async function logout(){
  await sb.auth.signOut();
  await refreshMe();
  await load();
}

async function onPickFile(){
  const file = fileInput.files?.[0];
  if(!file){
    previewImg.style.display="none";
    previewText.textContent="Chưa chọn ảnh";
    return;
  }
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewImg.style.display = "block";
  previewText.textContent = `Đã chọn: ${file.name} (${Math.round(file.size/1024)} KB)`;
}

async function uploadImage(file, productId){
  // upload ảnh lên Storage, trả về public URL
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${productId}/${Date.now()}.${ext}`; // luôn file mới -> không cần UPDATE policy
  const { error } = await sb.storage.from("product-images").upload(path, file, { upsert: false });
  if (error) throw error;

  const { data } = sb.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

async function addProduct(){
  msg.textContent = "";
  const { data: { user } } = await sb.auth.getUser();
  try{
    requireAdmin(user);

    const id = document.getElementById("id").value.trim();
    const oem = document.getElementById("oem").value.trim();
    const name = document.getElementById("name").value.trim();
    const brand = document.getElementById("brand").value.trim();
    const category = document.getElementById("category").value.trim();
    const price = Number(document.getElementById("price").value || 0);
    const stock = Number(document.getElementById("stock").value || 0);
    const info = document.getElementById("info").value.trim();
    const file = fileInput.files?.[0];

    if(!id || !oem || !name) throw new Error("Thiếu ID / OEM / Tên");

    let image_url = "";
    if(file){
      // Preview đã có; upload thật khi bấm Thêm
      image_url = await uploadImage(file, id);
    }

    // Insert product
    const { error } = await sb.from("products").insert([{
      id, oem, name, category, brand, info,
      price, stock,
      image_url,
      updated_at: new Date().toISOString()
    }]);

    if (error) throw error;

    msg.textContent = "✅ Đã thêm sản phẩm thành công!";
    // reset form nhanh
    fileInput.value = "";
    previewImg.style.display="none";
    previewText.textContent="Chưa chọn ảnh";

    await load();
  }catch(e){
    alert(e.message || e);
  }
}

async function adjustStock(id, type){
  const { data: { user } } = await sb.auth.getUser();
  try{
    requireAdmin(user);

    const qty = Number(prompt(type==="IN" ? "Nhập số lượng nhập" : "Nhập số lượng xuất") || 0);
    if(!qty || qty<=0) return;

    const note = prompt("Ghi chú (tuỳ chọn)") || "";

    const { data: p, error: e1 } = await sb.from("products").select("*").eq("id", id).single();
    if(e1) throw e1;

    const before = Number(p.stock||0);
    const after = type==="IN" ? before + qty : before - qty;
    if(after < 0) throw new Error("Không đủ tồn để xuất");

    const { error: e2 } = await sb.from("products")
      .update({ stock: after, updated_at: new Date().toISOString() })
      .eq("id", id);
    if(e2) throw e2;

    const { error: e3 } = await sb.from("stock_logs")
      .insert([{ type, product_id: id, qty, before_stock: before, after_stock: after, note }]);
    if(e3) throw e3;

    await load();
  }catch(e){
    alert(e.message || e);
  }
}

async function changePrice(id, cur){
  const { data: { user } } = await sb.auth.getUser();
  try{
    requireAdmin(user);

    const price = Number(prompt("Giá mới", String(cur)) ?? NaN);
    if(!Number.isFinite(price) || price<0) return;

    const { error } = await sb.from("products")
      .update({ price, updated_at: new Date().toISOString() })
      .eq("id", id);
    if(error) throw error;

    await load();
  }catch(e){
    alert(e.message || e);
  }
}

async function changeImage(id){
  const { data: { user } } = await sb.auth.getUser();
  try{
    requireAdmin(user);

    // chọn file + preview confirm
    const inp = document.createElement("input");
    inp.type="file"; inp.accept="image/*";
    inp.onchange = async ()=>{
      const file = inp.files?.[0];
      if(!file) return;

      const local = URL.createObjectURL(file);
      const ok = confirm("Xác nhận cập nhật hình ảnh mới cho sản phẩm " + id + " ?");
      if(!ok) return;

      // upload
      const url = await uploadImage(file, id);

      // update product image_url
      const { error } = await sb.from("products")
        .update({ image_url: url, updated_at: new Date().toISOString() })
        .eq("id", id);
      if(error) throw error;

      await load();
    };
    inp.click();
  }catch(e){
    alert(e.message || e);
  }
}

async function load(){
  const { data: { user } } = await sb.auth.getUser();
  const isAdmin = !!user && user.email === ADMIN_EMAIL;

  const k = (document.getElementById("q").value || "").trim();
  let q = sb.from("products").select("*").order("name");
  if (k) q = q.or(`id.ilike.%${k}%,oem.ilike.%${k}%,name.ilike.%${k}%,brand.ilike.%${k}%,info.ilike.%${k}%`);

  const { data, error } = await q;
  if(error) return alert(error.message);

  const grid = document.getElementById("grid");
  grid.innerHTML = (data||[]).map(p=>`
    <div class="card">
      ${p.image_url ? `<img src="${p.image_url}">` : `<div class="img">Chưa có hình</div>`}
      <div class="body">
        <div class="name">${esc(p.name)}</div>

        <div class="kv">
          <b>ID</b><div>${esc(p.id)}</div>
          <b>OEM</b><div>${esc(p.oem)}</div>
          <b>Thương hiệu</b><div>${esc(p.brand || "")}</div>
          <b>Giá</b><div><b>${fmtMoney(p.price)}</b></div>
          <b>Số lượng</b><div><b>${Number(p.stock||0)}</b></div>
        </div>

        <div class="badges">
          ${stockBadge(p.stock)}
          ${p.category ? `<span class="badge">${esc(p.category)}</span>` : ""}
        </div>

        ${p.info ? `<div class="muted" style="margin-top:8px">${esc(p.info)}</div>` : ""}

        ${
          isAdmin
          ? `<div class="actions">
              <button class="btn" onclick="window._in('${p.id}')">Nhập hàng</button>
              <button class="btn" onclick="window._out('${p.id}')">Xuất hàng</button>
              <button class="btn" onclick="window._price('${p.id}', ${Number(p.price||0)})">Chỉnh giá</button>
              <button class="btn" onclick="window._img('${p.id}')">Đổi hình</button>
            </div>`
          : `<div class="muted" style="margin-top:10px">🔒 Bạn cần đăng nhập admin để thao tác</div>`
        }
      </div>
    </div>
  `).join("") || `<div class="muted">Chưa có dữ liệu.</div>`;

window._in = (id)=>adjustStock(id,"IN");
window._out = (id)=>adjustStock(id,"OUT");
  window._price = (id,cur)=>changePrice(id,cur);
  window._img = (id)=>changeImage(id);
  async function adjustStock(productId, type) {
  const { data: { user } } = await sb.auth.getUser();
  requireAdmin(user);

  const qty = Number(prompt(type === "IN" ? "Nhập số lượng nhập:" : "Nhập số lượng xuất:") || 0);
  if (!qty || qty <= 0) return;

  const note = prompt("Ghi chú (tuỳ chọn):") || "";

  // 1) lấy tồn hiện tại
  const { data: p, error: e1 } = await sb.from("products").select("id,stock,oem,name").eq("id", productId).single();
  if (e1) throw e1;

  const before = Number(p.stock || 0);
  const after = type === "IN" ? before + qty : before - qty;
  if (after < 0) return alert("Không đủ tồn để xuất");

  // 2) update tồn
  const { error: e2 } = await sb.from("products")
    .update({ stock: after, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (e2) throw e2;

  // 3) ghi lịch sử vào stock_logs
  const { error: e3 } = await sb.from("stock_logs").insert([{
    type,
    product_id: productId,
    qty,
    before_stock: before,
    after_stock: after,
    note
  }]);
  if (e3) throw e3;

  alert("✅ Đã cập nhật tồn & lưu lịch sử");
  await load();          // reload sản phẩm
  await loadLogs();      // reload lịch sử
}


}
