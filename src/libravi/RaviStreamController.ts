import { RaviCommandController } from "./RaviCommandController";

const { RaviUtils } = require('./RaviUtils');

/** 
 * @class
 * @classdesc Handles interacting with media streams for RAVI sessions.
 * This class is provided by a {@link RaviSession} and should not be instantiated directly.
 *
 * Example usage (setting an audio output container): 
 * 
 * ```
 * var streamController = raviSession.getStreamController();
 * streamController.setAudioContainer(document.getElementById('remoteAudio'));
 *```
 *   
 */
export class RaviStreamController {
  _commandController: RaviCommandController;
  _audioStream: MediaStream;
  _videoStream: MediaStream;
  _onVideoStreamStateChanged: Function;
  _onInputAudioChanged: Function;
  _onInputVideoChanged: Function;
  _videoContainer: HTMLVideoElement;
  _audioContainer: HTMLAudioElement;
  _inputAudioStream: MediaStream;
  _isStereo: boolean;
  _inputVideoStream: MediaStream;

  /**
   * Create a new RAVI stream controller. 
   * Needs access to a RaviCommandController so it can send video-related commands.
   * @constructor
   */
  constructor(raviCommandController: RaviCommandController) {
    RaviUtils.log("constructor", "RaviStreamController");
    this._commandController = raviCommandController;
    
    // The audio stream and video stream get set by the RaviSession when the
    // appropriate events are received from the server
    this._audioStream = null;
    this._videoStream = null;
    
    // Default for the video stream state change handler
    this._onVideoStreamStateChanged = function (state: any) { RaviUtils.log("onvideostreamstatechanged " + state, "RaviStreamController");}
    // Default for the input audio stream change handler
    this._onInputAudioChanged = null;
    this._onInputVideoChanged = null;
  }

  /**
   * If the stream controller is aware of a video stream coming from the RAVI server, 
   * return it. Returns null if there is no video stream available.
   * @returns {MediaStream}
   */
  getVideoStream() {
    return this._videoStream;
  }
  
  /**
   * Set a video stream for this stream controller. If there is also a video container
   * set, this will attach the stream to that video container as well.
   * @private
   */
  _setVideoStream(videoStream: MediaStream) {
    this._videoStream = videoStream;
    if (this._videoContainer) {
      this._videoContainer.srcObject = this._videoStream;
    }
  }

  /**
   * Callback for listening to video stream state changes
   * @callback RaviStreamController~videoStateChangeCallback
   * @param {Object} event An object that will contain information
   * about the state change. 
   * TODO: List the possible states. 
   */
  /**
   * Set the DOM element that should be used to display incoming RAVI video
   * A callback handler can also be specified which will be called when the video stream change state
   * This call must happen before starting a session and the video element is immutable
   * @param {HTMLVideoElement} videoElement Reference to the JavaScript DOM element in which to display video. 
   * It is expected that this element is a "video" element. When a video track is obtained
   * from the RaviWebRTCImplementation, this element's srcObject will be set accordingly.
   * @param {RaviStreamController~videoStateChangeCallback} onvideostreamstatechanged Optional callback to catch changes of the video stream change states.
   */
  setVideoContainer(videoElement: HTMLVideoElement, onvideostreamstatechanged: Function) {
    this._videoContainer = videoElement;
    // If there's already been a video stream assigned, attach it
    if (this._videoStream) {
      this._videoContainer.srcObject = this._videoStream;
    }
    this.setVideoStateChangeHandler(onvideostreamstatechanged);
  }
  
  /**
   * Assign a callback handler for when the video stream state changes
   * @param {RaviStreamController~videoStateChangeCallback} onvideostreamstatechanged Callback to catch changes of the video stream change states.
   */
  setVideoStateChangeHandler(onvideostreamstatechanged: Function) {
    if (onvideostreamstatechanged) {
      this._onVideoStreamStateChanged = onvideostreamstatechanged;
    } 
  }

  /**
   * Tell the RAVI server to include the video "dashboard" as part of the video stream.
   *
   * @param {boolean} enabled True or false, to show or not show the dashboard.
   */
  showVideoDashboard(enabled: boolean) {
    this._commandController.queueCommand("video.showDashboard", {"enabled": enabled}, null);
  }
  /**
   * Tell the RAVI server to include a "remote cursor" as part of the video stream.
   *
   * @param {boolean} enabled True or false, to show or not show the remote cursor.
   */
  showVideoCursor(enabled: boolean) {
    this._commandController.queueCommand("video.showCursor", {"enabled": enabled}, null);
  }
  
  /**
   * If the stream controller is aware of an audio stream coming from the RAVI server, 
   * return it. Returns null if there is no audio stream available.
   * @returns {MediaStream}
   */
  getAudioStream() {
    return this._audioStream;
  }
  
  /**
   * Set an audio stream for this stream controller. If there is also an audio container
   * set, this will attach the stream to that audio container as well.
   * @private
   */
  _setAudioStream(audioStream: MediaStream) {
    this._audioStream = audioStream;
    if (this._audioContainer) {
      this._audioContainer.srcObject = this._audioStream;
    }
  }

  /**
   * Set the DOM element that should be used to play incoming RAVI audio
   * @param {Element} audioElement Reference to the JavaScript DOM element in which to play audio
   * sent from the remote RAVI server. 
   * It is expected that this element is an "audio" element. When an audio track is obtained
   * from the RaviWebRTCImplementation, this element's srcObject will be set accordingly.
   */
  setAudioContainer(audioElement: HTMLAudioElement) {
    this._audioContainer = audioElement;
    // If there's already been an audio stream assigned, attach it
    if (this._audioStream) {
      this._audioContainer.srcObject = this._audioStream;
    }
  }

  /**
   * Set the stream that should be used to send RAVI audio.
   * 
   * Example usage:
   *
   * ```
   *   navigator.mediaDevices.getUserMedia({ audio: true, video: false })
   *     .then(function(stream) {
   *     streamController.setInputAudio(stream);
   *   })
   *  
   *```
   * If there is a callback assigned via setInputAudioChangeHandler(),
   * it will be triggered when this stream is set.
   * 
   * @param {MediaStream} stream The audio stream being used to capture local media.
   * Generally this will be returned from getUserMedia()  
   *
   * @param {boolean} isStereo - Can be true to indicate that the stream is stereo.
   * The default is false.
   */
  setInputAudio(stream: MediaStream, isStereo = false) {
    this._inputAudioStream = stream;
    this._isStereo = isStereo;
    if (this._onInputAudioChanged) this._onInputAudioChanged(stream);
  }

  /**
   * Callback that will be triggered when the input audio stream is changed
   * via setInputAudio() 
   * @callback RaviStreamController~inputAudioChangeCallback
   * @param {Object} stream The new stream
   */
  /**
   * Assign a callback handler for when the input audio stream gets changed
   * @param {RaviStreamController~inputAudioChangeCallback} oninputaudiochanged Callback that will be triggered when the input audio changes
   */
  setInputAudioChangeHandler(oninputaudiochanged: Function) {
    if (oninputaudiochanged) {
      this._onInputAudioChanged = oninputaudiochanged;
    } 
  }
  

  setInputVideo(stream: MediaStream) {
    this._inputVideoStream = stream;
    if (this._onInputVideoChanged) this._onInputVideoChanged(stream);
  }

  setInputVideoChangeHandler(oninputvideochanged: Function) {
    if (oninputvideochanged) {
      this._onInputVideoChanged = oninputvideochanged;
    } 
  }

  /**
   * Whether or not the incoming audio stream supports stereo input,
   * as specified by setInputAudio.
   *
   * @return {boolean} Whether or not this input audio track supports stereo input
   */
  isStereoInput() {
    // The current state of play is that there is too much confusion in trying to
    // compute this from the stream tracks:
    // The browser's getUserMedia falsely reports a channelCount of 2, so we would
    // falsely report stereo.
    // The NodeJS wrtc package has a MediaStream that doesn't support getSettings
    // at all, so we would falsely report mono.
    return this._isStereo;
  }

  /**
   * End the conversation by stopping any incoming video
   * and remote audio streams and 
   * reset the source objects of their containers.
   * Note that this does NOT stop any local audio streams that
   * might be associated with the peerConnection -- it leaves
   * handling of that local audio stream to the implementing client.
   * 
   * @private
   */
  _stop() {
    RaviUtils.log("stopping streams", "RaviStreamController");

    if (this._videoContainer && this._videoContainer.srcObject) {
      let srcObject = <MediaStream> this._videoContainer.srcObject;
      let tracks = srcObject.getTracks();
      tracks.forEach(track => track.stop());
      this._videoContainer.srcObject = null;
      this._onVideoStreamStateChanged("over")
    }
    if (this._audioStream) {
      this._audioStream.getTracks().forEach(track => track.stop());
      this._audioStream = null;
    }
    
  }

}
