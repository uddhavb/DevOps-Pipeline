var Random = require('random-js');
var fs = require('fs');
var sleep = require('sleep');

const execSync = require('child_process').execSync;


var getJavaFiles = function () {
    var javaFiles = [];
    var path = "/var/lib/jenkins/jobs/itrust2/workspace/iTrust2-v2/iTrust2/src/main/java/edu/ncsu/csc/itrust2";
    var temp = execSync(`ls ${path}/**/**/*.java && ls ${path}/**/*.java && ls ${path}/controllers/api/comm/**.java`);
    
    var javafiles = temp.toString().trim().split("\n");
    var num = fuzzer.random.integer(1,88);
    var files = [];

    for(var i=0; i < num ; i++ )
    {
        files[i] = javafiles[fuzzer.random.integer(0,i)];
    }
    
    console.log("files are: "+ files.toString());
    return files;
}

var fuzzer = {
    random : new Random(Random.engines.mt19937().autoSeed(0)),

    seed: function (kernel)
    {
        fuzzer.random = new Random(Random.engines.mt19937(),seed(kernel));
    },

    mutate: function (filePath)
    {
        // console.log("Mutating file: " + filePath);
        var file = fs.readFileSync(filePath,'utf-8');
        var lines = file.split('\n');
        var tempFilePath = filePath + 'test';

        if(fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        lines.forEach( function (line) {

            // Change the content of the string
            if(fuzzer.random.bool(0.8) && line.match('\"(\\"|[^\"])*\"') && !line.match("//") && !line.match("@") && !line.match("final") && !line.match("jdbc"))
                line = line.replace(/\"(\\"|[^\"])*\"/g, '"' + fuzzer.random.string(10) + '"')  

            //Replace '<' with '>' and '==' with '!=' and vice versa
            if( line.match("if"))
            {
                if( !line.match("null") ){
                    if(fuzzer.random.bool(0.8) && line.match("=="))
                        line = line.replace('==','!=');
                    if(fuzzer.random.bool(0.8) && line.match("!="))
                        line = line.replace('!=','==');
                }
                if(fuzzer.random.bool(0.8) && line.match("<"))
                    line = line.replace('<','>');
                if(fuzzer.random.bool(0.8) && line.match(">"))
                    line = line.replace('>','<');
            }
            if( !line.match("case") ) {
                // Replace 0 with 1
                if(fuzzer.random.bool(0.8) && line.match('"((\\"|[^"])+0(\\"|[^"])*|(\\"|[^"])*0(\\"|[^"])+)"'))
                    line = line.replace('0','1');

                // Replace 1 with 0
                if(fuzzer.random.bool(0.8) && line.match('"((\\"|[^"])+1(\\"|[^"])*|(\\"|[^"])*1(\\"|[^"])+)"'))
                    line = line.replace('1','0');
            }
            fs.appendFileSync(tempFilePath, line + '\n');
        });

        fs.renameSync(tempFilePath, filePath);
    }
}

function commitChanges(number)
{
    console.log("#######################commit changes started#################################")

    execSync("cd /var/lib/jenkins/jobs/itrust2/workspace/iTrust2-v2 && git add .");
    execSync('cd /var/lib/jenkins/jobs/itrust2/workspace/iTrust2-v2 && git commit -m "Fuzzer commit on ' + 'Build number: ' + number + '"');
    execSync("cd /var/lib/jenkins/jobs/itrust2/workspace/iTrust2-v2 && git reset --hard origin/master");

    console.log("#######################commit changes ended#################################")
}

function getSHA(param)
{
    return execSync("cd /var/lib/jenkins/jobs/itrust2/workspace/iTrust2-v2 && git rev-parse "+param).toString().trim();
}

var fuzz = function (iterations)
{
    var javaFiles = getJavaFiles();
    var fuzzSHA = getSHA('fuzzer');

    execSync("cd /var/lib/jenkins/jobs/itrust2/workspace/iTrust2-v2 && git checkout fuzzer");
    // console.log("branched checkout");
    var i = 1;
    while( i <= iterations)
    {
        console.log("Build Number: "+i);

        execSync(`cd /var/lib/jenkins/jobs/itrust2/workspace/iTrust2-v2/iTrust2 && git checkout ${fuzzSHA}`);
        // console.log("reverting");
        javaFiles.forEach(function (file){
            fuzzer.mutate(file);

        });
	sleep.sleep(200);
        // Commit the changes
        commitChanges(i);
        i++;
    }
    execSync(`cd /var/lib/jenkins/jobs/itrust2/workspace/iTrust2-v2/iTrust2 && git checkout ${fuzzSHA}`);
}

fuzz(1)
