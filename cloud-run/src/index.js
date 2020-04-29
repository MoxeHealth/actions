const core = require('@actions/core');
const { run } = require('../../utils');
const loadServiceDefinition = require('./service-definition');
const runDeploy = require('./run-deploy');
const configureDomains = require('./configure-domains');

const action = async () => {
  const serviceAccountKey = core.getInput('service-account-key', { required: true });
  const serviceFile = core.getInput('service-definition') || 'cloud-run.yaml';
  const regoFile = core.getInput('rego-policy') || 'policy.rego';
  const image = core.getInput('image', { required: true });
  const domainBindingsEnv = core.getInput('domain-mappings-env') || '';
  const dnsProjectLabel = core.getInput('dns-project-label') || 'dns';
  const verbose = (core.getInput('verbose') || 'false');

  const service = loadServiceDefinition(serviceFile);
  await runDeploy(serviceAccountKey, service, image, regoFile, verbose === 'true')
    .then(({ cluster }) => configureDomains(service, cluster, domainBindingsEnv, dnsProjectLabel));
};

if (require.main === module) {
  run(action);
}

module.exports = action;
