import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, Label, TextInput } from "flowbite-react";

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

// Huruf pertama tiap kata otomatis kapital (contoh: "budi santoso" -> "Budi Santoso")
const capitalizeWords = (str) => str.replace(/(^|\s)(\S)/g, (_, space, ch) => space + ch.toUpperCase());

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nama: "", email: "", nim: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);

  const update = (field) => (e) => {
    let value = e.target.value;
    if (field === "nama") value = capitalizeWords(value);
    if (field === "nim") value = value.toUpperCase();
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((er) => ({ ...er, [field]: "" }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nama = form.nama.trim();
    const email = form.email.trim().toLowerCase();
    const nim = form.nim.trim().toUpperCase();
    const er = {};

    if (!nama) er.nama = "Nama wajib diisi.";
    if (!email) er.email = "Email wajib diisi.";
    else if (!isEmail(email)) er.email = "Format email tidak valid.";
    if (!nim) er.nim = "NIM wajib diisi.";
    else if (!/^[A-Z0-9]{5,20}$/.test(nim)) er.nim = "NIM hanya huruf dan angka (5–20 karakter).";
    if (!form.password) er.password = "Password wajib diisi.";
    else if (form.password.length < 8) er.password = "Password minimal 8 karakter.";

    setErrors(er);
    if (Object.keys(er).length) return;

    // TODO: ganti bagian demo ini dengan fetch ke endpoint register (kirim nama + email + nim + password)
    let users = {};
    try { users = JSON.parse(localStorage.getItem("demo_users") || "{}"); } catch { /* abaikan */ }
    if (users[email]) {
      setErrors({ email: "Email ini sudah terdaftar." });
      return;
    }
    users[email] = { nama, nim, password: form.password };
    try { localStorage.setItem("demo_users", JSON.stringify(users)); } catch { /* abaikan */ }

    navigate("/login", { state: { email, justRegistered: true } });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#E6E6E6] p-5">
      <Card className="w-full max-w-md border-[#BAC8B1] bg-white shadow-xl">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-1 text-[#404E3B]">
          <h1 className="text-2xl font-bold">Buat Akun</h1>
          <p className="mb-4 text-sm text-[#404E3B]">Isi nama, email, NIM, dan password untuk mendaftar.</p>

          <div className="mb-4 flex rounded-lg border border-[#7B9669] p-1">
            <Link to="/login" className="flex-1 rounded-md py-2 text-center text-sm font-semibold text-[#404E3B] transition hover:bg-[#BAC8B1]">Login</Link>
            <Link to="/signup" className="flex-1 rounded-md bg-[#404E3B] py-2 text-center text-sm font-semibold text-[#E6E6E6]">Sign Up</Link>
          </div>

          <Label htmlFor="nama" className="mb-1 text-[#404E3B]">Nama</Label>
          <TextInput
            id="nama"
            theme={inputTheme}
            autoComplete="name"
            autoCapitalize="words"
            value={form.nama}
            onChange={update("nama")}
            placeholder="Nama lengkap"
            color={errors.nama ? "failure" : "gray"}
          />
          <p className="mb-2 min-h-5 text-xs font-medium text-[#b42318]">{errors.nama}</p>

          <Label htmlFor="email" className="mb-1 text-[#404E3B]">Email</Label>
          <TextInput
            id="email"
            theme={inputTheme}
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update("email")}
            placeholder="nama@email.com"
            color={errors.email ? "failure" : "gray"}
          />
          <p className="mb-2 min-h-5 text-xs font-medium text-[#b42318]">{errors.email}</p>

          <Label htmlFor="nim" className="mb-1 text-[#404E3B]">NIM</Label>
          <TextInput
            id="nim"
            theme={inputTheme}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            value={form.nim}
            onChange={update("nim")}
            placeholder="Contoh: E4411234"
            color={errors.nim ? "failure" : "gray"}
          />
          <p className="mb-2 min-h-5 text-xs font-medium text-[#b42318]">{errors.nim}</p>

          <Label htmlFor="password" className="mb-1 text-[#404E3B]">Password</Label>
          <div className="relative">
            <TextInput
              id="password"
              theme={inputTheme}
              type={showPw ? "text" : "password"}
              value={form.password}
              onChange={update("password")}
              placeholder="Minimal 8 karakter"
              autoComplete="new-password"
              color={errors.password ? "failure" : "gray"}
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
            className="w-full border-0 bg-[#404E3B] font-bold text-[#E6E6E6] hover:bg-[#BAC8B1] hover:text-[#404E3B]"
          >
            Daftar
          </Button>

          <p className="mt-4 text-center text-sm text-[#404E3B]">
            Sudah punya akun?{" "}
            <Link to="/login" className="font-bold text-[#404E3B] underline hover:text-[#7B9669]">
              Masuk di sini
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}