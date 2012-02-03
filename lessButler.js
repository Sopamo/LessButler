/**
 * LessButler is a little http server written in node.js (http://nodejs.org) which compiles less files to css
 * Files are only compiled when they change and otherwise served from cache
 *
 * @author Paul Mohr (http://4ppletree.me)
 * @version 0.1 from 3. February 2012
 * @licence MIT http://www.opensource.org/licenses/mit-license.php
 *
 * usage:
 * - set config.path to the absolute path of your website
 * - run node lessButler.js
 * - call yourdomain:8000/path/to/less.less
 * - be happy :)
 */

var less = require('less'),
	http = require('http'),
    url = require('url'),
    fs = require('fs');

var config = {
    rootPath:'/Users/paulmohr/Dropbox/LessButler', // Change this to your website path
    minify:1, // not in use yet
    maxMemorySize:1, // in mb. 1mb should be large enough for most cases.
    port:8000
}

var lessFiles = {};

function LessFile(path, css) {
    this.path = path;
    this.parsed;
    this.css;
    this.fileSize;

    if (css !== undefined) this.css = css;
}

LessFile.prototype.isModified = function () {
    var stat = fs.statSync(this.path),
        modified = new Date(stat.mtime).getTime();
    return modified > this.parsed;
};

LessFile.prototype.handleMemory = function () {
    var overallSize = 0;
    for (f in lessFiles)
        if (isInt(f.fileSize))
            overallSize += f.fileSize;

    if (overallSize / 1024 / 1024 > config.maxMemorySize) {
        console.log('Memory limit exceeded. Maybe you should increase it?');
        // @TODO: simply deleting the first possible entry isn't very kind. We need some sort of algorithm here. (Maybe counting the servings )
        var deletionIndex = false;
        for (fileIndex in lessFiles) {
            if (lessFiles[fileIndex] != this) {
                deletionIndex = fileIndex;
                break;
            }
        }
        if (deletionIndex === false) throw 'Exceeded memory and can\'t delete any cache!';
        else {
            lessFiles.splice(deletionIndex, 1);
            this.handleMemory();
        }
    }
}

LessFile.prototype.parse = function (callback) {
    var lessFile = this;
    fs.readFile(lessFile.path, 'utf8', function (err, data) {
        if (err) throw err;
        less.render(data, function (e, css) {
            if (e) throw e;
            console.log('Parsed: ' + lessFile.path);
            lessFile.fileSize = Buffer.byteLength(css, 'utf8');
            lessFile.parsed = new Date().getTime();
            lessFile.css = css;
            lessFile.handleMemory();
            if (callback !== undefined) callback(lessFile);
        });
    });
}

LessFile.prototype.serve = function (callback) {
    var stat = fs.statSync(this.path);
    var modified = new Date(stat.mtime).getTime();
    if (this.isModified()) {
        this.parse(callback);
    } else {
        if (callback !== undefined) callback(this);
    }
}

var server = http.createServer(function (req, res) {
    var requestUrl = url.parse(req.url);
    if (requestUrl.path.substring(requestUrl.path.length - 4, requestUrl.path.length) == 'less') {
        res.writeHead(200, {'Content-Type':'text/plain'});
        var lessPath = config.rootPath + requestUrl.path;
        if (lessFiles[lessPath] !== undefined) {
            lessFiles[lessPath].serve(function (lessFile) {
                console.log('Served cached file: ' + lessFile.path);
                res.end(lessFile.css);
            });
        } else {
            lessFile = new LessFile(lessPath);
            lessFile.parse(function (lessFile) {
                console.log('Served new file: ' + lessPath);
                lessFiles[lessPath] = lessFile;
                res.end(lessFile.css);
            });
        }
    } else {
        res.writeHead(400, {'Content-Type':'text/plain'});
        res.end('');
    }
});

server.listen(config.port);