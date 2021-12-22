// External dependencies
const fs = require("fs")
const path = require("path")
const yaml = require("js-yaml")
const express = require("express")
const EventSource = require('eventsource')
const { Webhooks, createNodeMiddleware  } = require("@octokit/webhooks")
const { createAppAuth } = require("@octokit/auth-app")
const { Octokit } = require("@octokit/core")

// Server Setup
const port = 64897
const app = express()

// configuration load
const privateKey = fs.readFileSync("branch-protector.pem", "utf8")
const config = JSON.parse(fs.readFileSync("config.json", "utf8"))

// Initializing Octokit with our auth
const octoKit = new Octokit({
  previews: ["luke-cage-preview"], // Sets custom header for the multiple reviewers preview API
  authStrategy: createAppAuth,
  auth: {
      appId: config.app_id,
      privateKey: privateKey,
      installationId: config.installation_id,
    }
});

// sets the webhook proxy, can be comment out if not needed
const webhookProxyUrl = config.webproxy_url
const source = new EventSource(webhookProxyUrl)
source.onmessage = (event) => {
  const webhookEvent = JSON.parse(event.data)
  webhooks.verifyAndReceive({
    id: webhookEvent['x-request-id'],
    name: webhookEvent['x-github-event'],
    signature: webhookEvent['x-hub-signature'],
    payload: webhookEvent.body
  }).catch(console.error)
}

// configures webhooks with our secret to verify our messages are sent from our GitHub app.
const webhooks = new Webhooks({ secret: config.secret, path: "/webhooks" })
app.use(createNodeMiddleware(webhooks))

// does logic a new webhook event is received
webhooks.on(["repository.created"], async (event) => {
  const { payload } = event
  console.log("got branch created!" + payload.repository.full_name);
  var owner = payload.repository.owner.login
  var name = payload.repository.name
  var branch = payload.repository.default_branch

  octoKit.request("GET /repos/{owner}/{repo}/branches", {
    owner: owner,
    repo: name,
  }).then(({data, headers, status}) => {
    console.log("done retrieving branches");
    // configure repo
    secureRepository(owner, name)
    if(data.length === 0) { // we need to initialize repo
      initializeRepository(owner, name, branch)
    } else { // repo is initialized, just protect main branch
      // protect main branch
      secureBranch(owner, name, branch)
    }
  })
})

// creates new issue to alert the user of the changes done to the branch and repository.
// can find more information here: https://docs.github.com/en/rest/reference/issues#create-an-issue
function issueAlert(owner, repo, branch) {
  console.log("creating issue to notify users of this event.")
  let message = "@" + owner + " automated standard security policies have been enforced to repository " + repo + " on branch " + branch
  octoKit.request("POST /repos/{owner}/{repo}/issues", {
    owner:owner,
    repo:repo,
    title: "security policies enforced.",
    body: message,
  }).then(({data, headers, status}) => {
    console.log("done alerting user.")
  }).catch(function () {
    console.log("error during issue creation.");
  });
}

// securing the reposiroty with repos best practices found here: https://resources.github.com/videos/github-best-practices/
// can read more about this API here: https://docs.github.com/en/rest/reference/repos#update-a-repository
function secureRepository(owner, repo) {
  console.log("securing repository")
  octoKit.request("PATCH /repos/{owner}/{repo}",{
    owner:owner,
    repo:repo,
    allow_squash_merge: false,
    allow_merge_commit: true,
    allow_rebase_merge: true,
    delete_branch_on_merge: true,
  }).then(({data, headers, status}) => {
    console.log("done securing repo.")
  }).catch(function (error) {
    console.log("error during repo securing.")
    console.error(error)
  });
}

// protects the main branch
// can read more here: https://docs.github.com/en/github/administering-a-repository/defining-the-mergeability-of-pull-requests/managing-a-branch-protection-rule
// API documentation here: https://docs.github.com/en/rest/reference/repos#update-branch-protection
function secureBranch(owner, repo, branch) {
  console.log("securing " + branch + " branch")
  octoKit.request("PUT /repos/{owner}/{repo}/branches/{branch}/protection",{
    owner:owner,
    repo:repo,
    branch: branch,
    required_status_checks: {
      strict : true,
      contexts: []
      },
      enforce_admins: true,
      required_pull_request_reviews: {
        dismissal_restrictions: {},
        dismiss_stale_reviews: true,
        require_code_owner_reviews: false,
        required_approving_review_count: 1
      },
      restrictions: null,
      required_linear_history: false,
      allow_force_pushes: false,
      allow_deletions: false
  }).then(({data, headers, status}) => {
    console.log("done securing branch.")
    // create issue to alert of changes, only on success
    issueAlert(owner, repo, branch)
  }).catch(function (error) {
    console.log("error securing branch.")
    console.error(error)
  });
}

// We can't protect a branch that doesn't exists yet, so we initialize the branch with a simple README file.
function initializeRepository(owner, repo, branch){
  console.log("initializing repo");
  let rawData = Buffer.from("\##" + repo);
  readme_content_base64 = rawData.toString('base64');
  readme_config = "{\"message\": \"automated protection init\", \"content\": \"#{readme_content_base64}\"}"
  octoKit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner:owner,
    repo:repo,
    path: "README.md",
    message: "automated protection init",
    content: readme_content_base64
  }).then(({data, headers, status}) => {
    console.log("done initializing repository.")
    secureBranch(owner, repo, branch)
  }).catch(function (error) {
    console.log("error securing branch.")
    console.log(error)
  });
}

webhooks.onError("error", (error) => {
  console.log(`Error occured in "${error.event.name} handler: ${error.stack}"`)
})

const listener = app.listen(port, () => {
  console.log("Your app is listening on port " + listener.address().port)
})