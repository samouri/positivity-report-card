var express = require('express');
var passport = require('passport');
var util = require('util');
var Twit = require('twit');
var TwitterStrategy = require('passport-twitter').Strategy;
var async = require("async");
var request = require('request');
var parseString = require('xml2js').parseString;

var TWITTER_CONSUMER_KEY = "tz8NWGoSwc8Is0iTdgYfru93l";
var TWITTER_CONSUMER_SECRET = "Kcl1KJc1UJP4Jifcm6GoJtAfIWL2vkZ3ejD8QqYkQuvvgAX8u8";

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Twitter profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the TwitterStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a token, tokenSecret, and Twitter profile), and
//   invoke a callback with a user object.
passport.use(new TwitterStrategy({
    consumerKey: TWITTER_CONSUMER_KEY,
    consumerSecret: TWITTER_CONSUMER_SECRET,
    callbackURL: "http://127.0.0.1/auth/twitter/callback"
  },
  function(token, tokenSecret, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      // To keep the example simple, the user's Twitter profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the Twitter account with a user record in your database,
      // and return that user instead.
      profile.info = {
          consumer_key:         TWITTER_CONSUMER_KEY, 
          consumer_secret:      TWITTER_CONSUMER_SECRET, 
          access_token:         token, 
          access_token_secret:  tokenSecret };
      return done(null, profile);
    });
  }
));



var app = express(), server = require('http').createServer(app);

// configure Express
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: 'keyboard cat' }));
  // Initialize Passport!  Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

var getSentiment = function getSentiment(json) {
       return json["S:Envelope"]["S:Body"][0]['ns2:processMultiVerbatimDocumentResponse'][0].return[0].degreeSentiment;
}

var getOtherStuff = function getVerbatim(json) {
       return "";
}

var getClar = function getClar(text, verbatimLevel, callback) {
    var uri = "https://cilantro.clarabridge.com/cbapi/realtime";
    var verbatim = text;
    var project_name = "API Project One";
    var response_level = verbatimLevel;
    var verbatim_type = "tweet";
    var data = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:real="http://realtime.cbapi.clarabridge.com/"><soapenv:Header/><soapenv:Body> <real:processMultiVerbatimDocument> <processMultiVerbatimDocumentRequest> <projectName>' + project_name +'</projectName> <responseLevel>'+ response_level +'</responseLevel> <verbatimSet> <verbatim type="'+verbatim_type +'">'+ verbatim +'</verbatim> </verbatimSet> </processMultiVerbatimDocumentRequest> </real:processMultiVerbatimDocument> </soapenv:Body> </soapenv:Envelope>';
    var method = "POST";
    var headers = {
        'Authorization': 'Basic ' + new Buffer('jakefried' + ':' + 'poSitivity!476').toString('base64') 
    };
    options = {
        uri: uri,
        headers: headers,
        body: data
    }
    var ret;
    request.post(options, function (error, response, body) {
        parseString(body, function(err,results) { callback(err, results); });
    });
}

app.get('/', function(req, res){
    var params = {};
    res.render('signin', {sentiment: "", text:"", data:""});
});

app.get('/text', function(req, res){
    var params = {};
    var verbatim = req.param('verbatim');
    getClar(verbatim, "VERBATIM", function(error, data){
        console.log(data);
        var sentiment = getSentiment(data);
        res.render('signin', {sentiment: sentiment, text:verbatim, data:data});
    });
});

/*
app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});
*/ 
// GET /auth/twitter
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Twitter authentication will involve redirecting
//   the user to twitter.com.  After authorization, the Twitter will redirect
//   the user back to this application at /auth/twitter/callback
app.get('/auth/twitter', passport.authenticate('twitter'));

// GET /auth/twitter/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/twitter/callback', 
  passport.authenticate('twitter', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

var port = Number(process.env.PORT || 5000);
app.listen(port);


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
}
