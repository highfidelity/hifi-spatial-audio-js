import { HiFiLogger, HiFiLogLevel } from "../../../../src/utilities/HiFiLogger";

test(`the default log level is Error`, () => {
    expect(HiFiLogger.log('Log: If you see this, a test has failed!')).toBe(false);
    expect(HiFiLogger.warn('Warn: If you see this, a test has failed!')).toBe(false);
    expect(HiFiLogger.error('Error: If you see this, a test has succeeded!')).toBe(true);
});

test(`we won't log warnings to the console if our log level is error`, () => {
    HiFiLogger.setHiFiLogLevel(HiFiLogLevel.Error);
    expect(HiFiLogger.warn('If you see this, a test has failed!')).toBe(false);
});