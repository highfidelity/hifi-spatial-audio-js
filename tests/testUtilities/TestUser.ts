import { HiFiAudioAPIData, Point3D } from "../../src/classes/HiFiAudioAPIData";
import { HiFiCommunicator, HiFiConnectionStates } from "../../src/classes/HiFiCommunicator";

export class TestUser {
    name: string;
    connectionState: HiFiConnectionStates;
    communicator: HiFiCommunicator;

    constructor(name: string, xPosition: number) {
        this.name = name;
        this.connectionState = HiFiConnectionStates.Disconnected;
        let initialAudioData = new HiFiAudioAPIData({ position: new Point3D({ x: xPosition }) });
        this.communicator = new HiFiCommunicator({
            initialHiFiAudioAPIData: initialAudioData,
            onConnectionStateChanged: this.onConnectionStateChanged.bind(this),
            onMuteChanged: this.onMuteChanged.bind(this),
        });
    }

    onConnectionStateChanged(connectionState: HiFiConnectionStates) {
        console.log("______________________ connectionState __________", connectionState);
        this.connectionState = connectionState;
    }

    onMuteChanged(data:any) {
        console.log("______________________ User mute change: ", this.name, "__________State:", data);
    }
}