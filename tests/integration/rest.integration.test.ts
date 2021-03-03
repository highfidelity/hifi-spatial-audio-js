const fetch = require('node-fetch');
import { TOKEN_GEN_TYPES, generateJWT } from './testUtilities/integrationTestUtils';
const stackData = require('./secrets/auth.json').stackData;
const stackURL = stackData.url;

//TODO Any of the above (delete, change / get settings, ignore / don't ignore signing) should all FAIL if the admin JWT being used is for an application that is NOT the application the space is in. (This test will fail -- i.e. the action will succeed -- right now! Yikes!!)
describe('HiFi API REST Calls', () => {
    let adminToken: string;
    let nonAdminToken: string;

    beforeAll(async () => {
        try {
            adminToken = await generateJWT(TOKEN_GEN_TYPES.ADMIN_ID_APP1_SPACE1_SIGNED);
            nonAdminToken = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_ID_APP1_SPACE1_SIGNED);
        } catch (err) {
            console.error("Unable to create non admin token for testing REST calls. ERR: ", err);
            process.exit();
        }
    });

    describe('Admin CAN create and delete a space', () => {
        let newSpaceName = "newSpace";
        let createdSpaceJSON: any = {};
        test(`CAN create a space`, async () => {
            // TODO ensure space does not already exist
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminToken}&name=${newSpaceName}`);
            createdSpaceJSON = await returnMessage.json();
            expect(createdSpaceJSON['space-id']).toBeDefined();
            expect(createdSpaceJSON['app-id']).toBe(stackData.apps.app1.id);
        });

        test(`CAN delete a space`, async () => {
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
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`CAN delete a space`, async () => {
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
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
            try {
                await fetch(`${stackURL}/api/v1/spaces/${spaceToDelete}?token=${adminToken}`, {
                    method: 'DELETE'
                });
            } catch (err) {
                console.log("Cannot delete the space used to test a nonadmin trying to delete a space! ERR: ", err);
            }
        });
    });

    describe(`Admin CAN read accurate list of spaces for an app`, () => {
        test(`CAN read the list of spaces`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/?token=${adminToken}`);

            let spacesListJSON: any = {};
            spacesListJSON = await returnMessage.json();
            expect(spacesListJSON).toBeDefined();
        });

        test(`the list is accurate`, async () => {
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

    describe(`Admin CAN read settings for a space`, () => {
        test(`CAN read all space settings simultaneously`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}`);

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['app-id']).toBeDefined();
            expect(settingsJSON['space-id']).toBeDefined();
            expect(settingsJSON['ignore-token-signing']).toBeDefined();
            expect(settingsJSON['name']).toBeDefined();
            expect(settingsJSON['new-connections-allowed']).toBeDefined();
        });

        test(`CAN read the 'space-id' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/space-id/?token=${adminToken}`);

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['space-id']).toBeDefined();
        });

        test(`CAN read the 'app-id' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/app-id/?token=${adminToken}`);

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['app-id']).toBeDefined();
        });

        test(`CAN read the 'ignore-token-signing' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/ignore-token-signing/?token=${adminToken}`);

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['ignore-token-signing']).toBeDefined();
        });

        test(`CAN read the 'name' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/name/?token=${adminToken}`);

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['name']).toBeDefined();
        });

        test(`CAN read the 'new-connections-allowed' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/new-connections-allowed/?token=${adminToken}`);

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['new-connections-allowed']).toBeDefined();
        });
    });

    describe(`Non admin CANNOT read settings for a space`, () => {
        test(`CANNOT read all space settings simultaneously`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`CANNOT read the 'space-id' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/space-id/?token=${nonAdminToken}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`CANNOT read the 'app-id' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/app-id/?token=${nonAdminToken}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`CANNOT read the 'ignore-token-signing' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/ignore-token-signing/?token=${nonAdminToken}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`CANNOT read the 'name' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/name/?token=${nonAdminToken}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`CANNOT read the 'new-connections-allowed' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/new-connections-allowed/?token=${nonAdminToken}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });
    });

    describe('Admin CAN change space settings', () => {
        test(`CAN change multiple settings simultaneously using 'GET'`, async () => {
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

        test(`CAN change multiple settings simultaneously using 'POST'`, async () => {
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

        test(`CAN make a space not joinable`, async () => {
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

        test(`CAN make a space joinable`, async () => {
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

        test(`CAN change the space name`, async () => {
            let newName = "changed name";
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&name=${newName}`);

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();

            expect(settingsJSON['name']).toBe(newName);

            // restore name to default
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&name=${stackData.apps.app1.spaces.space1.name}`);
        });

        test(`CAN set space to allow unsigned tokens`, async () => {
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

        test(`CAN set space to disallow unsigned tokens`, async () => {
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
        test(`CANNOT change multiple settings simultaneously using 'GET'`, async () => {
            let newName = "nameChangedAgain";
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&new-connections-allowed=false&name=${newName}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`CANNOT change multiple settings simultaneously using 'POST'`, async () => {
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
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`CANNOT make a space not joinable`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&new-connections-allowed=false`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");

        });

        test(`CANNOT make a space joinable`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&new-connections-allowed=true`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`CANNOT change the space name`, async () => {
            let newName = "changed name";
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&name=${newName}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`CANNOT set space to ignore token signing`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&ignore-token-signing=true`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`CANNOT set space to not ignore token signing`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&ignore-token-signing=false`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });
    });
});