import { HiFiCommunicator, HiFiConnectionStates } from "../../src/classes/HiFiCommunicator";

export class TestUser {
    name: string;
    connectionState: HiFiConnectionStates;
    communicator: HiFiCommunicator;

    constructor(name: string) {
        this.name = name;
        this.connectionState = HiFiConnectionStates.Disconnected;
        this.communicator = new HiFiCommunicator({ onConnectionStateChanged: this.onConnectionStateChanged.bind(this) });
    }

    onConnectionStateChanged(connectionState: HiFiConnectionStates) {
        this.connectionState = connectionState;
    }
}