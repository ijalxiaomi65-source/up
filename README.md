# 🤖 Zeechei Bot

Bot Discord all-in-one dengan Node.js + discord.js v14 — moderation, welcome/goodbye, auto-role, ticket system, games, economy, leveling, anti-spam, anti-raid, logging, **music player (YouTube/Spotify/SoundCloud + autoplay)**, dan sistem owner/admin lengkap.

Tanpa `.env`, tanpa database eksternal (MongoDB/MySQL), tanpa web dashboard — murni Discord bot yang bisa langsung dijalankan dengan `node index.js`.

---

## 📁 Struktur Project

```
zeechei-discord-bot/
├── index.js
├── package.json
├── settings.js
├── database/
│   └── database.json
├── commands/
│   ├── admin/
│   ├── moderation/
│   ├── utility/
│   ├── fun/
│   ├── games/
│   ├── economy/
│   └── music/
├── events/
├── handlers/
└── utils/
```

---

## 1️⃣ Cara Membuat Discord Bot

1. Buka https://discord.com/developers/applications
2. Klik **New Application**, beri nama (misalnya `Zeechei Bot`).
3. Masuk ke tab **Bot** di sidebar kiri → klik **Add Bot** (atau **Reset Token**).
4. Di halaman Bot, aktifkan **Privileged Gateway Intents**:
   - `SERVER MEMBERS INTENT` ✅ (wajib untuk welcome/autorole)
   - `MESSAGE CONTENT INTENT` ✅ (wajib untuk anti-spam, leveling, game berbasis chat)

## 2️⃣ Cara Mengambil Bot Token

Masih di tab **Bot**, klik **Reset Token** → **Copy**. Token ini bersifat rahasia, jangan dibagikan ke siapa pun. Simpan di `settings.js` pada bagian `token`.

Untuk **Client ID** (dibutuhkan untuk registrasi slash command & link invite), buka tab **General Information** dan salin **Application ID**. Isi di `settings.js` pada bagian `clientId`.

## 3️⃣ Cara Mendapatkan Owner Discord ID

1. Aktifkan Developer Mode terlebih dahulu (lihat langkah 4 di bawah).
2. Klik kanan pada nama/avatar kamu di Discord → **Copy User ID**.
3. Tempel ID tersebut ke `settings.js` pada array `ownerIds`.

## 4️⃣ Cara Mengaktifkan Developer Mode

Discord (Desktop/Web): **User Settings** → **Advanced** → aktifkan **Developer Mode**.
Discord (Mobile): **Settings** → **Behavior** → aktifkan **Developer Mode**.

## 5️⃣ Cara Mengundang Bot ke Server

Gunakan URL berikut (ganti `CLIENT_ID` dengan Application ID kamu):

```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Atau setelah bot online, jalankan command `/invite` untuk mendapatkan link ini otomatis.

> Permission `8` = Administrator (paling mudah untuk testing). Untuk production, sesuaikan permission sesuai kebutuhan (lihat bagian **Permission Bot** di bawah).

## 6️⃣ Cara Konfigurasi `settings.js`

Buka `settings.js` dan isi minimal:

```js
token: "TOKEN_BOT_KAMU",
clientId: "CLIENT_ID_BOT_KAMU",
ownerIds: ["ID_DISCORD_KAMU"],
```

Field lain (welcome, autoRole, logs, ticket, economy, leveling, antiSpam, antiRaid, dll) bersifat opsional dan bisa diatur lewat command `/config` setelah bot online, atau diisi manual di file ini.

> **Tips:** saat development, isi `guildId` dengan ID server testing kamu agar slash command langsung muncul (instan). Kosongkan (`""`) untuk register global (bisa memakan waktu hingga 1 jam untuk muncul di semua server).

## 7️⃣ Cara Menjalankan Bot

```bash
npm install
npm start
```

Atau langsung:

```bash
node index.js
```

Jika berhasil, akan muncul log seperti:

```
[INFO] Berhasil memuat 56 command.
[INFO] Berhasil memuat 7 event.
[INFO] Zeechei Bot#1234 sudah online!
```

## 8️⃣ Cara Deploy ke Pterodactyl

1. Buat server baru di Pterodactyl dengan egg **Node.js** (Generic / Yolks Node.js).
2. Upload seluruh isi folder project ini ke direktori server (via SFTP/File Manager), **kecuali** folder `node_modules` (biar diinstall otomatis).
3. Set **Startup Command** ke:
   ```
   npm install && npm start
   ```
   atau jika egg sudah otomatis `npm install`, cukup:
   ```
   node index.js
   ```
4. Pastikan **Docker Image** menggunakan Node.js versi 18 ke atas.
5. Edit `settings.js` langsung di file manager Pterodactyl (isi token, clientId, ownerIds).
6. Klik **Start**. Bot akan online tanpa perlu web dashboard/port khusus.

## 9️⃣ Cara Deploy ke Railway.com

1. Push seluruh isi folder project ini (kecuali `node_modules`, sudah ada di `.gitignore`) ke repo GitHub kamu.
2. Di [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → pilih repo ini.
3. Railway otomatis mendeteksi ini project Node.js (lewat Nixpacks) dan menjalankan `npm install` lalu `npm start` — tidak perlu konfigurasi build tambahan.
4. Isi `settings.js` **sebelum** push (token, clientId, ownerIds), **atau** pakai environment variable Railway kalau kamu sudah ubah `settings.js` untuk baca dari `process.env` (bot ini secara default baca langsung dari `settings.js`, bukan `.env` — paling simpel edit `settings.js` langsung sebelum push, asal jangan commit token ke repo publik).
5. Tunggu build selesai, cek tab **Deployments → View Logs**, harus muncul log yang sama seperti menjalankan lokal (`Bot sudah online!`).
6. **Khusus fitur music/YouTube di Railway:** lihat bagian *Troubleshooting* di bawah — Railway itu hosting cloud (IP data-center), jadi tetap bisa kena deteksi bot YouTube seperti hosting cloud lain. Konfigurasi default di `settings.js` (`music.youtube`) sudah disiapkan untuk kondisi ini, tidak perlu setup tambahan di Railway-nya sendiri (tidak perlu install Deno/dsb — bot otomatis pakai Node.js yang memang sudah ada di container Railway).
7. Railway bawaannya tidak butuh port terbuka untuk bot Discord (bukan web server) — kalau Railway menampilkan warning "no exposed port", abaikan saja, itu normal untuk bot Discord.

## 🔟 Cara Deploy ke Render.com

Sejak versi ini, `settings.js` sudah dibuat baca `token`, `clientId`, `guildId`, `ownerIds` dari **Environment Variable** (`process.env`), bukan dari isi file — jadi kamu **tidak perlu edit `settings.js` sama sekali** untuk deploy, tinggal isi nilainya di dashboard Render.

1. Push seluruh isi folder ini ke repo GitHub kamu (token TIDAK ada lagi di `settings.js`, jadi aman untuk repo publik sekalipun — tapi `database/database.json` boleh saja ikut ter-push kalau kamu memang mau begitu).
2. Di [render.com](https://render.com) → **New** → **Web Service** → **Build and deploy from a Git repository** → pilih repo ini.
   - Kalau repo punya `render.yaml`, Render akan menawarkan **New Blueprint Instance** — ini paling cepat, tinggal klik **Apply**.
3. Isi konfigurasi service:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Instance Type:** Free (cukup untuk bot skala kecil–menengah)
4. Di tab **Environment**, tambahkan Environment Variable berikut (ini yang dimaksud "input token & client id langsung di Render"):
   | Key | Isi |
   |---|---|
   | `DISCORD_TOKEN` | Token bot dari Discord Developer Portal |
   | `CLIENT_ID` | Application ID bot |
   | `OWNER_IDS` | ID Discord owner, pisah koma kalau lebih dari satu |
   | `GUILD_ID` | (opsional) ID server testing, kosongkan untuk global |
    | `RAPIDAPI_KEY` | API key RapidAPI untuk memutar link YouTube asli lewat resolver audio |
   | `YT_COOKIES` | (opsional, hanya kalau fitur music YouTube kena block) isi seluruh isi file `cookies.txt` asli kamu (format Netscape) |
5. Klik **Create Web Service**. Tunggu build selesai, cek tab **Logs** — harus muncul log yang sama seperti menjalankan lokal (`Bot sudah online!`).
6. Bot ini bukan web app, tapi Render "Web Service" (satu-satunya tipe yang gratis) tetap butuh port yang aktif supaya deploy tidak dianggap gagal — project ini sudah menambahkan server HTTP kecil (`utils/keepAlive.js`) otomatis untuk itu, tidak perlu setup tambahan.

**Catatan penting soal Render free plan:**
- Instance **Free** akan otomatis "tidur" (spin down) kalau tidak ada trafik HTTP masuk selama ±15 menit, dan bot Discord ikut offline sampai ada request baru yang membangunkannya. Kalau bot perlu online 24/7, ada dua opsi:
  1. Pakai layanan ping gratis (misal [UptimeRobot](https://uptimerobot.com) atau [cron-job.org](https://cron-job.org)) untuk hit URL service Render kamu tiap 5–10 menit, **atau**
  2. Upgrade ke instance berbayar (Starter, mulai ~$7/bulan) yang tidak tidur.
- `database/database.json` di Render **tidak persisten** kalau instance restart/redeploy tanpa disk tambahan (isinya balik ke yang terakhir kamu push ke GitHub) — kamu sudah tahu soal ini, jadi cukup sebagai pengingat kalau nanti datanya "hilang" setelah redeploy.
- Sekali lagi soal `YT_COOKIES`: isinya setara sesi login akun Google/YouTube kamu. Jangan pernah tempel di tempat publik, dan pakai akun YouTube "buangan", bukan akun pribadi.

---

## 🎵 Fitur Music (Play Musik di Voice Channel)

Bot ini bisa memutar musik langsung di voice channel dari **YouTube**, **Spotify**, **SoundCloud**, dan 900+ situs lain — semuanya lewat `yt-dlp` (bukan `@distube/youtube` lagi, karena extractor itu berbasis `ytdl-core` yang gampang rusak tiap YouTube ganti sesuatu, gejalanya error `Failed to find any playable formats`) — lengkap dengan **autoplay** (bot otomatis lanjut memutar lagu terkait saat antrian habis — mirip Jockie Music), sama seperti perilaku bot musik pada umumnya.

### Instalasi

Semua dependency music sudah ada di `package.json`, jadi cukup jalankan:

```bash
npm install
```

`npm install` akan otomatis:
- Menginstall `distube` + plugin Spotify/SoundCloud/yt-dlp.
- Mendownload binary `yt-dlp` (dipakai untuk **semua** platform termasuk YouTube, plus 900+ situs tambahan), butuh koneksi internet saat instalasi pertama.
- Menginstall `ffmpeg-static` (jadi kamu **tidak perlu install FFmpeg manual** di OS/hosting).

> **Requirement penting:** `yt-dlp` butuh **Python** terpasang di server/hosting kamu (biasanya sebagai `python3`). Tanpa Python, semua pemutaran musik (termasuk YouTube) akan gagal.

> **Catatan hosting:** jika bot dijalankan di Pterodactyl/VPS dengan akses internet terbatas atau firewall ketat, proses download binary `yt-dlp` saat `npm install` bisa gagal — dan karena YouTube sekarang sepenuhnya bergantung pada `yt-dlp`, kalau itu terjadi pemutaran musik dari YouTube ikut gagal juga (Spotify/SoundCloud pakai plugin sendiri jadi tidak terdampak). Kalau server kamu di-rate-limit GitHub saat download binary, atur environment variable `YTDLP_URL` (link download alternatif) atau `YTDLP_DISABLE_DOWNLOAD=true`.
>
> Binary `yt-dlp` **tidak** auto-update tiap bot restart (`update: false` di `utils/music.js`) — sengaja begitu biar startup bot tetap cepat. Efeknya, binary bisa jadi usang setelah beberapa bulan dan mulai gagal lagi kalau YouTube berubah drastis. Kalau itu terjadi, update manual dengan hapus folder binary yt-dlp yang didownload plugin (biasanya di `node_modules/@distube/yt-dlp/bin` atau sesuai `YTDLP_DIR`) lalu jalankan ulang `npm install @distube/yt-dlp@latest`, atau redeploy dari awal.

### Cara Pakai

1. Join sebuah voice channel di server.
2. Ketik `/play query:<judul lagu / link YouTube / link Spotify / link SoundCloud>`.
3. Bot otomatis join voice channel kamu dan mulai memutar lagunya.
4. Kalau ingin bot terus memutar lagu tanpa henti secara otomatis (seperti radio), aktifkan `/autoplay`.

### Daftar Command Music

| Command | Deskripsi |
|---|---|
| `/play query` | Putar/tambah lagu ke antrian (YouTube, Spotify, SoundCloud, atau kata kunci pencarian) |
| `/skip` | Lewati lagu yang sedang diputar |
| `/pause` | Jeda musik |
| `/resume` | Lanjutkan musik yang dijeda |
| `/stop` | Hentikan musik, hapus antrian, bot keluar voice channel |
| `/leave` | Keluarkan bot dari voice channel |
| `/queue` | Lihat daftar antrian |
| `/nowplaying` | Lihat lagu yang sedang diputar (dengan progress bar) |
| `/volume level` | Atur volume (0-150), atau lihat volume saat ini jika tanpa `level` |
| `/loop mode` | Atur pengulangan: `off` / `song` / `queue` |
| `/autoplay` | Aktif/nonaktifkan autoplay lagu terkait otomatis (seperti Jockie Music) |
| `/shuffle` | Acak urutan antrian |
| `/remove nomor` | Hapus lagu tertentu dari antrian |
| `/filter nama` | Aktif/nonaktifkan filter audio (bassboost, nightcore, vaporwave, 8D, karaoke, echo) |
| `/favorites list/remove/clear` | Kelola daftar lagu favorit kamu (bisa juga lewat tombol ❤️ di panel musik) |
| `/sleeptimer set/off/status` | Hentikan musik otomatis setelah durasi tertentu |
| `/playlist create/list/add/view/remove/delete/play` | Simpan lagu yang sedang diputar ke playlist pribadi dan putar kembali kapan saja |
| `/queue-manage clear/move` | Hapus lagu yang menunggu atau pindahkan posisinya tanpa menghentikan lagu aktif |
| `/history list/play/clear` | Lihat, putar ulang, atau hapus riwayat musik server |

Preset efek audio seperti **Normal, Nightcore, Vaporwave, 8D, Karaoke, Echo, Pop, Soft,
dan Treble** juga tersedia langsung di menu **More Features** pada panel musik.

### Konfigurasi (opsional)

Semua bisa diatur di `settings.js` bagian `music`:
- `defaultVolume` — volume default saat bot mulai memutar musik.
- `maxQueueSize` — batas maksimal lagu dalam satu antrian.
- `leaveOnEmpty` / `leaveOnFinish` / `leaveOnStop` — kapan bot otomatis keluar voice channel.
- `spotify.clientId` / `spotify.clientSecret` — (opsional) isi jika kamu punya aplikasi Spotify Developer sendiri untuk resolusi playlist Spotify yang lebih stabil. Kalau dikosongkan, bot tetap bisa memutar link Spotify menggunakan token otomatis.

---

## 🆕 Fitur Baru v3

### 🖼️ Welcome & Goodbye Card (banner gambar)
Selain embed teks, sekarang saat member join/keluar bot juga generate banner gambar (avatar bulat + nama + jumlah member) secara otomatis — hijau untuk join, merah untuk keluar.
- Fitur ini pakai package `@napi-rs/canvas`. **Wajib jalankan `npm install` ulang** setelah update supaya package ini terpasang.
- Kalau package belum terpasang (belum `npm install`), bot **tidak akan crash** — otomatis fallback kirim embed teks biasa tanpa gambar.
- Bisa dimatikan per-jenis lewat `settings.js` → `welcome.useCard` / `goodbye.useCard` (`true`/`false`).
- Channel-nya tetap diatur sama seperti sebelumnya: `/config welcome` dan `/config goodbye`.

### 🎭 Reaction Role (ambil role otomatis lewat emote)
Member tinggal react emote di channel/pesan tertentu → langsung dapat role. React lagi emote yang sama → role dilepas.

Cara pakai (Admin / permission `Manage Roles`):
1. `/reactionrole panel channel:#ambil-role judul:"Pilih Role Kamu" deskripsi:"React emote di bawah untuk dapat role!"` → bot mengirim 1 pesan panel rapi di channel itu.
2. `/reactionrole add emote:🎮 role:@Gamer` → menambahkan emote 🎮 ke panel yang baru dibuat, otomatis di-react duluan oleh bot, dan embed panel ter-update menampilkan daftar emote+role. Ulangi command ini untuk emote/role lain di panel yang sama.
3. Kalau mau nambah ke panel lama atau pesan lain, isi opsi `message_id` (dan `channel` kalau beda channel dari panel terakhir).
4. `/reactionrole remove emote:🎮` → hapus pasangan emote-role (otomatis dari panel terakhir, atau tentukan `message_id`).
5. `/reactionrole list` → lihat semua reaction role yang aktif di server.

Emote bisa emoji unicode biasa (😀🎮🔥) atau custom emote server (`<:namaemote:id>`, tinggal ketik emotenya langsung di Discord saat isi opsi command).

Catatan penting:
- Role yang mau dibagikan **posisinya harus di bawah role bot** di pengaturan Roles server (aturan default Discord).
- Bot butuh permission `Manage Roles` dan `Add Reactions` di channel panel.
- Setting global ada di `settings.js` → `reactionRoles.enabled` (nyala/mati semua fitur ini) dan `reactionRoles.removeOnUnreact` (kalau `false`, unreact tidak akan melepas role).

### 🖥️ `/botinfo` upgrade — spesifikasi server lengkap + gambar
`/botinfo` sekarang menampilkan data lengkap: ping, jumlah server/user, **CPU** (model, jumlah core, clock, usage %), **RAM** (total/terpakai/tersisa + RAM proses bot), **Disk** (total/terpakai/tersisa), **OS** (nama, versi, arsitektur, hostname), Node.js & discord.js version, uptime bot, dan uptime server — disusun rapi pakai embed fields, plus dikirim juga sebagai **gambar dashboard** (progress bar CPU/RAM/Disk) biar makin kece.
- Sama seperti welcome card, gambar ini butuh `@napi-rs/canvas` (sudah termasuk di `npm install` yang sama). Kalau belum ke-install, otomatis fallback ke embed teks saja (tanpa gambar), tidak error.
- Catatan: command ini **tidak** menampilkan nama provider VPS/hosting (mis. "DigitalOcean", "Biznet") atau alamat IP publik, karena itu butuh koneksi ke layanan pihak ketiga dan berisiko membocorkan info infrastruktur server ke siapa pun yang bisa pakai `/botinfo`. Kalau kamu tetap mau data itu ditampilkan, sebaiknya batasi command ini jadi Owner-only saja — bilang aja, nanti saya buatkan versi terbatasnya.

### 🎶 Panel Musik Interaktif (tombol, bukan cuma command)
Setiap kali lagu diputar, embed "Now Playing" sekarang dilengkapi panel kontrol lengkap berbasis tombol — hampir semua aksi tinggal klik, nggak perlu ketik command lagi:
- **Baris 1:** ⏮️ Previous • ⏯️ Play/Pause • ⏭️ Skip • 📜 Antrian • ❤️ Favorite
- **Baris 2:** 🔀 Shuffle • 🔁 Loop (label berubah sesuai mode: Off/Lagu Ini/Semua Antrian, tombol jadi hijau kalau aktif) • 🔉 Volume -10% • 🔊 Volume +10% • ♾️ Autoplay (toggle on/off, jadi hijau kalau aktif)
- **Baris 3:** ⏱️ Replay (ulang dari awal) • 🎚️ Bass Boost (toggle on/off) • 🔌 Disconnect • ⏹️ Stop
- **Dropdown "More Features...":** Lirik Lagu (best-effort lewat lyrics.ovh, gratis tanpa API key), Favorit Saya

Beberapa catatan:
- Tombol yang mengubah playback (play/pause, skip, shuffle, dst) tetap mengecek kamu harus di voice channel yang sama dengan bot — sama seperti command biasa.
- ❤️ Favorite disimpan per-user di database bot sendiri (bukan API pihak ketiga), bisa dilihat/dihapus lewat `/favorites list|remove|clear` atau dari dropdown "More Features".
- 📝 Lirik pakai layanan gratis lyrics.ovh dan mencocokkan berdasarkan judul lagu — judul dari YouTube yang berantakan (banyak embel-embel "(Official MV)" dsb) kadang tidak ketemu, itu wajar/keterbatasan API gratis, bukan bug.
- **Yang sengaja TIDAK dibuat** (beda dari beberapa bot musik premium/berbayar yang mungkin jadi referensi): sistem multi-playlist per-user, "History" lintas sesi, "Select default platform", dan panel "Premium". Fitur-fitur itu butuh database/infrastruktur/lisensi tambahan yang di luar cakupan proyek open-source ini. Favorit (single list) + Antrian sudah tersedia sebagai versi sederhananya.

### ♾️ Mode 24/7 (`/247`)
Bot musik normalnya auto-leave voice channel kalau channel kosong (`music.leaveOnEmpty`) atau antrian sudah habis (`music.leaveOnFinish`). `/247` membalik itu per-server, tanpa perlu restart bot atau ubah `settings.js`:
- `/247 on` — bot tetap standby di voice channel walau ditinggal sendirian atau antrian habis (cocok dijadiin "radio" server 24 jam).
- `/247 off` — kembali ke perilaku normal.
- `/247 status` — cek status aktif/nonaktif di server ini.
- Butuh permission **Manage Server**.
- Disconnect **manual** tetap selalu bisa dipakai kapan saja walau mode 24/7 aktif: tombol ⏹️ Stop / 🔌 Disconnect di panel musik, atau command `/leave`.
- Beda dengan `/vcguard`: `/vcguard` itu auto-**rejoin** channel tertentu kalau bot ke-disconnect paksa (network drop/di-kick), sedangkan `/247` itu **mencegah bot leave** di keadaan normal (channel kosong/antrian habis). Keduanya bisa dipakai bareng.

### 📈 Now Playing Live-Update
Panel "Now Playing" sekarang auto-refresh progress bar-nya tiap ±15 detik selama lagu yang sama masih diputar (bukan cuma update pas ada yang klik tombol) — jadi kelihatan beneran "jalan" real-time. Auto-update otomatis berhenti/skip pas lagu lagi di-pause (hemat request ke Discord, toh progress-nya tidak bergerak), dan otomatis berhenti begitu lagu ganti, antrian habis, atau bot disconnect.

### 🛠️ Troubleshooting: Error `ENOENT` / JSON / "Sign in to confirm you're not a bot" saat Play Link YouTube

Ada 3 gejala berbeda yang sering muncul bareng-bareng, penyebabnya juga beda-beda:

**a) `spawn .../yt-dlp/bin/yt-dlp ENOENT`**
Artinya binary `yt-dlp` **belum ada sama sekali** di server. `YtDlpPlugin` seharusnya auto-download binary ini saat bot start (sudah di-set `update: true` di v3), tapi download itu **butuh koneksi ke GitHub** — di hosting dengan IP bersama/ramai kayak **Replit**, IP-nya sering kena rate-limit GitHub (`403`) sehingga downloadnya gagal diam-diam, dan baru ketahuan pas lagu di-play (ENOENT).

Cara benerin di Replit:
1. Buka tab **Shell** di Replit, jalankan:
   ```
   curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp-bin
   chmod +x yt-dlp-bin
   ```
2. Tambahkan environment variable ini lewat **Secrets** (ikon gembok di sidebar Replit), lalu **restart bot**:
   - `YTDLP_URL` = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp` (kalau opsi ini saja sudah cukup, cara di langkah 1 tidak perlu dipakai — coba ini dulu, lebih simpel)
   
   Kalau masih gagal juga (IP Replit kadang di-block total ke GitHub), pindahkan file `yt-dlp-bin` dari langkah 1 ke folder tetap (misal `.data/yt-dlp/yt-dlp`) lalu set:
   - `YTDLP_DIR` = path folder itu (misal `/home/runner/workspace/zeechei-bot-v3/.data/yt-dlp`)
   - `YTDLP_FILENAME` = `yt-dlp`

   Env variable di Replit **wajib** lewat Secrets, bukan `export` di Shell — soalnya proses bot yang dijalankan lewat tombol Run tidak mewarisi `export` dari Shell terpisah.

**b) `Sign in to confirm you're not a bot`**
Ini murni YouTube yang mendeteksi request otomatis dari IP server (server hosting/cloud, termasuk Replit **dan Railway**, sangat sering kena ini — laptop/HP pribadi biasanya tidak). **Bukan bug bot.** Yang sudah saya siapkan (v3.1):

- `settings.js` → `music.youtube.playerClients` — yt-dlp coba beberapa "player client" secara berurutan (default sekarang `tv`, `mweb`, `android`, `web` — urutan ini yang per 2026 paling jarang diminta login oleh YouTube). Sudah aktif otomatis.
- `settings.js` → `music.youtube.jsRuntime` (**baru, paling penting**) — sejak yt-dlp versi 2025.11.x ke atas, YouTube **mewajibkan** yt-dlp menyelesaikan "PO Token challenge" pakai JS runtime eksternal (Deno/Node/Bun). Tanpa ini, yt-dlp otomatis masuk mode terbatas dan **jauh lebih sering** kena "Sign in to confirm you're not a bot", meskipun `playerClients` di atas sudah benar. Karena bot ini sendiri jalan di atas Node.js, kita set `jsRuntime: "node"` supaya yt-dlp pakai `node` yang sudah pasti ada di server (termasuk di Railway) — **tidak perlu install Deno terpisah**.
- `settings.js` → `music.youtube.forceIpv4` (**baru**) — banyak hosting cloud (termasuk Railway) resolve YouTube lewat IPv6, dan YouTube menilai reputasi IPv6 per blok /64 (jauh lebih gampang di-flag daripada IPv4). Default `true` supaya yt-dlp dipaksa lewat IPv4.
- Kalau **masih** kena block terus setelah dua opsi di atas aktif (defaultnya sudah aktif, tidak perlu diapa-apain), satu-satunya cara yang beneran ampuh berikutnya adalah pakai **cookies** dari akun YouTube yang sudah login:
  1. Login ke YouTube pakai **akun buangan** (jangan akun pribadi/utama kamu — cookies ini setara sesi login, kalau bocor akun bisa dipakai orang lain).
  2. Export cookies pakai extension browser seperti "Get cookies.txt LOCALLY" (Chrome/Firefox), simpan sebagai file `cookies.txt`.
  3. Di Render, isi **Environment Variable `YT_COOKIES`** dengan seluruh isi file tersebut. Bot otomatis menulisnya ke path absolut `cookies.txt` dengan permission terbatas saat start.
  4. **Jangan commit cookies ke GitHub**; gunakan akun YouTube khusus, bukan akun pribadi.
  5. Restart/redeploy bot setelah mengubah variable.
- Cookies bisa "basi" lagi kalau kamu logout dari akun itu di browser asalnya — kalau tiba-tiba error ini muncul lagi setelah lama normal, export ulang cookies-nya.
- Kalau debug log (`YTDLP_DEBUG=1` di environment variable Railway, opsional) menyebut soal "PO Token" spesifik untuk satu client tertentu, itu tandanya perlu **PO Token provider** (`bgutil-ytdlp-pot-provider`) — ini setup lanjutan (butuh service tambahan berjalan terus), silakan buka issue/minta bantuan lebih lanjut kalau sampai ke titik ini karena setup-nya di luar cakupan config sederhana di atas.

**c) `Unexpected token < in JSON` / `Failed to parse JSON`**
Biasanya kombinasi dari (a) — binary belum ada/rusak — atau YouTube mengembalikan halaman HTML (block/captcha) padahal yt-dlp mengharapkan JSON, yang berarti sebenarnya ini juga gejala dari (b). Perbaiki (a) dan (b) dulu di atas.

**Umum untuk ketiganya:**
- Coba `/play` dengan **judul lagu biasa** atau link YouTube — judul biasa otomatis memakai pencarian `ytsearch1:` dan link langsung memakai extractor YouTube yang sama.
- ⚠️ **Catatan jujur soal Replit:** Replit (terutama plan gratis) memakai IP yang dipakai bareng-bareng banyak project lain, jadi jauh lebih sering kena rate-limit GitHub *dan* block YouTube dibanding VPS pribadi. Kalau setelah semua langkah di atas masih sering error, pertimbangkan pindah hosting ke VPS (lihat bagian **8️⃣ Cara Deploy ke Pterodactyl** di README ini) — ini perbaikan yang paling permanen, bukan cuma tambal sulam.

### 🔎 Pencarian judul + fallback YouTube

Judul biasa otomatis diubah menjadi query `ytsearch1:` sebelum diberikan ke yt-dlp.
Jadi `/play query:lagu galau full album 2026` benar-benar melakukan pencarian YouTube,
bukan mencoba mencari URL dengan nama tersebut. Link YouTube tetap diproses sebagai link
langsung. Jika jalur utama gagal atau timeout, `/play` juga mencoba resolver yt-dlp kedua.

### 🔁 Fallback `youtube-dl-exec` + Timeout Guard di `/play`

`/play` sekarang punya jalur kedua kalau jalur utama (`@distube/yt-dlp`) gagal atau macet:

1. `distube.play()` dibungkus timeout 25 detik. Sebelumnya, kalau prosesnya macet total (bukan error, cuma diem), interaction bisa "diem selamanya" sampai token-nya expired — user ngerasa **bot sama sekali tidak merespon**. Sekarang setelah 25 detik bot berhenti nunggu dan kasih tahu status yang jelas.
2. Untuk input YouTube (link maupun judul), kalau jalur utama gagal/timeout, bot otomatis coba ulang pakai [`youtube-dl-exec`](https://www.npmjs.com/package/youtube-dl-exec) untuk resolve direct stream URL-nya, lalu diserahkan ke DisTube untuk diputar.

⚠️ **Catatan jujur:** `youtube-dl-exec`, sama seperti `@distube/yt-dlp` yang sudah dipakai bot ini, **sama-sama cuma pembungkus Node.js di atas binary `yt-dlp`**. Jadi kalau akar masalahnya YouTube nge-block IP server (gejala `Sign in to confirm you're not a bot`, dibahas lengkap di bagian Troubleshooting di atas), ganti pembungkus JS-nya **tidak otomatis menyelesaikan itu** — dua-duanya bakal kena block yang sama karena keduanya menghubungi YouTube dari IP server yang sama. Fallback ini nilainya di: (a) jalur eksekusi independen yang tetap dibungkus timeout sendiri, dan (b) kadang binary yt-dlp yang dibawa `youtube-dl-exec` beda versi dan kebetulan belum kena pola block terbaru. Kalau `/play` masih sering gagal di KEDUA metode dengan pesan `Sign in to confirm you're not a bot`, solusi yang benar-benar terbukti ampuh tetap **isi `YT_COOKIES`** (lihat bagian Troubleshooting di atas) — itu satu-satunya cara yang menghindari deteksi bot dari sisi YouTube, bukan sekadar ganti library.

### 🎧 Satu bot, satu Paseban Musik

Fitur musik sekarang hanya berjalan di bot utama. Setiap server memiliki satu pesan
panel musik yang dipakai ulang: saat lagu berganti, pesan yang sama diedit, bukan
mengirim panel baru. ID panel disimpan di database agar tetap bisa ditemukan setelah
restart/redeploy. Tombol panel memakai tema marun-emas “Paseban Musik Majapahit”.

---

## 📜 Daftar Command


### 👑 Admin & Owner
| Command | Deskripsi | Akses |
|---|---|---|
| `/config welcome/goodbye/autorole/logs/leveling/view` | Konfigurasi server | Admin |
| `/reactionrole panel/add/remove/list` | Kelola reaction role (emote → role) | Admin |
| `/ticket setup` | Kirim panel ticket | Admin |
| `/announce` | Kirim pengumuman dengan embed | Admin |
| `/blacklist add/remove/list` | Kelola blacklist user | Owner |
| `/maintenance on/off` | Mode maintenance | Owner |
| `/reload commands/events` | Reload command/event tanpa restart | Owner |
| `/broadcast` | Kirim pesan ke semua server (dengan konfirmasi) | Owner |
| `/ownerpanel servers/config` | Lihat daftar server & config global | Owner |
| `/database view/deleteuser` | Lihat/hapus data user di database | Owner |

### 👮 Moderation
`/ban` `/unban` `/kick` `/timeout` `/untimeout` `/warn` `/warnings` `/clear` `/slowmode` `/lock` `/unlock` `/nick`

### 🛠️ Utility
`/help` `/ping` `/uptime` `/botinfo` `/stats` `/serverinfo` `/userinfo` `/avatar` `/roleinfo` `/channelinfo` `/rank` `/afk` `/remind` `/poll` `/suggest` `/report` `/invite` `/support`

### 🎉 Fun
`/joke` `/hug` `/compliment`

### 🎮 Games
`/coinflip` `/dice` `/8ball` `/rps` `/guess` `/trivia` `/math` `/higherlower` `/slots`

### 💰 Economy
`/balance` `/daily` `/work` `/pay` `/leaderboard`

### 🎵 Music
`/play` `/skip` `/pause` `/resume` `/stop` `/leave` `/queue` `/nowplaying` `/volume` `/loop` `/autoplay` `/shuffle` `/remove` `/filter` `/playnext` `/replay` `/seek` `/bassboost` `/favorites` `/sleeptimer` `/playlist` `/queue-manage` `/history` `/vcguard` `/247`

---

## 🔐 Permission yang Dibutuhkan Bot

Minimal, agar semua fitur berjalan, bot membutuhkan permission berikut di server:

- `Manage Roles` (auto-role)
- `Manage Channels` (ticket, lock/unlock, slowmode)
- `Manage Messages` (clear, anti-spam)
- `Moderate Members` (timeout)
- `Kick Members`, `Ban Members`
- `Manage Nicknames`
- `View Channels`, `Send Messages`, `Embed Links`, `Read Message History`
- `Add Reactions` (poll, suggest, reaction role)
- `Connect`, `Speak` (music — join & play di voice channel)

Untuk kemudahan development, permission `Administrator` sudah mencakup semuanya.

> **Privileged Intents** yang wajib diaktifkan di Discord Developer Portal (tab **Bot**): `SERVER MEMBERS INTENT` dan `MESSAGE CONTENT INTENT` (lihat langkah 1️⃣). Intent `GUILD VOICE STATES` untuk fitur music **tidak perlu** diaktifkan manual karena bukan privileged intent.

---

## 🧠 Sistem Owner

Owner ditentukan **murni dari `settings.js` (`ownerIds`)**, bukan dari role Discord. Artinya, user biasa **tidak akan pernah** bisa menjalankan command owner-only walaupun mereka memiliki permission Administrator di Discord — karena pengecekan dilakukan lewat `isOwner(userId)` di `utils/permissions.js`, terpisah total dari sistem permission Discord.

## 🗃️ Database

Semua data (user economy/leveling, config per-guild, blacklist, warnings, AFK) disimpan di `database/database.json`. Penulisan file menggunakan write-queue sederhana (`utils/database.js`) untuk mencegah file JSON korup saat banyak event terjadi bersamaan.

## 🛡️ Error Handling

Bot tidak akan crash karena role/channel hilang, permission kurang, atau error Discord API — semua ditangani dengan try/catch dan (jika `logs.enabled: true`) error penting dikirim ke log channel.
