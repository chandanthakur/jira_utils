var utils = require('./utils/utils');
var networkUtils = require('./utils/network-utils')
const { Task } = require('./utils/worker_pool');
const { WorkerPool } = require('./utils/worker_pool');
let nUrls = 0;
const fetch = require('node-fetch');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

let cookie = "_ga=GA1.2.776965670.1551960160; _mkto_trk=id:031-GVQ-112&token:_mch-nutanix.com-1551960163300-17047; s_fid=3ED8B043413ABBF5-18106CF1C71CD457; _hly_vid=98a0528d-2023-453d-9b75-e64faaefabd3; OptanonAlertBoxClosed=2020-08-15T13:33:46.763Z; OptanonConsent=isIABGlobal=false&datestamp=Sat+Aug+15+2020+19%3A03%3A47+GMT%2B0530+(India+Standard+Time)&version=6.3.0&consentId=11dee8db-2404-4066-952e-2df9a3aae743&interactionCount=1&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1&hosts=&geolocation=IN%3BKA&AwaitingReconsent=false; mbox=PC#7b40ad76f58b476f8e1004ef47378dca.31_0#1646018378|session#5ded38030c12422dbf30b64601aa25a5#1597500289; adcloud={%22_les_v%22:%22y%2Cnutanix.com%2C1597500234%22}; ei_client_id=5f37e447de86300010d0fbf9; AMCV_21CB300E5B1536270A495D34%40AdobeOrg=359503849%7CMCIDTS%7C18555%7CMCMID%7C31935582576620302142909183624962209694%7CMCAAMLH-1603720211%7C12%7CMCAAMB-1603720211%7CRKhpRz8krg2tLO6pguXWp5olkAcUniQYPHaMWWgdJ3xzPWQmdj0y%7CMCOPTOUT-1603122611s%7CNONE%7CvVersion%7C5.0.1%7CMCAID%7CNONE; _gid=GA1.2.392609682.1614178777; _gat=1; X_NTNX_SESSION=eyJ1c2VybmFtZSI6ImNoYW5kYW4udGhha3VyQG51dGFuaXguY29tIiwiYXV0aGVudGljYXRlZCI6dHJ1ZSwiX3Blcm1hbmVudCI6dHJ1ZX0.ExlQ3Q.66cYF37PjsJWcEfiHK_FAHtkZM8";

let headers = {
    "accept": "application/json, text/javascript, */*; q=0.01",
    "accept-language": "en-US,en;q=0.9,fr;q=0.8",
    "content-type": "application/json",
    "sec-ch-ua": "\"Google Chrome\";v=\"87\", \" Not;A Brand\";v=\"99\", \"Chromium\";v=\"87\"",
    "sec-ch-ua-mobile": "?0",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    cookie: cookie
  };

let reqHeaders = {
    "headers": headers,
    "referrer": "https://insights.corp.nutanix.com/",
    "referrerPolicy": "strict-origin-when-cross-origin",
    "method": "POST",
    "mode": "cors"
};

let parseGroupResponse = function(resStr) {
    let res = JSON.parse(resStr);
    return res;
}

let getPercentiles = function(groupResponse) {
    let entries = groupResponse.group_results;
    
    let totalCount = 0;
    entries.forEach((e) => {
        totalCount = totalCount + e.total_entity_count;
        console.log(e);
    });

    let percentiles = [];
    let currCount = 0;
    entries.forEach((e) => {
        currCount = currCount + e.total_entity_count;
        let lo = e.group_by_column_value[0];
        let hi = e.group_by_column_value[1];
        hi = hi == '+' ? lo : hi;
        let val = (lo + hi)/2
        let percentile = Math.round(10*100*currCount/totalCount)/10;
        let item = { percentile: percentile, value: val, count: e.total_entity_count};
        let prevItem = percentiles.length > 0 ? percentiles[percentiles.length - 1] : null;
        if(!prevItem || prevItem.percentile != item.percentile) {
            percentiles.push(item);
        } else {
            prevItem.count = prevItem.count + e.total_entity_count;
            prevItem.value = (prevItem.value + val)/2;
        }
    });

   return percentiles;
}

let getRange = function(start, end, count) {
    return start + "," + end + "," + count; 
}

let outputStats = function(rows, fileName) {
    let csvRows = utils.getRowsInCsvFormat(rows);
    utils.log("Generating " + fileName);
    return utils.writeToFile(fileName, csvRows.join("\n"));
}

let vmMemoryQuery = {
    "entity_type": "vm",
    "grouping_attribute": "memory_reserved_bytes", 
    "range" : getRange(0,2*1024*1024*1024,250),
    "query_name": "prism:EBQueryModel",
    "filter_criteria": "timestamp=ge=1613642623;is_external_cluster==true"
};

let vmCpuQuery = {
    "entity_type": "vm",
    "grouping_attribute": "num_vcpus", 
    "range" : getRange(0,1,200),
    "query_name": "prism:EBQueryModel",
    "filter_criteria": "timestamp=ge=1613642623;is_external_cluster==true"
};

let loadUrlsMain = function() {
        let url = "https://insights.corp.nutanix.com/api/groups";
        let query = vmCpuQuery;
        let outputFileName = "pulse-data-" + query.entity_type  + "." + vmCpuQuery.grouping_attribute + ".gen.csv";
        reqHeaders.body = JSON.stringify(query);
        fetch(url, reqHeaders).then(response => {
            return response.text();
        }).then(data => {
            let groupResponse = parseGroupResponse(data);
            let o1 = outputStats(getPercentiles(groupResponse), outputFileName);
            return o1;
        }).then(function(){
            console.log("Done");
        }).catch(function(err){
            utils.log(err);
        });
}

   
let main = function() {
    loadUrlsMain();
    //getPercentiles(response);
}

main()
