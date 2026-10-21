// BE Laravel: POST /login, POST /logout, POST /register, GET /me
const BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";
const JSON_HEADERS = { "Content-Type": "application/json", Accept: "application/json" };

export async function login(email, password) {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Email atau password salah");

  const token = data.token ?? data.access_token ?? data.data?.token;
  if (!token) throw new Error("Token tidak ditemukan di respons login");
  localStorage.setItem("token", token);

  let role = data.user?.role ?? data.data?.user?.role ?? data.role;
  if (!role) {
    const me = await fetch(`${BASE}/me`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    const m = await me.json().catch(() => ({}));
    role = m.role ?? m.user?.role ?? m.data?.role;
  }
  localStorage.setItem("role", role ?? "");
  return { role };
}

export const getToken = () => localStorage.getItem("token");
export const getRole = () => localStorage.getItem("role");

export async function logout() {
  try {
    await fetch(`${BASE}/logout`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${getToken()}` },
    });
  } catch { /* tetap lanjut hapus token lokal */ }
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  window.location.href = "/login";
}

export async function register({ name, nim, email, password, password_confirmation }) {
  const res = await fetch(`${BASE}/register`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name, nim, email, password, password_confirmation }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Pendaftaran gagal");
    err.fieldErrors = Object.fromEntries(
      Object.entries(data.errors ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
    );
    throw err;
  }
  return data;
}