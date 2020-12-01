var utils = require('./utils/utils');
var networkUtils = require('./utils/network-utils')
const { Task } = require('./utils/worker_pool');
const { WorkerPool } = require('./utils/worker_pool');
let resultData = {};
let commitData = {};
let nUrls = 0;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0; // unauthorized ssl

let summarizeTestData = function(data, meta) {
    let res = {};
    let master = data.data.filter(row => row.branch == "master");
    master = master.sort((a,b) => a.created_at.$date - b.created_at.$date);
    let runTime = [];
    master.forEach(row => {
        if(row.status != "Succeeded" || !row.end_time) return;
        let time = Math.floor((row.end_time.$date - row.start_time.$date)/1000);
        runTime.push(time);
    });

    res.name = meta.name;
    res.primaryComponent = meta.primaryComponent;
    res.estimatedComponent = meta.estimatedComponent,
    res.priority = meta.priority,
    res.regType = meta.isRegHanded ? "reg" : "non-reg";
    res.testType = meta.isUI ? "UI": "API";
    let status = utils.groupCountByColumn(master, "status");
    res.passed = status.Succeeded || 0;
    res.failed = status.Failed || 0;
    res.skipped = status.Skipped || 0;
    res.totalRun = res.passed + res.failed + res.skipped;
    res.successPercent = res.totalRun > 0 ? Math.floor((100.0*res.passed)/res.totalRun) : 0
    res.skipPercent = res.totalRun > 0 ? Math.floor((100.0*res.skipped)/res.totalRun) : 0
    let runTimeP = utils.getPercentiles(runTime);
    res.durationP50 = runTimeP.p50;
    res.durationP80 = runTimeP.p80;
    res.durationP90 = runTimeP.p90;
    res.nextPassProbability = getNextRunPassProbability(data.data);
    res.lastFive = getLastFiveSuccessFail(data.data);
    return res;
}

let populateCommitMap =  function(data, meta) {
    let master = data.data.filter(row => row.branch == "master");
    master.forEach(r => {
        let commitId = r.commit_id;
        commitData[commitId] = commitData[commitId] || { commitId: commitId, data: []};
        commitData[commitId].updatedAt = r.updated_at.$date;
        commitData[commitId].data.push(r);
    });
}

let downloadTask = function(args, onSuccess, onError) {
    let urlMeta = args;
    let p = networkUtils.getResponseForUrl(urlMeta.url, {"rejectUnauthorized": false, age: 2*86400 });
    let ts = utils.getTS();
    p.then(function(response) {
        let timeTaken = Math.floor(utils.getTS() - ts);
        let size = Math.floor(response.length/1024);
        utils.log(utils.fmt3("Download {0} in {1} ms, {2} KB", urlMeta.url, timeTaken, size));
        let responseObject = JSON.parse(response);
        let summary = summarizeTestData(responseObject, urlMeta); 
        populateCommitMap(responseObject, urlMeta);
        resultData[urlMeta.url] = { summary: summary, meta: urlMeta };
        utils.log("Total Downloaded:" + Object.keys(resultData).length + "/" + nUrls);
        onSuccess();
    }).catch(function(err){
        resultData[urlMeta.url] = null;
        utils.log("Download Error:" + urlMeta.url + err);
        onError(err);
    });
}

let getNextRunPassProbability = function(runData){
    let factor = 1/4;
    let res = 0;
    let q = 0;
    for(let kk = runData.length - 1; kk >= 0; kk--) {
        let r = runData[kk];
        let pass = r.status == "Succeeded";
        res = pass ? res + factor : res;
        q =  q + 1;
        factor = q%2 == 0 ? factor/2: factor;
    }

    return Math.floor(res*100)/100;
}

let getLastFiveSuccessFail = function(runData){
    let res = "";
    let qq = 0;
    for(let kk = runData.length - 1; kk >= 0; kk--) {
        let r = runData[kk];
        res = r.status == "Succeeded"? res + "P": res + "F";
        qq++;
        if(qq == 5) break;
    }

    return res;
}

let outputStats = function(rows, fileName) {
    let csvRows = utils.getRowsInCsvFormat(rows);
    utils.log("Generating " + fileName);
    return utils.writeToFile(fileName, csvRows.join("\n"));
}

let onWorkComplete = function() {
    let keys = Object.keys(resultData);
    let summary = [];
    keys.forEach(key => {
        summary.push(resultData[key].summary)
    });

    let p = [];
    // sorting based on multiple fields
    summary = summary.sort((a,b) => {
        if(a.estimatedComponent != b.estimatedComponent) {
            return utils.strcmp(a.estimatedComponent, b.estimatedComponent);
        } else if(a.regType != b.regType) {
            return utils.strcmp(b.regType, a.regType);
        } else if(a.testType != b.testType) {
            return utils.strcmp(b.testType, a.testType);
        } else {
            return b.successPercent - a.successPercent;
        }
    });

    p.push(outputStats(summary, "ahv-test-stats-all-components.gen.csv"));
    let groupColumns = ["estimatedComponent", "regType", "testType"];
    let groupedItems = utils.groupItemsByColumns(summary, groupColumns);
    let agregateColumns = [];
    agregateColumns.push(["count", "uniqueTests"]);
    agregateColumns.push(["sum", "passed"]);
    agregateColumns.push(["sum", "failed"]);
    agregateColumns.push(["sum", "totalRun"]);
    agregateColumns.push(["sum", "durationP50"]);
    agregateColumns.push(["sum", "durationP80"]);
    agregateColumns.push(["sum", "durationP90"]);
    groupedItems.forEach(function(entry){
        let component = entry.estimatedComponent.toLowerCase();
        let fileName = utils.fmt3("ahv-test-stats-{0}-{1}-{2}.gen.csv", component, entry.testType, entry.regType);
        entry.items = entry.items.sort((a,b) => (b.successPercent - a.successPercent));
        p.push(outputStats(entry.items, fileName));
    });

    let aggregate = utils.agregateByColumns(summary,groupColumns, agregateColumns);
    aggregate = aggregate.sort((a,b) => utils.strcmp(a.estimatedComponent, b.estimatedComponent));
    p.push(outputStats(aggregate, "ahv-test-summary-all-components.gen.csv"));

    Promise.all(p).then(function(files) {
        utils.log("Done.All Good.");
    }).catch(function(err){
        utils.log(err);
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

let loadTestQpUrlList = function() {
    return utils.getTableRowsV2("./config/ahv_functional_test_meta.csv").then(function(r){
        let urlList = [];
        let baseUrl = 'https://jita.eng.nutanix.com/api/v1/agave_tests/history?name={0}&sort=-created_at&limit=1000';
        r.shift();// skip the header
        //r= r.slice(0, 50);
        r.forEach((item, i) => {
            //if(i%10 != 0) return;
            //if(item.name != "acropolis.ahv_management.scheduler.cclm.test_cclm.TestCCLM.test_cclm_migration_failure_2") return;
            let isReghanded = item.isRegHanded == "true";
            if(!(item.estimatedComponent == "OVA" || item.estimatedComponent == "AHV-Management" || item.estimatedComponent == "Uhura" || item.estimatedComponent == "Ergon")) return;
            urlList.push({
                name: item.name,
                url: utils.fmt1(baseUrl, item.name),
                priority: item.priority,
                primaryComponent: item.primaryComponent,
                estimatedComponent: item.estimatedComponent,
                isRegHanded: isReghanded,
                isUI: item.isUI == "true"
            });
        });

        //urlList = urlList.slice(0, 100);
        return urlList;
    });
}

let loadUrlsMain = function() {
    let p = loadTestQpUrlList();
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