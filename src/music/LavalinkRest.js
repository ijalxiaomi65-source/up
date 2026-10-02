const { Rest } = require("shoukaku");
class LavalinkRest extends Rest {
    async fetch(request) {
        try {
            return await super.fetch(request);
        } catch (cause) {
            const status = Number.isInteger(cause.status) ? cause.status : "network";
            const method = ["GET", "PATCH", "POST", "DELETE"].includes(request.options?.method?.toUpperCase())
                ? request.options.method.toUpperCase()
                : "GET";
            // Do not log session IDs, identifiers, voice tokens, headers or bodies.
            const operation = request.endpoint?.startsWith("/sessions/")
                ? request.endpoint.includes("/players")
                    ? "player"
                    : "session"
                : {
                      "/info": "info",
                      "/loadtracks": "search",
                      "/decodetrack": "decode",
                      "/decodetracks": "decode",
                  }[request.endpoint] || "request";
            const hint = [401, 403].includes(status)
                ? "Check node credentials/access policy."
                : status === 405
                  ? "The node/proxy rejected this HTTP method."
                  : status === 404
                    ? "Check Lavalink v4 routing and active session."
                    : "Check Lavalink node and proxy health.";
            const error = new Error(`Lavalink ${method} ${operation} failed (HTTP ${status}). ${hint}`, {
                cause,
            });
            error.status = status;
            throw error;
        }
    }
}
module.exports = { LavalinkRest };
