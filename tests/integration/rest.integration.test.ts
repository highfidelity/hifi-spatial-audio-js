export {};
const fetch = require('node-fetch');
import { TOKEN_GEN_TYPES, TOKEN_GEN_DATA, generateJWT } from './testUtilities/integrationTestUtils';

describe('HiFi API REST Calls', () => {
	let token: string;

    beforeAll(async () => {
        try {
            token = await generateJWT(TOKEN_GEN_TYPES.ADMIN_ID_APP1_SPACE1_SIGNED);
        } catch (err) {
            console.error("Unable to create non admin token for testing REST calls. ERR: ", err);
            return;
        }
    });
    
	describe('Admin can create and delete a space', () => {
		let newSpaceName = "newSpace";
		let createdSpaceJSON: {[k: string]: any} = {};
		  test(`Create a space`, async () => {
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/create?token=${token}&name=${newSpaceName}`);
			createdSpaceJSON = await returnMessage.json();
			expect(createdSpaceJSON['space-id']).toBeDefined();
			expect(createdSpaceJSON['app-id']).toBe(TOKEN_GEN_DATA.APP_ID1);
		  });

		  test(`Delete a space`, async () => {
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${createdSpaceJSON['space-id']}?token=${token}`,{
				method: 'DELETE'
			});
			let deletedSpaceJSON: {[k: string]: any} = {};
			deletedSpaceJSON = await returnMessage.json();
			expect(deletedSpaceJSON['space-id']).toBe(createdSpaceJSON['space-id']);
			expect(deletedSpaceJSON['app-id']).toBe(TOKEN_GEN_DATA.APP_ID1);
		});
	});

	describe(`Admin can read settings for a space`, () => {
		test(`Read all space settings simultaneously`, async () => {
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings?token=${token}`);

			let settingsJSON: {[k: string]: any} = {};
			settingsJSON = await returnMessage.json();
			expect(settingsJSON['app-id']).toBeDefined();
			expect(settingsJSON['space-id']).toBeDefined();
			expect(settingsJSON['ignore-token-signing']).toBeDefined();
			expect(settingsJSON['name']).toBeDefined();
			expect(settingsJSON['new-connections-allowed']).toBeDefined();
		});

		test(`Read the 'space-id' setting`, async () => {
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings/space-id/?token=${token}`);

			let settingsJSON: {[k: string]: any} = {};
			settingsJSON = await returnMessage.json();
			expect(settingsJSON['space-id']).toBeDefined();
		});

		test(`Read the 'app-id' setting`, async () => {
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings/app-id/?token=${token}`);

			let settingsJSON: {[k: string]: any} = {};
			settingsJSON = await returnMessage.json();
			expect(settingsJSON['app-id']).toBeDefined();
		});

		test(`Read the 'ignore-token-signing' setting`, async () => {
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings/ignore-token-signing/?token=${token}`);

			let settingsJSON: {[k: string]: any} = {};
			settingsJSON = await returnMessage.json();
			expect(settingsJSON['ignore-token-signing']).toBeDefined();
		});

		test(`Read the 'name' setting`, async () => {
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings/name/?token=${token}`);

			let settingsJSON: {[k: string]: any} = {};
			settingsJSON = await returnMessage.json();
			expect(settingsJSON['name']).toBeDefined();
		});

		test(`Read the 'new-connections-allowed' setting`, async () => {
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings/new-connections-allowed/?token=${token}`);

			let settingsJSON: {[k: string]: any} = {};
			settingsJSON = await returnMessage.json();
			expect(settingsJSON['new-connections-allowed']).toBeDefined();
		});
	});

	describe('Admin can change space settings', () => {
		test(`Admin can change multiple settings simultaneously using 'GET'`, async () => {
			let newName = "nameChanged";
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings?token=${token}&new-connections-allowed=false&name=${newName}`);
	
			let settingsJSON: {[k: string]: any} = {};
			settingsJSON = await returnMessage.json();

			expect(settingsJSON['new-connections-allowed']).toBe(false);
			expect(settingsJSON['name']).toBe(newName);
		});

		test(`Admin can change multiple settings simultaneously using 'POST'`, async () => {
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings?token=${token}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					'name': TOKEN_GEN_DATA.SPACE1_NAME_APP1,
					'new-connections-allowed': true
				})
			});
	
			let settingsJSON: {[k: string]: any} = {};
			settingsJSON = await returnMessage.json();

			expect(settingsJSON['new-connections-allowed']).toBe(true);
			expect(settingsJSON['name']).toBe(TOKEN_GEN_DATA.SPACE1_NAME_APP1);
		});

		test(`Admin can make a space not joinable`, async () => {
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings?token=${token}&new-connections-allowed=false`);
	
			let settingsJSON: {[k: string]: any} = {};
			settingsJSON = await returnMessage.json();

			expect(settingsJSON['new-connections-allowed']).toBe(false);

		});

		test(`Admin can make a space joinable`, async () => {
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings?token=${token}&new-connections-allowed=true`);
	
			let settingsJSON: {[k: string]: any} = {};
			settingsJSON = await returnMessage.json();

			expect(settingsJSON['new-connections-allowed']).toBe(true);
		});

		test(`Admin can change the space name`, async () => {
			let newName = "changed name";
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings?token=${token}&name=${newName}`);
	
			let settingsJSON: {[k: string]: any} = {};
			settingsJSON = await returnMessage.json();

			expect(settingsJSON['name']).toBe(newName);

			// restore name to default
			returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings?token=${token}&name=${TOKEN_GEN_DATA.SPACE1_NAME_APP1}`);
		});

		test(`Admin can set space to ignore token signing`, async () => {
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings?token=${token}&ignore-token-signing=true`);
	
			let settingsJSON: {[k: string]: any} = {};
			settingsJSON = await returnMessage.json();
			expect(settingsJSON['ignore-token-signing']).toBe(true);
		});

		test(`Admin can set space to not ignore token signing`, async () => {
			let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/${TOKEN_GEN_DATA.SPACE1_ID_APP1}/settings?token=${token}&ignore-token-signing=false`);
	
			let settingsJSON: {[k: string]: any} = {};
			settingsJSON = await returnMessage.json();
			expect(settingsJSON['ignore-token-signing']).toBe(false);
		});
	});
});