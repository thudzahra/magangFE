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
  detail: (id) => `/admin/pengajuan-magang/${id}`,
  status: (id) => `/admin/pengajuan-magang/${id}/status`,
};

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
      data.message ||
        validationErrors ||
        `Request gagal (${response.status}).`
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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

// Normalisasi status untuk tampilan.
// Sesuaikan dengan nilai yang benar-benar dikirim backend.
// Mengambil teks dari string atau object { value, label }.
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
    label: "Ditolak / perlu revisi",
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
// KOMPONEN TOMBOL DAN FIELD
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

// =====================================================
// PREVIEW BERKAS
// =====================================================

function FilePreview({ title, url }) {
  if (!url) {
    return (
      <div className="rounded-xl border border-[#BAC8B1] bg-white p-4 text-sm">
        <b>{title}</b>
        <p className="mt-2 text-gray-500">Berkas belum tersedia.</p>
      </div>
    );
  }

  const isPdf = /\.pdf(?:\?.*)?$/i.test(url);

  return (
    <div className="overflow-hidden rounded-xl border border-[#BAC8B1] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#BAC8B1] px-4 py-3 text-sm">
        <strong>{title}</strong>

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Buka berkas
        </a>
      </div>

      {isPdf ? (
        <iframe
          src={url}
          title={title}
          className="h-[480px] w-full"
        />
      ) : (
        <img
          src={url}
          alt={title}
          className="max-h-[520px] w-full bg-white object-contain"
        />
      )}
    </div>
  );
}

// =====================================================
// PREVIEW SURAT
// =====================================================

function Surat({ data }) {
  return (
    <div
      id="surat-print"
      className="rounded-xl bg-white p-8 text-sm leading-relaxed text-black"
    >
      <div className="mb-5 flex justify-between gap-4 border-b-2 border-black pb-3">
        <div>
          <small>
            KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI
          </small>

          <h2 className="text-2xl font-bold">
            INSTITUT PERTANIAN BOGOR
          </h2>

          <span>FAKULTAS KEHUTANAN DAN LINGKUNGAN</span>
        </div>

        <div className="text-right text-xs">
          Kampus IPB Dramaga, Bogor 16680
          <br />
          Telepon (0251) 8621677
          <br />
          fahutan@apps.ipb.ac.id
        </div>
      </div>

      <div className="mb-3 flex justify-between gap-4">
        <div>
          Nomor: {data.nomor_surat || data.no_registrasi || "-"}
          <br />
          Hal: Pengantar Magang
        </div>

        <span>Bogor, {formatTanggal(data.tanggal_surat)}</span>
      </div>

      <p className="mb-3">
        Yth. Direktur <b>{data.instansi}</b>
        <br />
        {data.alamat ?? data.alamat_instansi}
      </p>

      <p className="mb-3">
        Dalam rangka meningkatkan keterampilan dan pemahaman mahasiswa
        Fakultas Kehutanan dan Lingkungan IPB tentang kehutanan dan dunia
        kerja, disampaikan dengan hormat bahwa mahasiswa Fakultas Kehutanan
        dan Lingkungan Institut Pertanian Bogor berikut ini:
      </p>

      <div className="mb-3 ml-3">
        Nama: {data.nama}
        <br />
        NIM: {data.nim}
        <br />
        Departemen: {data.departemen}
      </div>

      <p className="mb-3">
        Bermaksud untuk melaksanakan magang di {data.instansi} pada tanggal{" "}
        {formatTanggal(data.tanggal_mulai)} sampai{" "}
        {formatTanggal(data.tanggal_selesai)}. Sehubungan dengan hal
        tersebut, kami mohon Saudara berkenan menerima mahasiswa kami untuk
        melaksanakan magang tersebut.
      </p>

      <p>Demikian atas perhatian dan kerja samanya, diucapkan terima kasih.</p>

      <div className="ml-auto mt-8 w-72">
        <div>
          {data.pejabat?.jabatan ??
            "Wakil Dekan Bidang Akademik, Kemahasiswaan dan Alumni"}
        </div>

        {data.ttd_pejabat_url ? (
          <img
            src={data.ttd_pejabat_url}
            alt="Tanda tangan pejabat"
            className="h-[70px]"
          />
        ) : (
          <div className="h-[70px]" />
        )}

        <u>{data.pejabat?.nama}</u>
        <div>NIP {data.pejabat?.nip}</div>
      </div>
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

      onUpdated(pengajuan);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function verifikasi() {
    // Pastikan nilai ini sesuai validasi AdminPengajuanController Laravel.
    kirimStatus({ status: "setuju" });
  }

  function tolak() {
    const alasan = window.prompt("Alasan penolakan atau revisi (opsional):");

    if (alasan !== null) {
      // Pastikan field catatan sesuai validasi backend.
      kirimStatus({
        status: "revisi",
        catatan: alasan,
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[#E6E6E6] shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#BAC8B1] bg-white px-6 py-4">
          <h3 className="font-bold text-[#404E3B]">
            Pengajuan{" "}
            {item.no_registrasi ?? "(nomor belum tersedia)"} — {item.nama}
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
          {verified ? (
            <Surat data={item} />
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Nomor registrasi"
                  value={item.no_registrasi}
                />

                <Field label="Status">
                  <StatusBadge status={item.status} />
                </Field>

                <Field label="Nama" value={item.nama} />
                <Field label="NIM" value={item.nim} />
                <Field label="Departemen" value={item.departemen} />
                <Field label="Instansi" value={item.instansi} />

                <Field
                  label="Alamat magang"
                  value={item.alamat ?? item.alamat_instansi}
                />

                <Field
                  label="Pelaksanaan"
                  value={`${formatTanggal(item.tanggal_mulai)} s.d. ${formatTanggal(item.tanggal_selesai)}`}
                />

                <Field label="Tanda tangan mahasiswa">
                  {item.tanda_tangan_url ? (
                    <img
                      src={item.tanda_tangan_url}
                      alt="Tanda tangan mahasiswa"
                      className="max-h-12"
                    />
                  ) : (
                    <span>-</span>
                  )}
                </Field>

                <Field label="Barcode">
                  {item.barcode_url ? (
                    <img
                      src={item.barcode_url}
                      alt="Barcode pengajuan"
                      className="max-h-12"
                    />
                  ) : (
                    <span>-</span>
                  )}
                </Field>
              </div>

              <FilePreview
                title="Surat rekomendasi"
                url={item.surat_rekomendasi_url}
              />

              <FilePreview
                title="Bukti pembayaran SPP"
                url={item.bukti_spp_url}
              />
            </>
          )}

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
          {verified ? (
            <Button variant="primary" onClick={() => window.print()}>
              Cetak surat
            </Button>
          ) : (
            status === "menunggu" && (
              <>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={tolak}
                >
                  Tolak / minta revisi
                </Button>

                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={verifikasi}
                >
                  {busy ? "Memproses..." : "Verifikasi pengajuan"}
                </Button>
              </>
            )
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

export default function AdminPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

 async function ambilPengajuan() {
  setLoading(true);
  setError("");

  try {
    const response = await panggilApi(ENDPOINT.daftar);

    console.log("RESPONS API PENGAJUAN:", response);

    const data = toArray(response);

    const normalized = data.map((item) => ({
      ...item,

      // Data mahasiswa berasal dari object mahasiswa.
      nama: item.mahasiswa?.nama ?? item.nama ?? "-",

      nim: item.mahasiswa?.nim ?? item.nim ?? "-",

      departemen:
        typeof item.mahasiswa?.departemen === "object"
          ? item.mahasiswa.departemen?.nama ??
            item.mahasiswa.departemen?.kode ??
            "-"
          : item.mahasiswa?.departemen ??
            item.departemen ??
            "-",

      // Status backend berbentuk { value, label }.
      status:
        typeof item.status === "object"
          ? item.status?.value ?? "menunggu"
          : item.status ?? "menunggu",

      // Nomor registrasi belum dikirim backend.
      no_registrasi:
        item.no_registrasi ??
        item.nomor_registrasi ??
        item.no_regis ??
        "-",
    }));

    setList(normalized);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    ambilPengajuan();
  }, []);

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  function handleUpdated(updated) {
    setList((previous) =>
      previous.map((item) =>
        item.id === updated.id ? { ...item, ...updated } : item
      )
    );

    setSelected((previous) =>
      previous?.id === updated.id
        ? { ...previous, ...updated }
        : previous
    );
  }

  const count = (status) =>
    list.filter((item) => normalisasiStatus(item.status) === status).length;

  return (
    <div className="flex min-h-screen flex-col bg-[#E6E6E6] text-[#404E3B]">
      <header className="border-b border-gray-300 bg-white">
        <div className="flex items-center justify-between gap-4 px-6 py-3 lg:px-40">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#404E3B] text-sm font-bold text-[#E6E6E6]">
              SM
            </span>

            <span className="text-lg font-bold">SIMAGANG</span>
          </div>

          <Button variant="primary" onClick={logout}>
            Log Out
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <h1 className="text-center text-3xl font-bold">
          Dashboard verifikasi admin
        </h1>

        <p className="mb-8 mt-2 text-center opacity-75">
          Periksa data dan berkas mahasiswa, lalu verifikasi pengajuan
          magang.
        </p>

        <div className="rounded-2xl bg-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-5">
            <h2 className="text-xl font-bold">Daftar pengajuan</h2>

            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-[#BAC8B1] px-3 py-1">
                {count("menunggu")} menunggu
              </span>

              <span className="rounded-full bg-[#404E3B] px-3 py-1 text-[#E6E6E6]">
                {count("terverifikasi")} terverifikasi
              </span>

              <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">
                {count("ditolak")} ditolak
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#E6E6E6]">
                <tr>
                  {[
                    "No. registrasi",
                    "Nama / NIM",
                    "Departemen",
                    "Instansi tujuan",
                    "Pelaksanaan",
                    "Status",
                    "Aksi",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#E6E6E6]">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center">
                      Memuat data pengajuan...
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td
                      colSpan={7}
                      className="whitespace-pre-line px-4 py-6 text-center text-red-700"
                    >
                      {error}

                      <div className="mt-3">
                        <Button onClick={ambilPengajuan}>
                          Coba lagi
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && !error && list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center">
                      Belum ada pengajuan.
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  list.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-bold">
                        {item.no_registrasi || "-"}
                      </td>

                      <td className="px-4 py-3">
                        <b>{item.nama || "-"}</b>
                        <div className="text-xs opacity-70">
                          {item.nim || "-"}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {item.departemen || "-"}
                      </td>

                      <td className="px-4 py-3">
                        {item.instansi || "-"}
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {formatTanggal(item.tanggal_mulai)}
                        <br />
                        s.d. {formatTanggal(item.tanggal_selesai)}
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>

                      <td className="px-4 py-3">
                        <Button
                          className="!px-3 !py-1.5"
                          onClick={async () => {
                            setError("");

                            try {
                              const response = await panggilApi(
                                ENDPOINT.detail(item.id)
                              );

                              setSelected(unwrap(response));
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          Detail
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="bg-[#404E3B] px-6 py-8 text-sm leading-7 text-[#E6E6E6] lg:px-40">
        <b>SIMAGANG</b> — Sistem Informasi Magang Kampus
        <br />
        Fakultas Kehutanan dan Lingkungan IPB
      </footer>

      {selected && (
        <DetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}