const exec = require('@actions/exec');
const { getShortSha } = require('../../utils/src/branch-info');

const podName = async () => {
  const repo = process.env.GITHUB_REPOSITORY.split('/')[1];
  const sha = await getShortSha(process.env.GITHUB_SHA);
  return `${repo}-${sha}-test`;
};

const createOverride = (pod, namespace, image, configMap, serviceUrl) => {
  const container = {
    name: pod,
    image,
    workingDir: '/work',
    volumeMounts: [{
      mountPath: '/work',
      name: 'workspace',
      readOnly: false,
    }],
  };

  if (serviceUrl) {
    container.env = [{
      name: 'SERVICE_URL',
      value: serviceUrl,
    }];
  }

  if (configMap.entrypoint) {
    container.command = ['/bin/sh', 'entrypoint.sh'];
  }

  return {
    apiVersion: 'v1',
    metadata: {
      namespace,
      annotations: {
        'sidecar.istio.io/inject': 'false',
      },
    },
    spec: {
      containers: [
        container,
      ],
      volumes: [{
        name: 'workspace',
        configMap: {
          name: configMap.name,
        },
      }],
    },
  };
};

const runPod = async ({ name, namespace }, image, configMap) => {
  const pod = await podName();

  const args = [
    'run',
    pod,
    '--rm',
    '--attach',
    '--restart=Never',
    `--image=${image}`,
    '-n',
    namespace,
  ];

  const serviceUrl = name ? `http://${name}.${namespace}` : null;

  if (serviceUrl) {
    args.push(`--env=SERVICE_URL=${serviceUrl}`);
  }

  if (configMap) {
    const json = JSON.stringify(createOverride(pod, namespace, image, configMap, serviceUrl));
    args.push(`--overrides=${json}`);
  }

  return exec.exec('kubectl', args);
};

module.exports = runPod;
