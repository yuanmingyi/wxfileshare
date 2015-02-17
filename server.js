var http = require('http');
var url = require('url');
var util = require('util');
var wxCallbackApiTest = require('./wxCallbackApiTest');
var port = process.env.port || 1337;

http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    var ret = wxCallbackApiTest.valid(req);
    res.end(ret);
}).listen(port);

console.log('HTTP server is listening at port ' + port);