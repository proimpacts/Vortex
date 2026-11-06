# Making a plugin

A plugin is one `.js` file. It can change how Yapin looks, add pages to Settings, react to what is happening in chat, and more.

> **Plugins have full access.** A plugin runs inside Yapin and can read and change everything, including your messages. Only install plugins you wrote or trust, and read the code of anything someone sends you.

## The fastest way

1. Start Yapin with `npm start`.
2. Open **Settings > Vortex > Create & Import**, choose **Plugins**, then **New plugin**.
3. Edit the starter code. Mistakes are shown as you type.
4. **Save**, then **Reload**. Your plugin shows up on the Plugins page.
5. **Export file** gives you a `.js` file to share.

Working in your own editor? Save the file in `%APPDATA%\Vortex\plugins` (run `npm run addons`) and start Yapin with `start-dev.bat`. The app reloads each time you save.

The file name is the plugin's id: lowercase letters, numbers and dashes, such as `my-plugin.js`.

## The smallest plugin

```js
definePlugin({
  name: 'Hello',
  description: 'Says hello in the console.',
  start(api) {
    api.log('hello from my plugin');
  },
});
```

## definePlugin fields

| Field | What it is |
| --- | --- |
| `name` | Shown on the plugin card. |
| `description` | One or two sentences. |
| `authors` | Your name. |
| `tags` | A list such as `['Chat', 'Utility']`. People can filter by these. |
| `options` | Settings people can change (see below). A plugin with options gets a cog on its card. |
| `onOptionChange(key, value)` | Called when someone changes an option, so you can react at once. |
| `start(api)` | Runs once the page is ready. This is where your code goes. |
| `patches` | Advanced: edit the site's own code as it loads (see below). |

If `start()` throws, the error is shown on the plugin's card and everything else keeps working.

## Options

```js
options: {
  greeting: { type: 'text', label: 'Greeting', default: 'Hello' },
  loud:     { type: 'boolean', label: 'Shout it', default: false },
  size:     { type: 'number', label: 'Size', min: 1, max: 10, default: 3 },
  width:    { type: 'range', label: 'Width', min: 300, max: 900, step: 10, default: 600 },
  mode:     { type: 'select', label: 'Mode', choices: ['calm', 'busy'], default: 'calm' },
  note:     { type: 'textarea', label: 'Notes', default: '' },
  tint:     { type: 'color', label: 'Tint', default: '' },        // '' means "not set"; otherwise #rrggbb
  hotkey:   { type: 'keybind', label: 'Shortcut', default: 'Ctrl+Shift+K' }, // user presses the keys to set it
}
```

Every option can also have a `description`. Read a value with `api.options.get('greeting')`.

## The api object

| Call | What it does |
| --- | --- |
| `api.log(...)` | Writes to the console with your plugin's name. |
| `api.addStyle(css)` | Adds CSS to the page. Replaced if you call it again. |
| `api.storage.get(key, fallback)` / `api.storage.set(key, value)` | Saves data for your plugin. It is included in the user's backup. |
| `api.options.get(key)` / `api.options.set(key, value)` | Read or change your options. |
| `api.settings.addPage({ id, label, icon, render(pane) })` | Adds your own page to Settings > Vortex. Fill `pane` with elements. |
| `api.modules.store()` | Yapin's own data store: messages, channels, users. See below. |
| `api.modules.find(fn)`, `findByProps('a', 'b')`, `onModule(fn)` | Look up the site's own code. |
| `api.backup.info()` | Facts about the backup file. |
| `api.manager` | List and switch plugins and themes (`listPlugins`, `setPlugin`, `listThemes`, `setTheme`, `reload`). |
| `api.addons` | Save, preview and delete user-made themes and plugins. |
| `api.version` | The plugin API version (currently `1`). |

## Reading chat data

```js
start(api) {
  const store = api.modules.store();        // { useStore, setState, ... }
  const state = store.useStore.getState();  // messages, channels, profiles, userId, ...
  store.useStore.subscribe((now, before) => {
    if (now.messages !== before.messages) api.log('messages changed');
  });
}
```

`state.messages` is an object: channel id to a list of messages. A message has `id`, `content`, `author_id`, `channel_id`, `created_at` and, when present, `attachment_path` and `edited_at`. `state.profiles[author_id].username` gives a name.

## Adding a Settings page

```js
start(api) {
  api.settings.addPage({
    id: 'hello',
    label: 'Hello',
    render(pane) {
      pane.replaceChildren(Object.assign(document.createElement('h2'), { textContent: 'Hello' }));
    },
  });
}
```

Style it with the app's variables (`var(--bg-elev)`, `var(--text)`) and it will match every theme.

## Patches (advanced)

Patches rewrite a piece of the site's own code before it runs. They are powerful and fragile, because the site's code changes when Yapin updates. Prefer `api.modules` and the store when you can.

```js
patches: [
  { find: 'some unique text in the module', replace: 'some unique text in the module; myHook();' },
]
```

`find` is a string or a regular expression, and `replace` is what to put in its place. Match on text that is unlikely to change.

## Good manners

- Clean up after yourself if you add elements to the page.
- Don't send anything off the user's computer without telling them clearly.
- Keep the file under 500 KB.
- Say what your plugin does in `description`, honestly.

## Sharing

Send the `.js` file. To install one, people use **Create & Import > Plugins > Import a file**, read the code, and press Save. They are asked to confirm because of the full-access warning above.
