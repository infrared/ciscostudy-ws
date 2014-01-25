var express         = require('express');
var path            = require('path');
var http            = require('http');
var redis           = require("redis");
var rclient         = redis.createClient();
var RedisStore      = require('connect-redis')(express);
var cookieParser    = express.cookieParser('cisco');
var bcrypt          = require('bcrypt');
var MongoClient     = require('mongodb').MongoClient;
var ObjectId        = require('mongodb').ObjectID;



var collection;
var mongo;
MongoClient.connect('mongodb://127.0.0.1:27017/cisco', function(err, db) {
   if(err) throw err;
   mongo = db;
   


});


var sessionStore = new RedisStore();

var app = express();
app.configure(function(){
    app.set('port',5555);
    app.use(express.favicon());
    app.use(express.json());
    app.use(express.urlencoded());
    app.use(express.logger('dev'));
    app.use(cookieParser);
    
    app.use(express.session({
        cookie: { httpOnly: false },
        key: 'cisco',
        secret: "cisco",
        store: sessionStore,
        
    }));
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
    

});


app.get('/:cert/random',function(req,res) {
    
    var cert = req.params.cert;

    var rand = Math.random();
    var collection = mongo.collection('quiz');
    collection.findOne({ "cert": cert },function(err,results) {
        res.json(results);
    });
    /*
    collection.findOne({ "cert": cert, random: { $gte: rand } }).toArray(function(err,results){
        if (results === null) {
            collection.findOne({ "cert": cert, random: { $lte: rand }}).toArray(function(err,results) {
                if (results !== null) {
                    res.json(results);
                }
            });
        } else {
            res.json(results);
        }
    });
    */
});

var server = http.createServer(app);
server.listen(app.get('port'));