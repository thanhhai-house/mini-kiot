import { sb, fmtMoney, esc, stockBadge, toast } from "./app.js";

const elQ = document.getElementById("q");
const elCategory = document.getElementById("category");
const elBrand = document.getElementById("brand");
const elCount = document.getElementById("count");

document.getElementById("apply").onclick = load;

await loadOptions();
await load();

async function loadOptions(){
  const { data, error } = await sb.from("products").select("category,brand");
  if (error) return toast(error.message, "err");

  const cats = [...new Set((data||[]).map(x=>x.category).filter(Boolean))].sort();
  const brs  = [...new Set((data||[]).map(x=>x.brand).filter(Boolean))].sort();
  cats.forEach(x => elCategory.add(new Option(x,x)));
  brs.forEach(x => elBrand.add(new Option(x,x)));
}

async function load(){
  const k = (elQ.value || "").trim();
  let q = sb.from("products").select("*").order("name");
  if (elCategory.value) q = q.eq("category", elCategory.value);
  if (elBrand.value) q = q.eq("brand", elBrand.value);
  if (k) q = q.or(`id.ilike.%${k}%,oem.ilike.%${k}%,name.ilike.%${k}%,brand.ilike.%${k}%,info.ilike.%${k}%`);

  const { data, error } = await q;
  if (error) return toast(error.message, "err");

  elCount.textContent = `${(data||[]).length} sản phẩm`;

  const grid = document.getElementById("grid");
  grid.innerHTML = (data||[]).map(p => `
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
      </div>
    </div>
  `).join("") || `<div class="muted">Chưa có dữ liệu.</div>`;
}
