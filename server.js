/* JAN POHL 761383, RAVELL HEERDEGEN 761330 */

/* Initialisation of all modules and prototypes START */
const express = require("express"); //Get module express
const app = express(); // Our app is an express application
var siofu = require("socketio-file-upload");

app.use(express.static(__dirname + "/public")); //Default path for assets is public/...
app.use('/js', express.static(__dirname + '/node_modules/bootstrap/dist/js')); // redirect bootstrap JS
app.use('/js', express.static(__dirname + '/node_modules/jquery/dist')); // redirect JS jQuery
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css')); // redirect CSS bootstrap
app.use('/css', express.static(__dirname + '/node_modules/@mdi/font/css')); // redirect CSS MaterialDesignIcons
app.use(siofu.router);

// Server variables START
var users = []; // Sockets
// Server variables END

/* Start Server */
server = app.listen(3000, () => {
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

    uploader.on("start", (data) => {
        data.file.mtime = new Date(); // is needed for compatibility for all browsers
    })

    uploader.on("saved", (data) => {
        console.log("Successfully saved file");
        data.file.pathName = data.file.pathName.replace("public", "");

        // FIlemapping

        userMessage = new Message;
        userMessage.sendername = data.file.meta.sender;
        userMessage.messageHead = "<div class='headMessageDiv' style='" + "color:" + socket.colorCode + "'>" + "<p class='nameMessageTag'>" + userMessage.sendername + "</p>" + "</div>";
        userMessage.messageBody = 
        "<div class='bodyMessageDiv'>" +
            "<div class='row'>" +
                "<div style='display: flex; justify-content: center; padding-right: 0; width: 60px'>" + "<i class='material-icons fileIncomeIcon'>input</i>" + "</div>" +
                "<div class='fileNameSpan' style='padding-left: 0'>" + data.file.name + "</div>" +
                "<div style='padding-left: 0; width: 80px; margin-right: 16px;'>" + 
                    "<a href='" + data.file.pathName + "' download='" + data.file.name + "' class='btn' style='width: 100%; background: #43a047'><i class='material-icons' style='color: lightgrey'>get_app</i></a>" +
                "</div>" +
            "</div>" +
        "</div>";
        userMessage.messageFooter = "<div class='footerMessageDiv'>" + new Date().toUTCString() + "</div>";
        userMessage.room = new Room;
        userMessage.room.roomname = data.file.meta.room;
        
        io.in(data.file.meta.room).emit("file", {
            message: userMessage
        });
    });

    uploader.on("error", (data) => {
        console.log(data);
        console.log("Failed to upload file");
        data.file.clientDetail.errorDOMElement = "<div class='errorDomElements'>" 
        + "<li class='list-group-item'>"
        + "<p>" + data.file.meta.sender + "</p>"
        + "<div class='textDiv'>" + "<span class='text-danger errorMessage'> File upload failed. </span>" + "</div>"
        + "</li>"
        + "</div>"
    });
    //Socket is the connection of the user
    
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
        room = new Room;
        room.roomname = ownUsername + otherUsername;
        room.sendername = ownUsername; //Fritz
        room.recipientname = otherUsername; //Ursula
        
        socket.join(room.roomname);
        othersocket = users.find(f => f.username === otherUsername);
        othersocket.join(room.roomname);

        io.in(room.roomname).emit("established_private_room", {
            room: room
        });
    });

    socket.on("update_chattabs", (data, callback) => {
        callback = buildChatTabs;
        callback(data);
    });

    /**
     * Event triggered when receiving a send_all-emit of a client
     */
    socket.on("send", (data) => {
        message = data.message;
        room = data.room;
        userMessage = buildTextMessage(socket, message, room);
        io.in(room).emit("send", {
            message: userMessage
        });
    });

    /**
     * Event triggered when closing the tab, logging out or timing out or refreshing page
     */
    socket.on("disconnecting", (callback) => {
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
    username = username.trim();
    // Proof of length
    if (username.length < 3 || username.length > 24) {
        return "Username is too short or too long (3 - 24 characters)";
    // Proof of characters
    } else if(!/^([a-z]|[A-Z])+.*/.test(username) || username === "undefined") {
        return "Username is invalid (Begin with letter)";
    // Proof of existence
    } else {
        for (i = 0; i < users.length; i++) {
            if (users[i].username === username) {
                return "Username already taken";
            }
        }
        return "valid";
    }
}

/**
 * Handles the login process of checking for valid username and redirecting if login is successful or not
 * @param {Socket} socket the connecting client socket
 * @param {any} data the login data like username and socket.id
 */
function emitLoginEvent(socket, data) {
    usernameValid = proofUsername(data.username);
    if (usernameValid !== "valid") {
        socket.emit('login_failed', {text: usernameValid}); //send fail-emit to sender socket
    } else {
        socket.username = data.username;
        socket.id = data.userid;
        socket.colorCode = data.color;
        socket.join("AllChat");
        users.push(socket); // Add client to active users
        // Build the message object
        userConnectedMessage = buildLoginMessage(socket);
        io.in("AllChat").emit("login_successful", { // emit to all users in allchat-room
            message: userConnectedMessage
        });
    } 
}

/**
 * Builds the login message of a new user
 * @param {Socket} socket the client which connected to the server
 */
function buildLoginMessage(socket) {
    userConnectedMessage = new Message;
    userConnectedMessage.sendername = socket.username;
    userConnectedMessage.room = new Room;
    userConnectedMessage.room.roomname = "AllChat";
    userConnectedMessage.room.sendername = "AllChat";
    userConnectedMessage.room.recipientname = "AllChat";
    //build message head body and footer
    userConnectedMessage.messageHead = "";
    userConnectedMessage.messageBody = "<div class='bodyMessageDiv' style='color: #00ff6a'>" + userConnectedMessage.sendername + " has connected" + "</div>";
    userConnectedMessage.messageFooter = "<div class='footerMessageDiv'>" + new Date().toUTCString() + "</div>"; 
    // ---
    userConnectedMessage.chatDOM = "<ul class='list-group' id='chatWindow'></ul>";
    userConnectedMessage.loggedInAsString = userConnectedMessage.sendername;
    userConnectedMessage.usersOnlineListDOM = buildOnlineUsersList();
    return userConnectedMessage;
}

/**
 * Handles the logout process like disconnecting the client and inform the other users
 * @param {Socket} socket the disconnecting client socket
 */
function emitLogoutEvent(socket) {
    var index;
    for (i = 0; i < users.length; i++) {
        if (users[i].username === socket.username) {
            index = i;
        }
    }
    users.splice(index, 1); // Delete disconnecting user from active users
    userDisconnectedMessage = buildLogoutMessage(socket);
    io.in("AllChat").emit("disconnecting", { // emit to all users in allchat-room
        message: userDisconnectedMessage
    });
}

/**
 * Builds the logout message of an user
 * @param {Socket} socket the client which disconnected from the server
 */
function buildLogoutMessage(socket) {
    userDisconnectedMessage = new Message;
    userDisconnectedMessage.sendername = socket.username;
    userDisconnectedMessage.messageHead = "";
    userDisconnectedMessage.messageBody = "<div class='text-danger bodyMessageDiv'>" + userDisconnectedMessage.sendername + " has disconnected" + "</div>";
    userDisconnectedMessage.messageFooter = "<div class='footerMessageDiv'>" + new Date().toUTCString() + "</div>";
    userDisconnectedMessage.usersOnlineListDOM = buildOnlineUsersList();
    userDisconnectedMessage.room = new Room;
    userDisconnectedMessage.room.roomname = "AllChat";
    return userDisconnectedMessage;
}

/**
 * Builds a normal text-message of an user
 * @param {Socket} socket the client which sends the message
 * @param message the message to send
 * @param room the name of the room to send the message to
 */
function buildTextMessage(socket, message, room) {
    userMessage = new Message;
    userMessage.sendername = socket.username;
    userMessage.messageHead = "<div class='headMessageDiv' style='" + "color:" + socket.colorCode + "'>" + "<p class='nameMessageTag'>" + userMessage.sendername + "</p>" + "</div>";
    userMessage.messageBody = "<div class='bodyMessageDiv'>" + message + "</div>";
    userMessage.messageFooter = "<div class='footerMessageDiv'>" + new Date().toUTCString() + "</div>";
    userMessage.room = new Room;
    userMessage.room.roomname = room;
    return userMessage;
}

/**
 * Builds the client-sided list of active users to build private chats with
 */
function buildOnlineUsersList() {
    content = "";
    for (i = 0; i < users.length; i++) {
        content = content + 
            "<button type='button' class='btn btn-dark' id='" + 
            users[i].username + "'" + " onclick='createPrivateRoom(" + users[i].username  + ")'" +
            "style='" + "background:" + "linear-gradient(" + "110deg," + users[i].colorCode + " 20%," + "#37474f 20%" + ")" + "'>" +
            users[i].username + 
            "</button>";
    }
    return content;
}

/**
 * Builds the chat tabs area of one client
 * @param {string} data the data of the socket (client)
 */
function buildChatTabs(data) {
    socket = users.find(f => f.username === data.username);
    chatTabsDOMElements = "";
    rooms = data.rooms;
    rooms.forEach(room => {
        if (room.sendername === socket.username) {
            chatTabDOM = "<button type='button' class='btn' style='background: #37474f' id='" + room.roomname + 
            "' onclick='switchChatTabs(" + room.roomname  + ")'>" + room.recipientname + "</button>";
            chatTabsDOMElements += chatTabDOM;
        } else {
            chatTabDOM = "<button type='button' class='btn' style='background: #37474f' id='" + room.roomname + 
            "' onclick='switchChatTabs(" + room.roomname  + ")'>" + room.sendername + "</button>";
            chatTabsDOMElements += chatTabDOM;
        }
    });
    socket.emit("update_chattabs", {
        chattabs: chatTabsDOMElements
    });
}

/* Callbacks and Event Handlings END */

/* Object models START */

function Message() {
    this.sendername = "";
    this.messageHead = "";
    this.messageBody = "";
    this.messageFooter = "";
    this.room = "";
}

function LoginMessage() {
    Message.call(this);
    this.chatDOM = "";
    this.loggedInAsString = "";
    this.usersOnlineListDOM = "";
}

function FileMessage() {
    Message.call(this); // Inheritance of Message
    this.fileurl = "";
}

function Room() {
    this.roomname = "";
    this.sendername = "";
    this.chatContent = [];
    this.recipientname = "";
}

/* Object models END */

