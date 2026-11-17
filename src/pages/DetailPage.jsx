import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BERKAS_OPSIONAL,
  BerkasKosong,
  Button,
  ENDPOINT,
  FilePreview,
  formatTanggal,
  LABEL_BERKAS,
  NAMA_DEPARTEMEN,
  namaDepartemen,
  normalisasiPengajuan,
  normalisasiStatus,
  nomorSuratTampil,
  panggilApi,
  PATH_DAFTAR,
  StatusBadge,
  tanggalUntukInput,
  unwrap,
  URUTAN_BERKAS,
} from "./AdminPage";

// Kalau di routes/api.php kamu pakai Route::put, ganti jadi "PUT".
const METHOD_EDIT = "PATCH";

// =====================================================
// ISI HALAMAN DETAIL, EDIT, DAN VERIFIKASI
// =====================================================

const DEPARTEMEN_DARI_NIM = {
  E141: "MNH",
  E241: "THH",
  E341: "KSHE",
  E441: "SVK",
};

// Anggota kelompok dari API: array of {nama, nim} (atau string / JSON string).
function ambilAnggota(item) {
  let data = item.anggota;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      data = [];
    }
  }

  if (!Array.isArray(data)) return [];

  return data.map((a) =>
    typeof a === "string"
      ? { nama: a, nim: "" }
      : { ...a, nama: a?.nama ?? a?.name ?? "", nim: a?.nim ?? "" }
  );
}

function formAwal(item) {
  return {
    nama: item.nama === "-" ? "" : item.nama ?? "",
    nim: item.nim === "-" ? "" : item.nim ?? "",
    departemen: item.departemenKode === "-" ? "" : item.departemenKode ?? "",
    instansi: item.instansi ?? "",
    alamat_instansi:
      item.alamat_instansi ?? (item.alamat === "-" ? "" : item.alamat ?? ""),
    tanggal_mulai: tanggalUntukInput(item.tanggal_mulai),
    tanggal_selesai: tanggalUntukInput(item.tanggal_selesai),
    // Instansi kedua (kosong bila pengajuan hanya punya satu instansi)
    instansi2: item.tempat2?.instansi ?? "",
    alamat_instansi2: item.tempat2?.alamat_instansi ?? "",
    tanggal_mulai2: tanggalUntukInput(item.tempat2?.tanggal_mulai),
    tanggal_selesai2: tanggalUntukInput(item.tempat2?.tanggal_selesai),
    anggota: ambilAnggota(item),
  };
}

const INPUT =
  "w-full rounded-lg border border-[#BAC8B1] bg-white px-3 py-2.5 text-sm font-semibold text-[#404E3B] outline-none focus:border-[#404E3B] focus:ring-2 focus:ring-[#BAC8B1] disabled:opacity-60";

// Kartu pengelompok form: judul + isi
function Section({ judul, keterangan, children }) {
  return (
    <section className="rounded-2xl border border-[#BAC8B1] bg-white">
      <div className="border-b border-[#E6E6E6] px-5 py-3.5 sm:px-6">
        <h2 className="font-bold">{judul}</h2>
        {keterangan && (
          <p className="mt-0.5 text-xs text-[#5b6b55]">{keterangan}</p>
        )}
      </div>

      <div className="space-y-6 p-5 sm:p-6">{children}</div>
    </section>
  );
}

// Satu kolom: label di atas, lalu input (mode edit) atau teks (mode lihat)
function Kolom({ label, edit, value, children, className = "" }) {
  return (
    <div className={`min-w-0 ${className}`}>
      {edit ? (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium opacity-70">{label}</span>
          {children}
        </label>
      ) : (
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium opacity-70">{label}</span>
          <b className="break-words font-semibold">{value || "-"}</b>
        </div>
      )}
    </div>
  );
}

function DetailContent({ item, onClose, onUpdated, opsiDepartemen = [] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sukses, setSukses] = useState("");

  const [form, setForm] = useState(() => formAwal(item));

  const status = normalisasiStatus(item.status);
  const verified = status === "terverifikasi";
  // Data bisa langsung diubah selama belum disetujui.
  const edit = status === "menunggu" || status === "ditolak";
  const nomorSurat = nomorSuratTampil(item);
  const suratMagang = item.daftarBerkas.find((b) => b.jenis === "surat-magang");
  const suratMagang2 = item.daftarBerkas.find(
    (b) => b.jenis === "surat-magang-kedua"
  );

  const awal = formAwal(item);
  const berubah =
    edit &&
    Object.keys(awal).some(
      (k) => JSON.stringify(awal[k]) !== JSON.stringify(form[k])
    );

  function resetForm() {
    setError("");
    setSukses("");
    setForm(formAwal(item));
  }

  const ubah = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // NIM huruf besar, maksimal 11 karakter; departemen ikut berubah sesuai awalan NIM.
  const ubahNim = (e) => {
    const nim = e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 11);
    const kode = DEPARTEMEN_DARI_NIM[nim.slice(0, 4)];

    setForm((f) => ({ ...f, nim, ...(kode ? { departemen: kode } : {}) }));
  };

  const adaKelompok = awal.anggota.length > 0 || form.anggota.length > 0;
  const daftarAnggota = edit ? form.anggota : awal.anggota;

  const ubahAnggota = (i, key, nilai) =>
    setForm((f) => ({
      ...f,
      anggota: f.anggota.map((a, idx) =>
        idx === i ? { ...a, [key]: nilai } : a
      ),
    }));

  const ubahNimAnggota = (i) => (e) =>
    ubahAnggota(
      i,
      "nim",
      e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 11)
    );

  const tambahAnggota = () =>
    setForm((f) => ({ ...f, anggota: [...f.anggota, { nama: "", nim: "" }] }));

  const hapusAnggota = (i) =>
    setForm((f) => ({ ...f, anggota: f.anggota.filter((_, idx) => idx !== i) }));

  const pilihanDepartemen = [
    ...new Map(
      [
        ...opsiDepartemen,
        ...Object.entries(NAMA_DEPARTEMEN).map(([kode, nama]) => ({
          kode,
          nama,
        })),
        form.departemen
          ? { kode: form.departemen, nama: namaDepartemen(form.departemen) }
          : null,
      ]
        .filter(Boolean)
        .map((d) => [d.kode, d])
    ).values(),
  ].sort((a, b) => a.nama.localeCompare(b.nama, "id"));

  async function simpanEdit() {
    setError("");
    setSukses("");

    const nama = form.nama.trim();
    const nim = form.nim.trim();
    const instansi = form.instansi.trim();
    const alamat = form.alamat_instansi.trim();

    if (!nama || !nim || !form.departemen) {
      setError("Nama, NIM, dan departemen wajib diisi.");
      return;
    }

    if (!instansi || !alamat) {
      setError("Perusahaan tujuan dan alamat wajib diisi.");
      return;
    }

    if (!form.tanggal_mulai || !form.tanggal_selesai) {
      setError("Tanggal mulai dan tanggal selesai wajib diisi.");
      return;
    }

    if (form.tanggal_selesai < form.tanggal_mulai) {
      setError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      return;
    }

    if (
      adaKelompok &&
      form.anggota.some((a) => !String(a.nama).trim() || !String(a.nim).trim())
    ) {
      setError("Nama dan NIM setiap anggota kelompok wajib diisi.");
      return;
    }

    if (item.tempat2) {
      if (!form.instansi2.trim() || !form.alamat_instansi2.trim()) {
        setError("Perusahaan tujuan 2 dan alamatnya wajib diisi.");
        return;
      }

      if (!form.tanggal_mulai2 || !form.tanggal_selesai2) {
        setError("Tanggal mulai dan selesai perusahaan 2 wajib diisi.");
        return;
      }

      if (form.tanggal_selesai2 < form.tanggal_mulai2) {
        setError("Tanggal selesai perusahaan 2 tidak boleh sebelum tanggal mulainya.");
        return;
      }
    }

    setBusy(true);

    try {
      const response = await panggilApi(ENDPOINT.edit(item.id), {
        method: METHOD_EDIT,
        body: {
          nama,
          nim,
          departemen: form.departemen,
          instansi,
          alamat_instansi: alamat,
          tanggal_mulai: form.tanggal_mulai,
          tanggal_selesai: form.tanggal_selesai,
          ...(adaKelompok
            ? {
                anggota: form.anggota.map((a) => ({
                  ...a,
                  nama: String(a.nama).trim(),
                  nim: String(a.nim).trim(),
                })),
              }
            : {}),
          ...(item.tempat2
            ? {
                instansi_kedua: form.instansi2.trim(),
                alamat_instansi_kedua: form.alamat_instansi2.trim(),
                tanggal_mulai_kedua: form.tanggal_mulai2,
                tanggal_selesai_kedua: form.tanggal_selesai2,
              }
            : {}),
        },
      });

      const updated = unwrap(response);
      const pengajuan = updated?.pengajuan ?? updated;

      if (!pengajuan || pengajuan.id == null) {
        throw new Error(
          "Data tersimpan, tetapi respons pengajuan tidak dikenali. Muat ulang halaman untuk memeriksa data."
        );
      }

      const baru = normalisasiPengajuan(pengajuan);

      onUpdated(baru);
      setForm(formAwal({ ...item, ...baru }));
      setSukses(response?.message || "Data pengajuan berhasil diperbarui.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function kirimStatus(body) {
    setBusy(true);
    setError("");
    setSukses("");

    try {
      const response = await panggilApi(ENDPOINT.status(item.id), {
        method: "PATCH",
        body,
      });

      const updated = unwrap(response);
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

  // sufiks "" = instansi 1, "2" = instansi 2 (sesuai key di form)
  function blokInstansi(sufiks, tampil) {
    const key = (nama) => `${nama}${sufiks}`;

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Kolom label="Perusahaan tujuan" edit={edit} value={tampil.instansi}>
          <input
            className={INPUT}
            value={form[key("instansi")]}
            onChange={ubah(key("instansi"))}
            disabled={busy}
          />
        </Kolom>

        <Kolom label="Alamat perusahaan" edit={edit} value={tampil.alamat}>
          <input
            className={INPUT}
            value={form[key("alamat_instansi")]}
            onChange={ubah(key("alamat_instansi"))}
            disabled={busy}
          />
        </Kolom>

        <Kolom
          label="Tanggal mulai"
          edit={edit}
          value={formatTanggal(tampil.mulai)}
        >
          <input
            type="date"
            className={INPUT}
            value={form[key("tanggal_mulai")]}
            onChange={ubah(key("tanggal_mulai"))}
            disabled={busy}
          />
        </Kolom>

        <Kolom
          label="Tanggal selesai"
          edit={edit}
          value={formatTanggal(tampil.selesai)}
        >
          <input
            type="date"
            className={INPUT}
            value={form[key("tanggal_selesai")]}
            min={form[key("tanggal_mulai")] || undefined}
            onChange={ubah(key("tanggal_selesai"))}
            disabled={busy}
          />
        </Kolom>
      </div>
    );
  }

  function kembali() {
    if (berubah && !window.confirm("Ada perubahan yang belum disimpan. Tetap kembali?")) {
      return;
    }

    onClose();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#E6E6E6] text-[#404E3B] antialiased">
      {/* HEADER */}
      <header className="sticky top-0 z-20 border-b border-[#BAC8B1] bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
          <Button onClick={kembali}>← Kembali</Button>

          <h1 className="truncate font-bold">
            Pengajuan #{item.id} — {item.nama}
          </h1>
        </div>
      </header>

      {/* ISI */}
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6 sm:px-6">
        {/* Status */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[#BAC8B1] bg-white px-5 py-3 text-sm">
          <span className="flex items-center gap-2">
            <span className="opacity-70">Status</span>
            <StatusBadge status={item.status} />
          </span>

          {nomorSurat && (
            <span className="flex items-center gap-2">
              <span className="opacity-70">Nomor surat</span>
              <b className="tabular-nums">{nomorSurat}</b>
            </span>
          )}
        </div>

        {status === "ditolak" && item.catatan_revisi && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <b>Catatan revisi:</b>
            <p className="mt-1 whitespace-pre-line">{item.catatan_revisi}</p>
          </div>
        )}

        {/* 1. Data diri */}
        <Section
          judul={adaKelompok ? "1. Data diri dan kelompok" : "1. Data diri"}
          keterangan={
            edit
              ? "Perubahan nama, NIM, dan departemen juga mengubah data akun mahasiswa."
              : undefined
          }
        >
          <div className="space-y-4">
            {adaKelompok && <h3 className="text-sm font-bold">Ketua kelompok</h3>}
          <div className="grid gap-4 md:grid-cols-2">
            <Kolom label="Nama" edit={edit} value={item.nama}>
              <input
                className={INPUT}
                value={form.nama}
                onChange={ubah("nama")}
                disabled={busy}
              />
            </Kolom>

            <Kolom label="NIM" edit={edit} value={item.nim}>
              <input
                className={INPUT}
                value={form.nim}
                onChange={ubahNim}
                maxLength={11}
                disabled={busy}
              />
            </Kolom>

            <Kolom
              label="Departemen"
              edit={edit}
              value={item.departemen}
              className="md:col-span-2"
            >
              <select
                className={INPUT}
                value={form.departemen}
                onChange={ubah("departemen")}
                disabled={busy}
              >
                <option value="">Pilih departemen</option>
                {pilihanDepartemen.map((dep) => (
                  <option key={dep.kode} value={dep.kode}>
                    {dep.nama}
                  </option>
                ))}
              </select>
            </Kolom>
          </div>
          </div>

          {adaKelompok && (
            <div className="space-y-4 border-t border-[#E6E6E6] pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-bold">
                  Anggota kelompok ({daftarAnggota.length} orang)
                </h3>

                {edit && (
                  <Button
                    className="!px-3 !py-1.5"
                    disabled={busy}
                    onClick={tambahAnggota}
                  >
                    + Tambah anggota
                  </Button>
                )}
              </div>

              {daftarAnggota.length === 0 && (
                <p className="text-sm text-[#5b6b55]">Belum ada anggota.</p>
              )}

              {daftarAnggota.map((a, i) => (
                <div
                  key={i}
                  className={`grid items-end gap-3 ${
                    edit
                      ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                      : "md:grid-cols-2"
                  }`}
                >
                  <Kolom label={`Nama anggota ${i + 1}`} edit={edit} value={a.nama}>
                    <input
                      className={INPUT}
                      value={a.nama}
                      onChange={(e) => ubahAnggota(i, "nama", e.target.value)}
                      disabled={busy}
                    />
                  </Kolom>

                  <Kolom label={`NIM anggota ${i + 1}`} edit={edit} value={a.nim}>
                    <input
                      className={INPUT}
                      value={a.nim}
                      onChange={ubahNimAnggota(i)}
                      maxLength={11}
                      disabled={busy}
                    />
                  </Kolom>

                  {edit && (
                    <Button
                      variant="danger"
                      className="!py-2.5"
                      disabled={busy}
                      onClick={() => hapusAnggota(i)}
                    >
                      Hapus
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 2. Instansi */}
        <Section
          judul="2. Instansi tujuan"
          keterangan={
            edit
              ? "Surat pengantar dibuat dari data terbaru saat pengajuan diverifikasi."
              : undefined
          }
        >
          {item.tempat2 ? (
            <>
              <div className="space-y-4">
                <h3 className="text-sm font-bold">Instansi 1</h3>
                {blokInstansi("", {
                  instansi: item.instansi,
                  alamat: item.alamat,
                  mulai: item.tanggal_mulai,
                  selesai: item.tanggal_selesai,
                })}
              </div>

              <div className="space-y-4 border-t border-[#E6E6E6] pt-6">
                <h3 className="text-sm font-bold">Instansi 2</h3>
                {blokInstansi("2", {
                  instansi: item.tempat2.instansi,
                  alamat: item.tempat2.alamat_instansi,
                  mulai: item.tempat2.tanggal_mulai,
                  selesai: item.tempat2.tanggal_selesai,
                })}
              </div>
            </>
          ) : (
            blokInstansi("", {
              instansi: item.instansi,
              alamat: item.alamat,
              mulai: item.tanggal_mulai,
              selesai: item.tanggal_selesai,
            })
          )}
        </Section>

        {/* 3. Berkas */}
        <Section judul="3. Berkas">
        {URUTAN_BERKAS.map((jenis) => {
          const berkas = item.daftarBerkas.find((b) => b.jenis === jenis);

          if (berkas) return <FilePreview key={jenis} berkas={berkas} />;
          if (BERKAS_OPSIONAL.includes(jenis)) return null;

          return <BerkasKosong key={jenis} label={LABEL_BERKAS[jenis]} />;
        })}

        {verified && suratMagang && <FilePreview berkas={suratMagang} />}

        {verified && suratMagang2 && <FilePreview berkas={suratMagang2} />}
        </Section>

        {sukses && (
          <div
            role="status"
            className="rounded-lg bg-[#D9F2D9] p-3 text-sm font-semibold text-[#1F6B2E]"
          >
            {sukses}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="whitespace-pre-line rounded-lg bg-red-100 p-3 text-sm font-semibold text-red-800"
          >
            {error}
          </div>
        )}
      </main>

      {/* TOMBOL AKSI (menempel di bawah layar) */}
      <div className="sticky bottom-0 z-20 border-t border-[#BAC8B1] bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-end gap-2 px-4 py-4 sm:px-6">
          {berubah && (
            <span className="mr-auto text-xs font-semibold text-[#8A5A00]">
              Ada perubahan yang belum disimpan. Simpan dulu sebelum verifikasi.
            </span>
          )}

          {edit && (
            <>
              <Button disabled={busy || !berubah} onClick={resetForm}>
                Reset
              </Button>

              <Button
                variant="primary"
                disabled={busy || !berubah}
                onClick={simpanEdit}
              >
                {busy ? "Menyimpan..." : "Simpan perubahan"}
              </Button>
            </>
          )}

          {status === "menunggu" && (
            <>
              <Button variant="danger" disabled={busy || berubah} onClick={tolak}>
                Tolak / minta revisi
              </Button>

              <Button
                variant="primary"
                disabled={busy || berubah}
                onClick={verifikasi}
              >
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
        </div>
      </div>
    </div>
  );
}

// =====================================================
// HALAMAN DETAIL (route: /dashboard-admin/pengajuan/:id)
// =====================================================

export default function DetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let batal = false;

    setLoading(true);
    setError("");

    panggilApi(ENDPOINT.detail(id))
      .then((response) => {
        if (batal) return;

        const detail = unwrap(response);

        setItem(normalisasiPengajuan(detail?.pengajuan ?? detail));
      })
      .catch((err) => {
        if (!batal) setError(err.message);
      })
      .finally(() => {
        if (!batal) setLoading(false);
      });

    return () => {
      batal = true;
    };
  }, [id]);

  const kembali = () => navigate(PATH_DAFTAR);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#E6E6E6] text-[#404E3B]">
        Memuat data pengajuan...
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#E6E6E6] p-6 text-center">
        <p className="whitespace-pre-line text-red-700">
          {error || "Pengajuan tidak ditemukan."}
        </p>

        <Button onClick={kembali}>← Kembali ke daftar</Button>
      </div>
    );
  }

  return (
    <DetailContent
      key={item.id}
      item={item}
      onClose={kembali}
      onUpdated={(baru) => setItem((prev) => ({ ...prev, ...baru }))}
    />
  );
}