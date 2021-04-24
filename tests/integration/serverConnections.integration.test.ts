const fetch = require('node-fetch');
const stacks = require('../secrets/auth.json').stacks;

import { HiFiCommunicator } from "../../src/classes/HiFiCommunicator";
import { tokenTypes, generateJWT, generateUUID, setStackData, sleep } from '../testUtilities/testUtils';

const NEW_SPACE_NAME = generateUUID();
const SPACE_1_NAME = generateUUID();

let args = require('minimist')(process.argv.slice(2));
let stackname = args.stackname || process.env.hostname || "api-staging-latest";
console.log("_______________STACKNAME_______________________", stackname);
let stackURL = `https://${stackname}`;
let websocketEndpointURL = `wss://${stackname}/dev/account:8001/`;
let space1id: string;
let spaceWithDuplicateNameID: string;

describe('Non admin server connections', () => {
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
            let adminTokenNoSpace = await generateJWT(tokenTypes.ADMIN_ID_APP2);
            let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}&name=${SPACE_1_NAME}`);
            let returnMessageJSON = await returnMessage.json();
            space1id = returnMessageJSON['space-id'];

            // create a space with a duplicate name
            returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}&name=${SPACE_1_NAME}`);
            returnMessageJSON = await returnMessage.json();
            spaceWithDuplicateNameID = returnMessageJSON['space-id'];

            admin = await generateJWT(tokenTypes.ADMIN_ID_APP2, space1id);
            nonadmin = await generateJWT(tokenTypes.NONADMIN_ID_APP2, space1id);
            nonadminUnsigned = await generateJWT(tokenTypes.NONADMIN_ID_APP2_UNSIGNED, space1id);
            nonadminNonexistentSpaceID = await generateJWT(tokenTypes.NONADMIN_ID_APP2, generateUUID());
            nonadminNewSpaceName = await generateJWT(tokenTypes.NONADMIN_ID_APP2, null, NEW_SPACE_NAME);
            nonadminTimed = await generateJWT(tokenTypes.NONADMIN_APP2_TIMED, space1id);
            nonadminExpired = await generateJWT(tokenTypes.NONADMIN_APP2_TIMED_EXPIRED, space1id);
            nonadminDupSpaceName = await generateJWT(tokenTypes.NONADMIN_APP2_DUP, null, SPACE_1_NAME);
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

    // TEST THIS FIRST to ensure nonadmin is not already connected
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

        // confirm user is not connected
        let usersListMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/users?token=${admin}`);
        let usersListJSON = await usersListMessage.json();
        let connectionConfirmed = false;
        usersListJSON.forEach((userData: any = {}) => {
            if (userData['jwt-user-id'] === tokenTypes.NONADMIN_ID_APP2_UNSIGNED.user_id) {
                connectionConfirmed = true;
            }
        });
        expect(connectionConfirmed).toBeFalsy();
    });

    // TEST THIS NEXT to ensure admin is not already connected
    test(`CANNOT connect to a space using a timed token after the token expires`, async () => {
        await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonadminExpired, stackURL))
            .rejects.toMatchObject({ error: expect.stringMatching(/Unexpected server response: 501/) });

        // confirm user is not connected
        let usersListMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/users?token=${admin}`);
        let usersListJSON = await usersListMessage.json();
        let connectionConfirmed = false;
        usersListJSON.forEach((userData: any = {}) => {
            if (userData['jwt-user-id'] === tokenTypes.NONADMIN_ID_APP2_UNSIGNED.user_id) {
                connectionConfirmed = true;
            }
        });
        expect(connectionConfirmed).toBeFalsy();
    });

    test(`CAN connect to Space A on staging with signed token containing Space ID A`, async () => {
        let visitIDHash: string;
        await hifiCommunicator.connectToHiFiAudioAPIServer(nonadmin, stackURL)
            .then(data => {
                expect(data.audionetInitResponse.success).toBe(true);
                visitIDHash = data.audionetInitResponse.visit_id_hash;
            });

        // confirm the connection to the correct space
        let usersListMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/users?token=${admin}`);
        let usersListJSON = await usersListMessage.json();
        let connectionConfirmed = false;
        usersListJSON.forEach((userData: any = {}) => {
            if (userData['visit-id-hash'] === visitIDHash) {
                connectionConfirmed = true;
            }
        });
        expect(connectionConfirmed).toBeTruthy();
    });

    test(`CAN connect to Space A on staging with UNSIGNED token containing Space ID A when space does not require signing`, async () => {
        let visitIDHash: string;
        // set space to allow unsigned tokens
        try {
            await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${admin}&ignore-token-signing=true`);
        } catch (err) {
            console.error("Unable to set space to ignore token signing. ERR: ", err);
            throw err;
        }

        await hifiCommunicator.connectToHiFiAudioAPIServer(nonadminUnsigned, stackURL)
            .then(data => {
                expect(data.audionetInitResponse.success).toBe(true);
                visitIDHash = data.audionetInitResponse.visit_id_hash;
            });

        // confirm the connection to the correct space
        let usersListMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/users?token=${admin}`);
        let usersListJSON = await usersListMessage.json();
        let connectionConfirmed = false;
        usersListJSON.forEach((userData: any = {}) => {
            if (userData['visit-id-hash'] === visitIDHash) {
                connectionConfirmed = true;
            }
        });
        expect(connectionConfirmed).toBeTruthy();
    });

    test(`CAN connect to Space A on staging with signed token containing Space ID A when space does not require signing`, async () => {
        let visitIDHash: string;
        // set space to not allow unsigned tokens
        try {
            await fetch(`${stackURL}/api/v1/spaces/${space1id}/settings?token=${admin}&ignore-token-signing=false`);
        } catch (err) {
            console.error("Unable to set space to ignore token signing. ERR: ", err);
            throw err;
        }

        await hifiCommunicator.connectToHiFiAudioAPIServer(nonadmin, stackURL)
            .then(data => {
                expect(data.audionetInitResponse.success).toBe(true);
                visitIDHash = data.audionetInitResponse.visit_id_hash;
            });

        // confirm the connection to the correct space
        let usersListMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/users?token=${admin}`);
        let usersListJSON = await usersListMessage.json();
        let connectionConfirmed = false;
        usersListJSON.forEach((userData: any = {}) => {
            if (userData['visit-id-hash'] === visitIDHash) {
                connectionConfirmed = true;
            }
        });
        expect(connectionConfirmed).toBeTruthy();
    });

    test(`Attempting to connect without specifying a stack will target api.highfidelity.com`, async () => {
        if (stackname.indexOf("staging") > -1) { // testing staging
            await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonadmin))
                .rejects.toMatchObject({ error: expect.stringMatching(/api.highfidelity.com/) });
        } else if (stackname.indexOf("alpha") > -1) { // testing prod
            await expect(hifiCommunicator.connectToHiFiAudioAPIServer(nonadmin))
                .resolves.toMatchObject({ audionetInitResponse: expect.objectContaining({ "success": true }) });
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

    test(`CAN create and connect to a space by trying to connect with SIGNED token with nonexistent space NAME and no space ID and correct stack URL`, async () => {
        let visitIDHash: string;
        await hifiCommunicator.connectToHiFiAudioAPIServer(nonadminNewSpaceName, stackURL)
            .then(data => {
                expect(data.audionetInitResponse.success).toBe(true);
                visitIDHash = data.audionetInitResponse.visit_id_hash;
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

        // confirm the connection to the correct space
        let usersListMessage = await fetch(`${stackURL}/api/v1/spaces/${createdSpaceID}/users?token=${admin}`);
        let usersListJSON = await usersListMessage.json();
        let connectionConfirmed = false;
        usersListJSON.forEach((userData: any = {}) => {
            if (userData['visit-id-hash'] === visitIDHash) {
                connectionConfirmed = true;
            }
        });
        expect(connectionConfirmed).toBeTruthy();

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
        let visitIDHash: string;
        await hifiCommunicator.connectToHiFiAudioAPIServer(nonadminTimed, stackURL)
            .then(data => {
                expect(data.audionetInitResponse.success).toBe(true);
                visitIDHash = data.audionetInitResponse.visit_id_hash;
            });

        // confirm the connection to the correct space
        let usersListMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/users?token=${admin}`);
        let usersListJSON = await usersListMessage.json();
        let connectionConfirmed = false;
        usersListJSON.forEach((userData: any = {}) => {
            if (userData['visit-id-hash'] === visitIDHash) {
                connectionConfirmed = true;
            }
        });
        expect(connectionConfirmed).toBeTruthy();
    });

    test(`CAN disconnect once connected`, async () => {
        jest.setTimeout(60000);
        let visitIDHash: string;
        // make sure we're connected first
        try {
            await hifiCommunicator.connectToHiFiAudioAPIServer(nonadmin, stackURL)
                .then(data => {
                    visitIDHash = data.audionetInitResponse.visit_id_hash;
                });
        } catch (err) {
            console.error("Unable to connect before testing disconnect. ERR: ", err);
            throw err;
        }

        await hifiCommunicator.disconnectFromHiFiAudioAPIServer()
            .then((data) => { expect(data).toBe('Successfully disconnected.') });

        // confirm the disconnection
        await sleep(50000);
        let usersListMessage = await fetch(`${stackURL}/api/v1/spaces/${space1id}/users?token=${admin}`);
        let usersListJSON = await usersListMessage.json();
        let connectionConfirmed = false;
        usersListJSON.forEach((userData: any = {}) => {
            if (userData['visit-id-hash'] === visitIDHash) {
                connectionConfirmed = true;
            }
        });
        expect(connectionConfirmed).toBeFalsy();
        jest.setTimeout(5000);
    });
});
