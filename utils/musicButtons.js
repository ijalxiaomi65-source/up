/**
 * ============================================
 *  MUSIC BUTTONS & MORE-FEATURES MENU (v3)
 * ============================================
 */
const settings = require("../settings.js");
const db = require("./database.js");
const { createErrorEmbed, createInfoEmbed, createSuccessEmbed } = require("./embeds.js");
const { buildNowPlayingEmbed, buildIdleMusicEmbed, buildControlRows } = require("./musicPanel.js");

const MAX_QUEUE_SHOWN = 15;
const MAX_FAVORITES = 50;

function getQueueOrReplyError(interaction) {
    const queue = interaction.client.distube?.getQueue(interaction.guildId);
    if (!queue || !queue.songs?.length) {
        interaction.reply({ embeds: [createErrorEmbed("Tidak ada musik yang sedang diputar di server ini.")], ephemeral: true }).catch(() => {});
        return null;
    }
    return queue;
}

/** Member harus di voice channel yang sama dengan bot untuk aksi yang mengubah playback. */
function memberInSameVoice(interaction, queue) {
    const memberVoice = interaction.member?.voice?.channel;
    if (!memberVoice) return { ok: false, reason: "Kamu harus join voice channel terlebih dahulu!" };
    if (queue.voiceChannel && queue.voiceChannel.id !== memberVoice.id) {
        return { ok: false, reason: `Kamu harus berada di voice channel yang sama dengan bot: <#${queue.voiceChannel.id}>` };
    }
    return { ok: true };
}

/** Setelah aksi berhasil mengubah state, update ulang panel Now Playing di tempat (edit pesan yang sama). */
async function refreshPanel(interaction, queue) {
    const song = queue.songs[0];
    if (!song) {
        return interaction.update({ embeds: [createInfoEmbed("Antrian sudah kosong.")], components: [] }).catch(() => {});
    }
    await interaction.update({ embeds: [buildNowPlayingEmbed(queue, song)], components: buildControlRows(queue) }).catch(() => {});
}

async function handleMusicButton(interaction) {
    const id = interaction.customId;
    const queue = getQueueOrReplyError(interaction);
    if (!queue) return;

    // Tombol read-only (boleh dipakai siapa saja, tidak perlu di voice channel yang sama).
    if (id === "music_queue") return sendQueueList(interaction, queue);
    if (id === "music_fav") return toggleFavorite(interaction, queue);

    // Tombol yang mengubah playback -> wajib di voice channel yang sama dengan bot.
    const check = memberInSameVoice(interaction, queue);
    if (!check.ok) {
        return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true }).catch(() => {});
    }

    try {
        if (id === "music_prev") {
            if (!queue.previousSongs?.length) {
                return interaction.reply({ embeds: [createErrorEmbed("Tidak ada lagu sebelumnya.")], ephemeral: true });
            }
            await queue.previous();
            return refreshPanel(interaction, queue);
        }

        if (id === "music_playpause") {
            if (queue.paused) queue.resume();
            else queue.pause();
            return refreshPanel(interaction, queue);
        }

        if (id === "music_skip") {
            if (queue.songs.length <= 1 && !queue.autoplay) {
                return interaction.reply({ embeds: [createErrorEmbed("Tidak ada lagu selanjutnya di antrian.")], ephemeral: true });
            }
            await queue.skip();
            return refreshPanel(interaction, queue);
        }

        if (id === "music_shuffle") {
            if (queue.songs.length <= 2) {
                return interaction.reply({ embeds: [createErrorEmbed("Antrian terlalu pendek untuk diacak.")], ephemeral: true });
            }
            queue.shuffle();
            return refreshPanel(interaction, queue);
        }

        if (id === "music_loop") {
            const nextMode = (queue.repeatMode + 1) % 3; // Off -> Lagu Ini -> Semua Antrian -> Off
            queue.setRepeatMode(nextMode);
            return refreshPanel(interaction, queue);
        }

        if (id === "music_volup") {
            queue.setVolume(Math.min(150, queue.volume + 10));
            return refreshPanel(interaction, queue);
        }

        if (id === "music_voldown") {
            queue.setVolume(Math.max(0, queue.volume - 10));
            return refreshPanel(interaction, queue);
        }

        if (id === "music_autoplay") {
            queue.autoplay = !queue.autoplay;
            return refreshPanel(interaction, queue);
        }

        if (id === "music_replay") {
            const song = queue.songs[0];
            if (song?.isLive) {
                return interaction.reply({ embeds: [createErrorEmbed("Tidak bisa mengulang siaran live.")], ephemeral: true });
            }
            await queue.seek(0);
            return refreshPanel(interaction, queue);
        }

        if (id === "music_bassboost") {
            if (queue.filters.has("bassboost")) {
                queue.filters.remove("bassboost");
            } else {
                queue.filters.add("bassboost");
            }
            return refreshPanel(interaction, queue);
        }

        if (id === "music_disconnect") {
            const voice = queue.voice;
            await queue.stop();
            voice?.leave();
            return interaction.update({
                embeds: [buildIdleMusicEmbed("Bot terputus dari voice channel.")],
                components: buildControlRows(null)
            });
        }

        if (id === "music_stop") {
            const voice = queue.voice;
            await queue.stop();
            if (settings.music.leaveOnStop) voice?.leave();
            return interaction.update({
                embeds: [buildIdleMusicEmbed("Musik dihentikan dan antrian dihapus.")],
                components: buildControlRows(null)
            });
        }
    } catch (err) {
        return interaction.reply({ embeds: [createErrorEmbed(`Gagal memproses aksi: \`${err.message}\``)], ephemeral: true }).catch(() => {});
    }
}

async function sendQueueList(interaction, queue) {
    const shown = queue.songs.slice(0, MAX_QUEUE_SHOWN);
    const lines = shown.map((song, i) => {
        const prefix = i === 0 ? "🎶 **Sedang Diputar:**" : `**${i}.**`;
        return `${prefix} [${song.name}](${song.url}) \`[${song.formattedDuration}]\``;
    });
    const remaining = queue.songs.length - shown.length;
    const more = remaining > 0 ? `\n...dan **${remaining}** lagu lainnya.` : "";

    await interaction.reply({
        embeds: [createInfoEmbed(`${lines.join("\n")}${more}`, `📜 Antrian Musik (${queue.songs.length} lagu)`)],
        ephemeral: true
    });
}

async function toggleFavorite(interaction, queue) {
    const song = queue.songs[0];
    if (!song) return;

    const user = db.getUser(interaction.user.id);
    const favorites = user.favoriteSongs || [];
    const existingIndex = favorites.findIndex((f) => f.url === song.url);

    if (existingIndex >= 0) {
        favorites.splice(existingIndex, 1);
        db.updateUser(interaction.user.id, { favoriteSongs: favorites });
        return interaction.reply({
            embeds: [createInfoEmbed(`**${song.name}** dihapus dari favorit kamu.`, "💔 Dihapus dari Favorit")],
            ephemeral: true
        });
    }

    favorites.unshift({ name: song.name, url: song.url, addedAt: Date.now() });
    if (favorites.length > MAX_FAVORITES) favorites.length = MAX_FAVORITES;
    db.updateUser(interaction.user.id, { favoriteSongs: favorites });

    return interaction.reply({
        embeds: [createSuccessEmbed(`**${song.name}** ditambahkan ke favorit kamu! Cek pakai \`/favorites\` atau menu "More Features".`, "❤️ Ditambahkan ke Favorit")],
        ephemeral: true
    });
}

// ---------------- MORE FEATURES SELECT MENU ----------------

async function handleMusicMoreMenu(interaction) {
    const value = interaction.values[0];
    const queue = getQueueOrReplyError(interaction);
    if (!queue) return;

    if (value === "favorites") return sendFavoritesList(interaction);
    if (value === "lyrics") return sendLyrics(interaction, queue);

    if (value.startsWith("effect_")) {
        const check = memberInSameVoice(interaction, queue);
        if (!check.ok) {
            return interaction.reply({ embeds: [createErrorEmbed(check.reason)], ephemeral: true }).catch(() => {});
        }

        const effect = value.slice("effect_".length);
        try {
            if (effect === "off") {
                queue.filters.clear();
            } else {
                queue.filters.clear();
                queue.filters.add(effect);
            }
            return interaction.update({
                embeds: [buildNowPlayingEmbed(queue, queue.songs[0])],
                components: buildControlRows(queue)
            });
        } catch (err) {
            return interaction.reply({
                embeds: [createErrorEmbed(`Gagal menerapkan efek audio: \`${err.message}\``)],
                ephemeral: true
            }).catch(() => {});
        }
    }
}

/** Untuk aksi read-only (favorit, lirik) yang balasnya ephemeral & tidak mengubah playback. */

async function sendFavoritesList(interaction) {
    const user = db.getUser(interaction.user.id);
    const favorites = user.favoriteSongs || [];

    if (!favorites.length) {
        return interaction.reply({
            embeds: [createInfoEmbed("Kamu belum punya lagu favorit. Klik tombol ❤️ di panel musik untuk menambahkan.", "⭐ Favorit Kamu")],
            ephemeral: true
        });
    }

    const lines = favorites.slice(0, 20).map((f, i) => `**${i + 1}.** [${f.name}](${f.url})`);
    await interaction.reply({
        embeds: [createInfoEmbed(lines.join("\n"), `⭐ Favorit Kamu (${favorites.length} lagu)`)],
        ephemeral: true
    });
}

/**
 * Coba ambil lirik dari lyrics.ovh (API gratis, tanpa API key).
 * Best-effort: nama lagu di-parse kasar jadi "artis - judul", banyak nama lagu
 * YouTube yang berantakan jadi kadang tidak ketemu -> kasih pesan yang jelas.
 */
async function sendLyrics(interaction, queue) {
    const song = queue.songs[0];
    if (!song) return;

    await interaction.deferReply({ ephemeral: true });

    let artist = "";
    let title = song.name;
    const separators = [" - ", " – ", " | "];
    for (const sep of separators) {
        if (song.name.includes(sep)) {
            const parts = song.name.split(sep);
            artist = parts[0].trim();
            title = parts.slice(1).join(sep).trim();
            break;
        }
    }

    // Bersihkan embel-embel umum judul YouTube yang bikin pencarian lirik gagal.
    title = title.replace(/\(.*?(official|lyrics|video|audio|mv|hd).*?\)/gi, "").replace(/\[.*?\]/g, "").trim();

    try {
        const query = artist ? `${encodeURIComponent(artist)}/${encodeURIComponent(title)}` : `unknown/${encodeURIComponent(title)}`;
        const res = await fetch(`https://api.lyrics.ovh/v1/${query}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();

        if (!data.lyrics) {
            return interaction.editReply({
                embeds: [createErrorEmbed("Lirik tidak ditemukan untuk lagu ini.", "📝 Lirik")]
            });
        }

        const lyrics = data.lyrics.length > 3900 ? `${data.lyrics.slice(0, 3900)}...\n\n*(lirik dipotong, terlalu panjang)*` : data.lyrics;

        await interaction.editReply({
            embeds: [createInfoEmbed(lyrics, `📝 Lirik — ${song.name}`)]
        });
    } catch (err) {
        await interaction.editReply({
            embeds: [createErrorEmbed("Lirik tidak ditemukan / gagal diambil untuk lagu ini. Judul dari YouTube kadang tidak cocok dengan database lirik.", "📝 Lirik")]
        });
    }
}

module.exports = { handleMusicButton, handleMusicMoreMenu };
