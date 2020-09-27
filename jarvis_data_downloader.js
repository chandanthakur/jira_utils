var utils = require('./utils/utils');
var networkUtils = require('./utils/network-utils')
const { Task } = require('./utils/worker_pool');
const { WorkerPool } = require('./utils/worker_pool');

let downloadAndSaveUrl = function(url) {
    let localfile = url.timeseries == "true" ? url.name + "." + utils.getISOTS() + ".json" : url.name + ".json";
    return networkUtils.downloadAndSaveUrl(url.url, localfile, {"rejectUnauthorized": false }); 
}

let resultData = {};
let nUrls = 0;
let downloadTask = function(args, onSuccess, onError) {
    let urlMeta = args;
    let p = networkUtils.getResponseForUrl(urlMeta.url, {"rejectUnauthorized": false });
    let ts = utils.getTS();
    p.then(function(response) {
        let timeTaken = Math.floor(utils.getTS() - ts);
        utils.log("Downloaded:" + urlMeta.url + " in " + timeTaken + " ms")
        let responseObject = JSON.parse(response);
        resultData[urlMeta.url] = { response: responseObject, meta: urlMeta };
        utils.log("Total Downloaded:" + Object.keys(resultData).length + "/" + nUrls);
        onSuccess();
    }).catch(function(err){
        resultData[urlMeta.url] = null;
        utils.log("Download Error:" + ulrMeta.url + err);
        onError(err);
    });
}

let downloadUrlsUsingWorkerPool = function(urlList) {
    let nWorkers = urlList.length > 5 ? 5 : 1; 
    let pool = new WorkerPool(nWorkers, onWorkComplete);
    nUrls = urlList.length;
    for(let kk = 0; kk < urlList.length; kk++) {
        let urlMeta = urlList[kk];
        pool.addTask(new Task(urlMeta.name, urlMeta, downloadTask));
    }

    pool.start();
}

let loadUrlsFromCsv = function() {
    return utils.getTableRowsV2("./config/node-pool-stats.csv", "#").then(function(r){
        r.shift();// skip the header
        return r;
    });
}

let loadUrlsMain = function() {
    let p = loadUrlsFromCsv();
    p.then(function(urlList) {
        downloadUrlsUsingWorkerPool(urlList);
    }).catch(function(err){
        utils.log(err);
    });
}

let main = function() {
    loadUrlsMain();
}

main()