var utils = require('./utils/utils');

// users nodes
// https://jarvis.eng.nutanix.com/api/v2/pools/562f1d0a7e6e21292f14e729/user_details
// https://jarvis.eng.nutanix.com/api/v2/pools/562f1d0a7e6e21292f14e729/cluster_details

let baseUrl = "https://jarvis.eng.nutanix.com/api/";
let jarvisUrl = utils.fmt1("{0}/v1/clusters?limit=1000&search=acropolis", baseUrl);
let urls = [];
urls.push({ url: jarvisUrl, id: "cluster_usage_jarvis"});

let main = function() {
    let parr = [];
    urls.forEach(url => parr.push(utils.getNetworkResponseForUrl(url.url, {"rejectUnauthorized": false })));
    utils.log("Downloading...");
    Promise.all(parr).then(function(resArr){
        let p = [];
        resArr.forEach((res, i) => {
            let fileName = urls[i].id + "." + utils.getTS() + ".json";
            p.push(utils.writeToFile("./data/" + fileName, res));
        });

        return Promise.all(p);
    }).then(function(){
        utils.log("Done.All Good.");
    }).catch(function(err){
        utils.log(err);
    });
}

main()