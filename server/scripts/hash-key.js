import crypto from "node:crypto";

var id = process.argv[2] || "web";
var key = process.argv[3] || crypto.randomBytes(32).toString("base64url");
var hash = crypto.createHash("sha256").update(key).digest("hex");

console.log("");
console.log("API key (guardala en el cliente / gestor de secretos):");
console.log("  " + key);
console.log("");
console.log("SHA-256 (va en API_KEYS del servidor):");
console.log("  " + hash);
console.log("");
console.log("Entrada para API_KEYS:");
console.log(JSON.stringify([{ id: id, keyHash: hash, scopes: ["analyze", "live"], ips: [] }]));
console.log("");
