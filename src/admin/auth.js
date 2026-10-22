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

  let role = data.user?.role ?? data.data?.user?.role ?? data.role;

  if (!role) {
    try {
      const me = await request("/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      role = me.role ?? me.user?.role ?? me.data?.role;
    } catch (err) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      throw err;
    }
  }

  localStorage.setItem("role", role ?? "");

  return { role };
}

export const getToken = () => localStorage.getItem("token");
export const getRole = () => localStorage.getItem("role");

export async function logout() {
  try {
    await request("/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
  } catch {
    // Tetap hapus token lokal meskipun server tidak dapat dihubungi
  }

  localStorage.removeItem("token");
  localStorage.removeItem("role");
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