/* JAN POHL 761383, RAVELL HEERDEGEN 761330 */

const mysql = require('mysql');

//MySQL Database connection
let connection = mysql.createConnection('mysql://admin:EKAVNZNWEVTYOGSX@sl-eu-fra-2-portal.5.dblayer.com:18372/compose');

// TABLE QUERIES
// let getallusersquery = "select * from users";
// let deleterowsquery = "delete from users;";
// let addcolumnquery = "alter table users ADD profilepictureID VARCHAR(100);";
// return new Promise((resolve, reject) => {
//     connection.query(getallusersquery, (err, rows) => {
//         if (err || !rows[0]) {
//             resolve(false);
//         } else {
//             if (rows[0].username) {
//                 resolve(true);
//             }
//         }
//     });
// });

// QUERIES END

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
                    if (password === rows[0].password) {
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

module.exports = { login, register, registerWithPic, proofUsernameTaken };