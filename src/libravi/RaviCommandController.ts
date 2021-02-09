import { RaviUtils } from './RaviUtils';

/**
 * Used for storing the binary command handlers
 * @private
 */
const _BINARY_COMMAND_KEY = "_BINARY";


/**
 * Mouse state message is 7 floats aka 7 * 4 = 28 bytes
 */
const _MOUSE_STATE_BUFFER_SIZE = 28;

enum _KEY_CODE_TABLE {
  "ControlLeft" = 0,
  "AltLeft" = 1,
  "OSLeft" = 2,
  "Space" = 3,
  "OSRight" = 4,
  "AltRight" = 5,
  "ControlRight" = 6,

  "ShiftLeft" = 7,
  "ShiftRight" = 8,
  "Comma" = 9,
  "Period" = 10,
  "Slash" = 11,
 
  "CapsLock" = 12,
  "Enter" = 13,
  "Semicolon" = 14,
  "Quote" = 15,

  "Tab" = 16,
  "BracketLeft" = 17,
  "BracketRight" = 18,
  "Backslash" = 19,

  "Backquote" = 20,
  "Minus" = 21,
  "Equal" = 22,

  "Digit0" = 23,
  "Digit1" = 24,
  "Digit2" = 25,
  "Digit3" = 26,
  "Digit4" = 27,
  "Digit5" = 28,
  "Digit6" = 29,
  "Digit7" = 30,
  "Digit8" = 31,
  "Digit9" = 32,

  "Backspace" = 33,

  "Escape" = 34,
 
  "ArrowLeft" = 35,
  "ArrowRight" = 36,
  "ArrowDown" = 37,
  "ArrowUp" = 38,
  "PageDown" = 39,
  "PageUp" = 40,
  "End" = 41,
  "Home" = 42,
  "Delete" = 43,
  "Insert" = 44,

  "Numpad0" = 45,
  "Numpad1" = 46,
  "Numpad2" = 47,
  "Numpad3" = 48,
  "Numpad4" = 49,
  "Numpad5" = 50,
  "Numpad6" = 51,
  "Numpad7" = 52,
  "Numpad8" = 53,
  "Numpad9" = 54,
 
  "NumpadDecimal" = 55,
  "NumpadEnter" = 56,
  "NumpadAdd" = 57,
  "NumpadSubtract" = 58,
  "NumLock" = 59,
  "NumpadEqual" = 60,
  "NumpadMultiply" = 61,
  "NumpadDivide" = 62,
 
  "KeyA" = 63,
  "KeyB" = 64,
  "KeyC" = 65,
  "KeyD" = 66,
  "KeyE" = 67,
  "KeyF" = 68,
  "KeyG" = 69,
  "KeyH" = 70,
  "KeyI" = 71,
  "KeyJ" = 72,
  "KeyK" = 73,
  "KeyL" = 74,
  "KeyM" = 75,
  "KeyN" = 76,
  "KeyO" = 77,
  "KeyP" = 78,
  "KeyQ" = 79,
  "KeyR" = 80,
  "KeyS" = 81,
  "KeyT" = 82,
  "KeyU" = 83,
  "KeyV" = 84,
  "KeyW" = 85,
  "KeyX" = 86,
  "KeyY" = 87,
  "KeyZ" = 88,
};
const _KEYBOARD_STATE_BUFFER_SIZE = 12;

/** 
 * @class
 * @classdesc This class handles queuing, managing, and transmitting commands from a RAVI JavaScript client
 * to a RAVI server. 
 * This class is provided by a {@link RaviSession} and should not be instantiated directly.
 *
 * Example usage (sending information on mouse double-click):
 * 
 * ```
 * var commandController = raviSession.getCommandController();
 * let handleMouseDoubleClick = (event) => {
 *   var pos = mouseHandler(event)
 *   commandController.sendInput({"c": "DoubleClick", "p": pos })
 * };
 *```
 */
export class RaviCommandController {
  _commandQueueMap: Map<string, any>;
  _numQueuedCommands: number;
  _commandQueueInterval: number;
  _commandPumpTimer: ReturnType<typeof setInterval>;

  _inputTarget: HTMLElement;
  _keyboardTarget: HTMLElement;

  _mouseStateBuffer: ArrayBuffer;
  _mouseStateUint8: Uint8Array;
  _mouseStateFloat: Float32Array;

  _keyboardStateBuffer: ArrayBuffer;
  _keyboardState: Uint8Array;

  _inputDataChannel: RTCDataChannel;
  _commandDataChannel: RTCDataChannel;

  /**
   * "Class" variables to be aware of:
   *
   * Command-channel related: 
   * this._commandDataChannel;
   * this._commandQueueMap;
   * this._numQueuedCommands;
   * this._commandPumpTimer;
   * this._commandQueueInterval;
   *
   * Input-channel related:
   * this._inputDataChannel;
   * this._inputTarget;
   * this._keyboardTarget;
   */
  
  /**
   * Create a new RAVI command controller. 
   * Defaults the commandQueueInterval to 1 second
   * and initializes variables.
   *
   * @constructor
   */
  constructor() {
    RaviUtils.log("constructor", "RaviCommandController");
    
    this._commandQueueMap = new Map();
    this._numQueuedCommands = 0;
    this._commandQueueInterval = 1000;
    this._commandPumpTimer = null;

    this._inputTarget;
    this._keyboardTarget;

    // Mouse state buffer contains the 'M' char to indicate the payload on the input data channel
    this._mouseStateBuffer = new ArrayBuffer(_MOUSE_STATE_BUFFER_SIZE + 4);
    // set 'M' as the first char of the MousedState buffer
    this._mouseStateUint8 = new Uint8Array(this._mouseStateBuffer);
    this._mouseStateUint8[0] = 0x4D
    // Allocate the view on the mouse buffer as floats starting on the 2nd byte
    this._mouseStateFloat = new Float32Array(this._mouseStateBuffer, 4 );
    this._mouseStateFloat[0] = -1.0;
    this._mouseStateFloat[1] = -1.0;
    this._mouseStateFloat[2] = -1.0;
    this._mouseStateFloat[3] = -1.0;
    
    // Keyboard state buffer contains the 'k' char to indicate the payload
    this._keyboardStateBuffer = new ArrayBuffer(_KEYBOARD_STATE_BUFFER_SIZE + 1);
    this._keyboardState = new Uint8Array(this._keyboardStateBuffer);
    this._keyboardState[0] = 0x4B; // set 'K' as the first char of the KeyboardState buffer
  }
  
  /**
   * Set the interval at which we should send commands
   * to the server.
   *
   * @param {int} queueInterval The number of milliseconds to wait between
   * sending commands. Defaults to 1000 (1 second).
   */
  setCommandQueueInterval(queueInterval: number) {
    this._commandQueueInterval = queueInterval;
    // If the command queue is running, stop it and
    // restart it.
    if (this._commandPumpTimer) {
      this.stopMonitoringQueues();
      this.monitorQueues();
    }
  }
  

  /**
   * Callback for listening for responses to queued commands
   * @callback RaviCommandController~commandCallback
   * @param {string} response The response received from the server
   */
  /**
   * Queue up a command to be sent when ready, along
   * the "command" data channel.
   * See also {link RaviCommandController#sendInput}
   * to send immediate input to the server.
   *
   * For example, here is a request for a new video keyframe:
   * ```
   * commandController.queueCommand("video.forceKeyFrame", {}, handler)
   *
   * ```
   * NOTE: These commands sent to the RAVI server will be sent as JSON,
   * and handlers associated with these commands are expected to
   * receive JSON as a response. If you need to process binary data
   * received in response to a command, you should send the command 
   * without a handler, and then ALSO specify a global binary listener
   * with {link RaviCommandController#addBinaryHandler}
   * to identify and appropriately process the response. Binary
   * data is not associated with a command, and so all binary handlers
   * are executed for all binary data received; binary handlers should
   * themselves determine if the data they've been given is the data
   * they're expecting. (And if you want to send the command as binary
   * from the JS side, use {link RaviCommandController#queueBinaryCommand})
   *
   * @param {string} command The command to add to the queue
   * @param {Object} param   Parameters to include along with the command
   * @param {RaviCommandController~commandCallback} handler A callback handler that should handle any response from the server
   */
  queueCommand(command: string, param: any, handler: Function) {
    // Add the command to the queue for this particular
    // type of command
    var commandQueue = this._commandQueueMap.get(command);
    if (!commandQueue) {
      commandQueue = { toSend: [], listener: [] };
      this._commandQueueMap.set(command, commandQueue);
    }

    var handlerInstance = null;
    if (handler) {
      // For now, all handlers associated with actual sent commands
      // are not "sticky" (i.e. they only execute once, when the command returns)
      // and they DO have a "matching sent command"
      handlerInstance = new RaviCommandHandlerInstance(handler, false, true);
    }
    commandQueue.toSend.push( new RaviCommandInstance(command, param, handlerInstance) );

    // Keep track of the number of waiting commands separately so we don't have
    // to keep calculating it when we check for queued commands
    this._numQueuedCommands++;
    
    RaviUtils.log("Added command " + command, "RaviCommandController");
  }

  /**
   * Queue up a binary message to be sent when ready, along
   * the "command" data channel.
   * See also {link RaviCommandController#sendInput}
   * to send immediate input to the server.
   *
   * NOTE: You can not include a handler in this method, because
   * binary messages are not currently distinguishable from each
   * other as regards handlers (i.e. there is no "command" associated
   * with a binary message). If you want to assign a handler that
   * will process binary messages received from the server, use
   * {link RaviCommandController#addBinaryHandler}
   * to identify and appropriately process the response. Binary
   * data is not associated with an individual command, and so all binary handlers
   * are executed for all binary data received; binary handlers should
   * themselves determine if the data they've been given is the data
   * they're expecting.
   *
   * @param {ArrayBuffer} message An ArrayBuffer (expected by the server to be a Uint8Array) that should be sent to the server
   */
  queueBinaryCommand(message: ArrayBuffer) {
    // Add the command to the binary queue 
    let command = _BINARY_COMMAND_KEY;
    var commandQueue = this._commandQueueMap.get(command);
    if (! commandQueue) {
      commandQueue = { toSend: [], listener: [] };
      this._commandQueueMap.set(command, commandQueue);
    }

    commandQueue.toSend.push( new RaviCommandInstance(message, null, null) );

    // Keep track of the number of waiting commands separately so we don't have
    // to keep calculating it when we check for queued commands
    this._numQueuedCommands++;
    
    RaviUtils.log("Added binary command", "RaviCommandController");
  }

  
  /**
   * Add a command handler only, without also queuing up a command to send.
   * This listener will watch for a message to be received from the
   * server (on the "command" data channel) that matches the expected
   * message name. When received, the listener will execute, and then either stick around and
   * keep watching (if the "isSticky" flag is set to true)
   * or de-register itself (if "isSticky" is false) and stop listening.
   *
   * @param {string} expectedMessage The string to watch for from the server, something like "message.location"
   * @param {RaviCommandController~commandCallback} handler A handler that should process any events labeled with expectedMessage
   * @param {boolean} isSticky Whether the handler should execute every time the message is received (true)
   *                                 or just the first time (false)
   */
  addMessageHandler(expectedMessage: string, handler: Function, isSticky: boolean) {

    // The command queue map is used to track all commands/listeners;
    // ensure that this particular "expectedMessage" has an entry
    var messageEntry = this._commandQueueMap.get(expectedMessage);
    if (! messageEntry) {
      messageEntry = { toSend: [], listener: [] };
      this._commandQueueMap.set(expectedMessage, messageEntry);
    }
    
    // We don't actually want to put anything in its "toSend" array, but
    // we do want to add a listener.
    var handlerInstance = new RaviCommandHandlerInstance(handler, isSticky, false);
    messageEntry.listener.push(handlerInstance); 

  }

  /**
   * Callback for listening for binary server messages
   * @callback RaviCommandController~binaryCallback
   * @param {Uint8Array} response The response received from the server as a Uint8Array typed array
   */
  /**
   * Add a handler for binary data only, without also queuing up a command to send.
   * This listener will watch for a binary message to be received from the
   * server (on the "command" data channel).
   * When received, the listener will execute, and then either stick around and
   * keep watching (if the "isSticky" flag is set to true)
   * or de-register itself (if "isSticky" is false) and stop listening.
   *
   * NOTE: Binary data is not associated with a command, and so all binary handlers
   * are executed for all binary data received; binary handlers should
   * themselves determine if the data they've been given is the data
   * they're expecting.
   *
   * @param {RaviCommandController~binaryCallback} handler A handler that should process any events labeled with expectedMessage
   * @param {boolean} isSticky Whether the handler should execute every time the message is received (true)
   *                                 or just the first time (false)
   */
  addBinaryHandler(handler: Function, isSticky: boolean) {
    // Store these handlers in the same map as the other listener-only handlers,
    // but just use a single constant key.
    this.addMessageHandler(_BINARY_COMMAND_KEY, handler, isSticky);
    // NOTE: Currently, we don't support any sort of "command" associated
    // with binary messages -- when we get a binary message, all binary
    // handlers are called. We may decide to rethink this in the future.
  }
  
  /**
   * Send an input event directly from the user to the RAVI server along
   * the "input" data channel.
   * See also {link RaviCommandController#queueCommand}, which queues commands for later sending.
   * This method does not define callbacks.
   *
   * For example, here is an event handler for sending mouse movement:
   * ```
   * let handleMouseMove = (event) => {
   *   var pos = mouseHandler(event)
   *   commandController.sendInput({"c": "MouseMove", "p": pos })
   * };
   * ```
   * @param {string} inputEvent An event to send.
   */
  sendInput(inputEvent: any) {
    if (this._inputDataChannel && this._inputDataChannel.readyState === 'open') {
      // This gets just WAY too noisy too quickly,
      // but uncomment if needed:
      // RaviUtils.log("Sending input:" + JSON.stringify(inputEvent), "RaviCommandController");
      this._inputDataChannel.send(inputEvent);
    }
  }
  
  /**
   * Kick off polling for queued commands.
   * Every second, this will send the
   * next queued command from the commandQueue.
   * This does not need to be called externally;
   * it will be called automatically when the appropriate
   * command data channel is opened. (See {@link RaviCommandController#_setCommandDataChannel})
   * However, it can be called externally if at any point
   * you need to stop and then restart the queue monitoring
   * process.
   */
  monitorQueues() {
    RaviUtils.log("Begin monitoring for queued commands", "RaviCommandController");
    this._commandPumpTimer = setInterval(this._processSendingQueuedCommands.bind(this), this._commandQueueInterval);  
  }
  
  /**
   * Stop polling for queued commands and
   * no longer send them. Called when a RAVI session is closed
   * (see {@link RaviSession#close}). Can also be called
   * externally to halt command processing if needed.
   */
  stopMonitoringQueues() {
    RaviUtils.log("Stop monitoring for queued commands", "RaviCommandController");
    clearInterval(this._commandPumpTimer);
    this._commandPumpTimer = null;
  }

  /**
   * Process the next queued command.
   * this gets used internally by the queue monitor
   * and, in general, should not be called externally.
   * 
   * @private
   */
  _processSendingQueuedCommands() {
    if (this._numQueuedCommands <= 0) {
      return;
    }
    
    // For each type of command in the map, we can send the first one of them.
    this._commandQueueMap.forEach(function(value: any, key: any, map: any) {
      // if this particular command has a queue of instances...
      if (value.toSend.length) {
        // Grab the first one off the queue
        var commandInstance = value.toSend.shift();

        // If a handler is defined then put it on the listener map
        if (commandInstance._handler) {
          // Add it to the list of listeners for later handler handling
          value.listener.push(commandInstance._handler);       
        }

        // Let's send the command!
        if ( this._sendCommandInstance(commandInstance) ) {
          this._numQueuedCommands--;
        } else {
          RaviUtils.log("Send failed. CommandDataChannel may have been disconnected. Will not retry.", "RaviCommandController");
          // If we did want to retry, though:
          //value.toSend.push(commandInstance);
        }
      }
    }.bind(this));
  }

  /**
   * Serialize a pair { command, payload } to be sent has a message on the CommandDataChannel
   * @param {string} command - The actual string command
   * @param {string} payload - Any parameters to be sent or received the command
   * 
   * @return the message as a {string} as expected by the server
   * @private
   */
  _serializeJsonCommandMessageToSend(command: string, payload: string) {
    return JSON.stringify({"c": command, "p": payload});
  }

  /**
   * Unserialize a received command message 
   * If the message is parsed correctly then the function returns a valid "CommandMessage" object
   * containing the following keys
   * - {string} 'command' - The command token identifying the destination of the message
   * - {string} 'payload' - The actual data received from the message
   * 
   * If the parsing doesn't match a valid commandMessage then the function returns null and log the problem
   * 
   * @return A valid "CommandMessage" object as detailed above or null
   * @private
   */
  _unserializeJsonCommandMessageFromReceived(message: string) {
    let commandMessage;
    try {
      commandMessage = JSON.parse(message);
    } catch (e) {
      RaviUtils.err(`Couldn't parse command message! Error:\n${e}\n Full message contents:\n${message}`, "RaviCommandController");
      return;
    }

    // commandMessage is expected to have 2 keys:
    // 'c': the command name, the token identifying the command destination for this message
    // 'p': the payload data, the actual information received from the server
    if (commandMessage && commandMessage.c && commandMessage.p) {
      return {'command': commandMessage.c, 'payload': commandMessage.p };
    }
    RaviUtils.err("Message cannot be unserialized into a CommandMessage: " + message, "RaviCommandController");

    return null;
  }

  /**
   * 
   * Send a particular command instance immediately --
   * this gets used internally by {@link RaviCommandController#_processSendingQueuedCommands}
   * and in general, should not be called externally.
   * 
   * @param {RaviCommandInstance} commandInstance
   *
   * @private
   */
  _sendCommandInstance(commandInstance: RaviCommandInstance) {
    // Rather than checking for an open channel every time, just try it and
    // catch any errors
    try {
      let message = commandInstance._command;
      if (typeof message === "string") {
        message = this._serializeJsonCommandMessageToSend(commandInstance._command, commandInstance._param);
        RaviUtils.log("Sending command " + message, "RaviCommandController");
      } else {
        RaviUtils.log("Sending binary command", "RaviCommandController");
      }
      this._commandDataChannel.send(message);
      // we don't get anything back, so just assume it sent if it didn't throw an error...
      return true;
    } catch (err) {
      RaviUtils.err("Received error while sending: " + err.message, "RaviCommandController");
      return false;
    }
  }
  
  /**
   * 
   * Process the listener for the message from the RAVI server --
   * this gets used internally by {@link RaviWebRTCImplementation}
   * and in general, should not be called externally.
   * 
   * @param {string} fromServerMessage
   *
   * @private
   */
  _processListeningCommand(fromServerMessage: any) {

    let serverData = fromServerMessage.data;
    let commandMessage = null;

    // First off, is this a binary message or a JSON message?
    // If it's a JSON message, it'll be a string; if it's a
    // binary message, it'll be an ArrayBuffer.
    // (And if it's neither of those, we'll leave commandMessage
    // unset and pick it up later.)
    if (serverData) {
      if (typeof serverData === 'string') {
        // It's JSON. The command info is already in the message.
        commandMessage = this._unserializeJsonCommandMessageFromReceived(serverData);
        this._continueProcessingListeningCommand(commandMessage);
      } else if (serverData instanceof ArrayBuffer){
        // It's binary. We'll wrap it in a typed array
        // and then in a JavaScript struct
        // so that it can be processed with the same
        // "payload" code path as the JSON data
        commandMessage = { 'command' : _BINARY_COMMAND_KEY, 'payload' : new Uint8Array(serverData)};
        // NOTE: Currently, we don't natively include any sort of "command" associated
        // with binary messages -- when we get a binary message, all binary
        // handlers are called. We may decide to rethink this in the future.
        this._continueProcessingListeningCommand(commandMessage);
      } else if (serverData instanceof Blob) {
        serverData.arrayBuffer()
          .then((processedArrayBuffer) => {
            commandMessage = { 'command' : _BINARY_COMMAND_KEY, 'payload' : new Uint8Array(processedArrayBuffer)};
            this._continueProcessingListeningCommand(commandMessage);
          });
      }
    }
  }

  _continueProcessingListeningCommand(commandMessage: any) {
    if (!commandMessage) {
      RaviUtils.err("Received invalid command message, ignoring: " + JSON.stringify(commandMessage), "RaviCommandController");
      return;
    }

    RaviUtils.log("_continueProcessingListeningCommand: " + commandMessage, "RaviCommandController");

    // Let's try to find the matching listener(s) for the commandMessage received:
    var foundCommandInstance = this._commandQueueMap.get(commandMessage.command);
    if (foundCommandInstance) {
      // How many listeners does it have?
      var length = foundCommandInstance.listener.length;
      if (length > 0) {
        /**
        TODO: We need to add both server & client functionality that
        will track the "instance" of a command and trigger the appropriate
        listener. Right now this could behave unexpectedly in the situation
        where we register two different listeners for the same command
        and the "wrong" one returns first. See BIGWORLD-456. We can make
        this code cleaner once that's implemented.

        In the meantime, we'll leave the "instance of a command" behavior as is.
        And if there is no listener with a "matching sent command", we'll
        execute all the relevant "listen-only" listeners.

        NOTE: This code assumes that a given commandMessage "command" string
        (e.g. "command.about" or "message.location") will only have ONE TYPE
        of listener: "matching sent command" or "listen-only". If you queue
        a command with a listener, and then ALSO try to
        associate a listen-only listener with that same command name,
        strange things will happen. (Specifically, the command handler for
        the sent command will be the only thing executed when you get the first
        response back, but if you get subsequent responses back, then the
        listen-only listener(s) will execute.) We can remove this restriction
        once BIGWORLD-456 is implemented.
        **/
        if (foundCommandInstance.listener[0] && foundCommandInstance.listener[0]._hasMatchingSentCommand) {
          // There was an original command sent that we're listening for a response for, 
          // command sent, so that means we just execute the first handler,
          // whatever it is.
          var commandInstance = foundCommandInstance.listener.shift();
          if (commandInstance && commandInstance._handler) {
            commandInstance._handler(commandMessage.payload);
            return; // success, end of the (first) listener
          } else {
            RaviUtils.err("Undefined command handler: " + commandMessage, "RaviCommandController");
          }

        } else {
          var newListeners = [];
          for (var i = 0; i < length; i++) {
            var listener = foundCommandInstance.listener[i];
            if (listener && listener._handler) {
              // attempt to execute the handler
              listener._handler(commandMessage.payload);
            } else {
              RaviUtils.err("Undefined message handler: " + commandMessage, "RaviCommandController");
            }
            // If it's sticky, add it to the "new" list
            if (listener && listener._isSticky) {
              newListeners.push(listener);
            }
          }
          // Update with only the sticky ones
          foundCommandInstance.listener = newListeners;
        }
      }
      // no listener defined, just move on, this is an ok path
    }
  }

  /**
   * 
   * Set the input data channel.
   *
   * @param {RTCDataChannel} inputDataChannel The dataChannel to use. While this is defined as an RTCDataChannel,
   * hypothetically some other kind of stream that offers the same API and callbacks as an RTCDataChannel
   * could also be used.
   *
   * @private
   */
  _setInputDataChannel(inputDataChannel: RTCDataChannel) {
    this._inputDataChannel = inputDataChannel;
    RaviUtils.log("Received new input data channel with id " + this._inputDataChannel.id, "RaviCommandController");

    this._inputDataChannel.onopen = function () {
      RaviUtils.log("_inputDataChannel onopen, state is " + this._inputDataChannel.readyState, "RaviCommandController");
    }.bind(this);

    this._inputDataChannel.onclose = function () {
      RaviUtils.log("_inputDataChannel onclose, state is " + this._inputDataChannel.readyState, "RaviCommandController");
    }.bind(this);

    this._inputDataChannel.onmessage = function (message: any) {
      RaviUtils.log("_inputDataChannel got message: " + (message.data), "RaviCommandController");
    }.bind(this);
  }

  /**
   * 
   * Set the command data channel.
   *
   * @param {RTCDataChannel} commandDataChannel The dataChannel to use. While this is defined as an RTCDataChannel,
   * hypothetically some other kind of stream that offers the same API and callbacks as an RTCDataChannel
   * could also be used.
   *
   * @private
   */
  _setCommandDataChannel(commandDataChannel: RTCDataChannel) {
    this._commandDataChannel = commandDataChannel;
    RaviUtils.log("Received new data channel with id " + this._commandDataChannel.id, "RaviCommandController");
  
    this._commandDataChannel.onopen = function () {
      RaviUtils.log("_commandDataChannel ononpen, state is " + this._commandDataChannel.readyState, "RaviCommandController");
      // Kick off the monitoring of the command queues in the command controller.
      this.monitorQueues();
    }.bind(this);

    this._commandDataChannel.onclose = function () {
      RaviUtils.log("_commandDataChannel onclose, state is " + this._commandDataChannel.readyState, "RaviCommandController");
      // Stop monitoring the command queue
      this.stopMonitoringQueues();
    }.bind(this);

    this._commandDataChannel.onmessage = function (message: any) {
      this._processListeningCommand(message);
    }.bind(this);
  }

  
  /**
   * Set a DOM element that is used to track input event (mouse & touch)
   * several listeners are added to the element and communicate input events to Ravi Server through the input channel
   * @param {Element} inputTargetElement Reference to the JavaScript DOM element used to track input events 
   */
  setInputTarget(inputTargetElement: HTMLElement) {
    if (this._inputTarget) {
      this._inputTarget.onmousemove = null;
      this._inputTarget.onmouseenter = null;
      this._inputTarget.onmouseleave = null;
      this._inputTarget.onmousedown = null;
      this._inputTarget.onmouseup = null;
      this._inputTarget.onwheel = null;
    }

    this._inputTarget = inputTargetElement;

    if (this._inputTarget) {
      var that = this;

      this._inputTarget.onmousemove =  function(event) { that._trackMouse(event); };
      this._inputTarget.onmouseenter = null;
      this._inputTarget.onmouseleave = null;
      this._inputTarget.onmousedown = function(event) { that._captureMouseDown(event); };
      this._inputTarget.onmouseup = function(event) { that._resetMouseDown(event); };
      this._inputTarget.onwheel =  function(event) { that._wheelMouse(event); };
    }
  }

 setKeyboardTarget(inputTargetElement: HTMLElement) {
    if (this._keyboardTarget) {
      this._keyboardTarget.onkeydown = null;
      this._keyboardTarget.onkeyup = null;
    }

    this._keyboardTarget = inputTargetElement;

    if (this._keyboardTarget) {
      var that = this;

      this._keyboardTarget.onkeydown = function(event) { that._onKeyboardDown(event); };
      this._keyboardTarget.onkeyup = function(event) { that._onKeyboardUp(event); };
    }
  }


  /**
   * @private
   * 
   */
  _captureMouseDown(e: MouseEvent) {
    this._mouseStateFloat[0] = e.offsetX;
    this._mouseStateFloat[1] = e.offsetY;
    this._mouseStateFloat[2] = e.offsetX;
    this._mouseStateFloat[3] = e.offsetY;

    this._mouseStateUint8[1] = e.buttons;

    // And send state
    this._sendMouseState();
  }
  /**
   * @private
   * 
   */
  _resetMouseDown(e: MouseEvent) {
    this._mouseStateFloat[0] = -1.0;
    this._mouseStateFloat[1] = -1.0;
    this._mouseStateFloat[2] = -1.0;
    this._mouseStateFloat[3] = -1.0;

    this._mouseStateUint8[1] = e.buttons;

    // And send state
    this._sendMouseState();
  }
  /**
   * @private
   * 
   */
  _trackMouse(e: MouseEvent) {
    // update the current mouse pos in the ouseStateBufffer
    this._mouseStateFloat[0] = e.offsetX;
    this._mouseStateFloat[1] = e.offsetY;

    this._mouseStateFloat[4] = this._inputTarget.offsetWidth;
    this._mouseStateFloat[5] = this._inputTarget.offsetHeight;

    this._mouseStateUint8[1] = e.buttons;

    // And send state
    this._sendMouseState();
  }

  /**
   * @private
   * 
   */
  _wheelMouse(e: WheelEvent) {
    this._mouseStateFloat[6] = e.deltaY;
    this._sendMouseState();
    this._mouseStateFloat[6] = 0;
  }

  _sendMouseState() {
    this.sendInput(this._mouseStateBuffer);
  }

  _keyByteNum(c: any) {
    return c >> 3;
  }
  _keyBitMask(c: any) {
    return (1 << (c % 8));
  }

  /**
   * @private
   */
  _onKeyboardDown(e: KeyboardEvent) {
    let c = _KEY_CODE_TABLE[<any> e.code];
    let keyByteNum = 1 + this._keyByteNum(c);
    let keyByteMask = this._keyBitMask(c);
    if ((this._keyboardState[keyByteNum] & keyByteMask) === 0) {
        this._keyboardState[keyByteNum] |= keyByteMask;
        this._sendKeyboardState();
    }
  }

  /**
   * @private
   */
  _onKeyboardUp(e: KeyboardEvent) {
    let c = _KEY_CODE_TABLE[<any> e.code];
    let keyByteNum = 1 + this._keyByteNum(c);
    let keyByteMask = this._keyBitMask(c);
    if ((this._keyboardState[keyByteNum] & keyByteMask) !== 0) {
        this._keyboardState[keyByteNum] ^= keyByteMask;
        this._sendKeyboardState();
    }
  }

  _sendKeyboardState() {
    this.sendInput(this._keyboardStateBuffer);
  }

} // End of the RaviCommandController class

/*************************************************************************** */

/** 
 *
 * A command instance for use with the 
 * RaviCommandController. This is just
 * a specialized object to track the combination of
 * a command type, the parameters for that command,
 * and the handler to be used for the command result.
 * @param {string} command - The actual string command to send
 * @param {string} param - Any parameters to be sent to the command
 * @param {RaviCommandController.RaviCommandHandlerInstance} handler - A callback handler to use when the command returns from the server
 * 
 * @class RaviCommandController.RaviCommandInstance
 * @classdesc Represents a command that should be 
 * queued up in the RaviCommandController's command queue.
 *
 * @private
 */
class RaviCommandInstance {
  _command: any;
  _param: any;
  _handler: any;

  /*
   * "Class" variables to be aware of:
   * this._command;
   * this._param;
   * this._handler;
   */
  
  /** 
   * @private 
   */
  constructor(command: any, param: any, handler: any) {
    RaviUtils.log("constructor", "RaviCommandInstance");
    this._command = command;
    this._param = param;
    this._handler = handler;
  }
}

/** 
 *
 * A handler instance for use with the 
 * RaviCommandController. This just
 * tracks the handler function and whether or 
 * not it's "sticky." Handlers that are associated
 * with a particular SENT command are NOT sticky by
 * default (i.e. they execute once, and then stop
 * listening), but listeners that are registered
 * by themselves can be either sticky or not sticky.
 * @param {RaviCommandController~commandCallback} handler - A callback handler to use when the command returns from the server
 * @param {boolean} isSticky - Whether or not the handler sticks around forever (true) or stops listening after it gets
 * its first response (false)
 * @param {boolean} hasMatchingSentCommand - Whether or not this handler has a matching command that was/is going to be 
 * sent to the server (true), or if it's just listening for something the server might send on its own (false)
 * 
 * @class RaviCommandController.RaviCommandHandlerInstance
 * @classdesc Represents a handler that can be 
 * used to process messages from the server
 *
 * @private
 */
class RaviCommandHandlerInstance {
  _handler: any;
  _isSticky: boolean;
  _hasMatchingSentCommand: boolean;

  /*
   * "Class" variables:
   * this._handler;
   * this._isSticky;
   * this._hasMatchingSentCommand;
   */
  /** 
   * @private 
   */
  constructor(handler: any, isSticky: boolean, hasMatchingSentCommand: boolean) {
    RaviUtils.log("constructor", "RaviCommandHandlerInstance");
    this._handler = handler;
    this._isSticky = isSticky;
    this._hasMatchingSentCommand = hasMatchingSentCommand;
  }
}
