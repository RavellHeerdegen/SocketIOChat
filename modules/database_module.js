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

function login(user, password) {
    let query = 'select username,password from user where username="' + user + '"';
    return new Promise((resolve, reject) => {
        connection.query(query, (err, rows) => {
            if (err || !rows[0]) {
                resolve(false);
            } else {
                if (rows[0].username && rows[0].password) {
                    resolve(password === rows[0].password);
                }
            }
        });
    });
}

function register(user, password) {
    return new Promise((resolve, reject) => {
        console.log(user + password);
        if (user && password) {
            let query = 'insert into user (username,password) values ("' + user + '","' + password + '");';
            return connection.query(query, (err) => {
                if (err) {
                    console.log(err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        } else resolve(false);
    });
}

module.exports = { login, register, proofUsernameTaken };