const fetch = require('node-fetch');
import { TOKEN_GEN_TYPES, generateJWT } from '../testUtilities/integrationTestUtils';
const stackData = require('./secrets/auth.json').stackData;
const stackURL = 'https://' + stackData.url;
import { HiFiCommunicator, HiFiConnectionStates } from "../../src/classes/HiFiCommunicator";

class TestUser {
    connectionState: HiFiConnectionStates;
    communicator: HiFiCommunicator;

    constructor() {
        this.connectionState = HiFiConnectionStates.Disconnected;
        this.communicator = new HiFiCommunicator({ onConnectionStateChanged: this.onConnectionStateChanged.bind(this) });
    }

    onConnectionStateChanged(connectionState: HiFiConnectionStates) { this.connectionState = connectionState; }
}

describe('HiFi API REST Calls', () => {
    let adminToken: string;
    let nonAdminToken: string;
    let wrongAdminToken: string;
    let user1token: string;
    let user2token: string;
    let user3token: string;
    let user4token: string;

    beforeAll(async () => {
        try {
            adminToken = await generateJWT(TOKEN_GEN_TYPES.ADMIN_ID_APP1_SPACE1_SIGNED);
            nonAdminToken = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_ID_APP1_SPACE1_SIGNED);
            wrongAdminToken = await generateJWT(TOKEN_GEN_TYPES.ADMIN_ID_APP2_SPACE1_SIGNED);
            user1token = await generateJWT(TOKEN_GEN_TYPES.USER1_APP1_SPACE1_SIGNED);
            user2token = await generateJWT(TOKEN_GEN_TYPES.USER2_APP1_SPACE1_SIGNED);
            user3token = await generateJWT(TOKEN_GEN_TYPES.USER3_APP1_SPACE1_SIGNED);
            user4token = await generateJWT(TOKEN_GEN_TYPES.USER4_APP1_SPACE1_SIGNED);
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
                expect(createdSpaceJSON['space-id']).toBeDefined();
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
                expect(returnMessageJSON.error).toBe("token isn't an admin token");
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

        // No need to worry about the wrong admin creating a space as the create request uses the token to get the app ID
        describe('Wrong admin CANNOT delete a space', () => {
            let newSpaceName = "someNewSpace";
            test(`Delete a space`, async () => {
                let spaceToDelete: string;
                try {
                    let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminToken}&name=${newSpaceName}`);
                    let createdSpaceJSON = await returnMessage.json();
                    spaceToDelete = createdSpaceJSON['space-id'];
                } catch (err) {
                    console.log("Cannot set up a space to test a nonadmin trying to delete a space! ERR: ", err);
                }
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${spaceToDelete}?token=${wrongAdminToken}`, {
                    method: 'DELETE'
                });
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("space/app mismatch");
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

        describe(`Non admin CANNOT read list of spaces for an app`, () => {
            test(`Read the list of spaces`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/?token=${nonAdminToken}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("token isn't an admin token");
            });
        });

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

        describe(`Non admin CANNOT read settings for a space`, () => {
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

        describe(`Wrong admin CANNOT read settings for a space`, () => {
            test(`Read all space settings simultaneously`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${wrongAdminToken}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("space/app mismatch");
            });

            test(`Read the 'space-id' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/space-id/?token=${wrongAdminToken}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("space/app mismatch");
            });

            test(`Read the 'app-id' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/app-id/?token=${wrongAdminToken}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("space/app mismatch");
            });

            test(`Read the 'ignore-token-signing' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/ignore-token-signing/?token=${wrongAdminToken}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("space/app mismatch");
            });

            test(`Read the 'name' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/name/?token=${wrongAdminToken}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("space/app mismatch");
            });

            test(`Read the 'new-connections-allowed' setting`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings/new-connections-allowed/?token=${wrongAdminToken}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("space/app mismatch");
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
                expect(returnMessageJSON.error).toBe("token isn't an admin token");
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
                expect(returnMessageJSON.error).toBe("token isn't an admin token");
            });

            test(`Make a space not joinable`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&new-connections-allowed=false`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("token isn't an admin token");

            });

            test(`Make a space joinable`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&new-connections-allowed=true`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("token isn't an admin token");
            });

            test(`Change the space name`, async () => {
                let newName = "changed name";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&name=${newName}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("token isn't an admin token");
            });

            test(`Set space to ignore token signing`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&ignore-token-signing=true`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("token isn't an admin token");
            });

            test(`Set space to not ignore token signing`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${nonAdminToken}&ignore-token-signing=false`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("token isn't an admin token");
            });
        });

        describe('Wrong admin CANNOT change space settings', () => {
            test(`Change multiple settings simultaneously using 'GET'`, async () => {
                let newName = "nameChangedAgain";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${wrongAdminToken}&new-connections-allowed=false&name=${newName}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("space/app mismatch");
            });

            test(`Change multiple settings simultaneously using 'POST'`, async () => {
                let newName = "nameChangedAgain";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${wrongAdminToken}`, {
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
                expect(returnMessageJSON.error).toBe("space/app mismatch");
            });

            test(`Make a space not joinable`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${wrongAdminToken}&new-connections-allowed=false`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("space/app mismatch");

            });

            test(`Make a space joinable`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${wrongAdminToken}&new-connections-allowed=true`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("space/app mismatch");
            });

            test(`Change the space name`, async () => {
                let newName = "changed name";
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${wrongAdminToken}&name=${newName}`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("space/app mismatch");
            });

            test(`Set space to ignore token signing`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${wrongAdminToken}&ignore-token-signing=true`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("space/app mismatch");
            });

            test(`Set space to not ignore token signing`, async () => {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${wrongAdminToken}&ignore-token-signing=false`);

                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                expect(returnMessageJSON.error).toBe("space/app mismatch");
            });
        });
    });

    describe.only('Kicking users', () => {
        jest.setTimeout(10000);

        let user1 = new TestUser();
        let user2 = new TestUser();
        let user3 = new TestUser();
        let user4 = new TestUser();
        beforeEach(async () => {
            // if we ever change to disallow a previously kicked user (token) to connect, we will need to create unique tokens for each test
            await user1.communicator.connectToHiFiAudioAPIServer(user1token, stackData.url);
            await user2.communicator.connectToHiFiAudioAPIServer(user2token, stackData.url);
            await user3.communicator.connectToHiFiAudioAPIServer(user3token, stackData.url);
            await user4.communicator.connectToHiFiAudioAPIServer(user4token, stackData.url);
            expect(user1.connectionState).toBe(HiFiConnectionStates.Connected);
            expect(user2.connectionState).toBe(HiFiConnectionStates.Connected);
            expect(user3.connectionState).toBe(HiFiConnectionStates.Connected);
            expect(user4.connectionState).toBe(HiFiConnectionStates.Connected);
        });

        afterEach(async () => {
            // disconnect communicators to avoid using too many mixers
            await user1.communicator.disconnectFromHiFiAudioAPIServer();
            await user2.communicator.disconnectFromHiFiAudioAPIServer();
            await user3.communicator.disconnectFromHiFiAudioAPIServer();
            await user4.communicator.disconnectFromHiFiAudioAPIServer();
        });

        // describe('Nonadmin CANNOT kick users', () => {
        //     // test(`Kick one user`, async () => {
        //     //     let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/users?token=${nonAdminToken}`, {
        //     //         method: 'DELETE'
        //     //     });
        //     //     let returnMessageJSON: any = {};
        //     //     returnMessageJSON = await returnMessage.json();
        //     //     expect(returnMessageJSON.error).toBe("token isn't an admin token");
        //     //     expect(user1.connectionState).toBe(HiFiConnectionStates.Connected);
        //     // });

        //     test(`Kick all users`, async () => {
        //         let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/users?token=${nonAdminToken}`, {
        //             method: 'DELETE'
        //         });
        //         console.log("__________________________\n", returnMessage.audionetInitResponse);
        //         let returnMessageJSON: any = {};
        //         returnMessageJSON = await returnMessage.json();
        //         expect(returnMessageJSON.error).toBe("token isn't an admin token");
        //         expect(user1.connectionState).toBe(HiFiConnectionStates.Connected);
        //     });
        // });

        // describe('Wrong admin CANNOT kick users', () => {
        //     // test(`Kick one user`, async () => {
        //     // });

        //     test(`Kick all users`, async () => {
        //         let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/users?token=${wrongAdminToken}`, {
        //             method: 'DELETE'
        //         });
        //         console.log("__________________________\n", returnMessage.audionetInitResponse);
        //         let returnMessageJSON: any = {};
        //         returnMessageJSON = await returnMessage.json();
        //         expect(returnMessageJSON.error).toBe("token isn't an admin token");
        //         expect(user1.connectionState).toBe(HiFiConnectionStates.Connected);
        //     });
        // });

        describe('Admin CAN kick users', () => {
            // test(`Kick one user`, async () => {
            // });

            test(`Kick all users`, async () => {
                console.log("_____________TOKEN_____________\n", adminToken);
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/users?token=${adminToken}`, {
                    method: 'DELETE'
                });
                // let returnMessageJSON: any = {};
                // returnMessageJSON = await returnMessage.json();
                console.log("__________________________\n", returnMessage.error);

                // expect(returnMessageJSON.error).toBe("token isn't an admin token");
                expect(user1.connectionState).toBe(HiFiConnectionStates.Disconnected);
            });
        });
    });
});
