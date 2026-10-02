const settings = require("../settings.js");
const logger = require("./logger.js");
const db = require("./database.js");
const { createLavalink } = require("../src/music/LavalinkManager.js");
const { MusicManager } = require("../src/music/MusicManager.js");
const { MusicPanelUpdater } = require("../src/music/MusicPanelUpdater.js");
const { recordHistory } = require("./musicFeatures.js");
const format = require("./musicFormat.js");
function is247Enabled(guildId) {
    return Boolean(guildId && db.getGuild(guildId).musicMode247);
}
function setupMusic(client) {
    if (!settings.music.enabled) return null;
    const panels = new MusicPanelUpdater(client, db, logger);
    const music = new MusicManager({
        client,
        lavalink: createLavalink(client, logger),
        panels,
        settings,
        repository: db,
        history: recordHistory,
        logger,
    });
    music.lavalink.on("ready", () => {
        music.restorePlayers().catch((error) => logger.error(`Player restore: ${error.message}`));
        for (const [guildId, config] of Object.entries(db.getDB().guilds)) {
            const guild = client.guilds.cache.get(guildId);
            if (guild && config.vcGuard?.enabled && !music.getQueue(guildId)) {
                require("./voiceGuard.js")
                    .startGuard(guild, config.vcGuard.channelId, config.vcGuard.textChannelId)
                    .catch((error) => logger.warn(`Voice guard restore: ${error.message}`));
            }
        }
    });
    client.music = music;
    // Compatibility facade for existing command modules; no DisTube engine remains.
    client.distube = music;
    client.on("guildDelete", (guild) => {
        music.leave(guild.id).catch((error) => logger.error(error.message));
        panels.forget(guild.id);
    });
    client.on("messageDelete", (message) => {
        if (panels.panels.get(message.guildId)?.id === message.id) panels.forget(message.guildId);
    });
    client.on("voiceStateUpdate", (oldState, nextState) => {
        if (nextState.id === client.user?.id && oldState.channelId && !nextState.channelId) {
            require("./voiceGuard.js").scheduleReconnect(nextState.guild);
        }
        const queue = music.getQueue(nextState.guild.id);
        if (!queue || is247Enabled(queue.id) || !settings.music.leaveOnEmpty) return;
        if (queue.voiceChannel.members.filter((member) => !member.user.bot).size === 0) {
            music.leave(queue.id).catch((error) => logger.error(error.message));
        }
    });
    return music;
}
module.exports = { setupMusic, ...format, is247Enabled };
