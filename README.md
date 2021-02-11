# High Fidelity Spatial Audio Client Library
The High Fidelity Audio Client Library allows developers to integrate High Fidelity's spatial audio technology into their projects.


## Installation
### NodeJS
```
npm install hifi-spatial-audio
```

### Plain Web JavaScript
Import the latest version of the main library with:

```JavaScript
<script src="https://hifi-spatial-audio-api.s3-us-west-2.amazonaws.com/releases/latest/HighFidelityAudio-latest.js"></script>
```


## Documentation
API documentation is available at [docs.highfidelity.com](https://docs.highfidelity.com).


## Examples
You'll find a bunch of examples that make use of this API in the [Spatial-Audio-API-Examples GitHub Repository](https://github.com/highfidelity/Spatial-Audio-API-Examples).


## Walkthrough Guides
Walkthrough guides of sample applications written in plain Web JavaScript and written in NodeJS are available at [highfidelity.com/api/guides](https://highfidelity.com/api/guides).


## Super QuickStart - Web JavaScript
Here's a super basic version of how to use the High Fidelity Spatial Audio Client Library in the Web JavaScript context:

```JavaScript
<script src="https://hifi-spatial-audio-api.s3-us-west-2.amazonaws.com/releases/latest/HighFidelityAudio-latest.js"></script>
<script>
    // Set up the initial data for our user.
    // They'll be standing at the origin, facing "forward".
    let initialHiFiAudioAPIData = new HighFidelityAudio.HiFiAudioAPIData({
        position: new HighFidelityAudio.Point3D({ "x": 0, "y": 0, "z": 0 }),
        orientationEuler: new HighFidelityAudio.OrientationEuler3D({ "pitch": 0, "yaw": 0, "roll": 0 })
    });

    // Set up our `HiFiCommunicator` object, supplying our media stream and initial user data.
    let hifiCommunicator = new HighFidelityAudio.HiFiCommunicator({
        initialHiFiAudioAPIData: initialHiFiAudioAPIData
    });
    // `audioMediaStream` is obtained from a separate `getUserMedia()` call.
    await hifiCommunicator.setInputAudioMediaStream(audioMediaStream);

    // Connect to the HiFi Audio API server!
    // Supply your own JWT here.
    const HIFI_AUDIO_JWT = "";
    try {
        await hifiCommunicator.connectToHiFiAudioAPIServer(HIFI_AUDIO_JWT);
    } catch (e) {
        console.error(`Error connecting to High Fidelity:\n${e}`);
        return;
    }
</script>
```