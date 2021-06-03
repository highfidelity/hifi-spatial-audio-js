import { RaviUtils } from "./RaviUtils";

/**
 * Enum for representing different possible states
 * that a RAVI signalingConnection might be in.
 *
 * "UNAVAILABLE" is a custom state that gets set
 * if the server is in a "running, but not currently
 * accepting incoming connections" state.
 * 
 * @readonly
 * @enum {string}
 */
export enum RaviSignalingStates {
  CONNECTING = "connecting",
  OPEN = "open",
  ERROR = "error",
  CLOSING = "closing",
  CLOSED = "closed",
  UNAVAILABLE = "unavailable"
};

/** 
 *
 * @class
 * @classdesc Signaling connection specifically for handling RAVI sessions.
 * This gets used by the RaviSession (and its PeerConnection implementation)
 * to set up a RaviSession connection.
 * This class should be instantiated by the RAVI consumer, and then used to open, work with, and close 
 * RAVI sessions as needed.
 *
 */
export class RaviSignalingConnection {
  /**
   * "Class" variables to be aware of:
   *
   * this._statechangeHandlers   // A list of handlers to call when the connection state changes
   * this._messageHandlers       // A list of handlers to call when a message is received
   *
   * this._signalingImplementation   // The implementation of signaling to use
   *
   * this._state                 // The current state of this connection
   *
   * _resolveOpen, _rejectOpen, _resolveClose, and _rejectClose: Used for resolving the Promises
   *     made by the open and close functions, which get handled outside of those functions themselves
   */
  _stateChangeHandlers: Set<Function>;
  _messageHandlers: Set<Function>;
  _state: RaviSignalingStates;
  _signalingImplementation: RaviSignalingWebSocketImplementation;

  _resolveOpen: Function; _rejectOpen: Function;
  _resolveClose: Function; _rejectClose: Function;
  
  /**
   * Create a new RaviSignalingConnection
   * Defaults the handlers
   * and initializes the state to RaviSignalingStates.CLOSED.
   *
   * @constructor
   */
  constructor() {
    RaviUtils.log("Constructor", "RaviSignalingConnection");
    
    // Initialize the list of handlers
    this._stateChangeHandlers = new Set();
    this._messageHandlers = new Set();
    
    // Initialize the state
    this._state = RaviSignalingStates.CLOSED;
    
    // If we wanted to use a different signaling implementation,
    // we would new() it here. (TODO: Make this configurable in some
    // interesting way. For now, it's enough just to make it easily 
    // swappable in the code here.)
    this._signalingImplementation = new RaviSignalingWebSocketImplementation(this);
    
  }

  /**
   * Get the current state of the signaling connection
   * 
   * @returns {RaviSignalingStates}
   */
  getState() {
    return this._state;
  }
  
  /**
   * Callback for listening to state changes
   * @callback RaviSignalingConnection~stateChangeCallback
   * @param {Object} event An object that will contain information
   * about the state change. This includes the "event.state" key,
   * which will have the appropriate value from the RaviSessionStates enum.
   */
  /**
   * Add a handler to the set of state change handlers.
   * All handlers in this set will be triggered with a copy of the event
   * any time the state of the signaling connection changes.
   * These are stored in a Set of Functions; therefore, a given function
   * can only exist once in this Set.
   *
   * @param {RaviSignalingConnection~stateChangeCallback} handler A callback handler that should handle a state change event
   * @returns {boolean} Whether or not the add succeeded
   */
  addStateChangeHandler(changeHandler: Function) {
    try {
      this._stateChangeHandlers.add(changeHandler);
      return true;
    } catch (err) {
      RaviUtils.err("Error adding a state change handler: " +
        err.message, "RaviSignalingConnection");
      return false;
    }
    return false;
  }

  /**
   * Remove a handler from the list of state change handlers.
   *
   * @param {RaviSignalingConnection~stateChangeCallback} handler A callback handler that has been handling a state change event
   * @returns {boolean} Whether or not the removal was successful (i.e. did not throw an error -- note that this does
   * NOT indicate whether or not the handler was in the set in the first place)
   */
  removeStateChangeHandler(changeHandler: Function) {
    try {
      const retval = this._stateChangeHandlers.delete(changeHandler);
      return true;
    } catch (err) {
      RaviUtils.err("Error removing a state change handler: " +
        err.message, "RaviSignalingConnection");
      return false;
    }
    return false;
  }

  /**
   * Callback for listening for messages
   * @callback RaviSignalingConnection~messageCallback
   * @param {string} message A message from the server
   */
  /**
   * Add a handler to the list of message received handlers.
   * All handlers in this list will be triggered with a copy of the 
   * incoming message any time a message is received.
   * These are stored in a Set of Functions; therefore, a given function
   * can only exist once in this Set.
   *
   * @param {RaviSignalingConnection~messageCallback} handler A callback handler that should handle a message received event
   * @returns {boolean} Whether or not the add succeeded
   */
  addMessageHandler(messageHandler: Function) {
    try {
      this._messageHandlers.add(messageHandler);
      return true;
    } catch (err) {
      RaviUtils.err("Error adding a message handler: " +
        err.message, "RaviSignalingConnection");
      return false;
    }
    return false;
  }

  /**
   * Remove a handler from the list of message received handlers.
   *
   * @param {RaviSignalingConnection~messageCallback} handler A callback handler that has been handling a message received event
   * @returns {boolean} Whether or not the removal was successful (i.e. did not throw an error -- note that this does
   * NOT indicate whether or not the handler was in the set in the first place)
   */
  removeMessageHandler(messageHandler: Function) {
    try {
      this._messageHandlers.delete(messageHandler);
      return true;
    } catch (err) {
      RaviUtils.err("Error removing a state change handler: " +
        err.message, "RaviSignalingConnection");
      return false;
    }
    return false;
  }

  /**
   * Open a signaling connection to a particular URL. Returns a Promise
   * that will resolve once the RaviSignalingConnection is connected.
   *
   * @param {string} URL The URL of the signaling server's endpoint (e.g. 'wss://foo.bar.baz:8889')
   * @returns {Promise}
   */
  openRAVISignalingConnection(URL: string) {
    var signalingConnection = this;
    if (this._state === RaviSignalingStates.OPEN) return Promise.resolve(
        "There is already an open WebSocket connection. To reconnect, first close the existing WebSocket and then attempt to open again."
    );

    return new Promise((resolve, reject) => {
      signalingConnection._resolveOpen = resolve;
      signalingConnection._rejectOpen = reject;
      // Start the "opening" process
      RaviUtils.log("Opening signaling connection to " + URL, "RaviSignalingController");
      let event = {"state":RaviSignalingStates.CONNECTING};
      this._handleStateChange(event, RaviSignalingStates.CONNECTING); 

      // And call the implementation's open method
      this._signalingImplementation._open(URL);
    });
  }
  
  /**
   * Send a message to the signaling server
   *
   * @param {string} message The message to send
   */
  send(message: string) {
    this._signalingImplementation._send(message);
  }
  
  /**
   * Close the signaling connection. Returns a Promise
   * that will resolve once the RaviSignalingConnection is closed.
   *
   * @returns {Promise}
   */
  closeRAVISignalingConnection() {
    var signalingConnection = this;
    if (this._state === RaviSignalingStates.CLOSED) return Promise.resolve(
        "Signaling connection is already closed."
    );

    return new Promise((resolve, reject) => {
      signalingConnection._resolveClose = resolve;
      signalingConnection._rejectClose = reject;
      // Start the "closing" process
      RaviUtils.log("Closing signaling connection", "RaviSignalingController");
      let event = {"state":RaviSignalingStates.CLOSING};
      this._handleStateChange(event, RaviSignalingStates.CLOSING); 

      // And call the implementation's open method
      this._signalingImplementation._close();
    });
  }

  /** Generic handlers */

  /**
   * @private
   */
  _handleStateChange(event: any = {}, state: RaviSignalingStates) {
    // Always try to fulfill any open promises, even if the state hasn't changed
    this._fulfillPromises(event, state);

    // But only call handlers if the state did, in fact, change
    if (state !== this._state) {
        this._state = state;
        event["state"] = state;
        RaviUtils.log("_handleStateChange: " + RaviUtils.safelyPrintable(event), "RaviSignalingConnection");
        this._stateChangeHandlers.forEach(function(handler) {
          if (handler) {
            handler(event);
          }
        });
    }
  }

  /**
   * @private
   * Gets called whenever the state changes (and sometimes when it doesn't,
   * but when we just want to make sure). Depending on the new (or current) state,
   * this will appropriately fulfill outstanding promises that are pending
   * in either the open or close method (or both).
   */
  _fulfillPromises(event: any = {}, state: RaviSignalingStates) {
    let errorMessage = event.reason || event.message || state;
    RaviUtils.log("_fulfillPromises: Handling state " + state, "RaviSignalingConnection");
    switch(state) {
      case RaviSignalingStates.OPEN:
        if (this._resolveOpen) this._resolveOpen();
        if (this._rejectClose) this._rejectClose(errorMessage);
        break;
      case RaviSignalingStates.CLOSED:
        if (this._rejectOpen) this._rejectOpen(errorMessage);
        if (this._resolveClose) this._resolveClose();
        break;
      case RaviSignalingStates.ERROR:
        if (this._rejectOpen) this._rejectOpen(errorMessage);
        if (this._rejectClose) this._rejectClose(errorMessage);
        break;
      case RaviSignalingStates.UNAVAILABLE:
        if (this._rejectOpen) this._rejectOpen(errorMessage);
        if (this._resolveClose) this._resolveClose();
        break;
      default:
        // Do nothing for the "in progress" states, like "OPENING" or "CLOSING"
        RaviUtils.log("_fulfillPromises: Skipping in-progress state " + state, "RaviSignalingConnection");
    }
  }
  
  /**
   * @private
   */
  _handleMessage(message: any) {
    RaviUtils.log("_doOnmessage: " + RaviUtils.safelyPrintable(message), "RaviSignalingConnection");
    // This is a special case for when the server side is in an "unavailable" state -- it will
    // send back a special JSON packet marking itself as "service-unavailable". Handle this situation
    // explicitly as a custom state. (This is kind of a lot of code for a rare occurrence, but we
    // don't send a ton of messages over the signaling connection and so I feel reasonably okay about
    // doing this check on every message. -MCH))
    if (message.data) {
        try {
            let messageData = JSON.parse(message.data);
            if (messageData.error && messageData.error === "service-unavailable") {
                this._handleStateChange({}, RaviSignalingStates.UNAVAILABLE);
            }
        } catch(err) {
            // If we can't parse the message as JSON, it's definitely
            // not the "unavailable" message and probably meant for someone else,
            // so no-op here and just let the rest of the code deal with it.
        }
    }
    this._messageHandlers.forEach(function(handler) {
      if (handler) {
        handler(message); 
      }
    });
  }
  
} // End of RaviSignalingConnection

/*************************************************************************** */

/*
TODO: Add information about what a RaviSignaling "connection implementation"
class should look like.

Constructor: takes a RaviSignalingConnection so that it can use its handlers. The class
is expected to assign the RaviSignalingConnection's _handleStateChange(event, state) and _handleMessage(message)
handlers to appropriate events (and/or throw those events itself).

Required methods: _open(URL), _send(message), and _close()

*/

/**
 * Use the correct classes depending on whether we're being 
 * called from node or the browser.
 */
let crossPlatformWebSocket:any = null;
if (typeof self === 'undefined') {
  // node context
  crossPlatformWebSocket = require('ws');
} else {
  // browser context
  crossPlatformWebSocket = WebSocket;
}

/** 
 * A WebSocket implementation for the RaviSignaling class
 * @private
 */
class RaviSignalingWebSocketImplementation {
  _raviSignalingConnection: RaviSignalingConnection;
  _webSocket: any;
  
  /**
   * "Class" variables to be aware of:
   * this._webSocket      // The actual connected web socket
   * this._raviSignalingConnection // the "parent" signaling connection
   */

  /**
   * Create a new RaviSignalingWebSocketImplementation
   * @param {RaviSession} raviSession The owner of this RaviWebRTCImplementation
   * @constructor
   */
  constructor(raviSignalingConnection: RaviSignalingConnection) {
    RaviUtils.log("constructor", "RaviSignalingWebSocketImplementation");
    this._raviSignalingConnection = raviSignalingConnection;
  }
  
  /**
   * @private
   */
  _open(socketAddress: string) {
    var signalingConnection = this._raviSignalingConnection;

    // If we already have an open websocket, make sure the signaling connection knows about it, and return immediately
    if (this._webSocket && this._webSocket.readyState === crossPlatformWebSocket.OPEN) {
        signalingConnection._handleStateChange({}, RaviSignalingStates.OPEN);
        return;
    }

    this._webSocket = new crossPlatformWebSocket(socketAddress);

    // The WebSocket's open, error, and close events will just
    // call back up to the main RaviSignalingConnection's 
    // stateChangeHandlers.
    // (We can't set these until we attempt to open the
    // WebSocket, because there's no other WebSocket constructor.)
    this._webSocket.addEventListener('open', function(event: any) { signalingConnection._handleStateChange(event, RaviSignalingStates.OPEN); });
    this._webSocket.addEventListener('error', function(event: any) { signalingConnection._handleStateChange(event, RaviSignalingStates.ERROR); });
    this._webSocket.addEventListener('close', function(event: any) { 
        if (event && event.code && event.code > 4000) {
            // This "close" event is really an error, because we're
            // returning one of our custom error codes. Treat it as such.
            RaviUtils.err("_handleStateChange: signaling error code " + event.code + ":  " + event.reason, "RaviSignalingConnection");
            signalingConnection._handleStateChange(event, RaviSignalingStates.ERROR);
        } else {
            signalingConnection._handleStateChange(event, RaviSignalingStates.CLOSED);
        }
    });

    // Any additional messaging handling gets done by the main
    // RaviSignalingConnection's messageHandlers
    this._webSocket.addEventListener('message', function(event: any) { signalingConnection._handleMessage(event); });
  }
  
  /**
   * @private
   */
  _send(message: any) {
    if (this._webSocket && this._webSocket.readyState === crossPlatformWebSocket.OPEN) {
        RaviUtils.log("Sending message to server: " + message, "RaviSignalingWebSocketImplementation");
        this._webSocket.send(message);
    }
  }
  
  /**
   * @private
   */
  _close() {
    var signalingConnection = this._raviSignalingConnection;
    // If we're already closed, make sure the signaling connection knows about it and return immediately
    if (! this._webSocket || this._webSocket.readyState === crossPlatformWebSocket.CLOSED) {
        signalingConnection._handleStateChange({}, RaviSignalingStates.CLOSED);
        return;
    }
    this._webSocket.close();
    this._webSocket = null;
  }
}

