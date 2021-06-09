import { HiFiMixerSession } from "../classes/HiFiMixerSession";
import { RaviSession, STATS_WATCHER_FILTER } from "../libravi/RaviSession";

const nonOperative = "non-operative";

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
let  browserStats: CandidateReport = {};
let remoteStats: CandidateReport = {};

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
    fireListener?: Function;

    constructor({url = "http://localhost:3000/disconnect-diagnostics", // FIXME: "https://highfidelity.com/disconnect-diagnostics",
                 label, session, ravi, fireOn = []}:{url?:string, label:string, session:HiFiMixerSession, ravi:RaviSession, fireOn?:Array<string>}) {
        Object.assign(this, {url, label, session, ravi, fireOn});
        this.checkPersisted();
        this.reset();
        this.fireListener = () => this.fire();
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
        this.fireOn.forEach(event => (document as any).addEventListener(event, this.fireListener));
    }
    /**
     * Call this when we get into a state that we want to know more about, e.g., when leaving the thing that caused us to prime().
     */
    fire() {
        if (!this.isPrimed()) return;
        const reportString = this.toString();
        if (!this.report(reportString)) {
            this.persist(reportString);
        }
        this.reset();
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
        this.fireOn.forEach(event => (document as any).removeEventListener(event, this.fireListener));
    }
    isPrimed() {
        return this.identifier !== nonOperative;
    }
    // strings...
    /**
     * Answer a single (long) log line to report.
     */
    toString() {
        return `${new Date().toISOString()} ${this.identifier}` +
            this.s('RAVISTATE', this.ravi.getState()) +
            this.stats('browserStats') +
            this.stats('mixerStats') +
            this.rtcInfo() +
            this.s('APPSTATE', this.session.getCurrentHiFiConnectionState()) +
            this.s('ONLINE', navigator.onLine ? 'yes' : 'no') +
            this.s('XPLICITCLOSED', this.explicitApplicationClose ? 'yes' : 'no') +
            this.visibilityInfo() +
            this.connectionInfo() +
            // TODO: totalPresent, rtc stats on dropped packets, etc
        ` [${navigator.userAgent}]`;
    }
    s(name:string, value:any) {
        let separator = isNaN(value) ? '_' : ':';
        return ` ${this.label}${name}${separator}${value}`;
    }
    connectionInfo() {
        const info:any = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection || {};
        return this.s('DEVICE', info.type) +
            this.s('RATING', info.effectiveType) +
            this.s('DL', info.downlink) +
            this.s('RTT', info.rtt);
    }
    visibilityInfo() {
        return this.s('VISIBLITY', document.visibilityState);
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
    rtcInfo() {
        return this.s('WebSocket', this.webSocket.readyState) +
            this.s('RTC', this.rtc.connectionState) +
            this.s('SIGNALING', this.rtc.signalingState) +
            this.s('ICE', this.rtc.iceConnectionState) +
            this.s('GATHERING', this.rtc.iceGatheringState);
    }
    stats(kind:string) {
        let report = kind === 'browserStats' ?  browserStats : remoteStats;
        return this.s(kind+'IP', report.ip || report.address) +
            this.s(kind+'TYPE', report.candidateType) +
            this.s(kind+'PROTOCOL', report.protocol);
    }
    
    // Phoning home...
    report(reportString:string) {
        if (!navigator.onLine) return false;
        console.warn(reportString); // FIXME: remove after testing.
        // FIXME: this will return true if the beacon is successfully queued, not sent.
        // Ultimately, we may need a verification (e.g., next session) to see if the previous identifier was logged.
        // We might also establish a handler for asynchronous failures. E.g., sending to bad url gives 405 in console.
        return navigator.sendBeacon(this.url, reportString);
    }
    /**
     * Add reportString to the set of data being saved for later reporting.
     */
    persist(reportString:string) {
        let existing = localStorage.getItem(this.label) || "";
        // By construction existing is expected to be empty or one line. It could have multiple lines if
        // there is a bug, or if the application site limits the connect-src (or default-src)
        // in its Content-Security-Policy header without allowing this.url.
        // If it is more than a line, we are accumulating stuff and really ought to phone home through the mixer when connected.
        if (existing) existing += "\n";
        window.localStorage.setItem(this.label, existing + reportString);
    }
    /**
     * If there's anything persisted, try to report it. If successful, clear persistence.
     */
    checkPersisted() {
        let existing = localStorage.getItem(this.label);
        if (!existing) return;
        if (!this.report(existing)) return;
        window.localStorage.removeItem(this.label);
    }
    // RTC stats...
    // Ravi only allows one stats collection function at a time, so we'll have to share
    // among all the diagnostics.
    static startStats(session:HiFiMixerSession) { // Results not defined if called with different session.
        if (nStatsClients++ > 0) return; // Someone primed before this call (and since the final reset).
        session.startCollectingWebRTCStats((previous:any, next:any) => {
            let selected = next.find((report:any) => report.writable || report.nominated),
                localReport = next.find((report:any) => report.id === selected.localCandidateId),
                remoteReport = next.find((report:any) => report.id === selected.remoteCandidateId);
            if (localReport)  browserStats = localReport;
            if (remoteReport) remoteStats = remoteReport;
        });
    }
    static stopStats(session:HiFiMixerSession) {
        if (!nStatsClients) return;
        if (--nStatsClients > 0) return;   // Someone is still primed.     
        session.stopCollectingWebRTCStats();
        browserStats = remoteStats = {};
    }
}

