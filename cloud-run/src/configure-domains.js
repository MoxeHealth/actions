const core = require('@actions/core');
const exec = require('@actions/exec');
const gcloud = require('./gcloud-output');
const authenticateKubeCtl = require('./kubectl-auth');
const { setOpaInjectionLabels } = require('./set-namespace-label');
const { addDnsRecord } = require('./dns-record');

const listDomains = async ({ cluster, clusterLocation, project }, namespace) => gcloud([
  'run',
  'domain-mappings',
  'list',
  '--platform=gke',
  `--project=${project}`,
  `--cluster=${cluster}`,
  `--cluster-location=${clusterLocation}`,
  `--namespace=${namespace}`,
  '--format=value(DOMAIN,SERVICE)',
]).then((result) => result.split('\n'))
  .then((list) => list.reduce((prev, value) => {
    const [domain, service] = value.split(/\s+/);
    const update = { ...prev };
    update[domain] = service;
    return update;
  }, {}));

const getNewDomains = async (domains, name, cluster, namespace) => {
  const mappings = await listDomains(cluster, namespace);
  return domains.filter((domain) => {
    const existing = mappings[domain];
    if (existing && existing !== name) {
      throw Error(`Conflict: Domain ${domain} already mapped to service ${existing}`);
    }
    return !existing;
  });
};

const createDomainMapping = async (
  { cluster, clusterLocation, project },
  domain,
  service,
  namespace,
) => {
  core.info(`Create '${domain}' domain-mapping.`);
  return gcloud([
    'run',
    'domain-mappings',
    'create',
    `--service=${service}`,
    `--domain=${domain}`,
    `--namespace=${namespace}`,
    '--platform=gke',
    `--project=${project}`,
    `--cluster=${cluster}`,
    `--cluster-location=${clusterLocation}`,
    '--format=value(CONTENTS)',
  ]);
};

const enableHttpRedirectOnDomain = async (
  domain,
  namespace,
) => {
  core.info(`Enable http redirect for '${domain}'`);
  return exec.exec('kubectl', [
    'annotate',
    'domainmappings',
    domain,
    'domains.cloudrun.com/httpsRedirect=Enabled',
    '--namespace',
    namespace,
  ]);
};

const determineEnv = (project) => (project.includes('staging') ? 'staging' : 'prod');

const configureDomains = async (service, cluster, domainMappingEnv, dnsProjectLabel) => {
  if (!cluster) {
    core.info('Domain binding is not yet supported for managed cloud run.');
    return [];
  }

  const env = domainMappingEnv || determineEnv(cluster.project);
  const {
    name,
    platform: {
      gke: {
        connectivity,
        'domain-mappings': domainMappings = [],
        'opa-enabled': opaEnabled = true,
        namespace = name,
      },
    },
  } = service;

  const domains = domainMappings[env] || [];

  if (connectivity === 'external' && domains.length > 0) {
    const newDomains = await getNewDomains(domains, name, cluster, namespace);

    await authenticateKubeCtl(cluster);

    if (opaEnabled) {
      await setOpaInjectionLabels(namespace, false);
    }

    const promises = [];
    newDomains.forEach((domain) => {
      promises.push(createDomainMapping(cluster, domain, name, namespace)
        .then((ipAddress) => addDnsRecord(dnsProjectLabel, domain, ipAddress))
        .then(() => enableHttpRedirectOnDomain(domain, namespace)));
    });

    await Promise.all(promises).finally(() => {
      if (opaEnabled) {
        return setOpaInjectionLabels(namespace, true);
      }
      return null;
    });

    return newDomains;
  }
  return [];
};

module.exports = configureDomains;
