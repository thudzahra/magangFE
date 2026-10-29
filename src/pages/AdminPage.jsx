import { useEffect, useState } from "react";

// =====================================================
// KONFIGURASI API
// =====================================================

const API = (
  import.meta.env.VITE_API_URL ||
  "http://10.6.74.85:8000/api"
).replace(/\/+$/, "");

const ENDPOINT = {
  daftar: "/admin/pengajuan-magang",
  ringkasan: "/admin/pengajuan-magang/ringkasan",
  detail: (id) => `/admin/pengajuan-magang/${id}`,
  status: (id) => `/admin/pengajuan-magang/${id}/status`,
};

const PER_PAGE = 20;

async function panggilApi(endpoint, { method = "GET", body } = {}) {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Token login tidak ditemukan. Silakan login kembali.");
  }

  let response;

  try {
    response = await fetch(`${API}${endpoint}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "Tidak dapat terhubung ke server. Periksa koneksi dan alamat API."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validationErrors = data.errors
      ? Object.values(data.errors).flat().join("\n")
      : "";

    if (response.status === 401) {
      throw new Error("Sesi login tidak valid. Silakan login kembali.");
    }

    if (response.status === 403) {
      throw new Error(
        "Akses ditolak. Pastikan akun memiliki role admin_kpap."
      );
    }

    throw new Error(
      validationErrors || data.message || `Request gagal (${response.status}).`
    );
  }

  return data;
}

// =====================================================
// UTILITAS DATA
// =====================================================

const unwrap = (response) => response?.data ?? response;

function toArray(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

function formatTanggal(value) {
  if (!value) return "-";

  // "2026-11-02" dibaca sebagai tanggal lokal agar tidak bergeser hari
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

// Nomor halaman yang ditampilkan, contoh: [1, "...", 4, 5, 6, "...", 12]
function daftarHalaman(sekarang, terakhir) {
  const angka = [
    ...new Set([1, terakhir, sekarang - 1, sekarang, sekarang + 1]),
  ]
    .filter((n) => n >= 1 && n <= terakhir)
    .sort((a, b) => a - b);

  const hasil = [];

  angka.forEach((n, i) => {
    if (i > 0 && n - angka[i - 1] > 1) hasil.push("...");
    hasil.push(n);
  });

  return hasil;
}

// =====================================================
// DEPARTEMEN
// =====================================================

// Nama lengkap departemen. Kode yang tidak dikenal ditampilkan apa adanya.
const NAMA_DEPARTEMEN = {
  MNH: "Manajemen Hutan",
  THH: "Teknologi Hasil Hutan",
  KSHE: "Konservasi Sumber Daya Hutan dan Ekowisata",
  SVK: "Silvikultur",
};

function namaDepartemen(kode) {
  if (!kode || kode === "-") return "-";
  return NAMA_DEPARTEMEN[kode] ?? kode;
}

// Backend boleh mengirim departemen sebagai teks ("MNH") atau objek ({ kode, nama })
function bentukDepartemen(dep) {
  if (dep == null || dep === "") return { kode: "-", nama: "-" };

  if (typeof dep === "object") {
    const kode = dep.kode ?? dep.nama ?? "-";

    return { kode, nama: dep.nama ?? namaDepartemen(kode) };
  }

  return { kode: String(dep), nama: namaDepartemen(String(dep)) };
}

// =====================================================
// BERKAS
// =====================================================

const LABEL_BERKAS = {
  "surat-pengajuan": "Surat pengajuan magang",
  "bukti-spp": "Bukti pembayaran SPP",
  "surat-rekomendasi": "Surat rekomendasi",
  "surat-magang": "Surat pengantar magang",
};

// Berkas yang selalu ditampilkan (diberi keterangan jika belum ada)
const BERKAS_WAJIB = ["surat-pengajuan", "bukti-spp", "surat-rekomendasi"];

// Cadangan jika backend mengirim link langsung (bukan array "berkas")
const FIELD_LAMA = {
  "surat-pengajuan": "surat_pengajuan_url",
  "bukti-spp": "bukti_spp_url",
  "surat-rekomendasi": "surat_rekomendasi_url",
  "surat-magang": "surat_magang_url",
};

function ekstensiDari(url = "") {
  const cocok = String(url).split("?")[0].match(/\.([a-z0-9]+)$/i);
  return cocok ? cocok[1].toLowerCase() : "";
}

function ambilBerkas(item) {
  const dariApi = Array.isArray(item.berkas) ? item.berkas : [];

  return Object.keys(LABEL_BERKAS)
    .map((jenis) => {
      const b = dariApi.find((x) => x.jenis === jenis);

      if (b?.preview_url) {
        return {
          jenis,
          label: LABEL_BERKAS[jenis],
          // jenis file dibaca dari API, karena link bertanda tangan tidak berakhiran .pdf
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
}

// Satu bentuk data untuk daftar maupun detail
function normalisasiPengajuan(item = {}) {
  const mhs = item.mahasiswa ?? {};
  const dep = bentukDepartemen(mhs.departemen ?? item.departemen);

  return {
    ...item,
    nama: mhs.nama ?? mhs.name ?? item.nama ?? "-",
    nim: mhs.nim ?? item.nim ?? "-",
    departemenKode: mhs.departemen_kode ?? dep.kode,
    departemen: dep.nama,
    status:
      typeof item.status === "object"
        ? item.status?.value ?? "menunggu_verifikasi"
        : item.status ?? "menunggu_verifikasi",
    no_registrasi: item.nomor_surat ?? item.no_registrasi ?? "-",
    alamat: item.alamat_instansi ?? item.alamat ?? "-",
    daftarBerkas: ambilBerkas(item),
  };
}

// =====================================================
// STATUS
// =====================================================

function teks(value, fallback = "-") {
  if (value == null || value === "") return fallback;

  if (typeof value === "object") {
    if (value.label != null) return String(value.label);
    if (value.value != null) return String(value.value);

    return fallback;
  }

  return String(value);
}

function normalisasiStatus(status) {
  const value =
    typeof status === "object"
      ? String(status?.value ?? "").toLowerCase()
      : String(status ?? "").toLowerCase();

  const aliases = {
    setuju: "terverifikasi",
    disetujui: "terverifikasi",
    terverifikasi: "terverifikasi",

    revisi: "ditolak",
    ditolak: "ditolak",

    menunggu_verifikasi: "menunggu",
    menungguverifikasi: "menunggu",
    menunggu: "menunggu",
  };

  return aliases[value] ?? value;
}

// Nomor surat hanya dianggap ada jika pengajuan sudah terverifikasi
function nomorSuratTampil(item) {
  const sah = normalisasiStatus(item.status) === "terverifikasi";

  return sah && item.no_registrasi && item.no_registrasi !== "-"
    ? item.no_registrasi
    : null;
}

// Angka di depan nomor surat (contoh "8/IT3.F4/..." -> 8) untuk pengurutan
function urutanNomor(item) {
  const angka = parseInt(
    String(nomorSuratTampil(item) ?? "").split("/")[0],
    10
  );

  return Number.isNaN(angka) ? Infinity : angka;
}

// Nomor surat naik (1, 2, 3, ...); yang belum bernomor di bawah, urut ID
function urutkanPengajuan(a, b) {
  const na = urutanNomor(a);
  const nb = urutanNomor(b);

  if (na !== nb) return na < nb ? -1 : 1;

  return (Number(a.id) || 0) - (Number(b.id) || 0);
}

const STATUS = {
  menunggu: {
    label: "Menunggu verifikasi",
    className: "bg-[#BAC8B1] text-[#404E3B]",
  },
  terverifikasi: {
    label: "Terverifikasi",
    className: "bg-[#404E3B] text-[#E6E6E6]",
  },
  ditolak: {
    label: "Perlu revisi",
    className: "bg-red-100 text-red-800",
  },
};

function StatusBadge({ status }) {
  const normalized = normalisasiStatus(status);

  const config = STATUS[normalized] ?? {
    label: teks(status),
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

// =====================================================
// KOMPONEN TOMBOL, FIELD, DAN IKON
// =====================================================

const BUTTON_STYLES = {
  primary:
    "rounded-lg bg-[#404E3B] px-4 py-2 text-sm font-bold text-[#E6E6E6] transition hover:bg-[#BAC8B1] hover:text-[#404E3B] disabled:cursor-not-allowed disabled:opacity-50",
  light:
    "rounded-lg border border-[#404E3B] px-4 py-2 text-sm font-bold text-[#404E3B] transition hover:bg-[#404E3B] hover:text-[#E6E6E6] disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "rounded-lg border border-red-800 px-4 py-2 text-sm font-bold text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50",
};

function Button({
  variant = "light",
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`${BUTTON_STYLES[variant] ?? BUTTON_STYLES.light} ${className}`}
      {...props}
    />
  );
}

function Field({ label, value, children }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#BAC8B1] bg-white px-4 py-3 text-sm">
      <span className="shrink-0 opacity-70">{label}</span>

      {children ?? (
        <b className="break-words text-right font-semibold">
          {value || "-"}
        </b>
      )}
    </div>
  );
}

function IconCari({ className = "h-5 w-5" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconPanah({ className = "h-5 w-5" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// =====================================================
// PREVIEW BERKAS (tampil langsung di dalam modal)
// =====================================================

function BerkasKosong({ label }) {
  return (
    <div className="rounded-xl border border-dashed border-[#BAC8B1] bg-white p-4 text-sm">
      <b>{label}</b>
      <p className="mt-2 text-gray-500">Berkas belum tersedia.</p>
    </div>
  );
}

function FilePreview({ berkas }) {
  const gambar = ["jpg", "jpeg", "png", "gif", "webp"].includes(
    berkas.ekstensi
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#BAC8B1] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#BAC8B1] px-4 py-3 text-sm">
        <strong>{berkas.label}</strong>

        <span className="flex gap-4">
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

      {gambar ? (
        <img
          src={berkas.preview_url}
          alt={berkas.label}
          className="max-h-[520px] w-full bg-white object-contain"
        />
      ) : (
        <iframe
          src={`${berkas.preview_url}#toolbar=0&navpanes=0&view=FitH`}
          title={berkas.label}
          className="h-[640px] w-full"
        />
      )}
    </div>
  );
}

// =====================================================
// MODAL DETAIL DAN VERIFIKASI
// =====================================================

function DetailModal({ item, onClose, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const status = normalisasiStatus(item.status);
  const verified = status === "terverifikasi";
  const nomorSurat = nomorSuratTampil(item);
  const suratMagang = item.daftarBerkas.find((b) => b.jenis === "surat-magang");

  async function kirimStatus(body) {
    setBusy(true);
    setError("");

    try {
      const response = await panggilApi(ENDPOINT.status(item.id), {
        method: "PATCH",
        body,
      });

      const updated = unwrap(response);

      // Mendukung respons yang membungkus objek pengajuan.
      const pengajuan = updated?.pengajuan ?? updated;

      if (!pengajuan || pengajuan.id == null) {
        throw new Error(
          "Status berhasil dikirim, tetapi respons pengajuan tidak dikenali. Muat ulang halaman untuk memeriksa status."
        );
      }

      onUpdated(normalisasiPengajuan(pengajuan));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function verifikasi() {
    const yakin = window.confirm(
      "Verifikasi pengajuan ini? Nomor surat dibuat otomatis dan keputusan tidak dapat dibatalkan."
    );

    if (yakin) kirimStatus({ status: "setuju" });
  }

  function tolak() {
    const alasan = window.prompt("Catatan revisi untuk mahasiswa (wajib diisi):");

    if (alasan === null) return;

    if (!alasan.trim()) {
      setError("Catatan revisi wajib diisi.");
      return;
    }

    kirimStatus({ status: "revisi", catatan: alasan.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[#E6E6E6] shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#BAC8B1] bg-white px-6 py-4">
          <h3 className="font-bold text-[#404E3B]">
            Pengajuan #{item.id} — {item.nama}
          </h3>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail"
            className="text-xl text-[#404E3B]"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          <div className="grid gap-3 md:grid-cols-2">
            {/* Nomor surat hanya muncul untuk pengajuan yang sudah terverifikasi */}
            {nomorSurat && <Field label="Nomor surat" value={nomorSurat} />}

            <Field label="Status">
              <StatusBadge status={item.status} />
            </Field>

            <Field label="Nama" value={item.nama} />
            <Field label="NIM" value={item.nim} />
            <Field label="Departemen" value={item.departemen} />
            <Field label="Perusahaan tujuan" value={item.instansi} />
            <Field label="Alamat perusahaan" value={item.alamat} />

            <Field
              label="Pelaksanaan"
              value={`${formatTanggal(item.tanggal_mulai)} s.d. ${formatTanggal(item.tanggal_selesai)}`}
            />
          </div>

          {status === "ditolak" && item.catatan_revisi && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              <b>Catatan revisi:</b>
              <p className="mt-1 whitespace-pre-line">{item.catatan_revisi}</p>
            </div>
          )}

          {BERKAS_WAJIB.map((jenis) => {
            const berkas = item.daftarBerkas.find((b) => b.jenis === jenis);

            return berkas ? (
              <FilePreview key={jenis} berkas={berkas} />
            ) : (
              <BerkasKosong key={jenis} label={LABEL_BERKAS[jenis]} />
            );
          })}

          {verified && suratMagang && <FilePreview berkas={suratMagang} />}

          {error && (
            <div
              role="alert"
              className="whitespace-pre-line rounded-lg bg-red-100 p-3 text-sm font-semibold text-red-800"
            >
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#BAC8B1] bg-white px-6 py-4">
          {status === "menunggu" && (
            <>
              <Button variant="danger" disabled={busy} onClick={tolak}>
                Tolak / minta revisi
              </Button>

              <Button variant="primary" disabled={busy} onClick={verifikasi}>
                {busy ? "Memproses..." : "Verifikasi pengajuan"}
              </Button>
            </>
          )}

          {verified && suratMagang && (
            <Button
              variant="primary"
              onClick={() =>
                window.open(suratMagang.preview_url, "_blank", "noopener")
              }
            >
              Buka / cetak surat pengantar
            </Button>
          )}

          <Button onClick={onClose}>Tutup</Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// HALAMAN ADMIN
// =====================================================

const TAB = [
  { value: "menunggu_verifikasi", label: "Menunggu verifikasi" },
  { value: "setuju", label: "Disetujui" },
  { value: "revisi", label: "Direvisi" },
  { value: "", label: "Seluruh data" },
];

const KOLOM = [
  "No.",
  "No. surat",
  "Nama / NIM",
  "Departemen",
  "Perusahaan tujuan",
  "Pelaksanaan",
  "Status",
  "Aksi",
];

const JUMLAH_AWAL = { menunggu_verifikasi: 0, setuju: 0, revisi: 0 };

const META_AWAL = {
  current_page: 1,
  last_page: 1,
  total: 0,
  from: null,
  to: null,
};

export default function AdminPage() {
  const [list, setList] = useState([]);
  const [meta, setMeta] = useState(META_AWAL);
  const [jumlah, setJumlah] = useState(JUMLAH_AWAL);
  const [opsiDep, setOpsiDep] = useState([]);

  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("menunggu_verifikasi");
  const [filterDep, setFilterDep] = useState("");
  const [cari, setCari] = useState("");
  const [q, setQ] = useState("");
  const [versi, setVersi] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pesanDetail, setPesanDetail] = useState("");
  const [membukaId, setMembukaId] = useState(null);
  const [selected, setSelected] = useState(null);

  // Pencarian berjalan 400 ms setelah berhenti mengetik
  useEffect(() => {
    const timer = setTimeout(() => {
      const baru = cari.trim();

      if (baru !== q) {
        setPage(1);
        setQ(baru);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [cari, q]);

  // Daftar pengajuan: dimuat ulang saat halaman, tab, departemen, atau pencarian berubah
  useEffect(() => {
    let dibatalkan = false;

    async function ambil() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({ page, per_page: PER_PAGE });

        if (filterStatus) params.set("status", filterStatus);
        if (filterDep) params.set("departemen", filterDep);
        if (q) params.set("q", q);

        const response = await panggilApi(`${ENDPOINT.daftar}?${params}`);

        if (dibatalkan) return;

        const metaBaru = response.meta ?? META_AWAL;

        // Halaman terakhir bisa berkurang (misalnya data berpindah status)
        if (metaBaru.last_page >= 1 && page > metaBaru.last_page) {
          setPage(metaBaru.last_page);
          return;
        }

        setList(
          toArray(response).map(normalisasiPengajuan).sort(urutkanPengajuan)
        );
        setMeta(metaBaru);
      } catch (err) {
        if (!dibatalkan) setError(err.message);
      } finally {
        if (!dibatalkan) setLoading(false);
      }
    }

    ambil();

    return () => {
      dibatalkan = true;
    };
  }, [page, filterStatus, filterDep, q, versi]);

  // Jumlah per tab (mengikuti pencarian dan departemen) dan daftar departemen
  useEffect(() => {
    let dibatalkan = false;

    async function ambilJumlah() {
      const params = new URLSearchParams();

      if (filterDep) params.set("departemen", filterDep);
      if (q) params.set("q", q);

      try {
        const response = await panggilApi(`${ENDPOINT.ringkasan}?${params}`);

        if (dibatalkan) return;

        const { departemen = [], ...hitungan } = unwrap(response);

        setJumlah({ ...JUMLAH_AWAL, ...hitungan });

        if (Array.isArray(departemen) && departemen.length > 0) {
          setOpsiDep(
            departemen
              .map(bentukDepartemen)
              .filter((d) => d.kode && d.kode !== "-")
          );
        }
      } catch {
        // Cadangan jika endpoint ringkasan belum ada di backend
        try {
          const hasil = await Promise.all(
            Object.keys(JUMLAH_AWAL).map(async (status) => {
              const p = new URLSearchParams(params);

              p.set("status", status);
              p.set("per_page", 1);

              const r = await panggilApi(`${ENDPOINT.daftar}?${p}`);

              return [status, r.meta?.total ?? 0];
            })
          );

          if (!dibatalkan) setJumlah(Object.fromEntries(hasil));
        } catch {
          // jumlah hanya pelengkap, error utama ditampilkan oleh daftar
        }
      }
    }

    ambilJumlah();

    return () => {
      dibatalkan = true;
    };
  }, [q, filterDep, versi]);

  async function bukaDetail(id) {
    setPesanDetail("");
    setMembukaId(id);

    try {
      const response = await panggilApi(ENDPOINT.detail(id));
      const detail = unwrap(response);

      setSelected(normalisasiPengajuan(detail?.pengajuan ?? detail));
    } catch (err) {
      setPesanDetail(err.message);
    } finally {
      setMembukaId(null);
    }
  }

  function handleUpdated(updated) {
    setSelected((previous) =>
      previous?.id === updated.id ? { ...previous, ...updated } : previous
    );

    // muat ulang daftar dan jumlah agar sesuai tab yang sedang aktif
    setVersi((v) => v + 1);
  }

  function pilihTab(value) {
    setPage(1);
    setFilterStatus(value);
  }

  function pilihDepartemen(value) {
    setPage(1);
    setFilterDep(value);
  }

  function resetPencarian() {
    setCari("");
    setQ("");
    setFilterDep("");
    setPage(1);
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  const total = jumlah.menunggu_verifikasi + jumlah.setuju + jumlah.revisi;
  const hitung = (value) => (value === "" ? total : jumlah[value] ?? 0);
  const adaPencarian = Boolean(q || cari || filterDep);

  // Nomor urut berlanjut antar halaman (halaman 2 mulai dari 21, dst.)
  const nomorAwal = meta.from ?? (meta.current_page - 1) * PER_PAGE + 1;

  // Pilihan departemen: dari backend, atau dari data yang sedang dimuat sebagai cadangan
  const sumberDep =
    opsiDep.length > 0
      ? opsiDep
      : list.map((item) => ({
          kode: item.departemenKode,
          nama: item.departemen,
        }));

  const pilihanDep = [
    ...new Map(
      [
        ...sumberDep,
        filterDep ? { kode: filterDep, nama: namaDepartemen(filterDep) } : null,
      ]
        .filter((d) => d && d.kode && d.kode !== "-")
        .map((d) => [d.kode, d])
    ).values(),
  ].sort((a, b) => a.nama.localeCompare(b.nama, "id"));

  return (
    <div className="flex min-h-screen flex-col bg-[#E6E6E6] text-[#404E3B]">
      <header className="border-b border-gray-300 bg-white">
        <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between gap-4 px-6 py-4 2xl:px-0">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#404E3B] text-base font-bold text-[#E6E6E6]">
              SM
            </span>

            <span className="text-2xl font-bold">SIMAGANG</span>

            <span className="rounded-full bg-[#DDEBD5] px-4 py-1 text-sm font-semibold">
              Admin
            </span>
          </div>

          <Button variant="primary" className="!px-5 !py-3" onClick={logout}>
            Log Out
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1680px] flex-1 px-6 py-14 2xl:px-0">
        <h1 className="text-center text-4xl font-bold">
          Dashboard verifikasi admin
        </h1>

        <p className="mb-10 mt-3 text-center text-lg">
          Periksa data dan berkas mahasiswa, lalu terbitkan surat pengantar
          magang.
        </p>

        <section className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6E6E6] px-9 py-7">
            <h2 className="text-2xl font-bold">Daftar pengajuan</h2>

            <div className="flex flex-wrap gap-3 text-base font-medium">
              <span className="rounded-full bg-[#FDEFC3] px-5 py-1.5 text-[#8A5A00]">
                {jumlah.menunggu_verifikasi} menunggu
              </span>

              <span className="rounded-full bg-[#D9F2D9] px-5 py-1.5 text-[#1F6B2E]">
                {jumlah.setuju} terverifikasi
              </span>

              <span className="rounded-full bg-[#FDE2E2] px-5 py-1.5 text-[#B42318]">
                {jumlah.revisi} revisi
              </span>
            </div>
          </div>

          <div
            role="tablist"
            className="flex gap-8 overflow-x-auto border-b border-[#E6E6E6] px-9"
          >
            {TAB.map((tab) => {
              const aktif = filterStatus === tab.value;

              return (
                <button
                  key={tab.value || "semua"}
                  type="button"
                  role="tab"
                  aria-selected={aktif}
                  onClick={() => pilihTab(tab.value)}
                  className={`-mb-px flex items-center gap-3 whitespace-nowrap border-b-[3px] px-1 py-5 text-lg transition ${
                    aktif
                      ? "border-[#404E3B] font-semibold"
                      : "border-transparent opacity-75 hover:opacity-100"
                  }`}
                >
                  {tab.label}

                  <span
                    className={`rounded-full px-3 py-0.5 text-sm font-bold ${
                      aktif
                        ? "bg-[#404E3B] text-[#E6E6E6]"
                        : "bg-[#E6E6E6]"
                    }`}
                  >
                    {hitung(tab.value)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 px-9 py-6">
            <label className="relative min-w-[260px] flex-1">
              <span className="sr-only">Cari pengajuan</span>

              <IconCari className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 opacity-70" />

              <input
                type="search"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari nama, NIM, perusahaan, no. surat..."
                className="w-full rounded-xl border border-[#404E3B] bg-white py-3.5 pl-14 pr-4 text-base outline-none focus:ring-2 focus:ring-[#BAC8B1]"
              />
            </label>

            <div className="relative min-w-[280px]">
              <select
                value={filterDep}
                onChange={(e) => pilihDepartemen(e.target.value)}
                aria-label="Filter departemen"
                className="w-full cursor-pointer appearance-none rounded-xl border border-[#404E3B] bg-white py-3.5 pl-5 pr-12 text-base outline-none focus:ring-2 focus:ring-[#BAC8B1]"
              >
                <option value="">Semua departemen</option>

                {pilihanDep.map((dep) => (
                  <option key={dep.kode} value={dep.kode}>
                    {dep.nama}
                  </option>
                ))}
              </select>

              <IconPanah className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2" />
            </div>

            {adaPencarian && (
              <Button className="!py-3.5" onClick={resetPencarian}>
                Reset
              </Button>
            )}
          </div>

          {pesanDetail && (
            <div
              role="alert"
              className="mx-9 mb-4 whitespace-pre-line rounded-lg bg-red-100 p-3 text-sm font-semibold text-red-800"
            >
              {pesanDetail}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#E6E6E6]">
                <tr>
                  {KOLOM.map((heading) => (
                    <th
                      key={heading}
                      className={`px-6 py-4 text-sm font-semibold uppercase tracking-wide first:pl-9 last:pr-9 ${
                        heading === "No." ? "text-center" : ""
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#E6E6E6]">
                {loading && (
                  <tr>
                    <td
                      colSpan={KOLOM.length}
                      className="px-6 py-14 text-center text-base"
                    >
                      Memuat data pengajuan...
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td
                      colSpan={KOLOM.length}
                      className="whitespace-pre-line px-6 py-14 text-center text-base text-red-700"
                    >
                      {error}

                      <div className="mt-3">
                        <Button onClick={() => setVersi((v) => v + 1)}>
                          Coba lagi
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && !error && list.length === 0 && (
                  <tr>
                    <td
                      colSpan={KOLOM.length}
                      className="px-6 py-14 text-center text-base"
                    >
                      Tidak ada pengajuan yang cocok.
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  list.map((item, index) => {
                    const nomorSurat = nomorSuratTampil(item);

                    return (
                      <tr key={item.id}>
                        <td className="w-20 px-6 py-4 pl-9 text-center tabular-nums">
                          {nomorAwal + index}
                        </td>

                        <td className="whitespace-nowrap px-6 py-4 font-bold tabular-nums">
                          {nomorSurat ?? (
                            <span className="font-normal opacity-40">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <b>{item.nama || "-"}</b>
                          <div className="text-xs opacity-70">
                            {item.nim || "-"}
                          </div>
                        </td>

                        <td className="px-6 py-4">{item.departemen || "-"}</td>

                        <td className="px-6 py-4">{item.instansi || "-"}</td>

                        <td className="px-6 py-4 text-xs">
                          {formatTanggal(item.tanggal_mulai)}
                          <br />
                          s.d. {formatTanggal(item.tanggal_selesai)}
                        </td>

                        <td className="px-6 py-4">
                          <StatusBadge status={item.status} />
                        </td>

                        <td className="px-6 py-4 pr-9">
                          <Button
                            className="!px-4 !py-2"
                            disabled={membukaId === item.id}
                            onClick={() => bukaDetail(item.id)}
                          >
                            {membukaId === item.id ? "Memuat..." : "Detail"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6E6E6] px-9 py-5 text-sm">
            <span className="opacity-70">
              {meta.total > 0
                ? `Menampilkan ${meta.from ?? 0}–${meta.to ?? 0} dari ${meta.total} pengajuan`
                : "Tidak ada data"}
            </span>

            {meta.last_page > 1 && (
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  className="!px-3 !py-1.5"
                  disabled={loading || meta.current_page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Sebelumnya
                </Button>

                {daftarHalaman(meta.current_page, meta.last_page).map(
                  (n, i) =>
                    n === "..." ? (
                      <span key={`titik-${i}`} className="px-2">
                        …
                      </span>
                    ) : (
                      <button
                        key={n}
                        type="button"
                        disabled={loading}
                        onClick={() => setPage(n)}
                        className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-bold transition ${
                          n === meta.current_page
                            ? "border-[#404E3B] bg-[#404E3B] text-[#E6E6E6]"
                            : "border-[#BAC8B1] text-[#404E3B] hover:bg-[#BAC8B1]"
                        }`}
                      >
                        {n}
                      </button>
                    )
                )}

                <Button
                  className="!px-3 !py-1.5"
                  disabled={loading || meta.current_page >= meta.last_page}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-[#404E3B] px-6 py-8 text-sm leading-7 text-[#E6E6E6]">
        <div className="mx-auto w-full max-w-[1680px] 2xl:px-0">
          <b>SIMAGANG</b> — Sistem Informasi Magang Kampus
          <br />
          Fakultas Kehutanan dan Lingkungan IPB
        </div>
      </footer>

      {selected && (
        <DetailModal
          key={selected.id}
          item={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}