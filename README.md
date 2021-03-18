<img src="./utilities/spatialAudioLogo.svg" alt="High Fidelity Spatial Audio" width="375"/>

&nbsp;  

[![npm](https://img.shields.io/npm/v/hifi-spatial-audio?style=flat-square)](https://www.npmjs.com/package/hifi-spatial-audio)
[![npm](https://img.shields.io/npm/dm/hifi-spatial-audio?style=flat-square)](https://www.npmjs.com/package/hifi-spatial-audio)

[![GitHub Workflow Status (event)](https://img.shields.io/github/workflow/status/highfidelity/hifi-spatial-audio-js/Run-Jest-Unit-Tests?label=automated%20tests&style=flat-square)](https://github.com/highfidelity/hifi-spatial-audio-js/actions/workflows/run-unit-tests.yml)
[![GitHub issues](https://img.shields.io/github/issues/highfidelity/hifi-spatial-audio-js?style=flat-square)](https://github.com/highfidelity/hifi-spatial-audio-js/issues)

[![Discord](https://img.shields.io/discord/789545374837768242?label=discord&style=flat-square)](https://discord.gg/GrhxWPrp)
[![Twitter Follow](https://img.shields.io/twitter/follow/HighFidelityXR?style=flat-square)](https://twitter.com/HighFidelityXR)

The High Fidelity Spatial Audio Client Library allows developers to integrate High Fidelity's spatial audio technology into their projects.

## Installation
### NodeJS
```
npm i hifi-spatial-audio
```

### Plain Web JavaScript
Import the latest version of the main library with:

```JavaScript
<script src="https://hifi-spatial-audio-api.s3-us-west-2.amazonaws.com/releases/latest/HighFidelityAudio-latest.js"></script>
```

## You'll Need a Developer Account
To use the Spatial Audio API, you'll need to sign up for a High Fidelity Developer Account. Sign up for free at [account.highfidelity.com](https://account.highfidelity.com).

## Documentation
API documentation is available at [docs.highfidelity.com](https://docs.highfidelity.com).

## Examples
You'll find a bunch of examples that make use of this API in the [Spatial-Audio-API-Examples GitHub Repository](https://github.com/highfidelity/Spatial-Audio-API-Examples).

## Walkthrough Guides
Walkthrough guides of sample applications written in plain Web JavaScript and written in NodeJS are available at [highfidelity.com/api/guides](https://highfidelity.com/api/guides).

## Release Notes
Release notes for the Spatial Audio Client Library are available on [the GitHub releases page](https://github.com/highfidelity/hifi-spatial-audio-js/releases).

-----

## Super QuickStart - Web JavaScript
Here's a super basic version of how to use the High Fidelity Spatial Audio Client Library in the Web JavaScript context:

```JavaScript
<script src="https://hifi-spatial-audio-api.s3-us-west-2.amazonaws.com/releases/latest/HighFidelityAudio-latest.js"></script>
<script>
    // Set up the initial data for our user.
    // They'll be standing at the origin, facing "forward".
    let initialHiFiAudioAPIData = new HighFidelityAudio.HiFiAudioAPIData({
        position: new HighFidelityAudio.Point3D({ "x": 0, "y": 0, "z": 0 }),
        orientation: new HighFidelityAudio.OrientationQuat3D({ "w": 1, "x": 0, "y": 0, "z": 0 })
    });

    // Set up our `HiFiCommunicator` object, supplying our media stream and initial user data.
    let hifiCommunicator = new HighFidelityAudio.HiFiCommunicator({
        initialHiFiAudioAPIData: initialHiFiAudioAPIData
    });
    // `audioMediaStream` is obtained from a separate `getUserMedia()` call.
    await hifiCommunicator.setInputAudioMediaStream(audioMediaStream);

    // Connect to the High Fidelity Audio Spatial API Server by supplying your own JWT here.
    // Follow this guide to get a JWT: https://www.highfidelity.com/api/guides/misc/getAJWT
    // If you don't need a guide, obtain JWT credentials after signing up for a developer account at https://account.highfidelity.com/dev/account
    const HIFI_AUDIO_JWT = "";
    try {
        await hifiCommunicator.connectToHiFiAudioAPIServer(HIFI_AUDIO_JWT);
    } catch (e) {
        console.error(`Error connecting to High Fidelity:\n${e}`);
        return;
    }
</script>
```

---

## Living on the Edge
If you'd like to use an experimental version of the Spatial Audio Client library built automatically from the tip of the `main` branch:

### NodeJS
```
npm i hifi-spatial-audio@main
```

### Plain Web JavaScript
Import the experimental version of the main library with:

```JavaScript
<script src="https://hifi-spatial-audio-api.s3-us-west-2.amazonaws.com/releases/main/HighFidelityAudio-latest.js"></script>
```