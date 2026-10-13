# Unifikasi Manajemen Sesi & Integrasi Silabus ke Jurnal

## Ringkasan Proyek
Menyatukan seluruh pengelolaan operasional sesi pembelajaran ke dalam satu halaman utama bernama **Jurnal** (menggantikan dan menyempurnakan `PresensiView.tsx`), mengubah `JournalView.tsx` lama menjadi **`SyllabusView.tsx`** yang berfokus sebagai penampil alur silabus berorientasi baca (*read-only* seperti direktori Guru, Mapel, dan Buku), serta menyederhanakan dialog **"Isi Presensi"** (`AttendanceModal.tsx`) menjadi ringkas dengan integrasi penyesuaian silabus mendalam ke `SyllabusScopeModal.tsx`.

---

## User Review & Critical Decisions (Menjawab Feedback Pengguna)

### 1. Evaluasi Penyimpanan Capaian: `attnd_meeting` vs `syllabus_scopes.adjustment`
- **Keputusan**: **Memindahkan riwayat capaian riil ke `attnd_meeting`**.
- **Alasan**:
  - `syllabus_scopes.adjustment` mengunci checkpoint pada indeks statis (`checkpointSessionIndex`). Jika ada pertemuan yang dibatalkan (`cancelled`) atau jadwal bergeser, indeks numerik menjadi rapuh dan rawan inkonsisten.
  - Sebaliknya, `attnd_meeting` adalah entitas sesi nyata pada tanggal tertentu. Saat presensi disimpan, rekaman pertemuan menyimpan capaian riil:
    - `actual_unit_id` (unit/bab yang dibahas pada sesi ini)
    - `actual_page` (halaman terakhir yang diselesaikan)
  - Mesin silabus (`pacingEngine`) secara otomatis mengambil **pertemuan selesai terakhir (`completed`)** untuk kombinasi mapel & kelas tersebut, lalu melanjutkan proyeksi sesi berikutnya dari halaman tersebut.
  - Sesi yang dibatalkan (`cancelled`) secara otomatis dilewati dari kalender instruksional, sehingga materi kurikulum tidak terbuang melainkan bergulir ke pertemuan aktif berikutnya.

---

### 2. Fitur Pembatalan Sesi Instan (Ikon `X`) & Penomoran Ulang Otomatis (*Auto Re-Numbering*)
- **Aksi Cepat pada Kartu Sesi Jurnal**:
  - Setiap kartu pertemuan pada panel harian Jurnal dilengkapi tombol ikon `X` (*Batalkan Sesi*).
  - Mengklik ikon `X` langsung mengubah status pertemuan menjadi `'cancelled'` (atau toggle kembali via tombol `[↺ Pulihkan]` jika keliru).
- **Penomoran Ulang Otomatis**:
  - Sesi berstatus `'cancelled'` **tidak menghitung nomor sesi instruksional** (ditampilkan dengan tanda muted/abu-abu `Dibatalkan`).
  - Seluruh sesi aktif setelahnya otomatis bergeser urutannya (#1, #2, #3, ...) tanpa ada lubang dan tanpa mengharuskan guru menghitung manual.

---

### 3. Form Materi Minimal pada Pop-up "Isi Presensi" (`AttendanceModal.tsx`)
Sesuai arahan, seksi pencatatan materi dibuat **sangat ringkas dan alami**:
- **Hanya 2 Field**:
  1. **Materi**: Judul Bab / Unit Pembelajaran (pilihan dropdown unit buku dengan default target hari ini).
  2. **Halaman (`hal`)**: Nomor halaman terakhir yang diselesaikan santri (angka input dengan default target halaman hari ini).
- **Prinsip Bebas Beban Pikiran**:
  - Keduanya otomatis terisi (*default*) sesuai target silabus sesi tersebut. Guru hanya perlu mengoreksi jika capaian kelas lebih cepat atau lebih lambat dari target.
  - Disimpan bersamaan dengan daftar presensi santri dan kehadiran guru saat tombol utama **"Simpan Presensi & Jurnal"** (*record button*) ditekan.

---

### 4. Penempatan Tombol Deep-Link Penyesuaian Silabus
- **Dipindahkan dari Modal Presensi ke Kartu Utama Sesi (Main Card / Parent Div)**:
  - Tombol deep-link `[Penyesuaian Silabus]` diletakkan langsung pada **kartu sesi harian di Jurnal** (di samping atau di bawah info sesi, berdampingan dengan tombol `[Isi Presensi]`).
  - Tombol ini membuka **`SyllabusScopeModal`** yang langsung memuat mata pelajaran dan kelas terkait.

---

### 5. Integrasi Opsi Penyesuaian Makro ke `SyllabusScopeModal.tsx`
- Pengaturan kurikulum yang lebih dalam (seperti strategi percepat laju atau daftar bab yang dipangkas/dilewati `cutUnitIds`) diintegrasikan rapi ke dalam **`SyllabusScopeModal`**.
- Dengan demikian, dialog harian "Isi Presensi" tetap bersih, cepat, dan fokus pada presensi serta 2 field capaian materi (`materi` & `hal`).

---

## Arsitektur Alur & Antarmuka

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            NAVIGASI APLIKASI (Header)                       │
│   [Beranda]    [Jadwal]    [Kaldik]    [JURNAL] (Utama)   ▼ Menu Tambahan   │
│                                                            (Silabus, dll.)  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             JURNAL (JournalView)                            │
│  (Refaktor dari PresensiView.tsx)                                           │
│  - Kalender Bulanan & Indikator Keterisian Sesi                             │
│  - Tombol [Jadwalkan Pertemuan]                                             │
│  - Panel Harian: Daftar Sesi KBM Terjadwal                                  │
│                                                                             │
│  ┌─ Kartu Sesi KBM (Main Card) ──────────────────────────────────────────┐  │
│  │  #3 • 08:00 - 09:30 • Fiqih (Safinah) • Kelas 1A • Ust. Ahmad         │  │
│  │  Target Hari Ini: Bab Thaharah (Hal. 1-4)                             │  │
│  │                                                                       │  │
│  │  [Isi Presensi]      [Penyesuaian Silabus] ──► Buka SyllabusScopeModal │  │
│  │                      [X Batalkan Sesi]     ──► Auto Re-number sesi     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ Klik [Isi Presensi]
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    POP-UP "ISI PRESENSI" (AttendanceModal)                  │
│                                                                             │
│  ┌─ Header: Sesi Pembelajaran ────────────────────────────────────────────┐  │
│  │  Pertemuan Ke-#3 (Otomatis) • Fiqih • Kelas 1A                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌─ SEKSI 1: Kehadiran Pengajar ──────────────────────────────────────────┐  │
│  │  Status Guru (Hadir/Izin/Sakit/Alpa), Jam Masuk, Catatan               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌─ SEKSI 2: Capaian Materi (MINIMAL: 2 FIELD) ───────────────────────────┐  │
│  │  Materi:  [ Bab Thaharah                 ▼ ] (default: target sesi)    │  │
│  │  Hal:     [ 4                              ] (default: target sesi)    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌─ SEKSI 3: Lembar Roll-Call Santri ─────────────────────────────────────┐  │
│  │  Set Semua Hadir, Checklist Hadir/Izin/Sakit/Terlambat/Alpa            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌─ Footer & Aksi ────────────────────────────────────────────────────────┐  │
│  │  [Batal]                             [SIMPAN PRESENSI & JURNAL]        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼ Simpan Sekaligus
                         `attnd_meeting` (Database)
                         - status: 'completed'
                         - actual_unit_id: 'unit-thaharah'
                         - actual_page: 4
                         - attnd_meeting_log (santri)
```

---

## Proposed Changes

### 1. Database & Tipe Data (`src/types/index.ts` & `src/server/db/schema.ts`)
- Menambahkan field capaian pembelajaran pada `attnd_meeting`:
  - `actual_unit_id?: string`
  - `actual_page?: number`
  - `notes?: string` (menyimpan catatan atau metadata json jika diperlukan)
- Menambahkan status `'cancelled'` pada `MeetingStatus` (`'scheduled' | 'in_progress' | 'completed' | 'cancelled'`).

### 2. Penataan Ulang Komponen & File
- **`src/components/attendance/PresensiView.tsx`** di-rename / di-refactor menjadi **`src/components/journal/JournalView.tsx`** (atau `src/components/JournalView.tsx`).
- **`src/components/JournalView.tsx`** lama di-rename / di-refactor menjadi **`src/components/syllabus/SyllabusView.tsx`**:
  - Disederhanakan menjadi penampil silabus berorientasi baca (*read-only*), menampilkan visualisasi alur bab, distribusi halaman per sesi, dan metrik laju.
- **Navigasi Utama (`Header.tsx` & `App.tsx`)**:
  - Tab menu utama dinamakan **Jurnal** (`activeTab === 'journal'`).
  - Menu tambahan/dropdown memuat **Silabus** (`activeTab === 'syllabus'`).

### 3. Logika Sesi Harian & Pembatalan di `JournalView`
- Pada render kartu sesi harian:
  - Menyediakan tombol ikon `X` (*Batalkan Sesi*) dan tombol pulihkan (*Undo*).
  - Mengimplementasikan penomoran urut dinamis (*auto-numbering*): hanya sesi non-batal yang diberi nomor urut `#1, #2, #3, ...`.
  - Tombol deep-link `[Penyesuaian Silabus]` pada kartu sesi untuk membuka `SyllabusScopeModal` dengan subjek & kelas terkait.

### 4. Dialog Presensi Minimalis (`AttendanceModal.tsx`)
- Mengisi otomatis nilai awal:
  - `materi`: unit target sesi ini.
  - `hal`: halaman target sesi ini.
- Merampingkan form menjadi 2 input bersih (*Unit* dan *Halaman Selesai*).
- Menghilangkan input manual nomor pertemuan dan opsi pemangkasan silabus dari pop-up ini.
- Menyimpan nilai `actual_unit_id` dan `actual_page` langsung ke rekaman pertemuan saat tombol simpan diklik.

### 5. Integrasi Penyesuaian ke `SyllabusScopeModal.tsx`
- Menampilkan opsi pemangkasan unit (`cutUnitIds`) dan strategi akselerasi jika silabus memerlukan penyesuaian khusus.
- Membaca capaian terakhir dari `attnd_meeting` yang selesai agar proyeksi di modal selalu sinkron dengan kenyataan kelas.

### 6. Sinkronisasi Mesin Pacing (`src/utils/pacingEngine.ts`)
- Memperbarui generator silabus untuk:
  - Melewati pertemuan berstatus `'cancelled'`.
  - Mengambil titik start dari `actual_page` pada pertemuan berstatus `'completed'` terbaru.

---

## Verification Plan

### 1. Uji Coba Alur Pembatalan Sesi (Ikon `X`) & Auto Re-numbering
- Buka tanggal dengan beberapa sesi di halaman Jurnal.
- Klik ikon `X` pada salah satu sesi.
- Pastikan status sesi berubah menjadi "Dibatalkan" dan nomor urut sesi-sesi setelahnya otomatis bergeser mundur secara instan.
- Klik `[↺ Pulihkan]`, pastikan nomor urut kembali tersusun rapi.

### 2. Uji Coba Deep Link Penyesuaian Silabus
- Klik tombol `[Penyesuaian Silabus]` pada kartu sesi di Jurnal.
- Pastikan `SyllabusScopeModal` terbuka dengan mapel dan kelas yang sesuai.

### 3. Uji Coba Pengisian Presensi Minimalis
- Klik `[Isi Presensi]` pada sesi aktif.
- Periksa bahwa field `Materi` dan `Hal` otomatis terisi target sesi tersebut.
- Ubah nomor halaman (misal: selesai di hal. 6) dan simpan presensi.
- Buka menu Silabus: pastikan pertemuan berikutnya otomatis melanjutkan dari hal. 7.

### 4. Kompilasi & Linter
- Jalankan `compile_applet` untuk memastikan tidak ada eror TypeScript.
- Jalankan `lint_applet` untuk menjamin kerapian kode dan kepatuhan aturan.
