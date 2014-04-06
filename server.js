var express = require('express');
var request = require('request');
var parseString = require('xml2js').parseString;

var TWITTER_CONSUMER_KEY = "tz8NWGoSwc8Is0iTdgYfru93l";
var TWITTER_CONSUMER_SECRET = "Kcl1KJc1UJP4Jifcm6GoJtAfIWL2vkZ3ejD8QqYkQuvvgAX8u8";


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
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
});

var getSentiment = function getSentiment(json) {
    return json["S:Envelope"]["S:Body"][0]['ns2:processMultiVerbatimDocumentResponse'][0].return[0].degreeSentiment;
}

var getSentences = function getSentences(json) {
    return json["S:Envelope"]["S:Body"][0]["ns2:processMultiVerbatimDocumentResponse"][0].return[0].verbatimSet[0].verbatim[0].sentences[0].sentence.map(function(elem){return {text:elem.text, sentiment: elem.degreeSentiment }});
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

    request.post(options, function (error, response, body) {
        parseString(body, function(err,results) { callback(err, results); });
    });
}

var getTweets = function getTweets(handle, callback) {
    var uri = "https://api.twitter.com/oauth2/token";
    var headers = {
        'Content-Type': "application/x-www-form-urlencoded;charset=UTF-8",
        'Authorization': 'Basic ' + new Buffer(TWITTER_CONSUMER_KEY + ':' + TWITTER_CONSUMER_SECRET).toString('base64') 
    };
    var options = {
        uri: uri,
        headers: headers,
        body: "grant_type=client_credentials"
    }
    request.post(options, function (error, response, body) {
        var uri2 = "https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=" + handle + "&include_rts=falsei&count=3000";
        var headers2 = {'Authorization': 'Bearer ' + JSON.parse(body).access_token}; 
        var options2 = {
            uri: uri2,
    headers: headers2
        } 
        request.get(options2, function(error2, response2, body2) {
            callback(error2, body2);
        });
    });
} 

app.get('/', function(req, res){
    var params = {};
    var handle = req.param('handle');
    if(handle) {
        getTweets(handle, function(err, data){
            console.log(Object.prototype.toString.call( JSON.parse(data) ) === '[object Array]');
            if(! (Object.prototype.toString.call( JSON.parse(data) ) === '[object Array]')) {
                handle = "HANDLE DOES NOT EXIST"
                res.render('index', {sentiment: "DOES NOT EXIST", text:"", data:"", twitter_data: [], tweeter:handle}); 
                return;
            }
            var twitter_data = JSON.parse(data);
            var tweet_essay = twitter_data.map(function(elem){ return elem.text.replace(/\?|!|\.|;|-|and/g,"");}).join('.  ');
            getClar(tweet_essay, "VERBATIM_AND_SENTENCE", function(error, sentiment_data){
                console.log(JSON.stringify(sentiment_data,null,1));
                var s = getSentiment(sentiment_data);
                var sentences = getSentences(sentiment_data).map(function(elem, i){elem.date=twitter_data[i].created_at; return elem;});
                s = (parseFloat(s[0]) + 2)*25;
		        s = Math.ceil(Math.max(0, Math.min(100,s)));
                res.render('report', {sentiment: s, text:"", data:sentences, twitter_data: JSON.parse(data), tweeter:handle}); 
            });
        });
    }
    else {
        res.render('index', {sentiment: "", text:"", data:"", twitter_data: [], tweeter:""});
    }
});

app.get('/text', function(req, res){
    var params = {};
    var verbatim = req.param('verbatim');
    getClar(verbatim, "VERBATIM", function(error, data){
        console.log(data);
        var sentiment = getSentiment(data);
        res.render('text', {sentiment: sentiment, text:verbatim, data:data});
    });
});

var port = Number(process.env.PORT || 5000);
app.listen(port);
