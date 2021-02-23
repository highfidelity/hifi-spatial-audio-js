import { HiFiCommunicator } from "../../../src/classes/HiFiCommunicator";
import fetch, {Response} from 'node-fetch';
import secrets from '../../secrets/auth.json';

describe('HiFiCommunicator in node context', () => {
  let hifiCommunicator = new HiFiCommunicator();

  test(`'connectToHiFiAudioAPIServer' by ID connects`, async () => {
    let returnMessage = await hifiCommunicator.connectToHiFiAudioAPIServer(secrets.app.jwt, 'api-staging.highfidelity.com');

    expect(fetch).toHaveBeenCalledTimes(1);
    // expect(fetch).toHaveBeenCalledWith('http://website.com/users', {
    //   method: 'POST',
    // });
    expect(returnMessage).toBe(successReturn);
  });

  test(`'connectToHiFiAudioAPIServer' by ID connects`, async () => {
    let returnMessage = await hifiCommunicator.connectToHiFiAudioAPIServer(null, null);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('http://website.com/users', {
      method: 'POST',
    });
    expect(returnMessage).toBe(errReturn);
  });
  
  test(`'connectToHiFiAudioAPIServer' by name with non-existant space ID fails`, async () => {
    let returnMessage = await hifiCommunicator.connectToHiFiAudioAPIServer(null, null);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('http://website.com/users', {
      method: 'POST',
    });
    expect(returnMessage).toBe(errReturn);
  });

  test(`'connectToHiFiAudioAPIServer' by name with non-existant space ID fails`, async () => {
    let returnMessage = await hifiCommunicator.connectToHiFiAudioAPIServer(null, null);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('http://website.com/users', {
      method: 'POST',
    });
    expect(returnMessage).toBe(errReturn);
  });

  afterAll(() => {
    return hifiCommunicator.disconnectFromHiFiAudioAPIServer();
  });
});