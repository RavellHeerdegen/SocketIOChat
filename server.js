/* JAN POHL 761383, RAVELL HEERDEGEN 761330 */

/* Initialisation of all modules and prototypes START */
const express = require("express"); //Get module express
const app = express(); // Our app is an express application
const ss = require("socket.io-stream"); // for streaming files

// For Redis
const redis = require("redis");
const express_session = require("express-session");
const redisStore = require('connect-redis')(express_session);
const expresssocketiosession = require("express-socket.io-session");
const { URL } = require("url");
const redisDBstring = "rediss://admin:ODRGZNKNYSESGVWU@portal57-10.bmix-eude-yp-4d6848cd-1f90-4625-9a84-c607ba7fa228.220726745.composedb.com:18794";
// For Redis END

// Modules start
const moodmodule = require("./modules/mood_module");
const databasemodule = require("./modules/database_module");
const visualrecognition = require("./modules/visualrecognition_module");
// Modules end
var express_enforces_ssl = require('express-enforces-ssl');
const logger = require("./modules/logger");
const fs = require("fs");
const helmet = require('helmet');
var bcrypt = require('bcryptjs');
var salt = bcrypt.genSaltSync(10);

app.use(express.static(__dirname + "/public")); //Default path for assets is public/...
app.use('/js', express.static(__dirname + '/node_modules/bootstrap/dist/js')); // redirect bootstrap JS
app.use('/js', express.static(__dirname + '/node_modules/jquery/dist')); // redirect JS jQuery
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css')); // redirect CSS bootstrap
app.use('/css', express.static(__dirname + '/node_modules/@mdi/font/css')); // redirect CSS MaterialDesignIcons
app.use('/js', express.static(__dirname + '/node_modules/socket.io-stream')); // redirect JS Socket-io-Stream
app.use(helmet());
app.use(express_enforces_ssl());

// Server variables START
var users = []; // Sockets

// Server variables END
let port = process.env.PORT || 3000;
/* Start Server */
server = app.listen(port, () => {
    console.log('Server running on port' + port);
});

// Sessionstore and pub and sub functionality
let sub = redis.createClient(redisDBstring, {
    tls: { servername: new URL(redisDBstring).hostname }
});

let pub = redis.createClient(redisDBstring, {
    tls: { servername: new URL(redisDBstring).hostname }
});

let rClient = redis.createClient(redisDBstring, {
    tls: { servername: new URL(redisDBstring).hostname }
});

let sessionStore = new redisStore({ client: rClient });
// Sessionstore END

// HANDLE SESSION CONFIGURATION
const session = express_session({
    store: sessionStore,
    key: 'JSESSIONID',
    secret: 'arbitrary-secret',
    proxy: true,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: true
    },
    saveUninitialized: true,
    resave: false
});

app.set('trust proxy', 1);//Trust load balancer
app.use(session);
// HANDLE SESSION CONFIGURATION END

const io = require("socket.io")(server); // Socket is attached to server
io.use(expresssocketiosession(session)); // remember the client session

// Set up Content Security Policy
app.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", 'maxcdn.bootstrapcdn.com', "'unsafe-inline'", "fonts.googleapis.com", "fonts.gstatic.com", '*'],
        imgSrc: ["'self'", "self data: blob:;"],
        fontSrc: ["fonts.googleapis.com", "fonts.gstatic.com", "'self'"],
        connectSrc: ["'self'", "wss://*.mybluemix.net", "socket.io"],
        scriptSrc: ["'self'", "'unsafe-inline'", '*']
    }
}));

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

// SUB METHODS START - these are globally active for every instance started

sub.subscribe("send");
sub.subscribe("login_successful");
sub.subscribe("create_private_room");
sub.subscribe("disconnected_user");

sub.on("message", (channel, message) => {
    try {

        switch (channel) {

            case "login_successful":
                users.forEach(socket => {
                    socket.emit("login_successful", {
                        message: JSON.parse(message)
                    });
                });
                break;
            case "disconnected_user":
                users.forEach(socket => {
                    socket.emit("disconnected_user", {
                        message: JSON.parse(message)
                    });
                });
                break;
            case "send":
                jsonobject = JSON.parse(message);
                users.forEach(socket => {
                    socket.emit("send", {
                        message: jsonobject.message
                    });
                });
                break;
            case "create_private_room":
                jsonobject = JSON.parse(message);
                users.forEach(socket => {
                    if (socket.username === jsonobject.receivername || socket.username === jsonobject.sendername) {
                        socket.join(jsonobject.room.roomname);
                        socket.emit("established_private_room", {
                            room: jsonobject.room
                        });
                    }
                });
                break;
        }
    } catch (err) {
        console.log(err);
    }
});

// SUB METHODS END ----------------------------------------------------------

/* IO Handlings (user connects to server) START */

/**
 * Called when a new socket connects to the server
 */
io.on("connection", (socket) => {

    //On connection send instanceId only in production mode
    if (process.env.CF_INSTANCE_INDEX) {
        socket.emit('getInstanceID', process.env.CF_INSTANCE_INDEX);
    }

    //check session
    let data = socket.handshake.session.userdata;

    if (data) {
        databasemodule.deleteLoggedInUser(data.username).then((deleteSuccess) => { 
            databasemodule.saveLoggedInUser(data.username, data.color).then(result => {   //returned undefined
                if (result) {
                    let image = data.profilepic ? new Buffer(data.profilepic.data, 'base64') : "";
                    socket.username = data.username;
                    socket.id = data.userid;
                    socket.colorCode = data.color;
                    socket.profilepic = image;
                    socket.join("AllChat");
                    users.push(socket);
                    socket.emit("clientlog", {
                        log: "Reconnecting..."
                    });
    
                    buildLoginMessage(socket).then(message => {
                        socket.emit("reconnect_successful", {
                            message: message
                        });
                    });
                } else {
                    socket.emit("clientlog", {
                        log: "Recoonection failed when relogging in"
                    });
                }
            });
        });
    }

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

    socket.on("profile_pic_upload", (data) => {
        var buffer = Buffer.from(data.file, "binary");
        visualrecognition.detectFace(socket, buffer).then((result) => {
            if (result) {
                const base64string = Buffer.from(buffer.toString('base64'));
                socket.profilepic = base64string;
                socket.emit("face_recog_success", { text: "Face detection successful", result: true });
            } else {
                socket.profilepic = "";
                socket.emit("face_recog_failed", { text: "Face detection failed: Found no face", result: false });
            }
        });
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

        // socket.join(room.roomname);
        // othersocket = users.find(f => f.username === otherUsername);
        // othersocket.join(room.roomname);

        privateRoomMessage = {
            room: room,
            sendername: ownUsername,
            receivername: otherUsername
        }

        pub.publish("create_private_room", JSON.stringify(privateRoomMessage));
    });

    // Handles the updatechattabs event and delegates to build the tabs of a specific user
    socket.on("update_chattabs", (data, callback) => {
        callback = buildChatTabs;
        callback(socket, data);
    });

    /**
     * Event triggered when receiving a send_all-emit of a client
     */
    socket.on("send", (data) => {
        message = data.message;
        room = data.room;
        buildTextMessage(socket, message, room).then((result) => {
            userMessage = result;
            messageToSend = {
                message: userMessage,
                room: room
            }
            pub.publish("send", JSON.stringify(messageToSend));
        });
    });

    /**
     * Event triggered when closing the tab, logging out or timing out or refreshing page
     */
    socket.on("logout", (callback) => {
        delete socket.handshake.session.userdata;
        socket.handshake.session.save();
        callback = emitLogoutEvent;
        callback(socket);
    });

    socket.on("disconnect", (callback) => {
        callback = emitLogoutEvent;
        callback(socket);
    });

});

/* IO Handlings END ------------------------------------------------------------------- */

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

    databasemodule.proofUserAlreadyLoggedIn(data.username).then((result) => {
        if (result) {
            socket.emit("login_failed", { text: "User already logged in" });
        } else {
            if (data.username.length == 0 || data.password.length == 0) {
                socket.emit("login_failed", { text: "Missing credentials, please type a name and password" });
            } else {
                usernameValid = proofCredential(data.username, "U");
                passwordValid = proofCredential(data.password, "P");
                if (usernameValid != "valid" && passwordValid == "valid") {
                    socket.emit("login_failed", { text: usernameValid });
                }
                else if (usernameValid == "valid" && passwordValid != "valid") {
                    socket.emit("login_failed", { text: passwordValid });
                }
                else if (usernameValid != "valid" && passwordValid != "valid") {
                    socket.emit("login_failed", { text: "Username and password are incorrect" });
                }
                else {
                    databasemodule.login(data.username, data.password).then((success) => {
                        if (success.result) {
                            databasemodule.saveLoggedInUser(data.username, data.color).then((result) => {
                                if (result) {
                                    socket.username = data.username;
                                    socket.id = data.userid;
                                    socket.colorCode = data.color;
                                    socket.join("AllChat");

                                    users.push(socket); // Add client to active users
                                    // Build the message object
                                    buildLoginMessage(socket).then(message => {
                                        if (message === "") {
                                            socket.emit("clientlog", {
                                                log: "Failed to login successfully"
                                            });
                                        } else {

                                            socket.handshake.session.userdata = {
                                                username: socket.username,
                                                color: socket.colorCode,
                                                userid: socket.id
                                            };
                                            if (success.profilepic) {
                                                base64buffer = Buffer.from(success.profilepic);
                                                // userConnectedMessage.profilepic = base64buffer;
                                                socket.emit("profilepic_loaded", {
                                                    image: base64buffer,
                                                    colorcode: socket.colorCode
                                                });
                                                socket.handshake.session.userdata.profilepic = base64buffer;
                                            }
                                            socket.handshake.session.save();
                                            pub.publish("login_successful", JSON.stringify(message));
                                        }
                                    });

                                } else {
                                    socket.emit("login_failed", { text: "Login failed due to database issues" });
                                }
                            });
                        } else {
                            socket.emit("login_failed", { text: "User not registered" });
                        }
                    });
                }
            }
        }
    });
}

/**
 * 
 * @param {Socket} socket 
 * @param data the username, password of a client 
 */
function emitRegisterEvent(socket, data) {
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
                        if (socket.profilepic && socket.profilepic !== "") {
                            var hash = bcrypt.hashSync(data.password, salt);
                            databasemodule.registerWithPic(data.username, hash, socket.profilepic).then((success) => {
                                if (success) {
                                    socket.emit("register_successful", { text: "Registration successful. Log in with your username: " + data.username })
                                } else {
                                    socket.emit("register_failed", { text: "Registration failed" });
                                }
                            })
                        } else {
                            var hash = bcrypt.hashSync(data.password, salt);
                            databasemodule.register(data.username, hash).then((success) => {
                                if (success) {
                                    socket.emit("register_successful", { text: "Registration successful. Please log in now" })
                                } else {
                                    socket.emit("register_failed", { text: "Registration failed" });
                                }
                            });
                        }
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
    return buildOnlineUsersList().then(result => {
        userConnectedMessage.profilepic = "";
        userConnectedMessage.usersOnlineListDOM = result;
        return userConnectedMessage;
    });
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
        databasemodule.deleteLoggedInUser(socket.username).then((result) => {
            if (result) {
                buildLogoutMessage(socket).then(message => {
                    if (message !== "") {
                        pub.publish("disconnected_user", JSON.stringify(message));
                    }
                });
            } else {
                console.log(result);
            }
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
    return buildOnlineUsersList().then(result => {
        userDisconnectedMessage.usersOnlineListDOM = result;
        userDisconnectedMessage.room = new Room;
        userDisconnectedMessage.room.roomname = "AllChat";
        return userDisconnectedMessage;
    });
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

    return databasemodule.getAllLoggedInUsers().then((result) => {
        if (!result.status) {
            return "";
        } else {
            loggedinusers = result.rows;
            onlineusers = "";
            loggedinusers.forEach(row => {
                onlineusers = onlineusers +
                    "<button type='button' class='btn btn-dark' id='" +
                    row.username + "'" + " onclick='createPrivateRoom(" + row.username + ")'" +
                    "style='" + "background:" + "linear-gradient(" + "110deg," + row.colorcode + " 20%," + "#37474f 20%" + ")" + "'>" +
                    row.username +
                    "</button>";
            });
            return onlineusers;
        }
    });
}

/**
 * Builds the chat tabs area of one client
 * @param {string} data the data of the socket (client)
 */
function buildChatTabs(socket, data) {
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



/* Callbacks and Event Handlings END ------------------------------------------------------------------- */

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

/* Object models END ------------------------------------------------------------------- */

