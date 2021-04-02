/**
 * This Module contains a number of useful utility functions that API users can use in their applications if they wish.
 * Some of them are also used internally in API code.
 * @packageDocumentation
 */

import { HiFiLogger } from "./HiFiLogger";

function dynamicRequire(mod: any, requireString: string): any {
    return mod.require(requireString);
}

let now:any;
if (typeof self === 'undefined') {
    // node context
    try {
        now = dynamicRequire(module, 'perf_hooks').performance.now; // Used with `preciseInterval()`.
    } catch {}
}

export class HiFiUtilities {
    constructor() { }

    /**
     * Returns a JS Object containing the differences between the two passed objects.
     * 
     * This function was adapted from [this very helpful document on GoMakeThings]{@link https://gomakethings.com/getting-the-differences-between-two-objects-with-vanilla-js/}.
     * The original function is licensed under the MIT license.
     * 
     * @param obj1 
     * @param obj2 
     */
    static recursivelyDiffObjects(obj1: any, obj2: any): any {
        // Make sure an object to compare is provided
        if (!obj2 || Object.prototype.toString.call(obj2) !== '[object Object]') {
            return obj1;
        }

        //
        // Variables
        //
        let diffs: any = {};
        let key;

        let doArraysMatch = (arr1: Array<any>, arr2: Array<any>) => {
            // Check if the arrays are the same length
            if (arr1.length !== arr2.length) {
                return false;
            }

            // Check if all items exist and are in the same order
            for (let i = 0; i < arr1.length; i++) {
                if (arr1[i] !== arr2[i]) {
                    return false;
                }
            }

            // Otherwise, return true
            return true;
        };

        // Compare two items and push non-matches to object
        let compare = (item1: any, item2: any, key: string) => {
            // Get the object type
            let type1 = Object.prototype.toString.call(item1);
            let type2 = Object.prototype.toString.call(item2);

            // If type2 is undefined it has been removed
            if (type2 === '[object Undefined]') {
                diffs[key] = null;
                return;
            }

            // If items are different types
            if (type1 !== type2) {
                diffs[key] = item2;
                return;
            }

            // If an object, compare recursively
            if (type1 === '[object Object]') {
                let objDiff = HiFiUtilities.recursivelyDiffObjects(item1, item2);
                if (Object.keys(objDiff).length > 0) {
                    diffs[key] = objDiff;
                }
                return;
            }

            // If an array, compare
            if (type1 === '[object Array]') {
                if (!doArraysMatch(item1, item2)) {
                    diffs[key] = item2;
                }
                return;
            }

            // Else if it's a function, convert to a string and compare
            // Otherwise, just compare
            if (type1 === '[object Function]') {
                if (item1.toString() !== item2.toString()) {
                    diffs[key] = item2;
                }
            } else {
                if (item1 !== item2) {
                    diffs[key] = item2;
                }
            }
        };

        // Loop through the first object
        for (key in obj1) {
            if (obj1.hasOwnProperty(key)) {
                compare(obj1[key], obj2[key], key);
            }
        }

        // Loop through the second object and find missing items
        for (key in obj2) {
            if (obj2.hasOwnProperty(key)) {
                if (!obj1[key] && obj1[key] !== obj2[key]) {
                    diffs[key] = obj2[key];
                }
            }
        }

        // Return the object of differences
        return diffs;
    };

    /**
     * @returns The "best" audio constraints supported by the client. In this case, "best" is defined as "the constraints that will produce the highest-quality audio."
     * That means disabling Echo Cancellation, disabling Noise Suppression, and disabling Automatic Gain Control.
     */
    static getBestAudioConstraints(): any {
        let audioConstraints: any = {};

        if (typeof (navigator) !== "undefined" && typeof (navigator.mediaDevices) !== "undefined" && typeof (navigator.mediaDevices.getSupportedConstraints) !== "undefined" && navigator.mediaDevices.getSupportedConstraints().echoCancellation) {
            audioConstraints.echoCancellation = false;
        }

        if (typeof (navigator) !== "undefined" && typeof (navigator.mediaDevices) !== "undefined" && typeof (navigator.mediaDevices.getSupportedConstraints) !== "undefined" && navigator.mediaDevices.getSupportedConstraints().noiseSuppression) {
            audioConstraints.noiseSuppression = false;
        }

        if (typeof (navigator) !== "undefined" && typeof (navigator.mediaDevices) !== "undefined" && typeof (navigator.mediaDevices.getSupportedConstraints) !== "undefined" && navigator.mediaDevices.getSupportedConstraints().autoGainControl) {
            audioConstraints.autoGainControl = false;
        }

        return audioConstraints;
    }

    /**
     * `preciseInterval()` is a version of `setInterval()` for NodeJS that does not spin CPUs nor drift.
     * The returned value is an object with a `clear()` methods that stops the interval.
     * In the browser context, `preciseInterval()` is simply a wrapper for `setInterval()`.
     * 
     * We do three things:
     * 1. Keep a running counter of when the next call should be, to avoid drift.
     * 2. Compute the time to the next call and give that to `setTimeout()`.
     * 3. Our average error with the above is about 1ms (so half the intervals are off by more).
     * So in #2, shoot for 2 ms less than that, and spin with setImmediate (allowing other stuff to run) until we've reached the expected time.
     * 
     * For a 10ms interval, we measured an **average** error per interval of:
     * - `1.67 ms` for `setInterval()` (so SOMETHING is ticking at 60 Hz).
     * - `~1 ms` for this code WITHOUT #3, using `Date.getTime()`
     * - `~1 ms` for this code WITHOUT #3, using `perf_hooks.performance.now()`
     * - `0.86 ms` for this code using `Date.getTime()`
     * - `0.03 ms` for this code using `perf_hooks.performance.now()`
     * 
     * 
     * @param callback - The function to call when the precise interval expires.
     * @param intervalMS - The number of milliseconds to wait between each interval.
     */
    static preciseInterval(callback: Function, intervalMS: number): any {
        if (!now) {
            HiFiLogger.warn(`\`preciseInterval()\` is a wrapper for \`setInterval()\` in the browser context!`);
            return setInterval(callback, intervalMS);    
        }
    
        let nextTick = now();
        let clear:any = clearTimeout;
        let wrapper = () => {
            let thisTick = now();
            if (thisTick < nextTick) {
                clear = clearImmediate;
                return timeout = setImmediate(wrapper);
            }
            nextTick += intervalMS;
            clear = clearTimeout;
            timeout = setTimeout(wrapper, nextTick - thisTick - 2);
            callback();
        };
        let timeout:any = setTimeout(wrapper);
        return { clear: () => clear(timeout) };
    }

    static checkBrowserCompatibility(): Boolean {
        let requiredFeatures: Array<string> = [
            // Navigator mediaDevices
            "navigator", // Found on source code HiFiMixerSession.ts, RaviStreamController.ts
            "navigator.mediaDevices.getUserMedia", // Found on source code HiFiMixerSession.ts (ln.590)
            "navigator.mediaDevices.getSupportedConstraints", // Found on source code HiFiUtilities (ln. 130, 134, 138)
            // WebRTC
            "window.MediaStream", // Found on source code HiFiCommunicator.ts, HiFiMixerSession.ts, RaviSession.ts, RaviStreamController.ts
            "window.RTCDataChannel", // Found on source code RaviCommandController.ts (ln.151)
            "window.RTCPeerConnection", // Found on source code RaviSession.ts (ln.603)
            "window.RTCSessionDescription" // Found on source code RaviSession.ts (ln.604)
        ]
        for (let i = 0; i < requiredFeatures.length; i++) {
            if (typeof (eval(requiredFeatures[i])) === "undefined") {
                HiFiLogger.error("HiFi Audio API: The browser does not support: " + requiredFeatures[i]);
                if (requiredFeatures[i] === "navigator.mediaDevices.getUserMedia") {
                    HiFiLogger.error("HiFi Audio API: Your browser may be preventing access to this feature if you are running in an insecure context, i.e. an `http` server.");
                }
                return false;
            }
        }
        return true;
    }

    static nonan(v: number, ifnan: number): number {
        return (isNaN(v) ? ifnan : v);
    }

    static clamp(v: number, min: number, max: number): number {
        // if v is Nan returns Nan
        return (v > max ? max : (v < min ? min : v));
    }

    static clampNonan(v: number, min: number, max: number, ifnan: number): number {
        return (v > max ? max : (v < min ? min : HiFiUtilities.nonan(v, ifnan)));
    }

    static clampNormalized(v: number): number {
        // if v is Nan returns Nan
        return (v > 1.0 ? 1.0 : (v < -1.0 ? -1.0 : v));
    }
}
