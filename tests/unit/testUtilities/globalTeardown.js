// This function is triggered once after all test suites.
// If we don't run this, some code within wrtc prevents Jest from exiting properly.
module.exports = () => {
    process.exit(0)
};