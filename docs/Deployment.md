# Deploying

If you would like to run your own instance of this plugin,
see the [docs for deploying plugins](https://github.com/probot/probot/blob/master/docs/deployment.md).

This plugin requires these **Permissions & events** for the GitHub
App:

- Metadata - **Read-only (required for Pull Requests)**
- Issues - **Read & Write**
  - [x] Check the box for **Issues** events
- Pull requests - **Read & Write**
  - [x] Check the box for **Pull request** events
- Content - **Read and write**
  - The app only requires this to check mergibility for base and target
branches and automatically merge them for you (if conflicts are not found
and also hard resets by default), 

## With Docker Compose, locally

```sh
# duplicate the .env.example file as .env
cp .env.example .env
# then edit it (assuming you use nano, but you can replace it
# with vi or code for VS Code if you don't like using GNU nano)
nano .env

# optionally move your app's secret key into the current working
# directory as pm.pem unless you copied the contents into .env
mv /path/to/your-app-name-here.private-key.pem pk.pem

# Hit the road!
docker-compose up
```

## With any PaaS that supports Dockerfiles

_(includes Heroku, Divio, and Railway)_

You may need to download your GitHub app's private key first
into your local copy of this repo. After that, install your PaaS
provider's CLI tool and login as described in their docs.

Creating an new app (or project) in your PaaS provider of choice may
varies, so please consult their documentation if they support
project creation in command-line, otherwise create using their dashboard.

After project creation, your local copy of this repo should be
automatically connected to the remote project on your PaaS you're using.
Otherwise, see their docs on how to connect your local dev machine into
your project in their platforms.

Now, export your app's private key using an specific command for
managing secrets. This may varies on per-provider basis. Since the
private key file is an multiline file, you need to place the cat command
inside double-quotes. If pasting its contents into their web dashboard,
under Config Vars (or Environment Variables), you need to add `\n` at
end of each line and turn multi-line into single-line.

```sh
# make sure you replacing placeholders with your own values
# or things might break!

# Heroku
heroku config:set APP_ID=1234abcd \
    WEBHOOK_SECRET=your-secret-here \
    PRIVATE_KEY="$(cat /path/to/your-app-name-here.private-key.pem)"

# Divio, assuming you set your APP_ID and WEBHOOK_SECRET in
# your project's env vars setting page.
divio project env-vars \
    --set PRIVATE_KEY "$(cat /path/to/your-app-name-here.private-key.pem)" \
    --stage live

# Railway
railway variables APP_ID=1234abcd \
    WEBHOOK_SECRET=your-secret-here \
    PRIVATE_KEY="$(cat /path/to/your-app-name-here.private-key.pem)"
```

Done! Don't forget to deploy your app and give it a shot if it's
working.
