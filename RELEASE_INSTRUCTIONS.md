## Making a New Release of the High Fidelity Spatial Audio Client Library
1. [Appropriately bump](https://semver.org/) the version of the Client Library by using the `npm version` command. It's easiest to do the following:
    1. Ensure you've forked `hifi-spatial-audio-js`.
    2. Check out `main` on your fork of this repo, using a command like: `git checkout main && git pull upstream main && git push -u origin main`
    3. Check out a new branch on your fork of this repository with `git checkout -b <new branch name>`.
    4. Run `npm version <major | minor | patch>` (depending on whether you want to rev the `major`, `minor`, or `patch` version number).
    5. Run `git push -u origin <new branch name>` to push the version changes to your branch.
    6. Make a new PR against the base repository containing your version changes.
    7. Have someone at High Fidelity merge the PR.
2. Make a Pull Request to pull all of the code from the `main` branch, **including the new version changes**, into the `release` branch.
    - If you followed the detailed instructions from step (1) above, you can make a pull request with a base of `main` and a compare branch of `<new branch name>`.
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
4. Build the library's TypeDoc documentation, then upload that documentation to S3.
5. Build the WebJS version of the Client Library.
6. Create a `.zip` file containing the two Client Library files (base "Audio" library and optional "Controls" library)
7. Upload the `.zip` file and the two Client Library files to the `latest` folder inside the releases S3 bucket.
8. Upload the `.zip` file and the two Client Library files to a folder corresponding to the current version of the Library inside the releases S3 bucket.
9. Build the NodeJS version of the library.
10. Publish the NodeJS library module to [npmjs.com/package/hifi-spatial-audio](https://www.npmjs.com/package/hifi-spatial-audio).
11. Creates and uploads a new `releases.json` to [a specific place on S3](https://hifi-spatial-audio-api.s3.amazonaws.com/releases/releases.json), which will then cause [our Downloads page](https://highfidelity.com/api/download) to automatically update for visitors.
