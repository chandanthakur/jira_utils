const networkUtils = require('./utils/network-utils');
var utils = require('./utils/utils');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0; // unauthorized ssl
// users nodes
// https://jarvis.eng.nutanix.com/api/v2/pools/562f1d0a7e6e21292f14e729/user_details
// https://jarvis.eng.nutanix.com/api/v2/pools/562f1d0a7e6e21292f14e729/cluster_details

let baseUrl = "https://jarvis.eng.nutanix.com/api/";
let jarvisUrl = utils.fmt1("{0}/v1/clusters?limit=1000&search=acropolis", baseUrl);
let poolName = "Acropolis";// Acropolis
let clusterAge = function(createdAt) {
    return Math.floor((new Date().getTime() - createdAt)/(1000*60*60*24));
}

let getClusterResponse = function(response, managerMap){
    let json = JSON.parse(response);
    let data = json.data;
    const acropolisPool = data.filter(row => row.pools_cache[0] == poolName);
    acropolisPool.sort((a,b) => clusterAge(b.created_at.$date) - clusterAge(a.created_at.$date));
    let op = [];
    for(let kk = 0; kk < acropolisPool.length; kk++) {
        let row = acropolisPool[kk];
        let date = new Date(row.created_at.$date).toISOString().substr(0, 10);
        let owner = row.owner.email != "jita.svc@nutanix.com" ? row.owner.email : row.client.owner + "@nutanix.com";
        let manager = managerMap[owner] || "undefined";
        let payload = {
            clusterId: row.name,
            OwnerEmail: owner,
            Manager: manager,
            Age: clusterAge(row.created_at.$date), 
            CreationDate: date, 
            NodeCount: row.nodes_cache.nodes_count
        };

        op.push(payload);
        /*if(row.owner.email == "jita.svc@nutanix.com" ) {
            console.log("ERROR:" + JSON.stringify(payload));
        }*/
    }

    return op;
}

let loadManagerMap = function() {
    return utils.getTableRowsV2("./config/manager_report.csv").then(function(r){
        let map = {};
        r.forEach(item => map[item.name] = item.manager);
        return map;
    });
}

let getDataByDeveloper = function(data) {
    let result = {};
    data.forEach (function (item) {
        let key = item.Manager + "_" + item.OwnerEmail;
        result[key] = result[key] || { Manager: item.Manager, OwnerEmail: item.OwnerEmail, NodeCount: 0 };
        result[key].NodeCount = result[key].NodeCount + item.NodeCount;
    });

    let rows = [];
    Object.keys(result).forEach(item => rows.push(result[item]));
    rows = rows.sort((a,b) => b.NodeCount - a.NodeCount);
    rows = rows.sort((a,b) => {
        if (b.Manager < a.Manager) return 1;
        if (b.Manager > a.Manager) return -1;
        return 0;
    });

    rows.forEach((dev) => {
        if(dev.NodeCount > 4) {
            console.log("ERROR:" + JSON.stringify(dev));
        }
    });

    return rows;
}

let getSummaryByManager = function(data) {
    let result = {};
    data.forEach(function(item) {
        result[item.Manager] = result[item.Manager] || { Manager: item.Manager, NodeCount: 0, OwnerMap: {}};
        result[item.Manager].OwnerMap[item.OwnerEmail] = item.OwnerEmail;
        result[item.Manager].NodeCount = result[item.Manager].NodeCount + item.NodeCount;
    });

    let rows = [];
    Object.keys(result).forEach(function(item){
        result[item].Developers = Object.keys(result[item].OwnerMap).length;
        delete result[item]["OwnerMap"];
        rows.push(result[item]);
    });

    return rows.sort((a,b) => b.NodeCount - a.NodeCount);
}

let outputStats = function(rows, fileName) {
    let csvRows = utils.getRowsInCsvFormat(rows);
    utils.log("Generating " + fileName);
    return utils.writeToFile(fileName, csvRows.join("\n"));
}

let getStatsFromNetwork = function(url) {
    let managerMap = {};
    let p1 = loadManagerMap();
    let p2 = networkUtils.getResponseForUrl(url, {"rejectUnauthorized": false });
    utils.log("Downloading data from jarvis: " + url);
    return Promise.all([p1, p2]).then(function(result){
        managerMap = result[0];
        return getClusterResponse(result[1], managerMap);
    });
}

let getDataFromFile = function(filePath) {
    let managerMap = {};
    let p1 = loadManagerMap();
    let p2 = utils.readFile(filePath);
    utils.log("Reading data from file: " + filePath);
    return Promise.all([p1, p2]).then(function(result){
        managerMap = result[0];
        return getClusterResponse(result[1], managerMap);
    });
}

let downloadAndProcessStatsFromNetwork = function() {
    getStatsFromNetwork(jarvisUrl).then(function(response){
        let o1 = outputStats(response, "cluster_age_stats.gen.csv");
        let o2 = outputStats(getSummaryByManager(response), "node_manager_usage.gen.csv");
        let o3 = outputStats(getDataByDeveloper(response), "node_developer_usage.gen.csv");
        return Promise.all([o1, o2, o3]);
    }).then(function(){
        utils.log("Done.All Good.");
    }).catch(function(err){
        utils.log(err);
    });
}

let processStatsFromFile = function() {
    let filePath = "./data/acropolis-pool-stats.2021-02-20T03:10:54.334Z.gen.json";
    getDataFromFile(filePath).then(function(response) {
        let o1 = outputStats(response, "cluster_age_stats.gen.csv");
        let o2 = outputStats(getSummaryByManager(response), "node_manager_usage.gen.csv");
        let o3 = outputStats(getDataByDeveloper(response), "node_developer_usage.gen.csv");
        return Promise.all([o1, o2, o3]);
    }).then(function() {
        utils.log("Done.All Good.");
    }).catch(function(err) {
        utils.log(err);
    });
}

let processStatsFromDir = function() {
    utils.getFilesFromDir("./data", "cluster_usage_jarvis", ".json").then(function(files){
        let parr = [];
        files.forEach((f) => parr.push(getDataFromFile(f)));
        return Promise.all(parr);
    }).then(function (resList) {
        resList.forEach(res => getDataByDeveloper(res));
        return Promise.all(resList);
    }).catch(function (err) {
        utils.log(err);
    });
}

let main = function() {
    processStatsFromDir();
    
    // downloadAndProcessStatsFromNetwork();
    //processStatsFromFile();
}

main()