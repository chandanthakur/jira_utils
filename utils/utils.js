var fs = require('fs');
var os = require('os');
var readline = require('readline');
var colors = require('colors/safe');
var parseArgs = require('minimist')
var es = require('event-stream');
var utf8 = require('to-utf-8')
var path = require('path');


class AggregateSum {
    constructor() {
        this.arr = [];
        this.result = 0;
    }

    next(val) {
        if(isNaN(val)) return;
        this.result = this.result + val;
    }

    value() {
        return this.result;
    }
}

class AggregateCount {
    constructor() {
        this.arr = [];
        this.result = 0;
    }

    next(val) {
        this.result = this.result + 1;
    }

    value() {
        return this.result;
    }
}

class AggregateAvg {
    constructor() {
        this.arr = [];
        this.result = 0;
        this.count = 0;
    }

    next(val) {
        if(isNaN(val)) return;
        this.result = this.result + val;
        this.count = this.count + 1;
    }

    value() {
        return Math.floor(100*this.result/this.count)/100;
    }
}

let getAggregateObject = function(id) {
    if(id == "sum") return new AggregateSum();
    if(id == "avg") return new AggregateAvg();
    if(id == "count") return new AggregateCount();
    return new AggregateCount(); // default
}

utils = module.exports = {
    fileReadLineByLine: function (fileName, onLineRead, onFileClose) {
        var lineReader = readline.createInterface({
            input: fs.createReadStream(fileName)
        });

        lineReader.on('line', onLineRead);
        lineReader.on('close', onFileClose);
    },

    getFileLines: function (fileName) {
        var promise = new Promise(function (resolve, reject) {
            if (!fileName) {
                reject("Can't handle null file name");
                return;
            }

            var rowList = [];
            utils.getFileLinesV2(fileName, function (line) {
                rowList.push(line);
            }, function () {
                resolve(rowList)
            });
        });

        return promise;
    },

    getFileLinesV2: function (fileName) {
        var promise = new Promise(function (resolve, reject) {
            if (!fileName) {
                reject("Can't handle null file name");
                return;
            }


            var rowList = [];
            var s = fs.createReadStream(fileName)
            .pipe(utf8())
            .pipe(es.split())
            .pipe(es.mapSync(function(line){
                let index = line.indexOf('\r');
                rowList.push(line);
            })
            .on('error', function(err){
                reject(err);
            })
            .on('end', function(){
                resolve(rowList)
            }));
        });

        return promise;
    },

    getJsonFromFile: function (fileName, callBack) {
        fs.readFile(fileName, 'utf8', function (err, data) {
            if (err) {
                console.log(err);
                callBack(null);
                return null;
            }

            var result = null;
            try {
                result = JSON.parse(data)
            } catch (ex) {
                console.log(ex);
            }

            callBack(result);
        });
    },

    getJsonFromFilePromise: function (fileName) {
        var promise = new Promise(function (resolve, reject) {
            if (!fileName) {
                reject("Can't handle null file name");
                return;
            }

            fs.readFile(fileName, 'utf8', function (err, data) {
                if (err) {
                    reject(err);
                    return;
                }

                var result = null;
                try {
                    result = JSON.parse(data)
                    resolve(result);
                } catch (ex) {
                    reject(ex);
                }
            });
        });

        return promise;
    },

    readFile: function (fileName) {
        var promise = new Promise(function (resolve, reject) {
            if (!fileName) {
                reject("Can't handle null file name");
                return;
            }

            fs.readFile(fileName, 'utf8', function (err, data) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(data);
            });
        });

        return promise;
    },

    getFilesFromDir: function (dirPath, prefix, suffix) {
        var promise = new Promise(function (resolve, reject) {
            if (!dirPath) {
                reject("Can't handle null dir path");
                return;
            }

            const testFolder = './data/';
            const fs = require('fs');
        
            fs.readdir(testFolder, (err, files) => {
                if (err) {
                    reject(err);
                    return;
                }

                let list = [];
                files.forEach(function(file) {
                    if((!prefix || file.startsWith(prefix)) && (!suffix || file.endsWith(suffix))) {
                        list.push(dirPath + "/" + file);
                    }
                });                
                
                resolve(list);
            });
        });

        return promise;
    },

    getTableRows: function (csvFileName, seperator) {
        let sep = seperator || ",";
        console.log(utils.getTS() + ":LOADING csv: " + csvFileName);
        return utils.getFileLinesV2(csvFileName).then(function (lines) {
            var rowList = [];
            var rowIndex = 0;
            var colNames = [];
            lines.forEach(function (line) {
                if (!line) return;
                var tokens = utils.splitBy(line, sep);
                var rowData = {};
                if (rowIndex == 0) {
                    // header
                    for (var kk = 0; kk < tokens.length; kk++) {
                        colNames[kk] = tokens[kk];
                    }
                } else {
                    for (var kk = 0; kk < tokens.length; kk++) {
                        rowData[colNames[kk]] = rowData[colNames[kk]] ? rowData[colNames[kk]] + "," + tokens[kk] : tokens[kk];
                    }
                }

                rowIndex++;
                rowList.push(rowData);
            })

            console.log(utils.getTS() + ":LOADED csv: " + csvFileName);
            return rowList;
        });
    },

    getTableRowsV2: function (csvFileName, seperator) {
        let sep = seperator || ",";
        var promise = new Promise(function (resolve, reject) {
            if (!csvFileName) {
                reject("Can't handle null file name");
                return;
            }

            var rowList = [];
            var rowIndex = 0;
            var colNames = [];
            utils.log("Loading:" + csvFileName);
            let startTime = utils.getTS();
            utils.getFileLinesV2(csvFileName).then(function (lineList) {
                utils.log("Loaded: " + csvFileName + ":" + (utils.getTS() - startTime) + " ms");
                for (var mm = 0; mm < lineList.length; mm++) {
                    var line = lineList[mm];
                    if (!line) continue;
                    //var tokens = line.split(",");
                    var tokens = utils.splitBy(line, sep);
                    var rowData = {};
                    if (rowIndex == 0) {
                        // header
                        for (var kk = 0; kk < tokens.length; kk++) {
                            colNames[kk] = tokens[kk];
                        }
                    } else {
                        for (var kk = 0; kk < tokens.length; kk++) {
                            rowData[colNames[kk]] = tokens[kk];
                        }
                    }

                    if (mm % 100000 == 0 && mm > 0) {
                        //console.log("Processed: " + mm + " lines");
                    }

                    rowIndex++;
                    rowList.push(rowData);
                }

                //console.log(utils.getTS() + ":Processed: " + csvFileName + ":" + (utils.getTS() - startTime) + " ms");
                resolve(rowList);
            }, function () {
                resolve(null)
            });
        });

        return promise;
    },

    splitBy: function (value, sep) {
        var tokens = [];
        var startIdx = 0;
        var insideBlock = false;
        if(value.indexOf('"') == -1) {
            return value.split(sep);
        }

        for (var kk = 0; kk < value.length; kk++) {
            var ch = value[kk];
            if (ch == '"' && insideBlock == false) {
                insideBlock = true;
            } else if (ch == '"' && insideBlock == true) {
                insideBlock = false;
            }

            if (!insideBlock && ch == sep) {
                var token = value.substring(startIdx, kk);
                tokens.push(token);
                startIdx = kk + 1;
            } else if(!insideBlock && (kk == value.length - 1)){
                var token = value.substring(startIdx, kk + 1);
                tokens.push(token);
                startIdx = kk + 1;
            }
        }

        return tokens;
    },

    groupByColumn: function (tableRows, groupKey, sortKey) {
        var groupKeyHash = {};
        for (var kk = 0; tableRows && kk < tableRows.length; kk++) {
            var row = tableRows[kk];
            var groupKeyValue = row[groupKey];
            if (!groupKeyHash[groupKeyValue]) {
                groupKeyHash[groupKeyValue] = [];
            }

            groupKeyHash[groupKeyValue].push(row);
        }

        var groupRows = [];
        var keySet = Object.keys(groupKeyHash);
        for (var kk = 0; keySet && kk < keySet.length; kk++) {
            var resultList = groupKeyHash[keySet[kk]];
            if (sortKey) {
                //resultList = resultList.sort();
            }

            groupRows.push(resultList);
        }

        return groupRows;
    },

    groupCountByColumn: function (tableRows, groupKey, sortKey) {
        var groupKeyHash = {};
        for (var kk = 0; tableRows && kk < tableRows.length; kk++) {
            var row = tableRows[kk];
            var groupKeyValue = typeof groupKey === "function"? groupKey(row): row[groupKey];
            if (!groupKeyHash[groupKeyValue]) {
                groupKeyHash[groupKeyValue] = [];
            }

            groupKeyHash[groupKeyValue].push(row);
        }

        let countMap = {};
        Object.keys(groupKeyHash).forEach(r => {
            countMap[r] = groupKeyHash[r].length;
        });

        return countMap;
    },

    groupCountByColumns: function (rows, groupKeys) {
        var groupKeyHash = {};
        for (let kk = 0; rows && kk < rows.length; kk++) {
            let row = rows[kk];
            let groupValues = [];
            groupKeys.forEach(key => groupValues.push(row[key]));
            let groupKeyValue = groupValues.join("_");
            if(!groupKeyHash[groupKeyValue]) {
                groupKeyHash[groupKeyValue] = { rows: [] };
                groupKeys.forEach(key => groupKeyHash[groupKeyValue][key] = row[key]);
                groupKeyHash[groupKeyValue].count = 0; //here for ordering reasons
            }

            groupKeyHash[groupKeyValue].rows.push(row);
            groupKeyHash[groupKeyValue].count = groupKeyHash[groupKeyValue].rows.length;
        }

        let result = [];
        Object.keys(groupKeyHash).forEach(r => {
            delete groupKeyHash[r].rows;
            result.push(groupKeyHash[r]);
        });

        result = result.sort((a,b) => b.count - a.count);
        return result;
    },

    groupItemsByColumns: function (rows, groupKeys) {
        var groupKeyHash = {};
        for (let kk = 0; rows && kk < rows.length; kk++) {
            let row = rows[kk];
            let groupValues = [];
            groupKeys.forEach(key => groupValues.push(row[key]));
            let groupKeyValue = groupValues.join("_");
            if(!groupKeyHash[groupKeyValue]) {
                groupKeyHash[groupKeyValue] = { items: [] };
                groupKeys.forEach(key => groupKeyHash[groupKeyValue][key] = row[key]);
                groupKeyHash[groupKeyValue].count = 0; //here for ordering reasons
            }

            groupKeyHash[groupKeyValue].items.push(row);
        }

        let result = [];
        Object.keys(groupKeyHash).forEach(r => {
            result.push(groupKeyHash[r]);
        });

        result = result.sort((a,b) => b.items.length - a.items.length);
        return result;
    },

    agregateByColumns: function (rows, groupKeys, agregateKeys) {
        var groupKeyHash = {};
        for (let kk = 0; rows && kk < rows.length; kk++) {
            let row = rows[kk];
            let groupValues = [];
            groupKeys.forEach(key => groupValues.push(row[key]));
            let groupKeyValue = groupValues.join("_");
            if(!groupKeyHash[groupKeyValue]) {
                let aggregate = {};
                groupKeyHash[groupKeyValue] = { aggregate: aggregate };
                agregateKeys.forEach(entry => aggregate[entry[1]] = getAggregateObject(entry[0])); 
                groupKeys.forEach(key => groupKeyHash[groupKeyValue][key] = row[key]);
            }

            agregateKeys.forEach(entry => {
                groupKeyHash[groupKeyValue].aggregate[entry[1]].next(row[entry[1]])
            });
        }
        
        let result = [];
        Object.keys(groupKeyHash).forEach(r => {
            Object.keys(groupKeyHash[r].aggregate).forEach(key => {
                groupKeyHash[r][key] = groupKeyHash[r].aggregate[key].value();
            });

            delete groupKeyHash[r].aggregate;
            result.push(groupKeyHash[r]);
        });

        return result;
    },

    getHashForGroupedRows: function (groupedRowList, groupKey, groupKeyHash) {
        groupKeyHash = groupKeyHash || {};
        for (var kk = 0; groupedRowList && kk < groupedRowList.length; kk++) {
            var innerRows = groupedRowList[kk];
            for (var mm = 0; innerRows && mm < innerRows.length; mm++) {
                var innerRow = innerRows[mm];
                var keyValue = innerRow[groupKey];
                if (!groupKeyHash[keyValue]) {
                    groupKeyHash[keyValue] = [];
                }

                groupKeyHash[keyValue].push(innerRow);
            }
        }

        return groupKeyHash;
    },

    convertHashToList: function (hashMap) {
        var list = [];
        var keySet = Object.keys(hashMap);
        for (var kk = 0; keySet && kk < keySet.length; kk++) {
            var hashElement = hashMap[keySet[kk]];
            list.push(hashElement);
        }

        return list;
    },

    mergeGroupedRows: function (groupsToMergeList, groupKey, sortKey) {
        var groupKeyHash = {};
        for (var kk = 0; kk < groupsToMergeList.length; kk++) {
            groupKeyHash = utils.getHashForGroupedRows(groupsToMergeList[kk], groupKey, groupKeyHash);
        }

        return utils.convertHashToList(groupKeyHash)
    },

    getColShortName: function (colName) {
        if (!colName) {
            return "NA";
        }

        var tokens = colName.split('_');
        var shortName = "";
        for (var kk = 0; kk < tokens.length; kk++) {
            var token = tokens[kk];
            if (token.length > 0) {
                shortName = shortName + token[0]
            }
        }

        if (shortName.length > 1) {
            return shortName;
        } else {
            return colName[0];
        }
    },

    printRowNice: function (row, columnNames) {
        var keys = columnNames || Object.keys(row);
        var printStr = "";
        for (var kk = 0; kk < keys.length; kk++) {
            var colName = keys[kk];
            if (row[colName]) {
                printStr = printStr + utils.getColShortName(colName) + ": " + row[colName] + ", ";
            }
        }

        console.log(printStr);
    },

    percentileAndPrint: function (durationList, durationUnit, granularity) {
        durationUnit = durationUnit || "ms";
        durationList.sort(function (a, b) { return a - b })
        for (var kk = 0; kk < durationList.length; kk++) {
        }

        var maxLength = durationList.length;
        var granularity = granularity || 10;
        console.log("Total entries:" + durationList.length);
        var chunkPerGranularity = Math.floor(maxLength / granularity);
        for (var kk = chunkPerGranularity; kk < maxLength - chunkPerGranularity; kk += chunkPerGranularity) {
            var percentile = Math.round(100 * kk / maxLength);
            if (!durationList[kk]) {
                console.log("Percentile:(" + percentile + "): " + kk);
            }

            console.log("Percentile:(" + percentile + "): " + durationList[kk] + " " + durationUnit);
        }
    },

    getPercentiles: function (values) {
        values.sort(function (a, b) { return a - b });
        let l = values.length;
        let l50 = Math.floor(l*5/10);
        let l80 = Math.floor(l*8/10);
        let l90 = Math.floor(l*9/10);
        return {
            p50: values[l50],
            p80: values[l80],
            p90: values[l90]
        };
    },

    consoleHighlightText: function (text, prominentTextList, warnTextList, hlColor) {
        if (!text || !prominentTextList) return;
        let prominentTextIndices = [];
        let index = -1;
        // we want to match the longest one first
        prominentTextList.sort(function (a, b) {
            return b.length - a.length;
        });

        for (let kk = 0; kk < prominentTextList.length; kk++) {
            var prominentText = prominentTextList[kk];
            if (!prominentText) continue;
            let index = text.toLowerCase().indexOf(prominentText.toLowerCase());
            while (index != -1) {
                prominentTextIndices.push({ text: prominentText, index: index });
                index = text.toLowerCase().indexOf(prominentText, index + prominentText.length);
            }
        }

        prominentTextIndices.sort(function (a, b) {
            return a.index - b.index;
        });

        let prevProminentTextEndPos = 0;
        for (let kk = 0; kk < prominentTextIndices.length; kk++) {
            let indexMeta = prominentTextIndices[kk];
            let index = indexMeta.index;
            let prominentText = indexMeta.text;
            if (index < prevProminentTextEndPos) continue;
            let nonProminentText = text.substring(prevProminentTextEndPos, index);
            if (nonProminentText) {
                process.stdout.write(nonProminentText)
            }

            if (warnTextList && warnTextList.indexOf(prominentText) != -1) {
                process.stdout.write(colors.bold(colors.red(prominentText)));
            } else {
                utils.logProminent(prominentText, hlColor)
             }

            prevProminentTextEndPos = index + prominentText.length;
        }

        if (prevProminentTextEndPos < text.length) {
            let nonProminentText = text.substring(prevProminentTextEndPos);
            if (nonProminentText) {
                process.stdout.write(nonProminentText)
            }
        }

        console.log("");
    },

    // blue, green, magenta, cyan
    logProminent: function(text, hlColor) {
        if(hlColor == "blue") {
            process.stdout.write(colors.bold(colors.blue(text)));
        } else if (hlColor == "green"){
            process.stdout.write(colors.bold(colors.green(text)));
        } else if (hlColor == "red"){
            process.stdout.write(colors.bold(colors.red(text)));
        } else if (hlColor == "magenta"){
            process.stdout.write(colors.bold(colors.magenta(text)));
        } else if (hlColor == "cyan"){
            process.stdout.write(colors.bold(colors.cyan(text)));
        } else {
            process.stdout.write(colors.bold(colors.blue(text)));
        }
    },

    getListFromMap: function (map) {
        var keyList = Object.keys(map);
        var resultList = [];
        for (var kk = 0; kk < keyList.length; kk++) {
            var key = keyList[kk];
            var mapItem = map[key];
            resultList.push({ key: key, value: mapItem })
        }

        return resultList;
    },

    getValuesFromMap: function (map) {
        var keyList = Object.keys(map);
        var resultList = [];
        for (var kk = 0; kk < keyList.length; kk++) {
            var key = keyList[kk];
            var mapItem = map[key];
            resultList.push(mapItem)
        }

        return resultList;
    },

    formatDate: function (date, format) {
        return moment(date).format(format);
    },

    getDateTs: function(date) {
        return Date.parse(date);
    },

    writeToFile: function (filePath, content) {
        var promise = new Promise(function (resolve, reject) {
            fs.writeFile(filePath, content, function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(filePath);
            });
        });

        return promise;
    },

    getTmpDir: function () {
        return os.homedir() + "/tmp"
    },

    unzipFile: function (inPath) {
        var outputPath = inPath.replace(".zip", "");
        var promise = new Promise(function (resolve, reject) {
            let stream = fs.createReadStream(inPath).pipe(unzip2.Extract({ path: outputPath }));
            stream.on('close', function () {
                resolve(outputPath);
            });

            stream.on('error', function (err) {
                reject(err);
            });
        });

        return promise;
    },

    fileExists: function (filepath) {
        return new Promise((resolve, reject) => {
            fs.exists(filepath, function (exists) {
                resolve(exists);
            });
        });
    },

    replaceAll: function (str, find, replace) {
        if (!str) return str;
        return str.replace(new RegExp(find, 'g'), replace);
    },

    getCmdArg: function (name, defaultValue) {
        var argv = parseArgs(process.argv.slice(2));
        var value = defaultValue;
        if (argv[name]) {
            value = argv[name];
        }

        return value;
    },

    filterArray: function(arr, filterFunc) {
        let filteredArr = [];
        arr.forEach(function(item){
            if(filterFunc(item)) filteredArr.push(item);
        })
    
        return filteredArr;
    },
    
    getRowsInCsvFormat: function(rowList) {
        let result = [];
        if(!rowList || rowList.length < 1) return result;
        let row0 = rowList[0];
        var columnNames = Object.keys(row0);
        if(!columnNames || columnNames.length < 1) return result;
        result.push(columnNames.join(","));
        for(let kk = 0; kk < rowList.length; kk++) {
            let row = rowList[kk];
            let values = [];
            for(let mm = 0; mm < columnNames.length; mm++) {
                values.push(row[columnNames[mm]]);
            }

            result.push(values.join(","))
        }

        return result;
    },

    groupListOnKey: function(rowList, keyName) {
        var resultMap = {};
        for(var kk = 0; rowList && kk < rowList.length; kk++) {
            var rowData = rowList[kk];
            var keyValue = rowData[keyName];
            if(!resultMap[keyValue]) {
                resultMap[keyValue] = [];
            }

            resultMap[keyValue].push(rowData);
        }

        return resultMap;
    },

    groupListOnKeys: function(rowList, keyList) {
        var resultMap = {};
        for(var kk = 0; rowList && kk < rowList.length; kk++) {
            var rowData = rowList[kk];
            var keyValueList = [];
            for (var pp = 0; keyList && pp < keyList.length; pp++) {
                let key = keyList[pp];
                keyValueList.push(rowData[key]);
            }

            let keyValue = keyValueList.join(",");
            if(!resultMap[keyValue]) {
                resultMap[keyValue] = [];
            }

            resultMap[keyValue].push(rowData);
        }

        return resultMap;
    },

    aggregateGroupedList: function (groupedMapList, aggregateKeys, nonAggregateKeys) {
        nonAggregateKeys = nonAggregateKeys || [];
        let items = Object.keys(groupedMapList);
        let groupResult = {};
        for (let kk = 0; items && kk < items.length; kk++) {
            let itemKey = items[kk];
            let itemKeyTokens = itemKey.split(",");
            let groupList = groupedMapList[itemKey]
            let aggregateMap = {};
            let firstObject = groupList && groupList.length > 0 ? groupList[0] : null;
            for (let mm = 0; firstObject && nonAggregateKeys && mm < nonAggregateKeys.length; mm++) {
                let key = nonAggregateKeys[mm];
                aggregateMap[key] = firstObject[key];
            }

            for (let mm = 0; aggregateKeys && mm < aggregateKeys.length; mm++) {
                let key = aggregateKeys[mm];
                aggregateMap[key] = 0;
            }

            for(let pp = 0; pp < groupList.length; pp++) {
                let itemObject = groupList[pp];
                for (let mm = 0; aggregateKeys && mm < aggregateKeys.length; mm++) {
                    let key = aggregateKeys[mm];
                    let value = itemObject[key] || 0;
                    aggregateMap[key] = aggregateMap[key] + parseInt(value);
                }
            }

            groupResult[itemKey] = aggregateMap;
        }

        return groupResult;
    },

    getMapFromListOnKey: function(listItems, key) {
        var resultMap = {};
        for(var kk = 0; listItems && kk < listItems.length; kk++) {
            var listItem = listItems[kk];
            var listItemValue = listItem[key];
            resultMap[listItemValue] = listItem;
        }

        return resultMap;
    },

    displayInCSV: function(rowList) {
        let csvRows = utils.getRowsInCsvFormat(rowList);
        for(let kk = 0; kk < csvRows.length; kk++) {
            console.log(csvRows[kk]);
        }
    },

    delayPromise: function(duration) {
        return function(){
            return new Promise(function(resolve, reject){
                setTimeout(function(){
                    resolve();
                }, duration)
            });
        };
    },

    strcmp: function(a, b) {
        if(a == b) return 0;
        if(a < b) return -1;
        return 1;
    },

    isValidJSON: function(value){
        try {
            JSON.parse(value);
            return true
        } catch {
            return false;
        }
    },

    getTS: function() {
        return new Date().getTime();
    },

    getISOTS: function() {
        return new Date().toISOString();
    },

    getLogTS: function() {
        return utils.formatDate(new Date(), 'DD-MM-YYYY HH:mm:ss');
    },

    getFilesInDirWithExt: function(dirPath, ext){
        var promise = new Promise(function (resolve, reject) {
            fs.readdir(dirPath, function (err, files) {
                if (err) {
                    reject(err);
                    return;
                }
    
                let fileList = [];
                for (var index in files) {
                    let fileName = files[index];
                    let filePath = dirPath + fileName;
                    let fileExt = path.extname(filePath);
                    if(fileExt == ext) {
                        fileList.push(filePath)
                    }
                }
    
                resolve(fileList);
            });
        });
    
        return promise;
    },

    parseJson: function (value) {
        try {
            var jsonObject = JSON.parse(value);
            return jsonObject;
        } catch (ex) {
            return null;
        }
    },

    strip: function(value) {
        return value.replace(/^\s+|\s+$/g, '');
    },

    fmt1: function(text, v1) {
        return text.replace("{0}", v1);
    },

    fmt2: function(text, v1, v2) {
        text = text.replace("{0}", v1);
        text = text.replace("{1}", v2);
        return text;
    },

    fmt3: function(text, v1, v2, v3) {
        text = text.replace("{2}", v3);
        return utils.fmt2(text, v1, v2);
    },

    log: function(text){
        console.log("[" + utils.getISOTS() + "]: " + text);
    },

    hashCode: function(s) {
        return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);              
    }
}
