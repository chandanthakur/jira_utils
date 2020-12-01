const networkUtils = require('./utils/network-utils');
var utils = require('./utils/utils');
let metaUrl = 'https://quality-pipeline/testdb/api/v1/all_test_cases?raw_query={"$and":[{"$or":[{"target_service":"AOS","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"NCC","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"PC","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"AFS","target_branch":"master","target_package_type":"qcow2","deleted":false},{"target_service":"AHV","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"AGS","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"IAM","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"CMS","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"SecretStore","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"DCM","target_branch":"master","target_package_type":"ctr","deleted":false},{"target_service":"LCM","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"MSP","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"Hermes","target_branch":"master","target_package_type":"ctr","deleted":false},{"target_service":"Foundation","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"WitnessVM","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"XiBilling","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"XiSupport","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"XiAcctMgmt","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"Karbon","target_branch":"master","target_package_type":"tar","deleted":false},{"target_service":"FoundationCentral","target_branch":"master","target_package_type":"tar","deleted":false}]},{"test_case.test_sets":{"$regex":"test_sets/milestones/master/ahv/","$options":"i"}},{"test_case.automated":true},{"test_case.deprecated":false}]}&limit=2500'

// anthorized ssl
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

let estimateComponent = function(testName, primaryComponent) {
    if(testName.startsWith("acropolis.ahv_management.xi_catalog")) return "Catalog";
    if(testName.startsWith("acropolis.ahv_ui.pc.cluster_selection.test_image")) return "Catalog";
    if(testName.startsWith("acropolis.ahv_ui.pc.test_pc_import_image")) return "Catalog";
    if(testName.startsWith("acropolis.ahv_ui.pc.test_pc_image")) return "Catalog";
    if(testName.startsWith("manageability.ui.pe.acropolis.test_image")) return "Catalog";
    if(testName.indexOf("test_xi_ui_images.XiImages") != -1) return "Catalog";
    if(testName.startsWith("acropolis.ahv_ui.pc.ova")) return "OVA";
    if(testName.startsWith("acropolis.ahv_management.ova_import_export")) return "OVA";
    if(testName.startsWith("acropolis.ahv_management.ha")) return "Scheduler";
    if(testName.startsWith("acropolis.ahv_management.xi_scheduler_hardened")) return "Scheduler";
    if(testName.startsWith("acropolis.ahv_management.ads")) return "Scheduler";
    if(testName.startsWith("acropolis.ahv_management.vnuma")) return "Scheduler";
    if(testName.startsWith("acropolis.ahv_management.scheduler")) return "Scheduler";
    if(testName.startsWith("acropolis.ahv_management.vgpu")) return "Vgpu";
    if(testName.startsWith("acropolis.ahv_ui.pc.test_vgpu")) return "Vgpu";
    if(testName.startsWith("acropolis.ahv_ui.pe.test_vgpu")) return "Vgpu";
    if(testName.startsWith("manageability.api.rbac")) return "Rbac";
    if(testName.startsWith("acropolis.ahv_ui.pc.test_snapshot_rbac")) return "Rbac";
    if(testName.startsWith("manageability.api.rbac.test_rbac")) return "Rbac";
    if(testName.startsWith("manageability.ui.xi.xi_rbac")) return "Rbac";
    if(testName.startsWith("acropolis.ahv_ui.pc.cat_based_rbac")) return "Rbac";
    if(testName.startsWith("acropolis.ahv_management.authz_cluster_scope")) return "Rbac";
    return primaryComponent;
}

let isUI = function(testName) {
    return testName.indexOf("ahv_ui") != -1 || testName.indexOf("manageability.ui") != -1 || testName.indexOf("uhura.ui") != -1;
}

let getResponse = function(response){
    let json = JSON.parse(response);
    let data = json.data;
    let op = [];
    for(let kk = 0; kk < data.length; kk++) {
        let row = data[kk];
        let meta = row.test_case.metadata;
        let isRegHanded = meta.tags.indexOf('REG_HANDEDOVER') != -1;
        op.push({
            name: row.name,
            priority: meta.priority,
            primaryComponent: meta.primary_component,
            estimatedComponent: estimateComponent(row.name, meta.primary_component),
            isRegHanded: isRegHanded,
            automated: row.test_case.automated,
            isUI: isUI(row.name)
        });
    }
    
    return op;
}

let getSummaryByComponent = function(data) {
    return utils.groupCountByColumns(data, ["estimatedComponent", "isRegHanded", "automated"]);
}

let outputStats = function(rows, fileName) {
    let csvRows = utils.getRowsInCsvFormat(rows);
    utils.log("Generating " + fileName);
    return utils.writeToFile(fileName, csvRows.join("\n"));
}

let main = function() {
    let p1 = networkUtils.getResponseForUrl(metaUrl, {age: 86400*7, "rejectUnauthorized": false });
    p1.then(function(result){
        return getResponse(result);
    }).then(function(response){
        let o1 = outputStats(response, "./config/ahv_functional_test_meta.gen.csv");
        let o2 = outputStats(getSummaryByComponent(response), "./config/ahv_functional_test_summary.gen.csv");
        return Promise.all([o1, o2]);
    }).then(function() {
        utils.log("Done.All Good.");
    }).catch(function(err){
        utils.log(err);
    });
}

main()