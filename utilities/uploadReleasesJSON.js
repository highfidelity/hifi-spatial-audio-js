const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-west-2' });

let s3 = new AWS.S3({ apiVersion: '2006-03-01' });

const params = {
    Bucket: 'hifi-spatial-audio-api',
    Prefix: 'releases'
};
s3.listObjectsV2(params, (err, data) => {
    if (err) {
        console.error(`Error when listing objects:\n${err}`);
        process.exit();
        return;
    }

    let releaseVersions = [];
    for (data of data.Contents) {
        let releaseVersion = data.Key.split('/')[1];
        if (releaseVersion !== "latest" && releaseVersion !== "releases.json" && releaseVersion.length > 0) {
            let isMainVersion = releaseVersion === "main";

            let isRecentEnough = true;
            if (!isMainVersion) {
                let testString = releaseVersion.replace('v', '');
                let split = testString.split('.');
                let majorVersion = parseInt(split[0]);
                let minorVersion = parseInt(split[1]);
                let patchVersion = parseInt(split[2]);

                if (majorVersion === 0 && minorVersion < 4) {
                    isRecentEnough = false;
                }
            }
            
            let versionNotAlreadyPushed = false;
            if (!releaseVersions.find((version) => { return version.version === releaseVersion; })) {
                versionNotAlreadyPushed = true;
            }

            if ((isMainVersion || isRecentEnough) && versionNotAlreadyPushed) {
                releaseVersions.push({
                    version: releaseVersion,
                    lastModified: data.LastModified,
                    webJSZip: `${releaseVersion}/highfidelity-hifi-audio-web.zip`,
                    webJSAudio: `${releaseVersion}/HighFidelityAudio-latest.js`,
                    webJSControls: `${releaseVersion}/HighFidelityControls-latest.js`,
                    npm: `npm i hifi-spatial-audio@${releaseVersion.replace('v', '')}`
                });
            }
        }
    }
    const latestRelease = {};
    Object.assign(latestRelease, releaseVersions[releaseVersions.length - 1])
    latestRelease.webJSZip = `latest/highfidelity-hifi-audio-web.zip`;
    latestRelease.webJSAudio = `latest/HighFidelityAudio-latest.js`;
    latestRelease.webJSControls = `latest/HighFidelityControls-latest.js`;
    latestRelease.npm = `npm i hifi-spatial-audio`;

    const allReleaseInfo = {
        "releaseJSONVersion": "v1.0.0",
        "baseReleaseURL": "https://hifi-spatial-audio-api.s3.amazonaws.com/releases/",
        "latestRelease": latestRelease,
        "allReleases": releaseVersions
    };

    console.log(allReleaseInfo)

    let uploadParams = {
        Bucket: 'hifi-spatial-audio-api',
        Key: 'releases/releases.json',
        Body: JSON.stringify(allReleaseInfo, null, 4),
        ContentType: 'application/json',
        ACL: 'public-read'
    };

    s3.upload(uploadParams, (err, data) => {
        if (err) {
            console.error(`Error uploading Releases JSON to S3:\n${err}`);
            process.exit();
        } if (data) {
            console.log(`Successfully uploaded Releases JSON to S3!`);
        }
    });
});