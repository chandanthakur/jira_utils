var fs = require('fs');
const fetch = require('node-fetch');
var request = require("request").defaults({rejectUnauthorized:false});
var level = require('level');
const utils = require('./utils');
var cacheDb = level('http-cache')
  
let getKey = function(key) {
    return cacheDb.get(key).then(function(valStr){
        if(!valStr) return null;
        let value = JSON.parse(valStr);
        let currTS = utils.getTS();
        if(currTS > value.expireAt) return null;
        let ageLeft = Math.floor((value.expireAt - currTS)/1000);
        utils.log("Cache:EntryFound:" + key + ", expires in " + ageLeft + " secs");
        return value.data;
    }, function(err){
        return null;
    });
}

let putKey = function(key, value, age) {
    let cacheVal =  {};
    cacheVal.createAt = utils.getTS();
    cacheVal.data = value;
    cacheVal.age = age ? age: 3600; // default 
    cacheVal.expireAt = cacheVal.createAt + cacheVal.age*1000;
    return cacheDb.put(key, JSON.stringify(cacheVal));
}

let getResponseForUrl = function (url, headers, isValidFn) {
    let result = null;
    let isNetworkResponse = false;
    let cacheKey = headers ? url + ":" + JSON.stringify(headers) : url;
    return getKey(cacheKey).then(function (value) {
        if (value && (!isValidFn || isValidFn(value))) {
            return value;
        } else {
            isNetworkResponse = true;
            return getNetworkResponseForUrl(url, headers)
        }
    }).then(function (value) {
        result = value;
        if(isNetworkResponse) 
            return putKey(cacheKey, value, headers.age);
        else 
            return value 
    }).then(function () {
        return result;
    });
}

let getNetworkResponseForUrl = function (url, headers) {
    headers.compress = true;
    return fetch(url, headers).then(res => res.text())
}

let getJsonResponseForUrl = function (url, headers) {
    return utils.getResponseForUrl(url, headers).then(function (response) {
        try {
            var jsonObject = JSON.parse(response);
            return jsonObject;
        } catch (ex) {
            return null;
        }
    });
}

let downloadFile = function (url, headers, filePath) {
    console.log("Downloading: " + url + " to " + filePath);
    var promise = new Promise(function (resolve, reject) {
        request({ uri: url, headers: headers }, function (error, response, body) {
            if (error) {
                reject(error);
                return;
            }

            resolve(filePath);
        }).pipe(fs.createWriteStream(filePath));
    });

    return promise;
}

let downloadAndSaveUrl = function(url, localfile, headers) {
    let p = getNetworkResponseForUrl(url, headers); 
    let response = {};
    return p.then(function(res) {
        response.url = url;
        response.data = res;
        response.localfile = localfile;
        response.size = Math.floor(res.length/1024);//KB
        utils.log("Downloaded Url: " + url);
        utils.log("Downloaded Size: " + response.size + " KB");
        return utils.writeToFile("./data/" + response.localfile, res);
    }).then(function() {
        utils.log("Saved Url to " + response.localfile);
        return response;
    }, function(err){
        utils.log(url + ":" + err);
    });
}

module.exports = {
    getNetworkResponseForUrl: getNetworkResponseForUrl,
    getResponseForUrl: getResponseForUrl,
    getJsonResponseForUrl: getJsonResponseForUrl,
    downloadAndSaveUrl: downloadAndSaveUrl
}
