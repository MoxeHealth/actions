module.exports =
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 605:
/***/ ((__unused_webpack_module, __unused_webpack_exports, __webpack_require__) => {

const core = __webpack_require__(471);
const { checkEnv, run } = __webpack_require__(82);
const { createReleaseNotes } = __webpack_require__(482);

run(async () => {
  checkEnv(['JIRA_USERNAME', 'JIRA_PASSWORD']);

  const protocol = core.getInput('jira-protocol', { required: true });
  const host = core.getInput('jira-host', { required: true });
  const projectKey = core.getInput('jira-project', { required: true });
  const releaseNoteField = core.getInput('field-releasenote', { required: true });

  core.setFailed(`Host: ${host}. Username: ${process.env.JIRA_USERNAME} `);
  
 // await createReleaseNotes({
 //   protocol,
 //  host,
 //   projectKey,
 //   releaseNoteField,
 // });
});


/***/ }),

/***/ 482:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const core = __webpack_require__(471);
const JiraClient = __webpack_require__(20);
const { getConventionalCommits } = __webpack_require__(641);

const findJiraChanges = async (projectKey) => {
  const issueIdRegEx = new RegExp(`${projectKey}-([0-9]+)`, 'g');
  const commits = await getConventionalCommits();
  const issues = {};
  commits.forEach((commit) => {
    const {
      scope,
      type,
      subject,
      body,
      footer,
      notes,
      hash,
    } = commit;
    const content = `${scope} ${subject} ${body || ''} ${footer || ''}`;
    new Set(content.match(issueIdRegEx)).forEach((issueKey) => {
      if (issues[issueKey]) {
        core.warning(`${issueKey} was referred by multiple commits. Last entry wins!`);
      }
      issues[issueKey] = {
        subject,
        type,
        body: body || '',
        notes,
        hash,
      };
    });
  });
  return issues;
};

const findCustomFieldId = async (client, fieldName) => client.listFields()
  .then((fields) => fields.find((f) => f.name === fieldName).id);

const createUpdate = (change, releaseNoteFieldId) => {
  const update = { fields: {} };
  update.fields[releaseNoteFieldId] = `${change.subject}\n\n${change.body}`.trim();
  // TODO Add BREAKING CHANGE information somewhere?
  return update;
};

const createReleaseNotes = async ({
  protocol,
  host,
  projectKey,
  releaseNoteField,
}) => {
  const changes = await findJiraChanges(projectKey);

  if (!changes) {
    return null;
  }

  const client = new JiraClient({
    protocol,
    host,
    username: process.env.JIRA_USERNAME,
    password: process.env.JIRA_PASSWORD,
    apiVersion: '2',
    strictSSL: protocol === 'https',
  });

  const releaseNoteFieldId = await findCustomFieldId(client, releaseNoteField);
  const requests = [];
  Object.keys(changes).forEach((issueKey) => {
    const change = changes[issueKey];
    requests.push(client.getIssue(issueKey, `summary, fixVersions, resolution, status, ${releaseNoteFieldId}`)
      .then((issue) => {
        if (issue.fields[releaseNoteFieldId] === null) {
          const update = createUpdate(change, releaseNoteFieldId);
          return client.updateIssue(issueKey, update).then(() => {
            core.info(`Issue ${issueKey} was updated with a release note`);
          });
        }
        core.info(`Skip issue ${issueKey}. It already has a release note`);
        return null;
      }));
  });

  return Promise.all(requests);
};

module.exports = {
  createReleaseNotes,
  findJiraChanges,
};


/***/ }),

/***/ 518:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const git = __webpack_require__(934)();

const isPreRelease = (branchName) => branchName !== 'master';

const getBranchType = (branchName) => {
  const devPattern = /(^dev$|^develop$)/gmi;
  const masterPattern = /^master$/gmi;

  if (devPattern.test(branchName)) {
    return 'dev';
  }

  if (masterPattern.test(branchName)) {
    return 'master';
  }

  return 'feature';
};

const getBranchName = (currentRef) => {
  if (!currentRef) {
    throw new Error('Can not return a branchname for null');
  }

  const pattern = /refs\/heads\/([A-Za-z0-9/\-_.]*)/;
  const groups = currentRef.match(pattern);

  if (groups == null || groups.length !== 2) {
    throw new Error(`Failed to parse branch name from ${currentRef}`);
  }

  return groups[1];
};

const getBranchNameFriendly = (branchName) => {
  if (!branchName) {
    throw new Error('You have no branch for some reason');
  }

  const branchType = getBranchType(branchName);

  if (branchType === 'master' || branchType === 'dev') {
    return branchName.toLowerCase();
  }

  return branchName.replace(/\//g, '-').replace(/_/g, '-').toLowerCase();
};

const getBranchNameShort = (currentRef) => {
  if (!currentRef) {
    throw new Error('Can not return a branchname for null');
  }

  const pattern = /.*\/(.*)/;
  const groups = currentRef.match(pattern);

  if (groups == null || groups.length !== 2) {
    throw new Error(`Failed to parse branch name from ${currentRef}`);
  }

  return groups[1];
};

const getBranchNameSemver = (currentRef) => {
  if (!currentRef) {
    throw new Error('Can not return a branchname for null');
  }

  const pattern = /[0-9a-zA-Z]+(?: [0-9a-zA-Z]+)*?/gm;
  const groups = currentRef.match(pattern);

  if (groups == null || groups.length < 1) {
    throw new Error(`Failed to parse branch name from ${currentRef}`);
  }
  let branchName = '';
  groups.forEach((group) => {
    branchName = branchName.concat(group);
  });
  branchName = branchName.replace('refsheads', '');
  return branchName;
};

const getShortSha = async (sha, shaSize = null) => {
  const args = [shaSize ? `--short=${shaSize}` : '--short', sha];
  return git.revparse(args);
};

const getTagAtCommit = async (sha) => git.tag(['--points-at', sha])
  .then((output) => output.trim());

const getComposedVersionString = (version, branchNameFriendly, buildNumber, shortSha) => {
  if (!branchNameFriendly) {
    throw Error('branchNameFriendly is null, undefined, or empty');
  }

  const branchType = getBranchType(branchNameFriendly);

  if (branchType === 'master') {
    return `${version}`;
  }

  if (branchType === 'dev') {
    return `${version}-dev-${buildNumber}-${shortSha}`;
  }

  return `${version}-${branchNameFriendly.toLowerCase()}-${shortSha}`;
};

module.exports = {
  getBranchName,
  isPreRelease,
  getBranchNameFriendly,
  getBranchNameShort,
  getBranchNameSemver,
  getShortSha,
  getComposedVersionString,
  getBranchType,
  getTagAtCommit,
};


/***/ }),

/***/ 914:
/***/ ((module) => {

const checkEnv = (variables) => {
  variables.every((name) => {
    if (!process.env[name]) {
      throw new Error(`Missing env var: ${name}`);
    }
    return true;
  });
};

module.exports = checkEnv;


/***/ }),

/***/ 51:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const fs = __webpack_require__(747);
const path = __webpack_require__(622);
const util = __webpack_require__(669);

const recommendedVersionBump = util.promisify(__webpack_require__(913));
const gitRawCommits = __webpack_require__(196);
const conventionalCommitsParser = __webpack_require__(56);
const conventionalChangelog = __webpack_require__(820);
const conventionalCommits = __webpack_require__(363);
const streamToString = __webpack_require__(180);
const through2 = __webpack_require__(405);
const mergeConfig = __webpack_require__(236);
const { getTagAtCommit } = __webpack_require__(518);

const tagPrefix = process.env.TAG_PREFIX || 'v';

/**
 * Returns the recommended version bump based on conventional commits since last tag.
 * @returns {Promise<string>}
 */
const getRecommendedBump = async () => {
  const config = await conventionalCommits();
  return recommendedVersionBump({
    config,
    tagPrefix,
  }).then((recommendation) => recommendation.releaseType);
};

const withConventionalConfig = async (version, fn) => {
  const config = await conventionalCommits();
  config.writerOpts.headerPartial = '';
  const recommendedVersion = version || await getRecommendedBump();

  // If current commit is tagged, include two releases.
  const tag = await getTagAtCommit(process.env.GITHUB_SHA || 'HEAD');
  const releaseCount = tag.startsWith(tagPrefix) ? 2 : 1;

  // Create a dummy package.json
  const dummyPackageJson = path.join(__dirname, 'package.json');
  fs.writeFileSync(dummyPackageJson, JSON.stringify({
    name: 'Changelog',
    version: recommendedVersion,
  }), 'utf8');

  try {
    return fn({
      config,
      tagPrefix,
      releaseCount,
      pkg: {
        path: __dirname,
      },
    },
    {
      issue: 'issues',
      commit: 'commit',
    },
    {},
    {
      referenceActions: [
        'close',
        'closes',
        'closed',
        'fix',
        'fixes',
        'fixed',
        'resolve',
        'resolves',
        'resolved',
      ],
    },
    {});
  } finally {
    fs.unlinkSync(dummyPackageJson);
  }
};

const getCommitStream = async (version) => withConventionalConfig(
  version, (options, context, gitRawCommitsOpts, parserOpts, writerOpts) => mergeConfig(
    options, context, gitRawCommitsOpts, parserOpts, writerOpts,
  ).then((data) => gitRawCommits(data.gitRawCommitsOpts, data.gitRawExecOpts)
    .pipe(conventionalCommitsParser(data.parserOpts))),
);

/**
 * Return all conventional commits from the previous version.
 * @returns {Promise<[*]>}
 */
const getConventionalCommits = async () => {
  const commitStream = await getCommitStream();
  return new Promise((resolve, reject) => {
    const commits = [];
    commitStream.on('finish', () => {
      resolve(commits);
    }).on('error', (err) => {
      reject(err);
    }).pipe(through2.obj((chunk, enc, cb) => {
      if (chunk.type != null) {
        commits.push(chunk);
      }
      cb();
    }));
  });
};

/**
 * Returns a markdown formatted changelog for all conventional changes from the last release
 * up until this commit.
 * @param version the name of the version built now
 * @returns {Promise<string>}
 */
const getChangelog = async (version) => withConventionalConfig(
  version, (options, context, gitRawCommitsOpts, parserOpts, writerOpts) => {
    const out = conventionalChangelog(options, context, gitRawCommitsOpts, parserOpts, writerOpts);
    return streamToString(out).then((notes) => notes.trim());
  },
);

module.exports = {
  getRecommendedBump,
  getChangelog,
  getConventionalCommits,
  tagPrefix,
};


/***/ }),

/***/ 276:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const git = __webpack_require__(934)();

const basicAuth = () => {
  const buffer = Buffer.from(`github-actions:${process.env.GITHUB_TOKEN}`, 'utf8');
  const credentials = buffer.toString('base64');
  return `basic ${credentials}`;
};

/**
 * Configure the local Git instance to allow push operations against the origin.
 */
const gitConfig = async () => git.addConfig('user.email', 'devops@extendaretail.com')
  .then(() => git.addConfig('user.name', 'GitHub Actions'))
  .then(() => git.addConfig('http.https://github.com/.extraheader',
    `AUTHORIZATION: ${basicAuth()}`));

module.exports = gitConfig;


/***/ }),

/***/ 82:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const checkEnv = __webpack_require__(914);
const run = __webpack_require__(244);
const gitConfig = __webpack_require__(276);
const loadTool = __webpack_require__(428);
const loadGitHubToken = __webpack_require__(388);

// Note that src/versions are NOT included here because it adds 2.2MBs to every package
// that uses the utils module. If versions are to be used, include the file explicitly.

module.exports = {
  checkEnv,
  gitConfig,
  loadTool,
  loadGitHubToken,
  run,
};


/***/ }),

/***/ 428:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const core = __webpack_require__(471);
const tc = __webpack_require__(909);
const io = __webpack_require__(538);
const path = __webpack_require__(622);
const axios = __webpack_require__(275);
const { v4: uuid } = __webpack_require__(556);
const fs = __webpack_require__(747);
const os = __webpack_require__(87);

const find = async ({ tool, binary, version }) => Promise.resolve(
  tc.find(tool, version), /* process.arch), */
).then((dir) => (dir ? path.join(dir, binary) : ''));

const downloadToolWithAuth = async (url, auth) => {
  const targetFile = path.join(os.tmpdir(), uuid(), uuid());
  fs.mkdirSync(path.dirname(targetFile));
  const stream = fs.createWriteStream(targetFile);
  await axios({
    url,
    method: 'get',
    auth,
    responseType: 'stream',
  }).then((response) => {
    core.info(`Loading ${response.headers['content-length'] / 1000} KB...`);
    response.data.pipe(stream);
    return new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }).then(() => {
    core.info(`Binary saved to ${targetFile}`);
    fs.chmodSync(targetFile, '0777');
  });
  return targetFile;
};

const internalDownload = async (url, auth) => (
  auth ? downloadToolWithAuth(url, auth) : tc.downloadTool(url)
);

const downloadIfMissing = async (options, cachedTool) => {
  if (!cachedTool) {
    const {
      tool, binary, version, downloadUrl, auth,
    } = options;
    core.info(`Downloading ${tool} from ${downloadUrl}`);
    const downloadUuid = await internalDownload(downloadUrl, auth);

    const tmpDir = path.dirname(downloadUuid);

    if (downloadUrl.endsWith('.tar.gz')) {
      await tc.extractTar(downloadUuid, tmpDir);
    } else if (downloadUrl.endsWith('.zip')) {
      await tc.extractZip(downloadUuid, tmpDir);
    } else if (downloadUrl.endsWith('.7z')) {
      await tc.extract7z(downloadUuid, tmpDir);
    } else {
      // Raw file
      const tmpFile = path.join(tmpDir, binary);
      await io.cp(downloadUuid, tmpFile);
    }
    await tc.cacheDir(tmpDir, tool, version);
    return find(options);
  }
  return cachedTool;
};

const loadTool = async ({
  tool, binary, version, downloadUrl, auth,
}) => {
  const options = {
    tool, binary, version, downloadUrl, auth,
  };
  return find(options).then((cachedTool) => downloadIfMissing(options, cachedTool));
};

module.exports = loadTool;


/***/ }),

/***/ 388:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const core = __webpack_require__(471);

/**
 * Load a GitHub token from either a provided `github-token` input or
 * from a `github-token-secret-name` and `service-account-key`.
 * @param loadSecret a function to load secrets from a GCP secret manager
 * @returns {Promise<*>} the resolved token
 */
const loadGitHubToken = async (loadSecret) => {
  const token = core.getInput('github-token');
  const secretName = core.getInput('github-token-secret-name');
  const serviceAccountKey = core.getInput('service-account-key');
  if (!token && !serviceAccountKey) {
    throw new Error('Missing input. Either provide github-token or service-account-key');
  }
  if (serviceAccountKey && !secretName) {
    throw new Error('Missing input. The secret-name must be set with service-account-key');
  }
  if (!token && serviceAccountKey && secretName) {
    core.info('Load github-token from Secret Manager');
    return loadSecret(serviceAccountKey, secretName);
  }
  return token;
};

module.exports = loadGitHubToken;


/***/ }),

/***/ 244:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const core = __webpack_require__(471);

/**
 * Run an async action and catch any exception.
 * @param action the action to run
 * @returns {Promise<void>}
 */
const run = async (action) => {
  try {
    await action();
  } catch (err) {
    core.setFailed(err.message);
  }
};

module.exports = run;


/***/ }),

/***/ 641:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const core = __webpack_require__(471);
const git = __webpack_require__(934)();
const semver = __webpack_require__(111);
const gitConfig = __webpack_require__(276);
const changes = __webpack_require__(51);

const DEFAULT_VERSION = '0.0.0';

/**
 * Returns the latest tagged release matching the tag prefix.
 * @returns {Promise<string>}
 */
const getLatestReleaseTag = async () => git.tags(['--sort=-version:refname', '--merged', 'HEAD', `${changes.tagPrefix}*`])
  .then((tags) => {
    if (tags.all.length === 0) {
      core.info(`No release tags with prefix '${changes.tagPrefix}' exists, use ${changes.tagPrefix}${DEFAULT_VERSION}`);
    }
    return tags.all[0] || `${changes.tagPrefix}${DEFAULT_VERSION}`;
  });

/**
 * Returns the latest semantic release matching the tag prefix.
 * @returns {Promise<string>}
 */
const getLatestRelease = async () => getLatestReleaseTag()
  .then((tag) => tag.replace(changes.tagPrefix, ''));

/**
 * Returns the version to build. This version number is determined by the last release number
 * and the conventional commits after that release.
 * @param versionSuffix optional version suffix, for example '-SNAPSHOT'
 * @returns {Promise<string>}
 */
const getBuildVersion = async (versionSuffix = '') => {
  const latestRelease = await getLatestRelease();
  const releaseType = await changes.getRecommendedBump();
  core.info(`Conventional commits '${releaseType}' bump from ${latestRelease}`);
  return semver.inc(semver.coerce(latestRelease), releaseType).concat(versionSuffix);
};

/**
 * Create a release tag and push it to origin.
 * @returns {Promise<{changelog: *, tagName: *, version: *}>}
 */
const tagReleaseVersion = async () => {
  const version = await getBuildVersion();
  const changelog = await changes.getChangelog(version);
  const tagName = `${changes.tagPrefix}${version}`;
  await gitConfig().then(() => git.addAnnotatedTag(
    tagName,
    `Release ${version}`,
  ))
    .then(() => git.pushTags());
  return {
    changelog,
    tagName,
    version,
  };
};

const setTagPrefix = (prefix) => {
  changes.tagPrefix = prefix;
};

module.exports = {
  ...changes,
  setTagPrefix,
  getBuildVersion,
  getLatestRelease,
  getLatestReleaseTag,
  tagReleaseVersion,
};


/***/ }),

/***/ 471:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 538:
/***/ ((module) => {

module.exports = eval("require")("@actions/io");


/***/ }),

/***/ 909:
/***/ ((module) => {

module.exports = eval("require")("@actions/tool-cache");


/***/ }),

/***/ 275:
/***/ ((module) => {

module.exports = eval("require")("axios");


/***/ }),

/***/ 363:
/***/ ((module) => {

module.exports = eval("require")("conventional-changelog-conventionalcommits");


/***/ }),

/***/ 820:
/***/ ((module) => {

module.exports = eval("require")("conventional-changelog-core");


/***/ }),

/***/ 236:
/***/ ((module) => {

module.exports = eval("require")("conventional-changelog-core/lib/merge-config");


/***/ }),

/***/ 56:
/***/ ((module) => {

module.exports = eval("require")("conventional-commits-parser");


/***/ }),

/***/ 913:
/***/ ((module) => {

module.exports = eval("require")("conventional-recommended-bump");


/***/ }),

/***/ 196:
/***/ ((module) => {

module.exports = eval("require")("git-raw-commits");


/***/ }),

/***/ 20:
/***/ ((module) => {

module.exports = eval("require")("jira-client");


/***/ }),

/***/ 111:
/***/ ((module) => {

module.exports = eval("require")("semver");


/***/ }),

/***/ 934:
/***/ ((module) => {

module.exports = eval("require")("simple-git/promise");


/***/ }),

/***/ 180:
/***/ ((module) => {

module.exports = eval("require")("stream-to-string");


/***/ }),

/***/ 405:
/***/ ((module) => {

module.exports = eval("require")("through2");


/***/ }),

/***/ 556:
/***/ ((module) => {

module.exports = eval("require")("uuid");


/***/ }),

/***/ 747:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 87:
/***/ ((module) => {

"use strict";
module.exports = require("os");

/***/ }),

/***/ 622:
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ }),

/***/ 669:
/***/ ((module) => {

"use strict";
module.exports = require("util");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		if(__webpack_module_cache__[moduleId]) {
/******/ 			return __webpack_module_cache__[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	__webpack_require__.ab = __dirname + "/";/************************************************************************/
/******/ 	// module exports must be returned from runtime so entry inlining is disabled
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(605);
/******/ })()
;