const { JSDOM } = require('jsdom');

const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
const { window } = jsdom;

global.window = window;
global.document = window.document;
global.self = window;

require('fast-text-encoding');
require('wrtc');
const stacks = require('../secrets/auth.json').stacks;
const RTCAudioSourceSineWave = require('../testUtilities/rtcAudioSourceSineWave');

import { tokenTypes, generateJWT, setStackData, UserData, sleep } from '../testUtilities/testUtils';
import { HiFiCommunicator } from "../../src/classes/HiFiCommunicator";
import { UserDataSubscription, AvailableUserDataSubscriptionComponents } from '../../src/classes/HiFiUserDataSubscription';
import { HiFiAudioAPIData, Point3D } from '../../src/classes/HiFiAudioAPIData';
import {components, pipelines} from 'media-stream-library';

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
    } else if (stackname === "api.highfidelity.com" || stackname === "api-hobby-latest.highfidelity.com") {
        stackData = stacks.hobby;
        console.log("_______________USING HOBBY AUTH FILE_______________________");
    } else {
        stackData = stacks[stackname];
        console.log(`_______________USING ${stackname} AUTH FILE_______________________`);
    }
    setStackData(stackData);

    beforeAll(async () => {
        // adminTokenNoSpace = await generateJWT(tokenTypes.ADMIN_ID_APP1);
    });

    describe(`Users can hear peers at a comfortable volume when the peer is not muted`, () => {
        let spaceID: string;
        let adminToken: string;
        let nonadminToken: string;
        let user1: HiFiCommunicator;
        let user2: HiFiCommunicator;
        let user1HashedVisitID: string;
        let usersDataArray: UserData[] = [];
        let numberOfChannels: number;
        let convertedAudioBuffer: any;
        let currentAudioData: any;
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
            jest.setTimeout(60000);
            try {
                // let returnMessage = await fetch(`${stackURL}/api/v1/spaces/create?token=${adminTokenNoSpace}`);
                // let returnMessageJSON: any = {};
                // returnMessageJSON = await returnMessage.json();
                // spaceID = returnMessageJSON['space-id'];
                spaceID = '6dd58f24-40cf-4c72-a46a-f4d58fb5de08';
                // adminToken = await generateJWT(tokenTypes.ADMIN_ID_APP1, spaceID);
                // nonadminToken = await generateJWT(tokenTypes.NONADMIN_ID_APP1, spaceID);
                nonadminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHBfaWQiOiJjMzBjZWQ2Yi0xODU1LTQ0OTYtYjRjNS02MzE3ZTZkNThmOTEiLCJ1c2VyX2lkIjoiYSIsInNwYWNlX2lkIjoiNmRkNThmMjQtNDBjZi00YzcyLWE0NmEtZjRkNThmYjVkZTA4Iiwic3RhY2siOiJhdWRpb25ldC1taXhlci1hcGktc3RhZ2luZy0xOCJ9.ZuJ8ozVfBUe1MxNMbKecL6w5_3VMrSpoP9KI4A2_bhE';
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
            user1.addUserDataSubscription(userDataSubscription);

            let source = new RTCAudioSourceSineWave();
            let track = source.createTrack();
            inputAudioMediaStream = new MediaStream([track]);
        });

        afterAll(async () => {
            // await fetch(`${stackURL}/api/v1/spaces/${spaceID}?token=${adminToken}`, {
            //     method: 'DELETE'
            // });
        });

        test(`Nonadmin users can set input stream, get output stream, mute/unmute, and change peers' gain`, async () => {
            user1.setInputAudioMediaStream(inputAudioMediaStream);
            // setTimeout(() => {
            //     user1.setInputAudioMuted(true);
            // }, 1000);
            // setTimeout(() => {
            //     user1.setInputAudioMuted(false);
            // }, 2000);
            for (let i = 0; i < 50; i++) {
                await sleep(200);
                usersDataArray.forEach((userData) => {
                    if (userData.hashedVisitID === user1HashedVisitID) {
                        console.log("_______________________", userData.hashedVisitID, "      :      ", userData.volumeDecibels);
                    }
                })

                // console.log("____________________", user1Data);
                // console.log("____________________", userOtherData);
            }
        });
    });
});

function generateUUID() {
    throw new Error('Function not implemented.');
}
