/**
 * This module pertains to User Data Subscriptions, which allow clients to receive updates from the Server about all new User Data.
 * See [[addUserDataSubscription]].
 * @packageDocumentation
 */

/**
 * When adding a new User Data Subscription, a client must specify one of the "components" listed as a part of this `enum`.
 * For example, subscribing to `Position` updates ensures that a Subscriber will receive all changes to that user's position.
 */
export enum AvailableUserDataSubscriptionComponents {
    Position = "Position",
    OrientationEuler = "Orientation (Euler)",
    OrientationQuat = "Orientation (Quaternion)",
    VolumeDecibels = "Volume (Decibels)",
    HiFiGain = "HiFiGain",
    IsStereo = "IsStereo"
}

/**
 * User Data Subscriptions allow client API users to perform actions, such as logging, when the client
 * receives new User Data from the High Fidelity Audio API Server.
 */
export class UserDataSubscription {
    /**
     * The user's `providedUserID` associated with the Subscription. See {@link HiFiAudioAPIData}. Optional. If unset, the Subscription callback
     * will be called for all users' data when it changes.
     */
    providedUserID: string;
    /**
     * The User Data components to which we want to subscribe, such as Position, OrientationEuler, or VolumeDecibels.
     */
    components: Array<AvailableUserDataSubscriptionComponents>;
    /**
     * The callback function to call when the client receives new User Data associated with the `component` from the server.
     * The first and only argument to the callback function will be of type `Array<ReceivedHiFiAudioAPIData>`.
     */
    callback: Function;
    
    constructor({ providedUserID = null, components, callback }: { providedUserID?: string, components: Array<AvailableUserDataSubscriptionComponents>, callback: Function }) {
        this.providedUserID = providedUserID;
        this.components = components;
        this.callback = callback;
    }
}