const fetch = require('node-fetch');
import { HiFiCommunicator, HiFiConnectionStates, HiFiUserDataStreamingScopes } from "../../../../src/classes/HiFiCommunicator";
import { TOKEN_GEN_TYPES, generateJWT } from '../../testUtilities/integrationTestUtils';
const stackData = require('../../secrets/auth.json').stackData;
const hifiCommunicator = new HiFiCommunicator();

describe('Non admin server connections', () => {
    let nonAdminSigned: string;
    let adminSigned: string;
    let nonAdminUnsigned: string;
    let nonAdminNonexistantSpaceID: string;
    let nonAdminNoSpaceName: string;
    let nonAdminTimed: string;
    let nonAdminExpired: string;
    let nonAdminPreissued: string;
    beforeAll(async () => {
        try {
            nonAdminSigned = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_ID_APP1_SPACE1_SIGNED);
            adminSigned = await generateJWT(TOKEN_GEN_TYPES.ADMIN_ID_APP1_SPACE1_SIGNED);
            nonAdminUnsigned = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_ID_APP1_SPACE1_UNSIGNED);
            nonAdminNonexistantSpaceID = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_APP1_SPACE_ID_NONEXISTANT_SIGNED);
            nonAdminNoSpaceName = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_APP1_NO_SPACE_NAME_SIGNED);
            nonAdminTimed = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_APP1_SPACE1_TIMED_SIGNED);
            nonAdminExpired = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_APP1_SPACE1_TIMED_EXPIRED);
            nonAdminPreissued = await generateJWT(TOKEN_GEN_TYPES.NON_ADMIN_APP1_SPACE1_TIMED_PREISSUED);
        } catch (err) {
            console.error("Unable to create tokens in preparation for testing server connections. Please check " +
                "your 'auth.json' file for errors or discrepancies with your account data. ERR: ", err);
            throw err;
        }
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

    // FAIL getting object with enotfound error
    test(`CAN connect with UNSIGNED correct token and correct stack URL if space ignores token signing`, async () => {
        // set space to allow unsigned tokens
        try {
            await fetch(`${stackData.url}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminSigned}&ignore-token-signing=true`);
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
            await fetch(`${stackData.url}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminSigned}&ignore-token-signing=false`);
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
            await fetch(`${stackData.url}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminSigned}&ignore-token-signing=true`);
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
            await fetch(`${stackData.url}/api/v1/spaces/${stackData.apps.app1.spaces.space1.id}/settings?token=${adminSigned}&ignore-token-signing=false`);
        } catch (err) {
            console.error("Unable to set space to ignore token signing. ERR: ", err);
            throw err;
        }

        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminUnsigned, stackData.wss + "?token="))
            .rejects.toMatchObject({ error: expect.stringMatching(/Unexpected server response: 501/) });
    });

    test(`CANNOT connect with SIGNED incorrect token (nonexistant space ID) and correct stack URL`, async () => {
        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminNonexistantSpaceID, stackData.url))
            .rejects.toMatchObject({
                error: expect.stringMatching(/Unexpected server response: 501/)
            });
    });

    // TODO AFTER pr from https://highfidelity.atlassian.net/browse/HIFI-302 is deployed
    // test(`CAN create space by trying to connect with SIGNED incorrect token (nonexistant space NAME) and correct stack URL`, async () => {
    //     let nonexistantSpaceName = `this space does not exist`;
    //     // TODO Make sure space does not exist first
    //     let result = hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminNoSpaceName, stackData.url)
    //         .then(data => { expect(data.audionetInitResponse.success).toBe(true) });
    //     // check the name exists?
    //     try {
    //         await fetch(`${stackData.url}/api/v1/spaces/${nonexistantSpaceName}?token=${adminSigned}`, {
    //             method: 'DELETE'
    //         });
    //     } catch (err) {
    //         console.error(`Unable to delete the space called ${nonexistantSpaceName} that was created for testing. Please do this manually. ERR: ${err}`);
    //     }
    //     return result;
    // });

    test(`CANNOT connect to a space BY NAME when multiple spaces with the same name exist in the same app`, async () => {
        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonAdminNoSpaceName, stackData.url))
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
            .rejects.toMatchObject({
                error: expect.stringMatching(/Unexpected server response: 501/)
            });
    });

    test(`CAN disconnect once connected`, async () => {
        await hifiCommunicator.disconnectFromHiFiAudioAPIServer()
            .then((data) => {
                expect(data).toBe('Successfully disconnected.');
            })
    });
});
