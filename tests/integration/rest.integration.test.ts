export {};
const fetch = require('node-fetch');
const secrets = require('./secrets/auth.json');

describe('HiFi API REST Calls', () => {
    let token = secrets.app.jwt.jwt;
    let spaceName = "QA_SPACE";

  test(`Admin can create and delete a space`, async () => {
    let returnMessage = await fetch(`https://api-staging.highfidelity.com/api/v1/spaces/create?token=${token}&name=${spaceName}`);

    let spaceJSON: {[k: string]: any} = {};
    spaceJSON = await returnMessage.json();
    expect(spaceJSON['space-id']).toBeDefined();
    expect(spaceJSON['app-id']).toBe(secrets.app.id);
  });
});