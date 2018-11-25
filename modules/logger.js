function clientLog(socket, text) {
    socket.emit("clientlog", {log: text});
}

module.exports = { clientLog };