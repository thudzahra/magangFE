import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Card, Label, TextInput } from "flowbite-react";

// Halaman tujuan setelah login, sesuai role dari API
const ROLE_HOME = {
  mahasiswa: "/form-pengajuan",
  admin: "/dashboard-admin",
};

// Warna: #E6E6E6 background | putih card | #404E3B teks & tombol | #7B9669 border | #BAC8B1 hover
const inputTheme = {
  field: {
    input: {
      colors: {
        gray: "border-[#7B9669] bg-[#E6E6E6] text-[#404E3B] placeholder-[#7a8575] focus:border-[#404E3B] focus:ring-[#7B9669]",
        failure: "border-[#b42318] bg-[#E6E6E6] text-[#404E3B] placeholder-[#7a8575] focus:border-[#b42318] focus:ring-[#b42318]",
      },
    },
  },
};

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Ikon mata untuk lihat / sembunyikan password
function EyeIcon({ off }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: location.state?.email || "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState(
    location.state?.justRegistered ? { type: "ok", text: "Akun berhasil dibuat. Silakan login." } : null
  );

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    const er = {};
    if (!email) er.email = "Email wajib diisi.";
    else if (!isEmail(email)) er.email = "Format email tidak valid.";
    if (!form.password) er.password = "Password wajib diisi.";
    setErrors(er);
    if (Object.keys(er).length) return;

    setLoading(true);
    setMsg(null);
    try {
      const response = await fetch("http://192.168.137.1:8000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password: form.password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMsg({ type: "no", text: data.message || "Email atau password salah." });
        return;
      }

      // simpan token & data user, lalu pindah ke dashboard sesuai role
      localStorage.setItem("token", data.token || data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate(ROLE_HOME[data.user?.role] || "/form-pengajuan", { replace: true });
    } catch {
      setMsg({ type: "no", text: "Tidak dapat terhubung ke server." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#E6E6E6] p-5">
      <Card className="w-full max-w-md border-[#BAC8B1] bg-white shadow-xl">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-1 text-[#404E3B]">
          <h1 className="text-2xl font-bold">Masuk</h1>
          <p className="mb-4 text-sm text-[#404E3B]">Masuk dengan email dan password kamu.</p>

          <div className="mb-4 flex rounded-lg border border-[#7B9669] p-1">
            <Link to="/login" className="flex-1 rounded-md bg-[#404E3B] py-2 text-center text-sm font-semibold text-[#E6E6E6]">Login</Link>
            <Link to="/signup" className="flex-1 rounded-md py-2 text-center text-sm font-semibold text-[#404E3B] transition hover:bg-[#BAC8B1]">Sign Up</Link>
          </div>

          <Label htmlFor="email" className="mb-1 text-[#404E3B]">Email</Label>
          <TextInput
            id="email"
            theme={inputTheme}
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update("email")}
            placeholder="nama@email.com"
            color={errors.email ? "failure" : "white"}
          />
          <p className="mb-2 min-h-5 text-xs font-medium text-[#b42318]">{errors.email}</p>

          <Label htmlFor="password" className="mb-1 text-[#404E3B]">Password</Label>
          <div className="relative">
            <TextInput
              id="password"
              theme={inputTheme}
              type={showPw ? "text" : "password"}
              value={form.password}
              onChange={update("password")}
              placeholder="Password"
              autoComplete="current-password"
              color={errors.password ? "failure" : "white"}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Sembunyikan password" : "Lihat password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#404E3B] hover:text-[#7B9669]"
            >
              <EyeIcon off={showPw} />
            </button>
          </div>
          <p className="mb-3 min-h-5 text-xs font-medium text-[#b42318]">{errors.password}</p>

          <Button
            type="submit"
            disabled={loading}
            className="w-full border-0 bg-[#404E3B] font-bold text-[#E6E6E6] hover:bg-[#BAC8B1] hover:text-[#404E3B]"
          >
            {loading ? "Memproses..." : "Masuk"}
          </Button>

          {msg && (
            <Alert
              className={`mt-3 border ${
                msg.type === "ok"
                  ? "border-[#404E3B] bg-[#E6E6E6] text-[#404E3B]"
                  : "border-[#b42318] bg-[#ffd9d3] text-[#7a1f12]"
              }`}
            >
              {msg.text}
            </Alert>
          )}

          <p className="mt-4 text-center text-sm text-[#404E3B]">
            Belum punya akun?{" "}
            <Link to="/signup" className="font-bold text-[#404E3B] underline hover:text-[#7B9669]">
              Daftar sekarang
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}