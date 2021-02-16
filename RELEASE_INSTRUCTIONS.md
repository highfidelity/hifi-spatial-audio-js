## Making a New Release of the High Fidelity Spatial Audio Client Library
1. [Appropriately bump](https://semver.org/) the version of the Client Library by modifying:
    1. The `version` value inside `./package.json`.
    2. The `version` value inside `./package-lock.json`.
2. Make a Pull Request to pull all of the code from the `main` branch into the `release` branch.
    - [Click here for a quick link to do this.](https://github.com/highfidelity/hifi-spatial-audio-js/compare/release...main?expand=1)
3. Have the PR reviewed and merged.
4. Once the PR is merged and the latest code is now on the `release` branch, [click here to start drafting a new release](https://github.com/highfidelity/hifi-spatial-audio-js/releases/new).
5. Under "Tag version", input `v<Package Version>`
    - The GitHub release version **must always match the package version found in `./package.json`**.
    - *For example*, your "Tag version" may be `v1.4.3`.
6. **Important: Under the "Target" dropdown, select `release`**.
7. Under "Release title", input some text for the release's title. Ensure the release's title contains the tag version.
    - *For example*, your "Release title" may be as simple as `Release v1.4.3`.
8. Under "Describe this release", input some text for the release's description.
    - This is a good spot for a changelog.
9. Ensure that the checkbox next to "This is a pre-release" is _not_ checked.
10. Click the "Publish release" button.

## What happens after I click "Publish release"?
After you click "Publish release", [this GitHub Action](./.github/workflows/deploy-new-release.yml) will automatically perform the following actions:
1. Check out the code.
2. Setup a NodeJS `v14.y.z` environment.
3. Install the NodeJS modules required to build the Client Library.
4. Build the NodeJS version of the library.
5. Publish the NodeJS library module to [npmjs.com/package/hifi-spatial-audio](https://www.npmjs.com/package/hifi-spatial-audio).
    - If the GitHub action detects that the version of the module we were about to upload to NPMJS.com is older or the same version as the one already up there, we echo a message to the GHA logs and _stop here_.
6. Build the library's TypeDoc documentation, then upload that documentation to S3.
7. Build the WebJS version of the Client Library.
8. Create a `.zip` file containing the two Client Library files (base "Audio" library and optional "Controls" library)
9. Upload the `.zip` file and the two Client Library files to the `latest` folder inside the releases S3 bucket.
10. Upload the `.zip` file and the two Client Library files to a folder corresponding to the current version of the Library inside the releases S3 bucket.
11. Echo a message to the GHA logs about the fact that the Action does not automatically update `https://www.highfidelity.com/api/download`, which must be updated manually.