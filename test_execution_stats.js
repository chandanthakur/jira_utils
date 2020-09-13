var utils = require('./utils/utils');
let columnSep = ",";

// Convert Jita exported CSV to in memory array
function getRowsFromJiraExportedFile(fileName) {
    var promise = utils.getTableRows(fileName, columnSep);
    var tableRows = [];
    return promise.then(function(result) {
        tableRows = result;
        tableRows.shift();
        return tableRows;
    });
}

let flattenRows = function(rows) {
    let rawRows = [];
    rows.forEach(function(row){
        let data = {};
        data.TestName = row.key;
        data.success = row.value.success;
        data.failure = row.value.failure;
        data.success_percent = row.value.success_percent;
        rawRows.push(data);
    });

    return rawRows;
}

let outputStats = function(rows) {
    let csvRows = utils.getRowsInCsvFormat(flattenRows(rows));
    utils.writeToFile("test.output.csv", csvRows.join("\n")).then(function(res){});
}

let main = function() {
    let jiraExportedFilePath = utils.getCmdArg("file");
         getRowsFromJiraExportedFile(jiraExportedFilePath).then(function(tableRows) {
            let groupedMap = {};
            tableRows.forEach(function(row){
                let TestName = row["TestName"];
                groupedMap[TestName] = groupedMap[TestName] || { success: 0, failure: 0 };
                let value = groupedMap[TestName];
                let isSuccess = row.Status == "Succeeded"; 
                value.success = isSuccess ? value.success + 1 : value.success;
                value.failure = !isSuccess ? value.failure + 1 : value.failure;
                value.success_percent = 100*value.success/(value.success + value.failure);
            });

            let groupedRows = utils.getListFromMap(groupedMap);
            groupedRows = groupedRows.sort((a,b) => a.value.success_percent - b.value.success_percent);
            groupedRows.forEach(function(row){
                console.log(row);
            });
           
            outputStats(groupedRows);
          });
}

main()