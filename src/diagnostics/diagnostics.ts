import { HiFiMixerSession } from "../classes/HiFiMixerSession";
import { RaviSession, STATS_WATCHER_FILTER } from "../libravi/RaviSession";

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
let reports:any;
const useDebugPrefixes = true;

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

    constructor({url = "http://localhost:3000/disconnect-diagnostics", // FIXME: "https://highfidelity.com/disconnect-diagnostics",
                 label, session, ravi, fireOn = []}:{url?:string, label:string, session:HiFiMixerSession, ravi:RaviSession, fireOn?:Array<string>}) {
        Object.assign(this, {url, label, session, ravi, fireOn});
        this.checkPersisted();
        this.reset();
        this.fireListener = () => this.fire();
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
        this.fireOn.forEach(event => (document as any).addEventListener(event, this.fireListener));
    }
    /**
     * Call this when we get into a state that we want to know more about, e.g., when leaving the thing that caused us to prime().
     */
    async fire() {
        if (!this.isPrimed()) return;
        const reportString = this.toString();
        if (! await this.report(reportString)) {
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
        reports = {
            'outbound-rtp': {},
            'inbound-rtp': {},
            'remote-inbound-rtp': {}
        }
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
            this.connectionStats('browserStats') +
            this.connectionStats('mixerStats') +
            this.rtpStats() +
            this.rtcStates() +
            this.s('CONCURRENCY', this.session.concurrency, '\n') +
            this.s('APPSTATE', this.session.getCurrentHiFiConnectionState(), '\n') +
            this.s('RAVISTATE', this.ravi.getState()) +
            this.s('ONLINE', navigator.onLine ? 'yes' : 'no') +
            this.s('XPLICITCLOSED', this.explicitApplicationClose ? 'yes' : 'no') +
            this.visibilityInfo() +
            this.connectionInfo() +
            (useDebugPrefixes ? '\n' : '') +
            ` [${navigator.userAgent}]`;
    }
    s(name:string, value:any, debugPrefix = '') {
        let separator = isNaN(value) ? '_' : ':';
        return `${useDebugPrefixes ? debugPrefix : ''} ${this.label}${name}${separator}${value}`;
    }
    connectionInfo() {
        const info:any = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection || {};
        return this.s('DEVICE', info.type, '\n') +
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
        ['connectionState', 'signalingState', 'iceConnctionState','iceGatheringState'].forEach(p => safelyGet(p));
        return this.s('WebSocket', collector.readyState, '\n') +
            this.s('RTC', collector.connectionState) +
            this.s('SIGNALING', collector.signalingState) +
            this.s('ICE', collector.iceConnectionState) +
            this.s('GATHERING', collector.iceGatheringState);
    }
    connectionStats(kind:string) {
        let report = kind === 'browserStats' ?  browserStats : remoteStats;
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
        if (!navigator.onLine) return false;
        console.warn(reportString); // FIXME: remove after testing.
        // This will return true if the beacon is successfully queued, not sent.
        // Ultimately, we would need a verification (e.g., next session) to see if the previous identifier was logged.
        // A failure gets logged to console in some browsers, but they don't actually emit an error event.
        // return navigator.sendBeacon(this.url, reportString);
        // Instead, let's POST exactly as sendBeacon would, and check success:
        return fetch(this.url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: reportString
        }).then((response:Response) => response.ok, () => false);
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
        // An optimization to get caught up on data quicker in the case where network is lost and returns while tab is still up.
        (window as any).addEventListener('online', this.onlineListener);
    }
    /**
     * If there's anything persisted, try to report it. If successful, clear persistence.
     */
    async checkPersisted() {
        (window as any).removeEventListener('online', this.onlineListener);
        let existing = localStorage.getItem(this.label);
        if (!existing) return;
        if (! await this.report(existing)) return;
        window.localStorage.removeItem(this.label);
    }
    // RTC stats...
    // Ravi only allows one stats collection function at a time, so we'll have to share
    // among all the diagnostics.
    static startStats(session:HiFiMixerSession) { // Results not defined if called with different session.
        if (nStatsClients++ > 0) return; // Someone primed before this call (and since the final reset).
        session.startCollectingWebRTCStats((next:any, previous:any) => {
            let selected = next.find((report:any) => report.writable || report.nominated),
                localReport = next.find((report:any) => report.id === selected.localCandidateId),
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
    }
}

