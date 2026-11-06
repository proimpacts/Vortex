definePlugin({
  name: 'My Plugin',
  description: 'One sentence about what it does.',
  authors: 'Your name',
  tags: ['Utility'],

  // Settings people can change. A plugin with options gets a cog on its card.
  options: {
    greeting: { type: 'text', label: 'Greeting', default: 'Hello' },
    loud: { type: 'boolean', label: 'Shout it', default: false },
  },

  start(api) {
    const greeting = api.options.get('greeting');
    api.log(api.options.get('loud') ? greeting.toUpperCase() : greeting);

    // Change how something looks.
    api.addStyle('.msg-text { letter-spacing: 0.01em; }');

    // Save something for next time.
    api.storage.set('lastStart', Date.now());
  },
});
