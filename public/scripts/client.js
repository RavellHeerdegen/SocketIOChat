var socket = io.connect("http://localhost:3000");
var uploader = new SocketIOFileUpload(socket);
uploader.listenOnInput(document.getElementById("siofu_input"));

uploader.addEventListener("error", (event) => {
    
    console.log("FEHLER");
});

uploader.addEventListener("start", (event) => {
    console.log(event.file);
    event.file.meta.room = activeroom;
    event.file.meta.sender = username;
});

uploader.addEventListener("complete", (event) => {
    console.log(event.file);
    console.log(event.success);
    console.log(event.detail);
});

// loginVariables START
var loginButton = $("#loginButton");
var usernameInput = $("#usernameInput");
// loginVariables END

// logoutVariables START
var logoutButton = $("#logoutButton");
// logoutVariables END

// sendVariables START
var message = $("#message");
var messageSendButton = $("#messageSendButton");
// sendVariables END

// chatVariables START
var activeroom;
var activechatwindow;
// chatVariables END

// DIVs START
var loginDiv = $("#loginDiv");
var chatDiv = $("#chatDiv").hide();
var chatMessagesWindow = $("#chatMessagesWindow");
// DIVs END

// Personal data START
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
    socket.emit("login", {username: username, userid: userId});
});

/**
 * Handles the logout of a user
 */
logoutButton.click((callback) => {
    socket.emit("disconnect");
    callback = loadLogoutConfiguration;
    callback();
});

/**
 * Emits an allchat_message to the server
 */
messageSendButton.click((callback) => {
    socket.emit("send", {message: message.val(), room: activeroom});
    callback = () => {message.val("");}
    callback();
});

/* CLick Events END */

/* Socket.on Events START */

/**
 * Handles the send_all socket-event of the server
 */
socket.on("send", (data) => {
    $("#" + data.room + "window").html( $("#" + data.room + "window").html() + data.message); 
});

/**
 * Handles the disconnect_all socket-event of the server
 */
socket.on("disconnect", (data) => {
    $("#usersonlinelist").html(data.usersonlinelist);
    $("#loggedInUsersCount").html(data.loggedinusers);
    $("#AllChatwindow").html($("#AllChatwindow").html() + data.userdisconnectedstring);
});

/**
 * Handles the login_successful socket-event of the server
 */
socket.on("login_successful", (data, callback) => {
    if (data.username === username) {
        $("#loggedInUserName").html(data.loggedinas);
        callback = loadLoginConfiguration;
        callback(data);
    } else {
        $("#usersonlinelist").html(data.usersonlinelist);
        $("#loggedInUsersCount").html(data.loggedinusers);
        $("#AllChatwindow").html($("#AllChatwindow").html() + data.userconnectedstring);
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
    if (data.requestorsocketname === username) {
        activeroom = data.room;
        activechatwindow = data.room + "window";
        $("#chatMessagesWindow").html($("#chatMessagesWindow").html() + data.newchatwindow);
        for (i = 0; i < rooms.length; i++) {
            if (rooms[i] !== activeroom){
                $("#" + rooms[i] + "window").css("display", "none");
            }
        }
        $("#" + activechatwindow).css("display", "block");
    } else {
        $("#chatMessagesWindow").html($("#chatMessagesWindow").html() + data.newchatwindow);
        $("#" + data.room + "window").css("display", "none");
    }
    callback = () => { socket.emit("update_chattabs", {
        username: username
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
    $("#" + data.room + "window").html($("#" + data.room + "window").html() + 
    "<a href='" + data.url + "' download='" + data.filename + "'>DOWNLOAD</a>");

});

/* Socket.on Events END */

/* Functions START */

/**
 * Loads up the login configuration of the DOM-Elements
 */
function loadLoginConfiguration(data, callback) {
    activeroom = "AllChat";
    activechatwindow = "AllChatwindow";
    rooms.push("AllChat");
    $("#chatMessagesWindow").html($("#chatMessagesWindow").html() + data.newchatwindow);
    $("#usersonlinelist").html(data.usersonlinelist);
    $("#loggedInUsersCount").html(data.loggedinusers);
    $("#AllChatwindow").html($("#AllChatwindow").html() + data.userconnectedstring);
    loginDiv.hide();
    chatDiv.show();
    socket.emit("update_chattabs", {
        username: username
    });
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
function switchChatTabs(newactivechatname) {
    rooms.forEach(room => {
        $("#" + room + "window").css("display", "none");
    });
    activeroom = newactivechatname.id;
    activechatwindow = newactivechatname.id + "window";
    $("#" + newactivechatname.id + "window").css("display", "block");
}

/**
 * Sends an emit to the server to create a new private room for two users
 * @param {string} otheruser the name of the user to chat with
 */
function createPrivateRoom(otheruser) {
    socket.emit("create_private_room", {othername: otheruser.id});
}

/* Functions END */