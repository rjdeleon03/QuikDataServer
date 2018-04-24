var express     = require("express");
var bodyParser  = require("body-parser");
var path        = require("path");
var ejs         = require("ejs");
var fs         = require("fs");
var pdf         = require("html-pdf");
var app         = express();

/*
 * View engine setup
 */
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));

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
                res.status(200).render("dnca", {
                    dnca: result.rows[0],
                    url: req.protocol + '://' + req.get('host')
                });
            }
        }
    );
});

// Serve css files
app.get("/dnca/stylesheets/:css_id", function(req, res, next) {
    res.writeHead(200, {'Content-type' : 'text/css'});
    var fileContents = fs.readFileSync('./public/stylesheets/' + req.params.css_id, {encoding: 'utf8'});
    res.write(fileContents);
    res.end();
});

app.get("/dnca/:id/download", function(req, res, next) {
    req.app.get("dbClient").query(
        "SELECT * FROM dnca WHERE ID=$1", [req.params.id],
        function(err, result) {
            if (err) {
                console.log("DB operation failed: " + err);
                res.status(400).send(err);
            } else {
                console.log("Successfully retrieved DNCA form!");
                
                // Generate pdf file
                var data = result.rows[0];
                var compiled = ejs.compile(fs.readFileSync(__dirname + "/views/dnca.ejs", "utf-8"));
                var html = compiled({
                    dnca: data,
                    url: req.protocol + '://' + req.get('host')
                });
                
                // Render pdf
                res.setHeader('Content-type', 'application/pdf');
                pdf.create(html).toStream(function(err, stream){
                    if (err) {
                        console.log("Error generating PDF: " + err);
                        res.status(404).send("Error!");
                    } else {
                        console.log("PDF successfully generated!");
                        stream.pipe(res);
                    }
                });

                // Redirect to DNCA form page
                // res.redirect("/dnca/" + req.params.id);
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