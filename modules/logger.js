/* JAN POHL 761383, RAVELL HEERDEGEN 761330 */

/**
 * Logs a message to a client
 * @param {Socket} socket the socket to use
 * @param {String} text the message to send
 */
function clientLog(socket, text) {
    socket.emit("clientlog", {log: text});
}

module.exports = { clientLog };