const fetch = require('node-fetch');
import { TOKEN_GEN_TYPES, generateJWT } from '../testUtilities/integrationTestUtils';
const stackData = require('./secrets/auth.json').stackData;
const stackURL = 'https://' + stackData.url;

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
});