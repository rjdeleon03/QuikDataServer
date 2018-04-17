var express     = require("express");
var app         = express();

app.get("/dnca", function(req, res, next){
    res.send("Hello");
});

app.get("/", function(req, res, next) {
    res.send("Home");
});

module.exports = app;