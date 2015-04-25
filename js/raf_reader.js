var fs = require("fs"),
    path = require("path"),
    BufferCursor = require("buffercursor"),
    zlib = require("zlib"),
    exec = require("child_process").execSync;

function getRafFiles(basePath) {
    var contents = fs.readdirSync(basePath);
    var files = contents.map(function (file) {
        return path.join(basePath, file);
    }).filter(function (file) {
        return fs.statSync(file).isDirectory();
    }).map(function (dir) {
        return findRafFilesInFolder(dir);
    }).reduce(function(a, b) {
        return a.concat(b);
    });
    return files;
}

function findRafFilesInFolder(folder) {
    var contents = fs.readdirSync(folder);
    return contents.map(function (file) {
        return path.join(folder, file);
    }).filter(function (file) {
        return path.extname(file) == ".raf";
    });
}

function findFilesInRaf(pathToRaf) {
    var buf = new BufferCursor(fs.readFileSync(pathToRaf));
    var header = buf.readInt32LE();
    console.assert(header == 0x18be0ef0, "Illegal RAF file at path " + pathToRaf + "! Given: "+header.toString(16)+", expected 0x18BE0EF0");
    
    buf.readInt32LE(); //version
    buf.readInt32LE(); //manager version

    var fileListOffset = buf.readInt32LE();
    var pathListOffset = buf.readInt32LE();

    buf.seek(pathListOffset + 4);
    var pathCount = buf.readInt32LE(); //Skip 4 bytes because we skip the # of bytes

    var paths = [];
    for (var i = 0; i < pathCount; i++) {
        buf.seek(pathListOffset + 8 + (8 * i)); //8 for the two ints, then 8 bytes per entry.
        var pathEntryOffset = buf.readInt32LE();
        var pathEntryStringSize = buf.readInt32LE() - 1; //Remove 1 for the null byte at the end.

        buf.seek(pathListOffset + pathEntryOffset);
        paths.push(buf.slice(pathEntryStringSize).toString('ascii'));
    }

    buf.seek(fileListOffset);
    var fileCount = buf.readInt32LE();

    var files = [];
    for (i = 0; i < fileCount; i++) {
        files.push({
            "hash": buf.readInt32LE(),
            "offset": buf.readInt32LE(),
            "size": buf.readInt32LE(),
            "file": pathToRaf,
            "path": paths[buf.readInt32LE()]
        });
    }

    return files;
}

// Converts a list of file objects to a tree. Outputs:
// "DATA":
//    "Scripts":
//        "File1": bla
//        "File2": bla
//    "Spells":
//        "File3": bla
//    "File4": bla
function convertToTree(array) {
    var ret = {};
    array.forEach(function(file, index) {
        file["index"] = index;
        var pathParts = file.path.split("/");
        var curPart = ret;
        pathParts.forEach(function(part) {
            if (part.indexOf(".") > -1) {
                curPart[part] = file;
            } else {
                var oldPart = curPart;
                curPart = curPart[part] ? curPart[part] : {};
                oldPart[part] = curPart;
            }
        }, this);
    }, this);
    return ret;
}

function readEntry(entry) {
    var archiveBuffer = new BufferCursor(fs.readFileSync(entry.file + ".dat"));
    archiveBuffer.seek(entry.offset);
    var contents = archiveBuffer.slice(entry.size).buffer;

    var header = contents.readInt16BE();
    if (header == 0x7801 || header == 0x789C || header == 0x78DA) {
        contents = zlib.unzipSync(contents);
    }

    if (entry.path.indexOf(".luaobj") > -1) {
        contents = new Buffer(exec("java -jar unluac.jar -1", {"input":contents}), 'ascii');
    }

    return contents;
}

var files = getRafFiles("/Applications/League of Legends.app/Contents/LoL/RADS/projects/lol_game_client/filearchives/").map(function(file) {
    return findFilesInRaf(file);
}).reduce(function(a, b) {
    return a.concat(b);
});

module.exports = {"files": files, "tree": convertToTree(files), "read": readEntry};

var ini = require('./inibin_reader');
files.filter(function(f) {
    return f.path.indexOf(".inibin") > -1;
}).slice(0, 10).map(function(f) {
    return readEntry(f);
}).forEach(function(buf) {
    //console.dir(ini.inibinToObject(buf));
});
