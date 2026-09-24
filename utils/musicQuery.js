const URL_PATTERN = /^(?:https?:\/\/|www\.)/i;
const KNOWN_HOST_PATTERN = /(?:youtube\.com|youtu\.be|music\.youtube\.com|spotify\.com|soundcloud\.com)/i;
const SEARCH_PREFIX_PATTERN = /^(?:ytsearch\d*:|scsearch\d*:|spsearch\d*:|spotify:|soundcloud:)/i;

function isUrl(value) {
    return URL_PATTERN.test(value) || KNOWN_HOST_PATTERN.test(value);
}

function isYouTubeInput(value) {
    return /(?:youtube\.com|youtu\.be|music\.youtube\.com)/i.test(value) || /^ytsearch\d*:/i.test(value);
}

/**
 * DisTube/YtDlpPlugin tidak selalu menebak bahwa teks biasa adalah pencarian.
 * Prefix eksplisit ini membuat judul seperti "lagu galau full album 2026"
 * dicari di YouTube, bukan dianggap sebagai URL yang harus dicari persis.
 */
function normalizeMusicQuery(input) {
    const value = String(input || "").trim();
    if (!value) return value;

    if (SEARCH_PREFIX_PATTERN.test(value)) return value;
    if (isUrl(value)) {
        return URL_PATTERN.test(value) ? value : `https://${value}`;
    }

    return `ytsearch1:${value}`;
}

module.exports = { normalizeMusicQuery, isYouTubeInput, isUrl };