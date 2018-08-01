var express     = require("express");
var bodyParser  = require("body-parser");
var multer      = require("multer");
var path        = require("path");
var ejs         = require("ejs");
var fs          = require("fs");
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

/**
 * Multer setup
 */
var storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, __dirname + '/public/images/');
  },
  filename: function (req, file, callback) {
    // Set file name
    let filename = file.fieldname + "_" + Date.now() + "_0";
    fs.stat(file.destination + filename, function(err, stats) {
        console.log(filename.substr(0, filename.length-1));
        if(stats) {
            let increment = parseInt(filename.charAt(filename.length-1))+1;
            filename = filename.substr(0, filename.length-1) + increment;
        }
    });
    callback(null, filename + path.extname(file.originalname));
  }
})
var upload = multer({ storage: storage });


/*
 * Sets up database
 */
const { Pool, Client } = require("pg");
const client = new Client({
    user: "postgres",
    password: "123",
    database: "quikdatatest",
    port: 5432
});
client.connect();

/**
 * Sets up extension for id generation
 */
client.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
    function(err, result) {
        if (err) console.log("Error while creating extension!");
        else console.log("Extension created!");
    }
);

/**
 * Creates DNCA form table
 */
client.query(`
    CREATE TABLE IF NOT EXISTS dnca (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        info json NOT NULL
    );`, dbTableCreationCallback
);

/**
 * Creates image table
 */
// client.query(`
//     CREATE TABLE IF NOT EXISTS dnca_image (
//         ID serial NOT NULL PRIMARY KEY,
//         dnca_id int references dnca(ID),
//         url varchar(255) NOT NULL
//     );`, dbTableCreationCallback
// );

/**
 * Creates image table (TEST only)
 */
// client.query(`
//     CREATE TABLE IF NOT EXISTS dnca_image_test (
//         ID serial NOT NULL PRIMARY KEY,
//         dnca_id int,
//         url varchar(255) NOT NULL
//     );`, dbTableCreationCallback
// );

/**
 * Callback for DB table creation
 * @param {*} err 
 * @param {*} result 
 */
function dbTableCreationCallback(err, result) {
    if (err) {
        console.log("DB table creation failed: " + err);
    } else {
        console.log("Successfully created DNCA table!");
    }
}

app.set("dbClient", client);

/**
 * Handles routes
 */
app.get("/api/dnca", function(req, res, next){
    req.app.get("dbClient").query(
        `
            SELECT id, 
                (info::json->'formInfo'->'sitio') AS sitio, 
                (info::json->'formInfo'->'barangay') AS barangay, 
                (info::json->'formInfo'->'city') AS city, 
                (info::json->'formInfo'->'province') AS province, 
                (info::json->'formInfo'->'assessmentDate') AS assessmentDate 
            FROM dnca;
        `,
        function(err, result) {
            if (err) {
                console.log("DB operation failed: " + err);
                res.status(400).send(err);
            } else {
                console.log("Successfully retrieved all DNCA forms!");
                console.log(result.rows);
                res.status(200).send(result.rows);
            }
        }
    );
});

/**
 * Handles viewing of individual DNCA forms
 */
app.get("/api/dnca/:id", function(req, res, next) {
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

/**
 * Handles viewing of individual DNCA forms contents
 * For debug use only - Remove when deploying
 */
app.get("/api/dnca/:id/debug", function(req, res, next) {
    req.app.get("dbClient").query(
        "SELECT * FROM dnca WHERE ID=$1", [req.params.id],
        function(err, result) {
            if (err) {
                console.log("DB operation failed: " + err);
                res.status(400).send(err);
            } else {
                console.log("Successfully retrieved DNCA form!");
                console.log(result.rows);
                res.status(200).send(result.rows[0].info);
            }
        }
    );
});

/**
 * Serves CSS files
 */
app.get("/api/dnca/stylesheets/:css_id", function(req, res, next) {
    res.writeHead(200, {'Content-type' : 'text/css'});
    var fileContents = fs.readFileSync('./public/stylesheets/' + req.params.css_id, {encoding: 'utf8'});
    res.write(fileContents);
    res.end();
});

/**
 * Handles downloading of DNCA form
 */
app.get("/api/dnca/:id/download", function(req, res, next) {
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

/**
 * Handles DNCA form submission
 */
app.post("/api/dnca", function(req, res, next) {
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
                res.status(200).send("DNCA form sent!");
            }
        }
    );
});

/**
 * Handles image submission
 */
app.post("/api/images", upload.array('image', 5), function(req, res, next) {
    console.log(req.files);
    var hasError = false;
    var fileUrls = [];
    req.files.forEach(function(file) {
        req.app.get("dbClient").query(

            //TODO: Reference DNCA form ID for image entry in DB
            "INSERT INTO dnca_image_test(dnca_id, url) VALUES($1, $2)", [0, file.path],
            function(err, result) {
                hasError = err;
            }
        );
        fileUrls.push(file.filename);
    });
    if (hasError) {
        console.log("DB operation failed: " + err);
        res.status(400).send(err);
    } else {
        console.log("Successfully added image!");
        res.status(200).send(fileUrls);
    }
});

/**
 * Serves images
 */
app.get("/api/images/:filename", function(req, res, next) {
    console.log(req.params.filename);
    res.writeHead(200, {'Content-type' : 'image/jpeg'});
    var fileContents = fs.readFileSync('./public/images/' + req.params.filename);
    res.write(fileContents);
    res.end();
});

/**
 * Route for home page
 */
app.get("/", function(req, res, next) {
    res.send("Home");
});

module.exports = app;