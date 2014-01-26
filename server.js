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
var uuid            = require('node-uuid');



var collection;
var mongo;
MongoClient.connect('mongodb://127.0.0.1:27017/cisco', function(err, db) {
   if(err) throw err;
   mongo = db;
});




var requireRole = function(role) {
    return function(req,res,next) {
    
    var method = req.method;
    
    
    var authToken;
    if (method === 'GET') {
        if (typeof req.query.authToken === 'undefined') {
            res.json({ error: 'authToken required'});
        } else {
            authToken = req.query.authToken;
        }
        
    } else if (method === 'POST') {
    
        if (typeof req.body.authToken === 'undefined') {
            res.json({error: 'authToken required'});
        } else {
            authToken = req.body.authToken;
        }
    } 
    rclient.get('authToken:' + authToken,function(err,reply){
        if (err) {
            res.json({error: err });
        } else {
            if (reply === null) {
                res.json({ error: 'unauthenticated or expired token'});
            } else {
                console.log(reply);
                var result = JSON.parse(reply);
                var auth;
                if (result.roles !== undefined){
                    for (var i=0;i<result.roles.length;i++) {
                        if (result.roles[i] === role) {
                            auth = true;
                        }
                    }
                }
                if (auth) {
                    next();
                } else {
                    res.json({error: 'unauthorized'});
                }
            }
        }
    });
}
}





var sessionStore = new RedisStore();

var app = express();
app.configure(function(){
    app.set('port',7777);
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

app.all('/', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});
 

app.get('/test',requireRole('moderator'),function(req,res) {
    res.json({hi: "hi"});
});

app.post('/auth',function(req,res) {
    
    var errors = [ ];
    var data = { };
    if (typeof req.body.username === 'undefined') {
        errors.push("username is required");
    }
    if (typeof req.body.password === 'undefined') {
        errors.push("password is required");
    }
    if (errors.length) {
        res.json({ error: errors});
    } else {
        var collection = mongo.collection('user');
        collection.findOne({ username: req.body.username },function(err,result) {
            if (err) {
                res.json({error: err});
            } else {
                if (result !== null) {
                    if (bcrypt.compareSync(req.body.password, result.password)) {
                        var authToken0 = uuid.v1();
                        var authToken1 = uuid.v4(); 
                        var authToken = authToken0 + authToken1;
                        rclient.set('authToken:' + authToken, JSON.stringify({ username: req.body.username, roles: result.roles }));
                        rclient.expire('authToken:' + authToken,3600);
                        res.json({success: { authToken: authToken}});
                    } else {
                        res.json({ error: 'auth failed'});
                    }
                } else {
                    res.json({ error: 'no such user'});
                }
            }
        });
    }
     
    
});
app.post('/register',function(req,res) {
    
    var errors = [ ];
    var data = { };
    
    if (typeof req.body.username === 'undefined') {
        errors.push("username is required");
    }
    if (typeof req.body.password === 'undefined') {
        errors.push("password is required");
    }
    if (errors.length) {
        res.json({ error: errors});
    } else {
        data.username = req.body.username.trim();
        var salt = bcrypt.genSaltSync(10);
        var hash = bcrypt.hashSync(req.body.password.trim(), salt);
        data.password = hash;
        
        var reU = new RegExp("(\\w{3,25})");
        var reP = new RegExp("(\\S{6,255})");
        if (! reU.test(data.username)) {
            errors.push("username does not meet the criteria: ",reU);
        }
        if (! reP.test(data.password)) {
            errors.push("password does not meet criteria: ", reP);
        }
        if (errors.length) {
            res.json({error: errors });
        } else {

            var collection = mongo.collection('user');  
            collection.insert(data,function(err,obj){
                if (err) {
                    res.json({ error: err });
                } else {
                    res.json({ success: obj });
                }
            });

        }
    }
});


app.get('/submit',function(req,res){
    res.sendfile('public/submit.html');
});

app.post('/submit',function(req,res) {
    
    var type = req.body.type.trim();
    switch (type) {
    case "ios":
        var data = {
            cert : req.body.cert.trim(),
            type : type,
            keywords : req.body.keywords.match(/(\w+)/g),
            question : req.body.question.trim(),
            answer: req.body.answer.trim(),
            random: Math.random()
        };
        break;
    case "definition":
        var data = {
            cert : req.body.cert.trim(),
            type: type,
            term: req.body.term.trim(),
            acronym: (req.body.acronym.trim() === undefined) ? null : req.body.acronym.trim(),
            keywords : req.body.keywords.match(/(\w+)/g),
            definition: req.body.definition.trim(),
            random: Math.random()
        };
        break;
    case "basic":
        var data = {
            cert : req.body.cert.trim(),
            type : type,
            keywords : req.body.keywords.match(/(\w+)/g),
            question : req.body.question.trim(),
            answer: req.body.answer.trim(),
            random: Math.random()
        };
        break;
        
    }
    
    var collection = mongo.collection('quiz');
    collection.insert(data,function(err,object) {
        if (err) {
            res.json({ error: err});
        } else {
            res.json({ success: object});
        }
    });
    
});


app.get('/quiz/:cert/all',function(req,res) {
    
    var cert = req.params.cert;
    var collection = mongo.collection('quiz');
    collection.find({ "cert": cert}).toArray(function(err,results) {
        res.json(results);
    });
});

/* Get random quiz entry */
app.get('/quiz/:cert/random',function(req,res) {
    
    var cert = req.params.cert;
    
    var rand = Math.random();
    

    var collection = mongo.collection('quiz');
    
    collection.findOne({ "cert": cert, "random": { $gte: rand } },function(err,results){
     
       
        if (results === null) {
            collection.findOne({ "cert": cert, "random": { $lte: rand } },function(err,foo) {
                res.json({success: foo});

            });
        } else {
            res.json({success: results});
        }
    });
    
});
app.get('/quiz/:cert/topic/:topic',function(req,res) {
    
    var cert = req.params.cert;
    var topic = req.params.topic;
    var rand = Math.random();
    
    var collection = mongo.collection('quiz');
    
    collection.findOne({ "cert": cert, "keywords": { $in: [ topic ] }, "random": { $gte: rand } }, function(err,results) {
        if (err) { 
            res.json({error: err});
        } else {
            if (results === null) {
                collection.findOne({ "cert": cert, "keywords": { $in: [ topic ] }, "random": { $lte: rand } }, function(err,results) {
                    if (err) {
                        res.json({error: err});
                    } else {
                        res.json({ success: results});
                    }
                });
            } else {
                res.json({success: results});
            }
        }
    });
    
});
/* Get all certs in database */
app.get('/certs',function(req,res){
    var collection = mongo.collection('quiz');
    collection.distinct('cert',function(err,results){
        if (err){
            res.json({error: err});
        } else {
            res.json({success: results});
        }
    });
});

/* Get all keywords (topics) for a cert */
app.get('/topics/:cert',function(req,res) {
    
    var cert = req.params.cert;
    var collection = mongo.collection('quiz');
    collection.distinct('keywords', { cert: cert}, function(err,results) {
        if (err) {
            res.json({ error: err});
        } else {
            res.json({ success: results});
        }
    });
    
    
});
/* Count database entries for a particular cert */
app.get('/count/:cert',function(req,res) {
    var collection = mongo.collection('quiz');
    var cert = req.params.cert;
    
    collection.count({ cert: cert},function(err,results){
        if (err) {
            res.json({ error: err});
        } else {
            res.json({success: results});
        }
    });
});
/* Count datbase entries for a particular cert TYPE */
app.get('/count/:cert/type/:type',function(req,res) {
    var collection = mongo.collection('quiz');
    var cert = req.params.cert;
    var type = req.params.type;
    
    collection.count({ cert: cert,type: type},function(err,results){
        if (err) {
            res.json({ error: err});
        } else {
            res.json({success: results});
        }
    });
});
/* Count database entries for a particular cert TOPIC */
app.get('/count/:cert/topic/:topic',function(req,res) {
    var collection = mongo.collection('quiz');
    var cert = req.params.cert;
    var topic = req.params.topic;

    collection.count({ cert: cert, keywords: { $in: [ topic ] } },function(err,results){
        if (err) {
            res.json({ error: err});
        } else {
            res.json({success: results});
        }
    });
});


var server = http.createServer(app);
server.listen(app.get('port'));