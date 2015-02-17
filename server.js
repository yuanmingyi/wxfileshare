var http = require('http');
var url = require('url');
var util = require('util');

var port = process.env.port || 1337;
http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    req.on('data', function (chunk) {
        res.write('<p>Data:</p>');
        res.write(util.inspect(chunk));
    });
    req.on('end', function () {
        rstring = util.inspect(req);
        res.write('<p>Request:</p>');
        res.end(rstring);
    })
}).listen(port);

console.log('HTTP server is listening at port ' + port);