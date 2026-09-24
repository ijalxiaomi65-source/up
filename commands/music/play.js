const { SlashCommandBuilder } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");
const settings = require("../../settings.js");
const { createErrorEmbed, createInfoEmbed, createSuccessEmbed } = require("../../utils/embeds.js");
const { stopGuard } = require("../../utils/voiceGuard.js");
const { sleep } = require("../../utils/sleep.js");
const { resolveYoutubeAudio, probeYoutubeAudio, resolveRapidApiAudio } = require("../../utils/youtubeDlExec.js");
const { normalizeMusicQuery, isYouTubeInput, isUrl } = require("../../utils/musicQuery.js");
const logger = require("../../utils/logger.js");

// Batas waktu tunggu distube.play() sebelum kita anggap "macet" dan mulai
// coba jalur alternatif / kasih tahu user, alih-alih diem selamanya sampai
// interaction token expired (inilah gejala "ga ada respon sama sekali").
const PLAY_TIMEOUT_MS = 25000;
const FALLBACK_TIMEOUT_MS = 20000;

const YOUTUBE_URL_REGEX = /(youtube\.com|youtu\.be)/i;

function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function findSoundCloudTrack(distube, searchTerms) {
    const plugin = distube.soundCloudPlugin;
    if (!plugin?.search) {
        throw new Error("SoundCloud search plugin tidak tersedia.");
    }

    for (const searchTerm of searchTerms) {
        const tracks = await plugin.search(searchTerm, "track", 5);
        const track = tracks.find((candidate) => candidate?.url);
        if (track) return track;
    }
    return null;
}

async function getSoundCloudSearchTerms(query, playerQuery) {
    if (!isUrl(query) && !isYouTubeInput(playerQuery)) {
        return [query.trim()];
    }

    if (/^ytsearch\d*:/i.test(playerQuery)) {
        return [playerQuery.replace(/^ytsearch\d*:/i, "").trim()];
    }

    if (!YOUTUBE_URL_REGEX.test(query)) return null;

    try {
        const response = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(query)}&format=json`,
            { signal: AbortSignal.timeout(7000) }
        );
        if (!response.ok) return null;

        const metadata = await response.json();
        // SoundCloud search is more reliable with the video's title alone.
        // Appending the YouTube channel name can turn a valid title into a
        // query that has no SoundCloud match.
        const title = String(metadata.title || "").trim().slice(0, 240);
        if (!title) return [];

        // A medley title often contains several distinct song names. Search
        // the longer segments first so a generic phrase like "DJ TikTok"
        // does not win over the specific song contained in the same title.
        const segments = title
            .split(/[-|🎵]+/u)
            .map((segment) => segment.trim())
            .filter((segment) => segment.length >= 12)
            .sort((a, b) => b.length - a.length);
        return [...new Set([...segments, title])];
    } catch {
        return [];
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Putar musik dari YouTube, Spotify, SoundCloud, atau judul lagu")
        .addStringOption((o) =>
            o
                .setName("query")
                .setDescription("Judul lagu, nama artis, atau link YouTube/Spotify/SoundCloud")
                .setRequired(true)
        ),
    category: "music",
    async execute(interaction) {
        const query = interaction.options.getString("query", true).trim();
        const playerQuery = normalizeMusicQuery(query);
        const voiceChannel = interaction.member.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({
                embeds: [createErrorEmbed("Kamu harus join voice channel terlebih dahulu untuk memutar musik!")],
                ephemeral: true
            });
        }

        const botMember = interaction.guild.members.me;
        const permissions = voiceChannel.permissionsFor(botMember);
        if (!permissions?.has(["Connect", "Speak"])) {
            return interaction.reply({
                embeds: [createErrorEmbed("Bot tidak memiliki izin **Connect** dan **Speak** di voice channel tersebut!")],
                ephemeral: true
            });
        }

        const distube = interaction.client.distube;
        if (!distube) {
            return interaction.reply({
                embeds: [createErrorEmbed("Fitur music sedang tidak aktif di bot ini.")],
                ephemeral: true
            });
        }

        const existingQueue = distube.getQueue(interaction.guildId);
        if (existingQueue && existingQueue.songs.length >= settings.music.maxQueueSize) {
            return interaction.reply({
                embeds: [createErrorEmbed(`Antrian sudah penuh (maksimal **${settings.music.maxQueueSize}** lagu).`)],
                ephemeral: true
            });
        }

        // Kalau guild ini belum punya queue DisTube tapi masih ada koneksi voice
        // mentah yang nyangkut (paling sering dari /vcguard, bisa juga sisa
        // koneksi lama yang gagal dibersihkan), DisTube akan menolak join dengan
        // error "This guild already has a voice connection which is not managed
        // by DisTube". Lepas dulu koneksi lama itu supaya DisTube bisa ambil alih.
        if (!existingQueue && getVoiceConnection(interaction.guildId)) {
            stopGuard(interaction.guildId);
        }

        await interaction.deferReply();
        await interaction.editReply({
            embeds: [createInfoEmbed(`Mencari dan memproses: **${query}**...`, "🔎 Memproses")]
        });

        const playOpts = { textChannel: interaction.channel, member: interaction.member };
        const reanchorPanel = () =>
            distube.reanchorMusicPanel?.(interaction.guildId, interaction.channel).catch(() => {});

        try {
            // Googlevideo sering mengizinkan yt-dlp membaca metadata tetapi
            // menolak request media dari IP Replit. RapidAPI mengambil MP3
            // dari egress mereka sendiri, lalu DisTube memutar link MP3 itu.
            if (YOUTUBE_URL_REGEX.test(query) && process.env.RAPIDAPI_KEY) {
                const rapidAudio = await withTimeout(
                    resolveRapidApiAudio(query, FALLBACK_TIMEOUT_MS),
                    FALLBACK_TIMEOUT_MS + 2000
                );

                await withTimeout(
                    distube.play(voiceChannel, rapidAudio.url, playOpts),
                    PLAY_TIMEOUT_MS
                );
                const rapidQueue = distube.getQueue(interaction.guildId);
                await interaction.editReply({
                    embeds: [
                        createSuccessEmbed(
                            rapidQueue?.songs?.length > 1
                                ? `**${rapidAudio.title || query}** masuk ke antrian lewat YouTube.`
                                : `**${rapidAudio.title || query}** mulai diputar lewat YouTube.`,
                            "🎶 Paseban Musik"
                        )
                    ]
                }).catch(() => {});
                await reanchorPanel();
                return;
            }

            // Metadata resolution can succeed while Googlevideo rejects the
            // later FFmpeg request with HTTP 403. Detect that before creating
            // a queue so the SoundCloud fallback can play without briefly
            // showing a broken YouTube item in the panel.
            if (YOUTUBE_URL_REGEX.test(query)) {
                const resolvedYoutube = await withTimeout(
                    resolveYoutubeAudio(playerQuery, FALLBACK_TIMEOUT_MS),
                    FALLBACK_TIMEOUT_MS + 2000
                );
                const mediaProbe = await probeYoutubeAudio(resolvedYoutube);
                if (!mediaProbe.ok) {
                    throw new Error(
                        `Stream YouTube tidak bisa diakses oleh server (${mediaProbe.reason || "probe gagal"}).`
                    );
                }
            }

            // (v4) Dibungkus timeout: kalau proses yt-dlp di balik distube.play()
            // macet/hang (bukan error, cuma diem), kita berhenti nunggu di sini
            // supaya interaction tetap dapat balasan, bukan diem sampai token
            // interaction-nya expired (±15 menit) tanpa apa-apa sama sekali.
            await withTimeout(distube.play(voiceChannel, playerQuery, playOpts), PLAY_TIMEOUT_MS);
            const queueAfterPlay = distube.getQueue(interaction.guildId);
            await interaction.editReply({
                embeds: [
                    createSuccessEmbed(
                        queueAfterPlay?.songs?.length > 1
                            ? `**${query}** masuk ke antrian. Panel musik di bawah akan tetap dipakai untuk semua lagu.`
                            : `**${query}** mulai diputar. Gunakan panel Paseban untuk mengatur musik.`,
                        "🎶 Paseban Musik"
                    )
                ]
            }).catch(() => {});
            await reanchorPanel();
            return;
        } catch (err) {
            const isTimeout = err.message === "TIMEOUT";
            logger.error(`/play gagal untuk query "${query}": ${isTimeout ? "TIMEOUT setelah " + PLAY_TIMEOUT_MS + "ms" : err.message}`);

            if (isTimeout) {
                // Proses aslinya mungkin sebenarnya berhasil beberapa saat setelah
                // kita berhenti nunggu (server lagi lambat, bukan macet total).
                // Cek dulu sebelum coba jalur alternatif, biar tidak dobel-play.
                await sleep(3000);
                const queueNow = distube.getQueue(interaction.guildId);
                if (queueNow?.songs?.length) {
                    await interaction
                        .editReply({
                            embeds: [createSuccessEmbed("Sempat lambat, tapi musiknya sudah mulai diputar. 🎶", "✅ Berhasil")]
                        })
                        .catch(() => {});
                    await reanchorPanel();
                    return;
                }
            }

            let soundCloudError = null;
            const canTrySoundCloud = !/soundcloud\.com|spotify\.com/i.test(query);
            if (canTrySoundCloud) {
                try {
                    const searchTerms = await getSoundCloudSearchTerms(query, playerQuery);
                    if (searchTerms.length) {
                        await interaction.editReply({
                            embeds: [
                                createInfoEmbed(
                                    "YouTube gagal/lambat, mencari versi yang sama di SoundCloud...",
                                    "🔁 Mencoba SoundCloud"
                                )
                            ]
                        });

                        if (!existingQueue && getVoiceConnection(interaction.guildId)) {
                            stopGuard(interaction.guildId);
                        }

                        // Resolve through the plugin directly, then pass the
                        // canonical SoundCloud URL to DisTube. This is more
                        // stable than asking DisTube to parse `scsearch1:`
                        // during a fallback after YouTube failed.
                        const soundCloudTrack = await findSoundCloudTrack(distube, searchTerms);
                        if (!soundCloudTrack) {
                            throw new Error(`SoundCloud tidak menemukan track yang cocok.`);
                        }

                        await withTimeout(
                            distube.play(voiceChannel, soundCloudTrack.url, playOpts),
                            PLAY_TIMEOUT_MS
                        );
                        await interaction.editReply({
                            embeds: [
                                createSuccessEmbed(
                                    `**${soundCloudTrack.name || query}** mulai diputar lewat SoundCloud.`,
                                    "🎶 Paseban Musik"
                                )
                            ]
                        }).catch(() => {});
                        await reanchorPanel();
                        return;
                    }
                } catch (soundCloudErr) {
                    soundCloudError = soundCloudErr;
                    logger.error(`/play fallback SoundCloud gagal untuk "${query}": ${soundCloudErr.message}`);
                }
            }

            // Fallback lewat youtube-dl-exec HANYA untuk link YouTube langsung
            // (bukan judul/Spotify/SoundCloud, karena fallback ini butuh URL asli).
            if (YOUTUBE_URL_REGEX.test(query) || isYouTubeInput(playerQuery)) {
                try {
                    await interaction.editReply({
                        embeds: [createInfoEmbed("Metode utama gagal/lambat, mencoba metode alternatif (`youtube-dl-exec`)...", "🔁 Mencoba Ulang")]
                    });

                    const resolved = await withTimeout(resolveYoutubeAudio(playerQuery, FALLBACK_TIMEOUT_MS), FALLBACK_TIMEOUT_MS + 2000);

                    if (!existingQueue && getVoiceConnection(interaction.guildId)) {
                        stopGuard(interaction.guildId);
                    }

                    await withTimeout(distube.play(voiceChannel, resolved.url, playOpts), PLAY_TIMEOUT_MS);
                    await interaction.editReply({
                        embeds: [createSuccessEmbed(`**${resolved.title || query}** mulai diputar lewat jalur cadangan.`, "🎶 Paseban Musik")]
                    }).catch(() => {});
                    await reanchorPanel();
                    return;
                } catch (fallbackErr) {
                    logger.error(`/play fallback youtube-dl-exec juga gagal untuk "${query}": ${fallbackErr.message}`);
                    return interaction
                        .editReply({
                            embeds: [
                                createErrorEmbed(
                                    `Gagal memutar musik setelah mencoba YouTube, SoundCloud, dan jalur cadangan.\n` +
                                        `• Metode utama: \`${isTimeout ? "timeout / macet" : err.message}\`\n` +
                                        (soundCloudError
                                            ? `• SoundCloud: \`${soundCloudError.message}\`\n`
                                            : `• SoundCloud: tidak menemukan judul yang bisa dicari\n`) +
                                        `• Metode alternatif (youtube-dl-exec): \`${fallbackErr.message}\`\n\n` +
                                        `💡 YouTube sedang memblokir request server dengan pesan "Sign in to confirm you're not a bot". ` +
                                        `Pastikan secret \`YT_COOKIES\` di Replit berisi cookies Netscape asli dengan satu cookie per baris. ` +
                                        `Gunakan akun YouTube khusus, bukan akun utama.`
                                )
                            ]
                        })
                        .catch(() => {});
                }
            }

            return interaction
                .editReply({
                    embeds: [createErrorEmbed(`Gagal memutar musik: \`${isTimeout ? "Proses macet/timeout, coba lagi." : err.message}\``)]
                })
                .catch(() => {});
        }
    }
};
