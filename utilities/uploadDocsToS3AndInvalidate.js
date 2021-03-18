const fs = require('fs');
const { readdir } = require('fs').promises;
const path = require('path');
const VERSION = process.env.npm_package_version;

const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-west-2' });

let s3 = new AWS.S3({ apiVersion: '2006-03-01' });

async function* getPathsRelativesToDocsFolder(dir) {
    const dirents = await readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* getPathsRelativesToDocsFolder(res);
        } else {
            yield path.relative(path.join(__dirname, "../docs"), res);
        }
    }
}

async function uploadCurrentVersionDocs() {
    return new Promise((resolve, reject) => {
        console.log(`Uploading HiFi Spatial Audio API Docs version \`v${VERSION}\` to S3...`);

        (async () => {
            let docsFilenamesRelativeToDocsFolder = [];

            for await (const f of getPathsRelativesToDocsFolder('./docs')) {
                docsFilenamesRelativeToDocsFolder.push(f);
            }

            let folderInfo = [
                {
                    "name": `js/v${VERSION}`,
                    "numFilesUploaded": 0
                }, {
                    "name": `js/latest`,
                    "numFilesUploaded": 0
                }
            ];

            for (const filename of docsFilenamesRelativeToDocsFolder) {
                for (const currentFolderInfo of folderInfo) {
                    let uploadParams = { Bucket: 'hifi-spatial-audio-api-docs', Key: '', Body: '', ACL: 'public-read' };
    
                    let extension = path.extname(filename);
                    if (extension === ".html") {
                        uploadParams["ContentType"] = 'text/html';
                    } else if (extension === ".js") {
                        uploadParams["ContentType"] = 'text/javascript';
                    } else if (extension === ".css") {
                        uploadParams["ContentType"] = 'text/css';
                    }
    
    
                    let fileStream = fs.createReadStream(path.join(`./docs`, filename));
                    fileStream.on('error', (err) => {
                        console.error(`File Error:\n${err}`);
                        process.exit();
                        return reject(err);
                    });
                    uploadParams.Body = fileStream;

                    let key = path.join(currentFolderInfo.name, filename);
                    key = key.replace(/\\/g, '/');
                    uploadParams.Key = key;

                    s3.upload(uploadParams, (err, data) => {
                        if (err) {
                            console.log(`Error uploading file to S3:\n${err}`);
                            process.exit();
                            return reject(err);
                        } if (data) {
                            currentFolderInfo.numFilesUploaded++;
                            console.log(`(${currentFolderInfo.numFilesUploaded}/${docsFilenamesRelativeToDocsFolder.length}) Uploaded ${key} to \`/${currentFolderInfo.name}/\`...`);

                            if (currentFolderInfo.numFilesUploaded === docsFilenamesRelativeToDocsFolder.length) {
                                console.log(`Successfully uploaded docs!`);
                                return resolve();
                            }
                        }
                    });
                }
            }
        })();
    });
}

function invalidateOldDocs() {
    return new Promise((resolve, reject) => {
        console.log(`Invaliding old documentation for version \`v${VERSION}\`on CloudFront...`);

        let cloudfront = new AWS.CloudFront();

        let paths = [
            `/js/v${VERSION}/*`,
            `/js/latest/*`
        ];

        let params = {
            DistributionId: 'EEI57NTZLJD4E',
            InvalidationBatch: {
                CallerReference: new Date().toString(),
                Paths: {
                    Quantity: paths.length,
                    Items: paths
                }
            }
        };

        console.log(`Invalidation paths:\n${JSON.stringify(params.InvalidationBatch.Paths.Items)}`);

        cloudfront.createInvalidation(params, (err, data) => {
            if (err) {
                console.error(`Error creating documentation invalidation:\n${err}`);
                return reject();
            } else {
                console.log(`Successfully created new invalidation for old documentation on CloudFront!`);
                return resolve();
            }
        });
    });
}

async function start() {
    await uploadCurrentVersionDocs();
    await invalidateOldDocs();
}

start();
