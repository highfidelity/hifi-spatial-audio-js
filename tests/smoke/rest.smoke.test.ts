const fetch = require('node-fetch');
const stacks = require('../secrets/auth.json').stacks;

import { tokenTypes, generateJWT, generateUUID, sleep, ZoneData, AttenuationData, setStackData } from '../testUtilities/testUtils';
import { TestUser } from '../testUtilities/TestUser';
import { HiFiConnectionStates } from "../../src/classes/HiFiCommunicator";

let args = require('minimist')(process.argv.slice(2));
let stackname = args.stackname || process.env.hostname || "api-staging-latest.highfidelity.com";
console.log("_______________STACKNAME_______________________", stackname);
let stackURL = `https://${stackname}`;
let adminTokenNoSpace: string;
let nonadminTokenNoSpace: string;

describe('HiFi API REST Calls', () => {
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
    } else if (stackname === "api.highfidelity.com" || stackname === "api-hobby-latest.highfidelity.com") {
        stackData = stacks.hobby;
        console.log("_______________USING HOBBY AUTH FILE_______________________");
    } else {
        stackData = stacks[stackname];
        console.log(`_______________USING ${ stackname } AUTH FILE_______________________`);
    }
    setStackData(stackData);

    let appID = stackData.apps.APP_1.id;

    beforeAll(async () => {
        adminTokenNoSpace = await generateJWT(tokenTypes.ADMIN_ID_APP1);
        nonadminTokenNoSpace = await generateJWT(tokenTypes.NONADMIN_ID_APP1);
    });

    describe.only('App spaces', () => {
        let spaceID: string;
        let adminToken: string;
        let nonAdminToken: string;

        beforeAll(async () => {
            jest.setTimeout(15000); // these tests need longer to complete
            try {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/?token=${adminTokenNoSpace}`);
                let spacesListJSON: any = {};
                spacesListJSON = await returnMessage.json();
                spacesListJSON.forEach(async (space: any) => {
                    await fetch(`${stackURL}/api/v1/spaces/${space['space-id']}?token=${adminTokenNoSpace}`, {
                        method: 'DELETE'
                    });
                });
            } catch (err) {
                console.error("Failed to delete all current spaces before tests for app spaces.");
            }
        });

        afterAll(async () => {
            jest.setTimeout(5000); // restore to default
        });

        test('Admin CAN access, edit, create, and delete app spaces', async () => {
            // Create a space via GET request
            let space1Name = generateUUID();
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}&name=${space1Name}`);
            let returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON['space-id']).toBeDefined();
            spaceID = returnMessageJSON['space-id'];
            expect(returnMessageJSON['app-id']).toBe(appID);
            adminToken = await generateJWT(tokenTypes.ADMIN_ID_APP1, spaceID);
            nonAdminToken = await generateJWT(tokenTypes.NONADMIN_ID_APP1, spaceID);

            // Create a space via POST request
            let space2Name = generateUUID();
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: space2Name })
            });
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON['space-id']).toBeDefined();
            let space2id = returnMessageJSON['space-id'];
            expect(returnMessageJSON['app-id']).toBe(appID);

            // Get space details
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}?token=${adminToken}`);
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON['app_id']).toBe(appID);
            expect(returnMessageJSON['space_id']).toBe(spaceID);
            expect(returnMessageJSON['connected_user_count']).toBe(0);
            expect(returnMessageJSON['mixer_build_version']).toBeDefined();
            expect(returnMessageJSON['status']).toBe('ok');

            // Read the list of spaces
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/?token=${adminToken}`);
            let spacesListJSON: any = {};
            spacesListJSON = await returnMessage.json();
            expect(spacesListJSON).toBeDefined();

            // The list is accurate
            expect(spacesListJSON.length).toBe(2);
            expect(spacesListJSON[0]['space-id'] === spaceID || spacesListJSON[0]['space-id'] === space2id).toBeTruthy();
            if (spacesListJSON[0]['space-id'] === spaceID) {
                expect(spacesListJSON[1]['space-id']).toBe(space2id);
            } else {
                expect(spacesListJSON[1]['space-id']).toBe(spaceID);
            }

            // Read settings for a space
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings?token=${adminToken}`);
            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['app-id']).toBe(appID);
            expect(settingsJSON['space-id']).toBe(spaceID);
            expect(settingsJSON['ignore-token-signing']).toBe(false);
            expect(settingsJSON['name']).toBe(space1Name);
            expect(settingsJSON['new-connections-allowed']).toBe(true);
            expect(settingsJSON['global-frequency-rolloff']).toBe(null);
            expect(settingsJSON['global-attenuation']).toBe(null);
            expect(settingsJSON['client-limit']).toBe(null);
            // Removed check for max client limit, maybe add back after https://github.com/highfidelity/speakeasy-infra/pull/366

            // Read setting from the 'space-id' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/space-id/?token=${adminToken}`);
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['space-id']).toBe(spaceID);

            // Read setting from the 'app-id' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/app-id/?token=${adminToken}`);
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['app-id']).toBe(appID);

            // Read setting from the 'ignore-token-signing' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/ignore-token-signing/?token=${adminToken}`);
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['ignore-token-signing']).toBe(false);

            // Read setting from the 'name' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/name/?token=${adminToken}`);
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['name']).toBe(space1Name);

            // Read setting from the 'new-connections-allowed' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/new-connections-allowed/?token=${adminToken}`);
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['new-connections-allowed']).toBe(true);

            // Read setting from the 'global-frequency-rolloff' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/global-frequency-rolloff/?token=${adminToken}`);
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['global-frequency-rolloff']).toBe(null);

            // Read setting from the 'global-attenuation' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/global-attenuation/?token=${adminToken}`);
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['global-attenuation']).toBe(null);

            // Read setting from the 'client-limit' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/client-limit/?token=${adminToken}`);
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['client-limit']).toBe(null);

            // Read setting from the 'max-client-limit' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/max-client-limit/?token=${adminToken}`);
            settingsJSON = await returnMessage.json();
            // Removed check for max client limit, maybe add back after https://github.com/highfidelity/speakeasy-infra/pull/366

            // Change settings using 'GET'
            space1Name = generateUUID();
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings?token=${adminToken}&new-connections-allowed=false&name=${space1Name}`);
            settingsJSON = await returnMessage.json();

            expect(settingsJSON['new-connections-allowed']).toBe(false);
            expect(settingsJSON['name']).toBe(space1Name);

            // Change settings using 'POST'
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings?token=${adminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'ignore-token-signing': true,
                    'global-attenuation': 0.7
                })
            });
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['global-attenuation']).toBe(0.7);
            expect(settingsJSON['ignore-token-signing']).toBe(true);

            // Delete a space
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}?token=${adminToken}`, {
                method: 'DELETE'
            });
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON['space-id']).toBe(spaceID);
            expect(returnMessageJSON['app-id']).toBe(appID);

            // clean up
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space2id}?token=${adminToken}`, {
                method: 'DELETE'
            });
        });

        test('Nonadmin CANNOT access, edit, create, and delete app spaces', async () => {
            // Create a space via GET request
            let space1Name = generateUUID();
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${nonadminTokenNoSpace}&name=${space1Name}`);
            let returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Create a space via POST request
            let space2Name = generateUUID();
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${nonadminTokenNoSpace}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: space2Name })
            });
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Get space details
            try {
                // create a testing space
                returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}`);
                returnMessageJSON = await returnMessage.json();
                spaceID = returnMessageJSON['space-id'];
                nonAdminToken = await generateJWT(tokenTypes.NONADMIN_ID_APP1, spaceID);
            } catch (e) {
                console.error("Failed to create a space before tests for nonadmins trying to access space data.");
            }
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}?token=${nonAdminToken}`);
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Read the list of spaces
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/?token=${nonAdminToken}`);
            let spacesListJSON: any = {};
            spacesListJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Read settings for a space
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings?token=${nonAdminToken}`);
            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Read setting from the 'space-id' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/space-id/?token=${nonAdminToken}`);
            settingsJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Read setting from the 'app-id' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/app-id/?token=${nonAdminToken}`);
            settingsJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Read setting from the 'ignore-token-signing' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/ignore-token-signing/?token=${nonAdminToken}`);
            settingsJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Read setting from the 'name' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/name/?token=${nonAdminToken}`);
            settingsJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Read setting from the 'new-connections-allowed' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/new-connections-allowed/?token=${nonAdminToken}`);
            settingsJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Read setting from the 'global-frequency-rolloff' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/global-frequency-rolloff/?token=${nonAdminToken}`);
            settingsJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Read setting from the 'global-attenuation' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/global-attenuation/?token=${nonAdminToken}`);
            settingsJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Read setting from the 'client-limit' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/client-limit/?token=${nonAdminToken}`);
            settingsJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Read setting from the 'max-client-limit' path`, async () => {
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/max-client-limit/?token=${nonAdminToken}`);
            settingsJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Change settings using 'GET'
            space1Name = generateUUID();
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings?token=${nonAdminToken}&new-connections-allowed=false&name=${space1Name}`);
            settingsJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Change settings using 'POST'
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings?token=${nonAdminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'ignore-token-signing': true,
                    'global-attenuation': 0.7
                })
            });
            settingsJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // Delete a space
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}?token=${nonAdminToken}`, {
                method: 'DELETE'
            });
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);

            // clean up
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}?token=${adminToken}`, {
                method: 'DELETE'
            });
        });
    });

    describe('Kicking users', () => {
        const numberTestUsers = 4;
        let testUsers: Array<any> = [];
        let spaceID: string;
        let adminToken: string;
        let nonAdminToken: string;

        beforeAll(async () => {
            jest.setTimeout(35000); // these tests need longer to complete
            try {
                console.log("_____________________", adminTokenNoSpace);
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}`);
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                spaceID = returnMessageJSON['space-id'];
                adminToken = await generateJWT(tokenTypes.ADMIN_ID_APP1, spaceID);
                nonAdminToken = await generateJWT(tokenTypes.NONADMIN_ID_APP1, spaceID);
            } catch (e) {
                console.error("Failed to create a space before tests for kicking.");
            }
        });

        afterAll(async () => {
            jest.setTimeout(5000); // restore to default
            await fetch(`${stackURL}/api/v1/spaces/${spaceID}?token=${adminToken}`, {
                method: 'DELETE'
            });
        });

        beforeEach(async () => {
            testUsers = [];
            for (let i = 0; i < numberTestUsers; i++) {
                let tokenData = tokenTypes.NONADMIN_ID_APP1
                tokenData['user_id'] = generateUUID();
                testUsers.push(new TestUser(tokenData['user_id']));
                let token = await generateJWT(tokenData, spaceID);
                await testUsers[i].communicator.connectToHiFiAudioAPIServer(token, stackURL);
                expect(testUsers[i].connectionState).toBe(HiFiConnectionStates.Connected);
            }
        });

        afterEach(async () => {
            // disconnect communicators to avoid using too many mixers
            for (let i = 0; i < numberTestUsers; i++) {
                await testUsers[i].communicator.disconnectFromHiFiAudioAPIServer();
                expect(testUsers[i].connectionState).toBe(HiFiConnectionStates.Disconnected);
            }
        });

        describe('Admin CAN kick users', () => {
            test(`Kick one user`, async () => {
                await fetch(`${stackURL}/api/v1/spaces/${spaceID}/users/${testUsers[0].name}?token=${adminToken}`, {
                    method: 'DELETE'
                });
                await sleep(30000);
                for (let i = 0; i < numberTestUsers; i++) {
                    if (i === 0) expect(testUsers[i].connectionState).toBe(HiFiConnectionStates.Failed);
                    else expect(testUsers[i].connectionState).toBe(HiFiConnectionStates.Connected);
                }
            });

            test(`Kick all users`, async () => {
                await fetch(`${stackURL}/api/v1/spaces/${spaceID}/users?token=${adminToken}`, {
                    method: 'DELETE'
                });
                await sleep(30000);
                for (let i = 0; i < numberTestUsers; i++) {
                    expect(testUsers[i].connectionState).toBe(HiFiConnectionStates.Failed);
                }
            });
        });

        describe('Nonadmin CANNOT kick users', () => {
            test(`Kick one user`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/users/${testUsers[0].name}?token=${nonAdminToken}`, {
                    method: 'DELETE'
                });
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                await sleep(30000);
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
                for (let i = 0; i < numberTestUsers; i++) {
                    expect(testUsers[i].connectionState).toBe(HiFiConnectionStates.Connected);
                }
            });

            test(`Kick all users`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/users?token=${nonAdminToken}`, {
                    method: 'DELETE'
                });
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                await sleep(30000);
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
                for (let i = 0; i < numberTestUsers; i++) {
                    expect(testUsers[i].connectionState).toBe(HiFiConnectionStates.Connected);
                }
            });
        });
    });

    describe('Wrong admin tokens', () => {
        describe(`CANNOT read/alter App A by using a valid admin token for App B`, () => {
            let spaceID: string;
            let adminTokenApp1: string;
            let adminTokenApp2: string;
            beforeAll(async () => {
                try {
                    let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}`);
                    let returnMessageJSON: any = {};
                    returnMessageJSON = await returnMessage.json();
                    spaceID = returnMessageJSON['space-id'];
                    adminTokenApp1 = await generateJWT(tokenTypes.ADMIN_ID_APP1, spaceID);
                    adminTokenApp2 = await generateJWT(tokenTypes.ADMIN_ID_APP2);
                } catch (err) {
                    console.error("Failed to create spaces before tests for wrong admin.");
                }
            });

            afterAll(async () => {
                await fetch(`${stackURL}/api/v1/spaces/${spaceID}?token=${adminTokenApp1}`, {
                    method: 'DELETE'
                });
            });

            test(`Read settings for a space`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/app-id/?token=${adminTokenApp2}`);
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(422);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/space\/app mismatch/) });
            });
        });
    });

    describe('Zones and attenuations', () => {
        let spaceID: string;
        let adminToken: string;
        let nonAdminToken: string;
        let zone1Data: ZoneData;
        let zone2Data: ZoneData;
        let zone3Data: ZoneData;
        let zone4Data: ZoneData;

        beforeAll(async () => {
            jest.setTimeout(10000); // these tests need longer to complete
            // Create a space for testing
            try {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}`);
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                spaceID = returnMessageJSON['space-id'];
                adminToken = await generateJWT(tokenTypes.ADMIN_ID_APP1, spaceID);
                nonAdminToken = await generateJWT(tokenTypes.NONADMIN_ID_APP1, spaceID);
            } catch (e) {
                console.error("Failed to create a space before tests for zones and attenuations.");
            }

            zone1Data = {
                "x-min": -5,
                "x-max": 5,
                "y-min": 0,
                "y-max": 10,
                "z-min": -5,
                "z-max": 5,
                "name": generateUUID()
            };
            zone2Data = {
                "x-min": 5,
                "x-max": 15,
                "y-min": 0,
                "y-max": 10,
                "z-min": -5,
                "z-max": 5,
                "name": generateUUID()
            };
            zone3Data = {
                "x-min": 15,
                "x-max": 25,
                "y-min": 0,
                "y-max": 10,
                "z-min": -5,
                "z-max": 5,
                "name": generateUUID()
            };
            zone4Data = {
                "x-min": 25,
                "x-max": 35,
                "y-min": 0,
                "y-max": 10,
                "z-min": -5,
                "z-max": 5,
                "name": generateUUID()
            };
        });

        afterAll(async () => {
            jest.setTimeout(5000); // restore to default
            await fetch(`${stackURL}/api/v1/spaces/${spaceID}?token=${adminToken}`, {
                method: 'DELETE'
            });
        });

        beforeEach(async () => {
            try {
                await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones?token=${adminToken}`, {
                    method: 'DELETE'
                });
            } catch (err) {
                console.error("Failed to delete all zones before test. Please manually remove them and then rerun the test.");
            }
        });

        test(`Admin CAN access, edit, create, and delete zones and attenuations`, async () => {
            // Create multiple zones via space `settings/zones` POST request
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones?token=${adminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([zone1Data, zone2Data])
            });

            // Response will be the zone datas plus a new zone ID for each zone. Add the IDs to our data and the response should match
            let responseJSON: any = {};
            responseJSON = await returnMessage.json();
            expect(responseJSON[0].id).toBeDefined();
            expect(responseJSON[1].id).toBeDefined();
            if (responseJSON[0].name === zone1Data.name) {
                zone1Data['id'] = responseJSON[0].id;
                zone2Data['id'] = responseJSON[1].id;
            } else {
                zone1Data['id'] = responseJSON[1].id;
                zone2Data['id'] = responseJSON[0].id;
            }
            expect(responseJSON.map((a: { id: any; }) => a.id).sort()).toEqual([zone1Data, zone2Data].map(a => a.id).sort());

            // Create one zone via space `settings/zones/create` POST request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones?token=${adminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([zone3Data])
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON[0].id).toBeDefined();
            zone3Data['id'] = responseJSON[0].id;
            expect(responseJSON).toEqual([zone3Data]);

            // Create one zone via space settings/zones/create GET request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones/create?token=${adminToken}&x-min=${zone4Data["x-min"]}&x-max=${zone4Data["x-max"]}&y-min=${zone4Data["y-min"]}&y-max=${zone4Data["y-max"]}&z-min=${zone4Data["z-min"]}&z-max=${zone4Data["z-max"]}&name=${zone4Data["name"]}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.id).toBeDefined();
            zone4Data['id'] = responseJSON.id;
            expect(responseJSON).toEqual(zone4Data);

            // Get the list of zones and make sure it is accurate
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones?token=${adminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.map((a: { id: any; }) => a.id).sort()).toEqual([zone1Data, zone2Data, zone3Data, zone4Data].map(a => a.id).sort());


            // Get a zone's settings via GET request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones/${zone1Data.id}?token=${adminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual(zone1Data);

            // Change a zone's settings via GET request
            zone1Data['x-min'] = -6;
            zone1Data['x-max'] = 6;
            zone1Data['y-min'] = 10;
            zone1Data['y-max'] = 20;
            zone1Data['z-min'] = -6;
            zone1Data['z-max'] = -6;
            zone1Data['name'] = generateUUID();

            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones/${zone1Data.id}?token=${adminToken}&x-min=${zone1Data["x-min"]}&x-max=${zone1Data["x-max"]}&y-min=${zone1Data["y-min"]}&y-max=${zone1Data["y-max"]}&z-min=${zone1Data["z-min"]}&z-max=${zone1Data["z-max"]}&name=${zone1Data["name"]}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual(zone1Data);

            // Get a zone's settings via POST request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones/${zone1Data.id}?token=${adminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: '{}'
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual(zone1Data);

            // Change a zone's settings via POST request
            let zoneID = zone1Data.id;
            zone1Data = {
                "x-min": -7,
                "x-max": 7,
                "y-min": 0,
                "y-max": 10,
                "z-min": -7,
                "z-max": 7,
                "name": generateUUID()
            };

            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones/${zoneID}?token=${adminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(zone1Data)
            });
            responseJSON = await returnMessage.json();
            zone1Data.id = zoneID;
            expect(responseJSON).toEqual(zone1Data);

            // Create multiple attenuations via space `settings/attenuations` POST request
            let attenuation1Data: AttenuationData;
            let attenuation2Data: AttenuationData;
            let attenuation3Data: AttenuationData;
            let attenuation4Data: AttenuationData;
            attenuation1Data = {
                "attenuation": 0.5,
                "listener-zone-id": zone1Data.id,
                "source-zone-id": zone2Data.id,
                "za-offset": -5
            };
            attenuation2Data = {
                "attenuation": 0.5,
                "listener-zone-id": zone1Data.id,
                "source-zone-id": zone2Data.id,
                "za-offset": -5
            };
            attenuation3Data = {
                "attenuation": 0.5,
                "listener-zone-id": zone1Data.id,
                "source-zone-id": zone3Data.id,
                "za-offset": -5
            };
            attenuation4Data = {
                "attenuation": 0.5,
                "listener-zone-id": zone1Data.id,
                "source-zone-id": zone4Data.id,
                "za-offset": -5
            };
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations?token=${adminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([attenuation1Data, attenuation2Data])
            });

            // Response will be the attenuation datas plus a new attenuation ID for each attenuation. Add the IDs to our data and the response should match
            responseJSON = await returnMessage.json();
            expect(responseJSON[0]['id']).toBeDefined();
            expect(responseJSON[1]['id']).toBeDefined();
            attenuation1Data['id'] = responseJSON[0]['id'];
            attenuation2Data['id'] = responseJSON[1]['id'];
            expect(responseJSON.map((a: { id: any; }) => a.id).sort()).toEqual([attenuation1Data, attenuation2Data].map(a => a.id).sort());

            // Create one attenuation via space `settings/attenuations/create` POST request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations?token=${adminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([attenuation3Data])
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON[0]['id']).toBeDefined();
            attenuation3Data['id'] = responseJSON[0]['id'];
            expect(responseJSON).toEqual([attenuation3Data]);

            // Create one attenuation via space settings/attenuations/create GET request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations/create?token=${adminToken}&attenuation=${attenuation4Data["attenuation"]}&source-zone-id=${attenuation4Data["source-zone-id"]}&listener-zone-id=${attenuation4Data["listener-zone-id"]}&za-offset=${attenuation4Data["za-offset"]}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON['id']).toBeDefined();
            attenuation4Data['id'] = responseJSON['id'];
            expect(responseJSON).toEqual(attenuation4Data);

            // Get the list of attenuations and make sure it is accurate
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations?token=${adminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.map((a: { id: any; }) => a.id).sort()).toEqual([attenuation1Data, attenuation2Data, attenuation3Data, attenuation4Data].map(a => a.id).sort());

            // Get a zone attenuation's settings via GET request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations/${attenuation1Data.id}?token=${adminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual(attenuation1Data);

            // Change a zone attenuation's settings via GET request
            attenuation1Data['attenuation'] = -6;
            attenuation1Data['listener-zone-id'] = zone2Data.id;
            attenuation1Data['source-zone-id'] = zone3Data.id;
            attenuation1Data['za-offset'] = 20;

            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations/${attenuation1Data.id}?token=${adminToken}&attenuation=${attenuation1Data["attenuation"]}&listener-zone-id=${attenuation1Data["listener-zone-id"]}&source-zone-id=${attenuation1Data["source-zone-id"]}&za-offset=${attenuation1Data["za-offset"]}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual(attenuation1Data);

            // Get a zone attenuation's settings via POST request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations/${attenuation1Data.id}?token=${adminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: '{}'
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual(attenuation1Data);

            // Change a zone attenuation's settings via POST request
            let attenuationID = attenuation1Data.id;
            attenuation1Data = {
                "attenuation": 0.8,
                "listener-zone-id": zone3Data.id,
                "source-zone-id": zone4Data.id,
                "za-offset": -7
            }
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations/${attenuationID}?token=${adminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(attenuation1Data)
            });
            responseJSON = await returnMessage.json();
            attenuation1Data.id = attenuationID;
            expect(responseJSON).toEqual(attenuation1Data);

            // Delete one zone attenuation
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations/${attenuation1Data.id}?token=${adminToken}`, {
                method: 'DELETE'
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON.id).toBe(attenuation1Data.id);

            // Delete all zone attenuations
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations?token=${adminToken}`, {
                method: 'DELETE'
            });
            responseJSON = await returnMessage.json();
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations?token=${adminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual([]);

            // Delete one zone
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones/${zone1Data.id}?token=${adminToken}`, {
                method: 'DELETE'
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON.id).toBe(zone1Data.id);

            // Delete all zones
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones?token=${adminToken}`, {
                method: 'DELETE'
            });

            // check
            responseJSON = await returnMessage.json();
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones?token=${adminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual([]);
        });

        test(`Nonadmin CANNOT access, edit, create, and delete zones and attenuations`, async () => {
            // reset zone 1 and 2 as they are the only ones we will use for nonadmin testing
            zone1Data = {
                "x-min": -5,
                "x-max": 5,
                "y-min": 0,
                "y-max": 10,
                "z-min": -5,
                "z-max": 5,
                "name": generateUUID()
            };
            zone2Data = {
                "x-min": 5,
                "x-max": 15,
                "y-min": 0,
                "y-max": 10,
                "z-min": -5,
                "z-max": 5,
                "name": generateUUID()
            };

            // Try to create multiple zones via space `settings/zones` POST request
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones?token=${nonAdminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([zone1Data, zone2Data])
            });
            let responseJSON: any = {};
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to create one zone via space `settings/zones/create` POST request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones?token=${nonAdminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([zone1Data])
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to create one zone via space settings/zones/create GET request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones/create?token=${nonAdminToken}&x-min=${zone1Data["x-min"]}&x-max=${zone4Data["x-max"]}&y-min=${zone4Data["y-min"]}&y-max=${zone4Data["y-max"]}&z-min=${zone4Data["z-min"]}&z-max=${zone4Data["z-max"]}&name=${zone4Data["name"]}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to get the list of zones
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones?token=${nonAdminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to get a zone's settings via GET request
            // Create 2 zones to test against (need 2 for attenualtions)
            try {
                returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones?token=${adminTokenNoSpace}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify([zone1Data, zone2Data])
                });
                responseJSON = await returnMessage.json();
                if (responseJSON[0].name === zone1Data.name) {
                    zone1Data['id'] = responseJSON[0].id;
                    zone2Data['id'] = responseJSON[1].id;
                } else {
                    zone1Data['id'] = responseJSON[1].id;
                    zone2Data['id'] = responseJSON[0].id;
                }
            } catch (e) {
                console.error("Failed to create a zone before tests for nonadmins to edit zones.");
            }

            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones/${zone1Data.id}?token=${nonAdminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to change a zone's settings via GET request
            zone1Data['x-min'] = -6;
            zone1Data['x-max'] = 6;
            zone1Data['y-min'] = 10;
            zone1Data['y-max'] = 20;
            zone1Data['z-min'] = -6;
            zone1Data['z-max'] = -6;
            zone1Data['name'] = generateUUID();

            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones/${zone1Data.id}?token=${nonAdminToken}&x-min=${zone1Data["x-min"]}&x-max=${zone1Data["x-max"]}&y-min=${zone1Data["y-min"]}&y-max=${zone1Data["y-max"]}&z-min=${zone1Data["z-min"]}&z-max=${zone1Data["z-max"]}&name=${zone1Data["name"]}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to get a zone's settings via POST request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones/${zone1Data.id}?token=${nonAdminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: '{}'
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to change a zone's settings via POST request
            let zoneID = zone1Data.id;
            zone1Data = {
                "x-min": -7,
                "x-max": 7,
                "y-min": 0,
                "y-max": 10,
                "z-min": -7,
                "z-max": 7,
                "name": generateUUID()
            };

            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones/${zoneID}?token=${nonAdminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(zone1Data)
            });
            responseJSON = await returnMessage.json();
            zone1Data.id = zoneID;
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to  create multiple attenuations via space `settings/attenuations` POST request
            let attenuation1Data: AttenuationData;
            let attenuation2Data: AttenuationData;
            attenuation1Data = {
                "attenuation": 0.5,
                "listener-zone-id": zone1Data.id,
                "source-zone-id": zone2Data.id,
                "za-offset": -5
            };
            attenuation2Data = {
                "attenuation": 0.5,
                "listener-zone-id": zone2Data.id,
                "source-zone-id": zone1Data.id,
                "za-offset": -5
            };
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations?token=${nonAdminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([attenuation1Data, attenuation2Data])
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to create one attenuation via space `settings/attenuations/create` POST request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations?token=${nonAdminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([attenuation2Data])
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to create one attenuation via space settings/attenuations/create GET request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations/create?token=${nonAdminToken}&attenuation=${attenuation1Data["attenuation"]}&source-zone-id=${attenuation2Data["source-zone-id"]}&listener-zone-id=${attenuation2Data["listener-zone-id"]}&za-offset=${attenuation1Data["za-offset"]}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to get the list of attenuations
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations?token=${nonAdminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to get a zone attenuation's settings via GET request
            // Create 2 attenuations to test against
            try {
                returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations?token=${adminTokenNoSpace}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify([attenuation1Data, attenuation2Data])
                });
                responseJSON = await returnMessage.json();
                attenuation1Data['id'] = responseJSON[0]['id'];
                attenuation1Data['id'] = responseJSON[1]['id'];
            } catch (e) {
                console.error("Failed to create an attenuation before tests for nonadmins to edit attenuations.");
            }
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations/${attenuation1Data.id}?token=${nonAdminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to change a zone attenuation's settings via GET request
            attenuation1Data['attenuation'] = -6;
            attenuation1Data['listener-zone-id'] = zone2Data.id;
            attenuation1Data['source-zone-id'] = zone3Data.id;
            attenuation1Data['za-offset'] = 20;

            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations/${attenuation1Data.id}?token=${nonAdminToken}&attenuation=${attenuation1Data["attenuation"]}&listener-zone-id=${attenuation1Data["listener-zone-id"]}&source-zone-id=${attenuation1Data["source-zone-id"]}&za-offset=${attenuation1Data["za-offset"]}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to get a zone attenuation's settings via POST request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations/${attenuation1Data.id}?token=${nonAdminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: '{}'
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to change a zone attenuation's settings via POST request
            let attenuationID = attenuation1Data.id;
            attenuation1Data = {
                "attenuation": 0.8,
                "listener-zone-id": zone3Data.id,
                "source-zone-id": zone4Data.id,
                "za-offset": -7
            }
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations/${attenuationID}?token=${nonAdminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(attenuation1Data)
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);
            attenuation1Data.id = attenuationID;

            // Try to delete one zone attenuation
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations/${attenuation1Data.id}?token=${nonAdminToken}`, {
                method: 'DELETE'
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to delete all zone attenuations
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations?token=${nonAdminToken}`, {
                method: 'DELETE'
            });
            responseJSON = await returnMessage.json();
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zone_attenuations?token=${nonAdminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to delete one zone
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones/${zone1Data.id}?token=${nonAdminToken}`, {
                method: 'DELETE'
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to delete all zones
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones?token=${nonAdminToken}`, {
                method: 'DELETE'
            });
            responseJSON = await returnMessage.json();
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones?token=${nonAdminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Clean up
            try {
                returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/settings/zones?token=${adminToken}`, {
                    method: 'DELETE'
                });
            } catch (e) {
                console.error("Failed to clean up zones after testing.");
            }
        });
    });

    describe('User data access', () => {
        let spaceID: string;
        let adminToken: string;
        let adminID: string;
        let adminVisitIDHash: string;
        let nonadminToken: string;
        let nonadminID: string;
        let nonadminVisitIDHash: string;
        let testUserAdmin: TestUser;
        let testUserNonadmin: TestUser;

        beforeAll(async () => {
            jest.setTimeout(15000); // these tests need longer to complete
            try {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}`);
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                spaceID = returnMessageJSON['space-id'];

                // connect an admin test user to the space
                let tokenData = tokenTypes.ADMIN_ID_APP1;
                tokenData['user_id'] = generateUUID();
                testUserAdmin = new TestUser(tokenData['user_id']);
                adminToken = await generateJWT(tokenData, spaceID);
                await testUserAdmin.communicator.connectToHiFiAudioAPIServer(adminToken, stackURL)
                    .then(data => {
                        adminID = data.audionetInitResponse.user_id;
                        adminVisitIDHash = data.audionetInitResponse.visit_id_hash;
                    });
                expect(testUserAdmin.connectionState).toBe(HiFiConnectionStates.Connected);

                // connect a nonadmin test user to the space
                tokenData = tokenTypes.NONADMIN_ID_APP1;
                tokenData['user_id'] = generateUUID();
                testUserNonadmin = new TestUser(tokenData['user_id']);
                nonadminToken = await generateJWT(tokenData, spaceID);
                await testUserNonadmin.communicator.connectToHiFiAudioAPIServer(nonadminToken, stackURL)
                    .then(data => {
                        nonadminID = data.audionetInitResponse.user_id;
                        nonadminVisitIDHash = data.audionetInitResponse.visit_id_hash;
                    });
                expect(testUserNonadmin.connectionState).toBe(HiFiConnectionStates.Connected);
            } catch (err) {
                console.error("Could not set up a space and connect users to test user data access.");
            }
        });

        afterAll(async () => {
            await fetch(`${stackURL}/api/v1/spaces/${spaceID}?token=${adminToken}`, {
                method: 'DELETE'
            });
            jest.setTimeout(5000); // restore to default
        });

        test('Admin CAN access list of users', async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/users?token=${adminToken}`);
            let returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.length).toBe(2);
            let returnedAdmin = returnMessageJSON.filter((obj: { user_id: string; }) => {
                return obj['user_id'] === adminID;
            })
            expect(returnedAdmin).toBeDefined();

            let returnedNonadmin = returnMessageJSON.filter((obj: { user_id: string; }) => {
                return obj['user_id'] === nonadminID;
            })
            expect(returnedNonadmin).toBeDefined();
        });

        test('Nonadmin CANNOT access list of users', async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceID}/users?token=${nonadminToken}`);
            let returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.errors.description).toBe(`token isn't an admin token`);
        });
    });
});