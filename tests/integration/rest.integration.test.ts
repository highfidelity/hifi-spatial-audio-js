const fetch = require('node-fetch');
import { TOKEN_GEN_TYPES, generateJWT } from './testUtilities/integrationTestUtils';
const stackData = require('./secrets/auth.json').stackData;
const stackURL = stackData.url;

describe('HiFi API REST Calls', () => {
    let adminToken: string;
    let nonAdminToken: string;

    beforeAll(async () => {
        try {
            adminToken = await generateJWT(TOKEN_GEN_TYPES.ADMIN_ID_APP1_SPACE1_SIGNED);
            nonAdminToken = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_ID_APP1_SPACE1_SIGNED);
        } catch (err) {
            console.error("Unable to create non admin token for testing REST calls. ERR: ", err);
            return;
        }
    });

    describe('Admin can create and delete a space', () => {
        let newSpaceName = "newSpace";
        let createdSpaceJSON: any = {};
        test(`Create a space`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminToken}&name=${newSpaceName}`);
            createdSpaceJSON = await returnMessage.json();
            expect(createdSpaceJSON['space-id']).toBeDefined();
            expect(createdSpaceJSON['app-id']).toBe(stackData.apps.app1.id);
        });

        test(`Delete a space`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${createdSpaceJSON['space-id']}?token=${adminToken}`, {
                method: 'DELETE'
            });
            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON['space-id']).toBe(returnMessageJSON['space-id']);
            expect(returnMessageJSON['app-id']).toBe(stackData.apps.app1.id);
        });
    });

    describe('NonAdmin cannot create or delete a space', () => {
        let newSpaceName = "someNewSpace";
        test(`Create a space`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${nonAdminToken}&name=${newSpaceName}`)
            let returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`Delete a space`, async () => {
            let spaceToDelete: string;
            try {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminToken}&name=${newSpaceName}`);
                let createdSpaceJSON = await returnMessage.json();
                spaceToDelete = createdSpaceJSON['space-id'];
            } catch (err) {
                console.log("Could not set up a space to test a nonadmin trying to delete a space! ERR: ", err);
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
                console.log("Could not delete the space used to test a nonadmin trying to delete a space! ERR: ", err);
            }
        });
    });

    describe(`Admin can read settings for a space`, () => {
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

    describe(`Non admin cannot read settings for a space`, () => {
        test(`Read all space settings simultaneously`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`Read the 'space-id' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/space-id/?token=${nonAdminToken}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`Read the 'app-id' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/app-id/?token=${nonAdminToken}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`Read the 'ignore-token-signing' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/ignore-token-signing/?token=${nonAdminToken}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`Read the 'name' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/name/?token=${nonAdminToken}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`Read the 'new-connections-allowed' setting`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/new-connections-allowed/?token=${nonAdminToken}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });
    });

    describe('Admin can change space settings', () => {
        test(`change multiple settings simultaneously using 'GET'`, async () => {
            let newName = "nameChanged";
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&new-connections-allowed=false&name=${newName}`);

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();

            expect(settingsJSON['new-connections-allowed']).toBe(false);
            expect(settingsJSON['name']).toBe(newName);
        });

        test(`change multiple settings simultaneously using 'POST'`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'name': stackData.apps.app1.spaces.space1.name,
                    'new-connections-allowed': true
                })
            });

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();

            expect(settingsJSON['new-connections-allowed']).toBe(true);
            expect(settingsJSON['name']).toBe(stackData.apps.app1.spaces.space1.name);
        });

        test(`make a space not joinable`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&new-connections-allowed=false`);

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();

            expect(settingsJSON['new-connections-allowed']).toBe(false);

        });

        test(`make a space joinable`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&new-connections-allowed=true`);

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();

            expect(settingsJSON['new-connections-allowed']).toBe(true);
        });

        test(`change the space name`, async () => {
            let newName = "changed name";
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&name=${newName}`);

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();

            expect(settingsJSON['name']).toBe(newName);

            // restore name to default
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&name=${stackData.apps.app1.spaces.space1.name}`);
        });

        test(`set space to ignore token signing`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&ignore-token-signing=true`);

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['ignore-token-signing']).toBe(true);
        });

        test(`set space to not ignore token signing`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminToken}&ignore-token-signing=false`);

            let settingsJSON: any = {};
            settingsJSON = await returnMessage.json();
            expect(settingsJSON['ignore-token-signing']).toBe(false);
        });
    });

    describe('Non admin cannot change space settings', () => {
        test(`change multiple settings simultaneously using 'GET'`, async () => {
            let newName = "nameChanged";
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&new-connections-allowed=false&name=${newName}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`change multiple settings simultaneously using 'POST'`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'name': stackData.apps.app1.spaces.space1.name,
                    'new-connections-allowed': true
                })
            });

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`make a space not joinable`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&new-connections-allowed=false`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");

        });

        test(`make a space joinable`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&new-connections-allowed=true`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`change the space name`, async () => {
            let newName = "changed name";
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&name=${newName}`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`set space to ignore token signing`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&ignore-token-signing=true`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });

        test(`set space to not ignore token signing`, async () => {
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&ignore-token-signing=false`);

            let returnMessageJSON: any = {};
            returnMessageJSON = await returnMessage.json();
            expect(returnMessageJSON.error).toBe("token isn't an admin token");
        });
    });
});