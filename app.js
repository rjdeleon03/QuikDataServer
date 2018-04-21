var express     = require("express");
var bodyParser  = require("body-parser");
var path        = require('path');
var app         = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

/*
 * Body parser setup
 */
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
app.use(bodyParser.json())


/*
 * Database setup
 */
const { Pool, Client } = require("pg");
const client = new Client({
    user: "postgres",
    password: "123",
    database: "quikdatatest",
    port: 5432
});
client.connect();
client.query(`
    CREATE TABLE IF NOT EXISTS dnca (
        ID serial NOT NULL PRIMARY KEY,
        info json NOT NULL
    );
`, function(err, result) {
    if (err) {
        console.log("DB table creation failed: " + err);
    } else {
        console.log("Successfully created DNCA table!");
    }
});

app.set("dbClient", client);

/*
 * Handle routes
 */
app.get("/dnca", function(req, res, next){
    req.app.get("dbClient").query(
        "SELECT * FROM dnca",
        function(err, result) {
            if (err) {
                console.log("DB operation failed: " + err);
                res.status(400).send(err);
            } else {
                console.log("Successfully retrieved all DNCA forms!");
                console.log(result);
                res.status(200).send(result.rows);
            }
        }
    );
});

app.get("/dnca/:id", function(req, res, next) {
    req.app.get("dbClient").query(
        "SELECT * FROM dnca WHERE ID=$1", [req.params.id],
        function(err, result) {
            if (err) {
                console.log("DB operation failed: " + err);
                res.status(400).send(err);
            } else {
                console.log("Successfully retrieved DNCA form!");
                console.log(result.rows);
                res.status(200).render("dnca", {dncas: result.rows});
            }
        }
    );
});

app.post("/dnca", function(req, res, next) {
    console.log(req.body);
    req.app.get("dbClient").query(
        "INSERT INTO dnca(info) VALUES($1)", [req.body],
        function(err, result) {
            if (err) {
                console.log("DB operation failed: " + err);
                res.status(400).send(err);
            } else {
                console.log("Successfully added DNCA form!");
                console.log(result);
                res.status(200).send("DNCA from sent!");
            }
        }
    );

});

app.get("/", function(req, res, next) {
    res.send("Home");
});

module.exports = app;