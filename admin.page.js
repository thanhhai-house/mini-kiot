import { sb } from "./app.js";

const ADMIN_EMAIL = "haivothanh0603@gmail.com"; // đổi nếu bạn dùng email khác
const $ = (id) => document.getElementById(id);

function setMsg(text, ok=false){
  const el = $("authMsg");
  el.textContent = text;
  el.style.color = ok ? "green" : "red";
}

function setLoading(on){
  const btn = $("loginPass");
  const t = $("loginText");
  if(on){
    btn.classList.add("loading");
    t.textContent = "Đang đăng nhập...";
  }else{
    btn.classList.remove("loading");
    t.textContent = "Đăng nhập";
  }
}

window.addEventListener("error", (e) => {
  setMsg("❌ JS lỗi: " + (e.message || e.error), false);
  console.error("GLOBAL_ERROR", e);
});

window.addEventListener("unhandledrejection", (e) => {
  setMsg("❌ Promise lỗi: " + (e.reason?.message || e.reason), false);
  console.error("UNHANDLED", e);
});

document.addEventListener("DOMContentLoaded", async () => {
  // gắn nút chắc chắn
  $("loginPass").addEventListener("click", loginPass);
  $("sendLink").addEventListener("click", sendLink);
  $("logout").addEventListener("click", logout);

  // check load
  console.log("✅ admin.page.js loaded");
  setMsg("Sẵn sàng. Nhấn Đăng nhập để test.", true);

  await refreshMe();
});

async function refreshMe(){
  const { data: { user } } = await sb.auth.getUser();
  $("me").textContent = user ? `Đã login: ${user.email}` : "Chưa login";
}

async function loginPass(){
  try{
    setMsg("", true);

    const email = $("email").value.trim();
    const password = $("password").value;

    if(!email || !password){
      setMsg("❌ Thiếu email hoặc mật khẩu", false);
      return;
    }

    setLoading(true);

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    setLoading(false);

    if(error){
      // lỗi thật supabase
      setMsg("❌ Login lỗi: " + error.message, false);
      console.error("LOGIN_ERROR", error);
      return;
    }

    // lấy user sau login
    const { data: u } = await sb.auth.getUser();
    const user = u?.user;

    if(!user){
      setMsg("⚠️ Login có vẻ thành công nhưng chưa có session. Kiểm tra Site URL/Redirect URL.", false);
      return;
    }

    if(user.email !== ADMIN_EMAIL){
      setMsg("⚠️ Login OK nhưng email không phải admin policy: " + user.email, false);
    }else{
      setMsg("✅ Đăng nhập admin thành công: " + user.email, true);
    }

    await refreshMe();

  }catch(e){
    setLoading(false);
    setMsg("❌ Exception: " + (e.message || e), false);
    console.error(e);
  }
}

async function sendLink(){
  const email = $("email").value.trim();
  if(!email){
    setMsg("❌ Nhập email để gửi link", false);
    return;
  }

  const redirectTo = location.origin + location.pathname; // admin.html
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo }
  });

  if(error){
    setMsg("❌ Gửi link lỗi: " + error.message, false);
    console.error(error);
    return;
  }

  setMsg("✅ Đã gửi link đăng nhập về email. Mở mail và bấm link.", true);
}

async function logout(){
  await sb.auth.signOut();
  setMsg("✅ Đã đăng xuất", true);
  await refreshMe();
}
