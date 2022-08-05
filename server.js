const mysql = require('mysql');
const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");
const res = require('express/lib/response');


const app = express(); // create new instance of express
const port = process.env.PORT || 4000; // start the server by telling it which port to use, using port 4000 on local environment; however, Heroku will assign port for app after deployment

app.use(cors({
    origin: ["http://localhost:3000", "https://lively-melomakarona-c39f10.netlify.app"],
    methods: ["GET", "POST"],
    credentials: true
}));

// Associate the modules we'll be using with Express
// creating 24 hours from milliseconds
const oneDay = 1000 * 60 * 60 * 24;
app.set("trust proxy", 1);
app.use(session({
    key: 'userID',
    secret: 'secret', // random unique string key used to authenticate a session, stored in environment variable and can't be exposed to public (usually long and randomly generated in a production environment)
    resave: false, // enables session to be stored back to session store, even if session was never modified during request
    saveUninitialized: false, // allows any uninitialized session to be sent to the store (when a session is created but not modified, is referred to as uninitialized)
    proxy: true,
    cookie: {
        sameSite: 'none', // must be 'none' to enable cross-site delivery
        secure: true, // must be true if sameSite='none'
        expires: oneDay
    }
}));

// Parsing the incoming data
app.use(express.json());

// Serving public file
app.use(express.static(path.join(__dirname)));

// Cookie parser middleware
app.use(cookieParser());

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res, next) => {
    res.status(200).json({
        status: 'success',
        data: {
            name: 'hci-final-server',
            version: '0.1.0'
        }
    });
});

// Database configuration and disconnect handling code taken from CloudyMarble at Stack Overflow
// https://stackoverflow.com/questions/20210522/nodejs-mysql-error-connection-lost-the-server-closed-the-connection
var db_config = {
    user: "b58d8ae6788a33",
    host: "us-cdbr-east-06.cleardb.net",
    password: "f89f0369",
    database: "heroku_6d67496a20a7393",
};

var connection;

function handleDisconnect() {
    connection = mysql.createConnection(db_config); // Recreate the connection, since
    // the old one cannot be reused.

    connection.connect(function (err) {              // The server is either down
        if (err) {                                     // or restarting (takes a while sometimes).
            console.log('error when connecting to db:', err);
            setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
        }                                     // to avoid a hot loop, and to allow our node script to
    });                                     // process asynchronous requests in the meantime.
    // If you're also serving http, display a 503 error.
    connection.on('error', function (err) {
        console.log('db error', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
            handleDisconnect();                         // lost due to either server restart, or a
        } else {                                      // connnection idle timeout (the wait_timeout
            throw err;                                  // server variable configures this)
        }
    });
}

handleDisconnect();

// Get all quiz questions from solar system quiz
app.get('/solarsystem', (req, res) => {
    const sqlSelect = "SELECT * FROM solar_system";
    connection.query(sqlSelect, (err, result) => {
        res.send(result);
    });
});

// Get one quiz question from solar system quiz
app.get('/solarsystem/:id', (req, res) => {
    const id = req.params.id;
    const sqlSelect = "SELECT * FROM solar_system WHERE questionNumber = " + id;

    connection.query(sqlSelect, (err, result) => {
        res.send(result);
    });
})

// Get all quiz questions from uf culture quiz
app.get('/ufculture', (req, res) => {
    const sqlSelect = "SELECT * FROM uf_culture";
    connection.query(sqlSelect, (err, result) => {
        res.send(result);
    });
});

// Get one quiz question from uf culture quiz
app.get('/ufculture/:id', (req, res) => {
    const id = req.params.id;
    const sqlSelect = "SELECT * FROM uf_culture WHERE questionNumber = " + id;

    connection.query(sqlSelect, (err, result) => {
        res.send(result);
    });
})

// Get top ten points leaderboard
app.get('/leaderboard', (req, res) => {
    const sqlSelect = "SELECT fname, lname, points FROM user ORDER BY points DESC LIMIT 10"
    connection.query(sqlSelect, (err, result) => {
        res.send(result);
    });
})

// Code is asking for default /pointCt response
app.get('/pointCt', (req, res) => {
    connection.query("SELECT points FROM user", (err, result) => {
        res.send(result);
    });
})

// Get points for specific user
app.get('/pointCt/:selectUser', (req, res) => {
    const selectUser = req.params.selectUser;
    const sqlSelect = "SELECT points FROM user WHERE username = \'" + selectUser + "\'"

    connection.query(sqlSelect, (err, result) => {
        res.send(result);
    });
})

// Check if user is logged in
app.get('/auth', (req, res) => {
    if (req.session.user) {
        res.send({ loggedIn: true, user: req.session.user });
    } else {
        res.send({ loggedIn: false });
    }
})

// Create an account
app.post('/create', (req, res) => {
    console.log(req.body)
    let fName = req.body.fName;
    let lName = req.body.lName;
    let username = req.body.username;
    let password = req.body.password;

    if (fName.length > 20 || lName.length > 20 || username > 20 || password > 20) {
        res.send({ message: 'Please keep all fields at or under 20 characters!' });
    } else if (fName && lName && username && password) {
        // Check for existing username
        connection.query("SELECT * FROM user WHERE username = ?", [username], (err, result) => {
            // If there is an issue with the query, output the error
            if (err) {
                res.send({ err: err })
            };
            // If the username exists
            if (result.length > 0) {
                res.send({ message: 'Username already exists! Please enter new username' });
                res.end();
            } else {
                // If username does not exist, sign the user up
                connection.query(
                    "INSERT INTO user (fName, lName, username, password) VALUES (?,?,?,?)",
                    [fName, lName, username, password],
                    (err2, result2) => {
                        if (err2) {
                            res.setDefaultEncoding({ err: err2 })
                        } else {
                            res.send("Credentials Recorded");
                        }
                    }
                );
            }
        })
    } else {
        res.send({ message: 'Please fill out all fields!' });
        res.end();
    }
})

// Log in to an existing account
app.post('/auth', (req, res) => { // POST method captures input fields when user submits form
    // Capture the input fields
    let username = req.body.username;
    let password = req.body.password;
    // Ensure the input fields exists and are not empty
    if (username && password) {
        // Execute SQL query that'll select the account from the database based on the specified username and password
        connection.query('SELECT * FROM user WHERE username = ? AND password = ?', [username, password],
            (err, result) => {
                // If there is an issue with the query, output the error
                if (err) {
                    res.send({ err: err })
                };
                // If the account exists
                if (result.length > 0) {
                    // Authenticate the user
                    req.session.user = result;
                    console.log(req.session.user);
                    res.send(result);
                } else {
                    res.send({ message: 'Incorrect Username and/or Password!' });
                }
                res.end();
            });
    } else {
        res.send({ message: 'Please enter Username and Password!' });
        res.end();
    }
});

// Log out of an account
app.post('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                res.status(400).send('Unable to log out')
            } else {
                res.send('Logout successful')
            }
        });
    } else {
        res.end()
    }
})

// Add points for a user
app.post('/addpoints', (req, res) => {
    const selectUser = req.body.selectUser;
    const numPoints = req.body.numPoints;
    const sqlSelect = "UPDATE user SET points = points + " + numPoints + " WHERE username = \'" + selectUser + "\'";

    connection.query(sqlSelect, (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.send("Points added");
        }
    });
})

app.listen(port, () => {
    console.log(`Server is up on port ${port}!`);
});
