var http = require('http');
var log4js = require('log4js');
var wxCallbackApiTest = require('./wxCallbackApiTest');
var port = process.env.port || 1337;

log4js.configure('./config/log4js.json', {});
var logger = log4js.getLogger("console");
wxCallbackApiTest.setLogger(logger);

http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    var ret = wxCallbackApiTest.valid(req.url);
    res.end(ret);
}).listen(port);

logger.info('HTTP server is listening at port ' + port);