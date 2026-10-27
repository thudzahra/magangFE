import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Button, FileInput, Label, Textarea, TextInput } from "flowbite-react";

const API = "http://10.7.102.23:8000/api";

const ENDPOINT = {
  buat: "/pengajuan-magang",
  ubah: (id) => `/pengajuan-magang/${id}`,
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

export default function FormPengajuan() {
  const navigate = useNavigate();
  const user = getUser();
  const pengajuanId = useRef(null);
  const snapshotDraft = useRef("");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    nama: user.name || "",
    nim: (user.nim || "").toUpperCase(),
    departemen: departemenDariNim(user.nim),
    instansi: "", alamat_instansi: "", tanggal_mulai: "", tanggal_selesai: "",
    bukti_spp: null, surat_rekomendasi: null,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [disetujui, setDisetujui] = useState(false);
  const [menyetujui, setMenyetujui] = useState(false);
  const [versiPreview, setVersiPreview] = useState(0);
  const [preview, setPreview] = useState({ src: "", srcDoc: "", loading: false, error: "" });

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
    const data = {
      nama: form.nama.trim(),
      nim: form.nim.trim(),
      departemen: form.departemen,
      instansi: form.instansi.trim(),
      alamat_instansi: form.alamat_instansi.trim(),
      tanggal_mulai: form.tanggal_mulai,
      tanggal_selesai: form.tanggal_selesai,
    };
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
      navigate("/pengajuan-saya");
    } catch (err) {
      setMsg({ type: "no", text: pesanDariError(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E6E6E6] text-[#404E3B]">
      <header className="border-b border-[#BAC8B1] bg-white">
        <div className="flex items-center justify-between gap-4 px-6 py-3 lg:px-40">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#404E3B] text-sm font-bold text-[#E6E6E6]">SM</span>
            <span className="text-lg font-bold">SIMAGANG</span>
          </div>
          <Link
            to="/login"
            className="rounded-lg bg-[#404E3B] px-4 py-2 text-sm font-bold text-[#E6E6E6] transition hover:bg-[#BAC8B1] hover:text-[#404E3B]"
          >
            Log Out
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-center text-3xl font-bold">Formulir pengajuan</h1>
        <p className="mb-8 mt-2 text-center text-[#404E3B]">Pastikan semua data terisi dengan benar sebelum mengirim.</p>

        <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
          <div className="bg-gradient-to-r from-[#404E3B] to-[#7B9669] px-6 py-6 text-[#E6E6E6] sm:px-8">
            <h2 className="text-xl font-bold">Formulir pengajuan surat pengantar magang</h2>
            <p className="mt-1 text-sm">Lengkapi 4 langkah berikut. Surat akan diverifikasi admin sebelum diterbitkan resmi.</p>
          </div>

          <div className="p-6 sm:p-8">
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
                  className="border-0 bg-[#404E3B] font-bold text-[#E6E6E6] hover:bg-[#BAC8B1] hover:text-[#404E3B]"
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
      </main>
    </div>
  );
}