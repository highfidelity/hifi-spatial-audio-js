const fetch = require('node-fetch');
const stacks = require('../secrets/auth.json').stacks;
import { HiFiCommunicator } from '../../src/classes/HiFiCommunicator';
// import bots api

import { tokenTypes, generateJWT, setStackData, sleep, generateUUID } from '../testUtilities/testUtils';

const BOTS_API_URL = 'https://experiment-001.highfidelity.com/botsAPI/';

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
        let groupID: string;

        // create the space
        beforeAll(async () => {
            jest.setTimeout(300000);
            groupID = generateUUID();
        });

        afterAll(async () => {
            // await sleep(270000);
            await fetch(`${BOTS_API_URL}removeGroups`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ "groupIDs": [groupID] })
            });
            await fetch(`${stackURL}/api/v1/spaces/${spaceID}?token=${adminToken}`, {
                method: 'DELETE'
            });
        });

        test(`Velvet rope`, async () => {
            let visitIDHash: string;
            try {
                await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        "client-limit": 20
                    })
                })
                    .then((response: { json: () => any; }) => response.json())
                    .then(async (data: any) => {
                        spaceID = data['space-id'];
                        adminToken = await generateJWT(tokenTypes.ADMIN_ID_APP1, spaceID);
                        nonadminToken = await generateJWT(tokenTypes.NONADMIN_ID_APP1, spaceID);
                    });
            } catch (err) {
                console.error("Failed to create space before tests.");
            }

            await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings?token=${adminToken}`)
                .then((response: { json: () => any; }) => response.json())
                .then(async (data: any) => {
                    expect(data['client-limit']).toBe(20);
                });

            await fetch(`${BOTS_API_URL}addBots`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "numBots": 19,
                    "groupID": groupID,
                    "properties": {
                        "audio": [''],
                        "stackName": [stackname],
                        "jwt": [nonadminToken]
                    }
                })
            })

            await sleep(5000);
            await fetch(`${BOTS_API_URL}listConnectionStates`)
                .then((response: { json: () => any; }) => response.json())
                .then(async (data: any) => {
                    let botslist = data.data.botsList;
                    if (botslist[groupID].Connected !== 19) throw new Error(`Setup failed. Rerun this test. ${botslist[groupID].Connected} bots connected.`);
                });

            // User should be able to connect while space is under max capacity
            let hifiCommunicator1 = new HiFiCommunicator();
            await hifiCommunicator1.connectToHiFiAudioAPIServer(nonadminToken, stackURL)
                .then(data => {
                    expect(data.audionetInitResponse.success).toBe(true);
                    visitIDHash = data.audionetInitResponse.visit_id_hash;
                });

            await sleep(5000);
            expect(hifiCommunicator1.getConnectionState()).toBe("Connected");
            await fetch(`${BOTS_API_URL}listConnectionStates`)
                .then((response: { json: () => any; }) => response.json())
                .then(async (data: any) => {
                    let botslist = data.data.botsList;
                });
            // space should be at max capacity now
            await fetch(`${stackURL}/api/v1/spaces/${spaceID}/users?token=${adminToken}`)
                .then((response: { json: () => any; }) => response.json())
                .then(async (data: any) => {
                    expect(data.length).toBe(20);
                });

            // User should not be able to connect once space is at max capacity
            let hifiCommunicator2 = new HiFiCommunicator();
            await expect(hifiCommunicator2.connectToHiFiAudioAPIServer(nonadminToken, stackURL))
                .rejects.toMatchObject({ error: expect.stringMatching("Error when connecting to mixer!\nHigh Fidelity server is at capacity; service is unavailable.") });
        });
    });
});
