import { useEffect, useRef, useState } from "react";
import { Alert, Button, FileInput, Label, Textarea, TextInput } from "flowbite-react";

const API = "http://10.6.74.85:8000/api";

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

const departemenDariNim = (nim) => DEPARTEMEN_PREFIX[(nim || "").toUpperCase().slice(0, 4)] || "";

const NAMA_DEPARTEMEN = {
  MNH: "Manajemen Hutan",
  THH: "Teknologi Hasil Hutan",
  KSHE: "Konservasi Sumber Daya Hutan dan Ekowisata",
  SVK: "Silvikultur",
};

// Departemen bisa berupa kode ("SVK"), nama, atau objek { kode, nama }
const namaDep = (dep) => {
  if (!dep) return "";
  if (typeof dep === "object") return dep.nama ?? NAMA_DEPARTEMEN[dep.kode] ?? dep.kode ?? "";
  return NAMA_DEPARTEMEN[dep] ?? String(dep);
};

const STEPS = ["Data diri", "Tempat magang", "Tanda tangan", "Berkas & kirim"];

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const EKSTENSI_BOLEH = ["pdf", "jpg", "jpeg", "png"];

const colors = {
  gray: "border-[#7B9669] bg-[#E6E6E6] text-[#404E3B] placeholder-[#7a8575] focus:border-[#404E3B] focus:ring-[#7B9669]",
  failure: "border-[#b42318] bg-[#E6E6E6] text-[#404E3B] placeholder-[#7a8575] focus:border-[#b42318] focus:ring-[#b42318]",
};
const inputTheme = { field: { input: { colors } } };
const textareaTheme = { colors };

const capitalizeWords = (str) => str.replace(/(^|\s)(\S)/g, (_, space, ch) => space + ch.toUpperCase());

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
    headers: json ? { ...authHeaders(), "Content-Type": "application/json" } : authHeaders(),
    body: json ? JSON.stringify(json) : formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(pesanError(data, "Permintaan gagal."));
  return data;
};

const ambilPreview = async (id) => {
  const response = await fetch(`${API}${ENDPOINT.preview(id)}`, { headers: authHeaders() });
  const type = response.headers.get("content-type") || "";

  if (!response.ok) {
    const data = type.includes("application/json") ? await response.json().catch(() => ({})) : {};
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
  if (!EKSTENSI_BOLEH.includes(ext)) return "Format file harus PDF, JPG, atau PNG.";
  return "";
};

// Data yang dikirim ke server untuk membuat / memperbarui pengajuan
const bentukData = (f) => ({
  nama: f.nama.trim(),
  nim: f.nim.trim(),
  departemen: f.departemen,
  instansi: f.instansi.trim(),
  alamat_instansi: f.alamat_instansi.trim(),
  tanggal_mulai: f.tanggal_mulai,
  tanggal_selesai: f.tanggal_selesai,
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
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);
};

const normalisasiStatus = (status) => {
  const value = String(typeof status === "object" ? status?.value ?? "" : status ?? "").toLowerCase();
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
  menunggu_verifikasi: { label: "Menunggu verifikasi", className: "bg-[#BAC8B1] text-[#404E3B]" },
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
  const cocok = String(url).split("?")[0].match(/\.([a-z0-9]+)$/i);
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
      namaDep(mhs.departemen ?? item.departemen ?? user.departemen) || departemenDariNim(nim) || "-",
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
        <li key={label} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
              i <= step ? "border-[#404E3B] bg-[#404E3B] text-[#E6E6E6]" : "border-[#BAC8B1] text-[#7B9669]"
            }`}
          >
            {i < step ? "✓" : i + 1}
          </span>
          <span
            className={`ml-2 text-sm font-semibold ${
              i === step ? "inline text-[#404E3B]" : "hidden text-[#7B9669] sm:inline"
            }`}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <span className={`mx-3 h-px flex-1 ${i < step ? "bg-[#404E3B]" : "bg-[#BAC8B1]"}`} />
          )}
        </li>
      ))}
    </ol>
  );
}

function StatusBadge({ status }) {
  const config = STATUS[status] ?? { label: status, className: "bg-gray-200 text-gray-700" };

  return (
    <span className={`inline-block w-fit rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
}

function BerkasBaris({ berkas, terbuka, onToggle }) {
  const gambar = ["jpg", "jpeg", "png", "gif", "webp"].includes(berkas.ekstensi);

  return (
    <div className="overflow-hidden rounded-lg border border-[#BAC8B1] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
        <strong>{berkas.label}</strong>

        <span className="flex flex-wrap gap-4">
          <button type="button" onClick={onToggle} className="underline">
            {terbuka ? "Sembunyikan preview" : "Lihat preview"}
          </button>

          <a href={berkas.preview_url} target="_blank" rel="noreferrer" className="underline">
            Buka berkas
          </a>

          {berkas.download_url && (
            <a href={berkas.download_url} target="_blank" rel="noreferrer" className="underline">
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

  const berkasServer = item.daftarBerkas.filter((b) => b.jenis !== "surat-magang" || item.status === "setuju");

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
          <p className="text-xs opacity-70">Dikirim {formatTanggal(item.dikirim)}</p>
        </div>

        <StatusBadge status={item.status} />
      </div>

      <Stepper step={STEPS.length} />

      {memuatDetail && <p className="mb-3 text-sm opacity-70">Memuat detail pengajuan...</p>}

      {item.status === "setuju" && item.nomorSurat && (
        <div className="mb-4">
          <Field id="r-nomor" label="Nomor surat" optional>
            <TextInput id="r-nomor" theme={inputTheme} value={item.nomorSurat} readOnly color="gray" className="cursor-default font-bold" />
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
          <TextInput id="r-nama" theme={inputTheme} value={item.nama} readOnly color="gray" className="cursor-default" />
        </Field>
        <Field id="r-nim" label="NIM" optional>
          <TextInput id="r-nim" theme={inputTheme} value={item.nim} readOnly color="gray" className="cursor-default" />
        </Field>
      </div>

      <Field id="r-dep" label="Departemen / program studi" optional>
        <TextInput id="r-dep" theme={inputTheme} value={item.departemen} readOnly color="gray" className="cursor-default" />
      </Field>

      <Field id="r-instansi" label="Nama instansi / perusahaan" optional>
        <TextInput id="r-instansi" theme={inputTheme} value={item.instansi || "-"} readOnly color="gray" className="cursor-default" />
      </Field>

      <Field id="r-alamat" label="Alamat instansi" optional>
        <Textarea id="r-alamat" theme={textareaTheme} rows={3} value={item.alamat} readOnly color="gray" className="cursor-default" />
      </Field>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field id="r-mulai" label="Tanggal mulai" optional>
          <TextInput id="r-mulai" theme={inputTheme} value={formatTanggal(item.tanggal_mulai)} readOnly color="gray" className="cursor-default" />
        </Field>
        <Field id="r-selesai" label="Tanggal selesai" optional>
          <TextInput id="r-selesai" theme={inputTheme} value={formatTanggal(item.tanggal_selesai)} readOnly color="gray" className="cursor-default" />
        </Field>
      </div>

      <div className="mb-2 mt-2 font-semibold">Surat dan berkas</div>

      {berkas.length > 0 ? (
        <div className="space-y-3">
          {berkas.map((b) => (
            <BerkasBaris
              key={b.jenis}
              berkas={b}
              terbuka={Boolean(terbuka[b.jenis])}
              onToggle={() => setTerbuka((t) => ({ ...t, [b.jenis]: !t[b.jenis] }))}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm opacity-70">Berkas belum tersedia untuk dilihat.</p>
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
    instansi: "", alamat_instansi: "", tanggal_mulai: "", tanggal_selesai: "",
    bukti_spp: null, surat_rekomendasi: null,
  };

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(dataAwal);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [disetujui, setDisetujui] = useState(false);
  const [menyetujui, setMenyetujui] = useState(false);
  const [versiPreview, setVersiPreview] = useState(0);
  const [preview, setPreview] = useState({ src: "", srcDoc: "", loading: false, error: "" });

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
  const adaBerjalan = riwayat.some((p) => p.status === "menunggu_verifikasi" || p.status === "revisi");

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
          String(p.id) === String(lokal.id) ? { ...p, berkasLokal: lokal.berkasLokal } : p
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
        setPreview({ src: hasil.src || "", srcDoc: hasil.srcDoc || "", loading: false, error: "" });
      })
      .catch((err) => {
        if (!batal) setPreview({ src: "", srcDoc: "", loading: false, error: pesanDariError(err) });
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
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((er) => ({ ...er, [field]: "" }));
  };

  const validate = (s) => {
    const er = {};
    if (s === 0) {
      if (!form.nama.trim()) er.nama = "Nama lengkap wajib diisi.";
      if (!form.nim.trim()) er.nim = "NIM wajib diisi.";
      else if (!/^[A-Z0-9]{11}$/.test(form.nim.trim())) er.nim = "NIM harus 11 karakter (huruf dan angka).";
      if (!form.departemen) er.departemen = "Departemen tidak dikenali dari NIM.";
    }
    if (s === 1) {
      if (!form.instansi.trim()) er.instansi = "Nama instansi wajib diisi.";
      if (!form.alamat_instansi.trim()) er.alamat_instansi = "Alamat instansi wajib diisi.";
      if (!form.tanggal_mulai) er.tanggal_mulai = "Tanggal mulai wajib diisi.";
      if (!form.tanggal_selesai) er.tanggal_selesai = "Tanggal selesai wajib diisi.";
      else if (form.tanggal_mulai && form.tanggal_selesai <= form.tanggal_mulai)
        er.tanggal_selesai = "Tanggal selesai tidak boleh sebelum tanggal mulai.";
    }
    if (s === 2) {
      if (!disetujui) er.ttd = "Tekan tombol Setujui terlebih dahulu.";
    }
    if (s === 3) {
      const errSpp = validasiBerkas(form.bukti_spp, "Bukti SPP");
      if (errSpp) er.bukti_spp = errSpp;

      const errRekom = validasiBerkas(form.surat_rekomendasi, "Surat rekomendasi");
      if (errRekom) er.surat_rekomendasi = errRekom;
    }
    return er;
  };

  const siapkanPengajuan = async () => {
    const data = bentukData(form);
    const snapshot = JSON.stringify(data);
    if (pengajuanId.current && snapshotDraft.current === snapshot) return;

    if (pengajuanId.current) {
      await panggilApi(ENDPOINT.ubah(pengajuanId.current), { json: data, method: "PUT" });
      snapshotDraft.current = snapshot;
      setDisetujui(false);
      return;
    }

    const hasil = await panggilApi(ENDPOINT.buat, { json: data });
    const id = hasil?.data?.id ?? hasil?.id ?? hasil?.pengajuan?.id;
    if (!id) throw new Error("ID pengajuan tidak ditemukan pada respons server.");

    pengajuanId.current = id;
    snapshotDraft.current = snapshot;
    setDisetujui(false);
  };

  const next = async () => {
    const er = validate(step);
    setErrors(er);
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
      await panggilApi(ENDPOINT.tandaTangan(pengajuanId.current), { method: "DELETE" });
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
      setMsg({ type: "no", text: "Data pengajuan belum tersimpan. Kembali ke langkah sebelumnya." });
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
        instansi: form.instansi,
        alamat_instansi: form.alamat_instansi,
        tanggal_mulai: form.tanggal_mulai,
        tanggal_selesai: form.tanggal_selesai,
        status: "menunggu_verifikasi",
        dikirim_at: new Date().toISOString(),
        berkasLokal: [
          {
            jenis: "bukti-spp",
            label: LABEL_BERKAS["bukti-spp"],
            ekstensi: (form.bukti_spp.name.split(".").pop() || "").toLowerCase(),
            url: URL.createObjectURL(form.bukti_spp),
          },
          {
            jenis: "surat-rekomendasi",
            label: LABEL_BERKAS["surat-rekomendasi"],
            ekstensi: (form.surat_rekomendasi.name.split(".").pop() || "").toLowerCase(),
            url: URL.createObjectURL(form.surat_rekomendasi),
          },
        ],
      });

      setBuatBaru(false);
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
    const terisi = {
      ...dataAwal,
      instansi: item.instansi || "",
      alamat_instansi: item.alamat && item.alamat !== "-" ? item.alamat : "",
      tanggal_mulai: String(item.tanggal_mulai || "").slice(0, 10),
      tanggal_selesai: String(item.tanggal_selesai || "").slice(0, 10),
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

  const dariDaftar = riwayat.find((p) => String(p.id) === String(pilihId)) ?? null;
  const aktif =
    detail && String(detail.id) === String(pilihId) ? { ...dariDaftar, ...detail } : dariDaftar;

  return (
    <div className="min-h-screen bg-[#E6E6E6] text-[#404E3B]">
      <header className="border-b border-[#BAC8B1] bg-white">
        <div className="flex items-center justify-between gap-4 px-6 py-3 lg:px-40">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#404E3B] text-sm font-bold text-[#E6E6E6]">SM</span>
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
          {tampilRiwayat ? "Riwayat pengajuan" : sedangRevisi ? "Perbaiki pengajuan" : "Formulir pengajuan"}
        </h1>
        <p className="mb-8 mt-2 text-center text-[#404E3B]">
          {tampilRiwayat
            ? "Pengajuan yang sudah kamu kirim tersimpan di sini beserta statusnya."
            : "Pastikan semua data terisi dengan benar sebelum mengirim."}
        </p>

        {memuatRiwayat && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-lg">Memuat data...</div>
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
                        <span className="text-xs opacity-70">Dikirim {formatTanggal(p.dikirim)}</span>
                      </span>
                      <StatusBadge status={p.status} />
                    </button>
                  );
                })}
              </div>
            )}

            <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
              <div className="bg-gradient-to-r from-[#404E3B] to-[#7B9669] px-6 py-6 text-[#E6E6E6] sm:px-8">
                <h2 className="text-xl font-bold">Formulir pengajuan surat pengantar magang</h2>
                <p className="mt-1 text-sm">Data di bawah adalah pengajuan yang sudah dikirim dan tidak dapat diubah.</p>
              </div>

              <FormRiwayat key={aktif.id} item={aktif} memuatDetail={memuatDetail} />

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#BAC8B1] px-6 py-5 sm:px-8">
                <p className="text-sm">
                  {aktif.status === "revisi" &&
                    "Pengajuan ini perlu diperbaiki. Perbaikan akan memperbarui pengajuan yang sama, bukan membuat yang baru."}
                  {aktif.status === "menunggu_verifikasi" && "Pengajuan sedang diverifikasi oleh admin."}
                  {aktif.status === "setuju" && "Pengajuan ini sudah disetujui."}
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
                <p className="mt-1 whitespace-pre-line">{sedangRevisi.catatan}</p>
              </div>
            )}

            <div key={versiForm} className="overflow-hidden rounded-2xl bg-white shadow-lg">
              <div className="bg-gradient-to-r from-[#404E3B] to-[#7B9669] px-6 py-6 text-[#E6E6E6] sm:px-8">
                <h2 className="text-xl font-bold">Formulir pengajuan surat pengantar magang</h2>
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
                          id="nama" theme={inputTheme} value={form.nama} onChange={update("nama")}
                          readOnly className="cursor-not-allowed opacity-80"
                          color={errors.nama ? "failure" : "gray"}
                        />
                      </Field>
                      <Field id="nim" label="NIM" error={errors.nim}>
                        <TextInput
                          id="nim" theme={inputTheme} value={form.nim} onChange={update("nim")}
                          readOnly className="cursor-not-allowed opacity-80"
                          maxLength={11} color={errors.nim ? "failure" : "gray"}
                        />
                      </Field>
                    </div>
                    <Field id="departemen" label="Departemen / program studi" error={errors.departemen}>
                      <TextInput
                        id="departemen" theme={inputTheme} value={form.departemen}
                        readOnly className="cursor-not-allowed opacity-80"
                        color={errors.departemen ? "failure" : "gray"}
                      />
                    </Field>
                  </div>
                )}

                {step === 1 && (
                  <div>
                    <Field id="instansi" label="Nama instansi / perusahaan" error={errors.instansi}>
                      <TextInput
                        id="instansi" theme={inputTheme} value={form.instansi} onChange={update("instansi")}
                        placeholder="cth. PT Maju Bersama" color={errors.instansi ? "failure" : "gray"}
                      />
                    </Field>
                    <Field id="alamat_instansi" label="Alamat instansi" error={errors.alamat_instansi}>
                      <Textarea
                        id="alamat_instansi" theme={textareaTheme} rows={3} value={form.alamat_instansi}
                        onChange={update("alamat_instansi")}
                        placeholder="Alamat lengkap instansi" color={errors.alamat_instansi ? "failure" : "gray"}
                      />
                    </Field>
                    <div className="grid gap-x-4 sm:grid-cols-2">
                      <Field id="tanggal_mulai" label="Tanggal mulai" error={errors.tanggal_mulai}>
                        <TextInput
                          id="tanggal_mulai" theme={inputTheme} type="date" value={form.tanggal_mulai}
                          onChange={update("tanggal_mulai")} color={errors.tanggal_mulai ? "failure" : "gray"}
                        />
                      </Field>
                      <Field id="tanggal_selesai" label="Tanggal selesai" error={errors.tanggal_selesai}>
                        <TextInput
                          id="tanggal_selesai" theme={inputTheme} type="date" value={form.tanggal_selesai}
                          onChange={update("tanggal_selesai")} color={errors.tanggal_selesai ? "failure" : "gray"}
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <div className="mb-4 overflow-hidden rounded-lg border border-[#BAC8B1] bg-white">
                      {preview.loading && <p className="p-6 text-sm">Memuat preview surat...</p>}
                      {preview.error && (
                        <div className="p-6">
                          <p className="text-sm font-medium text-[#b42318]">{preview.error}</p>
                          <button
                            type="button"
                            onClick={() => setVersiPreview((v) => v + 1)}
                            className="mt-2 text-sm font-semibold underline hover:text-[#7B9669]"
                          >
                            Muat ulang preview
                          </button>
                        </div>
                      )}
                      {!preview.loading && !preview.error && (preview.src || preview.srcDoc) && (
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
                              e.target.style.height = doc.documentElement.scrollHeight + "px";
                            }
                          }}
                        />
                      )}
                    </div>

                    <Field id="ttd" label="Persetujuan" error={errors.ttd}>
                      <p className="mb-3 text-sm">
                        Periksa isi surat di atas. Tekan Setujui untuk menandatangani surat dengan QR code.
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
                            disabled={menyetujui || preview.loading || !!preview.error}
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
                    <Field id="bukti_spp" label="Bukti SPP (PDF / JPG / PNG, maks. 2 MB)" error={errors.bukti_spp}>
                      <FileInput
                        id="bukti_spp" accept=".pdf,.jpg,.jpeg,.png"
                        onChange={update("bukti_spp")} className="text-[#404E3B]"
                      />
                    </Field>
                    <Field
                      id="surat_rekomendasi"
                      label="Surat rekomendasi dari pembimbing akademik (PDF / JPG / PNG, maks. 2 MB)"
                      error={errors.surat_rekomendasi}
                    >
                      <FileInput
                        id="surat_rekomendasi" accept=".pdf,.jpg,.jpeg,.png"
                        onChange={update("surat_rekomendasi")} className="text-[#404E3B]"
                      />
                    </Field>
                  </div>
                )}

                {msg && (
                  <Alert className="mt-4 border border-[#b42318] bg-[#ffd9d3] text-[#7a1f12]">{msg.text}</Alert>
                )}

                <div className="mt-6 flex items-center justify-between border-t border-[#BAC8B1] pt-5">
                  {step > 0 ? (
                    <Button
                      type="button" onClick={back} disabled={loading}
                      className="border border-[#7B9669] bg-white font-semibold text-[#404E3B] hover:bg-[#BAC8B1]"
                    >
                      ← Kembali
                    </Button>
                  ) : (
                    <span />
                  )}
                  {step < STEPS.length - 1 ? (
                    <Button
                      type="button" onClick={next} disabled={loading}
                      aria-disabled={belumSetuju}
                      title={belumSetuju ? "Setujui surat terlebih dahulu" : undefined}
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
                      type="button" onClick={handleSubmit} disabled={loading}
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