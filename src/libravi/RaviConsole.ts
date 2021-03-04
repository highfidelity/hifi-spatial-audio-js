import { RaviUtils } from "./RaviUtils";

/** 
 *
 * @class
 * @classdesc Class used for handling the console
 * that displays log messages. If this class is used
 * to set a comms console, an event listener will be 
 * added that listens for all potential logging messages
 * and displays them.
 *   
 * Example usage:
 * ```
 * var raviConsole = new RaviConsole();
 * var commsConsoleEl = document.getElementById('commsConsole');
 * raviConsole.setCommsConsole(commsConsoleEl);
 * ```
 */
export class RaviConsole {
  _maxConsoleItems: number;
  commsConsoleList: HTMLElement;

  /**
  * "Class" variables, for developer reference.
  * These get declared when they're defined in the
  * constructor.
  *
  * _commsConsoleList;    // Holds a rolling display of messages duplicating 
  *                       // what's logged to the JavaScript console
  * _maxConsoleItems;     // Maximum number of items that can be displayed on the console
  *
  *
  */
  
    
  /**
   * Create a new RAVI console for use in displaying log information.
   * Defaults the maximum number of items visible in that console to 80.
   *
   * @constructor
   */
  constructor() {
    RaviUtils.log("constructor", "RaviConsole");
    this._maxConsoleItems = 80;
  }
  
  
  /**
   * Set the DOM element that should be used to display communication logs.
   * This will just repeat on-screen the information that is would be logged to the JS console.
   * 
   * @param {Element} commsConsoleListContainer Reference to the JavaScript DOM element in which
   * to display communications console messages. It is expected that this is a div, but it
   * doesn't have to be.
   */
  setCommsConsole(commsConsoleListContainer: HTMLElement) {
    var newRaviCommsConsoleList = document.createElement("ul");
    newRaviCommsConsoleList.style.fontFamily = '"Courier New", monospace';
    // Setting an ID here is ripe for DOM collisions, but, since these logs are per-session and not
    // global, and the logs need to be global, we must base the following logic off of
    // the `newRaviCommsConsoleList`'s ID.
    newRaviCommsConsoleList.id = "raviCommsConsoleList";

    let oldRaviCommsConsoleList = document.getElementById("raviCommsConsoleList");
    // If we already have a populated comms list...
    if (oldRaviCommsConsoleList &&
      oldRaviCommsConsoleList.children.length > 0 && oldRaviCommsConsoleList.parentNode) {
      // ...we must prepend its contents to the contents of the new one...
      for (let i = 0; i < oldRaviCommsConsoleList.children.length; i++) {
        newRaviCommsConsoleList.appendChild(oldRaviCommsConsoleList.children[i]);
      }
      // ...and then delete the old one.
      let oldRaviCommsConsoleListParent = <HTMLElement> oldRaviCommsConsoleList.parentNode;
      if (oldRaviCommsConsoleListParent) {
        oldRaviCommsConsoleListParent.innerHTML = ``;
      }
    }

    commsConsoleListContainer.appendChild(newRaviCommsConsoleList);

    this.commsConsoleList = newRaviCommsConsoleList;

    document.addEventListener("logger", function(event: CustomEvent) {
      var listItem = document.createElement("li");
      var message = document.createTextNode(`${Date.now()}: ${event.detail}`);
      listItem.classList.add("raviLog");
      listItem.appendChild(message);
      this.commsConsoleList.appendChild(listItem);
      this._pruneCommsConsole();
    }.bind(this));

    document.addEventListener("errlogger", function(event: CustomEvent) {
      var listItem = document.createElement("li");
      var message = document.createTextNode(`${Date.now()}: ${event.detail}`);
      listItem.classList.add("raviError");
      listItem.appendChild(message);
      listItem.style.color = "red";
      this.commsConsoleList.appendChild(listItem);
      this._pruneCommsConsole();
    }.bind(this));
    
    RaviUtils.log("Comms console initialized.", "RaviConsole");
  }

  /**
   * Set the maximum number of log lines that should be used for the comms console.
   * Defaults to 80.
   *
   * @param {number} maxConsoleItems - The maximum number of log lines that you want to be
   * present in the comms console. 
   */
  setMaxConsoleItems(maxConsoleItems: number) {
    this._maxConsoleItems  = maxConsoleItems;
  }

  /**
   *  @private
   */
  _pruneCommsConsole() {

    var maxNumLogs = this._maxConsoleItems;
    let commsConsoleChildren = this.commsConsoleList.children;

    if (!commsConsoleChildren || commsConsoleChildren.length - maxNumLogs < 0) {
      return;
    }

    for (let i = 0; i < commsConsoleChildren.length - maxNumLogs; i++) {
      commsConsoleChildren[i].parentNode.removeChild(commsConsoleChildren[i]);
    }
  }
}
