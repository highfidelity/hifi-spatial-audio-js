var DEBUG = true;

/** 
 *
 * @class
 * @classdesc Collection of static utility functions.
 */
export class RaviUtils {


  /**
   * Simple UUID implementation.
   * Taken from http://stackoverflow.com/a/105074/515584
   * Strictly speaking, it's not a real UUID, but it gives us what we need
   * for RAVI handling.
   */
  static createUUID(): string {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
  
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }
  
  
  /**
   * Wraps console.log such that we will only output a message to
   * console.log if the constant DEBUG (currently, this is simply defined
   * as a global variable inherited by the ravi.js file, which is a little
   * awful) is set to `true`. (Defaults to true.)
   * This method dispatches a "logger" event on the document in case
   * you want to do something else with the message. It will always
   * dispatch this event regardless of whether or not it's in DEBUG mode,
   * because presumably if you're listening for the event it's because you
   * want to get messages.
   */
  static log(message: string, classname: string) {
    if (typeof classname !== 'undefined') message = classname + ": " + message;
    if (DEBUG) {
      console.log(message);
    }
    if (typeof document !== 'undefined' && DEBUG) {
      try {
        document.dispatchEvent(new CustomEvent('logger', {detail: message}));
      } catch(err) {
        console.log(message);
        console.log("Additionally, an error was encountered trying to log that.")
        console.log(err);
      }
    }
  }

  /**
   * Wraps console.log such that we will ALWAYS output a message, and
   * that message will be in red.
   * This method dispatches an "errlogger" event on the document in case
   * you want to do something else with the message.
   */
  static err(message: string, classname: string) {
    if (typeof classname !== 'undefined') message = classname + ": " + message;
    console.log('%c %s', 'color: #FB0A1C', message);
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('errlogger', {detail: message}));
    }
  }

  /**
   * // Return JSON.stringify(item) if possible, else item
   */
  static safelyPrintable(item: any) {
    try {
      return JSON.stringify(item);
    } catch (e) {
      return item;
    }
  }
  
  /**
   * Figures out the width and height of a DOM element.
   */
  static getElementCSSSize(el: HTMLElement) {
    if (!getComputedStyle) {
      return;
    }
    var cs = getComputedStyle(el);
    var w = parseInt(cs.getPropertyValue("width"), 10);
    var h = parseInt(cs.getPropertyValue("height"), 10);
    return {width: w, height: h}
  }
  
  
  /**
   * Toggle the "debug" mode. In debug mode, most everything gets
   * printed to the JS console. (See also RaviUtils.js)
   * connects to the specified WebSocket address.
   * @param {boolean} debug Whether or not to put the logger into debug mode.
   * @static
   */
  static setDebug(debug: boolean) {
    DEBUG = debug;
  }

}
