/* JAN POHL 761383, RAVELL HEERDEGEN 761330 */

function clientLog(socket, text) {
    socket.emit("clientlog", {log: text});
}

module.exports = { clientLog };