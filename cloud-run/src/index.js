const core = require('@actions/core');
const { run } = require('../../utils');
const loadServiceDefinition = require('./service-definition');
const runDeploy = require('./run-deploy');

const action = async () => {
  const serviceAccountKey = core.getInput('service-account-key', { required: true });
  const serviceFile = core.getInput('service-definition') || 'cloud-run.yaml';
  const runtimeAccountEmail = core.getInput('runtime-account-email') || 'cloudrun-runtime';
  const image = core.getInput('image', { required: true });

  const service = loadServiceDefinition(serviceFile);

  await runDeploy(serviceAccountKey, service, runtimeAccountEmail, image);
};

if (require.main === module) {
  run(action);
}

module.exports = action;
