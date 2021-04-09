const fetch = require('node-fetch');
const stackData = require('../secrets/auth.json').stackData;

import { TOKEN_GEN_TYPES, generateJWT, generateUUID, sleep, ZoneData, AttenuationData } from '../testUtilities/testUtils';
import { TestUser } from '../testUtilities/TestUser';
import { HiFiConnectionStates } from "../../src/classes/HiFiCommunicator";

let args: { [key: string]: any } = (process.argv.slice(2));
let hostname = process.env.hostname || args["hostname"] || "api-staging-latest.highfidelity.com";
let stackURL = `https://${hostname}`;

describe('HiFi API REST Calls', () => {
    let adminToken: string; // App 1
    let nonAdminToken: string;
    let adminTokenApp2: string;
    let space1id = stackData.apps.app1.spaces.space1.id;

    beforeAll(async () => {
        try {
            adminToken = await generateJWT(TOKEN_GEN_TYPES.ADMIN_ID_APP1_SPACE1_SIGNED);
            nonAdminToken = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_ID_APP1_SPACE1_SIGNED);
            adminTokenApp2 = await generateJWT(TOKEN_GEN_TYPES.ADMIN_ID_APP2_SPACE1_SIGNED);
        } catch (err) {
            console.error("Unable to create tokens for testing REST calls. ERR: ", err);
            process.exit();
        }
    });

    describe('Getting a list of app spaces', () => {
        beforeAll(async () => {
            try {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/?token=${adminToken}`);

                let spacesListJSON: any = {};
                spacesListJSON = await returnMessage.json();
                spacesListJSON.forEach(async (space: any) => {
                    let match = false;
                    for (var key in stackData.apps.app1.spaces) {
                        if (stackData.apps.app1.spaces[key].id === space['space-id']) { match = true; }
                    }
                    if (!match) {
                        await fetch(`${stackURL}/api/v1/spaces/${space['space-id']}?token=${adminToken}`, {
                            method: 'DELETE'
                        });
                    };
                });
            } catch (err) {
                console.error("Failed to remove extra spaces before test. Please manually remove them and then rerun the test.");
            }
        });
        describe(`Admin CAN read accurate list of spaces for an app`, () => {
            test(`Read the list of spaces`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/?token=${adminToken}`);

                let spacesListJSON: any = {};
                spacesListJSON = await returnMessage.json();
                expect(spacesListJSON).toBeDefined();
            });

            test(`The list is accurate`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/?token=${adminToken}`);

                let spacesListJSON: any = {};
                spacesListJSON = await returnMessage.json();
                expect(spacesListJSON.length).toBe(Object.keys(stackData.apps.app1.spaces).length);
                spacesListJSON.forEach(async (space: any) => {
                    let match = false;
                    for (var key in stackData.apps.app1.spaces) {
                        if (stackData.apps.app1.spaces[key].id === space['space-id']) { match = true; }
                    }
                    expect(match).toBe(true);
                });
            });
        });

        describe(`Nonadmin CANNOT read list of spaces for an app`, () => {
            test(`Read the list of spaces`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/?token=${nonAdminToken}`);
                let returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });
        });
    });

    describe('Creating and deleting spaces', () => {
        describe('Admin CAN create and delete a space', () => {
            let newSpaceName = generateUUID();
            let createdSpaceJSON: any = {};
            test(`Create a space`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminToken}&name=${newSpaceName}`);
                createdSpaceJSON = await returnMessage.json();
                expect(createdSpaceJSON['space-id']).toBeDefined();
                expect(createdSpaceJSON['app-id']).toBe(stackData.apps.app1.id);
                let spaceToDelete: string;
                spaceToDelete = createdSpaceJSON['space-id'];
                try {
                    await fetch(`${stackURL}/api/v1/spaces/${spaceToDelete}?token=${adminToken}`, {
                        method: 'DELETE'
                    });
                } catch (err) {
                    console.log("Cannot delete the space used to test an admin trying to create a space! ERR: ", err);
                }
            });

            test(`Delete a space`, async () => {
                let spaceToDelete: string;
                try {
                    let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminToken}&name=${newSpaceName}`);
                    let createdSpaceJSON = await returnMessage.json();
                    spaceToDelete = createdSpaceJSON['space-id'];
                } catch (err) {
                    console.log("Cannot set up a space to test an admin trying to delete a space! ERR: ", err);
                }
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceToDelete}?token=${adminToken}`, {
                    method: 'DELETE'
                });
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON['space-id']).toBe(returnMessageJSON['space-id']);
                expect(returnMessageJSON['app-id']).toBe(stackData.apps.app1.id);
            });
        });

        describe('NonAdmin CANNOT create or delete a space', () => {
            let newSpaceName = "someNewSpace";
            test(`Create a space`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${nonAdminToken}&name=${newSpaceName}`)
                let returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Delete a space`, async () => {
                let spaceToDelete: string;
                try {
                    let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminToken}&name=${newSpaceName}`);
                    let createdSpaceJSON = await returnMessage.json();
                    spaceToDelete = createdSpaceJSON['space-id'];
                } catch (err) {
                    console.log("Cannot set up a space to test a nonadmin trying to delete a space! ERR: ", err);
                }
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceToDelete}?token=${nonAdminToken}`, {
                    method: 'DELETE'
                });
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
                try {
                    await fetch(`${stackURL}/api/v1/spaces/${spaceToDelete}?token=${adminToken}`, {
                        method: 'DELETE'
                    });
                } catch (err) {
                    console.log("Cannot delete the space used to test a nonadmin trying to delete a space! ERR: ", err);
                }
            });
        });
    });

    describe('Reading space settings', () => {
        describe(`Admin CAN read settings for a space`, () => {
            test(`Read all space settings simultaneously`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}`);
                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['app-id']).toBeDefined();
                expect(settingsJSON['space-id']).toBeDefined();
                expect(settingsJSON['ignore-token-signing']).toBeDefined();
                expect(settingsJSON['name']).toBeDefined();
                expect(settingsJSON['new-connections-allowed']).toBeDefined();
            });

            test(`Read the 'space-id' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/space-id/?token=${adminToken}`);
                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['space-id']).toBeDefined();
            });

            test(`Read the 'app-id' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/app-id/?token=${adminToken}`);
                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['app-id']).toBeDefined();
            });

            test(`Read the 'ignore-token-signing' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/ignore-token-signing/?token=${adminToken}`);
                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['ignore-token-signing']).toBeDefined();
            });

            test(`Read the 'name' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/name/?token=${adminToken}`);
                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['name']).toBeDefined();
            });

            test(`Read the 'new-connections-allowed' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/new-connections-allowed/?token=${adminToken}`);
                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['new-connections-allowed']).toBeDefined();
            });
        });

        describe(`Nonadmin CANNOT read settings for a space`, () => {
            test(`Read all space settings simultaneously`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${nonAdminToken}`);
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Read the 'space-id' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/space-id/?token=${nonAdminToken}`);
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Read the 'app-id' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/app-id/?token=${nonAdminToken}`);
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Read the 'ignore-token-signing' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/ignore-token-signing/?token=${nonAdminToken}`);
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Read the 'name' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/name/?token=${nonAdminToken}`);
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Read the 'new-connections-allowed' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/new-connections-allowed/?token=${nonAdminToken}`);
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });
        });
    });

    describe('Changing space settings', () => {
        describe('Admin CAN change space settings', () => {
            test(`Change multiple settings simultaneously using 'GET'`, async () => {
                // preset the property to ensure its state before attempting to make changes
                try {
                    await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}&new-connections-allowed=true`);
                } catch (err) {
                    console.log("Cannot set space to allow unsigned tokens signing before testing.");
                    throw err;
                }
                let newName = "nameChanged";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}&new-connections-allowed=false&name=${newName}`);
                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();

                expect(settingsJSON['new-connections-allowed']).toBe(false);
                expect(settingsJSON['name']).toBe(newName);
            });

            test(`Change multiple settings simultaneously using 'POST'`, async () => {
                // preset the property to ensure its state before attempting to make changes
                try {
                    await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}&new-connections-allowed=false`);
                } catch (err) {
                    console.log("Cannot set space to allow unsigned tokens signing before testing.");
                    throw err;
                }
                let newName = "nameChangedAlso";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        'name': newName,
                        'new-connections-allowed': true
                    })
                });

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();

                expect(settingsJSON['new-connections-allowed']).toBe(true);
                expect(settingsJSON['name']).toBe(newName);
            });

            test(`Make a space not joinable`, async () => {
                // preset the property to ensure its state before attempting to change it
                try {
                    await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}&new-connections-allowed=true`);
                } catch (err) {
                    console.log("Cannot make space joinable before testing.");
                    throw err;
                }
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}&new-connections-allowed=false`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();

                expect(settingsJSON['new-connections-allowed']).toBe(false);

            });

            test(`Make a space joinable`, async () => {
                // preset the property to ensure its state before attempting to change it
                try {
                    await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}&new-connections-allowed=false`);
                } catch (err) {
                    console.log("Cannot make space not joinable before testing.");
                    throw err;
                }
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}&new-connections-allowed=true`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();

                expect(settingsJSON['new-connections-allowed']).toBe(true);
            });

            test(`Change the space name`, async () => {
                let newName = "changed name";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}&name=${newName}`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();

                expect(settingsJSON['name']).toBe(newName);

                // restore name to default
                returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}&name=${stackData.apps.app1.spaces.space1.name}`);
            });

            test(`Set space to allow unsigned tokens`, async () => {
                // preset the property to ensure its state before attempting to change it
                try {
                    await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}&ignore-token-signing=false`);
                } catch (err) {
                    console.log("Cannot set space to disallow unsigned tokens before testing.");
                    throw err;
                }
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}&ignore-token-signing=true`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['ignore-token-signing']).toBe(true);
            });

            test(`Set space to disallow unsigned tokens`, async () => {
                // preset the property to ensure its state before attempting to change it
                try {
                    await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}&ignore-token-signing=true`);
                } catch (err) {
                    console.log("Cannot set space to allow unsigned tokens signing before testing.");
                    throw err;
                }
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${adminToken}&ignore-token-signing=false`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['ignore-token-signing']).toBe(false);
            });
        });

        describe('Non admin CANNOT change space settings', () => {
            test(`Change multiple settings simultaneously using 'GET'`, async () => {
                let newName = "nameChangedAgain";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${nonAdminToken}&new-connections-allowed=false&name=${newName}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Change multiple settings simultaneously using 'POST'`, async () => {
                let newName = "nameChangedAgain";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${nonAdminToken}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        'name': newName,
                        'new-connections-allowed': true
                    })
                });

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Make a space not joinable`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${nonAdminToken}&new-connections-allowed=false`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });

            });

            test(`Make a space joinable`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${nonAdminToken}&new-connections-allowed=true`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Change the space name`, async () => {
                let newName = "changed name";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${nonAdminToken}&name=${newName}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Set space to ignore token signing`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${nonAdminToken}&ignore-token-signing=true`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Set space to not ignore token signing`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${nonAdminToken}&ignore-token-signing=false`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });
        });
    });

    describe('Kicking users', () => {
        const numberTestUsers = 4;
        let testUsers: Array<any> = [];

        beforeAll(async () => {
            jest.setTimeout(35000); // these tests need longer to complete
        });

        afterAll(async () => {
            jest.setTimeout(5000); // restore to default
        });

        beforeEach(async () => {
            testUsers = [];
            for (let i = 0; i < numberTestUsers; i++) {
                let tokenData = TOKEN_GEN_TYPES.USER_APP1_SPACE1_SIGNED
                tokenData['user_id'] = generateUUID();
                testUsers.push(new TestUser(tokenData['user_id']));
                let token = await generateJWT(tokenData);
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
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/users/${testUsers[0].name}?token=${adminToken}`, {
                    method: 'DELETE'
                });
                let returnMessageJSON = await returnMessage.json();
                await sleep(30000);
                for (let i = 0; i < numberTestUsers; i++) {
                    if (i === 0) expect(testUsers[i].connectionState).toBe(HiFiConnectionStates.Failed);
                    else expect(testUsers[i].connectionState).toBe(HiFiConnectionStates.Connected);
                }
            });

            test(`Kick all users`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/users?token=${adminToken}`, {
                    method: 'DELETE'
                });
                let returnMessageJSON = await returnMessage.json();
                await sleep(30000);
                for (let i = 0; i < numberTestUsers; i++) {
                    expect(testUsers[i].connectionState).toBe(HiFiConnectionStates.Failed);
                }
            });
        });

        describe('Nonadmin CANNOT kick users', () => {
            test(`Kick one user`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/users/${testUsers[0].name}?token=${nonAdminToken}`, {
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
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/users?token=${nonAdminToken}`, {
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
            test(`Read settings for a space`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/app-id/?token=${adminTokenApp2}`);
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(422);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/space\/app mismatch/) });
            });
        });
    });

    describe.only('Working with zones and attenuations', () => {
        let zone1Data: ZoneData;
        let zone2Data: ZoneData;
        let zone3Data: ZoneData;
        let zone4Data: ZoneData;
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

        beforeEach(async () => {
            try {
                await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones?token=${adminToken}`, {
                    method: 'DELETE'
                });
            } catch (err) {
                console.error("Failed to delete all zones before test. Please manually remove them and then rerun the test.");
            }
        });

        test(`Admin CAN access, edit, create, and delete zones and attenuations`, async () => {
            // Create multiple zones via space `settings/zones` POST request
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones?token=${adminToken}`, {
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
            zone1Data['id'] = responseJSON[0].id;
            zone2Data['id'] = responseJSON[1].id;
            expect(responseJSON).toEqual([zone1Data, zone2Data]);

            // Create one zone via space `settings/zones/create` POST request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones?token=${adminToken}`, {
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
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones/create?token=${adminToken}&x-min=${zone4Data["x-min"]}&x-max=${zone4Data["x-max"]}&y-min=${zone4Data["y-min"]}&y-max=${zone4Data["y-max"]}&z-min=${zone4Data["z-min"]}&z-max=${zone4Data["z-max"]}&name=${zone4Data["name"]}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.id).toBeDefined();
            zone4Data['id'] = responseJSON.id;
            expect(responseJSON).toEqual(zone4Data);

            // Get the list of zones and make sure it is accurate
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones?token=${adminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual([zone1Data, zone2Data, zone3Data, zone4Data]);

            // Get a zone's settings via GET request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones/${zone1Data.id}?token=${adminToken}`);
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

            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones/${zone1Data.id}?token=${adminToken}&x-min=${zone1Data["x-min"]}&x-max=${zone1Data["x-max"]}&y-min=${zone1Data["y-min"]}&y-max=${zone1Data["y-max"]}&z-min=${zone1Data["z-min"]}&z-max=${zone1Data["z-max"]}&name=${zone1Data["name"]}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual(zone1Data);

            // Get a zone's settings via POST request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones/${zone1Data.id}?token=${adminToken}`, {
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

            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones/${zoneID}?token=${adminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(zone1Data)
            });
            responseJSON = await returnMessage.json();
            zone1Data.id = zoneID;
            expect(responseJSON).toEqual(zone1Data);


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

            // Create multiple attenuations via space `settings/attenuations` POST request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations?token=${adminToken}`, {
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
            expect(responseJSON).toEqual([attenuation1Data, attenuation2Data]);

            // Create one attenuation via space `settings/attenuations/create` POST request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations?token=${adminToken}`, {
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
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations/create?token=${adminToken}&attenuation=${attenuation4Data["attenuation"]}&source-zone-id=${attenuation4Data["source-zone-id"]}&listener-zone-id=${attenuation4Data["listener-zone-id"]}&za-offset=${attenuation4Data["za-offset"]}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON['id']).toBeDefined();
            attenuation4Data['id'] = responseJSON['id'];
            expect(responseJSON).toEqual(attenuation4Data);

            // Get the list of attenuations and make sure it is accurate
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations?token=${adminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual([attenuation1Data, attenuation2Data, attenuation3Data, attenuation4Data]);

            // Get a zone attenuation's settings via GET request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations/${attenuation1Data.id}?token=${adminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual(attenuation1Data);

            // Change a zone attenuation's settings via GET request
            attenuation1Data['attenuation'] = -6;
            attenuation1Data['listener-zone-id'] = zone2Data.id;
            attenuation1Data['source-zone-id'] = zone3Data.id;
            attenuation1Data['za-offset'] = 20;

            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations/${attenuation1Data.id}?token=${adminToken}&attenuation=${attenuation1Data["attenuation"]}&listener-zone-id=${attenuation1Data["listener-zone-id"]}&source-zone-id=${attenuation1Data["source-zone-id"]}&za-offset=${attenuation1Data["za-offset"]}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual(attenuation1Data);

            // Get a zone attenuation's settings via POST request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations/${attenuation1Data.id}?token=${adminToken}`, {
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
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations/${attenuationID}?token=${adminToken}`, {
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
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations/${attenuation1Data.id}?token=${adminToken}`, {
                method: 'DELETE'
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON.id).toBe(attenuation1Data.id);

            // Delete all zone attenuations
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations?token=${adminToken}`, {
                method: 'DELETE'
            });
            responseJSON = await returnMessage.json();
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations?token=${adminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual([]);

            // Delete one zone
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones/${zone1Data.id}?token=${adminToken}`, {
                method: 'DELETE'
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON.id).toBe(zone1Data.id);

            // Delete all zones
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones?token=${adminToken}`, {
                method: 'DELETE'
            });
            responseJSON = await returnMessage.json();
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones?token=${adminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual([]);
        });

        test.only(`Nonadmin CANNOT access, edit, create, and delete zones and attenuations`, async () => {
            // reset zone 1 as it's the only one where data may change during the previous test
            zone1Data = {
                "x-min": -5,
                "x-max": 5,
                "y-min": 0,
                "y-max": 10,
                "z-min": -5,
                "z-max": 5,
                "name": generateUUID()
            };

            // Try to create multiple zones via space `settings/zones` POST request
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones?token=${nonAdminToken}`, {
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
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones?token=${nonAdminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([zone3Data])
            });
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to create one zone via space settings/zones/create GET request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones/create?token=${nonAdminToken}&x-min=${zone4Data["x-min"]}&x-max=${zone4Data["x-max"]}&y-min=${zone4Data["y-min"]}&y-max=${zone4Data["y-max"]}&z-min=${zone4Data["z-min"]}&z-max=${zone4Data["z-max"]}&name=${zone4Data["name"]}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON.errors.description).toBe(`token isn't an admin token`);

            // Try to get the list of zones
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones?token=${nonAdminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual([zone1Data, zone2Data, zone3Data, zone4Data]);

            // Try to get a zone's settings via GET request
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones/${zone1Data.id}?token=${nonAdminToken}`);
            responseJSON = await returnMessage.json();
            expect(responseJSON).toEqual(zone1Data);

            // Try to change a zone's settings via GET request
            // zone1Data['x-min'] = -6;
            // zone1Data['x-max'] = 6;
            // zone1Data['y-min'] = 10;
            // zone1Data['y-max'] = 20;
            // zone1Data['z-min'] = -6;
            // zone1Data['z-max'] = -6;
            // zone1Data['name'] = generateUUID();

            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones/${zone1Data.id}?token=${nonAdminToken}&x-min=${zone1Data["x-min"]}&x-max=${zone1Data["x-max"]}&y-min=${zone1Data["y-min"]}&y-max=${zone1Data["y-max"]}&z-min=${zone1Data["z-min"]}&z-max=${zone1Data["z-max"]}&name=${zone1Data["name"]}`);
            // responseJSON = await returnMessage.json();
            // expect(responseJSON).toEqual(zone1Data);

            // Try to get a zone's settings via POST request
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones/${zone1Data.id}?token=${nonAdminToken}`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: '{}'
            // });
            // responseJSON = await returnMessage.json();
            // expect(responseJSON).toEqual(zone1Data);

            // Try to change a zone's settings via POST request
            // let zoneID = zone1Data.id;
            // zone1Data = {
            //     "x-min": -7,
            //     "x-max": 7,
            //     "y-min": 0,
            //     "y-max": 10,
            //     "z-min": -7,
            //     "z-max": 7,
            //     "name": generateUUID()
            // };

            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones/${zoneID}?token=${nonAdminToken}`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify(zone1Data)
            // });
            // responseJSON = await returnMessage.json();
            // zone1Data.id = zoneID;
            // expect(responseJSON).toEqual(zone1Data);


            // let attenuation1Data: AttenuationData;
            // let attenuation2Data: AttenuationData;
            // let attenuation3Data: AttenuationData;
            // let attenuation4Data: AttenuationData;
            // attenuation1Data = {
            //     "attenuation": 0.5,
            //     "listener-zone-id": zone1Data.id,
            //     "source-zone-id": zone2Data.id,
            //     "za-offset": -5
            // };
            // attenuation2Data = {
            //     "attenuation": 0.5,
            //     "listener-zone-id": zone1Data.id,
            //     "source-zone-id": zone2Data.id,
            //     "za-offset": -5
            // };
            // attenuation3Data = {
            //     "attenuation": 0.5,
            //     "listener-zone-id": zone1Data.id,
            //     "source-zone-id": zone3Data.id,
            //     "za-offset": -5
            // };
            // attenuation4Data = {
            //     "attenuation": 0.5,
            //     "listener-zone-id": zone1Data.id,
            //     "source-zone-id": zone4Data.id,
            //     "za-offset": -5
            // };

            // Try to  create multiple attenuations via space `settings/attenuations` POST request
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations?token=${nonAdminToken}`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify([attenuation1Data, attenuation2Data])
            // });

            // // Response will be the attenuation datas plus a new attenuation ID for each attenuation. Add the IDs to our data and the response should match
            // responseJSON = await returnMessage.json();
            // expect(responseJSON[0]['id']).toBeDefined();
            // expect(responseJSON[1]['id']).toBeDefined();
            // attenuation1Data['id'] = responseJSON[0]['id'];
            // attenuation2Data['id'] = responseJSON[1]['id'];
            // expect(responseJSON).toEqual([attenuation1Data, attenuation2Data]);

            // Try to create one attenuation via space `settings/attenuations/create` POST request
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations?token=${nonAdminToken}`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify([attenuation3Data])
            // });
            // responseJSON = await returnMessage.json();
            // expect(responseJSON[0]['id']).toBeDefined();
            // attenuation3Data['id'] = responseJSON[0]['id'];
            // expect(responseJSON).toEqual([attenuation3Data]);

            // Try to create one attenuation via space settings/attenuations/create GET request
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations/create?token=${nonAdminToken}&attenuation=${attenuation4Data["attenuation"]}&source-zone-id=${attenuation4Data["source-zone-id"]}&listener-zone-id=${attenuation4Data["listener-zone-id"]}&za-offset=${attenuation4Data["za-offset"]}`);
            // responseJSON = await returnMessage.json();
            // expect(responseJSON['id']).toBeDefined();
            // attenuation4Data['id'] = responseJSON['id'];
            // expect(responseJSON).toEqual(attenuation4Data);

            // Try to get the list of attenuations and make sure it is accurate
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations?token=${nonAdminToken}`);
            // responseJSON = await returnMessage.json();
            // expect(responseJSON).toEqual([attenuation1Data, attenuation2Data, attenuation3Data, attenuation4Data]);

            // Try to get a zone attenuation's settings via GET request
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations/${attenuation1Data.id}?token=${nonAdminToken}`);
            // responseJSON = await returnMessage.json();
            // expect(responseJSON).toEqual(attenuation1Data);

            // Try to change a zone attenuation's settings via GET request
            // attenuation1Data['attenuation'] = -6;
            // attenuation1Data['listener-zone-id'] = zone2Data.id;
            // attenuation1Data['source-zone-id'] = zone3Data.id;
            // attenuation1Data['za-offset'] = 20;

            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations/${attenuation1Data.id}?token=${nonAdminToken}&attenuation=${attenuation1Data["attenuation"]}&listener-zone-id=${attenuation1Data["listener-zone-id"]}&source-zone-id=${attenuation1Data["source-zone-id"]}&za-offset=${attenuation1Data["za-offset"]}`);
            // responseJSON = await returnMessage.json();
            // expect(responseJSON).toEqual(attenuation1Data);

            // Try to get a zone attenuation's settings via POST request
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations/${attenuation1Data.id}?token=${nonAdminToken}`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: '{}'
            // });
            // responseJSON = await returnMessage.json();
            // expect(responseJSON).toEqual(attenuation1Data);

            // Try to change a zone attenuation's settings via POST request
            // let attenuationID = attenuation1Data.id;
            // attenuation1Data = {
            //     "attenuation": 0.8,
            //     "listener-zone-id": zone3Data.id,
            //     "source-zone-id": zone4Data.id,
            //     "za-offset": -7
            // }
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations/${attenuationID}?token=${nonAdminToken}`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify(attenuation1Data)
            // });
            // responseJSON = await returnMessage.json();
            // attenuation1Data.id = attenuationID;
            // expect(responseJSON).toEqual(attenuation1Data);

            // Try to delete one zone attenuation
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations/${attenuation1Data.id}?token=${nonAdminToken}`, {
            //     method: 'DELETE'
            // });
            // responseJSON = await returnMessage.json();
            // expect(responseJSON.id).toBe(attenuation1Data.id);

            // Try to delete all zone attenuations
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations?token=${nonAdminToken}`, {
            //     method: 'DELETE'
            // });
            // responseJSON = await returnMessage.json();
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zone_attenuations?token=${nonAdminToken}`);
            // responseJSON = await returnMessage.json();
            // expect(responseJSON).toEqual([]);

            // Try to delete one zone
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones/${zone1Data.id}?token=${nonAdminToken}`, {
            //     method: 'DELETE'
            // });
            // responseJSON = await returnMessage.json();
            // expect(responseJSON.id).toBe(zone1Data.id);

            // Try to delete all zones
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones?token=${nonAdminToken}`, {
            //     method: 'DELETE'
            // });
            // responseJSON = await returnMessage.json();
            // returnMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings/zones?token=${nonAdminToken}`);
            // responseJSON = await returnMessage.json();
            // expect(responseJSON).toEqual([]);
        });
    });
});