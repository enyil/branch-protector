# branch-protecter
A simple web service that listens for  [organization events](https://developer.github.com/webhooks/#events)  to know when a repository has been created. When the repository is created it automate the protection of the main branch. It notifies the owner with a  [@mention](https://help.github.com/articles/basic-writing-and-formatting-syntax/#mentioning-users-and-teams)  in an issue within the repository that outlines the protections that were added.

## *The following rules are enforced*
**Repository**
* Allow merge commits
* Deny squash merge
* Squash commits are not allowed
* Delete branch on merge
	
**Main Branch**
* Pull requests are required to merge to main
* Do not allow re-writting history
* Restrictions are applied to administrators
* Deny branch deletion
* Deny force push

## *Setup*
For this application to work you require:
* a GitHub account
* an organization (you can create one for free)
* a repository
* A GitHub application

**Github App** | [About apps - GitHub Docs](https://docs.github.com/en/developers/apps/getting-started-with-apps/about-apps)

You can read more about GitHub applications in the url above. The first step is to create a GitHub application with the following.

**Repository Permissions:**
* Administration: read & write
* Contents: read & write
* Metadata: read-only

**Subscribe to events:**
* Repository

Once you’ve created your application, you can install it on your organization.

## *Run*
setup: cp config.json.example config.json // run this only if you don't have a config.json file already
start: node lib/server.js // this will start your server. It can be run locally or deployed into your cloud of choice.
