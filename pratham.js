var utils = require('./utils/utils');

let main = function() {
    let p = [];
    for(let kk = 1; kk <= 6; kk++) {
        let fileName = utils.fmt1("./pratham/fluence-1-theme-{0}.json", kk);
        p.push(utils.getJsonFromFilePromise(fileName));
    }

    let baseUrl = "https://storyweaver.org.in/v0/stories/download-story/{0}.pdf";
    Promise.all(p).then(function(resultList){
        let slugs = [];
        resultList.forEach((r) => {
              r.data.lessons.forEach(l => slugs.push(utils.fmt1(baseUrl, l.slug)));
        });

        return slugs; 
    }).then(function(slugs){
        slugs.forEach(s => console.log(s));
    }).catch(function(err){
        console.log(err);
    });
}

main()