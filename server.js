/* JAN POHL 761383, RAVELL HEERDEGEN 761330 */


/* Initialisation of all modules and prototypes START */
const express = require("express"); //Get module express
const app = express(); // Our app is an express application
const ss = require('socket.io-stream'); // for streaming files
const moodmodule = require("./modules/mood_module");
const databasemodule = require("./modules/database_module");
const logger = require("./modules/logger");
var fs = require('fs');

app.use(express.static(__dirname + "/public")); //Default path for assets is public/...
app.use('/js', express.static(__dirname + '/node_modules/bootstrap/dist/js')); // redirect bootstrap JS
app.use('/js', express.static(__dirname + '/node_modules/jquery/dist')); // redirect JS jQuery
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css')); // redirect CSS bootstrap
app.use('/css', express.static(__dirname + '/node_modules/@mdi/font/css')); // redirect CSS MaterialDesignIcons
app.use('/js', express.static(__dirname + '/node_modules/socket.io-stream')); // redirect JS Socket-io-Stream

// Server variables START
var users = []; // Sockets
var files = {},
    struct = {
        name: null,
        type: null,
        size: 0,
        data: [],
        slice: 0,
    };
var VisualRecognitionV3 = require('watson-developer-cloud/visual-recognition/v3');

var visualRecognition = new VisualRecognitionV3({
    version: '2018-03-19',
    iam_apikey: 'zbNcTeWowygqtJ_FBgSQB8AloInXCuOMoYrdLfIxEly4',
    headers: {
        'X-Watson-Learning-Opt-Out': 'true'
    }
});
// Server variables END
let port = process.env.PORT || 3000;
/* Start Server */
server = app.listen(port, () => {
    console.log('Server running on port' + port);
});
const io = require("socket.io")(server); // Socket is attached to server

/* Routes START */

/**
 * Called when someone requests the homepage
 */
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/pages/index.html");
});

app.get('/socket.io-stream.js', (req, res, next) => {
    return res.sendFile(__dirname + '/node_modules/socket.io-stream/socket.io-stream.js');
});

/* Routes END */

/* Initialisation of all modules and prototypes END */

/* IO Handlings (user connects to server) START */

/**
 * Called when a new socket connects to the server
 */
io.on("connection", (socket) => {

    ss(socket).on('file_upload', (stream, data) => {

        users.forEach(user => {
            rooms = Object.keys(socket.rooms);
            if (rooms.find(room => room === data.room.roomname)) {
                clientstream = ss.createStream();

                date = new Date();

                ss(user).emit('file_upload', clientstream, {
                    sender: data.sender,
                    colorCode: data.colorcode,
                    timeStamp: date.getDay() + "." + date.getMonth() + "." + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes(),
                    name: data.name,
                    size: data.size,
                    type: data.type,
                    room: data.room
                });
                stream.pipe(clientstream);
            }
        });
    });

    socket.on('profile_pic_upload', (data) => {

        if (!files[data.name]) {
            files[data.name] = Object.assign({}, struct, data);
            files[data.name].data = [];
        }

        //convert the ArrayBuffer to Buffer 
        data.data = new Buffer.from(new Uint8Array(data.data));
        //save the data 
        files[data.name].data.push(data.data);
        files[data.name].slice++;

        if (files[data.name].slice * 100000 >= files[data.name].size) {
            //do something with the data
            var fileBuffer = Buffer.concat(files[data.name].data);
            fs.writeFile("./tmp/" + data.name, fileBuffer, (err) => {

                if (err) {
                    logger.clientLog(socket, err);
                }
                images_file = fs.createReadStream("./tmp/" + data.name);

                var params = {
                    images_file: images_file
                };
                visualRecognition.detectFaces(params, function (err, response) {
                    if (err) {
                        socket.emit("face_recog_failed", { text: "Face detection failed. Please try again", result: false });
                    } else {
                        detection = JSON.stringify(response, null, 2);
                        detectionobject = JSON.parse(detection);
                        if (detectionobject.images[0]["faces"].length > 0) {
                            socket.emit("face_recog_success", { text: "Face detection successful", result: detection, filename: data.name });
                        } else {
                            socket.emit("face_recog_failed", { text: "Face detection failed: Found no face", result: false });
                        }
                    }
                    // delete files[data.name]; // wenn bild wirklich hochgeladen wird und von tmp auch löschen
                    delete files[data.name];
                    fs.unlink("./tmp/" + data.name, (err) => {
                        if (err) {
                            logger.clientLog(socket, err);
                        }
                    });
                });
            });

        } else {
            socket.emit('profile_pic_upload_request', {
                currentSlice: files[data.name].slice
            });
        }
    });

    //Socket is the connection of the user

    /**
     * Event triggered when receiving a login-emit of a client
     */
    socket.on("login", (data, callback) => {
        callback = emitLoginEvent;
        callback(socket, data);
    });

    socket.on("register_with_pic", (data, callback) => {
        callback = emitRegisterWithPicEvent;
        callback(socket, data);
    });

    /**
     * Event triggered when receiving a new registration event of client
     */
    socket.on("register", (data, callback) => {
        callback = emitRegisterEvent;
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

    // Handles the updatechattabs event and delegates to build the tabs of a specific user
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
        buildTextMessage(socket, message, room).then((result) => {
            userMessage = result;
            io.in(room).emit("send", {
                message: userMessage
            });
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
function proofCredential(credential, token) {
    credential = credential.trim();
    indicator = "";
    credentialminlength = 0;
    credentialmaxlength = 24;
    if (token == "U") {
        indicator = "Username";
        credentialminlength = 3;
    } else {
        indicator = "Password";
        credentialminlength = 8;
    }
    // Proof of length
    if (credential.length < credentialminlength || credential.length > credentialmaxlength) {
        return indicator + " is too short or too long (" + credentialminlength + " - 24 characters)";
    }
    if (token == "U") {
        if (!/^([a-z]|[A-Z])+.*/.test(credential) || credential === "undefined") {
            return indicator + " is invalid (Begin with letter)";
        }
    }
    if (credential.includes("<") || credential.includes(">")) {
        return indicator + " is invalid (< and > aren't allowed)";
    }
    if (token == "P") {
        if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+/.test(credential)) {
            return "valid";
        } else {
            return indicator + " does not contain big character, number and small character";
        }
    }
    return "valid";
}

/**
 * Handles the login process of checking for valid username and redirecting if login is successful or not
 * @param {Socket} socket the connecting client socket
 * @param {any} data the login data like username and socket.id
 */
function emitLoginEvent(socket, data) {
    if (data.username.length == 0 || data.password.length == 0) {
        socket.emit("login_failed", { text: "Missing credentials, please type a name and password" });
        return;
    }
    usernameValid = proofCredential(data.username, "U");
    passwordValid = proofCredential(data.password, "P");
    if (usernameValid != "valid" && passwordValid == "valid") {
        socket.emit("login_failed", { text: usernameValid });
        return;
    }
    if (usernameValid == "valid" && passwordValid != "valid") {
        socket.emit("login_failed", { text: passwordValid });
        return;
    }
    if (usernameValid != "valid" && passwordValid != "valid") {
        socket.emit("login_failed", { text: "Username and password are incorrect" });
        return;
    }
    databasemodule.login(data.username, data.password).then((success) => {
        if (success) {
            databasemodule.getProfilePictureOfUser(socket, data.username).then((result) => {
                if (result) {
                    buffer = Buffer.from(result);
                    console.log(Buffer.from(buffer).toString("base64"));
                    socket.emit("result", { data: result});
                } else {
                    console.log("Error");
                }
            });
            console.log("Eingeloggt");
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
        } else {
            socket.emit("login_failed", { text: "User not registered" });
        }
    });
}

function emitRegisterEvent(socket, data, callback) {
    try {
        if (data.username.length == 0 || data.password.length == 0) {
            socket.emit("register_failed", { text: "Missing credentials, please type a name and password" });
        } else {
            usernameValid = proofCredential(data.username, "U");
            passwordValid = proofCredential(data.password, "P");
            if (usernameValid == "valid" && passwordValid == "valid") {
                databasemodule.proofUsernameTaken(data.username).then((taken) => {
                    if (taken) {
                        socket.emit("register_failed", { text: "Username already taken" });
                    } else {
                        databasemodule.register(data.username, data.password).then((success) => {
                            if (success) {
                                socket.emit("register_successful", { text: "Registrierung erfolgreich. Loggen Sie sich mit Ihren Daten ein" })
                            } else {
                                socket.emit("register_failed", { text: "Registrierung fehlgeschlagen" });
                            }
                        });
                    }
                });
            } else {
                if (usernameValid != "valid" && passwordValid == "valid") {
                    socket.emit("register_failed", { text: usernameValid });
                }
                if (usernameValid == "valid" && passwordValid != "valid") {
                    socket.emit("register_failed", { text: passwordValid });
                }
                if (usernameValid != "valid" && passwordValid != "valid") {
                    socket.emit("register_failed", { text: "Username and password are incorrect" });
                }
            }
        }
    } catch (err) {
        console.log(err);
    }
}

function emitRegisterWithPicEvent(socket, data) {
    if (!files[data.name]) {
        structobject = {
            name: data.name,
            type: data.type,
            size: data.size,
            data: [],
            slice: 0,
        };
        files[data.name] = structobject;
        files[data.name].data = [];
    }
    username = data.username;
    password = data.password;

    //convert the ArrayBuffer to Buffer 
    data.data = new Buffer.from(new Uint8Array(data.data));
    //save the data 
    files[data.name].data.push(data.data);
    files[data.name].slice++;

    if (files[data.name].slice * 100000 >= files[data.name].size) {
        //do something with the data
        var fileBuffer = Buffer.concat(files[data.name].data);
        buffer = Buffer.from(fileBuffer);
        base64string = Buffer.from(buffer).toString("base64");

        fs.writeFile("./tmp/" + data.name, fileBuffer, (err) => {
            if (err) {
                logger.clientLog(socket, "Register mit bild anlegen auf tmp geht nicht");
                return;
            }
            try {
                databasemodule.registerWithPic(username, password, base64string).then((success) => {
                    if (success) {
                        console.log("Registrierung erfolgreich");
                    }
                });
            } catch (err) {
                logger.clientLog(socket, err);
            }
        });

    } else {
        socket.emit('register_with_pic_request', {
            currentSlice: files[data.name].slice
        });
    }
}

/**
 * Builds the login message of a new user
 * @param {Socket} socket the client which connected to the server
 */
function buildLoginMessage(socket) {
    date = new Date();

    userConnectedMessage = new Message;
    userConnectedMessage.sendername = socket.username;
    userConnectedMessage.room = new Room;
    userConnectedMessage.room.roomname = "AllChat";
    userConnectedMessage.room.sendername = "AllChat";
    userConnectedMessage.room.recipientname = "AllChat";
    //build message head body and footer
    userConnectedMessage.messageHead = "";
    userConnectedMessage.messageBody = "<div class='bodyMessageDiv' style='color: #00ff6a'>" + userConnectedMessage.sendername + " has connected" + "</div>";
    userConnectedMessage.messageFooter = "<div class='footerMessageDiv'>" + date.getDay() +
        "." + date.getMonth() + "." + date.getFullYear() + " " + date.getHours() +
        ":" + date.getMinutes() + "</div>";
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
    if (socket.username !== undefined && socket !== null) {

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
}

/**
 * Builds the logout message of an user
 * @param {Socket} socket the client which disconnected from the server
 */
function buildLogoutMessage(socket) {
    date = new Date();

    userDisconnectedMessage = new Message;
    userDisconnectedMessage.sendername = socket.username;
    userDisconnectedMessage.messageHead = "";
    userDisconnectedMessage.messageBody = "<div class='text-danger bodyMessageDiv'>" + userDisconnectedMessage.sendername + " has disconnected" + "</div>";
    userDisconnectedMessage.messageFooter = "<div class='footerMessageDiv'>" + date.getDay() + "." + date.getMonth() +
        "." + date.getFullYear() + " " + date.getHours() +
        ":" + date.getMinutes() + "</div>";
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
    date = new Date();

    let moodresult;

    var promiseresult = moodmodule.getMood(message);

    return promiseresult.then((result) => {
        moodresult = result;
        userMessage = new Message;
        userMessage.sendername = socket.username;
        userMessage.messageHead = "<div class='headMessageDiv' style='" + "color:" + socket.colorCode + "'>" + "<p class='nameMessageTag'>" + userMessage.sendername + " (" + moodresult + ")" + "</p>" + "</div>";
        userMessage.messageBody = "<div class='bodyMessageDiv'>" + message.replace(/(<([^>]+)>)/ig, "") + "</div>";
        userMessage.messageFooter = "<div class='footerMessageDiv'>" + date.getDay() + "." + date.getMonth() +
            "." + date.getFullYear() + " " + date.getHours() +
            ":" + date.getMinutes() + "</div>";
        userMessage.room = new Room;
        userMessage.room.roomname = room;
        return userMessage;
    });

}

/**
 * Builds the client-sided list of active users to build private chats with
 */
function buildOnlineUsersList() {
    content = "";
    for (i = 0; i < users.length; i++) {
        content = content +
            "<button type='button' class='btn btn-dark' id='" +
            users[i].username + "'" + " onclick='createPrivateRoom(" + users[i].username + ")'" +
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
                "' onclick='switchChatTabs(" + room.roomname + ")'>" + room.recipientname + "</button>";
            chatTabsDOMElements += chatTabDOM;
        } else {
            chatTabDOM = "<button type='button' class='btn' style='background: #37474f' id='" + room.roomname +
                "' onclick='switchChatTabs(" + room.roomname + ")'>" + room.sendername + "</button>";
            chatTabsDOMElements += chatTabDOM;
        }
    });
    socket.emit("update_chattabs", {
        chattabs: chatTabsDOMElements
    });
}



/* Callbacks and Event Handlings END */

/* Object models START */

/**
 * Message model for communication
 */
function Message() {
    this.sendername = "";
    this.messageHead = "";
    this.messageBody = "";
    this.messageFooter = "";
    this.room = "";
}

/**
 * LoginMessage model for logins
 */
function LoginMessage() {
    Message.call(this); // Inheritance of Message
    this.chatDOM = "";
    this.loggedInAsString = "";
    this.usersOnlineListDOM = "";
}

/**
 * FileMessage model for file uploads
 */
function FileMessage() {
    Message.call(this); // Inheritance of Message
    this.fileurl = "";
}

/**
 * Room model for chat-rooms
 */
function Room() {
    this.roomname = "";
    this.sendername = "";
    this.chatContent = [];
    this.recipientname = "";
}

/* Object models END */

