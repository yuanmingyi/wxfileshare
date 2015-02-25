var log4js = require("log4js");

log4js.configure("config/log4js.json", {});
var logger = log4js.getLogger("console");

exports.logger = function (level) {
    if (level) {
        logger.setLevel(level);
    }
    return logger;
};

exports.use = function (app, level) {
    level = level || "info";
    app.use(log4js.connectLogger(logger, { "level": level, format: ':method :url' }));
};