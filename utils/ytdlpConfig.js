/**
 * ============================================
 *  YT-DLP GLOBAL CONFIG WRITER (v3)
 * ============================================
 * @distube/yt-dlp cuma punya 1 opsi resmi (`update`) - tidak ada cara
 * "official" buat nyisipin argumen custom (extractor-args, cookies, dsb)
 * lewat constructor plugin-nya. Tapi yt-dlp (binary-nya sendiri) OTOMATIS
 * baca file config dari lokasi standar tiap kali dijalankan, siapapun yang
 * manggil (baik langsung dari terminal, maupun lewat yt-dlp-exec/DisTube).
 *
 * Jadi solusinya: kita tulis file config itu sendiri di lokasi standar
 * ($HOME/.config/yt-dlp/config), BUKAN di dalam node_modules - supaya:
 * 1. Nggak ke-reset/ke-hapus tiap kali `npm install`/`pnpm install` ulang.
 * 2. Otomatis kepakai oleh yt-dlp tanpa perlu ubah kode @distube/yt-dlp.
 *
 * Ini yang dipakai buat "meredam" error umum:
 * - "Sign in to confirm you're not a bot" -> lewat extractor-args player_client
 *   (yt-dlp akan coba beberapa "client" YouTube secara berurutan) dan/atau cookies.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const settings = require("../settings.js");
const logger = require("./logger.js");

function getConfigPath() {
    return path.join(os.homedir(), ".config", "yt-dlp", "config");
}

function ensureYtDlpConfig() {
    const ytConfig = settings.music?.youtube;
    if (!ytConfig) return;

    const lines = [];

    if (Array.isArray(ytConfig.playerClients) && ytConfig.playerClients.length) {
        lines.push(`--extractor-args "youtube:player_client=${ytConfig.playerClients.join(",")}"`);
    }

    // (v3.1) JS runtime eksternal - WAJIB sejak yt-dlp 2025.11.x buat YouTube bisa
    // nyelesain PO Token challenge dari BotGuard dengan benar. Tanpa ini yt-dlp akan
    // jalan dalam mode "deprecated" (format terbatas, gampang kena bot-check).
    // Defaultnya "node" karena environment bot ini sudah pasti punya Node.js terpasang
    // (termasuk di Railway), jadi tidak perlu instalasi tambahan apapun di server.
    if (ytConfig.jsRuntime) {
        lines.push(`--js-runtimes "${ytConfig.jsRuntime}"`);
    }

    // (v3.1) Paksa IPv4 - lihat catatan di settings.js kenapa ini membantu di hosting cloud.
    if (ytConfig.forceIpv4) {
        lines.push(`--force-ipv4`);
    }

    if (ytConfig.cookiesPath) {
        const cookiesPath = path.isAbsolute(ytConfig.cookiesPath)
            ? ytConfig.cookiesPath
            : path.resolve(__dirname, "..", ytConfig.cookiesPath);
        const hasCookieRows = fs.existsSync(cookiesPath) &&
            fs.readFileSync(cookiesPath, "utf8")
                .split(/\r?\n/)
                .some((line) => line && !line.startsWith("#") && line.split("\t").length >= 7);
        if (hasCookieRows) {
            lines.push(`--cookies "${cookiesPath}"`);
            logger.info(`yt-dlp cookies aktif (${fs.statSync(cookiesPath).size} bytes).`);
        } else {
            logger.warn(
                `cookies.txt kosong/tidak valid di "${cookiesPath}" - yt-dlp berjalan tanpa cookies.`
            );
        }
    }

    const configPath = getConfigPath();

    if (!lines.length) {
        // Tidak ada opsi yang aktif -> hapus config lama (kalau ada) supaya tidak nyangkut setting basi.
        try {
            if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
        } catch {
            // abaikan, tidak fatal
        }
        return;
    }

    try {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, `${lines.join("\n")}\n`, "utf8");
        logger.info(`yt-dlp global config ditulis di ${configPath} (${lines.length} opsi aktif).`);
    } catch (err) {
        logger.error(`Gagal menulis yt-dlp global config: ${err.message}`);
    }
}

module.exports = { ensureYtDlpConfig, getConfigPath };
