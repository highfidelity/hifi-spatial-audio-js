const fetch = require('node-fetch');
const healthCheckStacks = require('../secrets/auth.json').healthCheckTokens;

import { HiFiCommunicator } from "../../src/classes/HiFiCommunicator";
import { AvailableUserDataSubscriptionComponents, UserDataSubscription } from "../../src/classes/HiFiUserDataSubscription";
import { generateJWT, sleep, UserData } from '../testUtilities/testUtils';

let args = require('minimist')(process.argv.slice(2));
let stackname = args.stackname || process.env.hostname || "api-staging-latest.highfidelity.com";
console.log("_______________STACKNAME_______________________", stackname);
let stackURL = `https://${stackname}`;

let stackData: { appID: any; appSecret: any; };
if (stackname === "api-staging.highfidelity.com" || stackname === "api-staging-latest.highfidelity.com") {
    stackData = healthCheckStacks.staging;
    console.log("_______________USING STAGING AUTH STACK DATA_______________________");
} else if (stackname === "api-pro.highfidelity.com" || stackname === "api-pro-latest.highfidelity.com") {
    stackData = healthCheckStacks.pro;
    console.log("_______________USING PRO AUTH STACK DATA_______________________");
} else if (stackname === "api-pro-east.highfidelity.com" || stackname === "api-pro-latest-east.highfidelity.com") {
    stackData = healthCheckStacks.east;
    console.log("_______________USING EAST AUTH STACK DATA_______________________");
} else if (stackname === "api-pro-eu.highfidelity.com" || stackname === "api-pro-latest-eu.highfidelity.com") {
    stackData = healthCheckStacks['api-pro-eu.highfidelity.com'];
    console.log("_______________USING EU AUTH STACK DATA_______________________");
} else if (stackname === "api.highfidelity.com" || stackname === "api-hobby-latest.highfidelity.com") {
    stackData = healthCheckStacks.hobby;
    console.log("_______________USING HOBBY AUTH STACK DATA_______________________");
} else {
    stackData = healthCheckStacks[stackname];
    console.log(`_______________USING ${stackname} AUTH STACK DATA_______________________`);
}

let tokenIndex = Math.floor(new Date().getMinutes() / 10);
const DEFAULT_TOKEN_DATA = {
    "signed": true,
    "app_id": stackData.appID,
    "app_secret": stackData.appSecret,
    "space_name": (tokenIndex + 1).toString(),
    "user_id": ""
};
let userATokenData = Object.assign(DEFAULT_TOKEN_DATA, {"user_id": "A"});
let userBTokenData = Object.assign(DEFAULT_TOKEN_DATA, {"user_id": "B"});

let tokenA: string;
let tokenB: string;
let usersDataArray: UserData[] = [];
function onUserDataReceived<K extends keyof UserData>(receivedHiFiAudioAPIDataArray: UserData[]) {
    receivedHiFiAudioAPIDataArray.forEach((receivedUserData: UserData) => {
        if (usersDataArray.length < 1) {
            usersDataArray.push(receivedUserData);
            return;
        }
        let newUser = true;
        usersDataArray.forEach((userData: UserData) => {
            if (userData.hashedVisitID === receivedUserData.hashedVisitID) {
                newUser = false;
                for (let key in receivedUserData) {
                    if (userData[key as K] !== (receivedUserData[key as K])) {
                        userData[key as K] = (receivedUserData[key as K]);
                    }
                }
            }
        });
        if (newUser) {
            usersDataArray.push(receivedUserData);
        }
    });
}

describe("API Health", () => {
    beforeAll(async () => {
        jest.setTimeout(10000);
        tokenA = await generateJWT(userATokenData);
        tokenB = await generateJWT(userBTokenData);
    });

    test("Users can connect and get peer data", async () => {
        let userA = new HiFiCommunicator(),
            userB = new HiFiCommunicator();
        await userA.connectToHiFiAudioAPIServer(tokenA, stackURL)
            .then(data => {
                expect(data.audionetInitResponse.success).toBe(true);
            });

        let userDataSubscription = new UserDataSubscription({
            "components": [AvailableUserDataSubscriptionComponents.VolumeDecibels],
            "callback": onUserDataReceived
        });
        userA.addUserDataSubscription(userDataSubscription);

        await userB.connectToHiFiAudioAPIServer(tokenB, stackURL)
            .then(data => {
                expect(data.audionetInitResponse.success).toBe(true);
            });

        await sleep(1000);

        expect(usersDataArray.filter(e => e.providedUserID === userBTokenData.user_id).length > 0);
    });
});
