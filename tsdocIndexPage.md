# High Fidelity Spatial Audio Client API Documentation
The High Fidelity Spatial Audio Client API allows developers to integrate High Fidelity's spatial audio technology into their projects.

# API Modules
The API code consists of several modules, including:

## classes/HiFiCommunicator
Methods on the `HiFiCommunicator` class allow developers to perform many actions, including:
- `connectToHiFiAudioAPIServer()`: Connect to and disconnect from the High Fidelity Audio Server
- `setInputAudioMediaStream()`: Set a new input audio media stream (for example, when the user's audio input device changes)
- `updateUserDataAndTransmit()`: Update the user's data (position, orientation, etc) on the High Fidelity Audio Server

## classes/HiFiAudioAPIData
This module contains several classes, all of which are relevant to data about a user in the virtual 3D environment.

For example, the `HiFiAudioAPIData` class contains all of the data that is sent to and received from the High Fidelity Audio Server.

`HiFiAudioAPIData.position` is an instantiation of the `Point3D` class, which defines a position in 3D space.

## Note
To get started quickly with the High Fidelity Audio Client API, it is not necessary to learn about any other modules! Overviews of other modules can be found on that module's documentation page.

# Walkthrough Guides
Walkthrough guides of sample applications written in plain Web JavaScript and written in NodeJS are available at [highfidelity.com/api/guides](https://highfidelity.com/api/guides).

# Installation
## NodeJS
```
npm install hifi-spatial-audio
```

Then, import the necessary modules into your NodeJS application using code at the top of your file like:

```JavaScript
const { Point3D, HiFiCommunicator } = require("hifi-spatial-audio");
```

## Plain Web JavaScript
Import the latest version of the main library with:

```JavaScript
<script src="https://hifi-spatial-audio-api.s3-us-west-2.amazonaws.com/releases/latest/HighFidelityAudio-latest.js"></script>
```

We also maintain and supply an optional "High Fidelity Controls" library that can be used to more quickly integrate human interface device controls into a Web application. Import the latest version of the High Fidelity Controls library with:

```JavaScript
<script src="https://hifi-spatial-audio-api.s3-us-west-2.amazonaws.com/releases/latest/HighFidelityControls-latest.js"></script>
```
