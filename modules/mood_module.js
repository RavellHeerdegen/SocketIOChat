/* JAN POHL 761383, RAVELL HEERDEGEN 761330 */

const https = require("https");

/**
 * Proofs the mood of a user via the given message
 * @param {String} message the message to proof
 */
function getMood(message) {
    return new Promise((resolve, reject) => {

        const options = {
            "method": "POST",
            "hostname": "clever-banach.eu-de.mybluemix.net",
            "path": [
                "tone"
            ],
            "headers": {
                "Content-Type": "application/json",
                "cache-control": "no-cache"
            }
        }

        var req = https.request(options, (res) => {
            var chunks = [];

            res.on("data", (chunk) => {
                chunks.push(chunk);
            });

            res.on("end", () => {
                var body = Buffer.concat(chunks);
                let jsonmood = body.toString();
                jsonmood = JSON.parse(jsonmood);
                resolve(jsonmood.mood);
            });
        });

        req.write(JSON.stringify({ texts: [message, ""] }));
        req.end();
    });
}

module.exports = {getMood};