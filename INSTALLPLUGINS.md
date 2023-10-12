# Install Plugins (Authoring Tool)

A helper script is available to install custom plugins for the Authoring Tool, see [installPlugins.js](installPlugins.js)

A custom plugin can have a backend, a frontend, or both.

## Summary

**✅ Does**

- Run as a postinstall script
- Clean the plugins directory before installing
- Copy backend plugins to the correct location
- Install any npm dependencies the plugin may have
- Copy frontend plugins to `frontend/src/plugins`
- Only install plugins with the `isEnabled` property set to `true`

**❌ Does not**

- Rebuild the frontend
- Handle running individual installation steps

## Usage

From the root of the Authoring Tool project, run the following command:

```bash
node installPlugins.js
```

_(Note: Requires setup below)_

## Setup

For each custom plugin, the conf/config.json should be updated.

Example of conf/config.json with three custom plugins:

```json
{
  /*
    ...the rest of the conf/config.json
    */

  // The plugins object should be added to the config.json
  "plugins": {
    // This plugin has a frontend and a backend
    "name-of-plugin-1": {
      "isEnabled": true,
      "frontend": {
        "path": "/home/user/my-custom-plugins/plugin-1/plugin-1-frontend"
      },
      "backend": {
        "path": "/home/user/my-custom-plugins/plugin-1/plugin-1-backend",
        "dest": "plugintype"
      }
    },
    // This plugin only has a backend
    "name-of-plugin-2": {
      "isEnabled": true,
      "frontend": null,
      "backend": {
        "path": "/home/user/my-custom-plugins/plugin-2/plugin-2-backend",
        "dest": "plugintype"
      }
    },
    // This plugin is disabled
    "name-of-plugin-3": {
      "isEnabled": true,
      "frontend": null,
      "backend": {
        "path": "/home/user/my-custom-plugins/plugin-3/plugin-3-backend",
        "dest": "plugintype"
      }
    }
  }
}
```

## Break down of plugin configuration

#### Name of plugin `(String)`

e.g. `name-of-plugin-1`

This name should match the name given in the plugin's `package.json` file. If it's a custom plugin without a backend, something beginning with `adapt-` should be used.

#### isEnabled `(Boolean)`

If set to `true`, the plugin will be installed. If set to `false`, the plugin will not be installed.

#### frontend `(Object)`

All frontend plugins are copied to `frontend/src/plugins`.

Can be `null`

If the plugin has a frontend, the frontend object should contain:

`path` property, which is used as the source for the frontend plugin files.

Should be a valid path on the local filesystem.

The name of the last folder in the path will be used as the name of the plugin folder in `frontend/src/plugins`.
e.g.

```json
"frontend": {
  "path": "path/to/my-frontend-plugin"
}
```

Will copy the plugin to `frontend/src/plugins/my-frontend-plugin`

#### backend `(Object)`

The backend object should contain:

`path` property, which is used as the source for the backend plugin files.
Should be a valid path on the local filesystem.

`dest` property, which is used as the destination for the backend plugin files.
Can be one of the plugin folders that already exist, e.g. "auth", "content", "output", "filestorage", or it can be a new folder name.

e.g.

```json
"backend": {
  "path": "path/to/my-backend-plugin",
  "dest": "plugintype"
}
```

Will copy the plugin to `plugins/plugintype/my-backend-plugin`
