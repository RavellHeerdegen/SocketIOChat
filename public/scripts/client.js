/* JAN POHL 761383, RAVELL HEERDEGEN 761330 */

// Starting up client side
const socket = io('/', {
    reconnection: false
});

// DIVs START
var loginDiv = $("#loginDiv").show();
var chatDiv = $("#chatDiv");
var chatWindowDiv = $("#chatWindowDiv");
// DIVs END

// loginVariables START
var loginButton = $("#loginButton");
var usernameInput = $("#usernameInput");

$("#usernameInput").keyup(function (event) {
    if (event.keyCode === 13) {
        $("#loginButton").click();
    }
});

var passwordInput = $("#passwordInput");
$("#passwordInput").keyup(function (event) {
    if (event.keyCode === 13) {
        $("#loginButton").click();
    }
});

var registerButtonDialog = $("#registerButtonDialog");

/**
 * Called if a profile picture has been chosen by a client in the register dialog
 */
$('#registerProfilePicture').change(function (e) {
    $("#profilePicDetectionLabel").html("");
    profilePicRecognitionRunning = true;
    profilepicLoader.show();
    var file = e.target.files[0];
    if (file) {
        // CHECK IF IMAGE mit file.type includes image/jpg jpeg oder png und limitier auf 100KB mit file.size < 100
        if ((file.type.match('image/jpeg') || file.type.match("image/png") || file.type.match("image/jpg")) && file.size <= 104000) {
            var reader = new FileReader();
            reader.onload = function () {
                var arrayBuffer = reader.result;
                array = new Uint8Array(arrayBuffer);
                binaryString = String.fromCharCode.apply(null, array);
                socket.emit("profile_pic_upload", { file: binaryString });
            };
            reader.readAsArrayBuffer(file);
        } else {
            $("#responseDialogLabel").css("color", "red");
            $("#responseDialogLabel").html("Filetype wrong or file too big");
        }

    }
});

var usernameInputDialog = $("#usernameInputDialog");
$("#usernameInputDialog").keyup(function (event) {
    if (event.keyCode === 13) {
        $("#registerButtonDialog").click();
    }
});
var passwordInputDialog = $("#passwordInputDialog");
$("#passwordInputDialog").keyup(function (event) {
    if (event.keyCode === 13) {
        $("#registerButtonDialog").click();
    }
});
var profilepicLoader = $("#profilepicLoader").hide();
var profilePicRecognitionRunning = false;
var lastprofilePicRecognitionWasSuccessful = false;
// loginVariables END

// logoutVariables START
var logoutButton = $("#logoutButton");
// logoutVariables END

// sendVariables START
var message = $("#message");
var messageSendButton = $("#messageSendButton");
$("#message").keyup(function (event) {
    if (event.keyCode === 13) {
        $("#messageSendButton").click();
    }
});
var progressbar = $("#progressbar").css("display", "none");
var progressbarDiv = $("#progressbarDiv").hide();
document.getElementById("file_input").addEventListener("change", fileUpload);
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

// Global variables START

let intervalVar;
let reconnectionCounter = 0;

// Global variables END

/* Click Events START */

/**
 * Handles the login of a user and sends login request to the server
 */
loginButton.click(() => {
    username = usernameInput.val();
    password = passwordInput.val();
    username = username.replace(/ /g, "_"); //delete white spaces in names
    username = username.replace(/[^\w\s]/gi, ''); //delete special characters
    password = password.replace(/ /g, "_"); //delete white spaces in names
    password = password.replace(/[^\w\s]/gi, ''); //delete special characters
    userId = socket.id;
    colorCode = "#" + ('00000' + (Math.random() * (1 << 24) | 0).toString(16)).slice(-6);
    socket.emit("login", { username: username, password: password, userid: userId, color: colorCode });
});

/**
 * Handles the register of a user and sends register request to the server
 */
registerButtonDialog.click(() => {
    username = usernameInputDialog.val();
    password = passwordInputDialog.val();
    username = username.replace(/ /g, "_"); //delete white spaces in names
    username = username.replace(/[^\w\s]/gi, ''); //delete special characters
    password = password.replace(/ /g, "_"); //delete white spaces in names
    password = password.replace(/[^\w\s]/gi, ''); //delete special characters
    if (!profilePicRecognitionRunning) {
        socket.emit("register", { username: username, password: password });
    }
});

/**
 * If a user got logged in successfully the image of the user is updated on the chat-page
 */
socket.on("result", (data) => {
    const img = $("#headerImg");
    img.attr("src", 'data:image/png;base64,' + data.data);
});

/**
 * Handles the logout of a user and puts him back to the login screen
 */
logoutButton.click((callback) => {
    socket.emit("logout");
    callback = loadLogoutConfiguration;
    callback();
});

/**
 * Emits a chat_message to the server
 */
messageSendButton.click(() => {
    // check length of message
    if (message.val().trim().length > 120) {
        alert("Message too long (120 characters limited)");
    } else if (message.val().trim().length === 0) {

    } else {
        console.log(activeroom.roomname);
        console.log(username);
        socket.emit("send", { message: message.val(), room: activeroom.roomname });
        message.val("");
    }
});

/* CLick Events END */

/* Socket.on Events START */

socket.on("getInstanceID", (id) => {
    console.log("Instance ID:", id);
});

/**
 * Handles the send socket-event of the server if a message was sent by a user
 */
socket.on("send", (data) => {
    buildChatItem(data.message);
});

/**
 * Handles the disconnecting socket-event of the server if a user leaves
 */
socket.on("disconnected_user", (data) => {
    console.log(data);
    $("#usersonlinelist").html(data.message.usersOnlineListDOM);
    buildChatItem(data.message);
});

/**
 * Hnadles the disconnect event if a client loses connection
 */
socket.on('disconnect', function () {
    reconnectionCounter = 0;
    console.log('disconnected');

    //Retry reconnecting every 3 seconds
    intervalVar = setInterval(tryReconnect, 3000);
});

/**
 * Handles the login_successful socket-event of the server depending who the user is
 */
socket.on("login_successful", (data, callback) => {
    $("#usersonlinelist").html(data.message.usersOnlineListDOM);
    if (data.message.sendername === username) { // we are the logging in user
        console.log("Logged into chat. Nice!");
        callback = loadLoginConfiguration;
        callback(data.message);
    } else {
        callback = buildChatItem(data.message);
    }
});

socket.on("reconnect_successful", (data, callback) => {
    console.log(data.message);
    $("#usersonlinelist").html(data.message.usersOnlineListDOM);
    callback = loadReconnectConfiguration;
    callback(data.message);
});

/**
 * Handles the register-successful event and gives feedback to the requesting client
 */
socket.on("register_successful", (data) => {
    $('#registerDialogDiv').modal("hide");
    $("#responseLabel").css("color", "green");
    $("#responseLabel").html(data.text);
});

/**
 * Handles the login_failed event and gives feedback to the requesting client why the login failed
 */
socket.on("login_failed", (data) => {
    $("#responseLabel").css("color", "red");
    $("#responseLabel").html(data.text);
});

/**
 * Handles the register_failed event and gives feedback to the requesting client why the registration failed
 */
socket.on("register_failed", (data) => {
    $("#responseDialogLabel").css("color", "red");
    $("#responseDialogLabel").html(data.text);
});

/**
 * Handles the success event for the face recognition of Watson in the register-event
 */
socket.on("face_recog_success", (data) => {
    profilePicRecognitionRunning = false;
    lastprofilePicRecognitionWasSuccessful = true;
    profilepicLoader.hide();
    $("#profilePicDetectionLabel").css("color", "green");
    $("#profilePicDetectionLabel").html(data.text);
});

/**
 * Handles the failed event for the face recognition of Watson in the register-event
 */
socket.on("face_recog_failed", (data) => {
    profilePicRecognitionRunning = false;
    lastprofilePicRecognitionWasSuccessful = false;
    profilepicLoader.hide();
    $("#profilePicDetectionLabel").css("color", "red");
    $("#profilePicDetectionLabel").html(data.text);
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
    callback = () => {
        socket.emit("update_chattabs", {
            username: username,
            rooms: rooms
        })
    };
    callback();
});

/**
 * Updates the Chat tabs Window with the incoming chattabs elements
 */
socket.on("update_chattabs", (data) => {
    $("#roomsTabsWindow").html(data.chattabs);
    $("#" + activeroom.roomname).css("background", "#90a4ae");
});

/**
 * Handles the clientlog-event and logs thedata to the users browser console
 */
socket.on("clientlog", (data) => {
    console.log(data.log);
});

/**
 * Handles the profile-picture-loaded event of a client and displays the result to the chat window
 */
socket.on("profilepic_loaded", (data) => {
    let decodedbase64 = new TextDecoder("utf-8").decode(new Uint8Array(data.image));
    $("#headerImg").attr("src", "data:image/png;base64," + decodedbase64);
    $("#headerImg").css("border", "3px solid " + data.colorcode);
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
 * Loads up the login configuration of the DOM-Elements
 * @param {LoginMessage} data the message sent if a new user connected
 */
function loadReconnectConfiguration(data) {
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
    console.log("In buildCHatItem");
    console.log(username);
    console.log("Sollte passen zu:");
    console.log(data.sendername);
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

    room = rooms.find(room => room.roomname === data.room.roomname);
    if (room) {
        console.log("Message received");
        room.chatContent.push(listItemDiv);
    }
    $("#chatWindow").empty();
    activeroom.chatContent.forEach(message => {
        console.log("Show message of activeroom");
        $("#chatWindow").html($("#chatWindow").html() + message);
    })

    $("#chatWindowDiv").stop().animate({ scrollTop: $("#chatWindowDiv")[0].scrollHeight }, 1000);
}

/**
 * Reloads the page so the user gets unregistered and lands on the login page
 */
function loadLogoutConfiguration() {
    location.reload(true);
    rooms = [];
    activeroom = "";
    username = "";
    userid = "";
}

/**
 * Switches between the chat tabs and sets the new one active
 * @param {Button} chattabbutton the chatbutton which got pressed
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
        socket.emit("create_private_room", { othername: otheruser.id });
    }
}

/**
 * Start upload for chosen files from the filepicker
 * @param {File-Input Event} event the FileList-event to handle chosen files 
 */
function fileUpload(event) {
    file = event.target.files[0];
    if (file) {
        filestream = ss.createStream();
        ss(socket).emit('file_upload', filestream, {
            name: file.name,
            size: file.size,
            type: file.type,
            room: activeroom,
            sender: username,
            colorcode: colorCode
        });

        blobStream = ss.createBlobReadStream(file); // for chunking and bidirectional file transfer

        // Update progress bar
        progressbarDiv.show();
        progressbar.css("display", "block");
        size = 0;

        blobStream.on("data", (chunk) => {
            size += chunk.length;
            progressbar.css("width", size / file.size * 100 + "%");
        });
        blobStream.pipe(filestream);
    }
}

/**
 * Receiving a file upload event and printing the message to the chat-Window
 */
ss(socket).on("file_upload", (stream, data) => {
    let binaryData = [];

    stream.on("error", (error) => {
        $("#chatWindow").html($("#chatWindow").html() + error);
        if (data.sender === username) {
            progressbar.css("width", "0%");
            progressbar.css("display", "none");
            progressbarDiv.hide();
        }
    })

    stream.on("data", (chunk) => {
        binaryData.push.apply(binaryData, chunk); //Put chunks together
    });

    stream.on("end", () => {
        let blob = new Blob([new Uint8Array(binaryData)]); //Blob is an object piece of the file
        let fileUrl = URL.createObjectURL(blob);

        fileDiv = "";
        // Filemapping
        if (data.type.includes("image")) {
            fileDiv = "<div class='row' style='margin-bottom: 6px; justify-content: flex-end'>" +
                "<div style='display: flex; justify-content: center; padding-right: 16px'>" + "<img src='" + fileUrl + "' style='width: 200px; height: 200px'></div>" +
                "</div>" +
                "<div class='row'>" +
                "<div class='fileNameSpan' style='padding-left: 0'>" + data.name + "</div>" +
                "<div style='padding-left: 0; width: 80px; margin-right: 16px;'>" +
                "<a href='" + fileUrl + "' download='" + data.name + "' class='btn' style='width: 100%; background: #43a047'><i class='material-icons' style='color: lightgrey'>get_app</i></a>" +
                "</div>" +
                "</div>";
        } else {
            fileDiv =
                "<div class='row'>" +
                "<div style='display: flex; justify-content: center; padding-right: 0; width: 60px'>" + "<i class='material-icons fileIncomeIcon'>input</i>" + "</div>" +
                "<div class='fileNameSpan' style='padding-left: 0'>" + data.name + "</div>" +
                "<div style='padding-left: 0; width: 80px; margin-right: 16px;'>" +
                "<a href='" + fileUrl + "' download='" + data.name + "' class='btn' style='width: 100%; background: #43a047'><i class='material-icons' style='color: lightgrey'>get_app</i></a>" +
                "</div>" +
                "</div>";
        }

        userMessage = new Message;
        userMessage.sendername = data.sender;
        userMessage.messageHead = "<div class='headMessageDiv' style='" + "color:" + data.colorCode + "'>" + "<p class='nameMessageTag'>" + userMessage.sendername + "</p>" + "</div>";
        userMessage.messageBody =
            "<div class='bodyMessageDiv'>" +
            fileDiv +
            "</div>";
        userMessage.messageFooter = "<div class='footerMessageDiv'>" + data.timeStamp + "</div>";
        userMessage.room = new Room;
        userMessage.room.roomname = data.room.roomname;

        buildChatItem(userMessage);

        if (data.sender === username) {
            progressbar.css("width", "0%");
            progressbar.css("display", "none");
            progressbarDiv.hide();
        }
    });
});

/**
 * Handles the reconnecting event if a client drops his connection
 */
let tryReconnect = function () {
    ++reconnectionCounter;
    if (reconnectionCounter == 7) {
        clearInterval(intervalVar);
    }
    console.log('Making a dummy http call to set jsessionid (before we do socket.io reconnect)');
    $.ajax({
        type: 'GET',
        url: '/',
        success: () => {
            console.log("http request succeeded");
            //reconnect the socket AFTER we got jsessionid set
            socket.connect();
            clearInterval(intervalVar);
        }
    });
};

/* Functions END */

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
