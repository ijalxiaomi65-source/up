const path = require("path");
const { DisTube, isVoiceChannelEmpty } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { SoundCloudPlugin } = require("@distube/soundcloud");
const { YtDlpPlugin } = require("@distube/yt-dlp");

const settings = require("../settings.js");
const logger = require("./logger.js");
const db = require("./database.js");
const { startGuard } = require("./voiceGuard.js");
const { recordHistory } = require("./musicFeatures.js");

/**
 * Cek apakah mode 24/7 (/247) aktif untuk guild ini. Kalau aktif, bot TIDAK
 * boleh auto-leave voice channel walau channel kosong atau antrian habis.
 */
function is247Enabled(guildId) {
    if (!guildId) return false;
    return !!db.getGuild(guildId)?.musicMode247;
}

// Map npIntervals dibuat PER PANGGILAN setupMusic() agar live-update tetap
// terisolasi tanpa membuat interval global yang saling menimpa.
const NP_UPDATE_INTERVAL_MS = 15000;

/**
 * Setelah DisTube keluar dari voice channel (lagu habis, /stop, channel kosong, dsb),
 * cek apakah guild itu punya /vcguard aktif di database. Kalau iya, sambungkan lagi
 * si VC Guard supaya bot balik "standby" di channel yang dijaga - ini yang bikin
 * catatan di voiceGuard.js ("VC Guard akan otomatis coba reconnect lagi begitu lagu
 * selesai/berhenti") beneran jalan, bukan cuma komentar.
 */
function resumeGuardIfNeeded(client, queue) {
    const guildId = queue?.textChannel?.guildId || queue?.id;
    if (!guildId) return;

    const guildData = db.getGuild(guildId);
    if (!guildData?.vcGuard?.enabled || !guildData.vcGuard.channelId) return;

    // Kasih jeda sebentar biar koneksi DisTube benar-benar selesai di-destroy
    // dulu sebelum VC Guard coba join lagi (hindari race condition).
    setTimeout(async () => {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;
        try {
            await startGuard(guild, guildData.vcGuard.channelId, guildData.vcGuard.textChannelId);
            logger.info(`[VC-GUARD] Resume guard guild ${guildId} setelah musik berhenti.`);
        } catch (err) {
            logger.error(`[VC-GUARD] Gagal resume guard guild ${guildId} setelah musik berhenti: ${err.message}`);
        }
    }, 2000);
}

// Pastikan ffmpeg-static ditemukan oleh @discordjs/voice / prism-media tanpa perlu install FFmpeg manual di OS.
try {
    // The Replit runtime already provides a shared FFmpeg 6.x build. It
    // handles the remote SoundCloud stream correctly, while the bundled
    // ffmpeg-static binary can segfault on this stream type.
    const { execFileSync } = require("node:child_process");
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    process.env.FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
} catch {
    // Fallback untuk environment yang tidak menyediakan FFmpeg di PATH.
    try {
        process.env.FFMPEG_PATH = process.env.FFMPEG_PATH || require("ffmpeg-static");
    } catch {
        // DisTube akan memberi error yang jelas saat mencoba memutar.
    }
}

const { loopLabel, progressBar, statusLine, BASS_BOOST_PRESETS, REPEAT_LABELS } = require("./musicFormat.js");
const { buildNowPlayingEmbed, buildIdleMusicEmbed, buildControlRows } = require("./musicPanel.js");
const { ensureYtDlpConfig } = require("./ytdlpConfig.js");

/**
 * Inisialisasi DisTube dan pasang semua event listener-nya.
 * Dipanggil sekali saat bot start, sebelum client.login().
 */
function setupMusic(client) {
    if (!settings.music?.enabled) {
        logger.warn("Fitur music dinonaktifkan (settings.music.enabled = false).");
        return null;
    }

    // Interval "Now Playing" live-update, khusus milik instance bot ini saja
    // (lihat catatan di atas const NP_UPDATE_INTERVAL_MS).
    const npIntervals = new Map();
    const panelCache = new Map();
    const panelLocks = new Map();

    function clearNpInterval(guildId) {
        const interval = npIntervals.get(guildId);
        if (interval) {
            clearInterval(interval);
            npIntervals.delete(guildId);
        }
    }

    function withPanelLock(guildId, task) {
        const previous = panelLocks.get(guildId) || Promise.resolve();
        const current = previous
            .catch(() => {})
            .then(task)
            .finally(() => {
                if (panelLocks.get(guildId) === current) panelLocks.delete(guildId);
            });
        panelLocks.set(guildId, current);
        return current;
    }

    async function fetchSavedPanel(guildId) {
        const saved = db.getGuild(guildId).musicPanel;
        if (!saved?.channelId || !saved?.messageId) return null;

        const channel = await client.channels.fetch(saved.channelId).catch(() => null);
        if (!channel?.isTextBased?.()) return null;
        return channel.messages.fetch(saved.messageId).catch(() => null);
    }

    function isMusicPanel(message) {
        return Boolean(
            message?.author?.id === client.user?.id &&
            message.components?.some((row) =>
                row.components?.some((component) => component.customId?.startsWith("music_"))
            )
        );
    }

    async function findRecentPanel(channel) {
        if (!channel?.messages?.fetch) return null;
        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        return messages ? [...messages.values()].find((message) => isMusicPanel(message)) : null;
    }

    function panelPayload(queue, song, idleReason) {
        return song
            ? { embeds: [buildNowPlayingEmbed(queue, song)], components: buildControlRows(queue) }
            : { embeds: [buildIdleMusicEmbed(idleReason)], components: buildControlRows(null) };
    }

    async function updateMusicPanel(queue, song = queue?.songs?.[0], idleReason) {
        const guildId = queue?.textChannel?.guildId || queue?.id;
        if (!guildId) return null;

        return withPanelLock(guildId, async () => {
            let panel = panelCache.get(guildId);
            if (!panel) panel = await fetchSavedPanel(guildId);
            if (!panel && queue?.textChannel) panel = await findRecentPanel(queue.textChannel);

            const payload = panelPayload(queue, song, idleReason);
            if (panel) {
                try {
                    await panel.edit(payload);
                } catch {
                    panel = null;
                }
            }

            if (!panel && queue?.textChannel) {
                panel = await queue.textChannel.send(payload).catch(() => null);
            }
            if (!panel) return null;

            panelCache.set(guildId, panel);
            db.updateGuild(guildId, {
                musicPanel: { channelId: panel.channelId, messageId: panel.id }
            });
            return panel;
        });
    }

    // Discord tidak punya fitur "sticky message". Supaya panel selalu berada
    // tepat di bawah request lagu terbaru, panel lama dipindahkan dengan cara
    // menghapusnya lalu mengirim ulang di posisi paling bawah channel.
    async function reanchorMusicPanel(guildId, channel) {
        return withPanelLock(guildId, async () => {
            const queue = distube.getQueue(guildId);
            if (!queue || !channel?.send) return null;

            let panel = panelCache.get(guildId);
            if (!panel) panel = await fetchSavedPanel(guildId);
            if (!panel) panel = await findRecentPanel(channel);
            await panel?.delete().catch(() => {});
            panelCache.delete(guildId);

            const nextPanel = await channel.send(panelPayload(queue, queue.songs?.[0])).catch(() => null);
            if (!nextPanel) return null;

            panelCache.set(guildId, nextPanel);
            db.updateGuild(guildId, {
                musicPanel: { channelId: nextPanel.channelId, messageId: nextPanel.id }
            });
            return nextPanel;
        });
    }

    async function setPanelIdle(guildId, reason) {
        return withPanelLock(guildId, async () => {
            let panel = panelCache.get(guildId);
            if (!panel) panel = await fetchSavedPanel(guildId);
            if (!panel) return null;

            await panel.edit({
                embeds: [buildIdleMusicEmbed(reason)],
                components: buildControlRows(null)
            }).catch(() => {});
            panelCache.set(guildId, panel);
            return panel;
        });
    }

    // Tulis/refresh config global yt-dlp SEBELUM YtDlpPlugin diinisialisasi -
    // lihat utils/ytdlpConfig.js buat penjelasan kenapa ini perlu.
    ensureYtDlpConfig();

    const spotifyOptions = {};
    if (settings.music.spotify?.clientId && settings.music.spotify?.clientSecret) {
        spotifyOptions.api = {
            clientId: settings.music.spotify.clientId,
            clientSecret: settings.music.spotify.clientSecret
        };
    }

    // Catatan: sejak DisTube v5, opsi "leaveOnEmpty" / "leaveOnFinish" / "leaveOnStop" / "emptyCooldown"
    // sudah DIHAPUS dari DisTubeOptions (memasukkannya akan melempar DisTubeError [INVALID_KEY]).
    // Perilaku keluar voice channel sekarang diatur manual lewat event "empty" / "finish" / "disconnect"
    // di bawah (dan lewat command /stop kamu sendiri), jadi settings.music.leaveOnEmpty/leaveOnFinish/leaveOnStop
    // dipakai secara manual di dalam event handler-nya, bukan lagi lewat constructor.
    const soundCloudPlugin = new SoundCloudPlugin();
    const distube = new DisTube(client, {
        emitNewSongOnly: true,
        savePreviousSongs: true,
        joinNewVoiceChannel: true,
        nsfw: false,
        // Override/tambah filter FFmpeg bawaan DisTube. Filter "bassboost" bawaan DisTube
        // (`bass=g=10`) sengaja diganti ke preset "sedang" di bawah biar default-nya lebih
        // berasa. "8d" juga didaftarkan di sini karena DisTube v5 cuma punya default filter
        // "3d", bukan "8d" - jadi sebelumnya /filter 8d selalu gagal (nama tidak match).
        customFilters: {
            bassboost: BASS_BOOST_PRESETS.sedang.value,
            "8d": "apulsator=hz=0.09",
            pop: "equalizer=f=60:width_type=h:width=100:g=6,equalizer=f=8000:width_type=h:width=4000:g=4",
            soft: "lowpass=f=4000,volume=1.15",
            treble: "treble=g=8"
        },
        plugins: [
            new SpotifyPlugin(spotifyOptions),
            soundCloudPlugin,
            // Catatan penting soal YouTube: sengaja TIDAK pakai @distube/youtube (berbasis
            // ytdl-core) di sini. Extractor berbasis ytdl-core gampang banget rusak setiap
            // YouTube ganti sesuatu di sisi mereka - gejalanya persis error
            // "Failed to find any playable formats" yang muncul di bot ini. yt-dlp (Python,
            // di-update sangat sering oleh komunitasnya) jauh lebih tahan banting, jadi link
            // & pencarian YouTube sekarang lewat YtDlpPlugin juga.
            // Binary yt-dlp dibangun oleh pnpm saat dependency dipasang. Jangan
            // download ulang saat startup: plugin akan menimpa wrapper lokal
            // yang membersihkan flag deprecated sebelum output JSON dibaca.
            // YtDlpPlugin WAJIB jadi plugin TERAKHIR (dukung 900+ situs lain: YouTube, TikTok, Twitter, dsb).
            new YtDlpPlugin({ update: false })
        ]
    });
    // Expose the same plugin instance to /play so fallback search can resolve
    // a SoundCloud track first and then hand its canonical URL to DisTube.
    // This avoids relying on the `scsearch:` parser inside an already-failed
    // play attempt.
    distube.soundCloudPlugin = soundCloudPlugin;
    distube.reanchorMusicPanel = reanchorMusicPanel;
    distube.updateMusicPanel = updateMusicPanel;

    distube
        .on("initQueue", (queue) => {
            // Terapkan volume default dari settings.js setiap kali queue baru dibuat.
            queue.volume = settings.music.defaultVolume;
            queue.autoplay = false;
        })
        .on("playSong", async (queue, song) => {
            const guildId = queue.textChannel?.guildId || queue.id;
            clearNpInterval(guildId);
            recordHistory(guildId, song);

            const message = await updateMusicPanel(queue, song);
            if (!message) return;

            // (v3.1) Live-update progress bar tiap NP_UPDATE_INTERVAL_MS, selama masih
            // lagu yang sama & belum di-pause (kalau di-pause, bar toh tidak bergerak,
            // jadi diskip biar hemat request ke Discord).
            const interval = setInterval(async () => {
                const currentQueue = distube.getQueue(guildId);
                if (!currentQueue || currentQueue.songs?.[0] !== song || currentQueue.stopped) {
                    clearNpInterval(guildId);
                    return;
                }
                if (currentQueue.paused) return;

                try {
                    await message.edit({
                        embeds: [buildNowPlayingEmbed(currentQueue, song)],
                        components: buildControlRows(currentQueue)
                    });
                } catch {
                    clearNpInterval(guildId);
                }
            }, NP_UPDATE_INTERVAL_MS);
            npIntervals.set(guildId, interval);
        })
        .on("addSong", async (queue, song) => {
            logger.info(`[MUSIC] ${queue.textChannel?.guildId || queue.id}: ${song.name} masuk antrian.`);
            await updateMusicPanel(queue, queue.songs?.[0]);
        })
        .on("addList", async (queue, playlist) => {
            logger.info(`[MUSIC] ${queue.textChannel?.guildId || queue.id}: playlist ${playlist.name} (${playlist.songs.length} lagu) masuk antrian.`);
            await updateMusicPanel(queue, queue.songs?.[0]);
        })
        .on("addRelatedSong", (queue, song) => {
            logger.info(`[MUSIC] Autoplay menambahkan lagu terkait: ${song.name}`);
        })
        .on("empty", (queue) => {
            // Catatan: sejak DisTube v5, event "empty" ini tidak lagi di-emit otomatis oleh library.
            // Deteksi channel kosong sekarang dilakukan manual lewat listener "voiceStateUpdate" di bawah,
            // yang juga sudah menghormati mode 24/7 (/247) sebelum event ini di-emit.
            setPanelIdle(queue.textChannel?.guildId || queue.id, "Voice channel kosong, musik dihentikan.");
        })
        .on("finish", (queue) => {
            const guildId = queue.textChannel?.guildId || queue.id;
            clearNpInterval(guildId);

            const guard247 = is247Enabled(guildId);
            setPanelIdle(
                guildId,
                `Antrian musik selesai.${guard247 ? " Mode 24/7 aktif, bot tetap standby di voice channel." : ""}`
            );
            // DisTube v5 tidak lagi otomatis keluar voice channel saat antrian habis,
            // jadi kita tegakkan sendiri sesuai settings.music.leaveOnFinish - kecuali
            // mode 24/7 (/247) sedang aktif di server ini, maka bot tetap standby.
            if (settings.music.leaveOnFinish && !guard247) {
                queue.voice?.leave();
            }
        })
        .on("disconnect", (queue) => {
            const guildId = queue.textChannel?.guildId || queue.id;
            clearNpInterval(guildId);
            setPanelIdle(guildId, "Bot terputus dari voice channel. Panel tetap disimpan untuk pemutaran berikutnya.");
            resumeGuardIfNeeded(client, queue);
        })
        .on("noRelated", (queue) => {
            setPanelIdle(queue.textChannel?.guildId || queue.id, "Autoplay tidak menemukan lagu terkait.");
        })
        .on("error", (error, queue, song) => {
            logger.error(`DisTube error: ${error?.stack || error}`);
            const extra = song ? ` (\`${song.name}\`)` : "";
            const rawMessage = error?.message || String(error);

            // Deteksi beberapa pola error yt-dlp yang paling sering dilaporkan,
            // biar user langsung dapat petunjuk perbaikan, bukan cuma pesan error mentah.
            let hint = "";
            if (/enoent/i.test(rawMessage) && /yt-dlp/i.test(rawMessage)) {
                hint =
                    "\n\n💡 **Kemungkinan penyebab:** binary `yt-dlp` belum berhasil ke-download di server (sering terjadi di hosting dengan IP bersama seperti Replit, biasanya karena rate-limit GitHub). Lihat README bagian **Troubleshooting: Error JSON/ENOENT saat Play Link YouTube**.";
            } else if (/sign in to confirm/i.test(rawMessage)) {
                hint =
                    "\n\n💡 **Kemungkinan penyebab:** YouTube mendeteksi request otomatis dari IP server ini (umum terjadi di hosting cloud/shared kayak Replit/Railway). Sudah ada fallback otomatis di `settings.js` → `music.youtube` (`playerClients`, `jsRuntime`, `forceIpv4`), tapi kalau masih terjadi terus, lihat README bagian **Troubleshooting** untuk opsi cookies.";
            } else if (/json/i.test(rawMessage) && (/unexpected token/i.test(rawMessage) || /position 0/i.test(rawMessage))) {
                hint =
                    "\n\n💡 **Kemungkinan penyebab:** binary `yt-dlp` di server bermasalah/ketinggalan versi. Lihat README bagian **Troubleshooting: Error JSON/ENOENT saat Play Link YouTube**.";
            }

            setPanelIdle(
                queue?.textChannel?.guildId || queue?.id,
                `Pemutaran gagal${extra}: ${rawMessage}${hint}`
            );
        });

    // DisTube v5 tidak lagi punya opsi "leaveOnEmpty" bawaan, jadi kita cek manual setiap kali
    // ada perubahan voice state (member join/leave/mute/dsb) apakah voice channel bot jadi kosong.
    if (settings.music.leaveOnEmpty) {
        client.on("voiceStateUpdate", (oldState, newState) => {
            const guildId = oldState.guild?.id || newState.guild?.id;
            if (!guildId) return;

            const queue = distube.getQueue(guildId);
            if (!queue || !queue.voice?.channel) return;

            // Mode 24/7 (/247) aktif -> bot tetap standby walau channel kosong, jangan leave.
            if (is247Enabled(guildId)) return;

            if (isVoiceChannelEmpty(queue.voice.channel)) {
                distube.emit("empty", queue);
                queue.voice.leave();
            }
        });
    }

    client.distube = distube;
    logger.info("Music system (DisTube) berhasil diinisialisasi.");
    return distube;
}

module.exports = { setupMusic, loopLabel, progressBar, statusLine, BASS_BOOST_PRESETS, is247Enabled };