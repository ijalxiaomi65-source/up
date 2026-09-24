const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const settings = require("./settings.js");
const logger = require("./utils/logger.js");
const { printBanner } = require("./utils/banner.js");
const { loadCommands } = require("./handlers/commandHandler.js");
const { loadEvents } = require("./handlers/eventHandler.js");
const { loadPrefixCommands } = require("./handlers/prefixCommandHandler.js");
const { startKeepAliveServer } = require("./utils/keepAlive.js");

// @distube/yt-dlp combines stdout and stderr before parsing JSON. Newer
// yt-dlp versions print a deprecation notice for the plugin's hard-coded
// --no-call-home flag, so use a tiny wrapper that removes only that obsolete
// flag while keeping all normal yt-dlp output intact.
process.env.YTDLP_DIR ||= path.join(__dirname, "bin");
process.env.YTDLP_FILENAME ||= "yt-dlp-wrapper.sh";

const { setupMusic } = require("./utils/music.js");

printBanner();

function normalizeNetscapeCookies(rawText) {
    const cookieText = rawText.replace(/^\uFEFF/, "").trim();
    const hasValidRows = cookieText
        .split(/\r?\n/)
        .some((line) => line && !line.startsWith("#") && line.split("\t").length >= 7);

    if (hasValidRows || !cookieText.startsWith("# Netscape HTTP Cookie File")) {
        return cookieText;
    }

    // Some secret forms flatten multiline values into one line. Recover that
    // shape only when the tab-separated Netscape fields remain unambiguous.
    const tokens = cookieText.split("\t");
    if (tokens.length < 7 || (tokens.length - 1) % 6 !== 0) {
        return cookieText;
    }

    const domainAtEnd = /(?:[A-Za-z0-9_-]+)(?:\.[A-Za-z0-9_-]+)+$/;
    const firstDomain = domainAtEnd.exec(tokens[0]);
    if (!firstDomain) return cookieText;

    const rows = [];
    let fields = [firstDomain[0], ...tokens.slice(1, 6)];

    for (let i = 6; i < tokens.length - 1; i += 6) {
        const nextDomain = domainAtEnd.exec(tokens[i]);
        if (!nextDomain) return cookieText;

        fields.push(tokens[i].slice(0, nextDomain.index));
        rows.push(fields);
        fields = [nextDomain[0], ...tokens.slice(i + 1, i + 6)];
    }

    fields.push(tokens[tokens.length - 1]);
    rows.push(fields);

    const validRows = rows.every((row) =>
        row.length === 7 &&
        (row[1] === "TRUE" || row[1] === "FALSE") &&
        row[2].startsWith("/") &&
        (row[3] === "TRUE" || row[3] === "FALSE") &&
        /^\d+$/.test(row[4])
    );

    if (!validRows) return cookieText;

    return `# Netscape HTTP Cookie File\n${rows.map((row) => row.join("\t")).join("\n")}`;
}

// Tulis cookies rahasia ke file lokal saat start agar tidak perlu di-commit.
if (process.env.YT_COOKIES) {
    try {
        const rawCookieText = process.env.YT_COOKIES;
        const cookieText = normalizeNetscapeCookies(rawCookieText);
        if (cookieText !== rawCookieText.replace(/^\uFEFF/, "").trim()) {
            logger.info("YT_COOKIES dinormalisasi menjadi baris Netscape sebelum dipakai yt-dlp.");
        }
        if (!cookieText.includes("Netscape HTTP Cookie File") && !cookieText.split("\n").some((line) => line.split("\t").length >= 7)) {
            logger.warn("YT_COOKIES terisi tetapi formatnya tidak terlihat seperti Netscape cookies.txt.");
        }
        fs.writeFileSync(path.join(__dirname, "cookies.txt"), `${cookieText}\n`, { encoding: "utf8", mode: 0o600 });
        logger.info(`cookies.txt ditulis dari YT_COOKIES (${cookieText.length} karakter).`);
    } catch (err) {
        logger.error(`Gagal menulis cookies.txt dari YT_COOKIES: ${err.message}`);
    }
}

if (!settings.token) {
    logger.error("Token bot UTAMA belum diisi! Isi Environment Variable DISCORD_TOKEN di dashboard Render (atau lokal via env var) dengan token bot kamu.");
    process.exit(1);
}
if (!settings.clientId) {
    logger.error("Client ID bot UTAMA belum diisi! Isi Environment Variable CLIENT_ID di dashboard Render (atau lokal via env var) dengan Application ID bot kamu.");
    process.exit(1);
}

const FULL_INTENTS = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
];

/**
 * Bikin & jalanin satu instance bot Discord (client + login).
 * Music berjalan langsung di client utama.
 *
 * @param {{ token: string, clientId: string, mode: "full"|"music", label: string }} config
 */
function startBot({ token, clientId, label }) {
    if (!token) {
        logger.error(`[${label}] Dilewati: token kosong.`);
        return null;
    }

    const client = new Client({
        intents: FULL_INTENTS,
        partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.Reaction, Partials.User]
    });

    client.botLabel = label;
    client.botToken = token;
    client.botClientId = clientId;
    client.botMode = "full";
    client.commands = new Collection();
    client.pendingBroadcasts = new Collection();

    loadCommands(client, "full");
    loadEvents(client, "full");
    setupMusic(client);

    client.login(token).catch((err) => {
        logger.error(`[${label}] Gagal login: ${err.message}`);
    });

    return client;
}

const clients = [];

// Bot UTAMA - akses semua fitur (moderation, economy, ticket, leveling, dst),
// termasuk kategori music.
const mainClient = startBot({ token: settings.token, clientId: settings.clientId, label: "UTAMA" });
if (mainClient) clients.push(mainClient);

// Prefix command "z..." cuma relevan buat bot utama (bot musik tidak
// memuat event messageCreate sama sekali - lihat handlers/eventHandler.js),
// jadi cukup dimuat sekali di sini.
loadPrefixCommands();

logger.info("Mode satu bot aktif: fitur musik berjalan di bot utama.");

// Server HTTP kecil supaya Render (kalau di-deploy sebagai Web Service)
// mendeteksi port aktif dan tidak menganggap deploy gagal. Tidak berpengaruh
// apa pun ke logic bot Discord-nya. Satu server buat SEMUA bot (dipanggil
// sekali saja, bukan per-client, karena cuma ada satu PORT per service).
startKeepAliveServer(clients);

process.on("unhandledRejection", (err) => {
    logger.error(`Unhandled promise rejection: ${err?.stack || err}`);
});
process.on("uncaughtException", (err) => {
    logger.error(`Uncaught exception: ${err?.stack || err}`);
});

module.exports = { mainClient, clients };
