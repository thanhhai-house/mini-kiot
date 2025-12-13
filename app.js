import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const SUPABASE_URL = "https://pqwacdfroasxrsycluyn.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxd2FjZGZyb2FzeHJzeWNsdXluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MjY3MjIsImV4cCI6MjA4MTIwMjcyMn0.qoUGB_WCKm5M9t0svOxLpzpv9uscfC1qxRydgXUr6bM";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const ADMIN_EMAIL = "haivothanh0603@gmail.com";

export const fmtMoney = (n) => Number(n || 0).toLocaleString("vi-VN") + " đ";
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

export function stockBadge(stock){
  const s = Number(stock||0);
  if (s <= 0) return `<span class="badge danger">Hết hàng</span>`;
  if (s <= 3) return `<span class="badge warn">Sắp hết</span>`;
  return `<span class="badge ok">Còn hàng</span>`;
}

export function toast(msg, type="info"){
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add("show"));
  setTimeout(()=>{ el.classList.remove("show"); setTimeout(()=>el.remove(), 250); }, 2200);
}
