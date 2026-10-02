const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { LavalinkRest } = require("../src/music/LavalinkRest");
test("Lavalink REST retains HTTP status and safe operation details for non-JSON proxy failures", async (t) => {
    const requests = [];
    const server = http.createServer((req, res) => {
        requests.push(req.method);
        if (req.url === "/v4/info") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ version: { semver: "4.0.0" } }));
        } else {
            res.writeHead(405, { "Content-Type": "text/html" });
            res.end("<html>private proxy response</html>");
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const rest = new LavalinkRest(
        { manager: { options: { userAgent: "test", restTimeout: 2 } }, sessionId: "private-session" },
        { url: `127.0.0.1:${server.address().port}`, secure: false, auth: "private-password" },
    );
    assert.equal((await rest.getLavalinkInfo()).version.semver, "4.0.0");
    await assert.rejects(rest.updateSession(true, 60), (e) => {
        assert.match(e.message, /PATCH session failed \(HTTP 405\)/);
        assert.doesNotMatch(e.message, /private|password|Authorization/);
        assert.equal(e.status, 405);
        return true;
    });
    assert.deepEqual(requests, ["GET", "PATCH"]);
});
