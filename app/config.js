exports.load = function (configName, encoding) {
    var fs = require("fs");
    var encoding = encoding || "utf8";
    var file = fs.readFileSync(__dirname + "/../config/" + configName + ".json", encoding);
    return JSON.parse(file);
}