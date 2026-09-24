# Deploy Zeechei Bot ke Render

## 1. Upload project

Extract ZIP ini, lalu upload **isi foldernya** ke repository GitHub baru. Pastikan
`index.js`, `package.json`, dan `render.yaml` berada di root repository.

Di Render pilih **New → Blueprint** lalu pilih repository tersebut. Jika tidak
memakai Blueprint, buat **Web Service** dengan konfigurasi:

- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `node index.js`
- Instance: `Free` atau instance yang selalu aktif

## 2. Environment Variables di Render

Buka service Render → **Environment → Add Environment Variable**:

| Variable | Wajib | Isi |
|---|---:|---|
| `DISCORD_TOKEN` | Ya | Token bot dari Discord Developer Portal → Bot → Reset Token |
| `CLIENT_ID` | Ya | Application ID dari Discord Developer Portal → General Information |
| `RAPIDAPI_KEY` | Ya untuk link YouTube | API key RapidAPI dari akun RapidAPI yang berlangganan API YouTube MP3 |
| `OWNER_IDS` | Disarankan | Discord User ID pemilik bot; jika lebih dari satu, pisahkan dengan koma |
| `GUILD_ID` | Opsional | ID server testing agar slash command terdaftar lebih cepat; kosongkan untuk global |
| `YT_COOKIES` | Opsional | Isi `cookies.txt` format Netscape jika ingin memberi jalur tambahan untuk yt-dlp |

Jangan mengisi token atau key di `settings.js`, GitHub, README, atau chat.

## 3. Pengaturan Discord Developer Portal

Aktifkan:

- **Server Members Intent**
- **Message Content Intent**

Saat mengundang bot, gunakan scope `bot` dan `applications.commands`.
Bot membutuhkan izin minimal **View Channel**, **Send Messages**, **Connect**,
dan **Speak**. Untuk konfigurasi penuh, izin **Manage Roles** dan izin
moderasi terkait juga diperlukan.

## 4. Setelah deploy

1. Buka **Logs** di Render dan pastikan muncul `sudah online`.
2. Di Discord, join voice channel.
3. Jalankan:

   `/play query:<link YouTube>`

Untuk link YouTube, bot memakai RapidAPI sebagai jalur audio utama lalu
memutar hasilnya melalui FFmpeg. Jika RapidAPI kehabisan kuota atau gagal,
bot masih mencoba jalur cadangan yang tersedia.

## 5. Catatan Render Free

Web Service Free dapat tidur jika tidak menerima trafik HTTP. Bot Discord bisa
ikut offline ketika service tidur. `utils/keepAlive.js` sudah membuka port
health check, tetapi Render tetap dapat melakukan spin-down. Untuk bot 24/7,
gunakan instance selalu aktif atau ping endpoint health check secara berkala.

Database JSON lokal tidak persisten saat redeploy. Data konfigurasi yang penting
sebaiknya dicatat ulang atau dipindahkan ke penyimpanan persisten sebelum
deployment production.