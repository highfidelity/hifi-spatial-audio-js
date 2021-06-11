const fetch = require('node-fetch');
const stacks = require('../secrets/auth.json').stacks;
const { MediaStream } = require('wrtc');
const RTCAudioSourceSineWave = require('../testUtilities/rtcAudioSourceSineWave');

import { tokenTypes, generateJWT, setStackData, UserData, sleep } from '../testUtilities/testUtils';
import { HiFiCommunicator } from "../../src/classes/HiFiCommunicator";
import { UserDataSubscription, AvailableUserDataSubscriptionComponents } from '../../src/classes/HiFiUserDataSubscription';
import { HiFiAudioAPIData, Point3D } from '../../src/classes/HiFiAudioAPIData';

let args = require('minimist')(process.argv.slice(2));
let stackname = args.stackname || process.env.hostname || "api-staging-latest.highfidelity.com";
console.log("_______________STACKNAME_______________________", stackname);
let stackURL = `https://${stackname}`;
let adminTokenNoSpace: string;

describe('Audio', () => {
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
    } else if (stackname === "api-pro-eu.highfidelity.com" || stackname === "api-pro-latest-eu.highfidelity.com") {
        stackData = stacks['api-pro-eu.highfidelity.com'];
        console.log("_______________USING EU AUTH FILE_______________________");
    } else if (stackname === "api.highfidelity.com" || stackname === "api-hobby-latest.highfidelity.com") {
        stackData = stacks.hobby;
        console.log("_______________USING HOBBY AUTH FILE_______________________");
    } else {
        stackData = stacks[stackname];
        console.log(`_______________USING ${stackname} AUTH FILE_______________________`);
    }
    setStackData(stackData);

    beforeAll(async () => {
        adminTokenNoSpace = await generateJWT(tokenTypes.ADMIN_ID_APP1);
    });

    describe(`Users can hear peers at a comfortable volume when the peer is not muted`, () => {
        let spaceID: string;
        let adminToken: string;
        let nonadminToken: string;
        let user1: HiFiCommunicator;
        let user2: HiFiCommunicator;
        let user1HashedVisitID: string;
        let usersDataArray: UserData[] = [];
        let inputAudioMediaStream: MediaStream;

        function onUserDataReceived<K extends keyof UserData>(receivedHiFiAudioAPIDataArray: UserData[], ouputUsersArray: UserData[]) {
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

        // create the space
        beforeAll(async () => {
            jest.setTimeout(10000);
            try {
                let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}`);
                let returnMessageJSON: any = {};
                returnMessageJSON = await returnMessage.json();
                spaceID = returnMessageJSON['space-id']; // swap in your space ID to view bot testing
                adminToken = await generateJWT(tokenTypes.ADMIN_ID_APP1, spaceID);
                nonadminToken = await generateJWT(tokenTypes.NONADMIN_ID_APP1, spaceID); // swap in your token to view bot testing
            } catch (err) {
                console.error("Failed to create space before tests.");
            }

            // add 2 users, user1 plays sine wave audio and user2 has a user data subscription
            user1 = new HiFiCommunicator(); // at origin
            let initialAudioData = new HiFiAudioAPIData({ position: new Point3D({ x: 3 }) });
            user2 = new HiFiCommunicator({ initialHiFiAudioAPIData: initialAudioData }); // 3m away

            await user1.connectToHiFiAudioAPIServer(nonadminToken, stackURL)
                .then(data => {
                    user1HashedVisitID = data.audionetInitResponse.visit_id_hash;
                });

            await user2.connectToHiFiAudioAPIServer(nonadminToken, stackURL);

            let userDataSubscription = new UserDataSubscription({
                "components": [AvailableUserDataSubscriptionComponents.VolumeDecibels],
                "callback": onUserDataReceived
            });
            user2.addUserDataSubscription(userDataSubscription);

            let source = new RTCAudioSourceSineWave({ frequency: 300 });
            let track = source.createTrack();
            inputAudioMediaStream = new MediaStream([track]);
        });

        afterAll(async () => {
            await fetch(`${stackURL}/api/v1/spaces/${spaceID}?token=${adminToken}`, {
                method: 'DELETE'
            });
        });

        test(`Nonadmin users can set input stream, get output stream, mute/unmute, and change peers' gain`, async () => {
            // user 1 can set input audio, user 2 can hear user 1
            user1.setInputAudioMediaStream(inputAudioMediaStream);
            await sleep(1000);
            expect(usersDataArray[usersDataArray.findIndex((userData: UserData) => userData.hashedVisitID === user1HashedVisitID)].volumeDecibels).toBe(0);

            // user 1 can mute, user 2 stops hearing user 1
            await user1.setInputAudioMuted(true);
            await sleep(1000);
            // what is the right value here?
            expect(usersDataArray[usersDataArray.findIndex((userData: UserData) => userData.hashedVisitID === user1HashedVisitID)].volumeDecibels).toBeLessThan(-60);

            // user 1 can unmute, user 2 can hear user 1 again
            await user1.setInputAudioMuted(false);
            await sleep(1000);
            expect(usersDataArray[usersDataArray.findIndex((userData: UserData) => userData.hashedVisitID === user1HashedVisitID)].volumeDecibels).toBe(0);

            // user 2 can set gain for user 1
            user2.setOtherUserGainForThisConnection(user1HashedVisitID, 0.1)
                .then((data) => { expect(data.success).toBeTruthy });
            // comfirm once we have a way to do this
        });
    });
});
