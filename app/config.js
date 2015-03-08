exports.load = function (configName, encoding) {
    var fs = require("fs");
    var encoding = encoding || "utf8";
    //console.log('__dirname:' + __dirname);
    if (configName === 'azure-storage' && process.env.EMULATED) {
        configName = 'azure-storage-emulator';
    }
    var file = fs.readFileSync(__dirname + "/../config/" + configName + ".json", encoding);
    return JSON.parse(file);
}