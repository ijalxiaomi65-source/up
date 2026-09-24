/**
 * Helper format untuk fitur musik (dipisah dari utils/music.js supaya
 * utils/musicPanel.js & utils/musicButtons.js bisa require ini tanpa
 * circular-dependency ke utils/music.js).
 */
const REPEAT_LABELS = ["Off", "Lagu Ini", "Semua Antrian"];

/**
 * Preset filter bass boost. DisTube v5 default cuma `bass=g=10` yang kurang
 * "nendang" (makanya kedengaran cempreng/tipis). `dynaudnorm` ditambahkan
 * biar bass yang dinaikin ga bikin suara pecah/clipping di gain tinggi.
 */
const BASS_BOOST_PRESETS = {
    rendah: { label: "Rendah", value: "bass=g=12:f=100:w=0.6,dynaudnorm=f=200:g=10" },
    sedang: { label: "Sedang", value: "bass=g=20:f=100:w=0.6,dynaudnorm=f=200:g=12" },
    tinggi: { label: "Tinggi", value: "bass=g=28:f=100:w=0.6,dynaudnorm=f=200:g=15" },
    ekstra: { label: "Ekstra", value: "bass=g=36:f=100:w=0.6,dynaudnorm=f=150:g=18" }
};

function loopLabel(mode) {
    return REPEAT_LABELS[mode] ?? "Off";
}

/** Progress bar teks bergaya "modern" (pill/slider) untuk /nowplaying & panel musik. */
function progressBar(current, total, size = 18) {
    if (!total || Number.isNaN(total)) return "🔴 **LIVE**";
    const percent = Math.min(Math.max(current / total, 0), 1);
    const filled = Math.round(size * percent);
    const bar = "─".repeat(Math.max(filled - 1, 0)) + "●" + "─".repeat(Math.max(size - filled, 0));
    return `\`${bar}\``;
}

function statusLine(queue) {
    return (
        `🔊 Volume: \`${queue.volume}%\` | ` +
        `🔁 Loop: \`${loopLabel(queue.repeatMode)}\` | ` +
        `▶️ Autoplay: \`${queue.autoplay ? "Aktif" : "Nonaktif"}\``
    );
}

module.exports = { REPEAT_LABELS, BASS_BOOST_PRESETS, loopLabel, progressBar, statusLine };
