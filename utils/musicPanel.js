/**
 * ============================================
 *  MUSIC PANEL (v3)
 *  Embed + tombol interaktif untuk "Now Playing", terinspirasi dari
 *  panel bot musik populer (play/pause, skip, favorite, more features).
 * ============================================
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const settings = require("../settings.js");
const { baseEmbed } = require("./embeds.js");
const { loopLabel, progressBar } = require("./musicFormat.js");

const MUSIC_EFFECT_OPTIONS = [
    { label: "Normal — Matikan Semua Efek", value: "effect_off", emoji: "🎵" },
    { label: "Nightcore", value: "effect_nightcore", emoji: "⚡" },
    { label: "Vaporwave", value: "effect_vaporwave", emoji: "🌌" },
    { label: "8D Audio", value: "effect_8d", emoji: "🌀" },
    { label: "Karaoke", value: "effect_karaoke", emoji: "🎤" },
    { label: "Echo", value: "effect_echo", emoji: "🏛️" },
    { label: "Pop", value: "effect_pop", emoji: "✨" },
    { label: "Soft / Muffled", value: "effect_soft", emoji: "🌙" },
    { label: "Treble Boost", value: "effect_treble", emoji: "📈" }
];

function buildNowPlayingEmbed(queue, song) {
    const current = queue.formattedCurrentTime ?? "00:00";
    const total = song.formattedDuration ?? "??:??";
    const bar = progressBar(queue.currentTime, song.duration);
    const requester = song.user;

    return baseEmbed(settings.music.panelColor || settings.colors.primary)
        .setAuthor({ name: queue.paused ? "⏸️ Paseban Dijeda" : "🎶 Paseban Musik Majapahit" })
        .setTitle(`🎵 ${song.name}`)
        .setURL(song.url)
        .setDescription(
            `**${queue.paused ? "Musik sedang dijeda" : "Sedang diputar di paseban"}**\n\n` +
            `${bar}  \`${current} / ${total}\`\n` +
            `Panel ini selalu dipindah ke bawah setiap ada request lagu baru.`
        )
        .addFields(
            { name: "🔊 Gending", value: `\`${queue.volume}%\``, inline: true },
            { name: "🔁 Ulang", value: `\`${loopLabel(queue.repeatMode)}\``, inline: true },
            { name: "♾️ Autoplay", value: `\`${queue.autoplay ? "Aktif" : "Nonaktif"}\``, inline: true },
            { name: "📜 Antrian", value: `\`${queue.songs?.length ?? 1} lagu\``, inline: true },
            { name: "👑 Diminta oleh", value: requester ? `${requester}` : "`Tidak diketahui`", inline: false }
        )
        .setImage(song.thumbnail || null)
        .setFooter({
            text: requester ? `Diminta oleh ${requester.displayName ?? requester.username ?? requester}` : settings.botName,
            iconURL: requester?.displayAvatarURL?.() ?? undefined
        })
        .setTimestamp();
}

function buildIdleMusicEmbed(reason = "Belum ada lagu yang diputar.") {
    return baseEmbed(settings.music.panelColor || settings.colors.primary)
        .setAuthor({ name: "🏯 Paseban Musik Majapahit" })
        .setTitle("🎶 Panel Musik Siap")
        .setDescription(
            `**${reason}**\n\n` +
            "Panel ini dipakai ulang untuk lagu berikutnya. Gunakan `/play` dengan judul atau link YouTube."
        )
        .addFields(
            { name: "🎼 Cara mulai", value: "`/play query:judul lagu`", inline: true },
            { name: "🏯 Mode", value: "Satu panel • satu bot", inline: true }
        )
        .setFooter({ text: `${settings.botName} • Paseban Musik` })
        .setTimestamp();
}

/**
 * 5 baris kontrol yang mengikuti panel musik pada screenshot:
 * playback utama, audio/queue, fitur tambahan, Stop, lalu More Features.
 * Semua customId diawali "music_" supaya gampang di-routing di buttonHandler/selectMenuHandler.
 */
function buildControlRows(queue) {
    const noQueue = !queue || !queue.songs?.length;
    const noPrevious = noQueue || !queue.previousSongs?.length;
    const noNext = noQueue || (queue.songs.length <= 1 && !queue.autoplay);
    const noVolDown = noQueue || queue.volume <= 0;
    const noVolUp = noQueue || queue.volume >= 150;

    // Baris 1: playback utama.
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("music_prev").setEmoji("⏮️").setLabel("Sebelum").setStyle(ButtonStyle.Primary).setDisabled(noPrevious),
        new ButtonBuilder()
            .setCustomId("music_playpause")
            .setEmoji(queue?.paused ? "▶️" : "⏸️")
            .setLabel(queue?.paused ? "Putar" : "Jeda")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(noQueue),
        new ButtonBuilder().setCustomId("music_skip").setEmoji("⏭️").setLabel("Berikutnya").setStyle(ButtonStyle.Primary).setDisabled(noNext),
        new ButtonBuilder()
            .setCustomId("music_loop")
            .setEmoji("🔁")
            .setLabel("Ulang")
            .setStyle(queue?.repeatMode ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(noQueue)
    );

    // Baris 2: favorit, antrean, volume, dan acak.
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("music_fav").setEmoji("❤️").setLabel("Favorit").setStyle(ButtonStyle.Danger).setDisabled(noQueue),
        new ButtonBuilder().setCustomId("music_queue").setEmoji("📜").setLabel("Antrian").setStyle(ButtonStyle.Primary).setDisabled(noQueue),
        new ButtonBuilder().setCustomId("music_voldown").setEmoji("🔉").setLabel("Volume −").setStyle(ButtonStyle.Primary).setDisabled(noVolDown),
        new ButtonBuilder().setCustomId("music_volup").setEmoji("🔊").setLabel("Volume +").setStyle(ButtonStyle.Primary).setDisabled(noVolUp),
        new ButtonBuilder().setCustomId("music_shuffle").setEmoji("🔀").setLabel("Acak").setStyle(ButtonStyle.Primary).setDisabled(noQueue)
    );

    // Baris 3: fitur tambahan seperti pada screenshot.
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("music_autoplay")
            .setEmoji("♾️")
            .setLabel("Autoplay")
            .setStyle(queue?.autoplay ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(noQueue),
        new ButtonBuilder().setCustomId("music_replay").setEmoji("⏱️").setLabel("Replay").setStyle(ButtonStyle.Primary).setDisabled(noQueue),
        new ButtonBuilder()
            .setCustomId("music_bassboost")
            .setEmoji("🎚️")
            .setLabel("Bass Boost")
            .setStyle(queue?.filters?.has?.("bassboost") ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(noQueue),
        new ButtonBuilder().setCustomId("music_disconnect").setEmoji("🔌").setLabel("Keluar VC").setStyle(ButtonStyle.Primary).setDisabled(noQueue)
    );

    // Baris 4: Stop dibuat sendiri agar lebih menonjol dan mudah ditemukan.
    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("music_stop").setEmoji("⏹️").setLabel("Stop").setStyle(ButtonStyle.Danger).setDisabled(noQueue)
    );

    // Baris 5: fitur yang butuh teks/hasil panjang.
    const row5 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("music_more_menu")
            .setPlaceholder("✨ More Features...")
            .setDisabled(noQueue)
            .addOptions(
                { label: "Lirik Lagu Ini", value: "lyrics", emoji: "📝" },
                { label: "Favorit Saya", value: "favorites", emoji: "⭐" },
                ...MUSIC_EFFECT_OPTIONS
            )
    );

    return [row1, row2, row3, row4, row5];
}

module.exports = { buildNowPlayingEmbed, buildIdleMusicEmbed, buildControlRows };
