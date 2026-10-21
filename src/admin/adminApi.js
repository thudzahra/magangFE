// src/admin/adminApi.js
import axios from "axios";

// Alamat backend. Taruh di file .env supaya tidak perlu edit kode tiap ganti IP:
//   VITE_API_URL=http://localhost:8000/api
// (restart `npm run dev` setelah mengubah .env)
const API_BASE_URL = import.meta.env.VITE_API_URL;

// GANTI kalau auth.js menyimpan token dengan key lain
const getToken = () => localStorage.getItem("token");

// Semua request lewat sini. AdminPage menampilkan `e.message` langsung ke
// layar, jadi error axios diubah dulu jadi Error dengan pesan yang terbaca
// (pesan dari backend kalau ada).
const request = async (config) => {
  try {
    const res = await axios({
      baseURL: API_BASE_URL,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: "application/json",
      },
      ...config,
    });
    return res.data;
  } catch (e) {
    const data = e.response?.data;
    const pesanValidasi = data?.errors
      ? Object.values(data.errors).flat().join("\n")
      : null;
    throw new Error(data?.message || pesanValidasi || e.message);
  }
};

// Buka pembungkus respons: { data: {...} } -> {...}
const unwrap = (body) => body?.data ?? body;

// AdminPage melakukan list.map(...), jadi hasilnya HARUS array.
// Mendukung respons array langsung, { data: [...] }, atau paginasi { data: { data: [...] } }
const toArray = (body) => {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.data)) return body.data.data;
  return [];
};

// Daftar pengajuan -> array
export const getPengajuan = async () => {
  const body = await request({ method: "get", url: "/pengajuan" });
  return toArray(body);
};

// Verifikasi & terbitkan surat -> HARUS mengembalikan objek pengajuan yang
// sudah diperbarui (status "terverifikasi", nomor_surat, dll). AdminPage
// memakai objek ini untuk mengganti baris di tabel dan mengisi modal.

export const verifikasiPengajuan = async (id) => {
  const body = await request({
    method: "post",
    url: `/admin/pengajuan/${id}/status`,
    data: {
      status: "setuju",
    },
  });

  return unwrap(body);
};

export const tolakPengajuan = async (id, alasan = "") => {
  const body = await request({
    method: "post",
    url: `/admin/pengajuan/${id}/status`,
    data: {
      status: "revisi",
      catatan: alasan,
    },
  });

  return unwrap(body);
};
