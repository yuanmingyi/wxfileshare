var compare = function (obj1, obj2, exactly) {
    // if exactly == true, then obj1 should exactly equal obj2
    // otherwise, return if obj1 contains obj2
    var type = typeof obj1;
    if (type !== (typeof obj2)) {
        return false;
    }

    if (type !== 'object' || obj1 === null) {
        return obj1 === obj2;
    }

    var keys2 = Object.getOwnPropertyNames(obj2);
    if (exactly && keys2.length !== Object.getOwnPropertyNames(obj1).length) {
        return false;
    };

    for (var i = 0; i < keys2.length; i++) {
        var key = keys2[i];
        if (!obj1.hasOwnProperty(key)) {
            return false;
        }

        var value1 = obj1[key];
        var value2 = obj2[key];

        if (!compare(value1, value2)) {
            return false;
        }
    }

    return true;
}

exports.compare = compare;

exports.contains = function (set, ele, exactly) {
    for (var i = 0; i < set.length; i++) {
        if (compare(set[i], ele, exactly)) {
            return true;
        }
    }

    return false;
};