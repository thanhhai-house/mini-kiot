import { sb } from "./app.js";

const ADMIN_EMAIL = "haivothanh0603@gmail.com"; // đổi cho đúng email admin

const $ = (id) => document.getElementById(id);

// BẮT LỖI TOÀN CỤC: nếu có lỗi JS/Import sẽ hiện alert
window.addEventListener("error", (e) => {
  alert("❌ JS lỗi: " + (e.message || e.error));
  console.error("GLOBAL_ERROR", e);
});

window.addEventListener("unhandledrejection", (e) => {
  alert("❌ Promise lỗi: " + (e.reason?.message || e.reason));
  console.error("UNHANDLED", e);
});

document.addEventListener("DOMContentLoaded", () => {
  // xác nhận JS đã chạy
  const dbg = $("debug");
  dbg.textContent = "✅ JS đã chạy: admin.page.js loaded";
  console.log("✅ admin.page.js loaded");

  // gắn sự kiện nút (triệt để)
  $("loginPass").addEventListener("click", loginPass);
  $("sendLink").addEventListener("click", sendLink);
  $("logout").addEventListener("click", logout);

  refreshMe();
});

async function refreshMe(){
  const { data: { user } } = await sb.auth.getUser();
  $("me").textContent = user ? `Đã login: ${user.email}` : "Chưa login";
}

function setAuthMsg(text, ok){
  const el = $("authMsg");
  el.textContent = text;
  el.style.color = ok ? "green" : "red";
}

function setLoading(isLoading){
  const btn = $("loginPass");
  const text = $("loginText");
  if(isLoading){
    btn.classList.add("loading");
    text.textContent = "Đang đăng nhập...";
  }else{
    btn.classList.remove("loading");
    text.textContent = "Đăng nhập";
  }
}

async function loginPass(){
  try{
    const email = $("email").value.trim();
    const password = $("password").value;

    if(!email || !password){
      setAuthMsg("❌ Vui lòng nhập email và mật khẩu", false);
      return;
    }

    setLoading(true);
    setAuthMsg("", true);

    const { error } = await sb.auth.signInWithPassword({ email, password });

    setLoading(false);

    if(error){
      setAuthMsg("❌ Sai email hoặc mật khẩu (" + error.message + ")", false);
      console.error("LOGIN_ERROR", error);
      return;
    }

    // check admin email (đúng phân quyền)
    const { data: { user } } = await sb.auth.getUser();
    if(user?.email !== ADMIN_EMAIL){
      setAuthMsg("⚠️ Login được nhưng không đúng email admin policy!", false);
    }else{
      setAuthMsg("✅ Đăng nhập thành công", true);
    }

    await refreshMe();
  }catch(e){
    setLoading(false);
    setAuthMsg("❌ Lỗi: " + (e.message || e), false);
    console.error(e);
  }
}

async function sendLink(){
  const email = $("email").value.trim();
  if(!email){
    setAuthMsg("❌ Nhập email để gửi link", false);
    return;
  }
  const redirectTo = location.origin + location.pathname; // quay lại admin.html
  const { error } = await sb.auth.signInWithOtp({ email, options:{ emailRedirectTo: redirectTo }});
  if(error){
    setAuthMsg("❌ Gửi link lỗi: " + error.message, false);
    console.error(error);
    return;
  }
  setAuthMsg("✅ Đã gửi link đăng nhập về email", true);
}

async function logout(){
  await sb.auth.signOut();
  setAuthMsg("Đã đăng xuất", true);
  await refreshMe();
}
