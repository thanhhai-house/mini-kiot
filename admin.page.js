import { sb, fmtMoney, esc, stockBadge } from "./app.js";

const ADMIN_EMAIL = "haivothanh0603@gmail.com";

const me = document.getElementById("me");
const addMsg = document.getElementById("addMsg");

document.getElementById("sendLink").onclick = sendMagicLink;
document.getElementById("logout").onclick = async ()=>{ await sb.auth.signOut(); await refreshMe(); await load(); };
document.getElementById("add").onclick = addProduct;
document.getElementById("reload").onclick = load;

await refreshMe();
await load();

async function refreshMe(){
  const { data: { user } } = await sb.auth.getUser();
  me.textContent = user ? `Đã login: ${user.email}` : "Chưa login";
  return user;
}

async function sendMagicLink(){
  const email = document.getElementById("email").value.trim();
  if (email !== ADMIN_EMAIL) return alert("Email admin phải là: " + ADMIN_EMAIL);

  const redirectTo = location.origin + location.pathname; // quay lại admin.html
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  if (error) return alert(error.message);
  alert("Đã gửi link đăng nhập về email. Mở mail và bấm link là vào admin.");
}

function requireAdmin(user){
  if(!user) throw new Error("Bạn chưa đăng nhập admin.");
  if(user.email !== ADMIN_EMAIL) throw new Error("Không đúng email admin.");
}

async function uploadImage(file, id){
  if(!file) return "";
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${id}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from("product-images").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = sb.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

async function addProduct(){
  addMsg.textContent = "";
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
    const file = document.getElementById("file").files[0];

    if(!id || !oem || !name) return alert("Thiếu ID / OEM / Tên");

    let image_url = "";
    if(file) image_url = await uploadImage(file, id);

    const { error } = await sb.from("products").insert([{
      id, oem, name, brand, category, info, price, stock, image_url
    }]);
    if (error) return alert(error.message);

    addMsg.textContent = "Đã thêm sản phẩm!";
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

    const before = p.stock;
    const after = type==="IN" ? before + qty : before - qty;
    if(after < 0) return alert("Không đủ tồn để xuất");

    const { error: e2 } = await sb.from("products")
      .update({ stock: after, updated_at: new Date().toISOString() })
      .eq("id", id);
    if(e2) throw e2;

    await sb.from("stock_logs").insert([{ type, product_id: id, qty, before_stock: before, after_stock: after, note }]);

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

    const inp = document.createElement("input");
    inp.type="file"; inp.accept="image/*";
    inp.onchange = async ()=>{
      const file = inp.files[0];
      if(!file) return;
      const url = await uploadImage(file, id);

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
  await refreshMe();

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
          <b>Giá bán</b><div><b>${fmtMoney(p.price)}</b></div>
          <b>Số lượng</b><div><b>${Number(p.stock||0)}</b></div>
        </div>

        <div class="badges">
          ${stockBadge(p.stock)}
          ${p.category ? `<span class="badge">${esc(p.category)}</span>` : ""}
        </div>

        ${p.info ? `<div class="muted" style="margin-top:8px">${esc(p.info)}</div>` : ""}

        <div class="actions">
          <button class="btn" onclick="window._in('${p.id}')">Nhập</button>
          <button class="btn" onclick="window._out('${p.id}')">Xuất</button>
          <button class="btn" onclick="window._price('${p.id}', ${Number(p.price||0)})">Giá</button>
          <button class="btn" onclick="window._img('${p.id}')">Up hình</button>
        </div>
      </div>
    </div>
  `).join("") || `<div class="muted">Chưa có dữ liệu.</div>`;

  window._in = (id)=>adjustStock(id,"IN");
  window._out = (id)=>adjustStock(id,"OUT");
  window._price = (id,cur)=>changePrice(id,cur);
  window._img = (id)=>changeImage(id);
}
