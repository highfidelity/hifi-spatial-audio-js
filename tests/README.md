# JEST AUTOMATED TESTING INFO

## File structure for `tests` folder

    tests  
    ├── integration  
    │   └── serverConnections.integration.test.ts  
    ├── secrets  
    │   ├── auth.json  (You will create this file for local smoke or integration testing.)  
    │   ├── auth.json.gpg  (An encrypted version of `auth.json` for the `staging-latest` stack used by GHA.)  
    │   └── auth_example.json  (A template for creating your own `auth.json` file.)
    ├── smoke  
    │   └── rest.smoke.test.ts  
    ├── testUtilities  
    │   ├── globalTeardown.js  (A file used to ensure all `HiFiCommunicator` instances get shut down after testing.)
    │   ├── testUser.ts  (A test user class.)
    │   └── testUtils.ts  
    ├── unit  
    │   └── src  
    │       ├── classes  
    │       │   ├── HiFiAudioAPIData.unit.test.ts  
    │       │   ├── HiFiCommunicator.unit.test.ts  
    │       │   └── HiFiMixerSession.unit.test.ts  
    │       ├── libravi  
    │       └── utilities  
    │           └── HiFiLogger.unit.test.ts  
    └── README.md  

To run all tests locally against 'staging-latest', type `jest test` into the console. All files in the `tests` directory and subdirectories ending in `.test.ts` will run.

## Local Smoke Testing on 'staging-latest'

Smoke testing will test multiple modules working together using real server connections by running a series of instructions in a typical usage scenario for the API. For example, one test might create a space within an app, edit its settings, and then delete the space. This should be run manually after a new deploy to ensure nothing is broken. To run only smoke tests, type `jest smoke` into the console. All files in the `tests/smoke` directory ending in `.test.ts` will run.

## Local Unit Testing on 'staging-latest'

Unit testing will test each part of the API to show that the individual functions are correct. These tests will not use real server connections and will mock any external pieces that a function relies on. These tests will run automatically via GHA before any code is merged and can be run manually from the console or from GHA workflow dispatch. To run only unit tests, type `jest unit` into the console. All files in the `tests/unit` directory and subdirectories ending in `.test.ts` will run.

## Local Integration Testing on 'staging-latest'

Integration testing will combine different modules in the API and test individual functions using actual server connections. These tests will run automatically via GHA before any code is merged and can be run manually from the console or from GHA workflow dispatch. To run only integration tests, type `jest integration` into the console. All files in the `tests/integration` directory ending in `.test.ts` will run.

## Testing against other stacks
To test any stack other than 'staging-latest', you will need to input the stack name as an arg when running jest from the console. First, update your `auth.json` file with the data for the stack you want to test against. When ready to test, you will need to run Jest via a node script. The following example runs one specific test file against the main production stack. 

```
npm run test serverConnections.integration.test.ts --hostname api.highfidelity.com
```

### Secrets and Account Setup
Since integration and smoke tests require actual server connections (as opposed to mock functions and connections), you will need to set up an account with some preset apps and spaces and a way to access private data to test with. The tests will use specific names, IDs, secrets, and URLs, so create a copy of `auth.example.json` named `auth.json` in your `secrets` folder and then replace the data to match your own account.

### Github Actions (GHA) Requirements
GHA needs access to the `auth.json` file, so we encrypt that file and upload to the repo. We add the encryption key as a secret to our Github account. If the app or space IDs change for the `staging-latest` stack, this encrypted file needs to be updated.

#### TO UPDATE THE REPO WITH NEW APP IDS:
1. Create the apps and spaces in the QA [HiFi dev account page](https://api-staging-latest.highfidelity.com) The username and password are in [1pass](https://1password.com).

2. Update your `auth.json` file with the new app and space IDs and update the file in 1pass.

3. Follow the instructions [here](https://docs.github.com/en/actions/reference/encrypted-secrets#limits-for-secrets) to encrypt the `auth.json` file. You will need to use the encryption key stored in 1pass under 'QA>Github Secret for Automated Testing' when prompted for a password.

4. Make a PR to the ['hifi-spatial-audio-js' repo](https://github.com/highfidelity/hifi-spatial-audio-js) with the new `auth.json.gpg` file contents.