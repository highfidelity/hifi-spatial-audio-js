const fetch = require('node-fetch');
const stackData = require('../secrets/auth.json').stackData;

import { TOKEN_GEN_TYPES, generateJWT } from '../testUtilities/testUtils';

let args: { [key: string]: any } = (process.argv.slice(2));
let hostname = process.env.hostname || args["hostname"] || "api-staging-latest.highfidelity.com";
let stackURL = `https://${hostname}`;

describe('HiFi API REST Calls', () => {
    let adminToken: string; // App 1
    let nonAdminToken: string;
    let adminTokenApp2: string;

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

    describe('Creating and deleting spaces', () => {
        describe('Admin CAN create and delete a space', () => {
            let newSpaceName = "newSpace";
            let createdSpaceJSON: any = {};
            test(`Create a space`, async () => {
                // TODO ensure space does not already exist
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminToken}&name=${newSpaceName}`);
                createdSpaceJSON = await returnMessage.json();
                expect(createdSpaceJSON['space-id']).toBeNull();
                expect(createdSpaceJSON['app-id']).toBe(stackData.apps.app1.id);
            });

            test(`Delete a space`, async () => {
                // TODO ensure space already exists
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${createdSpaceJSON['space-id']}?token=${adminToken}`, {
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

    describe('Reading app spaces', () => {
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

    describe('Reading space settings', () => {
        describe(`Admin CAN read settings for a space`, () => {
            test(`Read all space settings simultaneously`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['app-id']).toBeDefined();
                expect(settingsJSON['space-id']).toBeDefined();
                expect(settingsJSON['ignore-token-signing']).toBeDefined();
                expect(settingsJSON['name']).toBeDefined();
                expect(settingsJSON['new-connections-allowed']).toBeDefined();
            });

            test(`Read the 'space-id' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/space-id/?token=${adminToken}`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['space-id']).toBeDefined();
            });

            test(`Read the 'app-id' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/app-id/?token=${adminToken}`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['app-id']).toBeDefined();
            });

            test(`Read the 'ignore-token-signing' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/ignore-token-signing/?token=${adminToken}`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['ignore-token-signing']).toBeDefined();
            });

            test(`Read the 'name' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/name/?token=${adminToken}`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['name']).toBeDefined();
            });

            test(`Read the 'new-connections-allowed' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/new-connections-allowed/?token=${adminToken}`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['new-connections-allowed']).toBeDefined();
            });
        });

        describe(`Nonadmin CANNOT read settings for a space`, () => {
            test(`Read all space settings simultaneously`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Read the 'space-id' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/space-id/?token=${nonAdminToken}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Read the 'app-id' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/app-id/?token=${nonAdminToken}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Read the 'ignore-token-signing' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/ignore-token-signing/?token=${nonAdminToken}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Read the 'name' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/name/?token=${nonAdminToken}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Read the 'new-connections-allowed' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/new-connections-allowed/?token=${nonAdminToken}`);

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
                    await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&new-connections-allowed=true`);
                } catch (err) {
                    console.log("Cannot set space to allow unsigned tokens signing before testing.");
                    throw err;
                }
                let newName = "nameChanged";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&new-connections-allowed=false&name=${newName}`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();

                expect(settingsJSON['new-connections-allowed']).toBe(false);
                expect(settingsJSON['name']).toBe(newName);
            });

            test(`Change multiple settings simultaneously using 'POST'`, async () => {
                // preset the property to ensure its state before attempting to make changes
                try {
                    await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&new-connections-allowed=false`);
                } catch (err) {
                    console.log("Cannot set space to allow unsigned tokens signing before testing.");
                    throw err;
                }
                let newName = "nameChangedAlso";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}`, {
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
                    await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&new-connections-allowed=true`);
                } catch (err) {
                    console.log("Cannot make space joinable before testing.");
                    throw err;
                }
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&new-connections-allowed=false`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();

                expect(settingsJSON['new-connections-allowed']).toBe(false);

            });

            test(`Make a space joinable`, async () => {
                // preset the property to ensure its state before attempting to change it
                try {
                    await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&new-connections-allowed=false`);
                } catch (err) {
                    console.log("Cannot make space not joinable before testing.");
                    throw err;
                }
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&new-connections-allowed=true`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();

                expect(settingsJSON['new-connections-allowed']).toBe(true);
            });

            test(`Change the space name`, async () => {
                let newName = "changed name";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&name=${newName}`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();

                expect(settingsJSON['name']).toBe(newName);

                // restore name to default
                returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&name=${stackData.apps.app1.spaces.space1.name}`);
            });

            test(`Set space to allow unsigned tokens`, async () => {
                // preset the property to ensure its state before attempting to change it
                try {
                    await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&ignore-token-signing=false`);
                } catch (err) {
                    console.log("Cannot set space to disallow unsigned tokens before testing.");
                    throw err;
                }
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&ignore-token-signing=true`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['ignore-token-signing']).toBe(true);
            });

            test(`Set space to disallow unsigned tokens`, async () => {
                // preset the property to ensure its state before attempting to change it
                try {
                    await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&ignore-token-signing=true`);
                } catch (err) {
                    console.log("Cannot set space to allow unsigned tokens signing before testing.");
                    throw err;
                }
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&ignore-token-signing=false`);

                let settingsJSON: any = {};
                settingsJSON = await returnMessage.json();
                expect(settingsJSON['ignore-token-signing']).toBe(false);
            });
        });

        describe('Non admin CANNOT change space settings', () => {
            test(`Change multiple settings simultaneously using 'GET'`, async () => {
                let newName = "nameChangedAgain";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&new-connections-allowed=false&name=${newName}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Change multiple settings simultaneously using 'POST'`, async () => {
                let newName = "nameChangedAgain";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}`, {
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
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&new-connections-allowed=false`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });

            });

            test(`Make a space joinable`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&new-connections-allowed=true`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Change the space name`, async () => {
                let newName = "changed name";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&name=${newName}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Set space to ignore token signing`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&ignore-token-signing=true`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });

            test(`Set space to not ignore token signing`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&ignore-token-signing=false`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(401);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/token isn't an admin token/) });
            });
        });
    });

    describe('Wrong admin tokens', () => {
        describe(`CANNOT read/alter App A by using a valid admin token for App B`, () => {
            test(`Read settings for a space`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/app-id/?token=${adminTokenApp2}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.code).toBe(422);
                expect(returnMessageJSON.errors).toMatchObject({ description: expect.stringMatching(/space\/app mismatch/) });
            });
        });
    });
});
