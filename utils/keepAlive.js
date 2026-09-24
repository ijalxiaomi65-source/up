/**
 * ============================================
 *  KEEP ALIVE / HEALTH CHECK SERVER (Render.com)
 * ============================================
 * Discord bot sebenarnya tidak butuh web server - tapi kalau di-deploy
 * sebagai "Web Service" di Render (satu-satunya jenis service yang gratis;
 * "Background Worker" berbayar), Render WAJIB bisa mendeteksi port yang
 * "listening", kalau tidak, deploy akan dianggap gagal setelah beberapa
 * menit. Server kecil ini cuma buat itu - tidak ada logic bot di sini.
 *
 * Render menyuntikkan PORT lewat environment variable secara otomatis,
 * jadi JANGAN hardcode port di sini.
 */
const http = require("http");
const logger = require("./logger.js");

/**
 * @param {import("discord.js").Client|import("discord.js").Client[]} clientOrClients
 */
function startKeepAliveServer(clientOrClients) {
    const clients = Array.isArray(clientOrClients) ? clientOrClients : [clientOrClients];
    const port = process.env.PORT || 3000;

    const server = http.createServer((req, res) => {
        const statuses = clients
            .filter(Boolean)
            .map((c) => ({ bot: c.botLabel || c.user?.tag || null, online: !!c.isReady?.() }));
        const allOnline = statuses.length > 0 && statuses.every((s) => s.online);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: allOnline ? "online" : "starting", bots: statuses }));
    });

    server.listen(port, () => {
        logger.info(`Keep-alive HTTP server jalan di port ${port} (untuk Render health check).`);
    });

    return server;
}

module.exports = { startKeepAliveServer };
