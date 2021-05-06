# JEST AUTOMATED TESTING INFO

## File structure for `tests` folder
    tests  
    ├── integration  
    │   └── serverConnections.integration.test.ts  
    ├── secrets  
    │   ├── auth_example.json  (A template for creating your own `auth.json` file.)
    │   ├── auth.json  (You will create this file for local smoke or integration testing.)  
    │   └── auth.json.gpg  (An encrypted version of `auth.json` for the `staging-latest` stack used by GHA.)  
    ├── smoke  
    │   ├── clientAudio.smoke.test.ts 
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

## Stack Data in the Current Auth File:

| Stack    | Names                              |
|----------|------------------------------------|
| staging  | api-staging.highfidelity.com, api-staging-latest.highfidelity.com    |
| pro      | api-pro.highfidelity.com, api-pro-latest.highfidelity.com            |
| east     | api-pro-east.highfidelity.com, api-pro-latest-east.highfidelity.com  |
| hobby    | api.highfidelity.com, api-hobby-latest.highfidelity.com              |

## Full Local Testing on 'staging-latest.highfidelity.com'

To run all tests locally against 'staging-latest.highfidelity.com', type `jest test` into the console. All files in the `tests` directory and subdirectories ending in `.test.ts` will run.

## Local Smoke Testing on 'staging-latest.highfidelity.com'

Smoke testing will test multiple modules working together using real server connections by running a series of instructions in a typical usage scenario for the API. For example, one test might create a space within an app, edit its settings, and then delete the space. This should be run manually after a new deploy to ensure nothing is broken. To run only smoke tests, type `jest smoke` into the console. All files in the `tests/smoke` directory ending in `.test.ts` will run.

## Local Unit Testing on 'staging-latest.highfidelity.com'

Unit testing will test each part of the API to show that the individual functions are correct. These tests will not use real server connections and will mock any external pieces that a function relies on. These tests will run automatically via GHA before any code is merged and can be run manually from the console or from GHA workflow dispatch. To run only unit tests, type `jest unit` into the console. All files in the `tests/unit` directory and subdirectories ending in `.test.ts` will run.

## Local Integration Testing on 'staging-latest.highfidelity.com'

Integration testing will combine different modules in the API and test individual functions using actual server connections. These tests will run automatically via GHA before any code is merged and can be run manually from the console or from GHA workflow dispatch. To run only integration tests, type `jest integration` into the console. All files in the `tests/integration` directory ending in `.test.ts` will run.

## Testing against other stacks
Make sure your stackname and apps IDs/secrets are included in the auth file and then run Jest via a node script named 'test'. The following example runs one specific test file against the main production (hobby) stack. You can confirm that the correct stack is being used by checking the logs. You may also run tests against other stacks via GHA workflows(see below).

```
npm run test serverConnections.integration.test.ts -- --stackname=api.highfidelity.com
```

### False Test Failures
If a stack runs out of mixers, some tests may fail. If you have AWS access, you can observe stack allocations [here](https://us-west-2.console.aws.amazon.com/dynamodb/home?region=us-west-2#tables:selected=Allocations-api-pro-05;tab=items). You will see a list of mixers for the selected stack. If there are no (`NA`) unallocated mixers, tests can fail. We usually need 1-2 mixers for smoke or integration tests run alone and 2-4 for running all tests at once.

### Editing Tests Within a File

#### Only
To run one test or group of tests within a file, append `.only` to the section of code you want to run. This can be used after a describe block or test. This is useful for rerunning a specific test that has failed without having to wait for all tests in that file. You can add multiple 'only' specifiers to run more than one section of a *test* or *describe* block.

```
describe.only('Non admin server connections', () => {
```

#### Skip
To skip one test or group of tests within a file, append `.skip` to the section of code you want to skip. This can be used after a describe block or test. This is useful for rerunning a test suite without a particularly slow test. You can add multiple 'skip' specifiers to skip more than one section of a *test* or *describe* block.

```
describe.skip('Non admin server connections', () => {
```

#### Timeout
Sometimes tests fail due to timing out before promises are returned. Tests are created with the minimum timeout value that works for most runs to maintain the shortest time to run all tests but you can edit them locally if you are seeing errors like `: Timeout - Async callback was not invoked within the 5000`. To lengthen the timeout for a describe block, set the jest timeout in the `beforeAll()` function and then restore the value in the `afterAll()` function. You can also use change timeout within a test.

```
beforeAll(async () => {
    jest.setTimeout(15000);
    ...
```

### Secrets and Account Setup
Since integration and smoke tests require actual server connections (as opposed to mock functions and connections), you will need to set up an account with some preset apps and a way to access private data to test with if you are not testing one of the preset stacks. The tests will use specific app names and IDs/secrets, so create a copy of `auth.example.json` named `auth.json` in your `secrets` folder and then replace the data for the stack called 'some-other-stackname' to match your own account.

### Github Actions (GHA) 

#### Requirements
GHA needs access to the `auth.json` file, so we encrypt that file and upload to the repo. We add the encryption key as a secret to our Github account. If the app IDs/secrets change for any of these stacks, this encrypted file needs to be updated.

#### Workflows
There is a workflow dispatch in GHA that allows you to manually run tests against a specified stack and branch. This will work as long as the specified stack data is included in the branch's auth file.

#### TO UPDATE THE REPO WITH NEW APP IDS:
1. Create the apps in the QA [HiFi dev account page](https://api-staging-latest.highfidelity.com) The username and password are in [1pass](https://1password.com).

2. Update your `auth.json` file with the new app IDs/secrets and update the file in 1pass.

3. Follow the instructions [here](https://docs.github.com/en/actions/reference/encrypted-secrets#limits-for-secrets) to encrypt the `auth.json` file. You will need to use the encryption key stored in 1pass under 'QA>Github Secret for Automated Testing' when prompted for a password.

4. Make a PR to the ['hifi-spatial-audio-js' repo](https://github.com/highfidelity/hifi-spatial-audio-js) with the new `auth.json.gpg` file contents.