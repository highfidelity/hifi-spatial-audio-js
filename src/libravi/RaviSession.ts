
import { RaviSignalingConnection } from './RaviSignalingConnection';
import { RaviStreamController } from './RaviStreamController';
import { RaviUtils } from './RaviUtils';
import { RaviCommandController } from './RaviCommandController';

export interface WebRTCSessionParams {
  /**
   * The minimum jitter buffer duration. Units are seconds. The default is 0 seconds.
   * 
   * In practice, this should always be set to 0 seconds, which is the default. Setting the minimum jitter buffer duration to X seconds means
   * that all audio sent to the server will always be buffered at least by X seconds. This is rarely desirable; lower latency is almost always preferred.
   * You may, however, want to set the maximum jitter buffer duration if your users are experiencing frequent audio drop-outs; refer to `audioMaxJitterBufferDuration` below for more details.
   */
  audioMinJitterBufferDuration?: number;
  /**
   * The maximum jitter buffer duration. Units are seconds. The default is 1 second.
   * 
   * Set the jitter buffer duration high to reduce the possibility of audio dropouts at the cost
   * of potentially higher round-trip audio latency on poor connections.
   */
  audioMaxJitterBufferDuration?: number;
};

/**
 * @internal
 * Enum for representing different possible states
 * that a RAVI session might be in.
 * 
 * @readonly
 * @enum {string}
 */
export enum RaviSessionStates {
  NEW = "new",
  CONNECTING = "checking",
  CONNECTED = "connected",
  COMPLETED = "completed",
  DISCONNECTED = "disconnected",
  FAILED = "failed",
  CLOSED = "closed"
};

/** 
 * @internal
 * @class
 * @classdesc Represents a communications session between a RAVI JS client and a RAVI server.
 * This class should be instantiated by the RAVI consumer, and then used to open, work with, and close 
 * RAVI sessions as needed.
 *
 */
export class RaviSession {
  _stateChangeHandlers: Set<Function>;
  _uuid: string;

  _commandController: RaviCommandController;
  _streamController: RaviStreamController;

  _state: RaviSessionStates;

  _raviImplementation: RaviWebRTCImplementation;

  /**
   * "Class" variables to be aware of:
   *
   * this._uuid                 // A UUID associated with this particular RaviSession
   * this._stateChangeHandlers  // A list of handlers to call when something (e.g. state), 
   *                           // changes, including when a message is received
   *
   * this._raviImplementation   // The implementation of exactly how to implement the RAVI connection (e.g. with WebRTC)
   * this._commandController
   * this._streamController
   *
   * this._state                 // The current state of this connection
   */
  
  /**
   * Create a new RaviSession.
   * Defaults to using new RaviCommandController and RaviStreamControllers
   * and initializes the state to RaviSessionStates.CLOSED.
   *
   * @constructor
   */
  constructor() {
    RaviUtils.log("Constructor", "RaviSession");
    // Initialize the list of handlers and the UUID
    this._stateChangeHandlers = new Set();
    this._uuid = RaviUtils.createUUID();
    
    // And the command controller and stream controller
    this._commandController = new RaviCommandController();
    this._streamController = new RaviStreamController(this._commandController);
    
    // Initialize the state
    this._state = RaviSessionStates.CLOSED;
    
    // If we wanted to use a different connection implementation,
    // we would new() it here. (TODO: Make this configurable in some
    // interesting way. For now, it's enough just to make it easily 
    // swappable in the code here.)
    this._raviImplementation = new RaviWebRTCImplementation(this);
    // When someone sets an input audio stream on the stream controller,
    // pass that along to the implementation's _addAudioInputStream method.
    const raviImpl = this._raviImplementation;
    this._streamController.setInputAudioChangeHandler(raviImpl._addAudioInputStream.bind(raviImpl));
    this._streamController.setInputVideoChangeHandler(raviImpl._addVideoInputStream.bind(raviImpl));
  }
  
  /**
   * Get the current state of the RAVI session.
   * 
   * @returns {RaviSessionStates}
   */
  getState() {
    return this._state;
  }

  /**
   * Get the UUID of the session
   * 
   * @returns {string}
   */
  getUUID() {
    return this._uuid;
  }

  /**
   * Callback for listening to state changes
   * @callback RaviSession~stateChangeCallback
   * @param {Object} event An object that will contain information
   * about the state change. This includes the "event.state" key,
   * which will have the appropriate value from the RaviSessionStates enum.
   */
  /**
   * Add a handler that will be used to listen for state
   * change events.
   * These are stored in a Set of Functions; therefore, a given function
   * can only exist once in this Set.
   * 
   * @param {RaviSession~stateChangeCallback} handler A callback handler that should handle a state change event
   * @returns {boolean} Whether or not the add succeeded
   */
  addStateChangeHandler(changeHandler: Function) {
    try {
      this._stateChangeHandlers.add(changeHandler);
      return true;
    } catch (err) {
      RaviUtils.err("Error adding a state change handler: " +
        err.message, "RaviSession");
      return false;
    }
    return false;
  }

  /**
   * Remove a handler so that it stops listening for state
   * change events.
   * 
   * @param {RaviSession~stateChangeCallback} handler A callback handler that has been handling a state change event
   * @returns {boolean} Whether or not the removal was successful (i.e. did not throw an error -- note that this does
   * NOT indicate whether or not the handler was in the set in the first place)
   */
  removeStateChangeHandler(changeHandler: Function) {
    try {
      this._stateChangeHandlers.delete(changeHandler);
      return true;
    } catch (err) {
      RaviUtils.err("Error removing a state change handler: " +
        err.message, "RaviSession");
      return false;
    }
    return false;
  }
  
  /**
   * Get the RaviCommandController for use with this RaviSession.
   * The {link RaviCommandController} is used to send commands and input to the RAVI server.
   * 
   * @returns {RaviCommandController}
   */
  getCommandController() {
    return this._commandController;
  }

  /**
   * Get the RaviStreamController for use with this RaviSession.
   * The {link RaviStreamController} is used to send commands and input to the RAVI server.
   * 
   * @returns {RaviStreamController}
   */
  getStreamController() {
    return this._streamController;
  }
  
  /**
   * Open a RAVI connection using the provided RaviSignalingConnection. Returns a Promise
   * that will resolve with the connected state once the RaviSession is connected.
   * 
   * @param {Object} __namedParameters
   * @param signalingConnection
   * @param timeout A timout in ms after which to timeout the attempt to connect. Defaults to 5000 (5 seconds).
   * @param params An optional configuration object applied to the server side of the session. The default value is null,
   * meaning that we'll rely on the default values as defined on the server.
   *            
   * @returns {Promise}
   */
  openRAVISession({signalingConnection, timeout = 5000, params = null}: { signalingConnection: RaviSignalingConnection, timeout?: number, params?: WebRTCSessionParams}) {
    var raviSession = this;

    // Tell our connection implementation about this signaling connection --
    // it may need to talk to it directly while it's attempting to negotiate
    // the connection.
    this._raviImplementation._assignSignalingConnection(signalingConnection);

    return new Promise((resolve, reject) => {
      RaviUtils.log("Opening RAVI session", "RaviSession");

      // Set a timeout in case the session gets hung up in initialization
      let timer = setTimeout(() => {
        RaviUtils.log("RaviSession.open timed out after " + timeout + " ms", "RaviSession");
        // Reject the promise with an explicit error message.
        reject(Error("RaviSession.open timed out"));
        // Close the session; this should trigger the state change
        // handler to clean up. This would also reject the promise if we didn't do so explicitly above.
        raviSession.closeRAVISession();
      }, timeout);
      
      // Add a state change handler that will resolve the
      // promise once the connection is open
      const stateHandler = function(event: any) {
        var state = "";
        if (event && event.state) state = event.state;

        if (state === RaviSessionStates.NEW ||
              state === RaviSessionStates.CONNECTING ||
              state === RaviSessionStates.DISCONNECTED) {
            // NOTE: Per https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection#RTCIceConnectionState_enum
            // "disconnected" is a potentially transient state, so in this call we will simply wait until we
            // get to connected, complete, or failed.
            RaviUtils.log("RAVI session state is " + state, "RaviSession");

        } else if (state === RaviSessionStates.CONNECTED ||
                      state === RaviSessionStates.COMPLETED) {
          clearHandlerAndTimeout();
          resolve(state);

        } else if (state === RaviSessionStates.FAILED) {
          clearHandlerAndTimeout();
          // Explicitly call the implementation's "close" method to make
          // really, really sure it's closed in addition to being "failed".
          // These are NOT the same state! A "failed" connection may still be
          // aware of its signaling connection and other niceties.
          // Kick off that close in a timeout to get it to run asynchronously
          // from the Promise rejection.
          const closeTimer = setTimeout(() => {
            raviSession._raviImplementation._close();
          }, 0);
          reject(Error(state));
        } else if (state === RaviSessionStates.CLOSED) {
          clearHandlerAndTimeout();
          reject(Error(state));
        }
      };

      const clearHandlerAndTimeout = function () {
          raviSession.removeStateChangeHandler(stateHandler);
          // Clear the timer
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
      }

      // The implementation will trigger connection state change events
      raviSession.addStateChangeHandler(stateHandler);

      // And finally, call the implementation's open method
      raviSession._raviImplementation._open(params);

    });
  }
  
  /**
   * Close a RAVI connection, including shutting down the 
   * relevant RaviStreamController and RaviCommandController. Returns a Promise
   * that will resolve with the closed state once the RaviSession is closed.
   * 
   * @param {RaviSignalingConnection} signalingConnection
   *
   * @returns {Promise}
   */
  closeRAVISession() {
    var raviSession = this;
   
    // Start by closing out command controller
    // and the stream controller.
    this._streamController._stop();
    this._commandController.stopMonitoringQueues();

    return new Promise((resolve, reject) => {
      RaviUtils.log("Closing RAVI session", "RaviSession");
      // Add a state change handler that will resolve the
      // promise once the connection is closed
      const stateHandler = function(event: any) {
        var state = "";
        if (event && event.state) state = event.state;

        if (state === RaviSessionStates.DISCONNECTED) {
          RaviUtils.log("Closing...", "RaviSession");
        } else if (state === RaviSessionStates.CLOSED) {
          // Remove this as a state change handler
          raviSession.removeStateChangeHandler(stateHandler);
          // and resolve the Promise
          resolve(state);
        } else {
          // Remove this as a state change handler
          raviSession.removeStateChangeHandler(stateHandler);
          // and reject the Promise
          reject(Error(state));
        }
      };
      raviSession.addStateChangeHandler(stateHandler);

      // And then alert about the "closing" process
      var event = {"state":RaviSessionStates.DISCONNECTED};
      raviSession._handleStateChange(event, RaviSessionStates.DISCONNECTED); 
      // And finally, call the implementation's close method
      raviSession._raviImplementation._close();

    });
  }
  
  /**
   * Handler for whenever a new "track channel" shows up. (When this event happens
   * should be determined by the implementation, and information about the track should be 
   * stored in the passed event object.)
   * @private
   */
  _doOntrack(event: any) {
    // TODO: This code is working if we have only one media track (video OR audio), not sure it works with more
    // Need too make it more robust with different branches based on the event info
    RaviUtils.log("Received new track: ", "RaviSession");
    RaviUtils.log(event, "RaviSession");

    if (event && event.track && event.track.kind === "video") { 
      RaviUtils.log("Adding remote video track to stream controller", "RaviSession");
      this._streamController._setVideoStream(event.streams[0]);
      this._streamController._onVideoStreamStateChanged("ready");
    }
    
    if (event && event.track && event.track.kind === "audio") {
      RaviUtils.log("Adding remote audio track to stream controller", "RaviSession");
      this._streamController._setAudioStream(event.streams[0]);
    }
  }
  
  /**
   * Handler for whenever a new "data channel" shows up. (When this event happens should be determined
   * by the implementation, and information about the channel should be stored in the passed event object.)
   * @private
   */
  _doOndatachannel(event: any) {
    RaviUtils.log("Received new channel: ", "RaviSession");
    RaviUtils.log(event, "RaviSession");
    
    switch (event.channel.label) {
      case "ravi.input":
        this._commandController._setInputDataChannel(event.channel);
        break;
      case "ravi.command":
        this._commandController._setCommandDataChannel(event.channel);
        break;
      default:
        RaviUtils.log("Received unknown data channel named " + event.channel.label, "RaviSession");
        break;
    }
  }

  /** 
   * Generic handler 
   * @private
   */
  _handleStateChange(event: any, state: any) {
    this._state = state;
    if (!event) {
      return;
    }
    event["state"] = state;
    RaviUtils.log("_handleStateChange: " + JSON.stringify(event), "RaviSession");
    this._stateChangeHandlers.forEach(function(handler) {
      if (handler) {
        handler(event); 
      }
    });
  }

   /**
   * Callback for listening to stats
   * @callback RaviSession~statsObserverCallback
   * @param {Object} stats An object that will contain information
   * about the stats recorded
   */
  /**
   * Add a handler that will be used to listen for new stats generated.
   * These are stored in a Set of Functions; therefore, a given function
   * can only exist once in this Set.
   * 
   * @param {RaviSession~statsObserverCallback} handler A callback handler that should handle a state change event
   * @returns {boolean} Whether or not the add succeeded
   */
  addStatsObserver(observer: Function) {
    return this._raviImplementation._addStatsObserver(observer);
  }

  /**
   * Remove a handler so that it stops listening for stats updates.
   * 
   * @param {RaviSession~statsObserverCallback} handler A callback handler that should handle a state change event
   * @returns {boolean} Whether or not the removal was successful (i.e. did not throw an error -- note that this does
   * NOT indicate whether or not the handler was in the set in the first place)
   */
  removeStatsObserver(observer: Function) {
    return this._raviImplementation._removeStatsObserver(observer);
  }
  
} // End of the RaviSession class

/*************************************************************************** */
 /**
  * @internal
 * Constants used as the default filter for the stats collected in the RaviStatsWatcher
 */
const STATS_WATCHER_FILTER = new Map([
  ["remote-inbound-rtp", ["id", "type", "timestamp", "roundTripTime", "jitter"] ],
  ["inbound-rtp", ["id", "type", "timestamp", "jitterBufferDelay", "jitterBufferEmittedCount", "bytesReceived"]]
]);

/**
 * @internal
 * StatsWatcher is the object responsible for calling getStats from the
 * RTCPeerConnection at regular intervals.
 * The captured metrics are filtered and passed on to the statsObserver(s).
 * The filter is a dictionary of the report type and fields.
 * Current default value is defined in STATS_WATCHER_FILTER.
 * StatsObserver is a callback function that receives 2 parameters, the current record and the previous record.
 * Several StatsObserver callbacks can be added/removed by user code through the corresponding methods of the object.
 * these methods are exposed publically on the RaviSession.
 * @private
 */
class RaviWebRTCStatsWatcher {
  _raviImplementation: RaviWebRTCImplementation;
  _observers: Set<Function>;
  _filter: Map<string, Array<any>>;
  _interval: number;
  _prevStats: Array<any>;

  
  /**
   * "Class" variables to be aware of:
   * this._observers is the set of observer callbacks registered by user code
   * this._interval is the interval ticking the getStats call
   */

  /**
   * Create a new RaviStatsWatcher
   * @param {RaviWebRTCImplementation} webRTCImplementation The RaviWebRTCImplementation being watched
   * @constructor
   */
  constructor(webRTCImplementation: RaviWebRTCImplementation) {
    RaviUtils.log("constructor", "RaviStatsWatcher");
    this._raviImplementation = webRTCImplementation;
    this._observers = new Set();
    this._filter = STATS_WATCHER_FILTER;
    this._interval = 0;
    this._prevStats = []; 
  }

  /**
   * Stops the watcher
   */
  stop() {
    if (this._interval) {
      window.clearInterval(this._interval);
      this._interval = 0;
    }
  }

  /**
   * Add an observer that will be used to listen for new stats generated.
   * These are stored in a Set of Functions; therefore, a given function
   * can only exist once in this Set.
   * 
   * statsObserverCallback function receives 2 parameters, the current record and the previous record.
   * function(newStats, prevStats)
   * the Stats parameter is an Array of objects, a filtered down version of the dictionnaries returned by 
   * RTCPeerConnection.getStats
   * 
   * @param {RaviStatsWatcher~statsObserverCallback} observer A callback which will receive the stats samples
   * @returns {boolean} Whether or not the add succeeded
   */
  addObserver(observer: Function) {
    try {
      this._observers.add(observer);
      this._onObserverChange();
      return true;
    } catch (err) {
      RaviUtils.err("Error adding a stats observer: " +
        err.message, "RaviStatsWatcher");
      return false;
    }
    return false;
  }

  /**
   * Remove an observer so that it stops listening for stats updates.
   * 
   * @param {RaviSession~statsObserverCallback} observer A callback to be removed from the set
   * @returns {boolean} Whether or not the removal was successful (i.e. did not throw an error -- note that this does
   * NOT indicate whether or not the handler was in the set in the first place)
   */
  removeObserver(observer: Function) {
    try {
      this._observers.delete(observer);
      this._onObserverChange();
      return true;
    } catch (err) {
      RaviUtils.err("Error removing a stats observer handler: " +
        err.message, "RaviSession");
      return false;
    }
    return false;
  }

  
  // Whenever observer(s) are added or remove,
  // let's make sure the watcher is running if there is any observer.
  // and let's turn off the collection of stats if the set of observers is empty.
  _onObserverChange() {
    const INTERVAL = 1000;

    this._prevStats = [];
    // some observers, then make sure we run
    if (this._observers.size > 0) {
      if (!this._interval) {
        window.setInterval(async (handler: any, timeout: any) => { 
          const stats = await this._raviImplementation._getStats();
          
          let filteredStats:any = [];
          if (stats) {
            stats.forEach((report: any) => {
              // Filter on the report type
              if (this._filter.has(report.type)) {
                // selected fields must be a valid array of fields:
                let selectedFields = this._filter.get(report.type);
                
                // Then within the report type, pick on the wanted fields
                let filteredReport: any = {};
                selectedFields.forEach(key => {
                    filteredReport[key] = report[key];
                });

                // Add the filtered report found in the result selection
                filteredStats.push(filteredReport);
              }
            });
          }
          
          // Stats have been collected, now let's broadcast
          if (filteredStats.length) {
            this._observers.forEach ((observer)=>{
              observer(filteredStats, this._prevStats);
            });
          }

          // record the produced stats as the most recent one
          this._prevStats = filteredStats;
        }, INTERVAL );
      }
    } else {
      // no observers, make sure we are stopped
      if (this._interval) {
        window.clearInterval(this._interval);
        this._interval = 0;
      }
    }
  }

}

/*************************************************************************** */

/*
TODO: Add information about what a RAVI Peer Connection "connection implementation"
class should look like. Some initial notes:
Constructor: Takes in a RaviSession so that it can use its handlers. The implementation class
is expected to assign the RaviSession's _handleStateChange(event, state) 
handler to any appropriate events thrown by its implementation 
(and/or thrown by itself).
Similarly, it is expected to call the parent's _doOndatachannel and _doOntrack
methods when it has data channel and track channels ready.
  Expected methods:
  constructor(raviSession);
  _assignSignalingConnection();
  _addAudioInputStream(inputStream);
  _addVideoInputStream(inputStream);
  _open(); 
  _close();
*/

/**
 * @internal
 * Use the correct classes depending on whether we're being 
 * called from node or the browser.
 */
let crossPlatformRTCPeerConnection:any = null;
let crossPlatformRTCSessionDescription:any = null;
if (typeof self === 'undefined') {
  // node context
  crossPlatformRTCPeerConnection = require('wrtc').RTCPeerConnection;
  crossPlatformRTCSessionDescription = require('wrtc').RTCSessionDescription;
} else {
  // browser context
  crossPlatformRTCPeerConnection = RTCPeerConnection;
  crossPlatformRTCSessionDescription = RTCSessionDescription;
}

/**
 * @internal
 * Constants used during session negotiation
 */
const peerConnectionConfig = {
  'iceServers': [
    {'urls': 'stun:stun.l.google.com:19302'},
    {'urls': 'turn:turn.highfidelity.com:3478',
      'username': 'clouduser',
      'credential': 'chariot-travesty-hook'
    }
  ]
};

/** 
 * @internal
 * A WebRTC implementation for a RAVI peer connection
 * @private
 */
class RaviWebRTCImplementation {
  _raviSession: RaviSession;
  _negotiator: any;
  _statsWatcher: RaviWebRTCStatsWatcher;
  _rtcConnection: typeof crossPlatformRTCPeerConnection;
  _raviAudioSenders: any;
  _raviVideoSenders: any;
  _signalingConnection: RaviSignalingConnection;
  
  /**
   * "Class" variables to be aware of:
   * this._rtcConnection       // The actual RTCPeerConnection
   * this._raviSession         // The "owning" RaviSession
   * this._signalingConnection // A RaviSignalingConnection that can be used when negotiating the session
   * this._negotiator          // A bound version of the connection setup method that can be used for message handling
   */

  /**
   * Create a new RaviWebRTCImplementation
   * @param {RaviSession} raviSession The owner of this RaviWebRTCImplementation
   * @constructor
   */
  constructor(raviSession: RaviSession) {
    RaviUtils.log("constructor", "RaviWebRTCImplementation");
    this._raviSession = raviSession;
    this._negotiator = this._setupConnection.bind(this);
    this._initRtcConnection();
    this._statsWatcher = new RaviWebRTCStatsWatcher(this);
  }
  
  /**
   * Initialize the RTC connection to a new fresh one. This should be called
   * before attempting to open the connection. But since it's nice to have these
   * handlers attached as early as possible, we actually call this right away in the constructor
   * and then again when a connection is closed (to reinitialize).
   *
   * @private
   */
  _initRtcConnection() {
    const raviSession = this._raviSession;
    const that = this;
    
    // Create a new RTC connection (for node or the browser)
    this._rtcConnection = new crossPlatformRTCPeerConnection(peerConnectionConfig);
    const rtcConnection = this._rtcConnection;
    
    // Clear out any old track senders
    let senders = rtcConnection.getSenders();
    senders.forEach((sender: any) => {
      sender.replaceTrack(null);
    });
    this._raviAudioSenders = [];
    this._raviVideoSenders = [];
    
    // This new RTCConnection's state change events will just
    // call back up to the main RaviSession's 
    // stateChangeHandlers.
    // NOTE: Take a look at BIGWORLD-1062 and the difference between 
    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection#RTCIceConnectionState_enum
    // and
    // https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection#RTCPeerConnectionState_enum
    // to see why we're listening on iceconnectionstatechange instead of peerconnectionstatechange
    rtcConnection.addEventListener('iceconnectionstatechange', function(event: any) { 
      raviSession._handleStateChange(event, rtcConnection.iceConnectionState); 
    });

    // Similiarly, listen at the RaviSession level for track and data channel events
    rtcConnection.addEventListener('datachannel', function(event: any) { raviSession._doOndatachannel(event); });
    rtcConnection.addEventListener('track', function(event: any) { raviSession._doOntrack(event); });

    // However, we need to listen at our own RTC implementation level for ice candidate events, 
    // because they're part of the session negotiation
    rtcConnection.addEventListener('icecandidate', function(event: any) { that._doOnicecandidate(event); });

    // When a negotiationneeeded is triggered from this peer, signal the server side to initiate an offer
    // In Ravi, the webrtc negotiation is always initiated from the server side
    rtcConnection.addEventListener('negotiationneeded', function(event: any) { that._doOnnegotiationneeded(event); });

    // Watch the signaling state changes for debug.
    rtcConnection.addEventListener("signalingstatechange", function(event: any) { that._doOnsignalingstatechanged(event); });

  }
  
  /**
   * Tell this RaviWebRTCImplementation what RaviSignalingConnection to use.
   *
   * This method is called by the owning RaviSession. 
   * @protected
   */
  _assignSignalingConnection(signalingConnection: RaviSignalingConnection) {
    this._signalingConnection = signalingConnection;
  }
  
  /**
   * Add an input stream to this connection. (This can be done at
   * any point during the connection, which is why it's a separate method.)
   * 
   * This method is called by the owning RaviSession when its stream controller
   * gets an input stream. 
   * @protected
   */
  _addAudioInputStream(stream: MediaStream) {
    const rtcConnection = this._rtcConnection;
    const that = this;
    var retval = false;

    if (stream) {
      // We keep track of the senders that we interact with
      // separately from the list of senders on the RTC connection,
      // because we want to make sure we're only working with 
      // senders that match our own parameters.
      const currentSenders = this._raviAudioSenders;
      
      // List of new tracks in the passed stream
      const newAudioTracks = stream.getAudioTracks();
      const numNewTracks = newAudioTracks.length;

      let i=0;
      for (i; i < currentSenders.length; i++) {
        // For each of the tracks that we already know about,
        // replace them with a track from the new stream.
        // (Note: this seems to add a little latency when it gets called,
        // but on the plus side, does not trigger a renegotiation. The latency
        // tends to dissipate over time.)
        if (i < numNewTracks) {
          RaviUtils.log("Replacing audio track #" + i + "  in rtcConnection", "RaviWebRTCImplementation");
          currentSenders[i].replaceTrack(newAudioTracks[i]);
        } else {
          // If there are more tracks in the old stream than
          // in the new one, set the extras to null 
          RaviUtils.log("Setting audio sender #" + i + " to null", "RaviWebRTCImplementation");
          currentSenders[i].replaceTrack(null);
        }
      }

      // If there are more tracks in the new stream then
      // in the old, add them
      for (i; i < numNewTracks; i++) {
        RaviUtils.log("Adding local audio track #" + i + " to rtcConnection", "RaviWebRTCImplementation");
        currentSenders.push(rtcConnection.addTrack(newAudioTracks[i], stream));
        // We expect the 'negotiationneeded' event to fire
      }
    } else {
        // the stream assigned is null meaning we want to kill any input audio stream
        const currentSenders = this._raviAudioSenders;

        // simply set all the existing senders to null track.
        let i=0;
        for (i; i < currentSenders.length; i++) {
          RaviUtils.log("Setting audio sender #" + i + " to null", "RaviWebRTCImplementation");
          currentSenders[i].replaceTrack(null);
        }
    }
    return retval;
  }

  _addVideoInputStream(stream: MediaStream) {
    const rtcConnection = this._rtcConnection;
    const that = this;
    var retval = false;

    if (stream) {
      // We keep track of the senders that we interact with
      // separately from the list of senders on the RTC connection,
      // because we want to make sure we're only working with 
      // senders that match our own parameters.
      const currentSenders = this._raviVideoSenders;
      
      // List of new tracks in the passed stream
      const newVideoTracks = stream.getVideoTracks();
      const numNewTracks = newVideoTracks.length;
      
      // At the moment, ravi client session only support one outbound video track
      if (numNewTracks > 0) {
        // If current video sender exists already, just replace track
        if (currentSenders.length > 0) {
          RaviUtils.log("Replacing video track #0 in rtcConnection", "RaviWebRTCImplementation");
          currentSenders[0].replaceTrack(newVideoTracks[0]);
        } else {
          // else just add the new track to the PeerConnection.
          RaviUtils.log("Adding video track #0 to rtcConnection", "RaviWebRTCImplementation");
          currentSenders.push(rtcConnection.addTrack(newVideoTracks[0]));
          // We expect the 'negotiationneeded' event to fire
        }
        retval = true;
      } else {
        RaviUtils.log("Assigned video stream doesn't contain vidoe track", "RaviWebRTCImplementation");
      }             
    } else {
      // the stream assigned is null meaning we want to kill any input video stream
      const currentSenders = this._raviVideoSenders;

      // simply set all the existing senders to null track.
      let i=0;
      for (i; i < currentSenders.length; i++) {
        RaviUtils.log("Setting video sender #" + i + " to null", "RaviWebRTCImplementation");
        currentSenders[i].replaceTrack(null);
      }
    }
    return retval;
  }
  
  /**
   * Open a session. This implementation does this by adding a handler to the signalingConnection
   * that will listen for "ready to negotiate connection" messages so that the 
   * _setupConnection method can then negotiate the connection.
   *
   * This method is called by the owning RaviSession. 
   * @protected
   */
  _open(params: any) {
    RaviUtils.log("Attempting to open connection...", "RaviWebRTCImplementation");
    if (this._rtcConnection.connectionState == 'connecting' || this._rtcConnection.connectionState == 'connected') {
      RaviUtils.log("We already have a connection in progress. Will not attempt a new one.", "RaviWebRTCImplementation");
      // Trigger state change handler on the owning session to finalize any 
      // residual Promises
      this._raviSession._handleStateChange({"state":this._rtcConnection.connectionState}, this._rtcConnection.connectionState); 
      return;
    }

    if (this._signalingConnection) {
      // Add a handler for state change events onto the provided
      // signaling connection. This should listen for the appropriate 
      // "ready to negotiate connection" message from the signaling connection.
      this._signalingConnection.addMessageHandler(this._negotiator);

      // Send the magic string for opening a connection.
      // with params eventually
      let message: any = {};
      if (params) {
          message = params;
          message["sessionID"] = this._raviSession.getUUID();
      } else {
          message = this._raviSession.getUUID();
      }

      this._signalingConnection.send(JSON.stringify({'request': message}));
    }
  }
  
  
  /**
   * Close a session.
   *
   * This method is called by the owning RaviSession. 
   * @protected
   */
  _close() {
    if (this._rtcConnection) {
      this._statsWatcher.stop();

      RaviUtils.log("closing", "RaviWebRTCImplementation");
      this._rtcConnection.close();    
      this._rtcConnection = null;

      var event = {"state":RaviSessionStates.CLOSED};
      this._raviSession._handleStateChange(event, RaviSessionStates.CLOSED); 
      
      // Remove our session-negotiating message handler
      this._signalingConnection.removeMessageHandler(this._negotiator);

      // Reinitialize the RTC connection so it's ready for another session if needed.
      this._initRtcConnection();
    }
  }


  /**
   * Used to send local ICE candidate proposals to the server.
   * 
   * @private
   */
  _doOnicecandidate(event: any) { 
    if (event.candidate && event.candidate != "") {
      RaviUtils.log("Sending local ICE candidate: " + JSON.stringify(event.candidate), "RaviWebRTCImplementation");
      this._signalingConnection.send(JSON.stringify({'ice': event.candidate, 'uuid': this._raviSession.getUUID()}));
    } else {
      RaviUtils.log("End of local ICE candidates", "RaviSession");
    }
  }
  
  /**
   * Handle renegotiation when needed.
   * 
   * @private
   */
  _doOnnegotiationneeded(event: any) {
    RaviUtils.log("need renegotiation please", "RaviWebRTCImplementation");
    const msg = {
      renegotiate: "please",
      uuid: this._raviSession.getUUID()
    };
    const desc = JSON.stringify(msg);
   
    // negotiation needed but only if we are not already currently negotiating
    if (this._signalingConnection && this._rtcConnection.signalingState === "stable") {
      this._signalingConnection.send(desc);
    }
  }

  /**
   * Handle signaling state change.
   * 
   * @private
   */
  _doOnsignalingstatechanged(event: any) {
    // simple logging for now
    RaviUtils.log("SignalingState changed: " + this._rtcConnection.signalingState, "RaviWebRTCImplementation");
  }

  /**
   * @private
   */
  _forceBitrateUp(sdp: string) {
    // Need to format the SDP differently if the input is stereo, so 
    // reach up into our owner's stream controller to find out.
    const localAudioIsStereo = this._raviSession._streamController.isStereoInput();
    // Use 128kbps for stereo upstream audio, 64kbps for mono
    const bitrate = localAudioIsStereo ? 128000 : 64000;

    // SDP munging: use 128kbps for stereo upstream audio, 64kbps for mono
    return sdp.replace(/a=fmtp:111 /g, 'a=fmtp:111 maxaveragebitrate='+bitrate+';');
  }
  
  /**
   * @private
   */
  _forceStereoDown(sdp: string) {
    // munge the SDP answer: request 128kbps stereo for downstream audio
    return sdp.replace(/a=fmtp:111 /g, 'a=fmtp:111 maxaveragebitrate=128000;sprop-stereo=1;stereo=1;');
  }

  /**
   * Listens to all messages on the signaling connection (see the _open() method), and
   * watches for the appropriate SDP-related events so that it can negotiate the connection.
   *
   * @private
   */
  _setupConnection(event: any) {
    let fullMessage:any = "";
    let signal:any = "";

    
    // Local copies of useful variables to avoid having to bind
    const raviSession = this._raviSession;
    const rtcConnection = this._rtcConnection;
    const signalingConnection = this._signalingConnection;
    const that = this;
    
    // Just in case, make sure we have everything we need
    if (!raviSession || !rtcConnection || !signalingConnection) {
      RaviUtils.err("Missing one of raviSession, rtcConnection, or signalingConnection! Can't set up connection.", "RaviWebRTCImplementation");
      return;
    }
    
    // Make sure we have a message, and that it's for this particular RAVI session
    if (event && event.data) {
      RaviUtils.log('Message from server: ' + event.data, "RaviWebRTCImplementation");
      fullMessage = JSON.parse(event.data);
    } else {
      RaviUtils.log('No message received by onMessage handler', "RaviWebRTCImplementation");
      return; // No message
    }
    signal = fullMessage[raviSession.getUUID()];
    if (!signal) return; // This message is not for me

    // We have a signal; check first to see if it's an SDP
    if (signal.sdp) {
      RaviUtils.log("Got sdp of type:" + signal.type, "RaviWebRTCImplementation");
    
      // Force our desired bitrate by munging the SDP, and create a session description for it
      signal.sdp = that._forceBitrateUp(signal.sdp); 
      const desc = new crossPlatformRTCSessionDescription(signal);

      // Set the description on the RTC connection, and send and handle the various SDPs
      rtcConnection.setRemoteDescription(desc)
      .then(function() {
        // Create an answer
       return rtcConnection.createAnswer();
      })
      .then(function(answer: any) {
        // Force stereo on the downstream stream by munging the SDP
        answer.sdp = that._forceStereoDown(answer.sdp); 
        RaviUtils.log("Answer:", "RaviWebRTCImplementation");
        RaviUtils.log(answer, "RaviWebRTCImplementation");
        // set local description
        return rtcConnection.setLocalDescription(answer);
      })
      .then(function() {
        const msg = {
          type: "answer",
          sdp: rtcConnection.localDescription,
          uuid: raviSession.getUUID()
        };
        const desc = JSON.stringify(msg);
        RaviUtils.log("Sending answer to server", "RaviWebRTCImplementation");
        // Send the final result back to the server
        signalingConnection.send(desc);
      });

    } else if (signal.ice) {
      RaviUtils.log("Received remote ICE candidate: " + JSON.stringify(signal.ice), "RaviWebRTCImplementation");
      rtcConnection.addIceCandidate(signal.ice)
      .then(function() {
        RaviUtils.log("Added remote candidate", "RaviWebRTCImplementation");
      })
      .catch(function(e: any) {
        RaviUtils.err("Error attempting to add remote ICE candidate: " + e.message, "RaviWebRTCImplementation");
      });
    } else {
      // Some other handler's problem
      RaviUtils.log("Unknown message " + JSON.stringify(signal), "RaviWebRTCImplementation");
    }
  }
  
  /**
   * Add a handler that will be used to listen for new stats generated.
   * These are stored in a Set of Functions; therefore, a given function
   * can only exist once in this Set.
   * 
   * @private
   * @param {RaviSession~statsObserverCallback} handler A callback handler that should handle a state change event
   * @returns {boolean} Whether or not the add succeeded
   */
  _addStatsObserver(observer: Function) {
    return this._statsWatcher.addObserver(observer);
  }

  /**
   * Remove a handler so that it stops listening for stats updates.
   * 
   * @private
   * @param {RaviSession~statsObserverCallback} handler A callback handler that should handle a state change event
   * @returns {boolean} Whether or not the removal was successful (i.e. did not throw an error -- note that this does
   * NOT indicate whether or not the handler was in the set in the first place)
   */
  _removeStatsObserver(observer: Function) {
    return this._statsWatcher.removeObserver(observer);
  }

  /**
   * Expose the getStats call on the rtcPeerConnection
   * used by the statsWatcher
   */
  async _getStats(selector: any = null) {
    if (this._rtcConnection) {
      return this._rtcConnection.getStats(selector);
    } else {
      return {};
    }
  }
}
