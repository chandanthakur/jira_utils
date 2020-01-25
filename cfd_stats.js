var utils = require('./utils/utils');

// Constants
let xAxisDaysDiff = 10;
let xAxisDaysMax = 200;
let columnSep = "^";
let P0 = "Blocker - P0";
let P1 = "Critical - P1";
let P2 = "Major - P2";
let P3 = "Minor - P3";

// Todo: Pass as script argument 
let today = new Date();
let pivotToday = (today.getMonth() + 1) + "/" + today.getDate() + "/" + today.getFullYear();
console.log(pivotToday)
// Basic helper functions
let isOpen = function(status) {
    return status != "Closed" && status != "Resolved";
}
let isP0P1 = function(priority) {
    return priority == P0 || priority == P1;
}

let isP2P3 = function(priority) {
    return priority == P2 || priority == P3;
}

let isBug = function(type) {
    return type == "Bug";
}

let isImprovement = function(type) {
    return type == "Improvement";
}

// Find days between two dates
let daysBetween = function(d1, d2) {
    let diffTime = new Date(d2).getTime() - new Date(d1).getTime(); 
    var diffDays = diffTime / (1000 * 3600 * 24);
    return Math.floor(diffDays);
}

// Aggregate the stats across table rows
let aggregateX = function(tableRows) {
    let xValues = [];
    for(let ii = xAxisDaysDiff; ii <= xAxisDaysMax; ii = ii + xAxisDaysDiff) {
        xValues.push({key: ii, percentile: 0, success: 0, total: 0});
    }

    for(let kk = 1; kk < tableRows.length; kk++) {
        let row = tableRows[kk];
        for(let ii = 0; ii < row.x.length; ii++) {
            let x = row.x[ii];
            let xValue = xValues[ii];
            xValue.success = xValue.success + x.val;
            xValue.total = xValue.total + (x.isApplicable ? 1 : 0);
        }
    }

    for(let ii = 0; ii < xValues.length; ii++) {
        let xVal = xValues[ii];
        xVal.percentile = (xVal.total == 0) ? 100 :  Math.floor(xVal.success*100/xVal.total);
    }

    return xValues;
}

// Extend Bug Data with additional custom properties
let extendJiraProperties = function(bugData) {
    let created = bugData['Created'];
    let status = bugData['Status'];
    let resolved = bugData['Resolved'];
    bugData.issueId = bugData['Issue id'];
    bugData.created = created;
    bugData.issueType = bugData['Issue Type'];
    bugData.status = status;
    bugData.priority = bugData['Priority'];
    bugData.daysOpen = isOpen(status) ? daysBetween(created, pivotToday) : daysBetween(created, resolved);
    bugData.daysToResolve = isOpen(status) ? undefined : daysBetween(created, resolved);
    bugData.x = [];
    for(let ii = xAxisDaysDiff; ii <= xAxisDaysMax; ii = ii + xAxisDaysDiff) {
        let xval = ii;
        let isApplicable = isOpen(status) ? bugData.daysOpen >= xval: true;
        let value = isApplicable && bugData.daysToResolve <= xval ? 1 : 0;
        bugData.x.push({key: xval, x: xval, val: value, isApplicable: isApplicable});
    }
}

// Convert Jira exported CSV to in memory array
function getRowsFromJiraExportedFile(fileName) {
    var promise = utils.getTableRows(fileName, columnSep);
    var tableRows = [];
    return promise.then(function(result) {
        tableRows = result;
        tableRows.shift();
        tableRows.forEach(bugData => extendJiraProperties(bugData));
        return tableRows;
    });
}

// This function is required purely from debugging perspective to write the processed Jira properties to file
let flattenRows = function(rows) {
    let rawRows = [];
    rows.forEach(function(row){
        let data = {};
        data.issueType = row.issueType;
        data.issueId = row.issueId;
        data.created = row.created;
        data.status = row.status;
        data.priority = row.priority;
        row.x.forEach(function(xobj){
            data["x" + xobj.key] = xobj.isApplicable ? xobj.val: 'x';
        });

        rawRows.push(data);
    });

    return rawRows;
}

let outputStats = function(name, id, rows) {
    console.log("\n** " + name + " **");
    let aggregateCsvRows = utils.getRowsInCsvFormat(aggregateX(rows));
    utils.writeToFile(id + ".csv", aggregateCsvRows.join("\n")).then(function(res){});
    console.log(aggregateCsvRows);

    let csvRows = utils.getRowsInCsvFormat(flattenRows(rows));
    utils.writeToFile(id + ".raw.csv", csvRows.join("\n")).then(function(res){});
}

let main = function() {
    let jiraExportedFilePath = utils.getCmdArg("file");
    let todayArg = utils.getCmdArg("today");
    pivotToday = todayArg || pivotToday;
    getRowsFromJiraExportedFile(jiraExportedFilePath).then(function(tableRows){
        outputStats("CFD All", "cfd_all_stats", utils.filterArray(tableRows, (item) => isBug(item.issueType)));
        outputStats("CFD P0P1", "cfd_p0p1_stats", utils.filterArray(tableRows, (item) => isBug(item.issueType) && isP0P1(item.priority)));
        outputStats("CFD P2P3", "cfd_p2p3_stats", utils.filterArray(tableRows, (item) => isBug(item.issueType) && isP2P3(item.priority)));

        outputStats("CFI All", "cfi_all_stats", utils.filterArray(tableRows, (item) => isImprovement(item.issueType)));
        outputStats("CFI P0/P1", "cfi_p0p1_stats", utils.filterArray(tableRows, (item) => isP0P1(item.priority) && isImprovement(item.issueType)));
        outputStats("CFI P2/P3", "cfi_p2p3_stats", utils.filterArray(tableRows, (item) => isP2P3(item.priority) && isImprovement(item.issueType)));
    });
}

main()