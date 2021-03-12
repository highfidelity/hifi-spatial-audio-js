const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-west-2' });

let s3 = new AWS.S3({ apiVersion: '2006-03-01' });

const params = {
    Bucket: 'hifi-spatial-audio-api',
    Prefix: 'releases'
};
s3.listObjectsV2(params, (err, data) => {
    if (err) {
        console.error(`Error when listing objects:\n${error}`);
        return;
    }

    let releaseVersions = [];
    for (data of data.Contents) {
        let releaseVersion = data.Key.split('/')[1];
        if (releaseVersion !== "latest" &&
            releaseVersion !== "main" &&
            releaseVersion.length > 0 &&
            !releaseVersions.find((version) => { return version.version === releaseVersion; })) {
            releaseVersions.push({
                version: releaseVersion,
                lastModified: data.LastModified,
                webJSZip: `https://hifi-spatial-audio-api.s3.amazonaws.com/releases/${releaseVersion}/highfidelity-hifi-audio-web.zip`,
                webJSAudio: `https://hifi-spatial-audio-api.s3.amazonaws.com/releases/${releaseVersion}/HighFidelityAudio-latest.js`,
                webJSControls: `https://hifi-spatial-audio-api.s3.amazonaws.com/releases/${releaseVersion}/HighFidelityControls-latest.js`,
                npm: `npm i hifi-spatial-audio@${releaseVersion.replace('v', '')}`
            });
        }
    }
    const latestRelease = {};
    Object.assign(latestRelease, releaseVersions[releaseVersions.length - 1])
    latestRelease.webJSZip = `https://hifi-spatial-audio-api.s3.amazonaws.com/releases/latest/highfidelity-hifi-audio-web.zip`;
    latestRelease.webJSAudio = `https://hifi-spatial-audio-api.s3.amazonaws.com/releases/latest/HighFidelityAudio-latest.js`;
    latestRelease.webJSControls = `https://hifi-spatial-audio-api.s3.amazonaws.com/releases/latest/HighFidelityControls-latest.js`;
    latestRelease.npm = `npm i hifi-spatial-audio`;
    
    const allReleaseInfo = {
        "latestRelease": latestRelease,
        "allReleases": releaseVersions
    };

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