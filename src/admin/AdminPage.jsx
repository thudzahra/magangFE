import { useEffect, useState } from "react";
import {
  Badge, Button, Card, Modal, ModalBody, ModalFooter, ModalHeader,
  Navbar, NavbarBrand, NavbarCollapse, NavbarLink, NavbarToggle,
  Spinner, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow,
} from "flowbite-react";
import { logout } from "./auth";
import { getPengajuan, verifikasiPengajuan, tolakPengajuan } from "./adminApi";
import { Link } from "react-router-dom";

const tgl = (d) =>
  d ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d)) : "-";

const STATUS = {
  menunggu: { label: "Menunggu verifikasi", cls: "bg-mint text-jade border border-sage" },
  terverifikasi: { label: "Terverifikasi", cls: "bg-jade text-mint" },
  ditolak: { label: "Ditolak", cls: "bg-red-100 text-red-800" },
};
const StatusBadge = ({ s }) => (
  <Badge className={`w-fit rounded-full px-3 ${STATUS[s]?.cls}`}>{STATUS[s]?.label}</Badge>
);

// Tombol: Flowbite Button + warna palet (twMerge menimpa warna bawaan)
const BTN = {
  primary: "bg-mint text-jade border border-jade hover:bg-sage hover:text-white enabled:hover:bg-sage",
  light: "bg-paper text-jade border border-sage hover:bg-mint enabled:hover:bg-mint",
  danger: "bg-paper text-red-800 border border-red-800 hover:bg-red-100 enabled:hover:bg-red-100",
};
const Btn = ({ v = "light", ...p }) => <Button color="light" className={BTN[v]} {...p} />;

function FilePreview({ title, url }) {
  if (!url) return null;
  const isPdf = /\.pdf(\?|$)/i.test(url);
  return (
    <div className="overflow-hidden rounded-xl border border-sage bg-paper">
      <div className="flex justify-between border-b border-sage px-4 py-3 text-sm">
        <strong>{title}</strong>
        <a href={url} target="_blank" rel="noreferrer" className="underline">Buka di tab baru</a>
      </div>
      {isPdf
        ? <iframe src={url} title={title} className="h-[480px] w-full" />
        : <img src={url} alt={title} className="max-h-[520px] w-full bg-white object-contain" />}
    </div>
  );
}

function Surat({ d }) {
  return (
    <div id="surat-print" className="rounded-xl bg-white p-8 text-sm leading-relaxed text-black">
      <div className="mb-5 flex justify-between gap-4 border-b-2 border-black pb-3">
        <div>
          <small>KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI</small>
          <h2 className="text-2xl font-bold">INSTITUT PERTANIAN BOGOR</h2>
          <span>FAKULTAS KEHUTANAN DAN LINGKUNGAN</span>
        </div>
        <div className="text-right text-xs">
          Kampus IPB Dramaga, Bogor 16680<br />Telepon (0251) 8621677<br />fahutan@apps.ipb.ac.id
        </div>
      </div>
      <div className="mb-3 flex justify-between">
        <div>Nomor : {d.nomor_surat}<br />Hal &nbsp;&nbsp;&nbsp;&nbsp;: Pengantar Magang</div>
        <span>Bogor, {tgl(d.tanggal_surat)}</span>
      </div>
      <p className="mb-3">Yth. Direktur <b>{d.instansi}</b><br />{d.alamat}</p>
      <p className="mb-3">
        Dalam rangka meningkatkan keterampilan dan pemahaman mahasiswa Fakultas Kehutanan dan Lingkungan IPB
        tentang Kehutanan dan dunia kerja, disampaikan dengan hormat bahwa mahasiswa Fakultas Kehutanan dan
        Lingkungan Institut Pertanian Bogor berikut ini:
      </p>
      <div className="mb-3 ml-3">
        Nama &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {d.nama}<br />
        NIM &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {d.nim}<br />
        Departemen : {d.departemen}
      </div>
      <p className="mb-3">
        Bermaksud untuk melaksanakan Magang di {d.instansi} pada tanggal {tgl(d.tanggal_mulai)} – {tgl(d.tanggal_selesai)}.
        Sehubungan dengan hal tersebut, kami mohon Saudara berkenan menerima mahasiswa kami untuk melaksanakan magang tersebut.
      </p>
      <p>Demikian atas perhatian dan kerjasamanya, diucapkan terima kasih.</p>
      <div className="ml-auto mt-8 w-72">
        <div>{d.pejabat?.jabatan ?? "Wakil Dekan Bidang Akademik, Kemahasiswaan dan Alumni"}</div>
        {d.ttd_pejabat_url ? <img src={d.ttd_pejabat_url} alt="TTD" className="h-[70px]" /> : <div className="h-[70px]" />}
        <u>{d.pejabat?.nama}</u>
        <div>NIP {d.pejabat?.nip}</div>
      </div>
    </div>
  );
}

const Field = ({ k, v, children }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-sage bg-paper px-4 py-3 text-sm">
    <span className="opacity-70">{k}</span>
    {children ?? <b className="text-right font-semibold">{v || "-"}</b>}
  </div>
);

function DetailModal({ item, onClose, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const verified = item.status === "terverifikasi";

  const act = async (fn) => {
    setBusy(true); setErr("");
    try { onUpdated(await fn()); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const tolak = () => {
    const alasan = window.prompt("Alasan penolakan (opsional):");
    if (alasan !== null) act(() => tolakPengajuan(item.id, alasan));
  };

  return (
    <Modal show onClose={onClose} size="4xl" popup={false}>
      <ModalHeader className="bg-paper text-jade">
        Pengajuan {item.no_registrasi ?? "(diterbitkan setelah tanda tangan)"} — {item.nama}
      </ModalHeader>
      <ModalBody className="space-y-5 bg-bg">
        {verified ? <Surat d={item} /> : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <Field k="No. registrasi" v={item.no_registrasi ?? "(diterbitkan setelah tanda tangan)"} />
              <Field k="Status"><StatusBadge s={item.status} /></Field>
              <Field k="Nama" v={item.nama} />
              <Field k="NIM" v={item.nim} />
              <Field k="Departemen" v={item.departemen} />
              <Field k="Perusahaan" v={item.instansi} />
              <Field k="Alamat magang" v={item.alamat} />
              <Field k="Pelaksanaan" v={`${tgl(item.tanggal_mulai)} s.d. ${tgl(item.tanggal_selesai)}`} />
              <Field k="Tanda tangan">{item.tanda_tangan_url && <img src={item.tanda_tangan_url} alt="TTD siswa" className="max-h-12" />}</Field>
              <Field k="Barcode">{item.barcode_url && <img src={item.barcode_url} alt="Barcode" className="max-h-12" />}</Field>
            </div>
            <FilePreview title="Surat rekomendasi" url={item.surat_rekomendasi_url} />
            <FilePreview title="Bukti SPP" url={item.bukti_spp_url} />
          </>
        )}
        {err && <p className="font-semibold text-red-700">{err}</p>}
      </ModalBody>
      <ModalFooter className="justify-end bg-paper">
        {verified ? (
          <Btn v="primary" onClick={() => window.print()}>🖨 Cetak surat</Btn>
        ) : item.status === "menunggu" && (
          <>
            <Btn v="danger" disabled={busy} onClick={tolak}>Tolak</Btn>
            <Btn v="primary" disabled={busy} onClick={() => act(() => verifikasiPengajuan(item.id))}>
              ✓ Verifikasi & terbitkan surat
            </Btn>
          </>
        )}
        <Btn onClick={onClose}>Tutup</Btn>
      </ModalFooter>
    </Modal>
  );
}

export default function AdminPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    getPengajuan().then(setList).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const handleUpdated = (u) => {
    setList((p) => p.map((x) => (x.id === u.id ? u : x)));
    setSelected(u);
  };
  const count = (s) => list.filter((x) => x.status === s).length;

  return (
    <div className="flex min-h-screen flex-col bg-bg text-jade">
      <Navbar fluid className="border-b border-sage bg-paper">
        <NavbarBrand>
          <span className="mr-2 rounded-lg bg-jade px-2 py-1 text-sm font-bold text-mint">SM</span>
          <span className="text-lg font-extrabold">SIMAKA</span>
        </NavbarBrand>
        <NavbarToggle />
        <NavbarCollapse>
         <NavbarCollapse>
  <NavbarLink as={Link} to="/form-pengajuan" className="text-jade">Pengajuan</NavbarLink>
  <NavbarLink as={Link} to="/form-pengajuan#alur" className="text-jade">Alur</NavbarLink>
  <NavbarLink as={Link} to="/dashboard-admin" active className="rounded-lg bg-mint !text-jade md:!bg-mint">Halaman admin</NavbarLink>
</NavbarCollapse>
        </NavbarCollapse>
        <Btn v="primary" className="hidden md:block" onClick={logout}>Keluar</Btn>
      </Navbar>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <h1 className="text-center text-3xl font-bold">Dashboard verifikasi admin</h1>
        <p className="mb-8 mt-2 text-center opacity-75">
          Periksa data dan berkas mahasiswa, lalu terbitkan surat pengantar magang.
        </p>

        <Card className="border-sage bg-paper shadow-lg [&>div]:p-0">
          <div className="flex items-center justify-between px-7 py-5">
            <h2 className="text-xl font-bold">Daftar pengajuan</h2>
            <div className="flex gap-2">
              <Badge className="rounded-full bg-mint text-jade">{count("menunggu")} menunggu</Badge>
              <Badge className="rounded-full bg-jade text-mint">{count("terverifikasi")} terverifikasi</Badge>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHead className="[&>tr>th]:bg-bg [&>tr>th]:text-jade">
                <TableRow>
                  {["No. registrasi", "Nama / NIM", "Departemen", "Perusahaan tujuan", "Pelaksanaan", "Status", "Aksi"].map((h) => (
                    <TableHeadCell key={h}>{h}</TableHeadCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody className="divide-y divide-bg">
                {loading && <TableRow className="bg-paper"><TableCell colSpan={7} className="text-center"><Spinner color="success" /></TableCell></TableRow>}
                {error && <TableRow className="bg-paper"><TableCell colSpan={7} className="text-center text-red-700">{error}</TableCell></TableRow>}
                {!loading && !error && list.length === 0 && (
                  <TableRow className="bg-paper"><TableCell colSpan={7} className="text-center">Belum ada pengajuan.</TableCell></TableRow>
                )}
                {list.map((x) => (
                  <TableRow key={x.id} className="bg-paper text-jade">
                    <TableCell className="font-bold text-jade">{x.no_registrasi ?? "(diterbitkan setelah tanda tangan)"}</TableCell>
                    <TableCell><b>{x.nama}</b><div className="text-xs opacity-70">{x.nim}</div></TableCell>
                    <TableCell>{x.departemen}</TableCell>
                    <TableCell>{x.instansi}</TableCell>
                    <TableCell className="text-xs">{tgl(x.tanggal_mulai)}<br />s.d. {tgl(x.tanggal_selesai)}</TableCell>
                    <TableCell><StatusBadge s={x.status} /></TableCell>
                    <TableCell><Btn size="sm" onClick={() => setSelected(x)}>Detail & verifikasi</Btn></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </main>

      <footer className="flex flex-wrap justify-between gap-6 bg-jade px-6 py-8 text-sm leading-7 text-bg md:px-[max(1.5rem,calc((100%-72rem)/2))]">
        <div><b>SIMAKA</b> — Sistem Informasi Magang Kampus<br />Fakultas Kehutanan dan Lingkungan IPB</div>
        <div>Layanan: Senin–Jumat, 08.00–16.00 WIB<br />Email: fahutan@apps.ipb.ac.id</div>
      </footer>

      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />}
    </div>
  );
}