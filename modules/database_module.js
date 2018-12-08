/* JAN POHL 761383, RAVELL HEERDEGEN 761330 */

const mysql = require('mysql');
var bcrypt = require('bcryptjs');
var salt = bcrypt.genSaltSync(10);

//MySQL Database connection
let connection = mysql.createConnection('mysql://admin:EKAVNZNWEVTYOGSX@sl-eu-fra-2-portal.5.dblayer.com:18372/compose');

// TABLE QUERIES
// let createloggedinuser = "insert into loggedinusers (username) values ('Administrator')";
// let createloggedinuserstablequery = "create table loggedinusers (username varchar(24) primary key);";
// let getallusersquery = "create table user (username varchar(24) primary key, password varchar(100) not null, profilepic longblob);";
// let deleterowsquery = "create table user (username varchar(24) primary key, password nvarchar(4000) not null, profilepic LONGBLOB);";
// let selectquery = "select * from user;";
// let deleteallloggedinusers = "delete from loggedinusers;";
// let getallloggedinusers = "select * from loggedinusers;";
// let addcolumnquery = "alter table users ADD profilepictureID VARCHAR(100);";
// return new Promise((resolve, reject) => {
//     connection.query(createloggedinuser, (err, rows) => {
//         if (err || !rows[0]) {
//             console.log(err);
//             console.log("NIX DRIN");
//             resolve(false);
//         } else {
//             if (rows[0]) {
//                 console.log(rows);
//                 console.log("PAINIS");
//                 resolve(true);
//             }
//         }
//     });
// });

// QUERIES END

/**
 * Returns all logged in users from the loggedinusers table
 */
function getAllLoggedInUsers() {
    let query = 'select * from loggedinusers;';
    let loggedinusers = {
        rows,
        status: false
    };
    return new Promise((resolve, reject) => {
        connection.query(query, (err, rows) => {
            if (err || rows.length === 0) {
                loggedinusers.rows = err;
                resolve(loggedinusers);
            } else {
                if (rows.length > 0) {
                    loggedinusers.rows = rows;
                    loggedinusers.status = true;
                    resolve(loggedinusers);
                }
            }
        });
    });
}

/**
 * Proof if a user is already logged in
 * @param {String} username 
 */
function proofUserAlreadyLoggedIn(username) {
    let query = 'select username from loggedinusers where username="' + username + '"';
    return new Promise((resolve, reject) => {
        connection.query(query, (err, rows) => {
            if (err || !rows[0]) {
                resolve(false);
            } else {
                if (rows[0].username) {
                    resolve(true);
                }
            }
        });
    });
}

/**
 * Proofs if the given username is already taken
 * @param {String} username 
 */
function proofUsernameTaken(username) {
    let query = 'select username from user where username="' + username + '"';
    return new Promise((resolve, reject) => {
        connection.query(query, (err, rows) => {
            if (err || !rows[0]) {
                resolve(false);
            } else {
                if (rows[0].username) {
                    resolve(true);
                }
            }
        });
    });
}

/**
 * Logs an user into the database and returns the login result
 * @param {String} username 
 * @param {String} password 
 */
function login(username, password) {
    let query = 'select username,password,profilepic from user where username="' + username + '"';
    let result = {
        result: false,
        picture: ""
    };
    return new Promise((resolve, reject) => {
        connection.query(query, (err, rows) => {
            if (err || !rows[0]) {
            } else {
                if (rows[0].username && rows[0].password) {
                    if (bcrypt.compareSync(password, rows[0].password)) {
                        if (rows[0].profilepic && rows[0].profilepic !== "") {
                            result.result = true;
                            result.profilepic = rows[0].profilepic;
                        } else {
                            result.result = true;
                        }
                    }
                }
            }
            resolve(result);
        });
    });
}

/**
 * Saves a user to the database of logged in users
 * @param {Stirng} username 
 */
function saveLoggedInUser(username) {
    return new Promise((resolve, reject) => {
        if (username) {
            let query = 'insert into loggedinusers (username) values ("' + username + '");';
            return connection.query(query, (err) => {
                if (err) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        } else resolve(false);
    });
}

/**
 * Deletes a logged in user from the database of logged in users
 * @param {Stirng} username 
 */
function deleteLoggedInUser(username) {
    return new Promise((resolve, reject) => {
        if (username) {
            let query = 'delete from loggedinusers where username = "' + username + '";';
            return connection.query(query, (err) => {
                if (err) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        } else resolve(false);
    });
}

/**
 * Registers a user in the database and returns the registration result
 * @param {Stirng} username 
 * @param {String} password 
 */
function register(username, password) {
    return new Promise((resolve, reject) => {
        if (username && password) {
            let query = 'insert into user (username,password) values ("' + username + '","' + password + '");';
            return connection.query(query, (err) => {
                if (err) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        } else resolve(false);
    });
}

/**
 * Registers a user in the database and returns the registration result
 * @param {Stirng} username 
 * @param {String} password 
 * @param pictureblob the profile picture
 */
function registerWithPic(username, password, pictureblob) {
    return new Promise((resolve, reject) => {
        if (username && password && pictureblob) {
            let query = 'insert into user (username,password,profilepic) values ("' + username + '","' + password + '","' + pictureblob + '" );';
            return connection.query(query, (err) => {
                if (err) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        } else resolve(false);
    });
}

module.exports = { login, saveLoggedInUser, deleteLoggedInUser, register, registerWithPic, proofUsernameTaken, proofUserAlreadyLoggedIn, getAllLoggedInUsers };