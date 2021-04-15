const fetch = require('node-fetch');
import { HiFiCommunicator } from "../../src/classes/HiFiCommunicator";
import { TOKEN_GEN_TYPES, generateJWT, generateUUID } from '../testUtilities/testUtils';

const NEW_SPACE_NAME = generateUUID();
const SPACE_1_NAME = generateUUID();

let args: { [key: string]: any } = (process.argv.slice(2));
let stackname = args["stackname"] || "api-staging-latest.highfidelity.com";
let stackURL = `https://${stackname}`;
let websocketEndpointURL = `wss://${stackname}/dev/account:8001/`;
let space1id: string;
let spaceWithDuplicateNameID: string;

describe('Non admin server connections', () => {
    let admin: string;
    let nonadmin: string;
    let nonadminUnsigned: string;
    let nonadminNonexistentSpaceID: string;
    let nonadminNewSpaceName: string;
    let nonadminTimed: string;
    let nonadminExpired: string;
    let nonadminDupSpaceName: string;
    let hifiCommunicator: HiFiCommunicator;
    beforeAll(async () => {
        try {
            let adminTokenNoSpace = await generateJWT(TOKEN_GEN_TYPES.ADMIN_ID_APP2);
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}&name=${SPACE_1_NAME}`);
            let returnMessageJSON = await returnMessage.json();
            space1id = returnMessageJSON['space-id'];

            // create a space with a duplicate name
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}&name=${SPACE_1_NAME}`);
            returnMessageJSON = await returnMessage.json();
            spaceWithDuplicateNameID = returnMessageJSON['space-id'];

            admin = await generateJWT(TOKEN_GEN_TYPES.ADMIN_ID_APP2, space1id);
            nonadmin = await generateJWT(TOKEN_GEN_TYPES.NONADMIN_ID_APP2, space1id);
            nonadminUnsigned = await generateJWT(TOKEN_GEN_TYPES.NONADMIN_ID_APP2_UNSIGNED, space1id);
            nonadminNonexistentSpaceID = await generateJWT(TOKEN_GEN_TYPES.NONADMIN_ID_APP2, generateUUID());
            nonadminNewSpaceName = await generateJWT(TOKEN_GEN_TYPES.NONADMIN_ID_APP2, null, NEW_SPACE_NAME);
            nonadminTimed = await generateJWT(TOKEN_GEN_TYPES.NONADMIN_APP2_TIMED, space1id);
            nonadminExpired = await generateJWT(TOKEN_GEN_TYPES.NONADMIN_APP2_TIMED_EXPIRED, space1id);
            nonadminDupSpaceName = await generateJWT(TOKEN_GEN_TYPES.NONADMIN_APP2_DUP, null, SPACE_1_NAME);
        } catch (err) {
            console.error("Unable to create tokens in preparation for testing server connections. Please check " +
                "your 'auth.json' file for errors or discrepancies with your account data. ERR: ", err);
            throw err;
        }
    });

    beforeEach(() => {
        hifiCommunicator = new HiFiCommunicator();
    });

    afterEach(async () => {
        await hifiCommunicator.disconnectFromHiFiAudioAPIServer();
    });

    afterAll(async () => {
        try {
            await fetch(`${stackURL}/api/v1/spaces/${space1id}?token=${admin}`, {
                method: 'DELETE'
            });

            await fetch(`${stackURL}/api/v1/spaces/${spaceWithDuplicateNameID}?token=${admin}`, {
                method: 'DELETE'
            });
        } catch (err) {
            console.error("Unable to clean up after tests by deleting created space. ERR: ", err);
            throw err;
        }
    });

    // TODO add checks for correct stack connections once those fetch calls are possible (Jira 435)

    test(`CAN connect to Space A on staging with signed token containing Space ID A`, async () => {
        await hifiCommunicator.connectToHiFiAudioAPIServer(nonadmin, stackURL)
            .then(data => {
                expect(data.audionetInitResponse.success).toBe(true);
            });
    });

    test(`CAN connect to Space A on staging with UNSIGNED token containing Space ID A when space does not require signing`, async () => {
        // set space to allow unsigned tokens
        try {
            await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${admin}&ignore-token-signing=true`);
        } catch (err) {
            console.error("Unable to set space to ignore token signing. ERR: ", err);
            throw err;
        }

        await hifiCommunicator.connectToHiFiAudioAPIServer(nonadminUnsigned, stackURL)
            .then(data => { expect(data.audionetInitResponse.success).toBe(true) });
    });

    test(`CANNOT connect to Space A on staging with UNSIGNED token containing Space ID A when space does require signing`, async () => {
        // set space to not allow unsigned tokens
        try {
            await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${admin}&ignore-token-signing=false`);
        } catch (err) {
            console.error("Unable to set space to ignore token signing. ERR: ", err);
            throw err;
        }

        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonadminUnsigned, stackURL))
            .rejects.toMatchObject({ error: expect.stringMatching(/Unexpected server response: 501/) });
    });

    test(`CAN connect to Space A on staging with signed token containing Space ID A when space does not require signing`, async () => {
        // set space to not allow unsigned tokens
        try {
            await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${admin}&ignore-token-signing=false`);
        } catch (err) {
            console.error("Unable to set space to ignore token signing. ERR: ", err);
            throw err;
        }

        await hifiCommunicator.connectToHiFiAudioAPIServer(nonadmin, stackURL)
            .then(data => { expect(data.audionetInitResponse.success).toBe(true) });
    });

    test(`Attempting to connect without specifying a stack will target api.highfidelity.com`, async () => {
        if (stackname.indexOf("staging") > -1) { // testing staging
            await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonadmin))
                .rejects.toMatchObject({ error: expect.stringMatching(/api.highfidelity.com/) });
        } else if (stackname.indexOf("alpha") > -1) { // testing prod
            await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonadmin))
                .resolves.toMatchObject({ audionetInitResponse: expect.objectContaining({ "success": true}) });
        }
    });

    test(`Attempting to connect when specifying a WSS stack URL will target the specified stack`, async () => {
        await hifiCommunicator.connectToHiFiAudioAPIServer(nonadmin, websocketEndpointURL + "?token=")
            .then(data => { expect(data.audionetInitResponse.success).toBe(true) });
    });

    test(`CANNOT connect to a space on staging that doesn’t exist (i.e. token contains an invalid space ID)`, async () => {
        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonadminNonexistentSpaceID, stackURL))
            .rejects.toMatchObject({ error: expect.stringMatching(/Unexpected server response: 501/) });
    });

    test(`CAN create a space by trying to connect with SIGNED token with nonexistent space NAME and no space ID and correct stack URL`, async () => {
        await hifiCommunicator.connectToHiFiAudioAPIServer(nonadminNewSpaceName, stackURL)
            .then(data => {
                expect(data.audionetInitResponse.success).toBe(true);
            });

        // confirm that space was created and get ID for deletion
        let createdSpaceID: string;
        try {
            let spaceWasCreated = false;
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/?token=${admin}`);
            let spacesListJSON: any = {};
            spacesListJSON = await returnMessage.json();
            spacesListJSON.forEach((space: any) => {
                if (space['name'] === NEW_SPACE_NAME) {
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
            await fetch(`${stackURL}/api/v1/spaces/${createdSpaceID}?token=${admin}`, {
                method: 'DELETE'
            });
        } catch (err) {
            console.error(`Unable to delete the space with ID ${createdSpaceID} that was created for testing. Please do this manually. ERR: ${err}`);
            throw err;
        }
    });

    test(`CANNOT connect to a space BY NAME when multiple spaces with the same name exist in the same app`, async () => {
        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonadminDupSpaceName, stackURL))
            .rejects.toMatchObject({
                error: expect.stringMatching(/Unexpected server response: 501/)
            });
    });

    test(`CAN connect to a space using a timed token before the token expires`, async () => {
        await hifiCommunicator.connectToHiFiAudioAPIServer(nonadminTimed, stackURL)
            .then(data => { expect(data.audionetInitResponse.success).toBe(true) });
    });

    test(`CANNOT connect to a space using a timed token after the token expires`, async () => {
        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonadminExpired, stackURL))
            .rejects.toMatchObject({ error: expect.stringMatching(/Unexpected server response: 501/) });
    });

    test(`CAN disconnect once connected`, async () => {
        // make sure we're connected first
        try {
            await hifiCommunicator.connectToHiFiAudioAPIServer(nonadmin, stackURL)
        } catch (err) {
            console.error("Unable to connect before testing disconnect. ERR: ", err);
            throw err;
        }
        await hifiCommunicator.disconnectFromHiFiAudioAPIServer()
            .then((data) => { expect(data).toBe('Successfully disconnected.') });
    });
});
