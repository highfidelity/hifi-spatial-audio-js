import { RaviUtils } from "./RaviUtils";

/**
 * Enum for representing different possible states
 * that a RAVI signalingConnection might be in.
 *
 * "UNAVAILABLE" is a custom state that gets set
 * if the server is in a "running, but not currently
 * accepting incoming connections" state. Note however
 * that this is a transient state -- a connection that's
 * entered this state will usually then proceed to "ERROR" and
 * then to "CLOSED". Handle appropriately!
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
  _stateChangeHandlers: Set<Function>;
  _messageHandlers: Set<Function>;
  _state: RaviSignalingStates;
  _signalingImplementation: RaviSignalingWebSocketImplementation;
  
  /**
   * "Class" variables to be aware of:
   *
   * this._statechangeHandlers   // A list of handlers to call when the connection state changes
   * this._messageHandlers       // A list of handlers to call when a message is received
   *
   * this._signalingImplementation   // The implementation of signaling to use
   *
   * this._state                 // The current state of this connection
   */
  
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
      this._stateChangeHandlers.delete(changeHandler);
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
   * that will resolve with the state once the RaviSignalingConnection is connected.
   *
   * @param {string} URL The URL of the signaling server's endpoint (e.g. 'wss://foo.bar.baz:8889')
   * @returns {Promise}
   */
  open(URL: string) {
    var signalingConnection = this;

    return new Promise((resolve, reject) => {
      RaviUtils.log("Opening signaling connection to " + URL, "RaviSignalingController");
      // Add a state change handler that will resolve the
      // promise when the connection is open
      const stateHandler = function(event: any) {
        var state = "";
        if (event && event.state) state = event.state;

        if (state === RaviSignalingStates.CONNECTING) {
          RaviUtils.log("Connecting...", "RaviSignalingController")
        } else if (state === RaviSignalingStates.OPEN) {
          // Remove this as a state change handler
          signalingConnection.removeStateChangeHandler(stateHandler);
          // and resolve the Promise
          resolve(state);
        } else {
          // Remove this as a state change handler
          signalingConnection.removeStateChangeHandler(stateHandler);
          // and reject the Promise
          reject(event.error || new Error(event.message || state));
        }
      }
      signalingConnection.addStateChangeHandler(stateHandler);
      // And then alert about the "opening" process
      var event = {"state":RaviSignalingStates.CONNECTING};
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
   * that will resolve with the closed state once the RaviSignalingConnection is closed.
   *
   * @returns {Promise}
   */
  close() {
    var signalingConnection = this;

    return new Promise((resolve, reject) => {
      RaviUtils.log("Closing signaling connection", "RaviSignalingConnection");
      // Add a state change handler that will resolve the
      // promise when the connection is closed
      const stateHandler = function(event: any) {
        var state = "";
        if (event && event.state) state = event.state;

        if (state === RaviSignalingStates.CLOSING) {
          RaviUtils.log("Closing...", "RaviSignalingConnection");
        } else if (state === RaviSignalingStates.CLOSED) {
          // Remove this as a state change handler
          signalingConnection.removeStateChangeHandler(stateHandler);
          // and resolve the Promise
          resolve(state);
        } else {
          // Remove this as a state change handler
          signalingConnection.removeStateChangeHandler(stateHandler);
          // and reject the Promise
          reject(Error(state));
        }
      }
      signalingConnection.addStateChangeHandler(stateHandler);
      // And then start the "closing" process
      var event = {"state":RaviSignalingStates.CLOSING};
      this._handleStateChange(event, RaviSignalingStates.CLOSING); 
      // And call the implementation's close method
      this._signalingImplementation._close();
    });
  }

  /** Generic handlers */

  /**
   * @private
   */
  _handleStateChange(event: any, state: any) {
    this._state = state;
    event["state"] = state;
    RaviUtils.log("_handleStateChange: " + RaviUtils.safelyPrintable(event), "RaviSignalingConnection");
    this._stateChangeHandlers.forEach(function(handler) {
      if (handler) {
        handler(event); 
      }
    });
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
            if (messageData.error && messageData.error == "service-unavailable") {
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
    this._webSocket = new crossPlatformWebSocket(socketAddress);

    // The WebSocket's open, error, and close events will just
    // call back up to the main RaviSignalingConnection's 
    // stateChangeHandlers.
    // (We can't set these until we attempt to open the
    // WebSocket, because there's no other WebSocket constructor.)
    var signalingConnection = this._raviSignalingConnection;
    this._webSocket.addEventListener('open', function(event: any) { signalingConnection._handleStateChange(event, RaviSignalingStates.OPEN); });
    this._webSocket.addEventListener('error', function(event: any) { signalingConnection._handleStateChange(event, RaviSignalingStates.ERROR); });
    this._webSocket.addEventListener('close', function(event: any) { signalingConnection._handleStateChange(event, RaviSignalingStates.CLOSED); });

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
    if (this._webSocket) {
      this._webSocket.close();
      this._webSocket = null;
    }
  }
}

module.exports.RaviSignalingStates = RaviSignalingStates;
