var utils = require('./utils/utils');
var networkUtils = require('./utils/network-utils')
const { Task } = require('./utils/worker_pool');
const { WorkerPool } = require('./utils/worker_pool');

let nUrls = 0;
let downloadAndSaveUrl = function(url, onSuccess, onError) {
    let localfile = url.timeseries == "true" ? url.name + "." + utils.getISOTS() + ".json" : url.name + ".json";
    let p = networkUtils.downloadAndSaveUrl(url.url, localfile, {"rejectUnauthorized": false });
    p.then(function() {
        onSuccess();
    }).catch(function(err){
        onError(err);
    });
}

let downloadUrlsUsingWorkerPool = function(urlList) {
    let nWorkers = urlList.length > 5 ? 5 : 1; 
    let pool = new WorkerPool(nWorkers, function(){});
    nUrls = urlList.length;
    for(let kk = 0; kk < urlList.length; kk++) {
        let urlMeta = urlList[kk];
        pool.addTask(new Task(urlMeta.name, urlMeta, downloadAndSaveUrl));
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