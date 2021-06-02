const fetch = require('node-fetch');
const stacks = require('../secrets/auth.json').stacks;
// import bots api

import { tokenTypes, generateJWT, setStackData } from '../testUtilities/testUtils';

let args = require('minimist')(process.argv.slice(2));
let stackname = args.stackname || process.env.hostname || "api-staging-latest.highfidelity.com";
console.log("_______________STACKNAME_______________________", stackname);
let stackURL = `https://${stackname}`;
let adminTokenNoSpace: string;

describe('Audio', () => {
    let stackData: { apps: { APP_1: { id: string; secret: string; }; APP_2: { id: string; secret: string; }; }; };
    if (stackname === "api-staging.highfidelity.com" || stackname === "api-staging-latest.highfidelity.com") {
        stackData = stacks.staging;
        console.log("_______________USING STAGING AUTH FILE_______________________");
    } else if (stackname === "api-pro.highfidelity.com" || stackname === "api-pro-latest.highfidelity.com") {
        stackData = stacks.pro;
        console.log("_______________USING PRO AUTH FILE_______________________");
    } else if (stackname === "api-pro-east.highfidelity.com" || stackname === "api-pro-latest-east.highfidelity.com") {
        stackData = stacks.east;
        console.log("_______________USING EAST AUTH FILE_______________________");
    } else if (stackname === "api-pro-eu.highfidelity.com" || stackname === "api-pro-latest-eu.highfidelity.com") {
        stackData = stacks['api-pro-eu.highfidelity.com'];
        console.log("_______________USING EU AUTH FILE_______________________");
    } else if (stackname === "api.highfidelity.com" || stackname === "api-hobby-latest.highfidelity.com") {
        stackData = stacks.hobby;
        console.log("_______________USING HOBBY AUTH FILE_______________________");
    } else {
        stackData = stacks[stackname];
        console.log(`_______________USING ${stackname} AUTH FILE_______________________`);
    }
    setStackData(stackData);

    beforeAll(async () => {
        adminTokenNoSpace = await generateJWT(tokenTypes.ADMIN_ID_APP1);
    });

    describe(`Capacity`, () => {
        let spaceID: string;
        let adminToken: string;

        let nonadminToken: string;

        // create the space
        beforeAll(async () => {
            jest.setTimeout(10000);
            try {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}`);
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                spaceID = returnMessageJSON['space-id']; // swap in your space ID to view bot testing
                adminToken = await generateJWT(tokenTypes.ADMIN_ID_APP1, spaceID);
                nonadminToken = await generateJWT(tokenTypes.NONADMIN_ID_APP1, spaceID); // swap in your token to view bot testing
            } catch (err) {
                console.error("Failed to create space before tests.");
            }

            // expect default max is 20

            // add 19 users
        });

        afterAll(async () => {
            await fetch(`${stackURL}/api/v1/spaces/${spaceID}?token=${adminToken}`, {
                method: 'DELETE'
            });
        });

        test(``, async () => {
           // User should be able to connect while space is under max capacity

           // User should not be able to connect once space is at max capacity

           // Remove capcity limits

           // On a loop, add a bot and make sure all are connected. When any disconnect, that's the max load? 
           // How will we add enough bots from 1 server? If we use multiple bots servers, the bot manager for 
           // each server has no data on bots from other servers.
        });
    });
});
