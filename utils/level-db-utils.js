var level = require('level')
var db = level('http-cache')

db.put('foo', 'bar')
.then(function () { return db.get('foo') })
.then(function (value) { console.log(value) })
.catch(function (err) { console.error(err) })

