//const core = require('@actions/core');
const { checkEnv, run } = require('../../utils');
const { createReleaseNotes } = require('./jira-releasenotes');

run(async () => {
  checkEnv(['JIRA_USERNAME', 'JIRA_PASSWORD']);

  //const protocol = core.getInput('jira-protocol', { required: true });
  //const host = core.getInput('jira-host', { required: true });
  //const projectKey = core.getInput('jira-project', { required: true });
  //const releaseNoteField = core.getInput('field-releasenote', { required: true });
  
  const protocol = 'https';
  const host = 'moxehealth.atlassian.net';
  const projectKey = 'PUR';
  const releaseNoteField = 'Release-note';
  
  await createReleaseNotes({
    protocol,
    host,
    projectKey,
    releaseNoteField,
  });
});
