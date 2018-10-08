

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
    document.getElementById(data.room + "window").innerHTML += data.message;
});

/**
 * Handles the disconnect_all socket-event of the server
 */
socket.on("disconnect", (data) => {
    document.getElementById("usersonlinelist").innerHTML = data.usersonlinelist;
    document.getElementById("loggedInUsersCount").innerHTML = data.loggedinusers;
    document.getElementById("AllChatwindow").innerHTML += data.userdisconnectedstring;
});

/**
 * Handles the login_successful socket-event of the server
 */
socket.on("login_successful", (data, callback) => {
    if (data.username === username) {
        document.getElementById("loggedInUserName").innerHTML = data.loggedinas;
        callback = loadLoginConfiguration;
        callback(data);
    } else {
        document.getElementById("usersonlinelist").innerHTML = data.usersonlinelist;
        document.getElementById("loggedInUsersCount").innerHTML = data.loggedinusers;
        document.getElementById("AllChatwindow").innerHTML += data.userconnectedstring;
    }
});

/**
 * Handles the login_failed event and gives feedback to the requesting client
 */
socket.on("login_failed", (data) => {
    document.getElementById("loginFailedLabel").innerHTML = data.text;
});

/**
 * Handles the creation event for a new private room, creates a new room and corresponding window
 */
socket.on("established_private_room", (data, callback) => {
    console.log("Establish event erhalten CLient");
    rooms.push(data.room);
    if (data.requestorsocketname === username) {
        activeroom = data.room;
        activechatwindow = data.room + "window";
        document.getElementById("chatMessagesWindow").innerHTML += data.newchatwindow;
        for (i = 0; i < rooms.length; i++) {
            if (rooms[i] !== activeroom){
                document.getElementById(rooms[i] + "window").style.display = "none";
            }
        }
        document.getElementById(activechatwindow).style.display = "block";
    } else {
        document.getElementById("chatMessagesWindow").innerHTML += data.newchatwindow;
        document.getElementById(data.room + "window").style.display = "none";
    }
    callback = () => { socket.emit("update_chattabs", {
        username: username
    })};
    callback();
});

socket.on("update_chattabs", (data) => {
    console.log("Update chattabs bei client erhalten yeah");
    document.getElementById("roomsTabsWindow").innerHTML = data.chattabs;
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
    document.getElementById("chatMessagesWindow").innerHTML += data.newchatwindow;
    document.getElementById("usersonlinelist").innerHTML = data.usersonlinelist;
    document.getElementById("loggedInUsersCount").innerHTML = data.loggedinusers;
    document.getElementById("AllChatwindow").innerHTML += data.userconnectedstring;
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

/* Functions END */

function switchChatTabs(newactivechatname) {
    console.log("Switching tabs");
    rooms.forEach(room => {
        document.getElementById(room + "window").style.display = "none";
    });
    activeroom = newactivechatname.id;
    activechatwindow = newactivechatname.id + "window";
    document.getElementById(newactivechatname.id + "window").style.display = "block";
}