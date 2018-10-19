// Starting up client side
var socket = io.connect("http://localhost:3000");
var uploader = new SocketIOFileUpload(socket);
uploader.listenOnInput(document.getElementById("file_input"));

// DIVs START
var chatDiv = $("#chatDiv").hide();
var loginDiv = $("#loginDiv");
var chatWindowDiv = $("#chatWindowDiv");
// DIVs END

// loginVariables START
var loginButton = $("#loginButton");
var usernameInput = $("#usernameInput");
$("#usernameInput").keyup(function(event) {
    if (event.keyCode === 13) {
        $("#loginButton").click();
    }
});
// loginVariables END

// logoutVariables START
var logoutButton = $("#logoutButton");
// logoutVariables END

// sendVariables START
var message = $("#message");
var messageSendButton = $("#messageSendButton");
$("#message").keyup(function(event) {
    if (event.keyCode === 13) {
        $("#messageSendButton").click();
    }
});
// sendVariables END

// chatVariables START
var activeroom;
var loggedInUserName;
// chatVariables END

// Personal data START
var colorCode;
var username;
var userId;
var rooms = [];
// Personal data END

/* Click Events START */

/**
 * Handles the login of a user and registers the user on the server
 */
loginButton.click(() => {
    username = usernameInput.val();
    userId = socket.id;
    colorCode = "#" + ('00000' + (Math.random() * (1<<24) | 0).toString(16)).slice(-6);
    socket.emit("login", {username: username, userid: userId, color: colorCode});
});

/**
 * Handles the logout of a user
 */
logoutButton.click((callback) => {
    socket.emit("disconnecting");
    callback = loadLogoutConfiguration;
    callback();
});

/**
 * Emits an chat_message to the server
 */
messageSendButton.click(() => {
    // check length of message
    if (message.val().trim().length > 120) {
      alert("Message too long (180 characters limited)");  
    } else if(message.val().trim().length === 0) {
        
    } else {
        socket.emit("send", {message: message.val(), room: activeroom.roomname});
        message.val("");
    }
});

/* CLick Events END */

/* Socket.on Events START */

/**
 * Handles the send socket-event of the server
 */
socket.on("send", (data) => {
    buildChatItem(data.message);
});

/**
 * Handles the disconnecting socket-event of the server
 */
socket.on("disconnecting", (data) => {
    $("#usersonlinelist").html(data.message.usersOnlineListDOM);
    buildChatItem(data.message);
});

/**
 * Handles the login_successful socket-event of the server
 */
socket.on("login_successful", (data, callback) => {
    $("#usersonlinelist").html(data.message.usersOnlineListDOM);
    if (data.message.sendername === username) { // we are the logging in user
        callback = loadLoginConfiguration;
        callback(data.message);
    } else {
        callback = buildChatItem(data.message);
    }
});

/**
 * Handles the login_failed event and gives feedback to the requesting client
 */
socket.on("login_failed", (data) => {
    $("#loginFailedLabel").html(data.text);
});

/**
 * Handles the creation event for a new private room, creates a new room and corresponding window
 */
socket.on("established_private_room", (data, callback) => {
    rooms.push(data.room);
    if (data.room.sendername === username) { // we are the caller
        activeroom = data.room;
        $("#chatWindow").empty(); // empty the chat window
    }
    callback = () => { socket.emit("update_chattabs", {
        username: username,
        rooms: rooms
    })};
    callback();
});

/**
 * Updates the Chat tabs Window with the incoming chattabs elements
 */
socket.on("update_chattabs", (data) => {
    $("#roomsTabsWindow").html(data.chattabs);
});

/**
 * Adds a download item to the chatcontext and serves the path to the file received
 */
socket.on("file", (data) => {
    $("#" + "chatWindow").html($("#" + "chatWindow").html() + data.file);
});

/* Socket.on Events END */

/* Functions START */

/**
 * Loads up the login configuration of the DOM-Elements
 * @param {LoginMessage} data the message sent if a new user connected
 */
function loadLoginConfiguration(data, callback) {
    activeroom = data.room;
    rooms.push(activeroom);
    chatWindowDiv.html(chatWindowDiv.html() + data.chatDOM);
    $("#loggedInUserName").html(data.loggedInAsString);
    buildChatItem(data);
    loginDiv.hide();
    chatDiv.show();
    socket.emit("update_chattabs", {
        username: username,
        rooms: rooms
    });
    $("#message").focus();
}

/**
 * 
 * @param {Message} data the message going to get built in the chat window 
 */
function buildChatItem(data) {
    listItemDiv = "";
    builtListItem = "";
    if (data.sendername === username) {
        listItemDiv = "<div class='ownListItemDiv'>";
        listItem = "<li class='list-group-item ownListItem'>";
        listItem = listItem + data.messageBody;
        listItem = listItem + data.messageFooter;
        listItem = listItem + "</li>";
        builtListItem = listItem;
    } else {
        listItemDiv = "<div class='otherListItemDiv'>";
        listItem = "<li class='list-group-item otherListItem'>";
        listItem = listItem + data.messageHead;
        listItem = listItem + data.messageBody;
        listItem = listItem + data.messageFooter;
        listItem = listItem + "</li>";
        builtListItem = listItem;
    }
    listItemDiv = listItemDiv + builtListItem + "</div>";
    
    rooms.find(room => room.roomname === data.room.roomname).chatContent.push(listItemDiv);
    $("#chatWindow").empty();
    activeroom.chatContent.forEach(message => {
        $("#chatWindow").html($("#chatWindow").html() + message);
    })

    $("#chatWindowDiv").stop().animate({ scrollTop: $("#chatWindowDiv")[0].scrollHeight}, 1000);
}

/**
 * Loads up the logout configuration of the DOM-Elements
 */
function loadLogoutConfiguration() {
    loginDiv.show();
    chatDiv.hide();
}

/**
 * Switches between the chat tabs and sets the new one active
 * @param {string} newactivechatname the name of the new active room
 */
function switchChatTabs(chattabbutton) {
    rooms.forEach(room => {
        if (room.roomname === chattabbutton.id) {
            $("#chatWindow").empty(); // empty the chat window
            room.chatContent.forEach(message => {
                $("#chatWindow").html($("#chatWindow").html() + message);
            });
            activeroom = room;
        }
    });
}

/**
 * Sends an emit to the server to create a new private room for two users
 * @param {string} otheruser the name of the user to chat with
 */
function createPrivateRoom(otheruser) {
    // check if room already exists of those two users
    validCall = true;
    rooms.forEach(room => {
        if ((room.sendername === username && room.recipientname === otheruser.id) 
            ||
            (room.sendername === otheruser.id && room.recipientname === username)) {
            validCall = false; // not permitted to create new room
        }
    });
    if (otheruser.id === username) {
        validCall = false; // not permitted to create new room
    }
    if (validCall) { 
        socket.emit("create_private_room", {othername: otheruser.id}); 
    }
}

/* Functions END */

/* Event Listeners START */

uploader.addEventListener("error", (event) => {
    $("#chatWindow").html($("#chatWindow").html() + event.detail.errorDOMElement);
});

uploader.addEventListener("start", (event) => {
    event.file.meta.room = activeroom.roomname;
    event.file.meta.sender = username;
});

uploader.addEventListener("complete", (event) => {
    // do smth..
});

/* Event Listeners END */

/* Object models START */

function Message() {
    this.sendername = "";
    this.messageHead = "";
    this.messageBody = "";
    this.messageFooter = "";
    this.room = "";
}

function LoginMessage() {
    Message.call(this); // Inheritance of Message
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
