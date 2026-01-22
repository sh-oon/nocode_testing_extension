// Create the DevTools panel
chrome.devtools.panels.create('Like Cake', '', 'src/devtools/panel.html', (panel) => {
  console.log('[Like Cake] DevTools panel created');

  panel.onShown.addListener(() => {
    console.log('[Like Cake] Panel shown');
  });

  panel.onHidden.addListener(() => {
    console.log('[Like Cake] Panel hidden');
  });
});
