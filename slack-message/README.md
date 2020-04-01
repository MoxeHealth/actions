# slack-message

This GitHub Action can be used to send messages to Slack through the GitHub Slack Integration. Messages
posted with this action are delivered to all Slack channels that are subscribed to the repository.

To subscribe Slack channel to a repository, add the `@github` bot and add the subscription
with  `/github subscribe <owner>/<repo>`, for example `/github subscribe extenda/actions`

## Usage

See [action.yml](action.yml).

### Secrets

If this action is used with GCP Secret Manager it requires a GCP service account key with permission to access
secret payloads. Once created, the JSON key should be `base64` encoded and added as secret in the GitHub repository.

It is recommended that the service account _only_ has permissions to access secrets. Do not allow modifications or
access to any other resources in your project.

### Examples

#### Usage With Secret Manager

This example will load a `github-token` named secret from the GCP Secret Manager accessible using
the provided `service-account-key`. The default secret name can be modified with the
`github-token-secret-name` input variable.

```yaml
on: push

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v1

      - name: Notify Slack
        uses: extenda/actions/slack-message@v0
        with:
          title: 'Slack Message Action :robot_face:'
          text: |
            This message is sent by GitHub Actions :rocket:

            It contains *formatting* and multiple lines.
          fallback: This message is sent by GitHub Actions
          service-account-key: ${{ secrets.SECRET_AUTH }}
```

#### Usage With Personal Access Token

This example will use the provided `github-token`. Note that the default `GITHUB_TOKEN` generated by GitHub Actions
is not supported. The token *must* be a Personal Access Token.

```yaml
on: push

jobs:
   notify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v1

      - name: Notify Slack
        uses: extenda/actions/slack-message@v0
        with:
          text: 'This message is sent by GitHub Actions :rocket:'
          github-token: ${{ secrets.SLACK_GITHUB_TOKEN }}
```