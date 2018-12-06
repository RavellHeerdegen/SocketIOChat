/* JAN POHL 761383, RAVELL HEERDEGEN 761330 */

const mysql = require('mysql');
var bcrypt = require('bcryptjs');
var salt = bcrypt.genSaltSync(10);

//MySQL Database connection
let connection = mysql.createConnection('mysql://admin:EKAVNZNWEVTYOGSX@sl-eu-fra-2-portal.5.dblayer.com:18372/compose');

// TABLE QUERIES
// let getallusersquery = "select * from users";
// let deleterowsquery = "delete from users;";
// let addcolumnquery = "alter table users ADD profilepictureID VARCHAR(100);";
// return new Promise((resolve, reject) => {
//     connection.query(deleterowsquery, (err, rows) => {
//         if (err || !rows[0]) {
//             resolve(false);
//         } else {
//             if (rows[0].username) {
//                 console.log(rows[0]);
//                 resolve(true);
//             }
//         }
//     });
// });

// QUERIES END

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
 * Registers a user in the database and returns the registration result
 * @param {Stirng} username 
 * @param {String} password 
 */
function register(username, password) {
    return new Promise((resolve, reject) => {
        if (username && password) {
            var hash = bcrypt.hashSync(password, salt);
            let query = 'insert into user (username,password) values ("' + username + '","' + hash + '");';
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
            var hash = bcrypt.hashSync(password, salt);
            let query = 'insert into user (username,password,profilepic) values ("' + username + '","' + hash + '","' + pictureblob + '" );';
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

module.exports = { login, register, registerWithPic, proofUsernameTaken };