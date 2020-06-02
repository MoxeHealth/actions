const core = require('@actions/core');
const { buildPackage } = require('./pkgbuilder');
const { checkEnv, run } = require('../../utils');

const action = async () => {
  try {
    core.info('Starting to build installer package');

    checkEnv(['NEXUS_USERNAME', 'NEXUS_PASSWORD']);

    const binaryVersion = core.getInput('tool-version', { required: true });
    const branch = core.getInput('branch-name-short', { required: true });
    const builderType = core.getInput('builder-type', { required: false });
    const outputDir = core.getInput('output-dir', { required: true });
    const packageName = core.getInput('package-name', { required: false });
    const packageVersion = core.getInput('package-version', { required: true });
    const publishPackageInput = core.getInput('publish-package', { required: false });
    const publishUrl = core.getInput('publish-root-dr', { required: true });
    const sourceFilePaths = core.getInput('source-filePaths', { required: false });
    const sourcePaths = core.getInput('source-paths', { required: false });
    const workingDir = core.getInput('working-dir', { required: true });
    let publishPackage;
    if (publishPackageInput === undefined || publishPackageInput === null) {
      publishPackage = false;
    } else {
      publishPackage = publishPackageInput;
    }

    await buildPackage({
      binaryVersion,
      branch,
      builderType,
      outputDir,
      packageName,
      packageVersion,
      publishPackage,
      publishUrl,
      sourceFilePaths,
      sourcePaths,
      workingDir,
    });
  } catch (error) {
    core.setFailed(error.message);
  }
};

if (require.main === module) {
  run(action);
}

module.exports = action;
