const { databaseClient } = require("../client.js");
const { normalizeLegacy } = require("../../../database/migration/normalizeLegacy.js");
async function migrate(source, fingerprint, client = databaseClient()) {
    const normalized = normalizeLegacy(source);
    const { data, error } = await client.rpc("import_legacy", {
        source_hash: fingerprint,
        payload: normalized.rows,
        original: source,
    });
    if (error)
        throw new Error(`Migration transaction rejected: ${error.code || "database error"}`, {
            cause: error,
        });
    return { ...normalized, report: data };
}
async function validate(rows, client = databaseClient()) {
    const { data, error } = await client.rpc("verify_legacy", { payload: rows });
    if (error)
        throw new Error(`Migration verification rejected: ${error.code || "database error"}`, {
            cause: error,
        });
    return data;
}
module.exports = { migrate, validate };
