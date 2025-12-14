const API_BASE = "http://localhost:3000";
const out = document.getElementById("out");

function show(x) {
  out.textContent = typeof x === "string" ? x : JSON.stringify(x, null, 2);
}

window.handleCredentialResponse = async (response) => {
  try {
    // response.credential chính là id_token
    const r = await fetch(`${API_BASE}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: response.credential })
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data.error);

    localStorage.setItem("token", data.token);
    show(data);
  } catch (e) {
    show({ error: e.message });
  }
};

async function authedFetch(path) {
  const token = localStorage.getItem("token");
  const r = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

window.callMe = async () => show(await authedFetch("/me"));
window.callAdmin = async () => show(await authedFetch("/admin/dashboard"));
