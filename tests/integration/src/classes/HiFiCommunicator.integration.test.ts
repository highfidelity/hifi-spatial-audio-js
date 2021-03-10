const fetch = require('node-fetch');
import { HiFiCommunicator, HiFiConnectionStates, HiFiUserDataStreamingScopes } from "../../../../src/classes/HiFiCommunicator";
import { TOKEN_GEN_TYPES, generateJWT } from '../../../testUtilities/integrationTestUtils';
const stackData = require('../../secrets/auth.json').stackData;
jest.setTimeout(10000);

describe('Non admin server connections', () => {
    let nonAdminSigned: string;
    let adminSigned: string;
    let nonAdminUnsigned: string;
    let nonAdminNonexistantSpaceID: string;
    let nonAdminNewSpaceName: string;
    let nonAdminTimed: string;
    let nonAdminExpired: string;
    let nonAdminDupSpaceName: string;
    let hifiCommunicator: HiFiCommunicator;
    beforeAll(async () => {
        try {
            nonAdminSigned = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_ID_APP2_SPACE1_SIGNED);
            adminSigned = await generateJWT(TOKEN_GEN_TYPES.ADMIN_ID_APP2_SPACE1_SIGNED);
            nonAdminUnsigned = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_ID_APP2_SPACE1_UNSIGNED);
            nonAdminNonexistantSpaceID = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_APP2_SPACE_ID_NONEXISTANT_SIGNED);
            nonAdminNewSpaceName = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_APP2_NEW_SPACE_NAME_SIGNED);
            nonAdminTimed = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_APP2_SPACE1_TIMED_SIGNED);
            nonAdminExpired = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_APP2_SPACE1_TIMED_EXPIRED);
            nonAdminDupSpaceName = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_APP2_SPACE1_DUP_SIGNED);
        } catch (err) {
            console.error("Unable to create tokens in preparation for testing server connections. Please check " +
                "your 'auth.json' file for errors or discrepancies with your account data. ERR: ", err);
            throw err;
        }
        // Make sure the space we try to create later does not already exist, delete it if it does
        try {
            let spaceAlreadyExistsID: string;
            let returnMessage = await fetch(`https://${stackData.url}/api/v1/spaces/?token=${adminSigned}`);
            let spacesListJSON: any = {};
            spacesListJSON = await returnMessage.json();
            spacesListJSON.forEach(async (space: any) => {
                if (space['name'] === TOKEN_GEN_TYPES.NON_ADMIN_APP2_NEW_SPACE_NAME_SIGNED["space_name"]) { spaceAlreadyExistsID = space['space-id']; }
            });

            // TODO handle if more than 1 already exists
            if (spaceAlreadyExistsID) {
                let deleteReturnMessage = await fetch(`https://${stackData.url}/api/v1/spaces/${spaceAlreadyExistsID}?token=${adminSigned}`, {
                    method: 'DELETE'
                });
                let deleteReturnMessageJSON: any = {};
                deleteReturnMessageJSON = await deleteReturnMessage.json();

                expect(deleteReturnMessageJSON['space-id']).toBe(spaceAlreadyExistsID);
            }
        } catch (err) {
            console.error(`Unable to ensure the nonexistant space does not exist. Please check your app. ERR: ${err}`);
            throw err;
        }

    });

    beforeEach( () => {
        hifiCommunicator = new HiFiCommunicator();
    })
    
    afterEach(async () => {
        await hifiCommunicator.disconnectFromHiFiAudioAPIServer();
    });

    test(`CAN connect with SIGNED correct token and correct stack URL`, async () => {
        await hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminSigned, stackData.url)
            .then(data => { expect(data.audionetInitResponse.success).toBe(true) });
    });

    test(`CANNOT connect with SIGNED correct token and incorrect stack URL`, async () => {
        // append the stack url twice to create a stack name that does not exist
        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminSigned, stackData.url + stackData.url))
            .rejects.toMatchObject({ error: expect.stringMatching(/getaddrinfo ENOTFOUND/) });
    });

    test(`CAN connect with UNSIGNED correct token and correct stack URL if space ignores token signing`, async () => {
        // set space to allow unsigned tokens
        try {
            await fetch(`https://${stackData.url}/api/v1/spaces/${stackData.apps.app2.spaces.space1.id}/settings?token=${adminSigned}&ignore-token-signing=true`);
        } catch (err) {
            console.error("Unable to set space to ignore token signing. ERR: ", err);
            throw err;
        }

        await hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminUnsigned, stackData.url)
            .then(data => { expect(data.audionetInitResponse.success).toBe(true) });
    });

    test(`CANNOT connect with UNSIGNED correct token and correct stack URL if space does not ignore token signing`, async () => {
        // set space to not allow unsigned tokens
        try {
            await fetch(`https://${stackData.url}/api/v1/spaces/${stackData.apps.app2.spaces.space1.id}/settings?token=${adminSigned}&ignore-token-signing=false`);
        } catch (err) {
            console.error("Unable to set space to ignore token signing. ERR: ", err);
            throw err;
        }

        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminUnsigned, stackData.url))
            .rejects.toMatchObject({ error: expect.stringMatching(/Unexpected server response: 501/) });
    });

    test(`CAN connect with SIGNED correct token and correct wss stackurl`, async () => {
        await hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminSigned, stackData.wss + "?token=")
            .then(data => { expect(data.audionetInitResponse.success).toBe(true) });
    });

    test(`CAN connect with UNSIGNED correct token and correct wss stackurl if space ignores token signing`, async () => {
        // set space to allow unsigned tokens
        try {
            await fetch(`https://${stackData.url}/api/v1/spaces/${stackData.apps.app2.spaces.space1.id}/settings?token=${adminSigned}&ignore-token-signing=true`);
        } catch (err) {
            console.error("Unable to set space to ignore token signing. ERR: ", err);
            throw err;
        }

        await hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminUnsigned, stackData.wss + "?token=")
            .then(data => { expect(data.audionetInitResponse.success).toBe(true) });
    });

    test(`CANNOT connect with UNSIGNED correct token and correct wss stackurl if space does not ignore token signing`, async () => {
        // set space to not allow unsigned tokens
        try {
            await fetch(`https://${stackData.url}/api/v1/spaces/${stackData.apps.app2.spaces.space1.id}/settings?token=${adminSigned}&ignore-token-signing=false`);
        } catch (err) {
            console.error("Unable to set space to ignore token signing. ERR: ", err);
            throw err;
        }

        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminUnsigned, stackData.wss + "?token="))
            .rejects.toMatchObject({ error: expect.stringMatching(/Unexpected server response: 501/) });
    });

    test(`CANNOT connect with SIGNED incorrect token (nonexistant space ID) and correct stack URL`, async () => {
        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminNonexistantSpaceID, stackData.url))
            .rejects.toMatchObject({ error: expect.stringMatching(/Unexpected server response: 501/) });
    });

    test(`CAN create space by trying to connect with SIGNED token with nonexistant space NAME and no space ID and correct stack URL`, async () => {
        await hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminNewSpaceName, stackData.url)
            .then(data => {
                expect(data.audionetInitResponse.success).toBe(true);
            });

        // confirm that space was created and get ID for deletion
        let createdSpaceID: string;
        try {
            let spaceWasCreated = false;
            let returnMessage = await fetch(`https://${stackData.url}/api/v1/spaces/?token=${adminSigned}`);
            let spacesListJSON: any = {};
            spacesListJSON = await returnMessage.json();
            spacesListJSON.forEach((space: any) => {
                if (space['name'] === TOKEN_GEN_TYPES.NON_ADMIN_APP2_NEW_SPACE_NAME_SIGNED["space_name"]) {
                    spaceWasCreated = true;
                    createdSpaceID = space['space-id'];
                }
            });

            expect(spaceWasCreated).toBe(true);
        } catch (err) {
            console.error(`Unable to check that a new space was created. Please check your app. ERR: ${err}`);
            throw err;
        }

        // delete the created space for clean up
        try {
            await fetch(`https://${stackData.url}/api/v1/spaces/${createdSpaceID}?token=${adminSigned}`, {
                method: 'DELETE'
            });
        } catch (err) {
            console.error(`Unable to delete the space with ID ${createdSpaceID} that was created for testing. Please do this manually. ERR: ${err}`);
            throw err;
        }
    });

    test(`CANNOT connect to a space BY NAME when multiple spaces with the same name exist in the same app`, async () => {
        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminDupSpaceName, stackData.url))
            .rejects.toMatchObject({
                error: expect.stringMatching(/Unexpected server response: 501/)
                // for when the new log message gets merged
                // error: expect.stringMatching(/multiple spaces with given name/)
            });
    });

    test(`CAN connect to a space using a timed token before the token expires`, async () => {
        await hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminTimed, stackData.url)
            .then(data => { expect(data.audionetInitResponse.success).toBe(true) });
    });

    test(`CANNOT connect to a space using a timed token after the token expires`, async () => {
        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminExpired, stackData.url))
            .rejects.toMatchObject({ error: expect.stringMatching(/Unexpected server response: 501/) });
    });

    test(`CAN disconnect once connected`, async () => {
        // make sure we're connected first
        try {
            await hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminSigned, stackData.url)
        } catch (err) {
            console.error("Unable to connect before testing disconnect. ERR: ", err);
            throw err;
        }
        await hifiCommunicator.disconnectFromHiFiAudioAPIServer()
            .then((data) => { expect(data).toBe('Successfully disconnected.') });
    });
});
