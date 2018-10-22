/* JAN POHL 761383, RAVELL HEERDEGEN 761330 */

// Starting up client side
var socket = io.connect("http://localhost:3000");
var uploader = new SocketIOFileUpload(socket);
// Uploader listens for input events of a specific html-element
uploader.listenOnInput(document.getElementById("file_input"));

// DIVs START
var loginDiv = $("#loginDiv").show();
var chatDiv = $("#chatDiv");
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
var progressbar = $("#progressbar").css("display", "none");
var progressbarDiv = $("#progressbarDiv").hide();
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
    username = username.replace(/ /g, "_"); //delete white spaces in names
    userId = socket.id;
    colorCode = "#" + ('00000' + (Math.random() * (1<<24) | 0).toString(16)).slice(-6);
    socket.emit("login", {username: username, userid: userId, color: colorCode});
    
});

/**
 * Handles the logout of a user and puts him back to the login screen
 */
logoutButton.click((callback) => {
    // socket.emit("disconnecting");
    callback = loadLogoutConfiguration;
    callback();
});

/**
 * Emits an chat_message to the server
 */
messageSendButton.click(() => {
    // check length of message
    if (message.val().trim().length > 120) {
      alert("Message too long (120 characters limited)");  
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
 * @param data the message to get built at the client side
 */
socket.on("send", (data) => {
    buildChatItem(data.message);
});

/**
 * Handles the disconnecting socket-event of the server
 * @param data the disconnecting user-message
 */
socket.on("disconnecting", (data) => {
    $("#usersonlinelist").html(data.message.usersOnlineListDOM);
    buildChatItem(data.message);
});

/**
 * Handles the login_successful socket-event of the server
 * @param data the message containing room information and the message to display on client side
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
 * @param data the login-failed-message
 */
socket.on("login_failed", (data) => {
    $("#loginFailedLabel").html(data.text);
});

/**
 * Handles the creation event for a new private room, creates a new room and corresponding window
 * @param data the room information
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
 * @param data the chattabs to build at client side
 */
socket.on("update_chattabs", (data) => {
    $("#roomsTabsWindow").html(data.chattabs);
    $("#" + activeroom.roomname).css("background", "#90a4ae");
});

/**
 * Adds a download item to the chatcontext and serves the path to the file received
 * @param data 
 */
socket.on("file", (data) => {
    buildChatItem(data.message);
});

/**
 * Adds an error message to the chat window
 * @param data the error message to show in the chat
 */
socket.on("file_upload_error", (data) => {
    buildChatItem(data.message);
    progressbar.css("width", "0%");
    progressbar.css("display", "none");
    progressbarDiv.hide();
});

/* Socket.on Events END */

/* Functions START */

/**
 * Loads up the login configuration of the DOM-Elements
 * @param {LoginMessage} data the message sent if a new user connected
 */
function loadLoginConfiguration(data) {
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
 * Builds a list item for the chat window and shows it in the active chat
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
    // loginDiv.show();
    // chatDiv.hide();
    location.reload(true);
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
            $("#" + activeroom.roomname).css("background", "#90a4ae");
        } else {
            $("#" + room.roomname).css("background", "#37474f");
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

/**
 * Listens to the error-event coming from the serverside if file upload fails
 */
uploader.addEventListener("error", (event) => {
    if (event.code === 1) {
        errorMessage = new Message;
        errorMessage.sendername = username;
        errorMessage.messageHead = "";
        errorMessage.messageBody = "<div class='text-danger bodyMessageDiv'>" + "File is too big (max 24 MB)" + "</div>";
        errorMessage.messageFooter = "<div class='footerMessageDiv'>" + new Date().toUTCString() + "</div>";
        errorMessage.room = new Room;
        errorMessage.room.roomname = activeroom.roomname;
        buildChatItem(errorMessage);
    }
});

/**
 * Listens to the start-event when a client inputs a file for upload
 */
uploader.addEventListener("start", (event) => {
    progressbar.css("width", "0%");
    event.file.meta.room = activeroom.roomname;
    event.file.meta.sender = username;
    event.file.meta.type = event.file.type;
});

/**
 * Listens to the progress-event if a file upload is processing
 */
uploader.addEventListener("progress", (event) => {
    progressbarDiv.show();
    progressbar.css("display", "block");
    progressbar.css("width", event.bytesLoaded / event.file.size * 100 + "%");
})

/**
 * Listens to the complete event if a file upload succeeded
 */
uploader.addEventListener("complete", (event) => {
    progressbar.css("display", "none");
    progressbarDiv.hide();
});

/* Event Listeners END */

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
