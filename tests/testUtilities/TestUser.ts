import { HiFiCommunicator, HiFiConnectionStates } from "../../src/classes/HiFiCommunicator";

export type MuteState = "MUTED_FIXED" | "MUTED_NOT_FIXED" | "UNMUTED";

export class TestUser {
    name: string;
    connectionState: HiFiConnectionStates;
    muteState: MuteState;
    communicator: HiFiCommunicator;

    constructor(name: string) {
        this.name = name;
        this.connectionState = HiFiConnectionStates.Disconnected;
        this.muteState = "UNMUTED";
        this.communicator = new HiFiCommunicator({
            onConnectionStateChanged: this.onConnectionStateChanged.bind(this),
            onMuteChanged: this.onMuteChanged.bind(this),
        });
    }

    onConnectionStateChanged(connectionState: HiFiConnectionStates) {
        this.connectionState = connectionState;
    }

    onMuteChanged(data: any) {
        if (data.currentInputAudioMutedValue === true) {
            this.muteState = data.adminPreventsInputAudioUnmuting ? "MUTED_FIXED" : "MUTED_NOT_FIXED";
        } else {
            this.muteState = "UNMUTED";
        }
    }
}