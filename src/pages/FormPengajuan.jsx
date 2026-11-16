import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  FileInput,
  Label,
  Textarea,
  TextInput,
} from "flowbite-react";

const API = "http://172.18.160.138:8000/api";
const ENDPOINT = {
  buat: "/pengajuan-magang", // POST = buat pengajuan, GET = daftar pengajuan milik mahasiswa
  ubah: (id) => `/pengajuan-magang/${id}`, // PUT = ubah, GET = detail
  preview: (id) => `/pengajuan-magang/${id}/preview-surat`,
  tandaTangan: (id) => `/pengajuan-magang/${id}/tanda-tangan`,
  kirim: (id) => `/pengajuan-magang/${id}/kirim`,
};

const DEPARTEMEN_PREFIX = {
  E141: "Manajemen Hutan",
  E241: "Hasil Hutan",
  E341: "Konservasi Sumberdaya Hutan dan Ekowisata",
  E441: "Silvikultur",
};

const departemenDariNim = (nim) =>
  DEPARTEMEN_PREFIX[(nim || "").toUpperCase().slice(0, 4)] || "";

const NAMA_DEPARTEMEN = {
  MNH: "Manajemen Hutan",
  THH: "Teknologi Hasil Hutan",
  KSHE: "Konservasi Sumber Daya Hutan dan Ekowisata",
  SVK: "Silvikultur",
};

// Departemen bisa berupa kode ("SVK"), nama, atau objek { kode, nama }
const namaDep = (dep) => {
  if (!dep) return "";
  if (typeof dep === "object")
    return dep.nama ?? NAMA_DEPARTEMEN[dep.kode] ?? dep.kode ?? "";
  return NAMA_DEPARTEMEN[dep] ?? String(dep);
};

const STEPS = ["Data diri", "Tempat magang", "Tanda tangan", "Berkas & kirim"];

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const EKSTENSI_BOLEH = ["pdf", "jpg", "jpeg", "png"];

const colors = {
  gray: "border-[#7B9669] bg-[#E6E6E6] text-[#404E3B] placeholder-[#7a8575] focus:border-[#404E3B] focus:ring-[#7B9669]",
  failure:
    "border-[#b42318] bg-[#E6E6E6] text-[#404E3B] placeholder-[#7a8575] focus:border-[#b42318] focus:ring-[#b42318]",
};
const inputTheme = { field: { input: { colors } } };
const textareaTheme = { colors };

const capitalizeWords = (str) =>
  str.replace(/(^|\s)(\S)/g, (_, space, ch) => space + ch.toUpperCase());

// ====== Format nama instansi & alamat ======
// Singkatan yang harus kapital semua (tulis huruf kecil)
const SEMUA_KAPITAL = ["pt", "cv", "ud", "pd", "rt", "rw"];
// Singkatan dengan format khusus
const KHUSUS = { jl: "Jl", gg: "Gg", no: "No" };

// Kapitalkan awal tiap kata. Kata dipisah oleh spasi atau titik,
// jadi huruf setelah titik otomatis kapital.
const formatSingkatan = (teks) =>
  teks.replace(/[^\s.]+/g, (kata) => {
    const kecil = kata.toLowerCase();
    if (SEMUA_KAPITAL.includes(kecil)) return kecil.toUpperCase();
    if (KHUSUS[kecil]) return KHUSUS[kecil];
    return kata.charAt(0).toUpperCase() + kata.slice(1);
  });

// Nama instansi: PT / CV / UD / PD ditulis tanpa titik
// "pt.thudzahra" -> "PT Thudzahra", "PT. Maju" -> "PT Maju"
const formatInstansi = (teks) => {
  const tanpaTitik = teks.replace(
    /(^|\s)(pt|cv|ud|pd)\.\s*/gi,
    (_, awal, singkatan) => `${awal}${singkatan.toUpperCase()} `,
  );
  return formatSingkatan(tanpaTitik);
};

// Beri spasi setelah titik yang diikuti huruf: "Jl.Kapten" -> "Jl. Kapten"
const rapikanTitik = (teks) => teks.replace(/\.(?=[A-Za-z])/g, ". ").trim();

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || {};
  } catch {
    return {};
  }
};

const authHeaders = () => ({
  Accept: "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const pesanError = (data, fallback) => {
  if (data?.errors) {
    return Object.values(data.errors).flat().join(" ");
  }
  return data?.message || fallback;
};

const pesanDariError = (err) =>
  err instanceof TypeError ? "Tidak dapat terhubung ke server." : err.message;

const panggilApi = async (path, { json, formData, method = "POST" } = {}) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: json
      ? { ...authHeaders(), "Content-Type": "application/json" }
      : authHeaders(),
    body: json ? JSON.stringify(json) : formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(pesanError(data, "Permintaan gagal."));
  return data;
};

const ambilPreview = async (id) => {
  const response = await fetch(`${API}${ENDPOINT.preview(id)}`, {
    headers: authHeaders(),
  });
  const type = response.headers.get("content-type") || "";

  if (!response.ok) {
    const data = type.includes("application/json")
      ? await response.json().catch(() => ({}))
      : {};
    throw new Error(pesanError(data, "Preview surat gagal dimuat."));
  }

  if (type.includes("application/json")) {
    const data = await response.json();
    const html = data.html ?? data.data?.html;
    if (html) return { srcDoc: html };
    const url = data.url ?? data.data?.url;
    if (url) return { src: url };
    throw new Error("Format respons preview surat tidak dikenali.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  return { src: objectUrl, objectUrl };
};

const validasiBerkas = (file, namaBerkas) => {
  if (!file) return `${namaBerkas} wajib diunggah.`;
  if (file.size > MAX_FILE_SIZE) return "Ukuran file maksimal 2 MB.";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!EKSTENSI_BOLEH.includes(ext))
    return "Format file harus PDF, JPG, atau PNG.";
  return "";
};

const bentukTempat = (t) => ({
  instansi: t.instansi.trim(),
  alamat_instansi: t.alamat_instansi.trim(),
  tanggal_mulai: t.tanggal_mulai,
  tanggal_selesai: t.tanggal_selesai,
});

// Data yang dikirim ke server untuk membuat / memperbarui pengajuan
const bentukData = (f) => ({
  nama: f.nama.trim(),
  nim: f.nim.trim(),
  departemen: f.departemen,

  // Tempat magang pertama
  instansi: f.instansi.trim(),
  alamat_instansi: f.alamat_instansi.trim(),
  tanggal_mulai: f.tanggal_mulai,
  tanggal_selesai: f.tanggal_selesai,

  // Tempat magang kedua: kirim sebagai field terpisah ke Laravel
  instansi_kedua: f.tempat2?.instansi?.trim() || null,
  alamat_instansi_kedua: f.tempat2?.alamat_instansi?.trim() || null,
  tanggal_mulai_kedua: f.tempat2?.tanggal_mulai || null,
  tanggal_selesai_kedua: f.tempat2?.tanggal_selesai || null,

  // Tetap kirim array untuk kompatibilitas fitur surat
  tempat_magang: [
    bentukTempat(f),
    ...(f.tempat2 ? [bentukTempat(f.tempat2)] : []),
  ],

  // Anggota kelompok
  anggota: f.kelompok
    ? f.anggota.map((a) => ({
        nama: a.nama.trim(),
        nim: a.nim.trim(),
      }))
    : [],
});

// =====================================================
// DATA RIWAYAT
// =====================================================

const unwrap = (response) => response?.data ?? response;

const toArray = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

const formatTanggal = (value) => {
  if (!value) return "-";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const normalisasiStatus = (status) => {
  const value = String(
    typeof status === "object" ? (status?.value ?? "") : (status ?? ""),
  ).toLowerCase();
  const alias = {
    setuju: "setuju",
    disetujui: "setuju",
    terverifikasi: "setuju",
    revisi: "revisi",
    ditolak: "revisi",
    draft: "draft",
    menunggu: "menunggu_verifikasi",
    menunggu_verifikasi: "menunggu_verifikasi",
  };
  return alias[value] ?? (value || "menunggu_verifikasi");
};

const STATUS = {
  menunggu_verifikasi: {
    label: "Menunggu verifikasi",
    className: "bg-[#BAC8B1] text-[#404E3B]",
  },
  setuju: { label: "Disetujui", className: "bg-[#404E3B] text-[#E6E6E6]" },
  revisi: { label: "Perlu revisi", className: "bg-red-100 text-red-800" },
};

const LABEL_BERKAS = {
  "surat-pengajuan": "Surat pengajuan magang",
  "bukti-spp": "Bukti pembayaran SPP",
  "surat-rekomendasi": "Surat rekomendasi",
  "surat-magang": "Surat pengantar magang (resmi)",
};

const FIELD_LAMA = {
  "surat-pengajuan": "surat_pengajuan_url",
  "bukti-spp": "bukti_spp_url",
  "surat-rekomendasi": "surat_rekomendasi_url",
  "surat-magang": "surat_magang_url",
};

const ekstensiDari = (url = "") => {
  const cocok = String(url)
    .split("?")[0]
    .match(/\.([a-z0-9]+)$/i);
  return cocok ? cocok[1].toLowerCase() : "";
};

const ambilBerkas = (item) => {
  const dariApi = Array.isArray(item.berkas) ? item.berkas : [];

  return Object.keys(LABEL_BERKAS)
    .map((jenis) => {
      const b = dariApi.find((x) => x.jenis === jenis);

      if (b?.preview_url) {
        return {
          jenis,
          label: LABEL_BERKAS[jenis],
          ekstensi: (b.ekstensi || ekstensiDari(b.preview_url)).toLowerCase(),
          preview_url: b.preview_url,
          download_url: b.download_url ?? null,
        };
      }

      const lama = item[FIELD_LAMA[jenis]];

      if (typeof lama === "string" && /^https?:/i.test(lama)) {
        return {
          jenis,
          label: LABEL_BERKAS[jenis],
          ekstensi: ekstensiDari(lama),
          preview_url: lama,
          download_url: null,
        };
      }

      return null;
    })
    .filter(Boolean);
};

// Anggota dari server: array of { nama, nim } (nama field bisa bervariasi)
const normalisasiAnggota = (anggota) =>
  Array.isArray(anggota)
    ? anggota.map((a) => ({
        nama: a?.nama ?? a?.name ?? "",
        nim: String(a?.nim ?? "").toUpperCase(),
      }))
    : [];

// Tempat magang ke-2 dari server (jika ada)
const ambilTempat2 = (item = {}) => {
  const t = Array.isArray(item.tempat_magang) ? item.tempat_magang[1] : null;
  if (!t) return null;
  return {
    instansi: t.instansi ?? t.nama ?? "",
    alamat_instansi: t.alamat_instansi ?? t.alamat ?? "",
    tanggal_mulai: String(t.tanggal_mulai || "").slice(0, 10),
    tanggal_selesai: String(t.tanggal_selesai || "").slice(0, 10),
  };
};

const normalisasiRiwayat = (item = {}) => {
  const user = getUser();
  const mhs = item.mahasiswa ?? {};
  const nim = mhs.nim ?? item.nim ?? user.nim ?? "-";

  return {
    ...item,
    status: normalisasiStatus(item.status),
    nama: mhs.nama ?? mhs.name ?? item.nama ?? user.name ?? "-",
    nim,
    departemen:
      namaDep(mhs.departemen ?? item.departemen ?? user.departemen) ||
      departemenDariNim(nim) ||
      "-",
    anggota: normalisasiAnggota(item.anggota),
    alamat: item.alamat_instansi ?? item.alamat ?? "-",
    nomorSurat: item.nomor_surat ?? item.no_registrasi ?? null,
    dikirim: item.dikirim_at ?? item.created_at ?? null,
    daftarBerkas: ambilBerkas(item),
  };
};

// =====================================================
// KOMPONEN KECIL
// =====================================================

function Field({ id, label, error, optional, children }) {
  return (
    <div className="flex flex-col">
      <Label htmlFor={id} className="mb-1 font-semibold text-[#404E3B]">
        {label} {!optional && <span className="text-[#b42318]">*</span>}
      </Label>
      {children}
      <p className="mt-1 min-h-5 text-xs font-medium text-[#b42318]">{error}</p>
    </div>
  );
}

function Stepper({ step }) {
  return (
    <ol className="mb-8 flex items-center">
      {STEPS.map((label, i) => (
        <li
          key={label}
          className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
              i <= step
                ? "border-[#404E3B] bg-[#404E3B] text-[#E6E6E6]"
                : "border-[#BAC8B1] text-[#7B9669]"
            }`}
          >
            {i < step ? "✓" : i + 1}
          </span>
          <span
            className={`ml-2 text-sm font-semibold ${
              i === step
                ? "inline text-[#404E3B]"
                : "hidden text-[#7B9669] sm:inline"
            }`}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <span
              className={`mx-3 h-px flex-1 ${i < step ? "bg-[#404E3B]" : "bg-[#BAC8B1]"}`}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

function StatusBadge({ status }) {
  const config = STATUS[status] ?? {
    label: status,
    className: "bg-gray-200 text-gray-700",
  };

  return (
    <span
      className={`inline-block w-fit rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function BerkasBaris({ berkas, terbuka, onToggle }) {
  const gambar = ["jpg", "jpeg", "png", "gif", "webp"].includes(
    berkas.ekstensi,
  );

  return (
    <div className="overflow-hidden rounded-lg border border-[#BAC8B1] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
        <strong>{berkas.label}</strong>

        <span className="flex flex-wrap gap-4">
          <button type="button" onClick={onToggle} className="underline">
            {terbuka ? "Sembunyikan preview" : "Lihat preview"}
          </button>

          <a
            href={berkas.preview_url}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Buka berkas
          </a>

          {berkas.download_url && (
            <a
              href={berkas.download_url}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Download
            </a>
          )}
        </span>
      </div>

      {terbuka &&
        (gambar ? (
          <img
            src={berkas.preview_url}
            alt={berkas.label}
            className="max-h-[520px] w-full border-t border-[#BAC8B1] bg-white object-contain"
          />
        ) : (
          <iframe
            src={`${berkas.preview_url}#toolbar=0&navpanes=0&view=FitH`}
            title={berkas.label}
            className="h-[640px] w-full border-t border-[#BAC8B1]"
          />
        ))}
    </div>
  );
}

// Tampilan riwayat: isi formulir yang sama, hanya dibaca (tidak bisa diubah)
function FormRiwayat({ item, memuatDetail }) {
  const [terbuka, setTerbuka] = useState({});

  const anggota = Array.isArray(item.anggota) ? item.anggota : [];

  const tempat2 = ambilTempat2(item);

  const berkasServer = item.daftarBerkas.filter(
    (b) => b.jenis !== "surat-magang" || item.status === "setuju",
  );

  // Berkas yang baru saja diunggah di perangkat ini (dipakai jika server belum mengirim tautan berkas)
  const berkasLokal = (Array.isArray(item.berkasLokal) ? item.berkasLokal : [])
    .filter((l) => !berkasServer.some((b) => b.jenis === l.jenis))
    .map((l) => ({
      jenis: l.jenis,
      label: l.label,
      ekstensi: l.ekstensi,
      preview_url: l.url,
      download_url: null,
    }));

  const berkas = [...berkasServer, ...berkasLokal];

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">Pengajuan #{item.id}</p>
          <p className="text-xs opacity-70">
            Dikirim {formatTanggal(item.dikirim)}
          </p>
        </div>

        <StatusBadge status={item.status} />
      </div>

      <Stepper step={STEPS.length} />

      {memuatDetail && (
        <p className="mb-3 text-sm opacity-70">Memuat detail pengajuan...</p>
      )}

      {item.status === "setuju" && item.nomorSurat && (
        <div className="mb-4">
          <Field id="r-nomor" label="Nomor surat" optional>
            <TextInput
              id="r-nomor"
              theme={inputTheme}
              value={item.nomorSurat}
              readOnly
              color="gray"
              className="cursor-default font-bold"
            />
          </Field>
        </div>
      )}

      {item.status === "revisi" && item.catatan_revisi && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <b>Catatan revisi dari admin:</b>
          <p className="mt-1 whitespace-pre-line">{item.catatan_revisi}</p>
        </div>
      )}

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field id="r-nama" label="Nama lengkap" optional>
          <TextInput
            id="r-nama"
            theme={inputTheme}
            value={item.nama}
            readOnly
            color="gray"
            className="cursor-default"
          />
        </Field>
        <Field id="r-nim" label="NIM" optional>
          <TextInput
            id="r-nim"
            theme={inputTheme}
            value={item.nim}
            readOnly
            color="gray"
            className="cursor-default"
          />
        </Field>
      </div>

      <Field id="r-dep" label="Departemen / program studi" optional>
        <TextInput
          id="r-dep"
          theme={inputTheme}
          value={item.departemen}
          readOnly
          color="gray"
          className="cursor-default"
        />
      </Field>

      {anggota.length > 0 && (
        <div className="mb-4">
          <span className="mb-2 block text-sm font-semibold">
            Anggota kelompok ({anggota.length + 1} orang)
          </span>
          <div className="space-y-2">
            {anggota.map((a, i) => (
              <div
                key={i}
                className="grid gap-x-4 rounded-lg border border-[#BAC8B1] p-3 sm:grid-cols-2"
              >
                <div>
                  <p className="text-xs opacity-70">Anggota {i + 2}</p>
                  <p className="text-sm font-semibold">{a.nama}</p>
                </div>
                <div>
                  <p className="text-xs opacity-70">NIM</p>
                  <p className="text-sm font-semibold">{a.nim}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Field id="r-instansi" label="Nama instansi / perusahaan" optional>
        <TextInput
          id="r-instansi"
          theme={inputTheme}
          value={item.instansi || "-"}
          readOnly
          color="gray"
          className="cursor-default"
        />
      </Field>

      <Field id="r-alamat" label="Alamat instansi" optional>
        <Textarea
          id="r-alamat"
          theme={textareaTheme}
          rows={3}
          value={item.alamat}
          readOnly
          color="gray"
          className="cursor-default"
        />
      </Field>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field id="r-mulai" label="Tanggal mulai" optional>
          <TextInput
            id="r-mulai"
            theme={inputTheme}
            value={formatTanggal(item.tanggal_mulai)}
            readOnly
            color="gray"
            className="cursor-default"
          />
        </Field>
        <Field id="r-selesai" label="Tanggal selesai" optional>
          <TextInput
            id="r-selesai"
            theme={inputTheme}
            value={formatTanggal(item.tanggal_selesai)}
            readOnly
            color="gray"
            className="cursor-default"
          />
        </Field>
      </div>

      {tempat2 && (
        <div className="mb-4 rounded-lg border border-[#BAC8B1] p-4">
          <p className="mb-2 text-sm font-semibold">Tempat magang 2</p>
          <Field id="r-instansi-2" label="Nama instansi / perusahaan" optional>
            <TextInput
              id="r-instansi-2"
              theme={inputTheme}
              value={tempat2.instansi || "-"}
              readOnly
              color="gray"
              className="cursor-default"
            />
          </Field>
          <Field id="r-alamat-2" label="Alamat instansi" optional>
            <Textarea
              id="r-alamat-2"
              theme={textareaTheme}
              rows={3}
              value={tempat2.alamat_instansi}
              readOnly
              color="gray"
              className="cursor-default"
            />
          </Field>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field id="r-mulai-2" label="Tanggal mulai" optional>
              <TextInput
                id="r-mulai-2"
                theme={inputTheme}
                value={formatTanggal(tempat2.tanggal_mulai)}
                readOnly
                color="gray"
                className="cursor-default"
              />
            </Field>
            <Field id="r-selesai-2" label="Tanggal selesai" optional>
              <TextInput
                id="r-selesai-2"
                theme={inputTheme}
                value={formatTanggal(tempat2.tanggal_selesai)}
                readOnly
                color="gray"
                className="cursor-default"
              />
            </Field>
          </div>
        </div>
      )}

      <div className="mb-2 mt-2 font-semibold">Surat dan berkas</div>

      {berkas.length > 0 ? (
        <div className="space-y-3">
          {berkas.map((b) => (
            <BerkasBaris
              key={b.jenis}
              berkas={b}
              terbuka={Boolean(terbuka[b.jenis])}
              onToggle={() =>
                setTerbuka((t) => ({ ...t, [b.jenis]: !t[b.jenis] }))
              }
            />
          ))}
        </div>
      ) : (
        <p className="text-sm opacity-70">
          Berkas belum tersedia untuk dilihat.
        </p>
      )}
    </div>
  );
}

// =====================================================
// HALAMAN FORMULIR + RIWAYAT
// =====================================================

export default function FormPengajuan() {
  const user = getUser();
  const pengajuanId = useRef(null);
  const snapshotDraft = useRef("");

  const dataAwal = {
    nama: user.name || "",
    nim: (user.nim || "").toUpperCase(),
    departemen: departemenDariNim(user.nim),
    kelompok: false,
    anggota: [],
    instansi: "",
    alamat_instansi: "",
    tanggal_mulai: "",
    tanggal_selesai: "",
    tempat2: null,
    bukti_spp: null,
    surat_rekomendasi: null,
  };

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(dataAwal);
  const [tempat2Terbuka, setTempat2Terbuka] = useState(true);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [disetujui, setDisetujui] = useState(false);
  const [menyetujui, setMenyetujui] = useState(false);
  const [versiPreview, setVersiPreview] = useState(0);
  const [preview, setPreview] = useState({
    src: "",
    srcDoc: "",
    loading: false,
    error: "",
  });

  // Riwayat pengajuan yang sudah dikirim
  const [riwayat, setRiwayat] = useState([]);
  const [memuatRiwayat, setMemuatRiwayat] = useState(true);
  const [buatBaru, setBuatBaru] = useState(false);
  const [sedangRevisi, setSedangRevisi] = useState(null); // { id, catatan } saat memperbaiki pengajuan
  const [versiForm, setVersiForm] = useState(0);
  const [pilihId, setPilihId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [memuatDetail, setMemuatDetail] = useState(false);

  const tampilRiwayat = riwayat.length > 0 && !buatBaru;

  // Pengajuan yang masih berjalan (menunggu / perlu revisi): tidak boleh membuat pengajuan baru
  const adaBerjalan = riwayat.some(
    (p) => p.status === "menunggu_verifikasi" || p.status === "revisi",
  );

  // Di langkah tanda tangan, tombol Lanjut berwarna abu-abu selama surat belum disetujui
  const belumSetuju = step === 2 && !disetujui;

  // Ambil daftar pengajuan yang sudah dikirim. `lokal` = cadangan jika server belum mengembalikannya.
  const muatRiwayat = async (lokal = null) => {
    let hasil = [];

    try {
      const response = await panggilApi(ENDPOINT.buat, { method: "GET" });

      hasil = toArray(response)
        .map(normalisasiRiwayat)
        .filter((p) => p.status !== "draft");
    } catch {
      // endpoint daftar belum ada / gagal: pakai data lokal jika ada
    }

    if (lokal) {
      if (hasil.some((p) => String(p.id) === String(lokal.id))) {
        // pengajuan sudah ada di server: tempelkan berkas yang baru diunggah agar bisa dilihat
        hasil = hasil.map((p) =>
          String(p.id) === String(lokal.id)
            ? {
                ...p,
                berkasLokal: lokal.berkasLokal,
                tempat_magang: p.tempat_magang ?? lokal.tempat_magang,
              }
            : p,
        );
      } else {
        hasil.unshift(normalisasiRiwayat(lokal));
      }
    }

    hasil.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

    setRiwayat(hasil);
    setPilihId(lokal?.id ?? hasil[0]?.id ?? null);
    setMemuatRiwayat(false);
  };

  useEffect(() => {
    muatRiwayat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detail pengajuan yang dipilih (untuk berkas, nomor surat, catatan revisi)
  useEffect(() => {
    if (!tampilRiwayat || pilihId == null) {
      setDetail(null);
      return undefined;
    }

    let batal = false;

    setMemuatDetail(true);

    panggilApi(ENDPOINT.ubah(pilihId), { method: "GET" })
      .then((response) => {
        if (batal) return;
        const isi = unwrap(response);
        setDetail(normalisasiRiwayat(isi?.pengajuan ?? isi));
      })
      .catch(() => {
        if (!batal) setDetail(null);
      })
      .finally(() => {
        if (!batal) setMemuatDetail(false);
      });

    return () => {
      batal = true;
    };
  }, [pilihId, tampilRiwayat]);

  useEffect(() => {
    if (step !== 2 || !pengajuanId.current) return;
    let batal = false;
    let objectUrl = "";

    setPreview({ src: "", srcDoc: "", loading: true, error: "" });
    ambilPreview(pengajuanId.current)
      .then((hasil) => {
        if (batal) {
          if (hasil.objectUrl) URL.revokeObjectURL(hasil.objectUrl);
          return;
        }
        objectUrl = hasil.objectUrl || "";
        setPreview({
          src: hasil.src || "",
          srcDoc: hasil.srcDoc || "",
          loading: false,
          error: "",
        });
      })
      .catch((err) => {
        if (!batal)
          setPreview({
            src: "",
            srcDoc: "",
            loading: false,
            error: pesanDariError(err),
          });
      });

    return () => {
      batal = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [step, versiPreview]);

  const update = (field) => (e) => {
    let value = e.target.files ? e.target.files[0] || null : e.target.value;
    if (field === "nama") value = capitalizeWords(value);
    if (field === "nim") value = value.toUpperCase();
    if (field === "instansi") value = formatInstansi(value);
    if (field === "alamat_instansi") value = formatSingkatan(value);
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((er) => ({ ...er, [field]: "" }));
  };

  // Dipanggil saat klik keluar dari field: rapikan spasi setelah titik
  const rapikan = (field) => () =>
    setForm((f) => ({ ...f, [field]: rapikanTitik(f[field]) }));

  // ---------- Pengajuan kelompok ----------
  const hapusErrorAnggota = () =>
    setErrors(({ anggota, anggota_umum, ...sisa }) => sisa);

  const ubahJenis = (kelompok) => {
    setForm((f) => ({
      ...f,
      kelompok,
      anggota:
        kelompok && f.anggota.length === 0
          ? [{ nama: "", nim: "" }]
          : f.anggota,
    }));
    hapusErrorAnggota();
  };

  const ubahAnggota = (index, field, value) => {
    const nilai = field === "nama" ? capitalizeWords(value) : value.toUpperCase();
    setForm((f) => ({
      ...f,
      anggota: f.anggota.map((a, i) =>
        i === index ? { ...a, [field]: nilai } : a,
      ),
    }));
    hapusErrorAnggota();
  };

  const tambahAnggota = () => {
    setForm((f) => ({ ...f, anggota: [...f.anggota, { nama: "", nim: "" }] }));
    hapusErrorAnggota();
  };

  const hapusAnggota = (index) => {
    setForm((f) => {
      const sisa = f.anggota.filter((_, i) => i !== index);
      // Jika semua anggota dihapus, kembali ke pengajuan individu
      return { ...f, anggota: sisa, kelompok: sisa.length > 0 };
    });
    hapusErrorAnggota();
  };

  // ---------- Tempat magang ke-2 ----------
  const tambahTempat2 = () => {
    setForm((f) => ({
      ...f,
      tempat2: {
        instansi: "",
        alamat_instansi: "",
        tanggal_mulai: "",
        tanggal_selesai: "",
      },
    }));
    setTempat2Terbuka(true);
  };

  const hapusTempat2 = () => {
    setForm((f) => ({ ...f, tempat2: null }));
    setErrors(({ tempat2, ...sisa }) => sisa);
  };

  const ubahTempat2 = (field, value) => {
    let nilai = value;
    if (field === "instansi") nilai = formatInstansi(value);
    if (field === "alamat_instansi") nilai = formatSingkatan(value);
    setForm((f) => ({ ...f, tempat2: { ...f.tempat2, [field]: nilai } }));
    setErrors((er) => ({ ...er, tempat2: { ...er.tempat2, [field]: "" } }));
  };

  const rapikanTempat2 = (field) => () =>
    setForm((f) =>
      f.tempat2
        ? {
            ...f,
            tempat2: { ...f.tempat2, [field]: rapikanTitik(f.tempat2[field]) },
          }
        : f,
    );

  const validate = (s) => {
    const er = {};
    if (s === 0) {
      if (!form.nama.trim()) er.nama = "Nama lengkap wajib diisi.";
      if (!form.nim.trim()) er.nim = "NIM wajib diisi.";
      else if (!/^[A-Z0-9]{11}$/.test(form.nim.trim()))
        er.nim = "NIM harus 11 karakter (huruf dan angka).";
      if (!form.departemen)
        er.departemen = "Departemen tidak dikenali dari NIM.";

      if (form.kelompok) {
        const errAnggota = {};
        const nimTerpakai = new Set([form.nim.trim().toUpperCase()]);

        form.anggota.forEach((a, i) => {
          const e = {};
          const nim = a.nim.trim().toUpperCase();

          if (!a.nama.trim()) e.nama = "Nama anggota wajib diisi.";

          if (!nim) e.nim = "NIM anggota wajib diisi.";
          else if (!/^[A-Z0-9]{11}$/.test(nim))
            e.nim = "NIM harus 11 karakter (huruf dan angka).";
          else if (nimTerpakai.has(nim))
            e.nim = "NIM ini sudah dipakai di pengajuan ini.";
          else nimTerpakai.add(nim);

          if (Object.keys(e).length) errAnggota[i] = e;
        });

        if (Object.keys(errAnggota).length) er.anggota = errAnggota;
      }
    }
    if (s === 1) {
      if (!form.instansi.trim()) er.instansi = "Nama instansi wajib diisi.";
      if (!form.alamat_instansi.trim())
        er.alamat_instansi = "Alamat instansi wajib diisi.";
      if (!form.tanggal_mulai) er.tanggal_mulai = "Tanggal mulai wajib diisi.";
      if (!form.tanggal_selesai)
        er.tanggal_selesai = "Tanggal selesai wajib diisi.";
      else if (form.tanggal_mulai && form.tanggal_selesai <= form.tanggal_mulai)
        er.tanggal_selesai =
          "Tanggal selesai tidak boleh sebelum tanggal mulai.";

      if (form.tempat2) {
        const t = form.tempat2;
        const e = {};
        if (!t.instansi.trim()) e.instansi = "Nama instansi wajib diisi.";
        if (!t.alamat_instansi.trim())
          e.alamat_instansi = "Alamat instansi wajib diisi.";
        if (!t.tanggal_mulai) e.tanggal_mulai = "Tanggal mulai wajib diisi.";
        if (!t.tanggal_selesai)
          e.tanggal_selesai = "Tanggal selesai wajib diisi.";
        else if (t.tanggal_mulai && t.tanggal_selesai <= t.tanggal_mulai)
          e.tanggal_selesai =
            "Tanggal selesai tidak boleh sebelum tanggal mulai.";
        if (Object.keys(e).length) er.tempat2 = e;
      }
    }
    if (s === 2) {
      if (!disetujui) er.ttd = "Tekan tombol Setujui terlebih dahulu.";
    }
    if (s === 3) {
      const errSpp = validasiBerkas(form.bukti_spp, "Bukti SPP");
      if (errSpp) er.bukti_spp = errSpp;

      const errRekom = validasiBerkas(
        form.surat_rekomendasi,
        "Surat rekomendasi",
      );
      if (errRekom) er.surat_rekomendasi = errRekom;
    }
    return er;
  };

  const siapkanPengajuan = async () => {
    const data = bentukData(form);
    const snapshot = JSON.stringify(data);
    if (pengajuanId.current && snapshotDraft.current === snapshot) return;

    if (pengajuanId.current) {
      await panggilApi(ENDPOINT.ubah(pengajuanId.current), {
        json: data,
        method: "PUT",
      });
      snapshotDraft.current = snapshot;
      setDisetujui(false);
      return;
    }

    const hasil = await panggilApi(ENDPOINT.buat, { json: data });
    const id = hasil?.data?.id ?? hasil?.id ?? hasil?.pengajuan?.id;
    if (!id)
      throw new Error("ID pengajuan tidak ditemukan pada respons server.");

    pengajuanId.current = id;
    snapshotDraft.current = snapshot;
    setDisetujui(false);
  };

  const next = async () => {
    const er = validate(step);
    setErrors(er);
    if (er.tempat2) setTempat2Terbuka(true);
    if (Object.keys(er).length) return;

    setMsg(null);
    if (step === 1) {
      setLoading(true);
      try {
        await siapkanPengajuan();
      } catch (err) {
        setMsg({ type: "no", text: pesanDariError(err) });
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    setStep((s) => s + 1);
  };

  const back = () => {
    setErrors({});
    setMsg(null);
    setStep((s) => s - 1);
  };

  const setujui = async () => {
    setMenyetujui(true);
    setErrors((er) => ({ ...er, ttd: "" }));
    try {
      await panggilApi(ENDPOINT.tandaTangan(pengajuanId.current));
      setDisetujui(true);
      setVersiPreview((v) => v + 1);
    } catch (err) {
      setErrors((er) => ({ ...er, ttd: pesanDariError(err) }));
    } finally {
      setMenyetujui(false);
    }
  };

  const batalSetujui = async () => {
    setMenyetujui(true);
    setErrors((er) => ({ ...er, ttd: "" }));
    try {
      await panggilApi(ENDPOINT.tandaTangan(pengajuanId.current), {
        method: "DELETE",
      });
      setDisetujui(false);
      setVersiPreview((v) => v + 1);
    } catch (err) {
      setErrors((er) => ({ ...er, ttd: pesanDariError(err) }));
    } finally {
      setMenyetujui(false);
    }
  };

  const handleSubmit = async () => {
    const er = validate(3);
    setErrors(er);
    if (Object.keys(er).length) return;

    if (!pengajuanId.current) {
      setMsg({
        type: "no",
        text: "Data pengajuan belum tersimpan. Kembali ke langkah sebelumnya.",
      });
      return;
    }

    const body = new FormData();
    body.append("bukti_spp", form.bukti_spp);
    body.append("surat_rekomendasi", form.surat_rekomendasi);

    setLoading(true);
    setMsg(null);
    try {
      await panggilApi(ENDPOINT.kirim(pengajuanId.current), { formData: body });

      // Pengajuan terkirim: isi formulir tetap tersimpan sebagai riwayat
      await muatRiwayat({
        id: pengajuanId.current,
        nama: form.nama,
        nim: form.nim,
        departemen: form.departemen,
        anggota: form.kelompok ? form.anggota : [],
        instansi: form.instansi,
        alamat_instansi: form.alamat_instansi,
        tanggal_mulai: form.tanggal_mulai,
        tanggal_selesai: form.tanggal_selesai,
        tempat_magang: bentukData(form).tempat_magang,
        status: "menunggu_verifikasi",
        dikirim_at: new Date().toISOString(),
        berkasLokal: [
          {
            jenis: "bukti-spp",
            label: LABEL_BERKAS["bukti-spp"],
            ekstensi: (
              form.bukti_spp.name.split(".").pop() || ""
            ).toLowerCase(),
            url: URL.createObjectURL(form.bukti_spp),
          },
          {
            jenis: "surat-rekomendasi",
            label: LABEL_BERKAS["surat-rekomendasi"],
            ekstensi: (
              form.surat_rekomendasi.name.split(".").pop() || ""
            ).toLowerCase(),
            url: URL.createObjectURL(form.surat_rekomendasi),
          },
        ],
      });

      setBuatBaru(false);
      setSedangRevisi(null);
    } catch (err) {
      setMsg({ type: "no", text: pesanDariError(err) });
    } finally {
      setLoading(false);
    }
  };

  // Mulai pengajuan baru: formulir dikosongkan, riwayat tetap ada
  const mulaiBaru = () => {
    pengajuanId.current = null;
    snapshotDraft.current = "";
    setForm(dataAwal);
    setStep(0);
    setErrors({});
    setMsg(null);
    setDisetujui(false);
    setPreview({ src: "", srcDoc: "", loading: false, error: "" });
    setVersiForm((v) => v + 1);
    setSedangRevisi(null);
    setBuatBaru(true);
  };

  // Perbaiki pengajuan yang diminta revisi: data lama dimuat kembali dan pengajuan yang SAMA diperbarui
  const perbaiki = (item) => {
    const anggotaLama = normalisasiAnggota(item.anggota);

    const terisi = {
      ...dataAwal,
      kelompok: anggotaLama.length > 0,
      anggota: anggotaLama,
      instansi: item.instansi || "",
      alamat_instansi: item.alamat && item.alamat !== "-" ? item.alamat : "",
      tanggal_mulai: String(item.tanggal_mulai || "").slice(0, 10),
      tanggal_selesai: String(item.tanggal_selesai || "").slice(0, 10),
      tempat2: ambilTempat2(item),
    };

    pengajuanId.current = item.id;
    snapshotDraft.current = JSON.stringify(bentukData(terisi));
    setForm(terisi);
    setStep(0);
    setErrors({});
    setMsg(null);
    setDisetujui(Boolean(item.sudah_ditandatangani));
    setPreview({ src: "", srcDoc: "", loading: false, error: "" });
    setVersiForm((v) => v + 1);
    setSedangRevisi({ id: item.id, catatan: item.catatan_revisi || "" });
    setBuatBaru(true);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const dariDaftar =
    riwayat.find((p) => String(p.id) === String(pilihId)) ?? null;
  const aktif =
    detail && String(detail.id) === String(pilihId)
      ? { ...dariDaftar, ...detail }
      : dariDaftar;

  return (
    <div className="min-h-screen bg-[#E6E6E6] text-[#404E3B]">
      <header className="border-b border-[#BAC8B1] bg-white">
        <div className="flex items-center justify-between gap-4 px-6 py-3 lg:px-40">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#404E3B] text-sm font-bold text-[#E6E6E6]">
              SM
            </span>
            <span className="text-lg font-bold">SIMAGANG</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg bg-[#404E3B] px-4 py-2 text-sm font-bold text-[#E6E6E6] transition hover:bg-[#BAC8B1] hover:text-[#404E3B]"
          >
            Log Out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-center text-3xl font-bold">
          {tampilRiwayat
            ? "Riwayat pengajuan"
            : sedangRevisi
              ? "Perbaiki pengajuan"
              : "Formulir pengajuan"}
        </h1>
        <p className="mb-8 mt-2 text-center text-[#404E3B]">
          {tampilRiwayat
            ? "Pengajuan yang sudah kamu kirim tersimpan di sini beserta statusnya."
            : "Pastikan semua data terisi dengan benar sebelum mengirim."}
        </p>

        {memuatRiwayat && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
            Memuat data...
          </div>
        )}

        {!memuatRiwayat && tampilRiwayat && aktif && (
          <div className="space-y-6">
            {riwayat.length > 1 && (
              <div className="space-y-2">
                {riwayat.map((p) => {
                  const dipilih = String(p.id) === String(pilihId);

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPilihId(p.id)}
                      aria-pressed={dipilih}
                      className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4 text-left transition ${
                        dipilih
                          ? "border-[#404E3B] bg-white shadow-md"
                          : "border-[#BAC8B1] bg-white/70 hover:bg-white"
                      }`}
                    >
                      <span>
                        <b className="block">{p.instansi || "-"}</b>
                        <span className="text-xs opacity-70">
                          Dikirim {formatTanggal(p.dikirim)}
                        </span>
                      </span>
                      <StatusBadge status={p.status} />
                    </button>
                  );
                })}
              </div>
            )}

            <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
              <div className="bg-gradient-to-r from-[#404E3B] to-[#7B9669] px-6 py-6 text-[#E6E6E6] sm:px-8">
                <h2 className="text-xl font-bold">
                  Formulir pengajuan surat pengantar magang
                </h2>
                <p className="mt-1 text-sm">
                  Data di bawah adalah pengajuan yang sudah dikirim dan tidak
                  dapat diubah.
                </p>
              </div>

              <FormRiwayat
                key={aktif.id}
                item={aktif}
                memuatDetail={memuatDetail}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#BAC8B1] px-6 py-5 sm:px-8">
                <p className="text-sm">
                  {aktif.status === "revisi" &&
                    "Pengajuan ini perlu diperbaiki. Perbaikan akan memperbarui pengajuan yang sama, bukan membuat yang baru."}
                  {aktif.status === "menunggu_verifikasi" &&
                    "Pengajuan sedang diverifikasi oleh admin."}
                  {aktif.status === "setuju" &&
                    "Pengajuan ini sudah disetujui."}
                </p>

                {aktif.status === "revisi" && (
                  <Button
                    type="button"
                    onClick={() => perbaiki(aktif)}
                    className="border-0 bg-[#404E3B] font-bold text-[#E6E6E6] hover:bg-[#BAC8B1] hover:text-[#404E3B]"
                  >
                    Perbaiki pengajuan
                  </Button>
                )}

                {aktif.status === "setuju" && !adaBerjalan && (
                  <Button
                    type="button"
                    onClick={mulaiBaru}
                    className="border-0 bg-[#404E3B] font-bold text-[#E6E6E6] hover:bg-[#BAC8B1] hover:text-[#404E3B]"
                  >
                    Buat pengajuan baru
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {!memuatRiwayat && !tampilRiwayat && (
          <>
            {riwayat.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBuatBaru(false);
                  setSedangRevisi(null);
                }}
                className="mb-4 text-sm font-semibold underline hover:text-[#7B9669]"
              >
                ← Kembali ke riwayat pengajuan
              </button>
            )}

            {sedangRevisi?.catatan && (
              <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                <b>Catatan revisi dari admin:</b>
                <p className="mt-1 whitespace-pre-line">
                  {sedangRevisi.catatan}
                </p>
              </div>
            )}

            <div
              key={versiForm}
              className="overflow-hidden rounded-2xl bg-white shadow-lg"
            >
              <div className="bg-gradient-to-r from-[#404E3B] to-[#7B9669] px-6 py-6 text-[#E6E6E6] sm:px-8">
                <h2 className="text-xl font-bold">
                  Formulir pengajuan surat pengantar magang
                </h2>
                <p className="mt-1 text-sm">
                  {sedangRevisi
                    ? `Perbaiki data pengajuan #${sedangRevisi.id}, lalu kirim ulang. Pengajuan yang sama akan diperbarui.`
                    : "Lengkapi 4 langkah berikut. Surat akan diverifikasi admin sebelum diterbitkan resmi."}
                </p>
              </div>

              <div className="p-6 sm:p-8">
                <Stepper step={step} />

                {step === 0 && (
                  <div>
                    <div className="grid gap-x-4 sm:grid-cols-2">
                      <Field id="nama" label="Nama lengkap" error={errors.nama}>
                        <TextInput
                          id="nama"
                          theme={inputTheme}
                          value={form.nama}
                          onChange={update("nama")}
                          readOnly
                          className="cursor-not-allowed opacity-80"
                          color={errors.nama ? "failure" : "gray"}
                        />
                      </Field>
                      <Field id="nim" label="NIM" error={errors.nim}>
                        <TextInput
                          id="nim"
                          theme={inputTheme}
                          value={form.nim}
                          onChange={update("nim")}
                          readOnly
                          className="cursor-not-allowed opacity-80"
                          maxLength={11}
                          color={errors.nim ? "failure" : "gray"}
                        />
                      </Field>
                    </div>
                    <Field
                      id="departemen"
                      label="Departemen / program studi"
                      error={errors.departemen}
                    >
                      <TextInput
                        id="departemen"
                        theme={inputTheme}
                        value={form.departemen}
                        readOnly
                        className="cursor-not-allowed opacity-80"
                        color={errors.departemen ? "failure" : "gray"}
                      />
                    </Field>

                    {/* Jenis pengajuan: individu / kelompok */}
                    <div className="mb-4">
                      <span className="mb-1 block text-sm font-semibold text-[#404E3B]">
                        Jenis pengajuan
                      </span>
                      <div className="flex rounded-lg border border-[#7B9669] p-1">
                        {[
                          { nilai: false, label: "Individu" },
                          { nilai: true, label: "Kelompok" },
                        ].map((opsi) => (
                          <button
                            key={opsi.label}
                            type="button"
                            onClick={() => ubahJenis(opsi.nilai)}
                            aria-pressed={form.kelompok === opsi.nilai}
                            className={`flex-1 rounded-md py-2 text-center text-sm font-semibold transition ${
                              form.kelompok === opsi.nilai
                                ? "bg-[#404E3B] text-[#E6E6E6]"
                                : "text-[#404E3B] hover:bg-[#BAC8B1]"
                            }`}
                          >
                            {opsi.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {form.kelompok && (
                      <div className="mb-2">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            Anggota kelompok
                          </span>
                          <span className="text-xs opacity-70">
                            {form.anggota.length + 1} orang
                          </span>
                        </div>

                        <p className="mb-3 text-xs opacity-70">
                          Kamu terdaftar sebagai pengaju utama. Tambahkan nama
                          dan NIM anggota lainnya.
                        </p>

                        {form.anggota.map((a, i) => (
                          <div
                            key={i}
                            className="mb-3 rounded-lg border border-[#BAC8B1] p-4"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm font-semibold">
                                Anggota {i + 2}
                              </span>
                              <button
                                type="button"
                                onClick={() => hapusAnggota(i)}
                                className="text-xs font-semibold text-[#b42318] underline"
                              >
                                Hapus
                              </button>
                            </div>

                            <div className="grid gap-x-4 sm:grid-cols-2">
                              <Field
                                id={`anggota-nama-${i}`}
                                label="Nama lengkap"
                                error={errors.anggota?.[i]?.nama}
                              >
                                <TextInput
                                  id={`anggota-nama-${i}`}
                                  theme={inputTheme}
                                  value={a.nama}
                                  onChange={(e) =>
                                    ubahAnggota(i, "nama", e.target.value)
                                  }
                                  placeholder="Nama lengkap anggota"
                                  color={
                                    errors.anggota?.[i]?.nama
                                      ? "failure"
                                      : "gray"
                                  }
                                />
                              </Field>
                              <Field
                                id={`anggota-nim-${i}`}
                                label="NIM"
                                error={errors.anggota?.[i]?.nim}
                              >
                                <TextInput
                                  id={`anggota-nim-${i}`}
                                  theme={inputTheme}
                                  value={a.nim}
                                  onChange={(e) =>
                                    ubahAnggota(i, "nim", e.target.value)
                                  }
                                  maxLength={11}
                                  placeholder="NIM anggota"
                                  color={
                                    errors.anggota?.[i]?.nim
                                      ? "failure"
                                      : "gray"
                                  }
                                />
                              </Field>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={tambahAnggota}
                          className="w-full rounded-lg border border-dashed border-[#7B9669] py-2 text-sm font-semibold text-[#404E3B] transition hover:bg-[#BAC8B1]"
                        >
                          + Tambah anggota
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {step === 1 && (
                  <div>
                    {form.tempat2 && (
                      <p className="mb-2 text-sm font-semibold">
                        Tempat magang 1
                      </p>
                    )}
                    <Field
                      id="instansi"
                      label="Nama instansi / perusahaan"
                      error={errors.instansi}
                    >
                      <TextInput
                        id="instansi"
                        theme={inputTheme}
                        value={form.instansi}
                        onChange={update("instansi")}
                        onBlur={rapikan("instansi")}
                        placeholder="cth. PT Maju Bersama"
                        color={errors.instansi ? "failure" : "gray"}
                      />
                    </Field>
                    <Field
                      id="alamat_instansi"
                      label="Alamat instansi"
                      error={errors.alamat_instansi}
                    >
                      <Textarea
                        id="alamat_instansi"
                        theme={textareaTheme}
                        rows={3}
                        value={form.alamat_instansi}
                        onChange={update("alamat_instansi")}
                        onBlur={rapikan("alamat_instansi")}
                        placeholder="Alamat lengkap instansi"
                        color={errors.alamat_instansi ? "failure" : "gray"}
                      />
                    </Field>
                    <div className="grid gap-x-4 sm:grid-cols-2">
                      <Field
                        id="tanggal_mulai"
                        label="Tanggal mulai"
                        error={errors.tanggal_mulai}
                      >
                        <TextInput
                          id="tanggal_mulai"
                          theme={inputTheme}
                          type="date"
                          value={form.tanggal_mulai}
                          onChange={update("tanggal_mulai")}
                          color={errors.tanggal_mulai ? "failure" : "gray"}
                        />
                      </Field>
                      <Field
                        id="tanggal_selesai"
                        label="Tanggal selesai"
                        error={errors.tanggal_selesai}
                      >
                        <TextInput
                          id="tanggal_selesai"
                          theme={inputTheme}
                          type="date"
                          value={form.tanggal_selesai}
                          onChange={update("tanggal_selesai")}
                          color={errors.tanggal_selesai ? "failure" : "gray"}
                        />
                      </Field>
                    </div>

                    {/* Tempat magang ke-2 (opsional) */}
                    {form.tempat2 ? (
                      <div className="mb-3 rounded-lg border border-[#BAC8B1]">
                        <div className="flex items-center gap-2 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setTempat2Terbuka((t) => !t)}
                            aria-expanded={tempat2Terbuka}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#404E3B] text-xs font-semibold text-[#E6E6E6]">
                              2
                            </span>
                            <span className="min-w-0 flex-1">
                              <b className="block truncate text-sm">
                                {form.tempat2.instansi.trim() ||
                                  "Tempat magang 2"}
                              </b>
                              <span className="text-xs opacity-70">
                                {form.tempat2.tanggal_mulai ||
                                form.tempat2.tanggal_selesai
                                  ? `${formatTanggal(form.tempat2.tanggal_mulai)} – ${formatTanggal(form.tempat2.tanggal_selesai)}`
                                  : "Belum diisi"}
                              </span>
                            </span>
                            <span aria-hidden="true" className="text-xs">
                              {tempat2Terbuka ? "▲" : "▼"}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={hapusTempat2}
                            className="text-xs font-semibold text-[#b42318] underline"
                          >
                            Hapus
                          </button>
                        </div>

                        {tempat2Terbuka && (
                          <div className="border-t border-[#BAC8B1] p-4">
                            <Field
                              id="t2-instansi"
                              label="Nama instansi / perusahaan"
                              error={errors.tempat2?.instansi}
                            >
                              <TextInput
                                id="t2-instansi"
                                theme={inputTheme}
                                value={form.tempat2.instansi}
                                onChange={(e) =>
                                  ubahTempat2("instansi", e.target.value)
                                }
                                onBlur={rapikanTempat2("instansi")}
                                placeholder="cth. PT Maju Bersama"
                                color={
                                  errors.tempat2?.instansi ? "failure" : "gray"
                                }
                              />
                            </Field>
                            <Field
                              id="t2-alamat"
                              label="Alamat instansi"
                              error={errors.tempat2?.alamat_instansi}
                            >
                              <Textarea
                                id="t2-alamat"
                                theme={textareaTheme}
                                rows={3}
                                value={form.tempat2.alamat_instansi}
                                onChange={(e) =>
                                  ubahTempat2(
                                    "alamat_instansi",
                                    e.target.value,
                                  )
                                }
                                onBlur={rapikanTempat2("alamat_instansi")}
                                placeholder="Alamat lengkap instansi"
                                color={
                                  errors.tempat2?.alamat_instansi
                                    ? "failure"
                                    : "gray"
                                }
                              />
                            </Field>
                            <div className="grid gap-x-4 sm:grid-cols-2">
                              <Field
                                id="t2-mulai"
                                label="Tanggal mulai"
                                error={errors.tempat2?.tanggal_mulai}
                              >
                                <TextInput
                                  id="t2-mulai"
                                  theme={inputTheme}
                                  type="date"
                                  value={form.tempat2.tanggal_mulai}
                                  onChange={(e) =>
                                    ubahTempat2("tanggal_mulai", e.target.value)
                                  }
                                  color={
                                    errors.tempat2?.tanggal_mulai
                                      ? "failure"
                                      : "gray"
                                  }
                                />
                              </Field>
                              <Field
                                id="t2-selesai"
                                label="Tanggal selesai"
                                error={errors.tempat2?.tanggal_selesai}
                              >
                                <TextInput
                                  id="t2-selesai"
                                  theme={inputTheme}
                                  type="date"
                                  value={form.tempat2.tanggal_selesai}
                                  onChange={(e) =>
                                    ubahTempat2(
                                      "tanggal_selesai",
                                      e.target.value,
                                    )
                                  }
                                  color={
                                    errors.tempat2?.tanggal_selesai
                                      ? "failure"
                                      : "gray"
                                  }
                                />
                              </Field>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={tambahTempat2}
                        className="w-full rounded-lg border border-dashed border-[#7B9669] py-2 text-sm font-semibold text-[#404E3B] transition hover:bg-[#BAC8B1]"
                      >
                        + Tambah tempat magang
                      </button>
                    )}
                    {form.tempat2 && (
                      <p className="text-center text-xs opacity-70">
                        Maksimal 2 tempat magang.
                      </p>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <div className="mb-4 overflow-hidden rounded-lg border border-[#BAC8B1] bg-white">
                      {preview.loading && (
                        <p className="p-6 text-sm">Memuat preview surat...</p>
                      )}
                      {preview.error && (
                        <div className="p-6">
                          <p className="text-sm font-medium text-[#b42318]">
                            {preview.error}
                          </p>
                          <button
                            type="button"
                            onClick={() => setVersiPreview((v) => v + 1)}
                            className="mt-2 text-sm font-semibold underline hover:text-[#7B9669]"
                          >
                            Muat ulang preview
                          </button>
                        </div>
                      )}
                      {!preview.loading &&
                        !preview.error &&
                        (preview.src || preview.srcDoc) && (
                          <iframe
                            title="Preview surat"
                            src={
                              preview.src
                                ? `${preview.src}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`
                                : undefined
                            }
                            srcDoc={preview.srcDoc || undefined}
                            className="w-full rounded-lg border border-[#BAC8B1] bg-white"
                            style={{ minHeight: 600 }}
                            onLoad={(e) => {
                              const doc = e.target.contentDocument;
                              if (doc && preview.srcDoc) {
                                e.target.style.height =
                                  doc.documentElement.scrollHeight + "px";
                              }
                            }}
                          />
                        )}
                    </div>

                    <Field id="ttd" label="Persetujuan" error={errors.ttd}>
                      <p className="mb-3 text-sm">
                        Periksa isi surat di atas. Tekan Setujui untuk
                        menandatangani surat dengan QR code.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {disetujui ? (
                          <>
                            <span className="w-fit rounded-lg bg-[#BAC8B1] px-3 py-2 text-sm font-semibold">
                              ✓ Surat sudah disetujui
                            </span>
                            <Button
                              type="button"
                              onClick={batalSetujui}
                              className="w-fit border border-[#404E3B] bg-transparent font-bold text-[#404E3B] hover:bg-[#404E3B] hover:text-[#E6E6E6]"
                            >
                              Batal setujui
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            onClick={setujui}
                            disabled={
                              menyetujui || preview.loading || !!preview.error
                            }
                            className="w-fit border-0 bg-[#404E3B] font-bold text-[#E6E6E6] hover:bg-[#BAC8B1] hover:text-[#404E3B]"
                          >
                            {menyetujui ? "Memproses..." : "Setujui"}
                          </Button>
                        )}
                      </div>
                    </Field>
                  </div>
                )}
                {step === 3 && (
                  <div>
                    <Field
                      id="bukti_spp"
                      label="1. Upload File Detail SPP (PDF / JPG / PNG, maks. 2 MB)"
                      error={errors.bukti_spp}
                    >
                      <FileInput
                        id="bukti_spp"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={update("bukti_spp")}
                        className="text-[#404E3B]"
                      />
                    </Field>

                    <Field
                      id="surat_rekomendasi"
                      label="2. Upload Surat Rekomendasi Magang (PDF / JPG / PNG, maks. 2 MB)"
                      error={errors.surat_rekomendasi}
                    >
                      <FileInput
                        id="surat_rekomendasi"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={update("surat_rekomendasi")}
                        className="text-[#404E3B]"
                      />
                    </Field>
                  </div>
                )}

                {msg && (
                  <Alert className="mt-4 border border-[#b42318] bg-[#ffd9d3] text-[#7a1f12]">
                    {msg.text}
                  </Alert>
                )}

                <div className="mt-6 flex items-center justify-between border-t border-[#BAC8B1] pt-5">
                  {step > 0 ? (
                    <Button
                      type="button"
                      onClick={back}
                      disabled={loading}
                      className="border border-[#7B9669] bg-white font-semibold text-[#404E3B] hover:bg-[#BAC8B1]"
                    >
                      ← Kembali
                    </Button>
                  ) : (
                    <span />
                  )}
                  {step < STEPS.length - 1 ? (
                    <Button
                      type="button"
                      onClick={next}
                      disabled={loading}
                      aria-disabled={belumSetuju}
                      title={
                        belumSetuju
                          ? "Setujui surat terlebih dahulu"
                          : undefined
                      }
                      className={`border-0 font-bold ${
                        belumSetuju
                          ? "cursor-not-allowed bg-gray-300 text-gray-500 hover:bg-gray-300 hover:text-gray-500"
                          : "bg-[#404E3B] text-[#E6E6E6] hover:bg-[#BAC8B1] hover:text-[#404E3B]"
                      }`}
                    >
                      {loading ? "Menyimpan..." : "Lanjut →"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={loading}
                      className="border-0 bg-[#404E3B] font-bold text-[#E6E6E6] hover:bg-[#BAC8B1] hover:text-[#404E3B]"
                    >
                      {loading ? "Mengirim..." : "Kirim pengajuan"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}