# JEST AUTOMATED TESTING INFO

## File structure for `tests` folder

    tests  
    ├── integration  
    ├── secrets  
    │   ├── auth.json  (You will create this file for smoke or integration testing.)  
    │   └── auth.example  
    ├── smoke  
    │   └── rest.smoke.test.ts  
    ├── testUtilities  
    │   ├── testUser.ts  
    │   └── testUtils.ts  
    ├── unit  
    │   └── src  
    │       ├── classes  
    │        │   ├── HiFiAudioAPIData.unit.test.ts  
    │       │   ├── HiFiCommunicator.unit.test.ts  
    │       │   └── HiFiMixerSession.unit.test.ts  
    │       └── utilities  
    │           └── HiFiLogger.unit.test.ts  
    └── README.md  

To run all tests, type `jest test` into the console. All files in the `tests` directory and subdirectories ending in `.test.ts` will run.

## Smoke Testing

Smoke testing will test only the most basic functions of the API using real server connections. To run only smoke tests, type `jest smoke` into the console. All files in the `tests/smoke` directory ending in `.test.ts` will run.

## Unit Testing

Unit testing will test each part of the API to show that the individual functions are correct. These tests will not use real server connections and will mock any external pieces that a function relies on. To run only unit tests, type `jest unit` into the console. All files in the `tests/unit` directory and subdirectories ending in `.test.ts` will run.

## Integration Testing

Integration testing will combine different modules in the API and test as a group using actual server connections. To run only integration tests, type `jest integration` into the console. All files in the `tests/integration` directory ending in `.test.ts` will run.

### Secrets and Account Setup
Since integration and smoke tests require actual server connections (as opposed to mock functions and connections), you will need to set up an account with some preset apps and spaces and a way to access private data to test with. The tests will use specific names, IDs, secrets, and URLs, so create a copy of `auth.example.json` named `auth.json` in your `secrets` folder and then replace the data to match your own account. Your 'stackData.url' will be the root URL of your account.