/**
 * ============================================
 *  YOUTUBE-DL-EXEC FALLBACK RESOLVER (v4)
 * ============================================
 * Dipakai sebagai jalur CADANGAN di commands/music/play.js kalau distube.play()
 * lewat YtDlpPlugin gagal/macet total (lihat catatan besar di play.js).
 *
 * PENTING - baca ini biar ekspektasinya pas:
 * youtube-dl-exec, sama seperti @distube/yt-dlp yang sudah dipakai bot ini,
 * SAMA-SAMA cuma pembungkus Node.js di atas binary yt-dlp. Jadi kalau
 * penyebab error-nya YouTube nge-block IP server (pesan "Sign in to confirm
 * you're not a bot"), ganti pembungkus JS-nya TIDAK otomatis menyelesaikan
 * masalah itu - yang beneran menyelesaikan adalah opsi cookies yang SUDAH ADA
 * di settings.js -> music.youtube.cookiesPath / Environment Variable YT_COOKIES
 * di Render. Fallback di file ini nilainya di dua hal lain:
 *   1. Jalur eksekusi kedua yang independen -> kalau proses yt-dlp-exec yang
 *      dipakai YtDlpPlugin "macet" (hang, bukan error), fallback ini
 *      dibungkus timeout sendiri jadi user tetap dapat balasan yang jelas.
 *   2. Binary yt-dlp yang dipakai youtube-dl-exec BISA jadi versi lebih baru
 *      dari yang dibundle @distube/yt-dlp, kadang cukup buat kasus tertentu.
 * Keduanya baca config global yt-dlp yang sama (lihat utils/ytdlpConfig.js),
 * jadi playerClients / jsRuntime / forceIpv4 / cookies otomatis ikut kepakai
 * di sini juga tanpa perlu diulang manual.
 */
const youtubedl = require("youtube-dl-exec");
const logger = require("./logger.js");
const RAPID_API_HOST = "youtube-mp36.p.rapidapi.com";

function extractYoutubeVideoId(input) {
    try {
        const url = new URL(input);
        if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
        if (url.hostname.endsWith("youtube.com")) {
            const fromQuery = url.searchParams.get("v");
            if (fromQuery) return fromQuery;
            const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/i);
            return match?.[1] || null;
        }
    } catch {
        // The caller may pass a search expression instead of a URL.
    }
    return null;
}

/**
 * Resolve a YouTube URL through RapidAPI's hosted MP3 converter.
 * This is needed when the Replit egress IP is allowed to resolve YouTube
 * metadata but Googlevideo rejects the actual media request with HTTP 403.
 */
async function resolveRapidApiAudio(query, timeoutMs = 20000) {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) throw new Error("RAPIDAPI_KEY belum dikonfigurasi.");

    const videoId = extractYoutubeVideoId(query);
    if (!videoId) throw new Error("URL YouTube tidak memiliki video ID yang valid.");

    const response = await fetch(`https://${RAPID_API_HOST}/dl?id=${encodeURIComponent(videoId)}`, {
        headers: {
            "X-RapidAPI-Key": apiKey,
            "X-RapidAPI-Host": RAPID_API_HOST,
            "User-Agent": "Paseban-Discord-Bot/1.0"
        },
        signal: AbortSignal.timeout(timeoutMs)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status !== "ok" || !data.link) {
        const detail = data.message || data.msg || `HTTP ${response.status}`;
        throw new Error(`RapidAPI YouTube gagal: ${detail}`);
    }

    return {
        url: data.link,
        title: data.title,
        duration: data.duration,
        httpHeaders: {}
    };
}

/**
 * Resolve satu link/​query YouTube jadi direct stream URL audio + metadata dasar.
 * @param {string} query - link YouTube (atau judul, tapi paling reliable untuk link).
 * @param {number} timeoutMs
 * @returns {Promise<{url: string, title?: string, thumbnail?: string, duration?: number}>}
 */
async function resolveYoutubeAudio(query, timeoutMs = 20000) {
    const infoPromise = youtubedl(query, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificate: true,
        preferFreeFormats: true,
        noPlaylist: true,
        format: "bestaudio/best"
    });

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("youtube-dl-exec timeout (proses ke YouTube kelamaan/macet).")), timeoutMs);
    });

    let info;
    try {
        info = await Promise.race([infoPromise, timeoutPromise]);
    } catch (err) {
        logger.error(`[youtube-dl-exec] Gagal resolve "${query}": ${err.message}`);
        throw err;
    }

    const streamUrl = info?.url || (Array.isArray(info?.formats) ? info.formats.find((f) => f?.acodec && f.acodec !== "none" && f?.url)?.url : null);

    if (!streamUrl) {
        throw new Error("youtube-dl-exec berhasil jalan tapi tidak menemukan URL stream audio (format tidak cocok).");
    }

    return {
        url: streamUrl,
        title: info?.title,
        thumbnail: info?.thumbnail,
        duration: info?.duration,
        httpHeaders: info?.http_headers || {}
    };
}

/**
 * Check whether the direct Googlevideo URL can actually be opened from this
 * server. yt-dlp can resolve metadata successfully while the media host still
 * returns HTTP 403 to the later FFmpeg request.
 */
async function probeYoutubeAudio(resolved, timeoutMs = 8000) {
    if (!resolved?.url) {
        return { ok: false, status: null, reason: "URL stream kosong." };
    }

    try {
        const headers = {
            ...resolved.httpHeaders,
            Range: "bytes=0-1"
        };
        const response = await fetch(resolved.url, {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(timeoutMs)
        });
        await response.body?.cancel();
        return {
            ok: response.ok || response.status === 206,
            status: response.status,
            reason: response.ok || response.status === 206 ? null : `HTTP ${response.status}`
        };
    } catch (error) {
        return {
            ok: false,
            status: null,
            reason: error.message
        };
    }
}

module.exports = { resolveYoutubeAudio, probeYoutubeAudio, resolveRapidApiAudio };
