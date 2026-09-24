const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger.js");

const EVENTS_DIR = path.join(__dirname, "..", "events");

// Loader mode "music" tetap disimpan untuk kompatibilitas project lama.
const MUSIC_ONLY_EVENTS = new Set(["ready", "interactionCreate"]);

/**
 * @param {import("discord.js").Client} client
 * @param {"full"|"music"} [mode]
 */
function loadEvents(client, mode = "full") {
    const musicOnlyMode = mode === "music";
    const files = fs.readdirSync(EVENTS_DIR).filter((f) => f.endsWith(".js"));
    let count = 0;

    for (const file of files) {
        const filePath = path.join(EVENTS_DIR, file);
        try {
            delete require.cache[require.resolve(filePath)];
            const event = require(filePath);

            if (!event?.name || !event?.execute) {
                logger.warn(`Event ${file} tidak valid, dilewati.`);
                continue;
            }

            if (musicOnlyMode && !MUSIC_ONLY_EVENTS.has(event.name)) continue;

            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
            count++;
        } catch (err) {
            logger.error(`Gagal memuat event ${file}: ${err.message}`);
        }
    }

    logger.info(`[${client.botLabel || (musicOnlyMode ? "MUSIC" : "MAIN")}] Berhasil memuat ${count} event.`);
}

module.exports = { loadEvents };
