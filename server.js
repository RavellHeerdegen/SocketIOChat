/* Initialisation of all modules and prototypes START */
const express = require("express"); //Get module express
const app = express(); //Instantiate a prototype of express
var siofu = require("socketio-file-upload");

app.use(express.static(__dirname + "/public")); //Default path for route-tracing is public/...
app.use(siofu.router);

// Server variables START
var users = [];
// Server variables END

/* Start Server */
server = app.listen(3000, function() {
    console.log('Server running on port 3000');
  });

const io = require("socket.io")(server); // Socket is attached to server

/* Routes START */

/**
 * Called when someone requests the homepage
 */
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/pages/index.html");
});

/* Routes END */

/* Initialisation of all modules and prototypes END */

/* IO Handlings (user connects to server) START */

/**
 * Called when a new socket connects to the server
 */
io.on("connection", (socket) => {
    var uploader = new siofu();
    uploader.dir = "./public/uploads";
    uploader.listen(socket);

    uploader.on("saved", (data) => {
        console.log(data.file.name);
        console.log(data.file.mtime);
        console.log(data.file.encoding);
        console.log(data.file.meta);
        console.log(data.file.success);
        console.log(data.file.bytesLoaded);
        console.log("SAVED");
    });

    uploader.on("error", (data) => {

        console.log(data);
        console.log("FAIL");
    });
    //Socket is the connection of the user
    socket.username = "Anonymous";
    
    /**
     * Event triggered when receiving a login-emit of a client
     */
    socket.on("login", (data, callback) => {
        callback = emitLoginEvent;
        callback(socket, data);
    });

    /**
     * Creates a private room for two chat partners and emits it to the client for visual feedback
     */
    socket.on("create_private_room", (data) => {
        ownUsername = socket.username;
        otherUsername = data.othername;
        roomname = ownUsername + otherUsername;
        socket.join(roomname);
        othersocket = users.find(f => f.username === otherUsername);
        othersocket.join(roomname);
        buildChatTabs(socket.username);
        buildChatTabs(othersocket.username);
        io.in(roomname).emit("established_private_room", {
            room: roomname,
            requestorsocketname: ownUsername,
            newchatwindow: "<ul class='list-group' id='" + roomname + "window" + "'></ul>"
        });
    });

    socket.on("update_chattabs", (data, callback) => {
        callback = buildChatTabs;
        callback(data.username);
    });

    /**
     * Event triggered when receiving a send_all-emit of a client
     */
    socket.on("send", (data) => {
        io.in(data.room).emit("send", {
            message: "<li class='list-group-item'>" + socket.username + ": " + 
                data.message + "<small class='text-info'>" + " " +  new Date().toUTCString() + "</small>" + "</li>",
            room: data.room 
        });
    });

    /**
     * Event triggered when closing the tab, logging out or timing out or refreshing page
     */
    socket.on("disconnect", (callback) => {
        callback = emitLogoutEvent;
        callback(socket);
    });

});

/* IO Handlings END */

/* Callbacks and Event Handlings START */

/**
 * Proofes if the given username is already taken by another loggedin user
 * @param {string} the username of the connecting client
 */
function proofUsername(username) {
    usernameFound = false;
    for(i = 0; i < users.length; i++) {
        if (users[i].username === username) {
            return true;
        }
    }
    return false;
}

/**
 * Handles the login process of checking for valid username and redirecting if login is successful or not
 * @param {Socket} socket the connecting client socket
 * @param {any} data the login data like username and socket.id
 */
function emitLoginEvent(socket, data) {
    usernameFound = proofUsername(data.username);
    if (usernameFound) {
        socket.emit('login_failed', {text: "Username already taken."}); //send fail-emit to sender socket
    } else {
        socket.username = data.username;
        socket.id = data.userid;
        socket.join("AllChat");
        users.push(socket);
        activeuserscontent = buildOnlineUsersList();
        io.in("AllChat").emit("login_successful", { // emit to all users in allchat-room
            username: socket.username,
            loggedinas: "Logged in as " + socket.username, 
            loggedinusers: "Number of users: " + users.length,
            userconnectedstring: "<li class='list-group-item text-success'>" +
                socket.username + " has connected"  + "</li>",
            usersonlinelist: activeuserscontent,
            newchatwindow: "<ul class='list-group' id='AllChatwindow'></ul>"
        });
    } 
}

/**
 * Handles the logout process like disconnecting the client and inform the other users
 * @param {Socket} socket the disconnecting client socket
 */
function emitLogoutEvent(socket) {
    var index;
    var disconnectingUser;
    for (i = 0; i < users.length; i++) {
        if (users[i].username === socket.username) {
            index = i;
            disconnectingUser = users[i].username;
        }
    }
    users.splice(index, 1);
    activeuserscontent = buildOnlineUsersList();
    io.in("AllChat").emit("disconnect", { // emit to all users in allchat-room
        userdisconnectedstring: "<li class='list-group-item text-danger'>" + disconnectingUser +
            " has disconnected" + "</li>", 
        loggedinusers: "Number of users: " + users.length,
        usersonlinelist: activeuserscontent
    });
}

/**
 * Builds the client-sided list of active users to build private chats with
 */
function buildOnlineUsersList() {
    content = "";
    for (i = 0; i < users.length; i++) {
        content = content + 
            "<div class='row'><button type='button' class='btn btn-default' id='" + 
            users[i].username + "'" + " onclick='createPrivateRoom(" + users[i].username  + ")'>" +
            users[i].username + 
            "</button></div>";
    }
    return content;
}

/**
 * 
 * @param {string} username the username of the socket (client)
 */
function buildChatTabs(username) {
    socket = users.find(f => f.username === username);
    console.log("Found user with name:" + socket.username);
    chatTabsDOMElements = "";
    rooms = Object.keys(socket.rooms);
    rooms.forEach(room => {
        if (room != socket.id) {
            chatTabDOM = "<button type='button' class='btn btn-default' id='" + room + 
                "' onclick='switchChatTabs(" + room  + ")'>" + room + "</button>";
            chatTabsDOMElements += chatTabDOM;
        }
    });
    console.log("Emitting to" + socket.id);
    socket.emit("update_chattabs", {
        chattabs: chatTabsDOMElements
    });
}

/* Callbacks and Event Handlings END */

