import { sb, fmtMoney, esc, stockBadge, toast } from "./app.js";

const ADMIN_EMAIL = "haivothanh0603@gmail.com";

const $ = (id)=>document.getElementById(id);

$("loginPass").onclick = loginPass;
$("sendLink").onclick = sendLink;
$("logout").onclick = logout;

$("file").addEventListener("change", previewFile);

$("upsert").onclick = upsertProduct;
$("del").onclick = deleteProduct;

$("reload").onclick = loadProducts;
$("loadLogs").onclick = loadLogs;

await refreshMe();
await loadProducts();
await loadLogs();

async function refreshMe(){
  const { data:{ user } } = await sb.auth.getUser();
  $("me").textContent = user ? `Đã login: ${user.email}` : "Chưa login";
  return user;
}

function requireAdmin(user){
  if(!user) throw new Error("Bạn chưa đăng nhập admin.");
  if(user.email !== ADMIN_EMAIL) throw new Error("Sai email admin (không đúng policy).");
}

/* ===== LOGIN PASSWORD: có thông báo + nút sáng/loading ===== */
async function loginPass(){
  const btn = $("loginPass");
  const text = $("loginText");
  const msg = $("authMsg");

  msg.textContent = "";
  msg.style.color = "";

  const email = $("email").value.trim();
  const password = $("password").value;

  if(!email || !password){
    msg.textContent = "❌ Vui lòng nhập email và mật khẩu";
    msg.style.color = "red";
    toast("Thiếu email/mật khẩu", "err");
    return;
  }

  btn.classList.add("loading");
  text.textContent = "Đang đăng nhập...";

  const { error } = await sb.auth.signInWithPassword({ email, password });

  btn.classList.remove("loading");
  text.textContent = "Đăng nhập";

  if(error){
    msg.textContent = "❌ Sai email hoặc mật khẩu";
    msg.style.color = "red";
    console.error("LOGIN_ERROR:", error);
    toast("Sai email hoặc mật khẩu", "err");
    return;
  }

  msg.textContent = "✅ Đăng nhập thành công";
  msg.style.color = "green";
  toast("Đăng nhập thành công", "ok");

  await refreshMe();
  await loadProducts();
  await loadLogs();
}

/* ===== LOGIN EMAIL LINK ===== */
async function sendLink(){
  const msg = $("authMsg");
  msg.textContent = "";
  msg.style.color = "";

  const email = $("email").value.trim();
  if(!email){
    msg.textContent = "❌ Nhập email để gửi link";
    msg.style.color = "red";
    toast("Thiếu email", "err");
    return;
  }

  const redirectTo = location.origin + location.pathname; // quay lại admin.html
  const { error } = await sb.auth.signInWithOtp({ email, options:{ emailRedirectTo: redirectTo }});

  if(error){
    msg.textContent = "❌ Gửi link lỗi: " + error.message;
    msg.style.color = "red";
    toast("Gửi link lỗi", "err");
    console.error(error);
    return;
  }

  msg.textContent = "✅ Đã gửi link đăng nhập về email";
  msg.style.color = "green";
  toast("Đã gửi link về email", "ok");
}

async function logout(){
  await sb.auth.signOut();
  $("authMsg").textContent = "Đã đăng xuất";
  toast("Đã đăng xuất", "ok");
  await refreshMe();
  await loadProducts();
  await loadLogs();
}

/* ===== IMAGE PREVIEW ===== */
function previewFile(){
  const f = $("file").files?.[0];
  if(!f){
    $("preview").style.display="none";
    $("previewText").textContent="Chưa chọn ảnh";
    return;
  }
  $("preview").src = URL.createObjectURL(f);
  $("preview").style.display="block";
  $("previewText").textContent = `Đã chọn: ${f.name} (${Math.round(f.size/1024)} KB)`;
}

async function uploadImage(file, productId){
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${productId}/${Date.now()}.${ext}`;

  const { error } = await sb.storage.from("product-images").upload(path, file, { upsert:true });
  if(error) throw error;

  return sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

/* ===== UPSERT PRODUCT ===== */
async function upsertProduct(){
  const { data:{ user } } = await sb.auth.getUser();
  try{
    requireAdmin(user);

    const id = $("id").value.trim();
    const oem = $("oem").value.trim();
    const name = $("name").value.trim();
    const brand = $("brand").value.trim();
    const category = $("category").value.trim();
    const info = $("info").value.trim();
    const price = Number($("price").value || 0);
    const stock = Number($("stock").value || 0);

    if(!id || !oem || !name) throw new Error("Thiếu ID/OEM/Tên");

    let image_url = null;
    const file = $("file").files?.[0];
    if(file) image_url = await uploadImage(file, id);

    const payload = { id, oem, name, brand, category, info, price, stock, updated_at: new Date().toISOString() };
    if(image_url) payload.image_url = image_url;

    const { error } = await sb.from("products").upsert(payload, { onConflict:"id" });
    if(error) throw error;

    $("msg").textContent = "✅ Đã lưu (thêm/sửa)";
    toast("Đã lưu sản phẩm", "ok");

    $("file").value = "";
    $("preview").style.display="none";
    $("previewText").textContent="Chưa chọn ảnh";

    await loadProducts();
  }catch(e){
    toast(e.message || "Lỗi lưu", "err");
    alert(e.message || e);
  }
}

async function deleteProduct(){
  const { data:{ user } } = await sb.auth.getUser();
  try{
    requireAdmin(user);
    const id = $("id").value.trim();
    if(!id) throw new Error("Nhập ID để xóa");
    if(!confirm("Xóa sản phẩm " + id + " ?")) return;

    const { error } = await sb.from("products").delete().eq("id", id);
    if(error) throw error;

    $("msg").textContent = "✅ Đã xóa";
    toast("Đã xóa sản phẩm", "ok");
    await loadProducts();
    await loadLogs();
  }catch(e){
    toast(e.message || "Lỗi xóa", "err");
    alert(e.message || e);
  }
}

/* ===== ADJUST STOCK (RPC atomic) ===== */
async function adjustStock(id, type){
  const { data:{ user } } = await sb.auth.getUser();
  try{
    requireAdmin(user);

    const qty = Number(prompt(type==="IN" ? "Nhập số lượng nhập:" : "Nhập số lượng xuất:") || 0);
    if(!qty || qty<=0) return;

    const note = prompt("Ghi chú (tùy chọn):") || "";

    const { data, error } = await sb.rpc("adjust_stock", {
      p_id: id,
      p_type: type,
      p_qty: qty,
      p_note: note
    });
    if(error) throw error;

    toast(`OK. Trước ${data?.[0]?.before_stock} → Sau ${data?.[0]?.after_stock}`, "ok");
    await loadProducts();
    await loadLogs();
  }catch(e){
    toast(e.message || "Lỗi nhập/xuất", "err");
    alert(e.message || e);
  }
}

/* ===== LOAD PRODUCTS + ADMIN ACTIONS ===== */
async function loadProducts(){
  const k = ($("q").value || "").trim();
  let q = sb.from("products").select("*").order("name");
  if(k) q = q.or(`id.ilike.%${k}%,oem.ilike.%${k}%,name.ilike.%${k}%,brand.ilike.%${k}%,info.ilike.%${k}%`);

  const { data, error } = await q;
  if(error) return toast(error.message, "err");

  const { data:{ user } } = await sb.auth.getUser();
  const isAdmin = !!user && user.email === ADMIN_EMAIL;

  $("grid").innerHTML = (data||[]).map(p=>`
    <div class="card">
      ${p.image_url ? `<img src="${p.image_url}">` : `<div class="img">Chưa có hình</div>`}
      <div class="body">
        <div class="name">${esc(p.name)}</div>
        <div class="kv">
          <b>ID</b><div>${esc(p.id)}</div>
          <b>OEM</b><div>${esc(p.oem)}</div>
          <b>Thương hiệu</b><div>${esc(p.brand||"")}</div>
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
              <button class="btn" onclick="window._fill('${esc(p.id)}')">Sửa</button>
              <button class="btn" onclick="window._in('${esc(p.id)}')">Nhập</button>
              <button class="btn" onclick="window._out('${esc(p.id)}')">Xuất</button>
            </div>`
          : `<div class="muted" style="margin-top:10px">🔒 Đăng nhập admin để thao tác</div>`
        }
      </div>
    </div>
  `).join("") || `<div class="muted">Chưa có dữ liệu.</div>`;

  window._in = (id)=>adjustStock(id,"IN");
  window._out = (id)=>adjustStock(id,"OUT");
  window._fill = async (id)=>{
    const { data, error } = await sb.from("products").select("*").eq("id", id).single();
    if(error) return toast(error.message, "err");

    $("id").value = data.id;
    $("oem").value = data.oem;
    $("name").value = data.name;
    $("brand").value = data.brand || "";
    $("category").value = data.category || "";
    $("info").value = data.info || "";
    $("price").value = data.price || 0;
    $("stock").value = data.stock || 0;

    $("msg").textContent = "Đã nạp dữ liệu lên form để sửa.";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
}

/* ===== LOAD LOGS ===== */
async function loadLogs(){
  const { data:{ user } } = await sb.auth.getUser();
  const isAdmin = !!user && user.email === ADMIN_EMAIL;

  if(!isAdmin){
    $("logTable").innerHTML = `<tr><td class="muted">🔒 Đăng nhập admin để xem lịch sử.</td></tr>`;
    $("logCount").textContent = "";
    return;
  }

  const type = $("logType").value || "";
  const kw = ($("logQ").value || "").trim().toLowerCase();

  let q = sb.from("stock_logs")
    .select("time,type,product_id,qty,before_stock,after_stock,note,products(oem,name)")
    .order("time",{ascending:false})
    .limit(200);

  if(type) q = q.eq("type", type);

  const { data, error } = await q;
  if(error) return toast(error.message, "err");

  const rows = (data||[]).filter(r=>{
    if(!kw) return true;
    const hay = `${r.product_id} ${r.products?.oem||""} ${r.products?.name||""}`.toLowerCase();
    return hay.includes(kw);
  });

  $("logCount").textContent = `${rows.length} dòng`;

  $("logTable").innerHTML = `
    <tr>
      <th>Thời gian</th><th>Loại</th><th>ID</th><th>OEM</th><th>Tên</th><th>SL</th><th>Trước</th><th>Sau</th><th>Ghi chú</th>
    </tr>
    ${rows.map(r=>`
      <tr>
        <td>${new Date(r.time).toLocaleString("vi-VN")}</td>
        <td><b>${r.type}</b></td>
        <td>${esc(r.product_id)}</td>
        <td>${esc(r.products?.oem||"")}</td>
        <td>${esc(r.products?.name||"")}</td>
        <td>${r.qty}</td>
        <td>${r.before_stock}</td>
        <td>${r.after_stock}</td>
        <td>${esc(r.note||"")}</td>
      </tr>
    `).join("")}
  `;
}
