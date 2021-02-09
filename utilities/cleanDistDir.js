const fs = require('fs');
const path = require('path');
const fsPromises = fs.promises;

const directory = path.join(__dirname, '..', 'dist');

fsPromises.rmdir(directory, { recursive: true })
    .then(() => {
        console.log(`\`${directory}\` and its contents have been deleted.`);
        if (!fs.existsSync(directory)) {
            fsPromises.mkdir(directory)
                .then(() => {
                    console.log(`A fresh \`${directory}\` directory has been created.`);
                })
                .catch((e) => {
                    console.error(`Couldn't mkdir. Error:\n${e}`);
                });
        }
    })
    .catch((e) => {
        console.error(`There was an error deleting \`${directory}\` or its contents. Its contents may still be present.`);
    });