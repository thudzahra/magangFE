// BE Laravel: POST /login, POST /logout, POST /register, GET /me

const BASE = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

// Request helper agar pesan error server lebih mudah dibaca
async function request(endpoint, options = {}) {
  let res;

  try {
    res = await fetch(`${BASE}${endpoint}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new TypeError(
      `Tidak dapat terhubung ke server: ${BASE}. Periksa IP backend dan koneksi jaringan.`
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || `Request gagal (${res.status})`);
    err.status = res.status;
    err.fieldErrors = Object.fromEntries(
      Object.entries(data.errors ?? {}).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ])
    );
    throw err;
  }

  return data;
}

const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("user");
};

export async function login(email, password) {
  const data = await request("/login", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password }),
  });

  const token = data.token ?? data.access_token ?? data.data?.token;

  if (!token) {
    throw new Error("Token tidak ditemukan di respons login");
  }

  localStorage.setItem("token", token);

  let user = data.user ?? data.data?.user;
  let role = user?.role ?? data.role;

  // Kalau respons login tidak lengkap, ambil dari /me
  if (!role || !user) {
    try {
      const me = await request("/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      user = user ?? me.user ?? me.data ?? me;
      role = role ?? user?.role ?? me.role;
    } catch (err) {
      clearSession();
      throw err;
    }
  }

  localStorage.setItem("role", role ?? "");
  localStorage.setItem("user", JSON.stringify(user ?? {}));

  return { role, user };
}

export const getToken = () => localStorage.getItem("token");
export const getRole = () => localStorage.getItem("role");

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || {};
  } catch {
    return {};
  }
};

export async function logout() {
  try {
    await request("/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
  } catch {
    // Tetap hapus data lokal meskipun server tidak dapat dihubungi
  }

  clearSession();
  window.location.href = "/login";
}

export async function register({
  name,
  nim,
  email,
  password,
  password_confirmation,
}) {
  return request("/register", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      name,
      nim,
      email,
      password,
      password_confirmation,
    }),
  });
}