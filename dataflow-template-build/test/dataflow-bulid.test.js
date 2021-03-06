jest.mock('@actions/exec');
const exec = require('@actions/exec');
const dataflowBuild = require('../src/dataflow-build');

describe('Build Dataflow template', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('Build template', async () => {
    dataflowBuild(
      'gs://test/dataflow/template.json',
      'gcr.io/project/image:tag',
      'JAVA',
      'metadata.json',
    );
    expect(exec.exec).toHaveBeenCalledTimes(1);
    expect(exec.exec).toHaveBeenCalledWith('gcloud', [
      'dataflow',
      'flex-template',
      'build',
      'gs://test/dataflow/template.json',
      '--image=gcr.io/project/image:tag',
      '--sdk-language=JAVA',
      '--metadata-file=metadata.json',
    ]);
  });

  test('Build template without metadata flag', async () => {
    dataflowBuild(
      'gs://test/dataflow/template.json',
      'gcr.io/project/image:tag',
      'JAVA',
      '',
    );
    expect(exec.exec).toHaveBeenCalledTimes(1);
    expect(exec.exec).toHaveBeenCalledWith('gcloud', [
      'dataflow',
      'flex-template',
      'build',
      'gs://test/dataflow/template.json',
      '--image=gcr.io/project/image:tag',
      '--sdk-language=JAVA',
    ]);
  });
});
