const mockFs = require('mock-fs');

jest.mock('@actions/exec');
jest.mock('../../setup-gcloud/src/setup-gcloud');
jest.mock('../src/cluster-info');
jest.mock('../src/create-namespace');

const exec = require('@actions/exec');
const setupGcloud = require('../../setup-gcloud/src/setup-gcloud');
const runDeploy = require('../src/run-deploy');
const getClusterInfo = require('../src/cluster-info');

const serviceAccountKey = Buffer.from('test', 'utf8').toString('base64');

const orgEnv = process.env;

describe('Run Deploy', () => {
  beforeEach(() => {
    process.env = { ...orgEnv };
    process.env.GITHUB_SHA = '63633c0'; // v.0.18.0
  });
  afterEach(() => {
    jest.resetAllMocks();
    mockFs.restore();
    process.env = orgEnv;
  });

  test('It can deploy to managed Cloud Run', async () => {
    exec.exec.mockResolvedValueOnce(0);
    setupGcloud.mockResolvedValueOnce('test-project');
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: 1,
      platform: {
        managed: {
          region: 'eu-west1',
          'allow-unauthenticated': true,
        },
      },
    };
    const returnValue = await runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project/my-service:tag',
    );
    expect(returnValue.gcloudExitCode).toEqual(0);
    expect(setupGcloud).toHaveBeenCalledTimes(1);
    expect(exec.exec).toHaveBeenCalledTimes(1);
    expect(exec.exec).toHaveBeenCalledWith('gcloud', [
      'run', 'deploy', 'my-service',
      '--image=gcr.io/test-project/my-service:tag',
      '--project=test-project',
      '--memory=256Mi',
      '--concurrency=80',
      '--max-instances=default',
      '--set-env-vars=SERVICE_PROJECT_ID=test-project',
      '--labels=service_project_id=test-project,service_project=test-project,service_env=undefined',
      '--no-use-http2',
      '--service-account=cloudrun-runtime@test-project.iam.gserviceaccount.com',
      '--cpu=1',
      '--platform=managed',
      '--region=eu-west1',
      '--allow-unauthenticated',
    ]);
  });

  test('It parse projectId and set labels', async () => {
    exec.exec.mockResolvedValueOnce(0);
    setupGcloud.mockResolvedValueOnce('test-project-staging-ab12');
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: 1,
      platform: {
        managed: {
          region: 'eu-west1',
          'allow-unauthenticated': true,
        },
      },
    };
    const returnValue = await runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project-staging-ab12/my-service:tag',
    );
    expect(returnValue.gcloudExitCode).toEqual(0);
    expect(setupGcloud).toHaveBeenCalledTimes(1);
    expect(exec.exec).toHaveBeenCalledTimes(1);
    expect(exec.exec).toHaveBeenCalledWith('gcloud', [
      'run', 'deploy', 'my-service',
      '--image=gcr.io/test-project-staging-ab12/my-service:tag',
      '--project=test-project-staging-ab12',
      '--memory=256Mi',
      '--concurrency=80',
      '--max-instances=default',
      '--set-env-vars=SERVICE_PROJECT_ID=test-project-staging-ab12',
      '--labels=service_project_id=test-project-staging-ab12,service_project=test-project,service_env=staging',
      '--no-use-http2',
      '--service-account=cloudrun-runtime@test-project-staging-ab12.iam.gserviceaccount.com',
      '--cpu=1',
      '--platform=managed',
      '--region=eu-west1',
      '--allow-unauthenticated',
    ]);
  });

  test('It can deploy with enabled http/2', async () => {
    exec.exec.mockResolvedValueOnce(0);
    setupGcloud.mockResolvedValueOnce('test-project');
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: 1,
      platform: {
        managed: {
          region: 'eu-west1',
          'allow-unauthenticated': false,
        },
      },
    };
    const returnValue = await runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project/my-service:tag',
      true,
      false,
    );
    expect(returnValue.gcloudExitCode).toEqual(0);
    expect(exec.exec.mock.calls[0][1]).toEqual(expect.arrayContaining(['--use-http2']));
  });

  test('It can deploy with verbose logging', async () => {
    exec.exec.mockResolvedValueOnce(0);
    setupGcloud.mockResolvedValueOnce('test-project');
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: 1,
      platform: {
        managed: {
          region: 'eu-west1',
          'allow-unauthenticated': false,
        },
      },
    };
    const returnValue = await runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project/my-service:tag',
      false,
      true,
    );
    expect(returnValue.gcloudExitCode).toEqual(0);
    expect(exec.exec.mock.calls[0][1]).toEqual(expect.arrayContaining(['--verbosity=debug']));
  });

  test('It can deploy with environment', async () => {
    exec.exec.mockResolvedValueOnce(0);
    setupGcloud.mockResolvedValueOnce('test-project');
    process.env.GITHUB_SHA = '382aee2'; // Not tagged
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: 1,
      environment: {
        KEY1: 'value',
        KEY2: 'sm://*/my-secret',
      },
      platform: {
        managed: {
          region: 'eu-west1',
          'allow-unauthenticated': true,
          'cloud-sql-instances': [],
        },
      },
    };
    await runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project/my-service:tag',
    );
    expect(exec.exec).toHaveBeenCalledWith('gcloud', [
      'run', 'deploy', 'my-service',
      '--image=gcr.io/test-project/my-service:tag',
      '--project=test-project',
      '--memory=256Mi',
      '--concurrency=80',
      '--max-instances=default',
      '--set-env-vars=KEY1=value,KEY2=sm://test-project/my-secret,SERVICE_PROJECT_ID=test-project',
      '--labels=service_project_id=test-project,service_project=test-project,service_env=undefined',
      '--no-use-http2',
      '--service-account=cloudrun-runtime@test-project.iam.gserviceaccount.com',
      '--cpu=1',
      '--platform=managed',
      '--region=eu-west1',
      '--allow-unauthenticated',
    ]);
  });

  test('It can deploy authenticated', async () => {
    exec.exec.mockResolvedValueOnce(0);
    setupGcloud.mockResolvedValueOnce('test-project');
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: 1,
      platform: {
        managed: {
          region: 'eu-west1',
          'allow-unauthenticated': false,
        },
      },
    };
    const returnValue = await runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project/my-service:tag',
    );
    expect(returnValue.gcloudExitCode).toEqual(0);
    expect(exec.exec.mock.calls[0][1]).toEqual(expect.not.arrayContaining(['--allow-unauthenticated']));
    expect(exec.exec.mock.calls[0][1]).toEqual(expect.arrayContaining(['--no-allow-unauthenticated']));
  });

  test('It can deploy with sql-instances', async () => {
    exec.exec.mockResolvedValueOnce(0);
    setupGcloud.mockResolvedValueOnce('test-project');
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: 1,
      platform: {
        managed: {
          region: 'eu-west1',
          'allow-unauthenticated': false,
          'cloudsql-instances': ['MY-INSTANCE'],
        },
      },
    };
    const returnValue = await runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project/my-service:tag',
    );
    expect(returnValue.gcloudExitCode).toEqual(0);
    expect(exec.exec.mock.calls[0][1]).toEqual(expect.arrayContaining(['--set-cloudsql-instances=MY-INSTANCE']));
  });


  test('It can deploy with --clear-sql-instances', async () => {
    exec.exec.mockResolvedValueOnce(0);
    setupGcloud.mockResolvedValueOnce('test-project');
    process.env.GITHUB_SHA = '382aee2'; // Not tagged
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: 1,
      platform: {
        managed: {
          region: 'eu-west1',
          'allow-unauthenticated': true,
          'cloudsql-instances': [],
        },
      },
    };
    await runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project/my-service:tag',
    );
    expect(exec.exec.mock.calls[0][1]).toEqual(expect.arrayContaining(['--clear-cloudsql-instances']));
  });

  test('It can deploy to Cloud Run on GKE', async () => {
    exec.exec.mockResolvedValueOnce(0);
    getClusterInfo.mockResolvedValueOnce({
      project: 'test-project',
      cluster: 'k8s-cluster',
      clusterLocation: 'europe-west1',
      uri: 'projects/test-project/zones/europe-west1/clusters/k8s-cluster',
    });
    setupGcloud.mockResolvedValueOnce('test-project');
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: '400m',
      platform: {
        gke: {
          cluster: 'k8s-cluster',
          'cluster-location': 'europe-west1',
          connectivity: 'external',
          namespace: 'my-space',
        },
      },
    };
    const returnValue = await runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project/my-service:tag',
    );
    expect(returnValue.gcloudExitCode).toEqual(0);
    expect(getClusterInfo).toHaveBeenCalled();
    expect(setupGcloud).toHaveBeenCalledTimes(1);
    expect(exec.exec).toHaveBeenCalledTimes(1);
    expect(exec.exec).toHaveBeenCalledWith('gcloud', [
      'run', 'deploy', 'my-service',
      '--image=gcr.io/test-project/my-service:tag',
      '--project=test-project',
      '--memory=256Mi',
      '--concurrency=32',
      '--max-instances=default',
      '--set-env-vars=SERVICE_PROJECT_ID=test-project',
      '--labels=service_project_id=test-project,service_project=test-project,service_env=undefined',
      '--no-use-http2',
      '--cpu=400m',
      '--min-instances=default',
      '--platform=gke',
      '--cluster=projects/test-project/zones/europe-west1/clusters/k8s-cluster',
      '--cluster-location=europe-west1',
      '--connectivity=external',
      '--namespace=my-space',
    ]);
  });

  test('It can deploy to Cloud Run on GKE and discover cluster', async () => {
    getClusterInfo.mockResolvedValueOnce({
      project: 'tribe-staging-1234',
      cluster: 'k8s-cluster',
      clusterLocation: 'europe-west1',
      uri: 'projects/tribe-staging-1234/zones/europe-west1/clusters/k8s-cluster',
    });
    exec.exec.mockResolvedValueOnce(0);
    setupGcloud.mockResolvedValueOnce('test-project');
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: '100m',
      platform: {
        gke: {
          connectivity: 'external',
        },
      },
    };
    const returnValue = await runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project/my-service:tag',
    );
    expect(returnValue.gcloudExitCode).toEqual(0);
    expect(exec.exec).toHaveBeenCalledTimes(1);
    expect(getClusterInfo).toHaveBeenCalledWith('test-project', undefined);
    expect(setupGcloud).toHaveBeenCalledTimes(1);
    expect(exec.exec).toHaveBeenCalledWith('gcloud', [
      'run', 'deploy', 'my-service',
      '--image=gcr.io/test-project/my-service:tag',
      '--project=test-project',
      '--memory=256Mi',
      '--concurrency=10',
      '--max-instances=default',
      '--set-env-vars=SERVICE_PROJECT_ID=test-project',
      '--labels=service_project_id=test-project,service_project=test-project,service_env=undefined',
      '--no-use-http2',
      '--cpu=100m',
      '--min-instances=default',
      '--platform=gke',
      '--cluster=projects/tribe-staging-1234/zones/europe-west1/clusters/k8s-cluster',
      '--cluster-location=europe-west1',
      '--connectivity=external',
      '--namespace=my-service',
    ]);
  });

  test('It can deploy to Cloud Run on GKE and discover cluster-location', async () => {
    getClusterInfo.mockResolvedValueOnce({
      project: 'tribe-staging-12345',
      cluster: 'k8s-cluster',
      clusterLocation: 'europe-west1',
      uri: 'projects/tribe-staging-1234/zones/europe-west1/clusters/k8s-cluster',
    });
    exec.exec.mockResolvedValueOnce(0);
    setupGcloud.mockResolvedValueOnce('test-project');
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: '400m',
      concurrency: 50,
      'min-instances': 1,
      'max-instances': 100,
      platform: {
        gke: {
          cluster: 'projects/tribe-staging-1234/zones/europe-west1/clusters/k8s-cluster',
          connectivity: 'external',
          namespace: 'default',
        },
      },
    };
    const returnValue = await runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project/my-service:tag',
    );
    expect(returnValue.gcloudExitCode).toEqual(0);
    expect(exec.exec).toHaveBeenCalledTimes(1);
    expect(getClusterInfo).toHaveBeenCalledWith('test-project', 'projects/tribe-staging-1234/zones/europe-west1/clusters/k8s-cluster');
    expect(setupGcloud).toHaveBeenCalledTimes(1);
    expect(exec.exec).toHaveBeenCalledWith('gcloud', [
      'run', 'deploy', 'my-service',
      '--image=gcr.io/test-project/my-service:tag',
      '--project=test-project',
      '--memory=256Mi',
      '--concurrency=50',
      '--max-instances=100',
      '--set-env-vars=SERVICE_PROJECT_ID=test-project',
      '--labels=service_project_id=test-project,service_project=test-project,service_env=undefined',
      '--no-use-http2',
      '--cpu=400m',
      '--min-instances=1',
      '--platform=gke',
      '--cluster=projects/tribe-staging-1234/zones/europe-west1/clusters/k8s-cluster',
      '--cluster-location=europe-west1',
      '--connectivity=external',
      '--namespace=default',
    ]);
  });

  test('It throws for invalid managed cpu units', async () => {
    exec.exec.mockResolvedValueOnce(0);
    setupGcloud.mockResolvedValueOnce('test-project');
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: '200m',
      platform: {
        managed: {
          region: 'eu-west1',
          'allow-unauthenticated': true,
        },
      },
    };
    await expect(runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project/my-service:tag',
    )).rejects.toEqual(
      new Error('Managed Cloud Run must be configured with CPU count [1,2]. Use of millicpu is not supported.'),
    );
  });

  test('It throws for invalid gke millcpu', async () => {
    exec.exec.mockResolvedValueOnce(0);
    setupGcloud.mockResolvedValueOnce('test-project');
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: 2,
      platform: {
        gke: {
          cluster: 'projects/tribe-staging-1234/zones/europe-west1/clusters/k8s-cluster',
          connectivity: 'external',
          namespace: 'default',
        },
      },
    };
    await expect(runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project/my-service:tag',
    )).rejects.toEqual(
      new Error('Cloud Run GKE must be configured with millicpu. Use of CPU count is not supported.'),
    );
  });

  test('It can deploy to Cloud Run on GKE with odd CPU', async () => {
    getClusterInfo.mockResolvedValueOnce({
      project: 'tribe-staging-1234',
      cluster: 'k8s-cluster',
      clusterLocation: 'europe-west1',
      uri: 'projects/tribe-staging-1234/zones/europe-west1/clusters/k8s-cluster',
    });
    exec.exec.mockResolvedValueOnce(0);
    setupGcloud.mockResolvedValueOnce('test-project');
    const service = {
      name: 'my-service',
      memory: '256Mi',
      cpu: '233m',
      platform: {
        gke: {
          connectivity: 'external',
        },
      },
    };
    const returnValue = await runDeploy(
      serviceAccountKey,
      service,
      'gcr.io/test-project/my-service:tag',
    );
    expect(returnValue.gcloudExitCode).toEqual(0);
    expect(exec.exec).toHaveBeenCalledTimes(1);
    expect(getClusterInfo).toHaveBeenCalledWith('test-project', undefined);
    expect(setupGcloud).toHaveBeenCalledTimes(1);
    expect(exec.exec).toHaveBeenCalledWith('gcloud', [
      'run', 'deploy', 'my-service',
      '--image=gcr.io/test-project/my-service:tag',
      '--project=test-project',
      '--memory=256Mi',
      '--concurrency=19',
      '--max-instances=default',
      '--set-env-vars=SERVICE_PROJECT_ID=test-project',
      '--labels=service_project_id=test-project,service_project=test-project,service_env=undefined',
      '--no-use-http2',
      '--cpu=233m',
      '--min-instances=default',
      '--platform=gke',
      '--cluster=projects/tribe-staging-1234/zones/europe-west1/clusters/k8s-cluster',
      '--cluster-location=europe-west1',
      '--connectivity=external',
      '--namespace=my-service',
    ]);
  });
});
