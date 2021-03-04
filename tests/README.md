# JEST AUTOMATED TESTING INFO
To run all tests, type `jest test` into the console.

## Unit Testing

To run only unit tests, type `jest unit` into the console.

...coming soon

## Integration Testing

To run only integration tests, type `jest integration` into the console.

### Secrets and Account Setup
Since integration tests require actual server connections (as opposed to mock functions and connections), 
you will need to set up an account with some preset apps and spaces and a way to access private data 
to test with. The tests will use specific names, IDs, secrets, and URLs, so create a copy of `auth.example.json` 
named `auth.json` in your `secrets` folder and then replace the data to match your own account. Your 
'stackData.url' will be the root URL of your account.