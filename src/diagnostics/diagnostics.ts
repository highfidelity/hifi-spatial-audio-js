import { HiFiMixerSession } from "../classes/HiFiMixerSession";
import { RaviSession, STATS_WATCHER_FILTER } from "../libravi/RaviSession";
import { apiVersion } from "../index";


const isBrowser = typeof window !== 'undefined';
const noop = (_:any):any => undefined;
const xStorage = isBrowser ? window.localStorage : {getItem: noop, setItem: noop, removeItem: noop};
const xAddEventListener:any = isBrowser ? window.addEventListener : noop;
const xRemoveEventListener:any = isBrowser ? window.removeEventListener : noop;
const xDocument = isBrowser ? window.document : {visibilityState: true, addEventListener: noop, removeEventListener: noop};
const xNavigator = isBrowser ? window.navigator : {onLine: true, userAgent: `NodeJS ${(process.report.getReport() as any).header.nodejsVersion}`};
let xfetch = isBrowser && window.fetch;
if (!isBrowser) {
    try {
        xfetch = require('node-fetch');
    } catch (e) {
        ; // Remains falsey. Don't report, don't log
    }
}

const MAX_DIAGNOSTICS_STORAGE_LENGTH = 5000;

const nonOperative = "non-operative";

STATS_WATCHER_FILTER.set('remote-inbound-rtp',
                         STATS_WATCHER_FILTER.get('remote-inbound-rtp').concat(['packetsLost', 'totalRoundTripTime']));
STATS_WATCHER_FILTER.set('inbound-rtp',
                         STATS_WATCHER_FILTER.get('inbound-rtp').concat(['packetsLost', 'packetsReceived', 'jitter']));
STATS_WATCHER_FILTER.set('outbound-rtp', ['type', 'retransmittedPacketsSent', 'packetsSent']);

STATS_WATCHER_FILTER.set('candidate-pair', ['writable', 'state', 'nominated', 'localCandidateId', 'remoteCandidateId']);
STATS_WATCHER_FILTER.set('remote-candidate', ['id', 'address', 'ip', 'candidateType', 'protocol']);
STATS_WATCHER_FILTER.set('local-candidate', ['id', 'address', 'ip', 'candidateType', 'protocol']);

interface CandidateReport {
    ip?: string;
    address?: string;
    candidateType?: string;
    protocol?: string;
}
let nStatsClients = 0;
let browserStats: CandidateReport = {};
let remoteStats: CandidateReport = {};
let reports:any = {
    'outbound-rtp': {},
    'inbound-rtp': {},
    'remote-inbound-rtp': {}
};
const useDebugPrefixes = false;
const directSendLabel = 'directSend';

/** 
 * @internal
 * This is not general purpose, but specifically in support of internal HiFidelity connection failures.
 * It is not intended to be supported for long term.
 *
 * An instance of Diagnostics maintains a set of information, and has operations to update that information, and to report it.
 * There can be multiple such instances, that are reported in different circumstances.
 */
export class Diagnostics {
    label: string;
    url: string;
    identifier: string;
    session: HiFiMixerSession;
    ravi: RaviSession;
    explicitApplicationClose: boolean;
    webSocket: any;
    rtc: any;
    fireOn: Array<string>;
    fireListener: Function;
    onlineListener: Function;

    constructor({url = "https://webrtc-diag.highfidelity.com/api/v1/logs/post_logs",
                 label, session, ravi, fireOn = []}:{url?:string, label:string, session:HiFiMixerSession, ravi:RaviSession, fireOn?:Array<string>}) {
        Object.assign(this, {url, label, session, ravi, fireOn});
        this.checkPersisted();
        this.reset();
        this.fireListener = (event:any) => this.fire(event.type);
        this.onlineListener = () => this.checkPersisted();
    }
    /** 
     * An instance is primed when entering the state we are interested in, until the report is fired.
     */
    prime(identifier:string) { // e.g., hashedVisitID. Do NOT use any personally identifiable information. Data is a liability, not an asset.
        if (this.isPrimed()) return;
        this.checkPersisted(); // Because this is a likely time to be successful.
        this.identifier = identifier;
        this.grabRTCInternals();
        Diagnostics.startStats(this.session);
        this.fireOn.forEach(event => (xDocument as any).addEventListener(event, this.fireListener));
    }
    /**
     * Call this when we get into a state that we want to know more about, e.g., when leaving the thing that caused us to prime().
     */
    async fire(eventName:string) {
        if (!this.isPrimed()) return;
        const reportString = this.toString(eventName);
        this.reset();
        // When we fire on closing tab or browser, we sometimes don't have enough time to report, or
        // sometimes have enough time to report, but not enough to check the response.
        // So:
        // 1. Persist the report with a label that indicates we have not yet phoned it in.
        // 2. Report the original report text with no special label.
        // 3. IFF we get a chance to execute after the report, then either
        //      Send a report with a failed label, or
        //      clean up so that we don't report again.
        // As a result, the following are all possible:
        //   No report can happen if we get stopped during (1), or if stopped during (2) and the user never connects again.
        //   PERISTENCE=premptive if we get through (2) and the user reconnects.
        //   Two reports, one with premptive and one with directSend, if we get stopped between 2 and 3.
        //   PERSISTENCE=directSend (or unlikely, fail), if we get through all 3 steps.
        this.persist(reportString, 'preemptive', false); // Save in case the browser doesn't give us enough time to send.
        if (! await this.report(reportString)) {
            this.persist(reportString, 'failed');
        } else { // Successful report. 
            xStorage.removeItem(this.label);
        }
    }
    noteExplicitApplicationClose() {
        this.explicitApplicationClose = true;
    }

    // Mostly internal stuff.
    // state...
    /**
     * The opposite of prime(). Usually internal to the operations of the Diagnostics, but can be called from outside.
     */
    reset() {
        Diagnostics.stopStats(this.session);
        this.identifier = nonOperative;
        this.explicitApplicationClose = false;
        this.webSocket = this.rtc = {};
        // don't leave them hanging around. E.g., beforeunload can mess with the bfcache.
        this.fireOn.forEach(event => (xDocument as any).removeEventListener(event, this.fireListener));
    }
    isPrimed() {
        return this.identifier !== nonOperative;
    }
    // strings...
    /**
     * Answer a single (long) log line to report.
     */
    toString(eventName:string) {
        return `${new Date().toISOString()} ${this.identifier} ` +
            this.s('logReason', 'sessionEND') +
            this.connectionStats('browserStats') +
            this.connectionStats('mixerStats') +
            this.rtpStats() +
            this.rtcStates() +
            this.s('NUM_CONNECTED', this.session.concurrency, '\n') +
            this.s('APPSTATE', this.session.getCurrentHiFiConnectionState(), '\n') +
            this.s('RAVISTATE', this.ravi.getState()) +
            this.s('ONLINE', xNavigator.onLine ? 'yes' : 'no') +
            this.s('XPLICITCLOSED', this.explicitApplicationClose ? 'yes' : 'no') +
            this.visibilityInfo() +
            this.connectionInfo() +
            this.s('PERSISTENCE', directSendLabel) +
            this.s('VERSION', apiVersion) +
            this.s('EVENT', eventName) +
            (useDebugPrefixes ? '\n' : '') +
            ` [${xNavigator.userAgent}]`;
    }
    s(name:string, value:any, debugPrefix = '') {
        let separator = isNaN(value) ? '_' : ':';
        return `${useDebugPrefixes ? debugPrefix : ''} ${this.label}${name}${separator}${value}`;
    }
    connectionInfo() {
        const info:any = (xNavigator as any).connection || (xNavigator as any).mozConnection || (xNavigator as any).webkitConnection || {};
        return this.s('DEVICE', info.type, '\n') +
            this.s('RATING', info.effectiveType) +
            this.s('DL', info.downlink) +
            this.s('RTT', info.rtt);
    }
    visibilityInfo() {
        return this.s('VISIBLITY', xDocument.visibilityState);
    }
    /**
     * When we fire, I'd like to directly ask the RTCPeerConnection and our signaling WebSocket some questions, as a sanity check
     * that things match the Ravi state. But if all goes well, we've already released them. So here we grab them while we can and
     * hold our own references, to be cleared on reset();
     */ 
    grabRTCInternals() {
        let ravi:any = this.ravi,
            raviRTC:any = ravi._raviImplementation,
            signaling:any = raviRTC._signalingConnection._signalingImplementation;
        this.webSocket = signaling._webSocket;
        this.rtc = raviRTC._rtcConnection;
    }
    rtcStates() {
        // This bizarre pattern is to get as much info as possible, even from browsers such as Firefox that
        // throw errors for some properties.
        let collector:any = {},
            safelyGet = (property:string, source:any = this.rtc) => {
                try {
                    collector[property] = source[property];
                } catch (e) {
                    collector[property] = e.name;
                }
            };
        safelyGet('readyState', this.webSocket);
        ['connectionState', 'signalingState', 'iceConnectionState','iceGatheringState'].forEach(p => safelyGet(p));
        return this.s('WebSocket', collector.readyState, '\n') +
            this.s('RTC', collector.connectionState) +
            this.s('SIGNALING', collector.signalingState) +
            this.s('ICE', collector.iceConnectionState) +
            this.s('GATHERING', collector.iceGatheringState);
    }
    connectionStats(kind:string) {
        let report = kind === 'browserStats' ?  browserStats : remoteStats;
        if (!report) return ''; // Can happen with bots.
        return this.s(kind+'IP', report.ip || report.address, '\n') +
            this.s(kind+'TYPE', report.candidateType) +
            this.s(kind+'PROTOCOL', report.protocol);
    }
    rtpStats() {
        let s:string = '';
        Object.keys(reports).forEach(reportName => {
            let report = reports[reportName],
                first = true;
            Object.keys(report).forEach(propertyName => {
                s += this.s(`${reportName}_${propertyName}`, report[propertyName], first ? '\n' : '');
                first = false;
            });
        });
        return s;
    }
    
    // Phoning home...
    /**
     * Return success, or a promise for success.
     */
    report(reportString:string) {
        if (!xNavigator.onLine) return false;
        if (!xfetch) return false;
        console.log(reportString);
        // This will return true if the beacon is successfully queued, not sent.
        // Ultimately, we would need a verification (e.g., next session) to see if the previous identifier was logged.
        // A failure gets logged to console in some browsers, but they don't actually emit an error event.
        // return navigator.sendBeacon(this.url, reportString);
        // Instead, let's POST exactly as sendBeacon would, and check success:
        return xfetch(this.url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: reportString
        }).then((response:Response) => response.ok)
          .catch((err) => { console.log(`Could not send diagnostics report for ${this.label} to ${this.url}: ${err}`); return false; });
    }
    /**
     * Add reportString to the set of data being saved for later reporting.
     */
    persist(reportString:string, reason:string, addListener = true) {
        let existing = xStorage.getItem(this.label) || "";
        // By construction existing is expected to be empty or one line. It could have multiple lines if
        // there is a bug, or if the application site limits the connect-src (or default-src)
        // in its Content-Security-Policy header without allowing this.url.
        // If it is more than a line, we are accumulating stuff and really ought to phone home through the mixer when connected.
        if (existing) {
            if (existing.length > MAX_DIAGNOSTICS_STORAGE_LENGTH) {
                // If it is many lines, we may be in a web context where we cannot send diagnostics lines, and are better off discarding them to conserve web storage
                console.log(`Diagnostics for ${this.label} truncated`);
                existing = "";
            }
            existing += "\n";
        }
        // The reportString is generated as through it will be sent directly. Here we replace that label with a reason why we're persisting.
        reportString = reportString.replace(directSendLabel, reason);
        xStorage.setItem(this.label, existing + reportString);
        // An optimization to get caught up on data quicker in the case where network is lost and returns while tab is still up.
        if (addListener) xAddEventListener('online', this.onlineListener);
    }
    /**
     * If there's anything persisted, try to report it. If successful, clear persistence.
     */
    async checkPersisted() {
        xRemoveEventListener('online', this.onlineListener);
        let existing = xStorage.getItem(this.label);
        if (!existing) return;
        if (! await this.report(existing)) return;
        xStorage.removeItem(this.label);
    }
    // RTC stats...
    // Ravi only allows one stats collection function at a time, so we'll have to share
    // among all the diagnostics.
    static startStats(session:HiFiMixerSession) { // Results not defined if called with different session.
        if (nStatsClients++ > 0) return; // Someone primed before this call (and since the final reset).
        session.startCollectingWebRTCStats((next:any, previous:any) => {
            let selected = next.find((report:any) => report.writable || report.nominated);
            if (!selected) return; // Can happen on bots.
            let localReport = next.find((report:any) => report.id === selected.localCandidateId),
                remoteReport = next.find((report:any) => report.id === selected.remoteCandidateId);
            if (localReport)  browserStats = localReport;
            if (remoteReport) remoteStats = remoteReport;
            function note(type:string, deltaProperties:Array<string>, absoluteProperties:Array<string> = []) {
                function findReport(list:any) {
                    return list.find((report:any) => {
                        return report.type == type;
                    });
                }
                let previousReport = findReport(previous),
                    nextReport = findReport(next);
                deltaProperties.forEach(property => reports[type][property] =
                                        nextReport && (nextReport[property] - (previousReport ? previousReport[property] : 0)));
                absoluteProperties.forEach(property => reports[type][property] =
                                           nextReport && nextReport[property]);
            }
            note('outbound-rtp', ['retransmittedPacketsSent', 'packetsSent']);
            note('inbound-rtp', ['packetsLost', 'packetsReceived'], ['jitter']);
            note('remote-inbound-rtp', ['packetsLost'], ['roundTripTime', 'totalRoundTripTime', 'jitter']);
        });
    }
    static stopStats(session:HiFiMixerSession) {
        if (!nStatsClients) return;
        if (--nStatsClients > 0) return;   // Someone is still primed.     
        session.stopCollectingWebRTCStats();
        browserStats = remoteStats = {};
        for (let key in reports) { reports[key] = {}; }
    }
}

